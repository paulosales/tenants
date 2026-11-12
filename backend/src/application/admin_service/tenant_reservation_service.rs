use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

use super::dtos::{
    AmenityCalendarQuery, CreateTenantReservationRequest, ReviewTenantReservationRequest,
};
use crate::domain::{
    admin::{
        AdminAmenityRepository, AmenityCalendarEvent, AmenityCalendarSlotRecord, TenantReservation,
        TenantReservationRepository,
    },
    errors::{DomainError, DomainResult},
    user::{Role, User},
};

const MAX_CALENDAR_RANGE_DAYS: i64 = 62;

/// Open/Closed policy abstraction governing how raw amenity schedule records
/// are projected for a specific authenticated viewer (OCP + DIP).
pub trait CalendarVisibilityPolicy: Send + Sync {
    fn project_event(
        &self,
        actor: &User,
        record: AmenityCalendarSlotRecord,
    ) -> AmenityCalendarEvent;
}

/// Default RBAC privacy policy: only `SuperAdmin` viewers receive scheduler PII
/// for other residents' bookings; tenants only receive occupancy and their own slot details.
pub struct RoleBasedCalendarVisibilityPolicy;

impl CalendarVisibilityPolicy for RoleBasedCalendarVisibilityPolicy {
    fn project_event(
        &self,
        actor: &User,
        record: AmenityCalendarSlotRecord,
    ) -> AmenityCalendarEvent {
        let is_own = (record.tenant_id.is_some() && record.tenant_id == actor.tenant_id)
            || record.user_id == Some(actor.id);

        if actor.role.is_admin() {
            return AmenityCalendarEvent {
                id: record.id,
                amenity_id: record.amenity_id,
                start_time: record.start_time,
                end_time: record.end_time,
                status: record.status,
                is_own,
                scheduled_by_name: record.scheduled_by_name,
                unit_number: record.unit_number,
                attendees_count: Some(record.attendees_count),
                notes: record.notes,
            };
        }

        if is_own {
            return AmenityCalendarEvent {
                id: record.id,
                amenity_id: record.amenity_id,
                start_time: record.start_time,
                end_time: record.end_time,
                status: record.status,
                is_own: true,
                scheduled_by_name: None,
                unit_number: None,
                attendees_count: Some(record.attendees_count),
                notes: record.notes,
            };
        }

        AmenityCalendarEvent {
            id: record.id,
            amenity_id: record.amenity_id,
            start_time: record.start_time,
            end_time: record.end_time,
            status: record.status,
            is_own: false,
            scheduled_by_name: None,
            unit_number: None,
            attendees_count: None,
            notes: None,
        }
    }
}

pub struct TenantReservationService {
    repo: Arc<dyn TenantReservationRepository>,
    amenity_repo: Arc<dyn AdminAmenityRepository>,
    visibility_policy: Arc<dyn CalendarVisibilityPolicy>,
}

impl TenantReservationService {
    pub fn new(
        repo: Arc<dyn TenantReservationRepository>,
        amenity_repo: Arc<dyn AdminAmenityRepository>,
    ) -> Self {
        Self::with_policy(
            repo,
            amenity_repo,
            Arc::new(RoleBasedCalendarVisibilityPolicy),
        )
    }

    pub fn with_policy(
        repo: Arc<dyn TenantReservationRepository>,
        amenity_repo: Arc<dyn AdminAmenityRepository>,
        visibility_policy: Arc<dyn CalendarVisibilityPolicy>,
    ) -> Self {
        Self {
            repo,
            amenity_repo,
            visibility_policy,
        }
    }

    fn parse_utc_timestamp(
        field_label: &str,
        raw_time: &str,
        booking_date: Option<&str>,
    ) -> DomainResult<DateTime<Utc>> {
        if let Ok(dt) = DateTime::parse_from_rfc3339(raw_time) {
            return Ok(dt.with_timezone(&Utc));
        }

        let date_prefix = booking_date.unwrap_or("");
        let clean_time = if raw_time.len() == 5 {
            format!("{}:00", raw_time)
        } else {
            raw_time.to_string()
        };
        let rfc3339_candidate = if clean_time.ends_with('Z') {
            format!("{}T{}", date_prefix, clean_time)
        } else {
            format!("{}T{}Z", date_prefix, clean_time)
        };

        DateTime::parse_from_rfc3339(&rfc3339_candidate)
            .map(|dt| dt.with_timezone(&Utc))
            .map_err(|e| {
                DomainError::ValidationError(format!("Invalid {} format: {}", field_label, e))
            })
    }

    pub async fn list_tenant_reservations(
        &self,
        tenant_id: Option<Uuid>,
    ) -> DomainResult<Vec<TenantReservation>> {
        self.repo.list_tenant_reservations(tenant_id).await
    }

