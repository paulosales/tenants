use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

use crate::domain::errors::{DomainError, DomainResult};

pub async fn create_postgres_pool(database_url: &str) -> DomainResult<PgPool> {
    PgPoolOptions::new()
        .max_connections(25)
        .min_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to connect to PostgreSQL: {}", e)))
}
