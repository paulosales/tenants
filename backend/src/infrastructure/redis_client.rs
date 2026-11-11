use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

use crate::domain::errors::DomainResult;

const MAX_IN_MEMORY_KEYS: usize = 8192;

#[derive(Debug, Clone, Copy)]
pub struct RateLimitDecision {
    pub allowed: bool,
    pub retry_after_seconds: u64,
}

#[derive(Clone)]
pub struct RedisRateLimiter {
    connection_manager: Arc<Mutex<Option<ConnectionManager>>>,
    memory_windows: Arc<Mutex<HashMap<String, (i64, Instant)>>>,
}

impl RedisRateLimiter {
    pub async fn new(redis_url: &str) -> Self {
        let client = match redis::Client::open(redis_url) {
            Ok(c) => match ConnectionManager::new(c).await {
                Ok(cm) => Some(cm),
                Err(e) => {
                    tracing::warn!("Redis connection failed during startup (using in-memory rate-limit fallback): {}", e);
                    None
                }
            },
            Err(e) => {
                tracing::warn!("Invalid Redis URL (using in-memory rate-limit fallback): {}", e);
                None
            }
        };

        Self {
            connection_manager: Arc::new(Mutex::new(client)),
            memory_windows: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn in_memory() -> Self {
        Self {
            connection_manager: Arc::new(Mutex::new(None)),
            memory_windows: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn check_in_memory(
        &self,
        key: &str,
        max_requests: i64,
        window_seconds: u64,
    ) -> RateLimitDecision {
        let now = Instant::now();
        let window_duration = Duration::from_secs(window_seconds.max(1));
        let mut store = self.memory_windows.lock().await;

        if store.len() >= MAX_IN_MEMORY_KEYS {
            store.retain(|_, (_, expires_at)| *expires_at > now);
            if store.len() >= MAX_IN_MEMORY_KEYS {
                store.clear();
            }
        }

        let entry = store
            .entry(key.to_string())
            .or_insert((0, now + window_duration));

        if now >= entry.1 {
            *entry = (1, now + window_duration);
            return RateLimitDecision {
                allowed: true,
                retry_after_seconds: 0,
            };
        }

        entry.0 += 1;
        if entry.0 <= max_requests {
            RateLimitDecision {
                allowed: true,
                retry_after_seconds: 0,
            }
        } else {
            let remaining = entry.1.saturating_duration_since(now).as_secs().max(1);
            RateLimitDecision {
                allowed: false,
                retry_after_seconds: remaining,
            }
        }
    }

    /// Fixed-window rate limiter backed by Redis with bounded in-memory fallback.
    pub async fn check_rate_limit_decision(
        &self,
        key: &str,
        max_requests: i64,
        window_seconds: u64,
    ) -> DomainResult<RateLimitDecision> {
        let window_secs = window_seconds.max(1);
        let mut guard = self.connection_manager.lock().await;

        if let Some(ref mut conn) = *guard {
            let redis_key = format!("ratelimit:{}", key);
            match conn.incr::<_, _, i64>(&redis_key, 1).await {
                Ok(count) => {
                    if count == 1 {
                        let _ = conn.expire::<_, ()>(&redis_key, window_secs as i64).await;
                    }
                    if count <= max_requests {
                        return Ok(RateLimitDecision {
                            allowed: true,
                            retry_after_seconds: 0,
                        });
                    }
                    let ttl: i64 = conn.ttl(&redis_key).await.unwrap_or(window_secs as i64);
                    return Ok(RateLimitDecision {
                        allowed: false,
                        retry_after_seconds: ttl.max(1) as u64,
                    });
                }
                Err(e) => {
                    tracing::warn!("Redis rate-limit check failed (falling back to memory): {}", e);
                }
            }
        }
        drop(guard);

        Ok(self.check_in_memory(key, max_requests, window_secs).await)
    }

    /// Convenience wrapper returning whether the request is permitted.
    pub async fn check_rate_limit(
        &self,
        key: &str,
        max_requests: i64,
        window_seconds: u64,
    ) -> DomainResult<bool> {
        Ok(self
            .check_rate_limit_decision(key, max_requests, window_seconds)
            .await?
            .allowed)
    }
}
