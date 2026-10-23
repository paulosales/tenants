use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use crate::domain::{
    amenity::Amenity,
    audit::AuditLog,
    errors::DomainResult,
    parking::{ParkingLayoutResponse, ParkingSpot, ParkingZone, SpotStatus},
    payment::Payment,
    reservation::{Reservation, ReservationWithDetails},
    user::User,
};

#[async_trait]
pub trait UserRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> DomainResult<Option<User>>;
    async fn find_by_email(&self, email: &str) -> DomainResult<Option<User>>;
    async fn create(&self, user: &User) -> DomainResult<User>;
    async fn update_refresh_token(
        &self,
        user_id: Uuid,
        token_hash: Option<String>,
        expires_at: Option<DateTime<Utc>>,
    ) -> DomainResult<()>;
}

#[async_trait]
pub trait AmenityRepository: Send + Sync {
    async fn list_all(&self) -> DomainResult<Vec<Amenity>>;
    async fn find_by_id(&self, id: Uuid) -> DomainResult<Option<Amenity>>;
}

#[async_trait]
pub trait ReservationRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> DomainResult<Option<Reservation>>;
    async fn find_details_by_id(&self, id: Uuid) -> DomainResult<Option<ReservationWithDetails>>;
    async fn list_by_amenity_and_range(
        &self,
        amenity_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> DomainResult<Vec<Reservation>>;
    async fn list_by_user(&self, user_id: Uuid) -> DomainResult<Vec<ReservationWithDetails>>;
    async fn create_transactional(
        &self,
        reservation: &Reservation,
    ) -> DomainResult<Reservation>;
    async fn cancel(&self, id: Uuid, user_id: Uuid) -> DomainResult<()>;
}

#[async_trait]
pub trait ParkingRepository: Send + Sync {
    async fn list_zones(&self) -> DomainResult<Vec<ParkingZone>>;
    async fn get_zone_layout(&self, zone_id: Uuid) -> DomainResult<Option<ParkingLayoutResponse>>;
    async fn find_spot_by_id(&self, spot_id: Uuid) -> DomainResult<Option<ParkingSpot>>;
    async fn update_spot_status(
        &self,
        spot_id: Uuid,
        status: SpotStatus,
        tenant_id: Option<Uuid>,
    ) -> DomainResult<()>;
    async fn upsert_spot(&self, spot: &ParkingSpot) -> DomainResult<ParkingSpot>;
    async fn save_svg_layout(&self, zone_id: Uuid, svg_markup: &str) -> DomainResult<()>;
}

#[async_trait]
pub trait PaymentRepository: Send + Sync {
    async fn create(&self, payment: &Payment) -> DomainResult<Payment>;
    async fn find_by_stripe_pi(&self, stripe_pi: &str) -> DomainResult<Option<Payment>>;
    async fn update_status(&self, id: Uuid, status: &str) -> DomainResult<()>;
}

#[async_trait]
pub trait AuditRepository: Send + Sync {
    async fn record(&self, log: &AuditLog) -> DomainResult<()>;
    async fn list_recent(&self, limit: i64) -> DomainResult<Vec<AuditLog>>;
}
