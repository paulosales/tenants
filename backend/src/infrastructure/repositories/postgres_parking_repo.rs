use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{
    errors::{DomainError, DomainResult},
    parking::{
        GeometryCoordinates, ParkingLayoutResponse, ParkingSpot, ParkingSpotNode, ParkingZone,
        SpotStatus,
    },
    repository::ParkingRepository,
};

pub struct PostgresParkingRepository {
    pool: PgPool,
}

impl PostgresParkingRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct ZoneRow {
    id: Uuid,
    name: String,
    floor_level: i32,
    svg_viewbox: String,
    svg_raw: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

impl From<ZoneRow> for ParkingZone {
    fn from(r: ZoneRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            floor_level: r.floor_level,
            svg_viewbox: r.svg_viewbox,
            svg_raw: r.svg_raw,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct SpotRow {
    id: Uuid,
    zone_id: Uuid,
    spot_number: String,
    spot_type: String,
    shape_type: String,
    coordinates: serde_json::Value,
    hourly_rate_cents: i32,
    monthly_rate_cents: i32,
    status: String,
    assigned_tenant_id: Option<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

impl TryFrom<SpotRow> for ParkingSpot {
    type Error = DomainError;

    fn try_from(r: SpotRow) -> Result<Self, Self::Error> {
        let coordinates: GeometryCoordinates = serde_json::from_value(r.coordinates)
            .map_err(|e| DomainError::Internal(format!("Invalid coordinates JSON in DB: {}", e)))?;

        Ok(Self {
            id: r.id,
            zone_id: r.zone_id,
            spot_number: r.spot_number,
            spot_type: r.spot_type.into(),
            shape_type: r.shape_type.into(),
            coordinates,
            hourly_rate_cents: r.hourly_rate_cents,
            monthly_rate_cents: r.monthly_rate_cents,
            status: r.status.into(),
            assigned_tenant_id: r.assigned_tenant_id,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
        })
    }
}

#[async_trait]
impl ParkingRepository for PostgresParkingRepository {
    async fn list_zones(&self) -> DomainResult<Vec<ParkingZone>> {
        let rows = sqlx::query_as::<_, ZoneRow>(
            r#"
            SELECT id, name, floor_level, svg_viewbox, svg_raw, created_at, updated_at, deleted_at
            FROM parking_zones
            WHERE deleted_at IS NULL
            ORDER BY floor_level ASC, name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list parking zones: {}", e)))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn get_zone_layout(&self, zone_id: Uuid) -> DomainResult<Option<ParkingLayoutResponse>> {
        let zone_row = sqlx::query_as::<_, ZoneRow>(
            r#"
            SELECT id, name, floor_level, svg_viewbox, svg_raw, created_at, updated_at, deleted_at
            FROM parking_zones
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(zone_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get zone: {}", e)))?;

        let zone: ParkingZone = match zone_row {
            Some(z) => z.into(),
            None => return Ok(None),
        };

        let spot_rows = sqlx::query_as::<_, SpotRow>(
            r#"
            SELECT id, zone_id, spot_number, spot_type, shape_type, coordinates,
                   hourly_rate_cents, monthly_rate_cents, status, assigned_tenant_id,
                   created_at, updated_at, deleted_at
            FROM parking_spots
            WHERE zone_id = $1 AND deleted_at IS NULL
            ORDER BY spot_number ASC
            "#,
        )
        .bind(zone_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get spots for zone: {}", e)))?;

        let mut spots = Vec::new();
        for r in spot_rows {
            let spot: ParkingSpot = r.try_into()?;
            spots.push(ParkingSpotNode {
                id: spot.id,
                spot_number: spot.spot_number,
                spot_type: spot.spot_type,
                shape: spot.shape_type,
                coordinates: spot.coordinates,
                status: spot.status,
                hourly_rate_cents: spot.hourly_rate_cents,
                monthly_rate_cents: spot.monthly_rate_cents,
                assigned_tenant_id: spot.assigned_tenant_id,
            });
        }

        Ok(Some(ParkingLayoutResponse { zone, spots }))
    }

    async fn find_spot_by_id(&self, spot_id: Uuid) -> DomainResult<Option<ParkingSpot>> {
        let row = sqlx::query_as::<_, SpotRow>(
            r#"
            SELECT id, zone_id, spot_number, spot_type, shape_type, coordinates,
                   hourly_rate_cents, monthly_rate_cents, status, assigned_tenant_id,
                   created_at, updated_at, deleted_at
            FROM parking_spots
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(spot_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to find parking spot: {}", e)))?;

        match row {
            Some(r) => Ok(Some(r.try_into()?)),
            None => Ok(None),
        }
    }

    async fn update_spot_status(
        &self,
        spot_id: Uuid,
        status: SpotStatus,
        tenant_id: Option<Uuid>,
    ) -> DomainResult<()> {
        sqlx::query(
            r#"
            UPDATE parking_spots
            SET status = $1, assigned_tenant_id = $2, updated_at = NOW()
            WHERE id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(status.to_string())
        .bind(tenant_id)
        .bind(spot_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update spot status: {}", e)))?;

        Ok(())
    }

    async fn upsert_spot(&self, spot: &ParkingSpot) -> DomainResult<ParkingSpot> {
        let coords_json = serde_json::to_value(&spot.coordinates)
            .map_err(|e| DomainError::Internal(e.to_string()))?;

        let row = sqlx::query_as::<_, SpotRow>(
            r#"
            INSERT INTO parking_spots (
                id, zone_id, spot_number, spot_type, shape_type, coordinates,
                hourly_rate_cents, monthly_rate_cents, status, assigned_tenant_id,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (zone_id, spot_number) DO UPDATE
            SET spot_type = EXCLUDED.spot_type,
                shape_type = EXCLUDED.shape_type,
                coordinates = EXCLUDED.coordinates,
                hourly_rate_cents = EXCLUDED.hourly_rate_cents,
                monthly_rate_cents = EXCLUDED.monthly_rate_cents,
                updated_at = NOW()
            RETURNING id, zone_id, spot_number, spot_type, shape_type, coordinates,
                      hourly_rate_cents, monthly_rate_cents, status, assigned_tenant_id,
                      created_at, updated_at, deleted_at
            "#,
        )
        .bind(spot.id)
        .bind(spot.zone_id)
        .bind(&spot.spot_number)
        .bind(spot.spot_type.to_string())
        .bind(spot.shape_type.to_string())
        .bind(coords_json)
        .bind(spot.hourly_rate_cents)
        .bind(spot.monthly_rate_cents)
        .bind(spot.status.to_string())
        .bind(spot.assigned_tenant_id)
        .bind(spot.created_at)
        .bind(spot.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to upsert spot: {}", e)))?;

        row.try_into()
    }

    async fn save_svg_layout(&self, zone_id: Uuid, svg_markup: &str) -> DomainResult<()> {
        sqlx::query(
            r#"
            UPDATE parking_zones
            SET svg_raw = $1, updated_at = NOW()
            WHERE id = $2 AND deleted_at IS NULL
            "#,
        )
        .bind(svg_markup)
        .bind(zone_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to save SVG layout: {}", e)))?;

        Ok(())
    }
}
