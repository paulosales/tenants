use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use async_trait::async_trait;
use redis::aio::ConnectionManager;
use redis::AsyncCommands;
use tokio::sync::{Mutex, RwLock};

use crate::domain::ports::CachePort;

const MAX_LOCAL_CACHE_ENTRIES: usize = 256;

/// Distributed Redis cache adapter with automatic bounded in-memory fallback when Redis is
/// offline (such as unit tests) and O(1) namespace epoch invalidation (zero `KEYS *` scans).
#[derive(Clone)]
pub struct RedisJsonCache {
    connection_manager: Option<ConnectionManager>,
    local_entries: Arc<RwLock<HashMap<String, (String, Instant)>>>,
    local_versions: Arc<Mutex<HashMap<String, Arc<AtomicU64>>>>,
}

impl RedisJsonCache {
    pub async fn new(redis_url: &str) -> Self {
        let connection_manager = match redis::Client::open(redis_url) {
            Ok(client) => match ConnectionManager::new(client).await {
                Ok(cm) => {
                    tracing::info!("Connected Redis response cache backend.");
                    Some(cm)
                }
                Err(e) => {
                    tracing::warn!(
                        "Redis cache connection failed on startup (using bounded in-memory cache fallback): {}",
                        e
                    );
                    None
                }
            },
            Err(e) => {
                tracing::warn!(
                    "Invalid Redis cache URL (using bounded in-memory cache fallback): {}",
                    e
                );
                None
            }
        };

        Self {
            connection_manager,
            local_entries: Arc::new(RwLock::new(HashMap::new())),
            local_versions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn in_memory() -> Self {
        Self {
            connection_manager: None,
            local_entries: Arc::new(RwLock::new(HashMap::new())),
            local_versions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    async fn local_version_counter(&self, namespace: &str) -> Arc<AtomicU64> {
        let mut versions = self.local_versions.lock().await;
        versions
            .entry(namespace.to_string())
            .or_insert_with(|| Arc::new(AtomicU64::new(1)))
            .clone()
    }

    async fn get_local(&self, key: &str) -> Option<String> {
        let now = Instant::now();
        {
            let guard = self.local_entries.read().await;
            if let Some((val, expires_at)) = guard.get(key) {
                if *expires_at > now {
                    return Some(val.clone());
                }
            } else {
                return None;
            }
        }
        // Evict expired entry lazily
        let mut write_guard = self.local_entries.write().await;
        if let Some((_, expires_at)) = write_guard.get(key) {
            if *expires_at <= now {
                write_guard.remove(key);
            }
        }
        None
    }

    async fn set_local(&self, key: &str, value: &str, ttl_seconds: u64) {
        if ttl_seconds == 0 {
            return;
        }
        let now = Instant::now();
        let expires_at = now + Duration::from_secs(ttl_seconds);
        let mut guard = self.local_entries.write().await;
        if guard.len() >= MAX_LOCAL_CACHE_ENTRIES {
            guard.retain(|_, (_, exp)| *exp > now);
            if guard.len() >= MAX_LOCAL_CACHE_ENTRIES {
                guard.clear();
            }
        }
        guard.insert(key.to_string(), (value.to_string(), expires_at));
    }
}

#[async_trait]
impl CachePort for RedisJsonCache {
    async fn get_string(&self, key: &str) -> Option<String> {
        if let Some(mut conn) = self.connection_manager.clone() {
            match conn.get::<_, Option<String>>(key).await {
                Ok(Some(val)) => return Some(val),
                Ok(None) => return None,
                Err(e) => {
                    tracing::warn!(key = %key, error = %e, "Redis GET failed; falling back to local cache");
                }
            }
        }
        self.get_local(key).await
    }

    async fn set_string(&self, key: &str, value: &str, ttl_seconds: u64) {
        if ttl_seconds == 0 {
            return;
        }

        if let Some(mut conn) = self.connection_manager.clone() {
            if let Err(e) = conn.set_ex::<_, _, ()>(key, value, ttl_seconds).await {
                tracing::warn!(key = %key, error = %e, "Redis SETEX failed; caching in local memory fallback");
                self.set_local(key, value, ttl_seconds).await;
            }
            return;
        }

        self.set_local(key, value, ttl_seconds).await;
    }

    async fn get_namespace_version(&self, namespace: &str) -> u64 {
        let version_key = format!("cache:ns:{}:ver", namespace);
        if let Some(mut conn) = self.connection_manager.clone() {
            match conn.get::<_, Option<u64>>(&version_key).await {
                Ok(Some(ver)) => return ver.max(1),
                Ok(None) => {
                    let _ = conn.set_nx::<_, _, ()>(&version_key, 1u64).await;
                    return 1;
                }
                Err(e) => {
                    tracing::warn!(namespace = %namespace, error = %e, "Redis namespace GET failed; using local epoch");
                }
            }
        }

        self.local_version_counter(namespace)
            .await
            .load(Ordering::Acquire)
    }

    async fn bump_namespace_version(&self, namespace: &str) {
        let version_key = format!("cache:ns:{}:ver", namespace);
        if let Some(mut conn) = self.connection_manager.clone() {
            if let Err(e) = conn.incr::<_, _, u64>(&version_key, 1u64).await {
                tracing::warn!(namespace = %namespace, error = %e, "Redis namespace INCR failed");
            }
        }

        let counter = self.local_version_counter(namespace).await;
        counter.fetch_add(1, Ordering::AcqRel);

        let prefix = format!("{}:", namespace);
        let mut entries = self.local_entries.write().await;
        entries.retain(|k, _| !k.starts_with(&prefix));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_in_memory_cache_roundtrip_and_namespace_invalidation() {
        let cache = RedisJsonCache::in_memory();
        let v1 = cache.get_namespace_version("public_portal").await;
        assert_eq!(v1, 1);

        let key_v1 = format!("public_portal:v{}:list", v1);
        cache.set_string(&key_v1, "[{\"id\":\"1\"}]", 60).await;
        assert_eq!(
            cache.get_string(&key_v1).await.as_deref(),
            Some("[{\"id\":\"1\"}]")
        );

        cache.bump_namespace_version("public_portal").await;
        let v2 = cache.get_namespace_version("public_portal").await;
        assert_eq!(v2, 2);
        assert!(cache.get_string(&key_v1).await.is_none());
    }
}
