use async_trait::async_trait;
use sqlx::{postgres::PgRow, Row};
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{StaffMessage, StaffMessageRepository},
    errors::{DomainError, DomainResult},
};

fn map_message_row(r: &PgRow) -> StaffMessage {
    StaffMessage {
        id: r.get("id"),
        property_id: r.get("property_id"),
        sender_user_id: r.get("sender_user_id"),
        sender_staff_id: r.get("sender_staff_id"),
        recipient_user_id: r.get("recipient_user_id"),
        recipient_staff_id: r.get("recipient_staff_id"),
        sender_name: r.get("sender_name"),
        sender_role: r.get("sender_role"),
        body: r.get("body"),
        is_read: r.get("is_read"),
        created_at: r.get("created_at"),
    }
}

#[async_trait]
impl StaffMessageRepository for PostgresAdminRepository {
    async fn list_messages(
        &self,
        property_id: Uuid,
        staff_id: Option<Uuid>,
    ) -> DomainResult<Vec<StaffMessage>> {
        let rows = if let Some(sid) = staff_id {
            sqlx::query(
                r#"
                SELECT id, property_id, sender_user_id, sender_staff_id, recipient_user_id,
                       recipient_staff_id, sender_name, sender_role, body, is_read, created_at
                FROM staff_messages
                WHERE property_id = $1
                  AND (sender_staff_id = $2 OR recipient_staff_id = $2 OR recipient_staff_id IS NULL)
                ORDER BY created_at ASC
                LIMIT 200
                "#,
            )
            .bind(property_id)
            .bind(sid)
            .fetch_all(&self.pool)
            .await
        } else {
            sqlx::query(
                r#"
                SELECT id, property_id, sender_user_id, sender_staff_id, recipient_user_id,
                       recipient_staff_id, sender_name, sender_role, body, is_read, created_at
                FROM staff_messages
                WHERE property_id = $1
                ORDER BY created_at ASC
                LIMIT 200
                "#,
            )
            .bind(property_id)
            .fetch_all(&self.pool)
            .await
        }
        .map_err(|e| DomainError::Internal(format!("Failed to list staff messages: {}", e)))?;

        Ok(rows.iter().map(map_message_row).collect())
    }

    async fn get_message(&self, id: Uuid) -> DomainResult<Option<StaffMessage>> {
        let row = sqlx::query(
            r#"
            SELECT id, property_id, sender_user_id, sender_staff_id, recipient_user_id,
                   recipient_staff_id, sender_name, sender_role, body, is_read, created_at
            FROM staff_messages
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to get staff message: {}", e)))?;

        Ok(row.as_ref().map(map_message_row))
    }

    async fn create_message(&self, msg: StaffMessage) -> DomainResult<StaffMessage> {
        let row = sqlx::query(
            r#"
            INSERT INTO staff_messages (
                id, property_id, sender_user_id, sender_staff_id, recipient_user_id,
                recipient_staff_id, sender_name, sender_role, body, is_read, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING id, property_id, sender_user_id, sender_staff_id, recipient_user_id,
                      recipient_staff_id, sender_name, sender_role, body, is_read, created_at
            "#,
        )
        .bind(msg.id)
        .bind(msg.property_id)
        .bind(msg.sender_user_id)
        .bind(msg.sender_staff_id)
        .bind(msg.recipient_user_id)
        .bind(msg.recipient_staff_id)
        .bind(&msg.sender_name)
        .bind(&msg.sender_role)
        .bind(&msg.body)
        .bind(msg.is_read)
        .bind(msg.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to create staff message: {}", e)))?;

        Ok(map_message_row(&row))
    }

    async fn mark_message_read(&self, id: Uuid) -> DomainResult<StaffMessage> {
        let row = sqlx::query(
            r#"
            UPDATE staff_messages
            SET is_read = TRUE
            WHERE id = $1
            RETURNING id, property_id, sender_user_id, sender_staff_id, recipient_user_id,
                      recipient_staff_id, sender_name, sender_role, body, is_read, created_at
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to mark message read: {}", e)))?
        .ok_or_else(|| DomainError::NotFound(format!("Staff message {} not found", id)))?;

        Ok(map_message_row(&row))
    }
}

