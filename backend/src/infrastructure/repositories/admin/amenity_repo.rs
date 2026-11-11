use async_trait::async_trait;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{AdminAmenity, AdminAmenityRepository},
    errors::{DomainError, DomainResult},
};

fn map_amenity_row(r: &PgRow) -> AdminAmenity {
    AdminAmenity {
        id: r.get("id"),
        property_id: r.get("property_id"),
        name: r.get("name"),
        description: r.get("description"),
        capacity: r.get("capacity"),
        fee_cents: r.get("fee_cents"),
        deposit_cents: r.get("deposit_cents"),
        rules: r.get("rules"),
        is_active: r.get("is_active"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl AdminAmenityRepository for PostgresAdminRepository {
    async fn list_amenities_by_property(&self, property_id: Uuid) -> DomainResult<Vec<AdminAmenity>> {
        let rows = sqlx::query(
            r#"
            SELECT id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            FROM amenities
            WHERE property_id = $1 AND deleted_at IS NULL
            ORDER BY name ASC
            "#
        )
        .bind(property_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list amenities: {}", e)))?;

        Ok(rows.iter().map(map_amenity_row).collect())
    }

    async fn get_amenity(&self, id: Uuid) -> DomainResult<Option<AdminAmenity>> {
        let row = sqlx::query(
            r#"
            SELECT id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            FROM amenities
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get amenity: {}", e)))?;

        Ok(row.as_ref().map(map_amenity_row))
    }

    async fn create_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity> {
        let row = sqlx::query(
            r#"
            INSERT INTO amenities (id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            "#
        )
        .bind(amenity.id)
        .bind(amenity.property_id)
        .bind(&amenity.name)
        .bind(&amenity.description)
        .bind(amenity.capacity)
        .bind(amenity.fee_cents)
        .bind(amenity.deposit_cents)
        .bind(&amenity.rules)
        .bind(amenity.is_active)
        .bind(amenity.created_at)
        .bind(amenity.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create amenity: {}", e)))?;

        Ok(map_amenity_row(&row))
    }

    async fn update_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity> {
        let row = sqlx::query(
            r#"
            UPDATE amenities
            SET name = $2, description = $3, capacity = $4, fee_cents = $5, deposit_cents = $6, rules = $7, is_active = $8, updated_at = $9
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, property_id, name, description, capacity, fee_cents, deposit_cents, rules, is_active, created_at, updated_at
            "#
        )
        .bind(amenity.id)
        .bind(&amenity.name)
        .bind(&amenity.description)
        .bind(amenity.capacity)
        .bind(amenity.fee_cents)
        .bind(amenity.deposit_cents)
        .bind(&amenity.rules)
        .bind(amenity.is_active)
        .bind(amenity.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update amenity: {}", e)))?;

        Ok(map_amenity_row(&row))
    }

    async fn delete_amenity(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE amenities SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete amenity: {}", e)))?;
        Ok(())
    }
}

