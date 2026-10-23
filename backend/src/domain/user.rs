use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "user_role", rename_all = "snake_case")]
pub enum Role {
    SuperAdmin,
    PropertyManager,
    MaintenanceStaff,
    Tenant,
}

impl Role {
    pub fn can_manage_properties(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::PropertyManager)
    }

    pub fn can_view_audit_logs(&self) -> bool {
        matches!(self, Role::SuperAdmin)
    }

    pub fn can_perform_maintenance(&self) -> bool {
        matches!(self, Role::SuperAdmin | Role::PropertyManager | Role::MaintenanceStaff)
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
    pub unit_number: Option<String>,
}

impl From<User> for UserSummary {
    fn from(u: User) -> Self {
        Self {
            id: u.id,
            email: u.email,
            full_name: u.full_name,
            role: u.role,
            unit_number: u.unit_number,
        }
    }
}
