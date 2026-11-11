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

pub struct RoleDescriptor {
    pub role: Role,
    pub key: &'static str,
    pub label: &'static str,
    pub description: &'static str,
    pub permissions: &'static [&'static str],
}

impl Role {
    pub const ALL: [Role; 5] = [
        Role::SuperAdmin,
        Role::PropertyManager,
        Role::MaintenanceStaff,
        Role::Staff,
        Role::Tenant,
    ];

    pub const fn descriptor(&self) -> RoleDescriptor {
        match self {
            Role::SuperAdmin => RoleDescriptor {
                role: Role::SuperAdmin,
                key: "super_admin",
                label: "Super Admin",
                description: "Unrestricted portfolio governance, RBAC user/role provisioning, audit logs, and all property operations.",
                permissions: &[
                    "Manage users & assign roles",
                    "Full property, unit & tenant CRUD",
                    "Staff management & dispatch",
                    "Review applications & amenity schedules",
                    "View security audit logs & Tenant View preview",
                ],
            },
            Role::PropertyManager => RoleDescriptor {
                role: Role::PropertyManager,
                key: "property_manager",
                label: "Property Manager",
                description: "Manages tenancy applications, property staff, parking assignments, amenity approvals, maintenance dispatch, and staff messaging.",
                permissions: &[
                    "Approve or reject tenancy applications",
                    "Manage cleaners, maintainers & security staff",
                    "Assign parking spots & edit layouts",
                    "Accept or reject amenity schedules",
                    "Send broadcast & direct staff messages",
                ],
            },
            Role::MaintenanceStaff => RoleDescriptor {
                role: Role::MaintenanceStaff,
                key: "maintenance_staff",
                label: "Maintainer",
                description: "Receives unit maintenance work orders, updates job progress, resolves tickets on Web & Mobile, and chats with managers.",
                permissions: &[
                    "View & filter maintenance call queue",
                    "Update status & record resolution notes",
                    "Communicate with managers on Web & Mobile",
                ],
            },
            Role::Staff => RoleDescriptor {
                role: Role::Staff,
                key: "staff",
                label: "Building Staff",
                description: "Cleaners, security, and concierge personnel who receive assignments and talk directly with Property Managers.",
                permissions: &[
                    "Direct & team chat with Property Manager",
                    "Mobile & Web messaging inbox",
                    "View property staff directory",
                ],
            },
            Role::Tenant => RoleDescriptor {
                role: Role::Tenant,
                key: "tenant",
                label: "Tenant / Resident",
                description: "Scoped strictly to the Resident Portal to schedule amenities and report/track personal unit maintenance calls.",
                permissions: &[
                    "Schedule amenities in local time",
                    "Cancel or review own amenity bookings",
                    "File & track own unit maintenance calls",
                ],
            },
        }
    }

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

impl User {
    /// Checks whether this user may access resources under `target_property_id`.
    /// SuperAdmins and unscoped PropertyManagers (`property_id == None`) have portfolio access;
    /// property-scoped users are restricted to their assigned property.
    pub fn has_property_access(&self, target_property_id: Uuid) -> bool {
        if self.role == Role::SuperAdmin {
            return true;
        }
        match self.property_id {
            Some(assigned) => assigned == target_property_id,
            None => self.role.can_manage_properties(),
        }
    }

    /// Resolves and authorizes an optional query/body `property_id` filter against the caller's scope.
    pub fn enforce_property_scope(&self, requested: Option<Uuid>) -> Result<Option<Uuid>, crate::domain::errors::DomainError> {
        if self.role == Role::SuperAdmin {
            return Ok(requested);
        }
        match self.property_id {
            Some(assigned) => {
                if let Some(req_id) = requested {
                    if req_id != assigned {
                        return Err(crate::domain::errors::DomainError::Forbidden);
                    }
                }
                Ok(Some(assigned))
            }
            None if self.role.can_manage_properties() => Ok(requested),
            None => Err(crate::domain::errors::DomainError::Forbidden),
        }
    }
}
