use async_trait::async_trait;
use chrono::Utc;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{TenancyApplication, TenancyApplicationRepository},
    errors::{DomainError, DomainResult},
};

fn map_application_row(r: &PgRow) -> TenancyApplication {
    TenancyApplication {
        id: r.get("id"),
        property_id: r.get("property_id"),
        property_name: r.get("property_name"),
        preferred_unit_id: r.get("preferred_unit_id"),
        preferred_unit_number: r.get("preferred_unit_number"),
        applicant_first_name: r.get("applicant_first_name"),
        applicant_last_name: r.get("applicant_last_name"),
        applicant_email: r.get("applicant_email"),
        applicant_phone: r.get("applicant_phone"),
        monthly_income_cents: r.get("monthly_income_cents"),
        employment_status: r.get("employment_status"),
        desired_move_in_date: r.get("desired_move_in_date"),
        occupants_count: r.get("occupants_count"),
        notes: r.get("notes"),
        status: r.get("status"),
        reviewed_by_user_id: r.get("reviewed_by_user_id"),
        review_notes: r.get("review_notes"),
        reviewed_at: r.get("reviewed_at"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl TenancyApplicationRepository for PostgresAdminRepository {
    async fn list_applications(
        &self,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<TenancyApplication>> {
        let mut q = "
            SELECT a.id, a.property_id, p.name AS property_name,
                   a.preferred_unit_id, u.unit_number AS preferred_unit_number,
                   a.applicant_first_name, a.applicant_last_name,
                   a.applicant_email, a.applicant_phone,
                   a.monthly_income_cents, a.employment_status,
                   a.desired_move_in_date, a.occupants_count, a.notes,
                   a.status, a.reviewed_by_user_id, a.review_notes, a.reviewed_at,
                   a.created_at, a.updated_at
            FROM tenancy_applications a
            JOIN properties p ON p.id = a.property_id
            LEFT JOIN units u ON u.id = a.preferred_unit_id
            WHERE a.deleted_at IS NULL
        "
        .to_string();

        let mut param_index = 1;
        if property_id.is_some() {
            q.push_str(&format!(" AND a.property_id = ${}", param_index));
            param_index += 1;
        }
        if status.is_some() {
            q.push_str(&format!(" AND a.status = ${}", param_index));
        }
        q.push_str(" ORDER BY a.created_at DESC");

        let mut query = sqlx::query(&q);
        if let Some(pid) = property_id {
            query = query.bind(pid);
        }
        if let Some(ref st) = status {
            query = query.bind(st);
        }

        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to list tenancy applications: {}", e)))?;

        Ok(rows.iter().map(map_application_row).collect())
    }

    async fn get_application(&self, id: Uuid) -> DomainResult<Option<TenancyApplication>> {
        let row = sqlx::query(
            r#"
            SELECT a.id, a.property_id, p.name AS property_name,
                   a.preferred_unit_id, u.unit_number AS preferred_unit_number,
                   a.applicant_first_name, a.applicant_last_name,
                   a.applicant_email, a.applicant_phone,
                   a.monthly_income_cents, a.employment_status,
                   a.desired_move_in_date, a.occupants_count, a.notes,
                   a.status, a.reviewed_by_user_id, a.review_notes, a.reviewed_at,
                   a.created_at, a.updated_at
            FROM tenancy_applications a
            JOIN properties p ON p.id = a.property_id
            LEFT JOIN units u ON u.id = a.preferred_unit_id
            WHERE a.id = $1 AND a.deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch tenancy application: {}", e)))?;

        Ok(row.as_ref().map(map_application_row))
    }

    async fn create_application(&self, app: TenancyApplication) -> DomainResult<TenancyApplication> {
        sqlx::query(
            r#"
            INSERT INTO tenancy_applications (
                id, property_id, preferred_unit_id, applicant_first_name, applicant_last_name,
                applicant_email, applicant_phone, monthly_income_cents, employment_status,
                desired_move_in_date, occupants_count, notes, status, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            "#,
        )
        .bind(app.id)
        .bind(app.property_id)
        .bind(app.preferred_unit_id)
        .bind(&app.applicant_first_name)
        .bind(&app.applicant_last_name)
        .bind(&app.applicant_email)
        .bind(&app.applicant_phone)
        .bind(app.monthly_income_cents)
        .bind(&app.employment_status)
        .bind(app.desired_move_in_date)
        .bind(app.occupants_count)
        .bind(&app.notes)
        .bind(&app.status)
        .bind(app.created_at)
        .bind(app.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create tenancy application: {}", e)))?;

        self.get_application(app.id)
            .await?
            .ok_or_else(|| DomainError::Internal("Created application missing".into()))
    }

    async fn update_application_review(
        &self,
        id: Uuid,
        status: &str,
        reviewed_by_user_id: Uuid,
        review_notes: Option<String>,
    ) -> DomainResult<TenancyApplication> {
        let now = Utc::now();
        let row = sqlx::query(
            r#"
            UPDATE tenancy_applications
            SET status = $2,
                reviewed_by_user_id = $3,
                review_notes = COALESCE($4, review_notes),
                reviewed_at = $5,
                updated_at = $5
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(reviewed_by_user_id)
        .bind(review_notes)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update tenancy application: {}", e)))?
        .ok_or_else(|| DomainError::NotFound(format!("Tenancy application {} not found", id)))?;

        let updated_id: Uuid = row.get("id");
        self.get_application(updated_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Updated application missing".into()))
    }
}

