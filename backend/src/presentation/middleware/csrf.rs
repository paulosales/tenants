use axum::{
    extract::Request,
    http::{header, Method},
    middleware::Next,
    response::Response,
};

use crate::domain::errors::DomainError;

pub fn extract_cookie(cookie_header: &str, name: &str) -> Option<String> {
    for raw in cookie_header.split(';') {
        let mut parts = raw.trim().splitn(2, '=');
        if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
            if k == name && !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    None
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Double-submit CSRF protection for cookie-authenticated mutating API calls.
/// Exempts safe HTTP methods, explicit Bearer-token clients (mobile/CLI),
/// and pre-authentication / public intake endpoints.
pub async fn csrf_protection_middleware(req: Request, next: Next) -> Result<Response, DomainError> {
    let method = req.method().clone();
    if matches!(
        method,
        Method::GET | Method::HEAD | Method::OPTIONS | Method::TRACE
    ) {
        return Ok(next.run(req).await);
    }

    // Explicit Authorization: Bearer requests cannot be auto-attached cross-site by browsers
    if req.headers().contains_key(header::AUTHORIZATION) {
        return Ok(next.run(req).await);
    }

    let path = req.uri().path();
    let is_exempt = matches!(
        path,
        "/api/v1/auth/login" | "/api/v1/auth/register" | "/api/v1/webhooks/stripe"
    ) || path.starts_with("/api/v1/public/");

    if is_exempt {
        return Ok(next.run(req).await);
    }

    let cookie_header = req
        .headers()
        .get(header::COOKIE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();

    let has_session_cookie = extract_cookie(cookie_header, "access_token").is_some()
        || extract_cookie(cookie_header, "__Host-access_token").is_some()
        || extract_cookie(cookie_header, "refresh_token").is_some();

    // Unauthenticated requests without cookies will fail cleanly with 401 at auth extraction.
    if !has_session_cookie {
        return Ok(next.run(req).await);
    }

    let csrf_cookie = extract_cookie(cookie_header, "csrf_token")
        .ok_or_else(|| DomainError::Unauthorized("Missing CSRF session cookie".into()))?;
    let csrf_header = req
        .headers()
        .get("x-csrf-token")
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .ok_or(DomainError::Forbidden)?;

    if csrf_cookie.len() < 16 || !constant_time_eq(csrf_cookie.as_bytes(), csrf_header.as_bytes()) {
        return Err(DomainError::Forbidden);
    }

    Ok(next.run(req).await)
}
