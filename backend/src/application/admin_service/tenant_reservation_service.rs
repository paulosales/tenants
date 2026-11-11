use std::sync::Arc;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::dtos::CreateTenantReservationRequest;
use crate::domain::{
    admin::{TenantReservation, TenantReservationRepository},
    errors::{DomainError, DomainResult},
};

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

    pub async fn create_tenant_reservation(
        &self,
        req: CreateTenantReservationRequest,
    ) -> DomainResult<TenantReservation> {
        let tenant_id = req.tenant_id.unwrap_or_else(|| {
            Uuid::parse_str("33333333-1111-1111-1111-111111111001").unwrap()
        });

        let booking_date_ref = req.booking_date.as_deref();
        let start_time = Self::parse_utc_timestamp("start time", &req.start_time, booking_date_ref)?;
        let end_time = Self::parse_utc_timestamp("end time", &req.end_time, booking_date_ref)?;

        if end_time <= start_time {
            return Err(DomainError::ValidationError(
                "End time must be after start time".to_string(),
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
            attendees_count: req.attendees_count.unwrap_or(1),
            total_price_cents: 0,
            status: "confirmed".to_string(),
            notes: req.notes,
            created_at: now,
        };

        self.repo.create_tenant_reservation(res).await
    }

    pub async fn cancel_tenant_reservation(&self, id: Uuid) -> DomainResult<()> {
        self.repo.cancel_tenant_reservation(id).await
    }
}

