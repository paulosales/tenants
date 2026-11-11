use async_trait::async_trait;
use serde::Deserialize;
use sqlx::Row;
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{PublicPortalRepository, PublicPropertyListing, PublicUnitSummary, UnitStatus},
    errors::{DomainError, DomainResult},
};

#[derive(Debug, Deserialize)]
struct PublicUnitRowJson {
    id: Uuid,
    unit_number: String,
    floor: i32,
    bedrooms: i32,
    bathrooms: f64,
    square_feet: i32,
    status: String,
}

#[async_trait]
impl PublicPortalRepository for PostgresAdminRepository {
    async fn list_public_properties(&self) -> DomainResult<Vec<PublicPropertyListing>> {
        let rows = sqlx::query(
            r#"
            SELECT
                p.id,
                p.name,
                p.address_line1,
                p.address_line2,
                p.city,
                p.state_province,
                p.postal_code,
                COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL) AS total_units,
                COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'vacant') AS available_units,
                COUNT(DISTINCT ps.id) FILTER (WHERE ps.deleted_at IS NULL AND ps.role = 'manager' AND ps.status = 'active') AS manager_count,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', vu.id,
                                'unit_number', vu.unit_number,
                                'floor', vu.floor,
                                'bedrooms', vu.bedrooms,
                                'bathrooms', vu.bathrooms::float8,
                                'square_feet', vu.square_feet,
                                'status', vu.status
                            )
                            ORDER BY vu.unit_number ASC
                        )
                        FROM units vu
                        WHERE vu.property_id = p.id AND vu.deleted_at IS NULL AND vu.status = 'vacant'
                    ),
                    '[]'::json
                ) AS vacant_units_json,
                COALESCE(
                    (
                        SELECT json_agg(DISTINCT a.name ORDER BY a.name ASC)
                        FROM amenities a
                        WHERE a.property_id = p.id AND a.deleted_at IS NULL AND a.is_active = TRUE
                    ),
                    '[]'::json
                ) AS amenities_json
            FROM properties p
            LEFT JOIN units u ON u.property_id = p.id
            LEFT JOIN property_staff ps ON ps.property_id = p.id
            WHERE p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY p.name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to load public property listings: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let units_val: serde_json::Value = r.get("vacant_units_json");
                let parsed_units: Vec<PublicUnitRowJson> =
                    serde_json::from_value(units_val).unwrap_or_default();
                let vacant_units = parsed_units
                    .into_iter()
                    .map(|u| PublicUnitSummary {
                        id: u.id,
                        unit_number: u.unit_number,
                        floor: u.floor,
                        bedrooms: u.bedrooms,
                        bathrooms: u.bathrooms,
                        square_feet: u.square_feet,
                        status: UnitStatus::from_str(&u.status),
                    })
                    .collect();

                let amenities_val: serde_json::Value = r.get("amenities_json");
                let amenities: Vec<String> = serde_json::from_value(amenities_val).unwrap_or_default();

                PublicPropertyListing {
                    id: r.get("id"),
                    name: r.get("name"),
                    address_line1: r.get("address_line1"),
                    address_line2: r.get("address_line2"),
                    city: r.get("city"),
                    state_province: r.get("state_province"),
                    postal_code: r.get("postal_code"),
                    total_units: r.get("total_units"),
                    available_units: r.get("available_units"),
                    manager_count: r.get("manager_count"),
                    vacant_units,
                    amenities,
                }
            })
            .collect())
    }

    async fn count_property_managers(&self, property_id: Uuid) -> DomainResult<i64> {
        let row = sqlx::query(
            r#"
            SELECT COUNT(*) AS cnt
            FROM property_staff
            WHERE property_id = $1 AND role = 'manager' AND status = 'active' AND deleted_at IS NULL
            "#,
        )
        .bind(property_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to count property managers: {}", e)))?;

        Ok(row.get("cnt"))
    }
}

