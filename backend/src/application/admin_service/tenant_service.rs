use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::{CreateTenantRequest, UpdateTenantRequest};
use crate::domain::{
    admin::{Tenant, TenantRepository, TenantStatus, TenantWithUnit, UnitRepository, UnitStatus},
    errors::{DomainError, DomainResult},
};

pub struct TenantService {
    tenant_repo: Arc<dyn TenantRepository>,
    unit_repo: Arc<dyn UnitRepository>,
}

impl TenantService {
    pub fn new(
        tenant_repo: Arc<dyn TenantRepository>,
        unit_repo: Arc<dyn UnitRepository>,
    ) -> Self {
        Self {
            tenant_repo,
            unit_repo,
        }
    }

    fn validate_tenant_fields(first_name: &str, last_name: &str, email: &str) -> DomainResult<()> {
        if first_name.trim().is_empty() || last_name.trim().is_empty() {
            return Err(DomainError::ValidationError("First and last names are required".to_string()));
        }
        if email.trim().is_empty() || !email.contains('@') {
            return Err(DomainError::ValidationError("A valid email address is required".to_string()));
        }
        Ok(())
    }

    async fn release_unit_if_empty(&self, unit_id: Uuid, exclude_tenant_id: Uuid) -> DomainResult<()> {
        let remaining_active = self
            .unit_repo
            .count_active_tenants_for_unit(unit_id, Some(exclude_tenant_id))
            .await?;
        if remaining_active == 0 {
            self.unit_repo.set_unit_status(unit_id, UnitStatus::Vacant).await?;
        }
        Ok(())
    }

    pub async fn list_tenants(
        &self,
        property_id: Option<Uuid>,
        status: Option<TenantStatus>,
        query: Option<String>,
    ) -> DomainResult<Vec<TenantWithUnit>> {
        self.tenant_repo.list_tenants(property_id, status, query).await
    }

    pub async fn get_tenant(&self, id: Uuid) -> DomainResult<TenantWithUnit> {
        self.tenant_repo
            .get_tenant(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Tenant with ID {} not found", id)))
    }

    pub async fn create_tenant(&self, req: CreateTenantRequest) -> DomainResult<Tenant> {
        Self::validate_tenant_fields(&req.first_name, &req.last_name, &req.email)?;

        if let Some(unit_id) = req.assigned_unit_id {
            let unit = self
                .unit_repo
                .get_unit(unit_id)
                .await?
                .ok_or_else(|| DomainError::NotFound(format!("Unit with ID {} not found", unit_id)))?;
            if unit.status == UnitStatus::Occupied {
                tracing::info!("Assigning tenant to already occupied unit {}", unit.unit_number);
            }
            self.unit_repo.set_unit_status(unit_id, UnitStatus::Occupied).await?;
        }

        let now = Utc::now();
        let tenant = Tenant {
            id: Uuid::new_v4(),
            first_name: req.first_name.trim().to_string(),
            last_name: req.last_name.trim().to_string(),
            email: req.email.trim().to_lowercase(),
            phone: req.phone.trim().to_string(),
            emergency_contact_name: req.emergency_contact_name.map(|s| s.trim().to_string()),
            emergency_contact_phone: req.emergency_contact_phone.map(|s| s.trim().to_string()),
            assigned_unit_id: req.assigned_unit_id,
            lease_start_date: req.lease_start_date,
            lease_end_date: req.lease_end_date,
            status: req.status.unwrap_or(TenantStatus::Active),
            created_at: now,
            updated_at: now,
        };

        self.tenant_repo.create_tenant(tenant).await
    }

    pub async fn update_tenant(&self, id: Uuid, req: UpdateTenantRequest) -> DomainResult<Tenant> {
        let existing = self.get_tenant(id).await?;
        Self::validate_tenant_fields(&req.first_name, &req.last_name, &req.email)?;

        if existing.assigned_unit_id != req.assigned_unit_id {
            if let Some(old_unit_id) = existing.assigned_unit_id {
                self.release_unit_if_empty(old_unit_id, id).await?;
            }
            if let Some(new_unit_id) = req.assigned_unit_id {
                self.unit_repo.set_unit_status(new_unit_id, UnitStatus::Occupied).await?;
            }
        }

        let tenant = Tenant {
            id,
            first_name: req.first_name.trim().to_string(),
            last_name: req.last_name.trim().to_string(),
            email: req.email.trim().to_lowercase(),
            phone: req.phone.trim().to_string(),
            emergency_contact_name: req.emergency_contact_name.map(|s| s.trim().to_string()),
            emergency_contact_phone: req.emergency_contact_phone.map(|s| s.trim().to_string()),
            assigned_unit_id: req.assigned_unit_id,
            lease_start_date: req.lease_start_date,
            lease_end_date: req.lease_end_date,
            status: req.status,
            created_at: existing.created_at,
            updated_at: Utc::now(),
        };

        self.tenant_repo.update_tenant(tenant).await
    }

    pub async fn delete_tenant(&self, id: Uuid) -> DomainResult<()> {
        let tenant = self.get_tenant(id).await?;
        if let Some(unit_id) = tenant.assigned_unit_id {
            self.release_unit_if_empty(unit_id, id).await?;
        }
        self.tenant_repo.delete_tenant(id).await
    }
}

