use async_trait::async_trait;
use chrono::Utc;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{PropertyStaff, PropertyStaffRepository},
    errors::{DomainError, DomainResult},
};

fn map_property_staff_row(r: &PgRow) -> PropertyStaff {
    PropertyStaff {
        id: r.get("id"),
        property_id: r.get("property_id"),
        property_name: r.get("property_name"),
        first_name: r.get("first_name"),
        last_name: r.get("last_name"),
        role: r.get("role"),
        title: r.get("title"),
        email: r.get("email"),
        phone: r.get("phone"),
        specialization: r.get("specialization"),
        shift: r.get("shift"),
        status: r.get("status"),
        assigned_calls_count: r.get("assigned_calls_count"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl PropertyStaffRepository for PostgresAdminRepository {
    async fn list_property_staff(
        &self,
        property_id: Option<Uuid>,
        role: Option<String>,
    ) -> DomainResult<Vec<PropertyStaff>> {
        let mut q = "
            SELECT s.id, s.property_id, p.name as property_name,
                   s.first_name, s.last_name, s.role, s.title,
                   s.email, s.phone, s.specialization, s.shift, s.status,
                   COALESCE(mc.active_count, 0) as assigned_calls_count,
                   s.created_at, s.updated_at
            FROM property_staff s
            JOIN properties p ON p.id = s.property_id
            LEFT JOIN (
                SELECT assigned_staff_id, COUNT(*) as active_count
                FROM maintenance_calls
                WHERE deleted_at IS NULL AND status IN ('reported', 'dispatched', 'in_progress')
                GROUP BY assigned_staff_id
            ) mc ON mc.assigned_staff_id = s.id
            WHERE s.deleted_at IS NULL
        "
        .to_string();

        let mut param_index = 1;
        if property_id.is_some() {
            q.push_str(&format!(" AND s.property_id = ${}", param_index));
            param_index += 1;
        }
        if role.is_some() {
            q.push_str(&format!(" AND s.role = ${}", param_index));
        }
        q.push_str(" ORDER BY s.role ASC, s.last_name ASC, s.first_name ASC");

        let mut query = sqlx::query(&q);
        if let Some(pid) = property_id {
            query = query.bind(pid);
        }
        if let Some(ref r) = role {
            query = query.bind(r);
        }

        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to list property staff: {}", e)))?;

        Ok(rows.iter().map(map_property_staff_row).collect())
    }

    async fn get_property_staff(&self, id: Uuid) -> DomainResult<Option<PropertyStaff>> {
        let row = sqlx::query(
            r#"
            SELECT s.id, s.property_id, p.name as property_name,
                   s.first_name, s.last_name, s.role, s.title,
                   s.email, s.phone, s.specialization, s.shift, s.status,
                   COALESCE(mc.active_count, 0) as assigned_calls_count,
                   s.created_at, s.updated_at
            FROM property_staff s
            JOIN properties p ON p.id = s.property_id
            LEFT JOIN (
                SELECT assigned_staff_id, COUNT(*) as active_count
                FROM maintenance_calls
                WHERE deleted_at IS NULL AND status IN ('reported', 'dispatched', 'in_progress')
                GROUP BY assigned_staff_id
            ) mc ON mc.assigned_staff_id = s.id
            WHERE s.id = $1 AND s.deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get property staff: {}", e)))?;

        Ok(row.as_ref().map(map_property_staff_row))
    }

    async fn create_property_staff(&self, staff: PropertyStaff) -> DomainResult<PropertyStaff> {
        let row = sqlx::query(
            r#"
            INSERT INTO property_staff (
                id, property_id, first_name, last_name, role, title, email, phone,
                specialization, shift, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id
            "#,
        )
        .bind(staff.id)
        .bind(staff.property_id)
        .bind(&staff.first_name)
        .bind(&staff.last_name)
        .bind(&staff.role)
        .bind(&staff.title)
        .bind(&staff.email)
        .bind(&staff.phone)
        .bind(&staff.specialization)
        .bind(&staff.shift)
        .bind(&staff.status)
        .bind(staff.created_at)
        .bind(staff.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to insert property staff: {}", e)))?;

        self.get_property_staff(row.get("id"))
            .await?
            .ok_or_else(|| DomainError::Internal("Created staff member not found".to_string()))
    }

    async fn update_property_staff(&self, staff: PropertyStaff) -> DomainResult<PropertyStaff> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE property_staff
            SET property_id = $2, first_name = $3, last_name = $4, role = $5,
                title = $6, email = $7, phone = $8, specialization = $9,
                shift = $10, status = $11, updated_at = $12
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(staff.id)
        .bind(staff.property_id)
        .bind(&staff.first_name)
        .bind(&staff.last_name)
        .bind(&staff.role)
        .bind(&staff.title)
        .bind(&staff.email)
        .bind(&staff.phone)
        .bind(&staff.specialization)
        .bind(&staff.shift)
        .bind(&staff.status)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update property staff: {}", e)))?;

        self.get_property_staff(staff.id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Staff member {} not found", staff.id)))
    }

    async fn delete_property_staff(&self, id: Uuid) -> DomainResult<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE property_staff
            SET deleted_at = $2, updated_at = $2
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to delete property staff: {}", e)))?;

        Ok(())
    }
}
