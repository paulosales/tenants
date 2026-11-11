use async_trait::async_trait;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{Tenant, TenantRepository, TenantStatus, TenantWithUnit},
    errors::{DomainError, DomainResult},
};

fn map_tenant_with_unit_row(r: &PgRow) -> TenantWithUnit {
    let status_val: String = r.get("status");
    TenantWithUnit {
        id: r.get("id"),
        first_name: r.get("first_name"),
        last_name: r.get("last_name"),
        email: r.get("email"),
        phone: r.get("phone"),
        emergency_contact_name: r.get("emergency_contact_name"),
        emergency_contact_phone: r.get("emergency_contact_phone"),
        assigned_unit_id: r.get("assigned_unit_id"),
        unit_number: r.get("unit_number"),
        property_id: r.get("property_id"),
        property_name: r.get("property_name"),
        lease_start_date: r.get("lease_start_date"),
        lease_end_date: r.get("lease_end_date"),
        status: TenantStatus::from_str(&status_val),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

fn map_tenant_row(r: &PgRow) -> Tenant {
    let status_val: String = r.get("status");
    Tenant {
        id: r.get("id"),
        first_name: r.get("first_name"),
        last_name: r.get("last_name"),
        email: r.get("email"),
        phone: r.get("phone"),
        emergency_contact_name: r.get("emergency_contact_name"),
        emergency_contact_phone: r.get("emergency_contact_phone"),
        assigned_unit_id: r.get("assigned_unit_id"),
        lease_start_date: r.get("lease_start_date"),
        lease_end_date: r.get("lease_end_date"),
        status: TenantStatus::from_str(&status_val),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl TenantRepository for PostgresAdminRepository {
    async fn list_tenants(
        &self,
        property_id: Option<Uuid>,
        status: Option<TenantStatus>,
        query: Option<String>,
    ) -> DomainResult<Vec<TenantWithUnit>> {
        let status_str = status.map(|s| s.as_str().to_string());
        let rows = sqlx::query(
            r#"
            SELECT 
                t.id, t.first_name, t.last_name, t.email, t.phone,
                t.emergency_contact_name, t.emergency_contact_phone,
                t.assigned_unit_id,
                u.unit_number,
                p.id as property_id,
                p.name as property_name,
                t.lease_start_date, t.lease_end_date, t.status,
                t.created_at, t.updated_at
            FROM tenants t
            LEFT JOIN units u ON u.id = t.assigned_unit_id AND u.deleted_at IS NULL
            LEFT JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
            WHERE t.deleted_at IS NULL
              AND ($1::uuid IS NULL OR p.id = $1)
              AND ($2::text IS NULL OR t.status = $2)
              AND ($3::text IS NULL OR (
                  t.first_name ILIKE '%' || $3 || '%' OR 
                  t.last_name ILIKE '%' || $3 || '%' OR 
                  t.email ILIKE '%' || $3 || '%' OR 
                  u.unit_number ILIKE '%' || $3 || '%'
              ))
            ORDER BY t.created_at DESC
            "#
        )
        .bind(property_id)
        .bind(status_str)
        .bind(query)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list tenants: {}", e)))?;

        Ok(rows.iter().map(map_tenant_with_unit_row).collect())
    }

    async fn get_tenant(&self, id: Uuid) -> DomainResult<Option<TenantWithUnit>> {
        let row = sqlx::query(
            r#"
            SELECT 
                t.id, t.first_name, t.last_name, t.email, t.phone,
                t.emergency_contact_name, t.emergency_contact_phone,
                t.assigned_unit_id,
                u.unit_number,
                p.id as property_id,
                p.name as property_name,
                t.lease_start_date, t.lease_end_date, t.status,
                t.created_at, t.updated_at
            FROM tenants t
            LEFT JOIN units u ON u.id = t.assigned_unit_id AND u.deleted_at IS NULL
            LEFT JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
            WHERE t.id = $1 AND t.deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get tenant: {}", e)))?;

        Ok(row.as_ref().map(map_tenant_with_unit_row))
    }

    async fn create_tenant(&self, tenant: Tenant) -> DomainResult<Tenant> {
        let row = sqlx::query(
            r#"
            INSERT INTO tenants (
                id, first_name, last_name, email, phone,
                emergency_contact_name, emergency_contact_phone,
                assigned_unit_id, lease_start_date, lease_end_date, status,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, assigned_unit_id, lease_start_date, lease_end_date, status, created_at, updated_at
            "#
        )
        .bind(tenant.id)
        .bind(&tenant.first_name)
        .bind(&tenant.last_name)
        .bind(&tenant.email)
        .bind(&tenant.phone)
        .bind(&tenant.emergency_contact_name)
        .bind(&tenant.emergency_contact_phone)
        .bind(tenant.assigned_unit_id)
        .bind(tenant.lease_start_date)
        .bind(tenant.lease_end_date)
        .bind(tenant.status.as_str())
        .bind(tenant.created_at)
        .bind(tenant.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.is_unique_violation() {
                    return DomainError::Conflict(format!("Tenant with email '{}' already exists", tenant.email));
                }
            }
            DomainError::Internal(format!("Failed to create tenant: {}", e))
        })?;

        Ok(map_tenant_row(&row))
    }

    async fn update_tenant(&self, tenant: Tenant) -> DomainResult<Tenant> {
        let row = sqlx::query(
            r#"
            UPDATE tenants
            SET first_name = $2, last_name = $3, email = $4, phone = $5,
                emergency_contact_name = $6, emergency_contact_phone = $7,
                assigned_unit_id = $8, lease_start_date = $9, lease_end_date = $10,
                status = $11, updated_at = $12
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, assigned_unit_id, lease_start_date, lease_end_date, status, created_at, updated_at
            "#
        )
        .bind(tenant.id)
        .bind(&tenant.first_name)
        .bind(&tenant.last_name)
        .bind(&tenant.email)
        .bind(&tenant.phone)
        .bind(&tenant.emergency_contact_name)
        .bind(&tenant.emergency_contact_phone)
        .bind(tenant.assigned_unit_id)
        .bind(tenant.lease_start_date)
        .bind(tenant.lease_end_date)
        .bind(tenant.status.as_str())
        .bind(tenant.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update tenant: {}", e)))?;

        Ok(map_tenant_row(&row))
    }

    async fn delete_tenant(&self, id: Uuid) -> DomainResult<()> {
        sqlx::query("UPDATE tenants SET deleted_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to delete tenant: {}", e)))?;
        Ok(())
    }
}

