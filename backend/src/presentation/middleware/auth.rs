use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::{
    errors::DomainError, ports::TokenProvider, repository::UserRepository, user::User,
};
use crate::infrastructure::redis_client::RedisRateLimiter;

#[derive(Clone)]
pub struct AppState {
    pub user_repo: Arc<dyn UserRepository>,
    pub token_provider: Arc<dyn TokenProvider>,
    pub auth_service: Arc<crate::application::AuthService>,
    pub reservation_service: Arc<dyn crate::application::reservation_service::ReservationFacade>,
    pub parking_service: Arc<crate::application::ParkingService>,
    pub payment_service: Arc<crate::application::PaymentService>,
    pub audit_repo: Arc<dyn crate::domain::repository::AuditRepository>,
    pub admin_service: Arc<crate::application::AdminService>,
    pub rate_limiter: Arc<RedisRateLimiter>,
    pub cookie_secure: bool,
}

#[derive(Debug, Clone)]
pub struct AuthenticatedUser(pub User);

#[async_trait]
impl<S> FromRequestParts<S> for AuthenticatedUser
where
    S: Send + Sync,
    AppState: FromRef<S>,
{
    type Rejection = DomainError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        // 1. Try reading from Authorization Bearer header
        let token = if let Some(auth_header) = parts.headers.get(header::AUTHORIZATION) {
            let auth_str = auth_header.to_str().map_err(|_| {
                DomainError::Unauthorized("Invalid Authorization header format".into())
            })?;

            if let Some(bearer) = auth_str.strip_prefix("Bearer ") {
                bearer.trim().to_string()
            } else {
                return Err(DomainError::Unauthorized(
                    "Authorization scheme must be Bearer".into(),
                ));
            }
        } else if let Some(cookie_header) = parts.headers.get(header::COOKIE) {
            // 2. Fallback to HttpOnly cookie (__Host-access_token or access_token)
            let cookie_str = cookie_header
                .to_str()
                .map_err(|_| DomainError::Unauthorized("Invalid Cookie header".into()))?;

            crate::presentation::middleware::csrf::extract_cookie(cookie_str, "__Host-access_token")
                .or_else(|| {
                    crate::presentation::middleware::csrf::extract_cookie(
                        cookie_str,
                        "access_token",
                    )
                })
                .ok_or_else(|| DomainError::Unauthorized("Missing authentication token".into()))?
        } else {
            return Err(DomainError::Unauthorized(
                "Missing authentication token".into(),
            ));
        };

        // 3. Validate token via domain TokenProvider port (DIP)
        let claims = app_state.token_provider.verify_access_token(&token)?;

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| DomainError::Unauthorized("Malformed token subject".into()))?;

        // 4. Load fresh user entity to verify account is still active and not deleted
        let user = app_state
            .user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| {
                DomainError::Unauthorized("User account not found or deactivated".into())
            })?;

        Ok(AuthenticatedUser(user))
    }
}
