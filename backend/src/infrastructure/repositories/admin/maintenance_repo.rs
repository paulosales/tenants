use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{MaintenanceCall, MaintenanceCallRepository, PropertyStaffRepository},
    errors::{DomainError, DomainResult},
};

fn map_maintenance_call_row(r: &PgRow) -> MaintenanceCall {
    MaintenanceCall {
        id: r.get("id"),
        ticket_number: r.get("ticket_number"),
        tenant_id: r.get("tenant_id"),
        tenant_name: r.get("tenant_name"),
        property_id: r.get("property_id"),
        property_name: r.get("property_name"),
        unit_number: r.get("unit_number"),
        category: r.get("category"),
        priority: r.get("priority"),
        title: r.get("title"),
        description: r.get("description"),
        permission_to_enter: r.get("permission_to_enter"),
        preferred_time_window: r.get("preferred_time_window"),
        contact_phone: r.get("contact_phone"),
        status: r.get("status"),
        assigned_staff_id: r.get("assigned_staff_id"),
        assigned_technician: r.get("assigned_technician"),
        technician_phone: r.get("technician_phone"),
        scheduled_date: r.get("scheduled_date"),
        resolution_notes: r.get("resolution_notes"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl MaintenanceCallRepository for PostgresAdminRepository {
    async fn list_maintenance_calls(
        &self,
        tenant_id: Option<Uuid>,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<MaintenanceCall>> {
        let mut q = "
            SELECT m.id, m.ticket_number, m.tenant_id, 
                   CONCAT(t.first_name, ' ', t.last_name) as tenant_name,
                   m.property_id, p.name as property_name, m.unit_number,
                   m.category, m.priority, m.title, m.description,
                   m.permission_to_enter, m.preferred_time_window, m.contact_phone,
                   m.status, m.assigned_staff_id, m.assigned_technician, m.technician_phone,
                   m.scheduled_date, m.resolution_notes, m.created_at, m.updated_at
            FROM maintenance_calls m
            LEFT JOIN tenants t ON t.id = m.tenant_id
            LEFT JOIN properties p ON p.id = m.property_id
            WHERE m.deleted_at IS NULL
        ".to_string();

        let mut param_index = 1;
        if tenant_id.is_some() {
            q.push_str(&format!(" AND m.tenant_id = ${}", param_index));
            param_index += 1;
        }
        if property_id.is_some() {
            q.push_str(&format!(" AND m.property_id = ${}", param_index));
            param_index += 1;
        }
        if status.is_some() {
            q.push_str(&format!(" AND m.status = ${}", param_index));
        }
        q.push_str(" ORDER BY m.created_at DESC");

        let mut query = sqlx::query(&q);
        if let Some(tid) = tenant_id {
            query = query.bind(tid);
        }
        if let Some(pid) = property_id {
            query = query.bind(pid);
        }
        if let Some(ref st) = status {
            query = query.bind(st);
        }

        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to list maintenance calls: {}", e)))?;

        Ok(rows.iter().map(map_maintenance_call_row).collect())
    }

    async fn get_maintenance_call(&self, id: Uuid) -> DomainResult<Option<MaintenanceCall>> {
        let row = sqlx::query(
            r#"
            SELECT m.id, m.ticket_number, m.tenant_id, 
                   CONCAT(t.first_name, ' ', t.last_name) as tenant_name,
                   m.property_id, p.name as property_name, m.unit_number,
                   m.category, m.priority, m.title, m.description,
                   m.permission_to_enter, m.preferred_time_window, m.contact_phone,
                   m.status, m.assigned_staff_id, m.assigned_technician, m.technician_phone,
                   m.scheduled_date, m.resolution_notes, m.created_at, m.updated_at
            FROM maintenance_calls m
            LEFT JOIN tenants t ON t.id = m.tenant_id
            LEFT JOIN properties p ON p.id = m.property_id
            WHERE m.id = $1 AND m.deleted_at IS NULL
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get maintenance call: {}", e)))?;

        Ok(row.as_ref().map(map_maintenance_call_row))
    }

    async fn create_maintenance_call(&self, call: MaintenanceCall) -> DomainResult<MaintenanceCall> {
        let row = sqlx::query(
            r#"
            INSERT INTO maintenance_calls (
                id, ticket_number, tenant_id, property_id, unit_number, category, priority,
                title, description, permission_to_enter, preferred_time_window, contact_phone,
                status, assigned_staff_id, assigned_technician, technician_phone, scheduled_date, resolution_notes,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
            RETURNING id, ticket_number, tenant_id, property_id, unit_number, category, priority,
                      title, description, permission_to_enter, preferred_time_window, contact_phone,
                      status, assigned_staff_id, assigned_technician, technician_phone, scheduled_date, resolution_notes,
                      created_at, updated_at
            "#
        )
        .bind(call.id)
        .bind(&call.ticket_number)
        .bind(call.tenant_id)
        .bind(call.property_id)
        .bind(&call.unit_number)
        .bind(&call.category)
        .bind(&call.priority)
        .bind(&call.title)
        .bind(&call.description)
        .bind(call.permission_to_enter)
        .bind(&call.preferred_time_window)
        .bind(&call.contact_phone)
        .bind(&call.status)
        .bind(call.assigned_staff_id)
        .bind(&call.assigned_technician)
        .bind(&call.technician_phone)
        .bind(call.scheduled_date)
        .bind(&call.resolution_notes)
        .bind(call.created_at)
        .bind(call.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to insert maintenance call: {}", e)))?;

        Ok(MaintenanceCall {
            id: row.get("id"),
            ticket_number: row.get("ticket_number"),
            tenant_id: row.get("tenant_id"),
            tenant_name: call.tenant_name,
            property_id: row.get("property_id"),
            property_name: call.property_name,
            unit_number: row.get("unit_number"),
            category: row.get("category"),
            priority: row.get("priority"),
            title: row.get("title"),
            description: row.get("description"),
            permission_to_enter: row.get("permission_to_enter"),
            preferred_time_window: row.get("preferred_time_window"),
            contact_phone: row.get("contact_phone"),
            status: row.get("status"),
            assigned_staff_id: row.get("assigned_staff_id"),
            assigned_technician: row.get("assigned_technician"),
            technician_phone: row.get("technician_phone"),
            scheduled_date: row.get("scheduled_date"),
            resolution_notes: row.get("resolution_notes"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
    }

    async fn update_maintenance_call_status(
        &self,
        id: Uuid,
        status: &str,
        resolution_notes: Option<String>,
    ) -> DomainResult<MaintenanceCall> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE maintenance_calls
            SET status = $2, resolution_notes = COALESCE($3, resolution_notes), updated_at = $4
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .bind(status)
        .bind(resolution_notes)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update maintenance call status: {}", e)))?;

        self.get_maintenance_call(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Maintenance call {} not found", id)))
    }

    async fn cancel_maintenance_call(&self, id: Uuid) -> DomainResult<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE maintenance_calls
            SET status = 'cancelled', updated_at = $2
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to cancel maintenance call: {}", e)))?;

        Ok(())
    }

    async fn assign_maintenance_call_staff(
        &self,
        call_id: Uuid,
        staff_id: Uuid,
        scheduled_date: Option<DateTime<Utc>>,
        resolution_notes: Option<String>,
    ) -> DomainResult<MaintenanceCall> {
        let staff = self.get_property_staff(staff_id).await?.ok_or_else(|| {
            DomainError::NotFound(format!("Staff member {} not found", staff_id))
        })?;

        let now = Utc::now();
        let staff_name = format!("{} {} ({})", staff.first_name, staff.last_name, staff.title);
        let scheduled = scheduled_date.unwrap_or_else(|| now + chrono::Duration::hours(24));

        sqlx::query(
            r#"
            UPDATE maintenance_calls
            SET assigned_staff_id = $2,
                assigned_technician = $3,
                technician_phone = $4,
                status = CASE WHEN status = 'reported' THEN 'dispatched' ELSE status END,
                scheduled_date = $5,
                resolution_notes = COALESCE($6, resolution_notes),
                updated_at = $7
            WHERE id = $1 AND deleted_at IS NULL
            "#
        )
        .bind(call_id)
        .bind(staff_id)
        .bind(staff_name)
        .bind(&staff.phone)
        .bind(scheduled)
        .bind(resolution_notes)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to assign staff to maintenance call: {}", e)))?;

        self.get_maintenance_call(call_id).await?.ok_or_else(|| {
            DomainError::NotFound(format!("Maintenance call {} not found", call_id))
        })
    }
}

