use axum::{
    body::Body,
    extract::State,
    http::{header, Method, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::presentation::middleware::auth::AppState;

fn extract_client_key(req: &Request<Body>) -> String {
    let raw_ip = req
        .headers()
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.split(',').next())
        .or_else(|| req.headers().get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("direct-client")
        .trim();

    raw_ip.chars().take(64).collect()
}

/// Applies endpoint-tier rate limiting backed by Redis (with bounded in-memory fallback).
/// Protects authentication and public intake routes against brute force and resource exhaustion.
pub async fn rate_limit_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let method = req.method().clone();
    let raw_path = req.uri().path();
    let path = raw_path.strip_prefix("/api/v1").unwrap_or(raw_path);

    let (bucket, max_requests, window_seconds) =
        if method == Method::POST && (path == "/auth/login" || path == "/auth/register") {
            ("auth", 20_i64, 60_u64)
        } else if method == Method::POST && path == "/public/applications" {
            ("public_apply", 12_i64, 60_u64)
        } else if path == "/health" {
            return next.run(req).await;
        } else {
            ("api", 300_i64, 60_u64)
        };

    let client_id = extract_client_key(&req);
    let key = format!("{}:{}", bucket, client_id);

    match state
        .rate_limiter
        .check_rate_limit_decision(&key, max_requests, window_seconds)
        .await
    {
        Ok(decision) if !decision.allowed => {
            let body = Json(json!({
                "type": "https://httpstatuses.com/429",
                "title": "Too Many Requests",
                "status": 429,
                "detail": format!(
                    "Rate limit exceeded. Please retry after {} seconds.",
                    decision.retry_after_seconds
                ),
            }));
            (
                StatusCode::TOO_MANY_REQUESTS,
                [(header::RETRY_AFTER, decision.retry_after_seconds.to_string())],
                body,
            )
                .into_response()
        }
        _ => next.run(req).await,
    }
}
