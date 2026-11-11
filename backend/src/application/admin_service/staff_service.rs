use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::{CreatePropertyStaffRequest, UpdatePropertyStaffRequest};
use crate::domain::{
    admin::{PropertyStaff, PropertyStaffRepository},
    errors::{DomainError, DomainResult},
};

const ALLOWED_STAFF_ROLES: [&str; 5] = ["manager", "maintainer", "security", "cleaner", "other"];

pub struct PropertyStaffService {
    repo: Arc<dyn PropertyStaffRepository>,
}

impl PropertyStaffService {
    pub fn new(repo: Arc<dyn PropertyStaffRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_property_staff(
        &self,
        property_id: Option<Uuid>,
        role: Option<String>,
    ) -> DomainResult<Vec<PropertyStaff>> {
        self.repo.list_property_staff(property_id, role).await
    }

    pub async fn get_property_staff(&self, id: Uuid) -> DomainResult<PropertyStaff> {
        self.repo
            .get_property_staff(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Staff member {} not found", id)))
    }

    pub async fn create_property_staff(
        &self,
        req: CreatePropertyStaffRequest,
    ) -> DomainResult<PropertyStaff> {
        if req.first_name.trim().is_empty() || req.last_name.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "Staff first and last name are required".to_string(),
            ));
        }
        if req.email.trim().is_empty() || !req.email.contains('@') {
            return Err(DomainError::ValidationError(
                "Valid email address is required".to_string(),
            ));
        }
        if req.phone.trim().is_empty() {
            return Err(DomainError::ValidationError("Phone number is required".to_string()));
        }

        let role = req.role.to_lowercase();
        if !ALLOWED_STAFF_ROLES.contains(&role.as_str()) {
            return Err(DomainError::ValidationError(format!(
                "Invalid role '{}'. Allowed roles: manager, maintainer, security, cleaner, other",
                req.role
            )));
        }

        let now = Utc::now();
        let staff = PropertyStaff {
            id: Uuid::new_v4(),
            property_id: req.property_id,
            property_name: None,
            first_name: req.first_name.trim().to_string(),
            last_name: req.last_name.trim().to_string(),
            role,
            title: req.title.trim().to_string(),
            email: req.email.trim().to_string(),
            phone: req.phone.trim().to_string(),
            specialization: req.specialization.map(|s| s.trim().to_string()),
            shift: req.shift.unwrap_or_else(|| "Day (08:00 - 17:00)".to_string()),
            status: req.status.unwrap_or_else(|| "active".to_string()),
            assigned_calls_count: 0,
            created_at: now,
            updated_at: now,
        };

        self.repo.create_property_staff(staff).await
    }

    pub async fn update_property_staff(
        &self,
        id: Uuid,
        req: UpdatePropertyStaffRequest,
    ) -> DomainResult<PropertyStaff> {
        let existing = self.get_property_staff(id).await?;

        let role = req.role.unwrap_or(existing.role).to_lowercase();
        if !ALLOWED_STAFF_ROLES.contains(&role.as_str()) {
            return Err(DomainError::ValidationError(format!(
                "Invalid role '{}'. Allowed roles: manager, maintainer, security, cleaner, other",
                role
            )));
        }

        let staff = PropertyStaff {
            id,
            property_id: req.property_id.unwrap_or(existing.property_id),
            property_name: None,
            first_name: req.first_name.unwrap_or(existing.first_name),
            last_name: req.last_name.unwrap_or(existing.last_name),
            role,
            title: req.title.unwrap_or(existing.title),
            email: req.email.unwrap_or(existing.email),
            phone: req.phone.unwrap_or(existing.phone),
            specialization: req.specialization.or(existing.specialization),
            shift: req.shift.unwrap_or(existing.shift),
            status: req.status.unwrap_or(existing.status),
            assigned_calls_count: existing.assigned_calls_count,
            created_at: existing.created_at,
            updated_at: Utc::now(),
        };

        self.repo.update_property_staff(staff).await
    }

    pub async fn delete_property_staff(&self, id: Uuid) -> DomainResult<()> {
        self.repo.delete_property_staff(id).await
    }
}

