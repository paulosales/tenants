use sqlx::PgPool;

pub mod amenity_repo;
pub mod application_repo;
pub mod maintenance_repo;
pub mod message_repo;
pub mod parking_layout_repo;
pub mod property_repo;
pub mod public_portal_repo;
pub mod staff_repo;
pub mod tenant_repo;
pub mod tenant_reservation_repo;
pub mod unit_repo;
pub mod user_admin_repo;

/// PostgreSQL adapter implementing all segregated admin repository ports.
#[derive(Clone)]
pub struct PostgresAdminRepository {
    pub(crate) pool: PgPool,
}

impl PostgresAdminRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

