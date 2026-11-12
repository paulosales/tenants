use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

use super::dtos::{CreateTenantReservationRequest, ReviewTenantReservationRequest};
use crate::domain::{
    admin::{
        AmenityCalendarEvent, AmenityCalendarSlotRecord, TenantReservation,
        TenantReservationRepository,
    },
    errors::{DomainError, DomainResult},
    user::User,
};

const MAX_CALENDAR_RANGE_DAYS: i64 = 62;

pub struct TenantReservationService {
    repo: Arc<dyn TenantReservationRepository>,
}

impl TenantReservationService {
    pub fn new(repo: Arc<dyn TenantReservationRepository>) -> Self {
        Self { repo }
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

    /// Projects raw calendar slot records into privacy-safe events:
    /// only `SuperAdmin` viewers receive scheduler names, units, or non-own details.
    pub fn redact_calendar_slot(
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

    pub async fn list_amenity_calendar_for_viewer(
        &self,
        actor: &User,
        amenity_id: Uuid,
        amenity_property_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> DomainResult<Vec<AmenityCalendarEvent>> {
        if !actor.has_property_access(amenity_property_id) {
            return Err(DomainError::Forbidden);
        }
        if end <= start {
            return Err(DomainError::ValidationError(
                "Calendar end date must be after start date".into(),
            ));
        }
        if (end - start).num_days() > MAX_CALENDAR_RANGE_DAYS {
            return Err(DomainError::ValidationError(format!(
                "Calendar range cannot exceed {} days",
                MAX_CALENDAR_RANGE_DAYS
            )));
        }

        let records = self
            .repo
            .list_amenity_calendar_slots(amenity_id, start, end)
            .await?;

        Ok(records
            .into_iter()
            .map(|r| Self::redact_calendar_slot(actor, r))
            .collect())
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
