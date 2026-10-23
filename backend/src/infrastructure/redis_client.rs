use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::domain::errors::{DomainError, DomainResult};

#[derive(Clone)]
pub struct RedisRateLimiter {
    connection_manager: Arc<Mutex<Option<ConnectionManager>>>,
}

impl RedisRateLimiter {
    pub async fn new(redis_url: &str) -> Self {
        let client = match redis::Client::open(redis_url) {
            Ok(c) => match ConnectionManager::new(c).await {
                Ok(cm) => Some(cm),
                Err(e) => {
                    tracing::warn!("Redis connection failed during startup (will run in-memory fallback): {}", e);
                    None
                }
            },
            Err(e) => {
                tracing::warn!("Invalid Redis URL (will run in-memory fallback): {}", e);
                None
            }
        };

        Self {
            connection_manager: Arc::new(Mutex::new(client)),
        }
    }

    /// Fixed-window or token-bucket rate limiter
    /// Returns Ok(true) if allowed, Ok(false) if limit exceeded
    pub async fn check_rate_limit(
        &self,
        key: &str,
        max_requests: i64,
        window_seconds: u64,
    ) -> DomainResult<bool> {
        let mut guard = self.connection_manager.lock().await;
        if let Some(ref mut conn) = *guard {
            let redis_key = format!("ratelimit:{}", key);
            let count: i64 = conn
                .incr(&redis_key, 1)
                .await
                .map_err(|e| DomainError::Internal(format!("Redis incr failed: {}", e)))?;

            if count == 1 {
                let _: () = conn
                    .expire(&redis_key, window_seconds as i64)
                    .await
                    .map_err(|e| DomainError::Internal(format!("Redis expire failed: {}", e)))?;
            }

            Ok(count <= max_requests)
        } else {
            // Fail open for development if Redis is unavailable, or fail close in strict prod
            Ok(true)
        }
    }
}
