use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[serde(rename_all = "snake_case")]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
pub enum Role {
    SuperAdmin,
    PropertyManager,
    MaintenanceStaff,
    Staff,
    Tenant,
}

impl Role {
    pub fn is_admin(&self) -> bool {
        matches!(self, Role::SuperAdmin)
    }

    pub fn can_manage_properties(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::PropertyManager)
    }

    pub fn can_view_audit_logs(&self) -> bool {
        matches!(self, Role::SuperAdmin)
    }

    pub fn can_perform_maintenance(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::PropertyManager | Role::MaintenanceStaff)
    }

    pub fn can_access_staff_messages(&self) -> bool {
        matches!(
            self,
            Role::SuperAdmin | Role::PropertyManager | Role::MaintenanceStaff | Role::Staff
        )
    }

    pub fn require_any(&self, allowed: &[Role]) -> crate::domain::errors::DomainResult<()> {
        if allowed.contains(self) {
            Ok(())
        } else {
            Err(crate::domain::errors::DomainError::Forbidden)
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: Uuid,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub full_name: String,
    pub role: Role,
    pub phone: Option<String>,
    pub unit_number: Option<String>,
    pub property_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
    #[serde(skip_serializing)]
    pub refresh_token_hash: Option<String>,
    #[serde(skip_serializing)]
    pub refresh_token_expires_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: Uuid,
    pub email: String,
    pub full_name: String,
    pub role: Role,
    pub phone: Option<String>,
    pub unit_number: Option<String>,
    pub property_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
}

impl From<User> for UserSummary {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            phone: u.phone,
            unit_number: u.unit_number,
            property_id: u.property_id,
            tenant_id: u.tenant_id,
            staff_id: u.staff_id,
        }
    }
}
