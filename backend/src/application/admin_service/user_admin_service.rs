use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use super::dtos::{CreateAdminUserRequest, UpdateAdminUserRequest};
use crate::domain::{
    admin::{AdminUserRepository, ManagedUser, PropertyRepository, RoleDefinition},
    errors::{DomainError, DomainResult},
    ports::PasswordHasher,
    user::Role,
};

pub struct AdminUserService {
    user_repo: Arc<dyn AdminUserRepository>,
    property_repo: Arc<dyn PropertyRepository>,
    password_hasher: Arc<dyn PasswordHasher>,
}

impl AdminUserService {
    pub fn new(
        user_repo: Arc<dyn AdminUserRepository>,
        property_repo: Arc<dyn PropertyRepository>,
        password_hasher: Arc<dyn PasswordHasher>,
    ) -> Self {
        Self {
            user_repo,
            property_repo,
            password_hasher,
        }
    }

    async fn validate_property_if_present(&self, property_id: Option<Uuid>) -> DomainResult<()> {
        if let Some(pid) = property_id {
            self.property_repo
                .get_property(pid)
                .await?
                .ok_or_else(|| DomainError::NotFound(format!("Property {} not found", pid)))?;
        }
        Ok(())
    }

    pub async fn list_users(
        &self,
        role: Option<Role>,
        property_id: Option<Uuid>,
        search: Option<String>,
    ) -> DomainResult<Vec<ManagedUser>> {
        let clean_search = search
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        self.user_repo
            .list_users(role, property_id, clean_search)
            .await
    }

    pub async fn get_user(&self, id: Uuid) -> DomainResult<ManagedUser> {
        self.user_repo
            .get_user(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("User {} not found", id)))
    }

    pub async fn create_user(&self, req: CreateAdminUserRequest) -> DomainResult<ManagedUser> {
        let email = req.email.trim().to_lowercase();
        let full_name = req.full_name.trim().to_string();

        if full_name.len() < 2 || full_name.len() > 150 {
            return Err(DomainError::ValidationError(
                "Full name must be between 2 and 150 characters".into(),
            ));
        }
        if !email.contains('@') || email.len() < 5 || email.len() > 255 {
            return Err(DomainError::ValidationError(
                "A valid email address is required".into(),
            ));
        }
        if self
            .user_repo
            .find_user_id_by_email(&email)
            .await?
            .is_some()
        {
            return Err(DomainError::Conflict(
                "A user account with this email already exists".into(),
            ));
        }

        self.validate_property_if_present(req.property_id).await?;
        let password_hash = self.password_hasher.hash(&req.password)?;
        let now = Utc::now();

        let new_user = ManagedUser {
            id: Uuid::new_v4(),
            email,
            full_name,
            role: req.role,
            phone: req
                .phone
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            unit_number: req
                .unit_number
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty()),
            property_id: req.property_id,
            property_name: None,
            tenant_id: req.tenant_id,
            staff_id: req.staff_id,
            is_active: req.is_active.unwrap_or(true),
            created_at: now,
            updated_at: now,
        };

        self.user_repo.create_user(new_user, password_hash).await
    }

    pub async fn update_user(
        &self,
        actor_user_id: Uuid,
        id: Uuid,
        req: UpdateAdminUserRequest,
    ) -> DomainResult<ManagedUser> {
        let existing = self.get_user(id).await?;

        let email = match req.email {
            Some(e) => {
                let normalized = e.trim().to_lowercase();
                if !normalized.contains('@') || normalized.len() < 5 {
                    return Err(DomainError::ValidationError(
                        "A valid email address is required".into(),
                    ));
                }
                if !normalized.eq_ignore_ascii_case(&existing.email) {
                    if let Some(other_id) =
                        self.user_repo.find_user_id_by_email(&normalized).await?
                    {
                        if other_id != id {
                            return Err(DomainError::Conflict(
                                "Another user account already uses this email".into(),
                            ));
                        }
                    }
                }
                normalized
            }
            None => existing.email.clone(),
        };

        let full_name = match req.full_name {
            Some(name) => {
                let trimmed = name.trim().to_string();
                if trimmed.len() < 2 {
                    return Err(DomainError::ValidationError(
                        "Full name must be at least 2 characters".into(),
                    ));
                }
                trimmed
            }
            None => existing.full_name.clone(),
        };

        let next_role = req.role.unwrap_or(existing.role);
        let next_is_active = req.is_active.unwrap_or(existing.is_active);

        if id == actor_user_id && (next_role != Role::SuperAdmin || !next_is_active) {
            return Err(DomainError::ValidationError(
                "You cannot demote or deactivate your own active administrator account".into(),
            ));
        }

        if existing.role == Role::SuperAdmin
            && existing.is_active
            && (next_role != Role::SuperAdmin || !next_is_active)
        {
            let remaining = self.user_repo.count_active_super_admins(Some(id)).await?;
            if remaining == 0 {
                return Err(DomainError::ValidationError(
                    "At least one active Super Admin must remain in the system".into(),
                ));
            }
        }

        let next_property_id = req.property_id.unwrap_or(existing.property_id);
        self.validate_property_if_present(next_property_id).await?;

        let new_password_hash = match req.password {
            Some(pw) if !pw.trim().is_empty() => Some(self.password_hasher.hash(&pw)?),
            _ => None,
        };

        let revoke_refresh =
            !next_is_active || next_role != existing.role || new_password_hash.is_some();

        let updated = ManagedUser {
            id: existing.id,
            email,
            full_name,
            role: next_role,
            phone: req.phone.unwrap_or(existing.phone),
            unit_number: req.unit_number.unwrap_or(existing.unit_number),
            property_id: next_property_id,
            property_name: None,
            tenant_id: req.tenant_id.unwrap_or(existing.tenant_id),
            staff_id: req.staff_id.unwrap_or(existing.staff_id),
            is_active: next_is_active,
            created_at: existing.created_at,
            updated_at: Utc::now(),
        };

        self.user_repo
            .update_user(updated, new_password_hash, revoke_refresh)
            .await
    }

    pub async fn delete_user(&self, actor_user_id: Uuid, id: Uuid) -> DomainResult<()> {
        if id == actor_user_id {
            return Err(DomainError::ValidationError(
                "You cannot delete your own active administrator account".into(),
            ));
        }

        let existing = self.get_user(id).await?;
        if existing.role == Role::SuperAdmin && existing.is_active {
            let remaining = self.user_repo.count_active_super_admins(Some(id)).await?;
            if remaining == 0 {
                return Err(DomainError::ValidationError(
                    "Cannot delete the last remaining active Super Admin".into(),
                ));
            }
        }

        self.user_repo.delete_user(id).await
    }

    pub async fn list_roles(&self) -> DomainResult<Vec<RoleDefinition>> {
        let counts_raw = self.user_repo.count_users_by_role().await?;
        let mut counts: HashMap<String, i64> = HashMap::new();
        for (role, cnt) in counts_raw {
            counts.insert(role.descriptor().key.to_string(), cnt);
        }

        Ok(Role::ALL
            .iter()
            .map(|r| {
                let d = r.descriptor();
                RoleDefinition {
                    role: d.role,
                    label: d.label.to_string(),
                    description: d.description.to_string(),
                    permissions: d.permissions.iter().map(|s| (*s).to_string()).collect(),
                    user_count: *counts.get(d.key).unwrap_or(&0),
                }
            })
            .collect())
    }
}
