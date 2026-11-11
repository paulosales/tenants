use async_trait::async_trait;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{Unit, UnitRepository, UnitStatus, UnitTenantSummary, UnitWithTenant},
    errors::{DomainError, DomainResult},
};

fn map_unit_row(r: &PgRow) -> Unit {
    let status_str: String = r.get("status");
    Unit {
        id: r.get("id"),
        property_id: r.get("property_id"),
        unit_number: r.get("unit_number"),
        floor: r.get("floor"),
        bedrooms: r.get("bedrooms"),
        bathrooms: r.get("bathrooms"),
        square_feet: r.get("square_feet"),
        monthly_rent_cents: r.get("monthly_rent_cents"),
        status: UnitStatus::from_str(&status_str),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl UnitRepository for PostgresAdminRepository {
    async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>> {
        let rows = sqlx::query(
            r#"
            SELECT 
                u.id, u.property_id, u.unit_number, u.floor, u.bedrooms, u.bathrooms::float8 as bathrooms,
                u.square_feet, u.monthly_rent_cents, u.status,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'id', t.id,
                            'name', t.first_name || ' ' || t.last_name,
                            'email', t.email,
                            'phone', t.phone
                        )
                        ORDER BY t.first_name ASC, t.last_name ASC
                    ) FILTER (WHERE t.id IS NOT NULL),
                    '[]'::json
                ) as tenants_json,
                u.created_at, u.updated_at
            FROM units u
            LEFT JOIN tenants t ON t.assigned_unit_id = u.id AND t.deleted_at IS NULL AND t.status = 'active'
            WHERE u.property_id = $1 AND u.deleted_at IS NULL
            GROUP BY u.id
            ORDER BY u.unit_number ASC
            "#
        )
        .bind(property_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list units: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let status_str: String = r.get("status");
                let tenants_val: serde_json::Value = r.get("tenants_json");
                let tenants: Vec<UnitTenantSummary> = serde_json::from_value(tenants_val).unwrap_or_default();
                let tenant_id = tenants.first().map(|t| t.id);
                let tenant_email = tenants.first().map(|t| t.email.clone());
                let tenant_name = if tenants.is_empty() {
                    None
                } else {
                    Some(tenants.iter().map(|t| t.name.as_str()).collect::<Vec<_>>().join(", "))
                };

                UnitWithTenant {
                    id: r.get("id"),
                    property_id: r.get("property_id"),
                    unit_number: r.get("unit_number"),
                    floor: r.get("floor"),
                    bedrooms: r.get("bedrooms"),
                    bathrooms: r.get("bathrooms"),
                    square_feet: r.get("square_feet"),
                    monthly_rent_cents: r.get("monthly_rent_cents"),
                    status: UnitStatus::from_str(&status_str),
                    tenant_id,
                    tenant_name,
                    tenant_email,
                    tenants,
                    created_at: r.get("created_at"),
                    updated_at: r.get("updated_at"),
                }
            })
            .collect())
    }

    async fn get_unit(&self, id: Uuid) -> DomainResult<Option<Unit>> {
        let row = sqlx::query(
            r#"
            SELECT id, property_id, unit_number, floor, bedrooms, bathrooms::float8 as bathrooms,
                   square_feet, monthly_rent_cents, status, created_at, updated_at
            FROM units
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get unit: {}", e)))?;

        Ok(row.as_ref().map(map_unit_row))
    }

    async fn create_unit(&self, unit: Unit) -> DomainResult<Unit> {
        let row = sqlx::query(
            r#"
            INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, monthly_rent_cents, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, property_id, unit_number, floor, bedrooms, bathrooms::float8 as bathrooms, square_feet, monthly_rent_cents, status, created_at, updated_at
            "#
        )
        .bind(unit.id)
        .bind(unit.property_id)
        .bind(&unit.unit_number)
        .bind(unit.floor)
        .bind(unit.bedrooms)
        .bind(unit.bathrooms)
        .bind(unit.square_feet)
        .bind(unit.monthly_rent_cents)
        .bind(unit.status.as_str())
        .bind(unit.created_at)
        .bind(unit.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return DomainError::Conflict(format!(
                        "Unit '{}' already exists in this property",
                        unit.unit_number
                    ));
                }
            }
            DomainError::Internal(format!("Failed to create unit: {}", e))
        })?;

        Ok(map_unit_row(&row))
    }

    async fn update_unit(&self, unit: Unit) -> DomainResult<Unit> {
        let row = sqlx::query(
            r#"
            UPDATE units
            SET unit_number = $2, floor = $3, bedrooms = $4, bathrooms = $5, square_feet = $6, monthly_rent_cents = $7, status = $8, updated_at = $9
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, property_id, unit_number, floor, bedrooms, bathrooms::float8 as bathrooms, square_feet, monthly_rent_cents, status, created_at, updated_at
            "#
        )
        .bind(unit.id)
        .bind(&unit.unit_number)
        .bind(unit.floor)
        .bind(unit.bedrooms)
        .bind(unit.bathrooms)
        .bind(unit.square_feet)
        .bind(unit.monthly_rent_cents)
        .bind(unit.status.as_str())
        .bind(unit.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update unit: {}", e)))?;

        Ok(map_unit_row(&row))
    }

    async fn delete_unit(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE tenants SET assigned_unit_id = NULL, updated_at = NOW() WHERE assigned_unit_id = $1 AND deleted_at IS NULL")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to unassign tenants on unit deletion: {}", e)))?;

        sqlx::query("UPDATE units SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete unit: {}", e)))?;
        Ok(())
    }

    async fn set_unit_status(&self, unit_id: Uuid, status: UnitStatus) -> DomainResult<()> {
        sqlx::query("UPDATE units SET status = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL")
            .bind(unit_id)
            .bind(status.as_str())
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to update unit status: {}", e)))?;
        Ok(())
    }

    async fn sync_unit_tenants(&self, unit_id: Uuid, tenant_ids: &[Uuid]) -> DomainResult<()> {
        if tenant_ids.is_empty() {
            sqlx::query(
                "UPDATE tenants SET assigned_unit_id = NULL, updated_at = NOW() WHERE assigned_unit_id = $1 AND deleted_at IS NULL"
            )
            .bind(unit_id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to unassign tenants: {}", e)))?;
        } else {
            sqlx::query(
                "UPDATE tenants SET assigned_unit_id = NULL, updated_at = NOW() WHERE assigned_unit_id = $1 AND NOT (id = ANY($2)) AND deleted_at IS NULL"
            )
            .bind(unit_id)
            .bind(tenant_ids)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to unassign removed tenants: {}", e)))?;

            sqlx::query(
                "UPDATE tenants SET assigned_unit_id = $1, updated_at = NOW() WHERE id = ANY($2) AND deleted_at IS NULL"
            )
            .bind(unit_id)
            .bind(tenant_ids)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to assign tenants to unit: {}", e)))?;
        }
        Ok(())
    }

    async fn count_active_tenants_for_unit(&self, unit_id: Uuid, exclude_tenant_id: Option<Uuid>) -> DomainResult<i64> {
        let row = sqlx::query(
            "SELECT COUNT(*)::int8 as count FROM tenants WHERE assigned_unit_id = $1 AND ($2::uuid IS NULL OR id != $2) AND deleted_at IS NULL AND status = 'active'"
        )
        .bind(unit_id)
        .bind(exclude_tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to count active tenants: {}", e)))?;

        Ok(row.get("count"))
    }
}

