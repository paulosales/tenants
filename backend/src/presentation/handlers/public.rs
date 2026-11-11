use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use serde_json::json;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::{
    application::admin_service::CreateTenancyApplicationRequest,
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::AppState,
};

const PUBLIC_CACHE_CONTROL: &str = "public, max-age=60, stale-while-revalidate=300";

fn build_etag(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    format!("\"{}\"", hex::encode(&digest[..8]))
}

fn header_matches_etag(req_headers: &HeaderMap, etag: &str) -> bool {
    let Some(raw) = req_headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
    else {
        return false;
    };
    raw.split(',').any(|candidate| {
        let trimmed = candidate.trim();
        let unweakened = trimmed.strip_prefix("W/").unwrap_or(trimmed).trim();
        unweakened == etag || trimmed == "*"
    })
}

fn build_cached_json_response<T: Serialize>(
    req_headers: &HeaderMap,
    payload: &T,
    cache_hit: bool,
) -> DomainResult<Response> {
    let bytes = serde_json::to_vec(payload)
        .map_err(|e| DomainError::Internal(format!("Failed to serialize public listing: {}", e)))?;
    let etag = build_etag(&bytes);
    let cache_status = if cache_hit { "HIT" } else { "MISS" };

    let mut headers = HeaderMap::new();
    headers.insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );
    headers.insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static(PUBLIC_CACHE_CONTROL),
    );
    headers.insert("x-cache", HeaderValue::from_static(cache_status));
    if let Ok(etag_val) = HeaderValue::from_str(&etag) {
        headers.insert(header::ETAG, etag_val);
    }

    if header_matches_etag(req_headers, &etag) {
        return Ok((StatusCode::NOT_MODIFIED, headers).into_response());
    }

    Ok((StatusCode::OK, headers, bytes).into_response())
}

/// Unauthenticated portal endpoint exposing non-PII property summaries and vacant unit options.
/// Served from Redis cache-aside (`X-Cache: HIT|MISS`) with `ETag` (`304 Not Modified`) support.
pub async fn list_public_properties(
    State(state): State<AppState>,
    req_headers: HeaderMap,
) -> DomainResult<Response> {
    let (listings, cache_hit) = state.admin_service.list_public_properties_cached().await?;
    build_cached_json_response(&req_headers, &listings, cache_hit)
}

/// Unauthenticated endpoint exposing rich property showcase details, features, CDN photos, and suites.
pub async fn get_public_property(
    State(state): State<AppState>,
    req_headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let (listing, cache_hit) = state.admin_service.get_public_property_cached(id).await?;
    build_cached_json_response(&req_headers, &listing, cache_hit)
}

/// Unauthenticated endpoint allowing prospective residents to apply for tenancy,
/// automatically routing the application to the property manager(s) of the chosen building.
pub async fn submit_public_application(
    State(state): State<AppState>,
    Json(req): Json<CreateTenancyApplicationRequest>,
) -> DomainResult<Response> {
    let receipt = state.admin_service.submit_public_application(req).await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "application": receipt.application,
            "managers_notified": receipt.managers_notified,
            "message": "Your tenancy application has been submitted and routed to the property management team."
        })),
    )
        .into_response())
}