    /// Projects raw calendar slot records through the default RBAC policy (retained for direct helpers/tests).
    pub fn redact_calendar_slot(
        actor: &User,
        record: AmenityCalendarSlotRecord,
    ) -> AmenityCalendarEvent {
        RoleBasedCalendarVisibilityPolicy.project_event(actor, record)
    }

    pub async fn list_for_viewer(
        &self,
        actor: &User,
        requested_tenant_id: Option<Uuid>,
    ) -> DomainResult<Vec<TenantReservation>> {
        let scoped_tenant_id = if actor.role == Role::Tenant {
            Some(actor.tenant_id.ok_or(DomainError::Forbidden)?)
        } else if actor.role.can_manage_properties() {
            requested_tenant_id
        } else {
            return Err(DomainError::Forbidden);
        };

        let list = self.repo.list_tenant_reservations(scoped_tenant_id).await?;
        if actor.role == Role::Tenant {
            return Ok(list);
        }

        Ok(list
            .into_iter()
            .filter(|r| {
                r.property_id
                    .map(|p| actor.has_property_access(p))
                    .unwrap_or(true)
            })
            .collect())
    }

    pub async fn list_calendar_for_viewer(
        &self,
        actor: &User,
        query: AmenityCalendarQuery,
    ) -> DomainResult<Vec<AmenityCalendarEvent>> {
        if !matches!(
            actor.role,
            Role::Tenant | Role::PropertyManager | Role::SuperAdmin
        ) {
            return Err(DomainError::Forbidden);
        }

        let amenity = self
            .amenity_repo
            .get_amenity(query.amenity_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Amenity {} not found", query.amenity_id))
            })?;

        actor.ensure_property_access(amenity.property_id)?;

        if query.end_date <= query.start_date {
            return Err(DomainError::ValidationError(
                "Calendar end date must be after start date".into(),
            ));
        }
        if (query.end_date - query.start_date).num_days() > MAX_CALENDAR_RANGE_DAYS {
            return Err(DomainError::ValidationError(format!(
                "Calendar range cannot exceed {} days",
                MAX_CALENDAR_RANGE_DAYS
            )));
        }

        let records = self
            .repo
            .list_amenity_calendar_slots(query.amenity_id, query.start_date, query.end_date)
            .await?;

