use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use rand::{rngs::OsRng, RngCore};
use serde_json::json;
use uuid::Uuid;

use crate::application::dtos::{LoginRequest, RefreshTokenRequest, RegisterRequest};
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::user::UserSummary;
use crate::presentation::middleware::auth::{AppState, AuthenticatedUser};

fn generate_csrf_token() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    hex::encode(bytes)
}

fn build_auth_cookie_headers(
    access_token: &str,
    access_ttl_seconds: i64,
    refresh_token: &str,
    cookie_secure: bool,
) -> DomainResult<HeaderMap> {
    // TODO(security): Enforce "; Secure" unconditionally once TLS terminates on local dev hosts.
    let secure_attr = if cookie_secure { "; Secure" } else { "" };
    let csrf_token = generate_csrf_token();

    let cookie_access = format!(
        "access_token={}; Path=/; HttpOnly; SameSite=Strict{}; Max-Age={}",
        access_token, secure_attr, access_ttl_seconds
    );
    let cookie_refresh = format!(
        "refresh_token={}; Path=/api/v1/auth; HttpOnly; SameSite=Strict{}; Max-Age=604800",
        refresh_token, secure_attr
    );
    let cookie_csrf = format!(
        "csrf_token={}; Path=/; SameSite=Strict{}; Max-Age=604800",
        csrf_token, secure_attr
    );

    let mut headers = HeaderMap::new();
    headers.append(
        header::SET_COOKIE,
        cookie_access.parse().map_err(|e| DomainError::Internal(format!("{}", e)))?,
    );
    headers.append(
        header::SET_COOKIE,
        cookie_refresh.parse().map_err(|e| DomainError::Internal(format!("{}", e)))?,
    );
    headers.append(
        header::SET_COOKIE,
        cookie_csrf.parse().map_err(|e| DomainError::Internal(format!("{}", e)))?,
    );
    Ok(headers)
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> DomainResult<Response> {
    let (auth_res, refresh_token) = state.auth_service.register(req).await?;
    let headers = build_auth_cookie_headers(
        &auth_res.access_token,
        auth_res.expires_in,
        &refresh_token,
        state.cookie_secure,
    )?;

    Ok((StatusCode::CREATED, headers, Json(auth_res)).into_response())
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> DomainResult<Response> {
    let (auth_res, refresh_token) = state.auth_service.login(req).await?;
    let headers = build_auth_cookie_headers(
        &auth_res.access_token,
        auth_res.expires_in,
        &refresh_token,
        state.cookie_secure,
    )?;

    Ok((StatusCode::OK, headers, Json(auth_res)).into_response())
}

pub async fn refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Option<Json<RefreshTokenRequest>>,
) -> DomainResult<Response> {
    let token = if let Some(Json(b)) = body {
        b.refresh_token
    } else if let Some(cookie_hdr) = headers.get(header::COOKIE) {
        let cookie_str = cookie_hdr.to_str().unwrap_or_default();
        crate::presentation::middleware::csrf::extract_cookie(cookie_str, "refresh_token")
            .ok_or_else(|| DomainError::Unauthorized("Refresh token missing".into()))?
    } else {
        return Err(DomainError::Unauthorized("Refresh token missing".into()));
    };

    let user_id = headers
        .get("x-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
        .ok_or_else(|| DomainError::Unauthorized("User session identifier required for refresh".into()))?;

    let (new_access, new_refresh) = state.auth_service.refresh(user_id, &token).await?;
    let ttl = state.token_provider.access_token_ttl_seconds();
    let res_headers = build_auth_cookie_headers(&new_access, ttl, &new_refresh, state.cookie_secure)?;

    Ok((
        StatusCode::OK,
        res_headers,
        Json(json!({
            "access_token": new_access,
            "expires_in": ttl
        })),
    )
        .into_response())
}

pub async fn logout(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Response> {
    state.auth_service.logout(user.id).await?;
    let secure_attr = if state.cookie_secure { "; Secure" } else { "" };

    let mut headers = HeaderMap::new();
    headers.append(
        header::SET_COOKIE,
        format!("access_token=; Path=/; HttpOnly; SameSite=Strict{}; Max-Age=0", secure_attr)
            .parse()
            .map_err(|e| DomainError::Internal(format!("{}", e)))?,
    );
    headers.append(
        header::SET_COOKIE,
        format!(
            "refresh_token=; Path=/api/v1/auth; HttpOnly; SameSite=Strict{}; Max-Age=0",
            secure_attr
        )
        .parse()
        .map_err(|e| DomainError::Internal(format!("{}", e)))?,
    );
    headers.append(
        header::SET_COOKIE,
        format!("csrf_token=; Path=/; SameSite=Strict{}; Max-Age=0", secure_attr)
            .parse()
            .map_err(|e| DomainError::Internal(format!("{}", e)))?,
    );

    Ok((StatusCode::OK, headers, Json(json!({ "message": "Successfully logged out" }))).into_response())
}

pub async fn me(
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Json<UserSummary>> {
    Ok(Json(UserSummary::from(user)))
}
