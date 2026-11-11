use async_trait::async_trait;
use chrono::Utc;
use sqlx::Row;
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{ParkingLayout, ParkingLayoutRepository, ParkingLayoutWithSpots, ParkingSpot, SpotType},
    errors::{DomainError, DomainResult},
};

#[async_trait]
impl ParkingLayoutRepository for PostgresAdminRepository {
    async fn get_parking_layout(&self, property_id: Uuid) -> DomainResult<Option<ParkingLayoutWithSpots>> {
        let layout_row = sqlx::query(
            r#"
            SELECT id, property_id, canvas_width, canvas_height, grid_size, updated_at
            FROM parking_layouts
            WHERE property_id = $1
            "#
        )
        .bind(property_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch parking layout: {}", e)))?;

        let layout = match layout_row {
            Some(r) => ParkingLayout {
                id: r.get("id"),
                property_id: r.get("property_id"),
                canvas_width: r.get("canvas_width"),
                canvas_height: r.get("canvas_height"),
                grid_size: r.get("grid_size"),
                updated_at: r.get("updated_at"),
            },
            None => return Ok(None),
        };

        let spot_rows = sqlx::query(
            r#"
            SELECT 
                s.id, s.layout_id, s.spot_label, s.x, s.y, s.width, s.height, s.rotation, s.spot_type, s.is_occupied, s.assigned_tenant_id,
                CASE WHEN t.id IS NOT NULL THEN t.first_name || ' ' || t.last_name ELSE NULL END as tenant_name,
                s.created_at, s.updated_at
            FROM parking_spots s
            LEFT JOIN tenants t ON t.id = s.assigned_tenant_id AND t.deleted_at IS NULL
            WHERE s.layout_id = $1
            ORDER BY s.spot_label ASC
            "#
        )
        .bind(layout.id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch parking spots: {}", e)))?;

        let spots = spot_rows
            .into_iter()
            .map(|r| {
                let type_str: String = r.get("spot_type");
                ParkingSpot {
                    id: r.get("id"),
                    layout_id: r.get("layout_id"),
                    spot_label: r.get("spot_label"),
                    x: r.get("x"),
                    y: r.get("y"),
                    width: r.get("width"),
                    height: r.get("height"),
                    rotation: r.get("rotation"),
                    spot_type: SpotType::from_str(&type_str),
                    is_occupied: r.get("is_occupied"),
                    assigned_tenant_id: r.get("assigned_tenant_id"),
                    tenant_name: r.get("tenant_name"),
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }
            })
            .collect();

        Ok(Some(ParkingLayoutWithSpots { layout, spots }))
    }

    async fn save_parking_layout(
        &self,
        property_id: Uuid,
        canvas_width: i32,
        canvas_height: i32,
        grid_size: i32,
        spots: Vec<ParkingSpot>,
    ) -> DomainResult<ParkingLayoutWithSpots> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to start parking layout transaction: {}", e)))?;

        let layout_id = Uuid::new_v4();

        let layout_row = sqlx::query(
            r#"
            INSERT INTO parking_layouts (id, property_id, canvas_width, canvas_height, grid_size, updated_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            ON CONFLICT (property_id) DO UPDATE
            SET canvas_width = EXCLUDED.canvas_width,
                canvas_height = EXCLUDED.canvas_height,
                grid_size = EXCLUDED.grid_size,
                updated_at = NOW()
            RETURNING id, property_id, canvas_width, canvas_height, grid_size, updated_at
            "#
        )
        .bind(layout_id)
        .bind(property_id)
        .bind(canvas_width)
        .bind(canvas_height)
        .bind(grid_size)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to upsert parking layout: {}", e)))?;

        let active_layout_id: Uuid = layout_row.get("id");
        let layout = ParkingLayout {
            id: active_layout_id,
            property_id: layout_row.get("property_id"),
            canvas_width: layout_row.get("canvas_width"),
            canvas_height: layout_row.get("canvas_height"),
            grid_size: layout_row.get("grid_size"),
            updated_at: layout_row.get("updated_at"),
        };

        sqlx::query("DELETE FROM parking_spots WHERE layout_id = $1")
            .bind(active_layout_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to clear old parking spots: {}", e)))?;

        let mut saved_spots = Vec::new();
        for spot in spots {
            let spot_id = if spot.id.is_nil() { Uuid::new_v4() } else { spot.id };
            let now = Utc::now();

            sqlx::query(
                r#"
                INSERT INTO parking_spots (
                    id, layout_id, spot_label, x, y, width, height, rotation, spot_type, is_occupied, assigned_tenant_id, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                "#
            )
            .bind(spot_id)
            .bind(active_layout_id)
            .bind(&spot.spot_label)
            .bind(spot.x)
            .bind(spot.y)
            .bind(spot.width)
            .bind(spot.height)
            .bind(spot.rotation)
            .bind(spot.spot_type.as_str())
            .bind(spot.is_occupied)
            .bind(spot.assigned_tenant_id)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to insert spot '{}': {}", spot.spot_label, e)))?;

            saved_spots.push(ParkingSpot {
                id: spot_id,
                layout_id: active_layout_id,
                spot_label: spot.spot_label,
                x: spot.x,
                y: spot.y,
                width: spot.width,
                height: spot.height,
                rotation: spot.rotation,
                spot_type: spot.spot_type,
                is_occupied: spot.is_occupied,
                assigned_tenant_id: spot.assigned_tenant_id,
                tenant_name: None,
                created_at: now,
                updated_at: now,
            });
        }

        tx.commit()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to commit parking layout transaction: {}", e)))?;

        Ok(ParkingLayoutWithSpots { layout, spots: saved_spots })
    }
}

