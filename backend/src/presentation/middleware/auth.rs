use axum::{
    async_trait,
    extract::{FromRef, FromRequestParts},
    http::{header, request::Parts},
};
use jsonwebtoken::{decode, DecodingKey, Validation};
use std::sync::Arc;
use uuid::Uuid;

use crate::application::auth_service::JwtClaims;
use crate::domain::{
    errors::DomainError,
    repository::UserRepository,
    user::User,
};

#[derive(Clone)]
pub struct AppState {
    pub user_repo: Arc<dyn UserRepository>,
    pub jwt_secret: String,
    pub auth_service: Arc<crate::application::AuthService>,
    pub reservation_service: Arc<crate::application::ReservationService>,
    pub parking_service: Arc<crate::application::ParkingService>,
    pub payment_service: Arc<crate::application::PaymentService>,
    pub amenity_repo: Arc<dyn crate::domain::repository::AmenityRepository>,
    pub audit_repo: Arc<dyn crate::domain::repository::AuditRepository>,
    pub admin_service: Arc<crate::application::AdminService>,
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
            let auth_str = auth_header
                .to_str()
                .map_err(|_| DomainError::Unauthorized("Invalid Authorization header format".into()))?;

            if let Some(bearer) = auth_str.strip_prefix("Bearer ") {
                bearer.trim().to_string()
            } else {
                return Err(DomainError::Unauthorized("Authorization scheme must be Bearer".into()));
            }
        } else if let Some(cookie_header) = parts.headers.get(header::COOKIE) {
            // 2. Fallback to HttpOnly cookie (__Host-access_token or access_token)
            let cookie_str = cookie_header
                .to_str()
                .map_err(|_| DomainError::Unauthorized("Invalid Cookie header".into()))?;

            let mut found = None;
            for cookie in cookie_str.split(';') {
                let mut parts = cookie.trim().splitn(2, '=');
                if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                    if k == "__Host-access_token" || k == "access_token" {
                        found = Some(v.to_string());
                        break;
                    }
                }
            }
            found.ok_or_else(|| DomainError::Unauthorized("Missing authentication token".into()))?
        } else {
            return Err(DomainError::Unauthorized("Missing authentication token".into()));
        };

        // 3. Decode & Validate JWT
        let mut validation = Validation::default();
        validation.validate_exp = true;

        let token_data = decode::<JwtClaims>(
            &token,
            &DecodingKey::from_secret(app_state.jwt_secret.as_bytes()),
            &validation,
        )
        .map_err(|e| DomainError::Unauthorized(format!("Invalid or expired token: {}", e)))?;

        let user_id = Uuid::parse_str(&token_data.claims.sub)
            .map_err(|_| DomainError::Unauthorized("Malformed token subject".into()))?;

        // 4. Load fresh user entity to verify account is still active and not deleted
        let user = app_state
            .user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| DomainError::Unauthorized("User account not found or deactivated".into()))?;

        Ok(AuthenticatedUser(user))
    }
}
