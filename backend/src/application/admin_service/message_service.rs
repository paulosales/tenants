use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::CreateStaffMessageRequest;
use crate::domain::{
    admin::{PropertyRepository, StaffMessage, StaffMessageRepository},
    errors::{DomainError, DomainResult},
    user::User,
};

pub struct StaffMessagingService {
    message_repo: Arc<dyn StaffMessageRepository>,
    property_repo: Arc<dyn PropertyRepository>,
}

impl StaffMessagingService {
    pub fn new(
        message_repo: Arc<dyn StaffMessageRepository>,
        property_repo: Arc<dyn PropertyRepository>,
    ) -> Self {
        Self {
            message_repo,
            property_repo,
        }
    }

    pub async fn list_messages(
        &self,
        property_id: Uuid,
        staff_id: Option<Uuid>,
    ) -> DomainResult<Vec<StaffMessage>> {
        self.message_repo.list_messages(property_id, staff_id).await
    }

    pub async fn send_message(
        &self,
        sender: &User,
        req: CreateStaffMessageRequest,
    ) -> DomainResult<StaffMessage> {
        let body = req.body.trim().to_string();
        if body.is_empty() || body.len() > 2000 {
            return Err(DomainError::ValidationError(
                "Message body must be between 1 and 2000 characters".into(),
            ));
        }

        self.property_repo
            .get_property(req.property_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Property not found".into()))?;

        let sender_role_str = serde_json::to_value(sender.role)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| "staff".to_string());

        let msg = StaffMessage {
            id: Uuid::new_v4(),
            property_id: req.property_id,
            sender_user_id: sender.id,
            sender_staff_id: sender.staff_id,
            recipient_user_id: req.recipient_user_id,
            recipient_staff_id: req.recipient_staff_id,
            sender_name: sender.full_name.clone(),
            sender_role: sender_role_str,
            body,
            is_read: false,
            created_at: Utc::now(),
        };

        self.message_repo.create_message(msg).await
    }

    pub async fn mark_read(&self, id: Uuid) -> DomainResult<StaffMessage> {
        self.message_repo.mark_message_read(id).await
    }
}

