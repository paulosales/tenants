use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::CreateStaffMessageRequest;
use crate::domain::{
    admin::{PropertyRepository, PropertyStaffRepository, StaffMessage, StaffMessageRepository},
    errors::{DomainError, DomainResult},
    user::User,
};

pub struct StaffMessagingService {
    message_repo: Arc<dyn StaffMessageRepository>,
    property_repo: Arc<dyn PropertyRepository>,
    staff_repo: Arc<dyn PropertyStaffRepository>,
}

impl StaffMessagingService {
    pub fn new(
        message_repo: Arc<dyn StaffMessageRepository>,
        property_repo: Arc<dyn PropertyRepository>,
        staff_repo: Arc<dyn PropertyStaffRepository>,
    ) -> Self {
        Self {
            message_repo,
            property_repo,
            staff_repo,
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
        if !sender.has_property_access(req.property_id) {
            return Err(DomainError::Forbidden);
        }

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

        if let Some(recipient_staff_id) = req.recipient_staff_id {
            let staff = self
                .staff_repo
                .get_property_staff(recipient_staff_id)
                .await?
                .ok_or_else(|| DomainError::NotFound("Recipient staff member not found".into()))?;
            if staff.property_id != req.property_id {
                return Err(DomainError::ValidationError(
                    "Recipient staff member belongs to a different property".into(),
                ));
            }
        }

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

    pub async fn mark_read(&self, actor: &User, id: Uuid) -> DomainResult<StaffMessage> {
        let msg = self
            .message_repo
            .get_message(id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Staff message not found".into()))?;

        if !actor.has_property_access(msg.property_id) {
            return Err(DomainError::Forbidden);
        }

        if !actor.role.can_manage_properties() {
            let is_direct_user_recipient = msg.recipient_user_id == Some(actor.id);
            let is_direct_staff_recipient =
                msg.recipient_staff_id.is_some() && msg.recipient_staff_id == actor.staff_id;
            let is_broadcast =
                msg.recipient_user_id.is_none() && msg.recipient_staff_id.is_none();

            if !is_direct_user_recipient && !is_direct_staff_recipient && !is_broadcast {
                return Err(DomainError::Forbidden);
            }
        }

        self.message_repo.mark_message_read(id).await
    }
}

