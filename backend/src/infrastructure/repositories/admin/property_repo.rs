use async_trait::async_trait;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{Property, PropertyRepository, PropertyWithStats},
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
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl PropertyRepository for PostgresAdminRepository {
    async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                p.id, p.name, p.address_line1, p.address_line2, p.city, p.state_province, p.postal_code,
                COALESCE(COUNT(DISTINCT u.id), 0)::int8 as unit_count,
                COALESCE(COUNT(DISTINCT CASE WHEN u.status = 'occupied' THEN u.id END), 0)::int8 as occupied_units_count,
                COALESCE(COUNT(DISTINCT t.id), 0)::int8 as tenant_count,
                p.created_at, p.updated_at
            FROM properties p
            LEFT JOIN units u ON u.property_id = p.id AND u.deleted_at IS NULL
            LEFT JOIN tenants t ON t.assigned_unit_id = u.id AND t.deleted_at IS NULL AND t.status = 'active'
            WHERE p.deleted_at IS NULL
            GROUP BY p.id
            ORDER BY p.name ASC
            "#
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
            SELECT id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at
            FROM properties
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get property: {}", e)))?;

        Ok(row.as_ref().map(map_property_row))
    }

    async fn create_property(&self, property: Property) -> DomainResult<Property> {
        let row = sqlx::query(
            r#"
            INSERT INTO properties (id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at
            "#
        )
        .bind(property.id)
        .bind(&property.name)
        .bind(&property.address_line1)
        .bind(&property.address_line2)
        .bind(&property.city)
        .bind(&property.state_province)
        .bind(&property.postal_code)
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
            SET name = $2, address_line1 = $3, address_line2 = $4, city = $5, state_province = $6, postal_code = $7, updated_at = $8
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, name, address_line1, address_line2, city, state_province, postal_code, created_at, updated_at
            "#
        )
        .bind(property.id)
        .bind(&property.name)
        .bind(&property.address_line1)
        .bind(&property.address_line2)
        .bind(&property.city)
        .bind(&property.state_province)
        .bind(&property.postal_code)
        .bind(property.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update property: {}", e)))?;

        Ok(map_property_row(&row))
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

