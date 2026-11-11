use std::sync::{Arc, OnceLock};

use opentelemetry::{global, metrics::Counter, KeyValue};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::domain::{
    admin::{PublicPortalRepository, PublicPropertyListing},
    errors::{DomainError, DomainResult},
    ports::CachePort,
};

const PUBLIC_PORTAL_NAMESPACE: &str = "public_portal";

struct CacheMetrics {
    requests: Counter<u64>,
}

fn cache_metrics() -> &'static CacheMetrics {
    static METRICS: OnceLock<CacheMetrics> = OnceLock::new();
    METRICS.get_or_init(|| {
        let meter = global::meter("tenants-backend");
        let requests = meter
            .u64_counter("public_portal.cache.requests")
            .with_description("Cache lookups for public leasing portal endpoints")
            .build();
        CacheMetrics { requests }
    })
}

pub struct PublicPortalService {
    repo: Arc<dyn PublicPortalRepository>,
    cache: Arc<dyn CachePort>,
    ttl_seconds: u64,
    list_refresh_lock: Mutex<()>,
    detail_refresh_lock: Mutex<()>,
}

impl PublicPortalService {
    pub fn new(
        repo: Arc<dyn PublicPortalRepository>,
        cache: Arc<dyn CachePort>,
        ttl_seconds: u64,
    ) -> Self {
        Self {
            repo,
            cache,
            ttl_seconds,
            list_refresh_lock: Mutex::new(()),
            detail_refresh_lock: Mutex::new(()),
        }
    }

    fn record_metric(endpoint: &'static str, hit: bool) {
        let outcome = if hit { "hit" } else { "miss" };
        cache_metrics().requests.add(
            1,
            &[
                KeyValue::new("endpoint", endpoint),
                KeyValue::new("outcome", outcome),
            ],
        );
    }

    async fn list_cache_key(&self) -> String {
        let ver = self
            .cache
            .get_namespace_version(PUBLIC_PORTAL_NAMESPACE)
            .await;
        format!("{}:v{}:list", PUBLIC_PORTAL_NAMESPACE, ver)
    }

    async fn detail_cache_key(&self, id: Uuid) -> String {
        let ver = self
            .cache
            .get_namespace_version(PUBLIC_PORTAL_NAMESPACE)
            .await;
        format!("{}:v{}:property:{}", PUBLIC_PORTAL_NAMESPACE, ver, id)
    }

    /// Invalidates all cached public portal list and property detail snapshots in O(1).
    pub async fn invalidate_cache(&self) {
        self.cache
            .bump_namespace_version(PUBLIC_PORTAL_NAMESPACE)
            .await;
    }

    /// Returns cached public properties along with whether the result was served from cache.
    /// Uses single-flight locking on cache misses to prevent database stampedes.
    pub async fn list_public_properties_cached(
        &self,
    ) -> DomainResult<(Vec<PublicPropertyListing>, bool)> {
        if self.ttl_seconds > 0 {
            let key = self.list_cache_key().await;
            if let Some(raw) = self.cache.get_string(&key).await {
                if let Ok(parsed) = serde_json::from_str::<Vec<PublicPropertyListing>>(&raw) {
                    Self::record_metric("list", true);
                    return Ok((parsed, true));
                }
            }

            let _guard = self.list_refresh_lock.lock().await;
            // Re-check after acquiring lock under current epoch in case another waiter populated cache.
            let fresh_key = self.list_cache_key().await;
            if let Some(raw) = self.cache.get_string(&fresh_key).await {
                if let Ok(parsed) = serde_json::from_str::<Vec<PublicPropertyListing>>(&raw) {
                    Self::record_metric("list", true);
                    return Ok((parsed, true));
                }
            }

            let listings = self.repo.list_public_properties().await?;
            if let Ok(serialized) = serde_json::to_string(&listings) {
                self.cache
                    .set_string(&fresh_key, &serialized, self.ttl_seconds)
                    .await;
            }
            Self::record_metric("list", false);
            return Ok((listings, false));
        }

        let listings = self.repo.list_public_properties().await?;
        Self::record_metric("list", false);
        Ok((listings, false))
    }

    pub async fn list_public_properties(&self) -> DomainResult<Vec<PublicPropertyListing>> {
        Ok(self.list_public_properties_cached().await?.0)
    }

    pub async fn get_public_property_cached(
        &self,
        id: Uuid,
    ) -> DomainResult<(PublicPropertyListing, bool)> {
        if self.ttl_seconds > 0 {
            let key = self.detail_cache_key(id).await;
            if let Some(raw) = self.cache.get_string(&key).await {
                if let Ok(parsed) = serde_json::from_str::<PublicPropertyListing>(&raw) {
                    Self::record_metric("detail", true);
                    return Ok((parsed, true));
                }
            }

            let _guard = self.detail_refresh_lock.lock().await;
            let fresh_key = self.detail_cache_key(id).await;
            if let Some(raw) = self.cache.get_string(&fresh_key).await {
                if let Ok(parsed) = serde_json::from_str::<PublicPropertyListing>(&raw) {
                    Self::record_metric("detail", true);
                    return Ok((parsed, true));
                }
            }

            let listing = self
                .repo
                .get_public_property(id)
                .await?
                .ok_or_else(|| DomainError::NotFound("Property listing not found".into()))?;
            if let Ok(serialized) = serde_json::to_string(&listing) {
                self.cache
                    .set_string(&fresh_key, &serialized, self.ttl_seconds)
                    .await;
            }
            Self::record_metric("detail", false);
            return Ok((listing, false));
        }

        let listing = self
            .repo
            .get_public_property(id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Property listing not found".into()))?;
        Self::record_metric("detail", false);
        Ok((listing, false))
    }

    pub async fn get_public_property(&self, id: Uuid) -> DomainResult<PublicPropertyListing> {
        Ok(self.get_public_property_cached(id).await?.0)
    }
}
