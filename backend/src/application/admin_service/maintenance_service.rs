use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::{
    AssignMaintenanceCallStaffRequest, CreateMaintenanceCallRequest,
    UpdateMaintenanceCallStatusRequest,
};
use crate::domain::{
    admin::{MaintenanceCall, MaintenanceCallRepository},
    errors::{DomainError, DomainResult},
};

pub struct MaintenanceService {
    repo: Arc<dyn MaintenanceCallRepository>,
}

impl MaintenanceService {
    pub fn new(repo: Arc<dyn MaintenanceCallRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_maintenance_calls(
        &self,
        tenant_id: Option<Uuid>,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<MaintenanceCall>> {
        self.repo.list_maintenance_calls(tenant_id, property_id, status).await
    }

    pub async fn get_maintenance_call(&self, id: Uuid) -> DomainResult<MaintenanceCall> {
        self.repo.get_maintenance_call(id).await?.ok_or_else(|| {
            DomainError::NotFound(format!("Maintenance call {} not found", id))
        })
    }

    pub async fn create_maintenance_call(
        &self,
        req: CreateMaintenanceCallRequest,
    ) -> DomainResult<MaintenanceCall> {
        if req.title.trim().len() < 3 {
            return Err(DomainError::ValidationError("Title must be at least 3 characters".to_string()));
        }
        if req.description.trim().len() < 5 {
            return Err(DomainError::ValidationError("Description must be at least 5 characters".to_string()));
        }

        let tenant_id = req.tenant_id.unwrap_or_else(|| {
            Uuid::parse_str("33333333-1111-1111-1111-111111111001").unwrap()
        });

        let property_id = req.property_id.unwrap_or_else(|| {
            Uuid::parse_str("11111111-2222-3333-4444-555555555551").unwrap()
        });

        let now = Utc::now();
        let ticket_number = format!("MNT-2026-{:04}", (now.timestamp_subsec_millis() % 9000) + 1000);
        let priority = req.priority.unwrap_or_else(|| "routine".to_string());
        let is_emergency = priority == "emergency";
        let status = if is_emergency { "dispatched" } else { "reported" }.to_string();
        let assigned_technician = is_emergency.then(|| "On-Call Emergency Dispatch".to_string());
        let technician_phone = is_emergency.then(|| "+1 (800) 555-2739".to_string());

        let call = MaintenanceCall {
            id: Uuid::new_v4(),
            ticket_number,
            tenant_id,
            tenant_name: None,
            property_id,
            property_name: None,
            unit_number: req.unit_number.trim().to_string(),
            category: req.category.trim().to_string(),
            priority,
            title: req.title.trim().to_string(),
            description: req.description.trim().to_string(),
            permission_to_enter: req.permission_to_enter.unwrap_or(true),
            preferred_time_window: req
                .preferred_time_window
                .unwrap_or_else(|| "Morning (08:00 - 12:00)".to_string()),
            contact_phone: req.contact_phone.trim().to_string(),
            status,
            assigned_staff_id: None,
            assigned_technician,
            technician_phone,
            scheduled_date: None,
            resolution_notes: None,
            created_at: now,
            updated_at: now,
        };

        self.repo.create_maintenance_call(call).await
    }

    pub async fn update_maintenance_call_status(
        &self,
        id: Uuid,
        req: UpdateMaintenanceCallStatusRequest,
    ) -> DomainResult<MaintenanceCall> {
        self.repo
            .update_maintenance_call_status(id, &req.status, req.resolution_notes)
            .await
    }

    pub async fn cancel_maintenance_call(&self, id: Uuid) -> DomainResult<()> {
        self.repo.cancel_maintenance_call(id).await
    }

    pub async fn assign_maintenance_call_staff(
        &self,
        call_id: Uuid,
        req: AssignMaintenanceCallStaffRequest,
    ) -> DomainResult<MaintenanceCall> {
        let scheduled = match req.scheduled_date {
            Some(ref d) => Some(
                chrono::DateTime::parse_from_rfc3339(d)
                    .map_err(|e| DomainError::ValidationError(format!("Invalid scheduled_date: {}", e)))?
                    .with_timezone(&Utc),
            ),
            None => None,
        };

        self.repo
            .assign_maintenance_call_staff(call_id, req.staff_id, scheduled, req.resolution_notes)
            .await
    }
}

