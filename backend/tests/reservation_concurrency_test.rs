use chrono::{Duration, Utc};
use std::sync::Arc;
use tokio::sync::Barrier;
use uuid::Uuid;

use backend::application::{CreateReservationRequest, ReservationService};
use backend::domain::{
    amenity::Amenity,
    errors::DomainError,
    repository::{AmenityRepository, AuditRepository, ReservationRepository},
    reservation::{Reservation, ReservationStatus, ReservationWithDetails},
    user::{Role, User},
};

// Concurrent Mock Repository simulating atomic GiST exclusion checking
#[derive(Clone)]
struct ConcurrentMockReservationRepo {
    // In-memory slot storage guarded by an atomic mutex to verify race conditions
    reservations: Arc<tokio::sync::Mutex<Vec<Reservation>>>,
}

impl ConcurrentMockReservationRepo {
    fn new() -> Self {
        Self {
            reservations: Arc::new(tokio::sync::Mutex::new(Vec::new())),
        }
    }
}

#[async_trait::async_trait]
impl ReservationRepository for ConcurrentMockReservationRepo {
    async fn find_by_id(&self, id: Uuid) -> Result<Option<Reservation>, DomainError> {
        let guard = self.reservations.lock().await;
        Ok(guard.iter().find(|r| r.id == id).cloned())
    }

    async fn find_details_by_id(
        &self,
        _id: Uuid,
    ) -> Result<Option<ReservationWithDetails>, DomainError> {
        Ok(None)
    }

    async fn list_by_amenity_and_range(
        &self,
        amenity_id: Uuid,
        start: chrono::DateTime<Utc>,
        end: chrono::DateTime<Utc>,
    ) -> Result<Vec<Reservation>, DomainError> {
        let guard = self.reservations.lock().await;
        let matched = guard
            .iter()
            .filter(|r| {
                r.amenity_id == amenity_id
                    && r.start_time < end
                    && r.end_time > start
                    && r.status != ReservationStatus::Cancelled
            })
            .cloned()
            .collect();
        Ok(matched)
    }

    async fn list_by_user(
        &self,
        user_id: Uuid,
    ) -> Result<Vec<ReservationWithDetails>, DomainError> {
        let guard = self.reservations.lock().await;
        let list = guard
            .iter()
            .filter(|r| r.user_id == user_id)
            .map(|r| ReservationWithDetails {
                id: r.id,
                amenity_id: r.amenity_id,
                amenity_name: "Mock Amenity".into(),
                user_id: r.user_id,
                user_name: "Mock User".into(),
                user_email: "mock@test.com".into(),
                start_time: r.start_time,
                end_time: r.end_time,
                total_price_cents: r.total_price_cents,
                status: r.status.clone(),
                notes: r.notes.clone(),
                created_at: r.created_at,
            })
            .collect();
        Ok(list)
    }

    async fn create_transactional(
        &self,
        reservation: &Reservation,
    ) -> Result<Reservation, DomainError> {
        let mut guard = self.reservations.lock().await;

        // Simulate PostgreSQL GiST EXCLUDE constraint:
        // EXCLUDE USING gist (amenity_id WITH =, reservation_period WITH &&)
        for existing in guard.iter() {
            if existing.amenity_id == reservation.amenity_id
                && existing.status != ReservationStatus::Cancelled
                && existing.start_time < reservation.end_time
                && existing.end_time > reservation.start_time
            {
                // This corresponds to SQLSTATE 23P01 exclusion violation
                return Err(DomainError::ReservationConflict);
            }
        }

        guard.push(reservation.clone());
        Ok(reservation.clone())
    }

    async fn cancel(&self, id: Uuid, _user_id: Uuid) -> Result<(), DomainError> {
        let mut guard = self.reservations.lock().await;
        if let Some(r) = guard.iter_mut().find(|r| r.id == id) {
            r.status = ReservationStatus::Cancelled;
            Ok(())
        } else {
            Err(DomainError::NotFound("Not found".into()))
        }
    }
}

