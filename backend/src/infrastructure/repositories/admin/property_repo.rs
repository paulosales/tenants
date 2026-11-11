use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{
        Property, PropertyFeature, PropertyFeatureRepository, PropertyPhoto,
        PropertyPhotoRepository, PropertyRepository, PropertyWithStats,
    },
    errors::{DomainError, DomainResult},
};

fn map_property_row(r: &PgRow) -> Property {
    Property {
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
        features: Vec::new(),
        photos: Vec::new(),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

fn map_feature_row(r: &PgRow) -> PropertyFeature {
    PropertyFeature {
        id: r.get("id"),
        property_id: r.get("property_id"),
        label: r.get("label"),
        category: r.get("category"),
        display_order: r.get("display_order"),
        created_at: r.get("created_at"),
    }
}

fn map_photo_row(r: &PgRow) -> PropertyPhoto {
    PropertyPhoto {
        id: r.get("id"),
        property_id: r.get("property_id"),
        storage_key: r.get("storage_key"),
        cdn_url: r.get("cdn_url"),
        caption: r.get("caption"),
        is_cover: r.get("is_cover"),
        display_order: r.get("display_order"),
        created_at: r.get("created_at"),
    }
}

#[async_trait]
impl PropertyRepository for PostgresAdminRepository {
    async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>> {
        let rows = sqlx::query(
            r#"
            SELECT
                p.id, p.name, p.address_line1, p.address_line2, p.city, p.state_province, p.postal_code,
                p.rich_description, p.latitude, p.longitude, p.pet_policy, p.lease_terms,
                COALESCE(MIN(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'vacant'),
                         MIN(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL))::int8 AS min_rent_cents,
                COALESCE(MAX(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL AND u.status = 'vacant'),
                         MAX(u.monthly_rent_cents) FILTER (WHERE u.deleted_at IS NULL))::int8 AS max_rent_cents,
                (
                    SELECT pp.cdn_url
                    FROM property_photos pp
                    WHERE pp.property_id = p.id
                    ORDER BY pp.is_cover DESC, pp.display_order ASC, pp.created_at ASC
                    LIMIT 1
                ) AS cover_photo_url,
                COALESCE(COUNT(DISTINCT pf.id), 0)::int8 AS feature_count,
                COALESCE(COUNT(DISTINCT pph.id), 0)::int8 AS photo_count,
                COALESCE(COUNT(DISTINCT u.id) FILTER (WHERE u.deleted_at IS NULL), 0)::int8 AS unit_count,
                COALESCE(COUNT(DISTINCT CASE WHEN u.deleted_at IS NULL AND u.status = 'occupied' THEN u.id END), 0)::int8 AS occupied_units_count,
                COALESCE(COUNT(DISTINCT t.id) FILTER (WHERE t.deleted_at IS NULL AND t.status = 'active'), 0)::int8 AS tenant_count,
                p.created_at, p.updated_at
            FROM properties p
            LEFT JOIN units u ON u.property_id = p.id
            LEFT JOIN tenants t ON t.assigned_unit_id = u.id
            LEFT JOIN property_features pf ON pf.property_id = p.id
            LEFT JOIN property_photos pph ON pph.property_id = p.id
            WHERE p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY p.name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list properties: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| PropertyWithStats {
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
                cover_photo_url: r.get("cover_photo_url"),
                feature_count: r.get("feature_count"),
                photo_count: r.get("photo_count"),
                unit_count: r.get("unit_count"),
                occupied_units_count: r.get("occupied_units_count"),
                tenant_count: r.get("tenant_count"),
                created_at: r.get("created_at"),
                updated_at: r.get("updated_at"),
            })
            .collect())
    }

    async fn get_property(&self, id: Uuid) -> DomainResult<Option<Property>> {
        let row = sqlx::query(
            r#"
            SELECT id, name, address_line1, address_line2, city, state_province, postal_code,
                   rich_description, latitude, longitude, pet_policy, lease_terms,
                   created_at, updated_at
            FROM properties
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get property: {}", e)))?;

        match row {
            Some(ref r) => {
                let mut prop = map_property_row(r);
                prop.features = self.list_features(id).await?;
                prop.photos = self.list_photos(id).await?;
                Ok(Some(prop))
            }
            None => Ok(None),
        }
    }

    async fn create_property(&self, property: Property) -> DomainResult<Property> {
        let row = sqlx::query(
            r#"
            INSERT INTO properties (
                id, name, address_line1, address_line2, city, state_province, postal_code,
                rich_description, latitude, longitude, pet_policy, lease_terms,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id, name, address_line1, address_line2, city, state_province, postal_code,
                      rich_description, latitude, longitude, pet_policy, lease_terms,
                      created_at, updated_at
            "#,
        )
        .bind(property.id)
        .bind(&property.name)
        .bind(&property.address_line1)
        .bind(&property.address_line2)
        .bind(&property.city)
        .bind(&property.state_province)
        .bind(&property.postal_code)
        .bind(&property.rich_description)
        .bind(property.latitude)
        .bind(property.longitude)
        .bind(&property.pet_policy)
        .bind(&property.lease_terms)
        .bind(property.created_at)
        .bind(property.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create property: {}", e)))?;

        Ok(map_property_row(&row))
    }

    async fn update_property(&self, property: Property) -> DomainResult<Property> {
        let row = sqlx::query(
            r#"
            UPDATE properties
            SET name = $2, address_line1 = $3, address_line2 = $4, city = $5,
                state_province = $6, postal_code = $7, rich_description = $8,
                latitude = $9, longitude = $10, pet_policy = $11, lease_terms = $12,
                updated_at = $13
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, name, address_line1, address_line2, city, state_province, postal_code,
                      rich_description, latitude, longitude, pet_policy, lease_terms,
                      created_at, updated_at
            "#,
        )
        .bind(property.id)
        .bind(&property.name)
        .bind(&property.address_line1)
        .bind(&property.address_line2)
        .bind(&property.city)
        .bind(&property.state_province)
        .bind(&property.postal_code)
        .bind(&property.rich_description)
        .bind(property.latitude)
        .bind(property.longitude)
        .bind(&property.pet_policy)
        .bind(&property.lease_terms)
        .bind(property.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update property: {}", e)))?;

        let mut updated = map_property_row(&row);
        updated.features = self.list_features(property.id).await?;
        updated.photos = self.list_photos(property.id).await?;
        Ok(updated)
    }

    async fn delete_property(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE properties SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete property: {}", e)))?;
        Ok(())
    }

    async fn count_property_units(&self, property_id: Uuid) -> DomainResult<i64> {
        let row = sqlx::query("SELECT COUNT(*)::int8 as count FROM units WHERE property_id = $1 AND deleted_at IS NULL")
            .bind(property_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to count units: {}", e)))?;
        Ok(row.get("count"))
    }
}

#[async_trait]
impl PropertyFeatureRepository for PostgresAdminRepository {
    async fn list_features(&self, property_id: Uuid) -> DomainResult<Vec<PropertyFeature>> {
        let rows = sqlx::query(
            r#"
            SELECT id, property_id, label, category, display_order, created_at
            FROM property_features
            WHERE property_id = $1
            ORDER BY display_order ASC, created_at ASC
            "#,
        )
        .bind(property_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list property features: {}", e)))?;

        Ok(rows.iter().map(map_feature_row).collect())
    }

    async fn add_feature(&self, feature: PropertyFeature) -> DomainResult<PropertyFeature> {
        let row = sqlx::query(
            r#"
            INSERT INTO property_features (id, property_id, label, category, display_order, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, property_id, label, category, display_order, created_at
            "#,
        )
        .bind(feature.id)
        .bind(feature.property_id)
        .bind(&feature.label)
        .bind(&feature.category)
        .bind(feature.display_order)
        .bind(feature.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create property feature: {}", e)))?;

        Ok(map_feature_row(&row))
    }

    async fn delete_feature(&self, property_id: Uuid, feature_id: Uuid) -> DomainResult<()> {
        let res = sqlx::query("DELETE FROM property_features WHERE id = $1 AND property_id = $2")
            .bind(feature_id)
            .bind(property_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete property feature: {}", e)))?;

        if res.rows_affected() == 0 {
            return Err(DomainError::NotFound("Property feature not found".into()));
        }
        Ok(())
    }
}

#[async_trait]
impl PropertyPhotoRepository for PostgresAdminRepository {
    async fn list_photos(&self, property_id: Uuid) -> DomainResult<Vec<PropertyPhoto>> {
        let rows = sqlx::query(
            r#"
            SELECT id, property_id, storage_key, cdn_url, caption, is_cover, display_order, created_at
            FROM property_photos
            WHERE property_id = $1
            ORDER BY is_cover DESC, display_order ASC, created_at ASC
            "#,
        )
        .bind(property_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list property photos: {}", e)))?;

        Ok(rows.iter().map(map_photo_row).collect())
    }

    async fn get_photo(&self, property_id: Uuid, photo_id: Uuid) -> DomainResult<Option<PropertyPhoto>> {
        let row = sqlx::query(
            r#"
            SELECT id, property_id, storage_key, cdn_url, caption, is_cover, display_order, created_at
            FROM property_photos
            WHERE id = $1 AND property_id = $2
            "#,
        )
        .bind(photo_id)
        .bind(property_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get property photo: {}", e)))?;

        Ok(row.as_ref().map(map_photo_row))
    }

    async fn add_photo(&self, photo: PropertyPhoto) -> DomainResult<PropertyPhoto> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to start photo transaction: {}", e)))?;

        if photo.is_cover {
            sqlx::query("UPDATE property_photos SET is_cover = FALSE WHERE property_id = $1")
                .bind(photo.property_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| DomainError::Internal(format!("Failed to reset cover photo: {}", e)))?;
        }

        let row = sqlx::query(
            r#"
            INSERT INTO property_photos (id, property_id, storage_key, cdn_url, caption, is_cover, display_order, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, property_id, storage_key, cdn_url, caption, is_cover, display_order, created_at
            "#,
        )
        .bind(photo.id)
        .bind(photo.property_id)
        .bind(&photo.storage_key)
        .bind(&photo.cdn_url)
        .bind(&photo.caption)
        .bind(photo.is_cover)
        .bind(photo.display_order)
        .bind(photo.created_at)
        .fetch_one(&mut *tx)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to save property photo: {}", e)))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to commit property photo: {}", e)))?;

        let _: DateTime<Utc> = row.get("created_at");
        Ok(map_photo_row(&row))
    }

    async fn delete_photo(&self, property_id: Uuid, photo_id: Uuid) -> DomainResult<()> {
        let res = sqlx::query("DELETE FROM property_photos WHERE id = $1 AND property_id = $2")
            .bind(photo_id)
            .bind(property_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete property photo: {}", e)))?;

        if res.rows_affected() == 0 {
            return Err(DomainError::NotFound("Property photo not found".into()));
        }
        Ok(())
    }

    async fn set_cover_photo(&self, property_id: Uuid, photo_id: Uuid) -> DomainResult<PropertyPhoto> {
        let mut tx = self
            .pool
            .begin()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to start cover photo tx: {}", e)))?;

        sqlx::query("UPDATE property_photos SET is_cover = FALSE WHERE property_id = $1")
            .bind(property_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to clear cover flag: {}", e)))?;

        let row = sqlx::query(
            r#"
            UPDATE property_photos
            SET is_cover = TRUE
            WHERE id = $1 AND property_id = $2
            RETURNING id, property_id, storage_key, cdn_url, caption, is_cover, display_order, created_at
            "#,
        )
        .bind(photo_id)
        .bind(property_id)
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to set cover photo: {}", e)))?
        .ok_or_else(|| DomainError::NotFound("Property photo not found".into()))?;

        tx.commit()
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to commit cover photo: {}", e)))?;

        Ok(map_photo_row(&row))
    }
}

