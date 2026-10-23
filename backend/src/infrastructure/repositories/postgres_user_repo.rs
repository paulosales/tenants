use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{
    errors::{DomainError, DomainResult},
    repository::UserRepository,
    user::{Role, User},
};

pub struct PostgresUserRepository {
    pool: PgPool,
}

impl PostgresUserRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct UserRow {
    id: Uuid,
    email: String,
    password_hash: String,
    full_name: String,
    role: Role,
    phone: Option<String>,
    unit_number: Option<String>,
    refresh_token_hash: Option<String>,
    refresh_token_expires_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

impl From<UserRow> for User {
    fn from(r: UserRow) -> Self {
        User {
            id: r.id,
            email: r.email,
            password_hash: r.password_hash,
            full_name: r.full_name,
            role: r.role,
            phone: r.phone,
            unit_number: r.unit_number,
            refresh_token_hash: r.refresh_token_hash,
            refresh_token_expires_at: r.refresh_token_expires_at,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
        }
    }
}

#[async_trait]
impl UserRepository for PostgresUserRepository {
    async fn find_by_id(&self, id: Uuid) -> DomainResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, email, password_hash, full_name, role, phone, unit_number,
                   refresh_token_hash, refresh_token_expires_at, created_at, updated_at, deleted_at
            FROM users
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Database error in find_by_id: {}", e)))?;

        Ok(row.map(Into::into))
    }

    async fn find_by_email(&self, email: &str) -> DomainResult<Option<User>> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            SELECT id, email, password_hash, full_name, role, phone, unit_number,
                   refresh_token_hash, refresh_token_expires_at, created_at, updated_at, deleted_at
            FROM users
            WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL
            "#,
        )
        .bind(email)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Database error in find_by_email: {}", e)))?;

        Ok(row.map(Into::into))
    }

    async fn create(&self, user: &User) -> DomainResult<User> {
        let row = sqlx::query_as::<_, UserRow>(
            r#"
            INSERT INTO users (id, email, password_hash, full_name, role, phone, unit_number,
                               refresh_token_hash, refresh_token_expires_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, email, password_hash, full_name, role, phone, unit_number,
                      refresh_token_hash, refresh_token_expires_at, created_at, updated_at, deleted_at
            "#,
        )
        .bind(user.id)
        .bind(&user.email)
        .bind(&user.password_hash)
        .bind(&user.full_name)
        .bind(user.role)
        .bind(&user.phone)
        .bind(&user.unit_number)
        .bind(&user.refresh_token_hash)
        .bind(user.refresh_token_expires_at)
        .bind(user.created_at)
        .bind(user.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Database error creating user: {}", e)))?;

        Ok(row.into())
    }

    async fn update_refresh_token(
        &self,
        user_id: Uuid,
        token_hash: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> DomainResult<()> {
        sqlx::query(
            r#"
            UPDATE users
            SET refresh_token_hash = $1, refresh_token_expires_at = $2, updated_at = NOW()
            WHERE id = $3 AND deleted_at IS NULL
            "#,
        )
        .bind(token_hash)
        .bind(expires_at)
        .bind(user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Database error updating refresh token: {}", e)))?;

        Ok(())
    }
}