        Ok(records
            .into_iter()
            .map(|r| self.visibility_policy.project_event(actor, r))
            .collect())
    }

    pub async fn create_for_viewer(
        &self,
        actor: &User,
        mut req: CreateTenantReservationRequest,
    ) -> DomainResult<TenantReservation> {
        if !matches!(
            actor.role,
            Role::Tenant | Role::PropertyManager | Role::SuperAdmin
        ) {
            return Err(DomainError::Forbidden);
        }

        let amenity = self
            .amenity_repo
            .get_amenity(req.amenity_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Amenity {} not found", req.amenity_id))
            })?;

        actor.ensure_property_access(amenity.property_id)?;
        if !amenity.is_active {
            return Err(DomainError::ValidationError(
                "This amenity is currently unavailable".into(),
            ));
        }

        let attendees_count = req.attendees_count.unwrap_or(1);
        if attendees_count < 1 || attendees_count > amenity.capacity {
            return Err(DomainError::ValidationError(format!(
                "Attendees count must be between 1 and {} guests",
                amenity.capacity
            )));
        }

        if actor.role == Role::Tenant {
            req.tenant_id = Some(actor.tenant_id.ok_or(DomainError::Forbidden)?);
        } else if req.tenant_id.is_none() {
            return Err(DomainError::ValidationError("tenant_id is required".into()));
        }

        self.create_tenant_reservation(req).await
    }

    pub async fn cancel_for_viewer(&self, actor: &User, id: Uuid) -> DomainResult<()> {
        let existing = self.get_tenant_reservation(id).await?;
        if actor.role == Role::Tenant {
            if Some(existing.tenant_id) != actor.tenant_id {
                return Err(DomainError::Forbidden);
            }
        } else if !actor.role.can_manage_properties()
            || existing
                .property_id
                .map(|p| !actor.has_property_access(p))
                .unwrap_or(false)
        {
            return Err(DomainError::Forbidden);
        }

        self.cancel_tenant_reservation(id).await
    }

    pub async fn review_for_viewer(
        &self,
        actor: &User,
        id: Uuid,
        req: ReviewTenantReservationRequest,
    ) -> DomainResult<TenantReservation> {
        if !actor.role.can_manage_properties() {
            return Err(DomainError::Forbidden);
        }
        let existing = self.get_tenant_reservation(id).await?;
        if let Some(pid) = existing.property_id {
            actor.ensure_property_access(pid)?;
        }

        self.review_tenant_reservation(id, req).await
    }

    pub async fn create_tenant_reservation(
        &self,
        req: CreateTenantReservationRequest,
    ) -> DomainResult<TenantReservation> {
        let tenant_id = req
            .tenant_id
            .unwrap_or_else(|| Uuid::parse_str("33333333-1111-1111-1111-111111111001").unwrap());

        let booking_date_ref = req.booking_date.as_deref();
        let start_time =
            Self::parse_utc_timestamp("start time", &req.start_time, booking_date_ref)?;
        let end_time = Self::parse_utc_timestamp("end time", &req.end_time, booking_date_ref)?;

        if end_time <= start_time {
            return Err(DomainError::ValidationError(
                "End time must be after start time".to_string(),
            ));
        }

        let attendees_count = req.attendees_count.unwrap_or(1);
        if attendees_count < 1 {
            return Err(DomainError::ValidationError(
                "At least 1 attendee is required".to_string(),
            ));
        }

        let now = Utc::now();
        let booking_date = req
            .booking_date
            .clone()
            .or_else(|| Some(start_time.format("%Y-%m-%d").to_string()));

        let res = TenantReservation {
            id: Uuid::new_v4(),
            amenity_id: req.amenity_id,
            amenity_name: String::new(),
            tenant_id,
            tenant_name: None,
            property_id: None,
            unit_number: None,
            booking_date,
            start_time,
            end_time,
            attendees_count,
            total_price_cents: 0,
            // Tenant amenity requests start pending until a Property Manager accepts or rejects them.
            status: "pending".to_string(),
            notes: req.notes,
            created_at: now,
        };

        self.repo.create_tenant_reservation(res).await
    }

    pub async fn get_tenant_reservation(&self, id: Uuid) -> DomainResult<TenantReservation> {
        self.repo
            .get_tenant_reservation(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Amenity reservation {} not found", id)))
    }

    pub async fn review_tenant_reservation(
        &self,
        id: Uuid,
        req: ReviewTenantReservationRequest,
    ) -> DomainResult<TenantReservation> {
        let normalized = req.status.trim().to_lowercase();
        if !matches!(normalized.as_str(), "confirmed" | "rejected") {
            return Err(DomainError::ValidationError(
                "Amenity session decision must be 'confirmed' or 'rejected'".into(),
            ));
        }

        self.repo
            .review_tenant_reservation(id, &normalized, req.notes)
            .await
    }

    pub async fn cancel_tenant_reservation(&self, id: Uuid) -> DomainResult<()> {
        self.repo.cancel_tenant_reservation(id).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::user::Role;
    use chrono::Duration;

    fn sample_user(role: Role, tenant_id: Option<Uuid>) -> User {
        User {
            id: Uuid::new_v4(),
            email: "user@example.com".into(),
            password_hash: String::new(),
            full_name: "Test User".into(),
            role,
            phone: None,
            unit_number: None,
            property_id: None,
            tenant_id,
            staff_id: None,
            refresh_token_hash: None,
            refresh_token_expires_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        }
    }

    #[test]
    fn test_calendar_redaction_only_reveals_scheduler_to_super_admin() {
        let now = Utc::now();
        let tenant_a_id = Uuid::new_v4();
        let tenant_b_id = Uuid::new_v4();
        let record = AmenityCalendarSlotRecord {
            id: Uuid::new_v4(),
            amenity_id: Uuid::new_v4(),
            tenant_id: Some(tenant_b_id),
            user_id: None,
            scheduled_by_name: Some("Elena Rostova".into()),
            unit_number: Some("102".into()),
            start_time: now,
            end_time: now + Duration::hours(2),
            attendees_count: 6,
            status: "confirmed".into(),
            notes: Some("Private birthday party".into()),
        };

        // Tenant A viewing Tenant B's booking: zero PII exposed
        let tenant_viewer = sample_user(Role::Tenant, Some(tenant_a_id));
        let tenant_ev =
            TenantReservationService::redact_calendar_slot(&tenant_viewer, record.clone());
        assert!(!tenant_ev.is_own);
        assert!(tenant_ev.scheduled_by_name.is_none());
        assert!(tenant_ev.unit_number.is_none());
        assert!(tenant_ev.attendees_count.is_none());
        assert!(tenant_ev.notes.is_none());

        // Property Manager: not SuperAdmin, so non-own identity remains hidden
        let mgr_viewer = sample_user(Role::PropertyManager, None);
        let mgr_ev = TenantReservationService::redact_calendar_slot(&mgr_viewer, record.clone());
        assert!(mgr_ev.scheduled_by_name.is_none());
        assert!(mgr_ev.unit_number.is_none());

        // SuperAdmin: full scheduler details exposed
        let admin_viewer = sample_user(Role::SuperAdmin, None);
        let admin_ev = TenantReservationService::redact_calendar_slot(&admin_viewer, record);
        assert_eq!(admin_ev.scheduled_by_name.as_deref(), Some("Elena Rostova"));
        assert_eq!(admin_ev.unit_number.as_deref(), Some("102"));
        assert_eq!(admin_ev.attendees_count, Some(6));
        assert_eq!(admin_ev.notes.as_deref(), Some("Private birthday party"));
    }
}
