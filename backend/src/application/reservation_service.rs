use async_trait::async_trait;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::application::dtos::{CheckAvailabilityQuery, CreateReservationRequest};
use crate::domain::{
    amenity::Amenity,
    audit::AuditLog,
    errors::{DomainError, DomainResult},
    repository::{AmenityRepository, AuditRepository, ReservationRepository},
    reservation::{Reservation, ReservationStatus, ReservationWithDetails},
    user::User,
};

/// Segregated query/read port for amenity availability workflows (ISP + DIP).
#[async_trait]
pub trait AmenityAvailabilityUseCases: Send + Sync {
    async fn list_amenities_for_viewer(&self, actor: &User) -> DomainResult<Vec<Amenity>>;
    async fn get_amenity_for_viewer(&self, actor: &User, id: Uuid) -> DomainResult<Amenity>;
    async fn check_availability_for_viewer(
        &self,
        actor: &User,
        query: CheckAvailabilityQuery,
    ) -> DomainResult<Vec<Reservation>>;
}

/// Segregated command/user-history port for amenity reservations (ISP + DIP).
#[async_trait]
pub trait ReservationCommandUseCases: Send + Sync {
    async fn create_reservation(
        &self,
        actor: &User,
        req: CreateReservationRequest,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<Reservation>;
    async fn list_user_reservations(
        &self,
        user_id: Uuid,
    ) -> DomainResult<Vec<ReservationWithDetails>>;
    async fn cancel_reservation(
        &self,
        actor: &User,
        reservation_id: Uuid,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<()>;
}

/// Combined trait object exposed to presentation state so handlers never depend on concrete types (DIP).
pub trait ReservationFacade:
    AmenityAvailabilityUseCases + ReservationCommandUseCases + Send + Sync
{
}

impl<T> ReservationFacade for T where
    T: AmenityAvailabilityUseCases + ReservationCommandUseCases + Send + Sync
{
}

pub struct ReservationService {
    reservation_repo: Arc<dyn ReservationRepository>,
    amenity_repo: Arc<dyn AmenityRepository>,
    audit_repo: Arc<dyn AuditRepository>,
}

impl ReservationService {
    pub fn new(
        reservation_repo: Arc<dyn ReservationRepository>,
        amenity_repo: Arc<dyn AmenityRepository>,
        audit_repo: Arc<dyn AuditRepository>,
    ) -> Self {
        Self {
            reservation_repo,
            amenity_repo,
            audit_repo,
        }
    }

    pub async fn check_availability(
        &self,
        query: CheckAvailabilityQuery,
    ) -> DomainResult<Vec<Reservation>> {
        if query.end_date <= query.start_date {
            return Err(DomainError::ValidationError(
                "End date must be after start date".into(),
            ));
        }

        self.reservation_repo
            .list_by_amenity_and_range(query.amenity_id, query.start_date, query.end_date)
            .await
    }

    pub async fn list_amenities_for_viewer(&self, actor: &User) -> DomainResult<Vec<Amenity>> {
        let list = self.amenity_repo.list_all().await?;
        Ok(list
            .into_iter()
            .filter(|a| {
                a.property_id
                    .map(|p| actor.has_property_access(p))
                    .unwrap_or(true)
            })
            .collect())
    }

    pub async fn get_amenity_for_viewer(&self, actor: &User, id: Uuid) -> DomainResult<Amenity> {
        let amenity = self
            .amenity_repo
            .find_by_id(id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Amenity not found".into()))?;
        if let Some(pid) = amenity.property_id {
            actor.ensure_property_access(pid)?;
        }
        Ok(amenity)
    }

    /// Returns availability slots scoped to the caller's property access, with
    /// scheduler PII (`user_id`, `notes`) redacted for non-admin viewers.
    pub async fn check_availability_for_viewer(
        &self,
        actor: &User,
        query: CheckAvailabilityQuery,
    ) -> DomainResult<Vec<Reservation>> {
        let _amenity = self.get_amenity_for_viewer(actor, query.amenity_id).await?;
        let mut list = self.check_availability(query).await?;
        if !actor.role.is_admin() {
            for res in &mut list {
                if res.user_id != actor.id {
                    res.user_id = Uuid::nil();
                    res.notes = None;
                }
            }
        }
        Ok(list)
    }

    pub async fn create_reservation(
        &self,
        actor: &User,
        req: CreateReservationRequest,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<Reservation> {
        let now = Utc::now();
        if req.start_time <= now {
            return Err(DomainError::ValidationError(
                "Reservations cannot be booked in the past".into(),
            ));
        }

        let amenity = self
            .amenity_repo
            .find_by_id(req.amenity_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Amenity not found".into()))?;

        if !amenity.is_active {
            return Err(DomainError::ValidationError(
                "This amenity is currently unavailable".into(),
            ));
        }

        // Validate duration and operating hours
        amenity.validate_slot(req.start_time, req.end_time)?;

        let price_cents = amenity.calculate_price_cents(req.start_time, req.end_time);

        let reservation = Reservation {
            id: Uuid::new_v4(),
            amenity_id: req.amenity_id,
            user_id: actor.id,
            start_time: req.start_time,
            end_time: req.end_time,
            total_price_cents: price_cents,
            status: ReservationStatus::Confirmed,
            notes: req.notes,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };

        // Persist using transactional repository method; PostgreSQL GiST exclusion constraint guarantees no race condition double booking
        let created = self
            .reservation_repo
            .create_transactional(&reservation)
            .await?;

        // Audit Trail
        let _ = self
            .audit_repo
            .record(&AuditLog {
                id: Uuid::new_v4(),
                actor_id: Some(actor.id),
                actor_email: Some(actor.email.clone()),
                action: "CREATE_RESERVATION".to_string(),
                entity_type: "reservation".to_string(),
                entity_id: Some(created.id),
                old_values: None,
                new_values: Some(serde_json::to_value(&created).unwrap_or_default()),
                ip_address: client_ip,
                user_agent,
                created_at: now,
            })
            .await;

        Ok(created)
    }

    pub async fn list_user_reservations(
        &self,
        user_id: Uuid,
    ) -> DomainResult<Vec<ReservationWithDetails>> {
        self.reservation_repo.list_by_user(user_id).await
    }

    pub async fn cancel_reservation(
        &self,
        actor: &User,
        reservation_id: Uuid,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<()> {
        let reservation = self
            .reservation_repo
            .find_by_id(reservation_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Reservation not found".into()))?;

        // ABAC Check: User must own the reservation OR be PropertyManager / SuperAdmin
        if reservation.user_id != actor.id && !actor.role.can_manage_properties() {
            return Err(DomainError::Forbidden);
        }

        if reservation.status == ReservationStatus::Cancelled {
            return Err(DomainError::ValidationError(
                "Reservation is already cancelled".into(),
            ));
        }

        self.reservation_repo
            .cancel(reservation_id, actor.id)
            .await?;

        // Audit Trail
        let _ = self
            .audit_repo
            .record(&AuditLog {
                id: Uuid::new_v4(),
                actor_id: Some(actor.id),
                actor_email: Some(actor.email.clone()),
                action: "CANCEL_RESERVATION".to_string(),
                entity_type: "reservation".to_string(),
                entity_id: Some(reservation_id),
                old_values: Some(serde_json::to_value(&reservation).unwrap_or_default()),
                new_values: Some(serde_json::json!({ "status": "cancelled" })),
                ip_address: client_ip,
                user_agent,
                created_at: Utc::now(),
            })
            .await;

        Ok(())
    }
}

#[async_trait]
impl AmenityAvailabilityUseCases for ReservationService {
    async fn list_amenities_for_viewer(&self, actor: &User) -> DomainResult<Vec<Amenity>> {
        ReservationService::list_amenities_for_viewer(self, actor).await
    }

    async fn get_amenity_for_viewer(&self, actor: &User, id: Uuid) -> DomainResult<Amenity> {
        ReservationService::get_amenity_for_viewer(self, actor, id).await
    }

    async fn check_availability_for_viewer(
        &self,
        actor: &User,
        query: CheckAvailabilityQuery,
    ) -> DomainResult<Vec<Reservation>> {
        ReservationService::check_availability_for_viewer(self, actor, query).await
    }
}

#[async_trait]
impl ReservationCommandUseCases for ReservationService {
    async fn create_reservation(
        &self,
        actor: &User,
        req: CreateReservationRequest,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<Reservation> {
        ReservationService::create_reservation(self, actor, req, client_ip, user_agent).await
    }

    async fn list_user_reservations(
        &self,
        user_id: Uuid,
    ) -> DomainResult<Vec<ReservationWithDetails>> {
        ReservationService::list_user_reservations(self, user_id).await
    }

    async fn cancel_reservation(
        &self,
        actor: &User,
        reservation_id: Uuid,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<()> {
        ReservationService::cancel_reservation(self, actor, reservation_id, client_ip, user_agent)
            .await
    }
}
