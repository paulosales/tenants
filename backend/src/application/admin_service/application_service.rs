use chrono::{NaiveDate, Utc};
use std::sync::Arc;
use uuid::Uuid;

use super::dtos::{CreateTenancyApplicationRequest, ReviewTenancyApplicationRequest};
use crate::domain::{
    admin::{
        PropertyRepository, PublicPortalRepository, TenancyApplication,
        TenancyApplicationRepository, Tenant, TenantRepository, TenantStatus, UnitRepository,
        UnitStatus,
    },
    errors::{DomainError, DomainResult},
};

pub struct PublicApplicationReceipt {
    pub application: TenancyApplication,
    pub managers_notified: i64,
}

pub struct TenancyApplicationService {
    app_repo: Arc<dyn TenancyApplicationRepository>,
    property_repo: Arc<dyn PropertyRepository>,
    portal_repo: Arc<dyn PublicPortalRepository>,
    tenant_repo: Arc<dyn TenantRepository>,
    unit_repo: Arc<dyn UnitRepository>,
}

impl TenancyApplicationService {
    pub fn new(
        app_repo: Arc<dyn TenancyApplicationRepository>,
        property_repo: Arc<dyn PropertyRepository>,
        portal_repo: Arc<dyn PublicPortalRepository>,
        tenant_repo: Arc<dyn TenantRepository>,
        unit_repo: Arc<dyn UnitRepository>,
    ) -> Self {
        Self {
            app_repo,
            property_repo,
            portal_repo,
            tenant_repo,
            unit_repo,
        }
    }

    pub async fn submit_public_application(
        &self,
        req: CreateTenancyApplicationRequest,
    ) -> DomainResult<PublicApplicationReceipt> {
        let first_name = req.applicant_first_name.trim().to_string();
        let last_name = req.applicant_last_name.trim().to_string();
        let email = req.applicant_email.trim().to_lowercase();
        let phone = req.applicant_phone.trim().to_string();

        if first_name.is_empty()
            || last_name.is_empty()
            || first_name.len() > 100
            || last_name.len() > 100
        {
            return Err(DomainError::ValidationError(
                "Applicant first and last name must be between 1 and 100 characters".into(),
            ));
        }
        if !email.contains('@') || email.len() < 5 || email.len() > 255 {
            return Err(DomainError::ValidationError(
                "A valid applicant email address is required".into(),
            ));
        }
        if phone.len() < 7 || phone.len() > 50 {
            return Err(DomainError::ValidationError(
                "A valid applicant contact phone number is required".into(),
            ));
        }
        if req.occupants_count < 1 || req.occupants_count > 12 {
            return Err(DomainError::ValidationError(
                "Occupants count must be between 1 and 12".into(),
            ));
        }
        if req
            .notes
            .as_deref()
            .map(|n| n.len() > 2000)
            .unwrap_or(false)
        {
            return Err(DomainError::ValidationError(
                "Application notes must not exceed 2000 characters".into(),
            ));
        }

        // Ensure target property exists
        self.property_repo
            .get_property(req.property_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Selected property does not exist".into()))?;

        // Validate optional preferred unit belongs to property
        if let Some(unit_id) = req.preferred_unit_id {
            let unit = self.unit_repo.get_unit(unit_id).await?.ok_or_else(|| {
                DomainError::NotFound("Selected preferred unit does not exist".into())
            })?;
            if unit.property_id != req.property_id {
                return Err(DomainError::ValidationError(
                    "Preferred unit does not belong to selected property".into(),
                ));
            }
        }

        let desired_move_in_date = match req.desired_move_in_date.as_deref() {
            Some(s) if !s.trim().is_empty() => Some(
                NaiveDate::parse_from_str(s.trim(), "%Y-%m-%d").map_err(|_| {
                    DomainError::ValidationError("desired_move_in_date must be YYYY-MM-DD".into())
                })?,
            ),
            _ => None,
        };

        let now = Utc::now();
        let application = TenancyApplication {
            id: Uuid::new_v4(),
            property_id: req.property_id,
            property_name: None,
            preferred_unit_id: req.preferred_unit_id,
            preferred_unit_number: None,
            applicant_first_name: first_name,
            applicant_last_name: last_name,
            applicant_email: email,
            applicant_phone: phone,
            monthly_income_cents: req.monthly_income_cents.max(0),
            employment_status: if req.employment_status.trim().is_empty() {
                "full_time".into()
            } else {
                req.employment_status.trim().to_string()
            },
            desired_move_in_date,
            occupants_count: req.occupants_count,
            notes: req
                .notes
                .map(|n| n.trim().to_string())
                .filter(|n| !n.is_empty()),
            // Security: Public intake strictly initializes status as pending.
            status: "pending".into(),
            reviewed_by_user_id: None,
            review_notes: None,
            reviewed_at: None,
            created_at: now,
            updated_at: now,
        };

        let saved = self.app_repo.create_application(application).await?;
        let managers_notified = self
            .portal_repo
            .count_property_managers(req.property_id)
            .await?;

        Ok(PublicApplicationReceipt {
            application: saved,
            managers_notified,
        })
    }

    pub async fn get_application(&self, id: Uuid) -> DomainResult<TenancyApplication> {
        self.app_repo
            .get_application(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Tenancy application {} not found", id)))
    }

    pub async fn list_applications(
        &self,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<TenancyApplication>> {
        self.app_repo.list_applications(property_id, status).await
    }

    pub async fn review_application(
        &self,
        id: Uuid,
        reviewer_user_id: Uuid,
        req: ReviewTenancyApplicationRequest,
    ) -> DomainResult<TenancyApplication> {
        let normalized_status = req.status.trim().to_lowercase();
        if !matches!(
            normalized_status.as_str(),
            "under_review" | "approved" | "rejected"
        ) {
            return Err(DomainError::ValidationError(
                "Application review status must be 'under_review', 'approved', or 'rejected'"
                    .into(),
            ));
        }

        let existing = self.app_repo.get_application(id).await?.ok_or_else(|| {
            DomainError::NotFound(format!("Tenancy application {} not found", id))
        })?;

        let updated = self
            .app_repo
            .update_application_review(id, &normalized_status, reviewer_user_id, req.review_notes)
            .await?;

        // When approved with onboarding enabled (default true unless explicitly false),
        // register the applicant into tenants and mark vacant preferred unit as occupied.
        if normalized_status == "approved" && req.onboard_as_tenant.unwrap_or(true) {
            let matching = self
                .tenant_repo
                .list_tenants(None, None, Some(existing.applicant_email.clone()))
                .await
                .unwrap_or_default();

            let already_exists = matching
                .iter()
                .any(|t| t.email.eq_ignore_ascii_case(&existing.applicant_email));

            if !already_exists {
                let now = Utc::now();
                let new_tenant = Tenant {
                    id: Uuid::new_v4(),
                    first_name: existing.applicant_first_name,
                    last_name: existing.applicant_last_name,
                    email: existing.applicant_email,
                    phone: existing.applicant_phone,
                    emergency_contact_name: None,
                    emergency_contact_phone: None,
                    assigned_unit_id: existing.preferred_unit_id,
                    lease_start_date: existing.desired_move_in_date,
                    lease_end_date: None,
                    status: TenantStatus::Active,
                    created_at: now,
                    updated_at: now,
                };
                if self.tenant_repo.create_tenant(new_tenant).await.is_ok() {
                    if let Some(unit_id) = existing.preferred_unit_id {
                        let _ = self
                            .unit_repo
                            .set_unit_status(unit_id, UnitStatus::Occupied)
                            .await;
                    }
                }
            }
        }

        Ok(updated)
    }
}
