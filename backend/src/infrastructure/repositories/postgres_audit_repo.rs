use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{
    audit::AuditLog,
    errors::{DomainError, DomainResult},
    repository::AuditRepository,
};

pub struct PostgresAuditRepository {
    pool: PgPool,
}

impl PostgresAuditRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct AuditLogRow {
    id: Uuid,
    actor_id: Option<Uuid>,
    actor_email: Option<String>,
    action: String,
    entity_type: String,
    entity_id: Option<Uuid>,
    old_values: Option<serde_json::Value>,
    new_values: Option<serde_json::Value>,
    ip_address: Option<String>,
    user_agent: Option<String>,
    created_at: DateTime<Utc>,
}

impl From<AuditLogRow> for AuditLog {
    fn from(r: AuditLogRow) -> Self {
        Self {
            id: r.id,
            actor_id: r.actor_id,
            actor_email: r.actor_email,
            action: r.action,
            entity_type: r.entity_type,
            entity_id: r.entity_id,
            old_values: r.old_values,
            new_values: r.new_values,
            ip_address: r.ip_address,
            user_agent: r.user_agent,
            created_at: r.created_at,
        }
    }
}

#[async_trait]
impl AuditRepository for PostgresAuditRepository {
    async fn record(&self, log: &AuditLog) -> DomainResult<()> {
        sqlx::query(
            r#"
            INSERT INTO audit_logs (
                id, actor_id, actor_email, action, entity_type,
                entity_id, old_values, new_values, ip_address, user_agent, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
        )
        .bind(log.id)
        .bind(log.actor_id)
        .bind(&log.actor_email)
        .bind(&log.action)
        .bind(&log.entity_type)
        .bind(log.entity_id)
        .bind(&log.old_values)
        .bind(&log.new_values)
        .bind(&log.ip_address)
        .bind(&log.user_agent)
        .bind(log.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to record audit log: {}", e)))?;

        Ok(())
    }

    async fn list_recent(&self, limit: i64) -> DomainResult<Vec<AuditLog>> {
        let rows = sqlx::query_as::<_, AuditLogRow>(
            r#"
            SELECT id, actor_id, actor_email, action, entity_type,
                   entity_id, old_values, new_values, ip_address, user_agent, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to query audit logs: {}", e)))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }
}
