use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Deserialize;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{
        PropertyFeature, PropertyPhoto, PublicPortalRepository, PublicPropertyListing,
        PublicUnitSummary, UnitStatus,
    },
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
    monthly_rent_cents: i32,
    status: String,
}

#[derive(Debug, Deserialize)]
struct PublicFeatureJson {
    id: Uuid,
    property_id: Uuid,
    label: String,
    category: String,
    display_order: i32,
    created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
struct PublicPhotoJson {
    id: Uuid,
    property_id: Uuid,
    storage_key: String,
    cdn_url: String,
    caption: Option<String>,
    is_cover: bool,
    display_order: i32,
    created_at: DateTime<Utc>,
}

const PUBLIC_PROPERTY_SELECT: &str = r#"
SELECT
    p.id,
    p.name,
    p.address_line1,
    p.address_line2,
    p.city,
    p.state_province,
    p.postal_code,
    p.rich_description,
    p.latitude,
    p.longitude,
    p.pet_policy,
    p.lease_terms,
    COALESCE(MIN(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'vacant'),
             MIN(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL))::int8 AS min_rent_cents,
    COALESCE(MAX(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'vacant'),
             MAX(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL))::int8 AS max_rent_cents,
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
                    'monthly_rent_cents', vu.monthly_rent_cents,
                    'status', vu.status
                )
                ORDER BY vu.monthly_rent_cents ASC, vu.unit_number ASC
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
    ) AS amenities_json,
    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'id', pf.id,
                    'property_id', pf.property_id,
                    'label', pf.label,
                    'category', pf.category,
                    'display_order', pf.display_order,
                    'created_at', pf.created_at
                )
                ORDER BY pf.display_order ASC, pf.created_at ASC
            )
            FROM property_features pf
            WHERE pf.property_id = p.id
        ),
        '[]'::json
    ) AS features_json,
    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'id', pph.id,
                    'property_id', pph.property_id,
                    'storage_key', pph.storage_key,
                    'cdn_url', pph.cdn_url,
                    'caption', pph.caption,
                    'is_cover', pph.is_cover,
                    'display_order', pph.display_order,
                    'created_at', pph.created_at
                )
                ORDER BY pph.is_cover DESC, pph.display_order ASC, pph.created_at ASC
            )
            FROM property_photos pph
            WHERE pph.property_id = p.id
        ),
        '[]'::json
    ) AS photos_json
FROM properties p
LEFT JOIN units u ON u.property_id = p.id
LEFT JOIN property_staff ps ON ps.property_id = p.id
WHERE p.deleted_at IS NULL
"#;

fn map_public_listing_row(r: &PgRow) -> PublicPropertyListing {
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
            monthly_rent_cents: u.monthly_rent_cents,
            status: UnitStatus::from_db_str(&u.status),
        })
        .collect();

    let amenities_val: serde_json::Value = r.get("amenities_json");
    let amenities: Vec<String> = serde_json::from_value(amenities_val).unwrap_or_default();

    let features_val: serde_json::Value = r.get("features_json");
    let parsed_features: Vec<PublicFeatureJson> =
        serde_json::from_value(features_val).unwrap_or_default();
    let features = parsed_features
        .into_iter()
        .map(|f| PropertyFeature {
            id: f.id,
            property_id: f.property_id,
            label: f.label,
            category: f.category,
            display_order: f.display_order,
            created_at: f.created_at,
        })
        .collect();

    let photos_val: serde_json::Value = r.get("photos_json");
    let parsed_photos: Vec<PublicPhotoJson> =
        serde_json::from_value(photos_val).unwrap_or_default();
    let photos = parsed_photos
        .into_iter()
        .map(|ph| PropertyPhoto {
            id: ph.id,
            property_id: ph.property_id,
            storage_key: ph.storage_key,
            cdn_url: ph.cdn_url,
            caption: ph.caption,
            is_cover: ph.is_cover,
            display_order: ph.display_order,
            created_at: ph.created_at,
        })
        .collect();

    PublicPropertyListing {
        id: r.get("id"),
        name: r.get("name"),
        address_line1: r.get("address_line1"),
        address_line2: r.get("address_line2"),
        city: r.get("city"),
        state_province: r.get("state_province"),
        postal_code: r.get("postal_code"),
        rich_description: r.get("rich_description"),
        latitude: r.get("latitude"),
        longitude: r.get("longitude"),
        pet_policy: r.get("pet_policy"),
        lease_terms: r.get("lease_terms"),
        min_rent_cents: r.get("min_rent_cents"),
        max_rent_cents: r.get("max_rent_cents"),
        total_units: r.get("total_units"),
        available_units: r.get("available_units"),
        manager_count: r.get("manager_count"),
        vacant_units,
        amenities,
        features,
        photos,
    }
}

#[async_trait]
impl PublicPortalRepository for PostgresAdminRepository {
    async fn list_public_properties(&self) -> DomainResult<Vec<PublicPropertyListing>> {
        let query_str = format!(
            "{} GROUP BY p.id ORDER BY p.name ASC",
            PUBLIC_PROPERTY_SELECT
        );
        let rows = sqlx::query(&query_str)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                DomainError::Internal(format!("Failed to load public property listings: {}", e))
            })?;

        Ok(rows.iter().map(map_public_listing_row).collect())
    }

    async fn get_public_property(
        &self,
        property_id: Uuid,
    ) -> DomainResult<Option<PublicPropertyListing>> {
        let query_str = format!("{} AND p.id = $1 GROUP BY p.id", PUBLIC_PROPERTY_SELECT);
        let row = sqlx::query(&query_str)
            .bind(property_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| {
                DomainError::Internal(format!("Failed to load public property showcase: {}", e))
            })?;

        Ok(row.as_ref().map(map_public_listing_row))
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