struct MockAmenityRepo {
    amenity: Amenity,
}

#[async_trait::async_trait]
impl AmenityRepository for MockAmenityRepo {
    async fn list_all(&self) -> Result<Vec<Amenity>, DomainError> {
        Ok(vec![self.amenity.clone()])
    }

    async fn find_by_id(&self, id: Uuid) -> Result<Option<Amenity>, DomainError> {
        if id == self.amenity.id {
            Ok(Some(self.amenity.clone()))
        } else {
            Ok(None)
        }
    }
}

struct MockAuditRepo;

#[async_trait::async_trait]
impl AuditRepository for MockAuditRepo {
    async fn record(&self, _log: &backend::domain::audit::AuditLog) -> Result<(), DomainError> {
        Ok(())
    }

    async fn list_recent(
        &self,
        _limit: i64,
    ) -> Result<Vec<backend::domain::audit::AuditLog>, DomainError> {
        Ok(Vec::new())
    }
}

#[tokio::test]
async fn test_high_concurrency_double_booking_prevention() {
    let amenity_id = Uuid::new_v4();
    let amenity = Amenity {
        id: amenity_id,
        property_id: None,
        name: "Skyline Lounge".into(),
        description: None,
        capacity: 30,
        hourly_rate_cents: 5000,
        min_duration_minutes: 60,
        max_duration_minutes: 240,
        open_time_minutes: 0,
        close_time_minutes: 1440,
        is_active: true,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        deleted_at: None,
    };

    let reservation_repo = Arc::new(ConcurrentMockReservationRepo::new());
    let amenity_repo = Arc::new(MockAmenityRepo { amenity });
    let audit_repo = Arc::new(MockAuditRepo);

    let service = Arc::new(ReservationService::new(
        reservation_repo.clone(),
        amenity_repo,
        audit_repo,
    ));

    let concurrent_clients = 10;
    let barrier = Arc::new(Barrier::new(concurrent_clients));

    let target_start = Utc::now() + Duration::hours(24);
    let target_end = target_start + Duration::hours(2);

    let mut handles = Vec::new();

    for i in 0..concurrent_clients {
        let svc = service.clone();
        let b = barrier.clone();
        let start = target_start;
        let end = target_end;

        handles.push(tokio::spawn(async move {
            let user = User {
                id: Uuid::new_v4(),
                email: format!("client{}@test.local", i),
                password_hash: "hash".into(),
                full_name: format!("Client {}", i),
                role: Role::Tenant,
                phone: None,
                unit_number: Some("101".into()),
                property_id: None,
                tenant_id: None,
                staff_id: None,
                refresh_token_hash: None,
                refresh_token_expires_at: None,
                created_at: Utc::now(),
                updated_at: Utc::now(),
                deleted_at: None,
            };

            let req = CreateReservationRequest {
                amenity_id,
                start_time: start,
                end_time: end,
                notes: Some(format!("Concurrent booking attempt {}", i)),
            };

            // Wait for all 10 tasks to be spawned and ready at the barrier gate
            b.wait().await;

            // Fire simultaneously
            svc.create_reservation(&user, req, None, None).await
        }));
    }

    let mut success_count = 0;
    let mut conflict_count = 0;

    for handle in handles {
        match handle.await.unwrap() {
            Ok(_) => success_count += 1,
            Err(DomainError::ReservationConflict) => conflict_count += 1,
            Err(e) => panic!("Unexpected error: {:?}", e),
        }
    }

    // Exactly 1 client must succeed, and exactly 9 clients must receive DomainError::ReservationConflict!
    assert_eq!(success_count, 1, "Exactly one booking must succeed");
    assert_eq!(
        conflict_count, 9,
        "Remaining 9 attempts must receive 409 Conflict"
    );
}
