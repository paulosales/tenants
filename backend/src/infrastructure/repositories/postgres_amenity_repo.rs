use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{
    amenity::Amenity,
    errors::{DomainError, DomainResult},
    repository::AmenityRepository,
};

pub struct PostgresAmenityRepository {
    pool: PgPool,
}

impl PostgresAmenityRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl AmenityRepository for PostgresAmenityRepository {
    async fn list_all(&self) -> DomainResult<Vec<Amenity>> {
        let amenities = sqlx::query_as::<_, Amenity>(
            r#"
            SELECT id, property_id, name, description, capacity,
                   COALESCE(NULLIF(hourly_rate_cents, 0), fee_cents) as hourly_rate_cents,
                   min_duration_minutes, max_duration_minutes,
                   open_time_minutes, close_time_minutes,
                   is_active, created_at, updated_at, deleted_at
            FROM amenities
            WHERE is_active = TRUE AND deleted_at IS NULL
            ORDER BY name ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list amenities: {}", e)))?;

        Ok(amenities)
    }

    async fn find_by_id(&self, id: Uuid) -> DomainResult<Option<Amenity>> {
        let amenity = sqlx::query_as::<_, Amenity>(
            r#"
            SELECT id, property_id, name, description, capacity,
                   COALESCE(NULLIF(hourly_rate_cents, 0), fee_cents) as hourly_rate_cents,
                   min_duration_minutes, max_duration_minutes,
                   open_time_minutes, close_time_minutes,
                   is_active, created_at, updated_at, deleted_at
            FROM amenities
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to find amenity: {}", e)))?;

        Ok(amenity)
    }
}
