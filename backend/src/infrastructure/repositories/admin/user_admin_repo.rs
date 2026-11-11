use async_trait::async_trait;
use chrono::Utc;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{AdminUserRepository, ManagedUser},
    errors::{DomainError, DomainResult},
    user::Role,
};

fn map_managed_user_row(r: &PgRow) -> ManagedUser {
    ManagedUser {
        id: r.get("id"),
        email: r.get("email"),
        full_name: r.get("full_name"),
        role: r.get("role"),
        phone: r.get("phone"),
        unit_number: r.get("unit_number"),
        property_id: r.get("property_id"),
        property_name: r.get("property_name"),
        tenant_id: r.get("tenant_id"),
        staff_id: r.get("staff_id"),
        is_active: r.get("is_active"),
        created_at: r.get("created_at"),
        updated_at: r.get("updated_at"),
    }
}

#[async_trait]
impl AdminUserRepository for PostgresAdminRepository {
    async fn list_users(
        &self,
        role: Option<Role>,
        property_id: Option<Uuid>,
        search: Option<String>,
    ) -> DomainResult<Vec<ManagedUser>> {
        let mut q = "
            SELECT u.id, u.email, u.full_name, u.role, u.phone, u.unit_number,
                   u.property_id, p.name AS property_name,
                   u.tenant_id, u.staff_id, COALESCE(u.is_active, TRUE) AS is_active,
                   u.created_at, u.updated_at
            FROM users u
            LEFT JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
            WHERE u.deleted_at IS NULL
        "
        .to_string();

        let mut idx = 1;
        if role.is_some() {
            q.push_str(&format!(" AND u.role = ${}", idx));
            idx += 1;
        }
        if property_id.is_some() {
            q.push_str(&format!(" AND u.property_id = ${}", idx));
            idx += 1;
        }
        if search.is_some() {
            q.push_str(&format!(
                " AND (LOWER(u.full_name) LIKE LOWER(${}) OR LOWER(u.email) LIKE LOWER(${}))",
                idx, idx
            ));
        }
        q.push_str(" ORDER BY u.role ASC, u.full_name ASC");

        let mut query = sqlx::query(&q);
        if let Some(r) = role {
            query = query.bind(r);
        }
        if let Some(pid) = property_id {
            query = query.bind(pid);
        }
        if let Some(ref s) = search {
            let pattern = format!("%{}%", s.trim());
            query = query.bind(pattern);
        }

        let rows = query
            .fetch_all(&self.pool)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to list users: {}", e)))?;

        Ok(rows.iter().map(map_managed_user_row).collect())
    }

    async fn get_user(&self, id: Uuid) -> DomainResult<Option<ManagedUser>> {
        let row = sqlx::query(
            r#"
            SELECT u.id, u.email, u.full_name, u.role, u.phone, u.unit_number,
                   u.property_id, p.name AS property_name,
                   u.tenant_id, u.staff_id, COALESCE(u.is_active, TRUE) AS is_active,
                   u.created_at, u.updated_at
            FROM users u
            LEFT JOIN properties p ON p.id = u.property_id AND p.deleted_at IS NULL
            WHERE u.id = $1 AND u.deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch user: {}", e)))?;

        Ok(row.as_ref().map(map_managed_user_row))
    }

    async fn find_user_id_by_email(&self, email: &str) -> DomainResult<Option<Uuid>> {
        let row = sqlx::query(
            r#"
            SELECT id FROM users
            WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
            "#,
        )
        .bind(email.trim())
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to check duplicate email: {}", e)))?;

        Ok(row.map(|r| r.get("id")))
    }

    async fn create_user(
        &self,
        user: ManagedUser,
        password_hash: String,
    ) -> DomainResult<ManagedUser> {
        sqlx::query(
            r#"
            INSERT INTO users (
                id, email, password_hash, full_name, role, phone, unit_number,
                property_id, tenant_id, staff_id, is_active, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
        )
        .bind(user.id)
        .bind(&user.email)
        .bind(&password_hash)
        .bind(&user.full_name)
        .bind(user.role)
        .bind(&user.phone)
        .bind(&user.unit_number)
        .bind(user.property_id)
        .bind(user.tenant_id)
        .bind(user.staff_id)
        .bind(user.is_active)
        .bind(user.created_at)
        .bind(user.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create user: {}", e)))?;

        self.get_user(user.id)
            .await?
            .ok_or_else(|| DomainError::Internal("Created user missing".into()))
    }

    async fn update_user(
        &self,
        user: ManagedUser,
        new_password_hash: Option<String>,
        revoke_refresh: bool,
    ) -> DomainResult<ManagedUser> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE users
            SET email = $2,
                full_name = $3,
                role = $4,
                phone = $5,
                unit_number = $6,
                property_id = $7,
                tenant_id = $8,
                staff_id = $9,
                is_active = $10,
                password_hash = COALESCE($11, password_hash),
                refresh_token_hash = CASE WHEN $12 THEN NULL ELSE refresh_token_hash END,
                refresh_token_expires_at = CASE WHEN $12 THEN NULL ELSE refresh_token_expires_at END,
                updated_at = $13
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(user.id)
        .bind(&user.email)
        .bind(&user.full_name)
        .bind(user.role)
        .bind(&user.phone)
        .bind(&user.unit_number)
        .bind(user.property_id)
        .bind(user.tenant_id)
        .bind(user.staff_id)
        .bind(user.is_active)
        .bind(new_password_hash)
        .bind(revoke_refresh)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update user: {}", e)))?;

        self.get_user(user.id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("User {} not found", user.id)))
    }

    async fn delete_user(&self, id: Uuid) -> DomainResult<()> {
        let now = Utc::now();
        let res = sqlx::query(
            r#"
            UPDATE users
            SET deleted_at = $2,
                is_active = FALSE,
                refresh_token_hash = NULL,
                refresh_token_expires_at = NULL,
                updated_at = $2
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to delete user: {}", e)))?;

        if res.rows_affected() == 0 {
            return Err(DomainError::NotFound(format!("User {} not found", id)));
        }
        Ok(())
    }

    async fn count_active_super_admins(&self, exclude_user_id: Option<Uuid>) -> DomainResult<i64> {
        let row = sqlx::query(
            r#"
            SELECT COUNT(*) AS cnt
            FROM users
            WHERE deleted_at IS NULL
              AND COALESCE(is_active, TRUE) = TRUE
              AND role = 'super_admin'
              AND ($1::uuid IS NULL OR id <> $1)
            "#,
        )
        .bind(exclude_user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to count super admins: {}", e)))?;

        Ok(row.get("cnt"))
    }

    async fn count_users_by_role(&self) -> DomainResult<Vec<(Role, i64)>> {
        let rows = sqlx::query(
            r#"
            SELECT role, COUNT(*) AS cnt
            FROM users
            WHERE deleted_at IS NULL
            GROUP BY role
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to count users by role: {}", e)))?;

        Ok(rows
            .into_iter()
            .map(|r| (r.get::<Role, _>("role"), r.get::<i64, _>("cnt")))
            .collect())
    }
}
