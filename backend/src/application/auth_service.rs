use std::sync::Arc;
use chrono::{DateTime, Duration, Utc};
use uuid::Uuid;

use crate::application::dtos::{AuthResponse, LoginRequest, RegisterRequest};
use crate::domain::{
    errors::{DomainError, DomainResult},
    ports::{PasswordHasher, TokenProvider},
    repository::UserRepository,
    user::{Role, User, UserSummary},
};

pub use crate::domain::ports::TokenClaims as JwtClaims;

pub struct AuthService {
    user_repo: Arc<dyn UserRepository>,
    password_hasher: Arc<dyn PasswordHasher>,
    token_provider: Arc<dyn TokenProvider>,
    refresh_token_exp_seconds: i64,
}

impl AuthService {
    pub fn new(
        user_repo: Arc<dyn UserRepository>,
        password_hasher: Arc<dyn PasswordHasher>,
        token_provider: Arc<dyn TokenProvider>,
        refresh_token_exp_seconds: i64,
    ) -> Self {
        Self {
            user_repo,
            password_hasher,
            token_provider,
            refresh_token_exp_seconds,
        }
    }

    fn issue_refresh_token_pair(&self) -> DomainResult<(String, String, DateTime<Utc>)> {
        let refresh_token = self.token_provider.generate_refresh_token();
        let refresh_hash = self.password_hasher.hash(&refresh_token)?;
        let expires_at = Utc::now() + Duration::seconds(self.refresh_token_exp_seconds);
        Ok((refresh_token, refresh_hash, expires_at))
    }

    pub async fn register(&self, req: RegisterRequest) -> DomainResult<(AuthResponse, String)> {
        if self.user_repo.find_by_email(&req.email).await?.is_some() {
            return Err(DomainError::ValidationError("A user with this email already exists".into()));
        }

        let password_hash = self.password_hasher.hash(&req.password)?;
        let (refresh_token, refresh_token_hash, refresh_expires) = self.issue_refresh_token_pair()?;

        let new_user = User {
            id: Uuid::new_v4(),
            email: req.email.to_lowercase().trim().to_string(),
            password_hash,
            full_name: req.full_name.trim().to_string(),
            // Security: Public self-registration always assigns Tenant role to prevent privilege escalation.
            role: Role::Tenant,
            phone: req.phone,
            unit_number: req.unit_number,
            property_id: None,
            tenant_id: None,
            staff_id: None,
            refresh_token_hash: Some(refresh_token_hash),
            refresh_token_expires_at: Some(refresh_expires),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let created_user = self.user_repo.create(&new_user).await?;
        let access_token = self.token_provider.generate_access_token(&created_user)?;

        let response = AuthResponse {
            user: UserSummary::from(created_user),
            access_token,
            expires_in: self.token_provider.access_token_ttl_seconds(),
        };

        Ok((response, refresh_token))
    }

    pub async fn login(&self, req: LoginRequest) -> DomainResult<(AuthResponse, String)> {
        let user = self
            .user_repo
            .find_by_email(req.email.to_lowercase().trim())
            .await?
            .ok_or(DomainError::InvalidCredentials)?;

        if !self.password_hasher.verify(&req.password, &user.password_hash) {
            return Err(DomainError::InvalidCredentials);
        }

        let (refresh_token, refresh_token_hash, refresh_expires) = self.issue_refresh_token_pair()?;

        self.user_repo
            .update_refresh_token(user.id, Some(refresh_token_hash), Some(refresh_expires))
            .await?;

        let access_token = self.token_provider.generate_access_token(&user)?;

        let response = AuthResponse {
            user: UserSummary::from(user),
            access_token,
            expires_in: self.token_provider.access_token_ttl_seconds(),
        };

        Ok((response, refresh_token))
    }

    pub async fn refresh(&self, user_id: Uuid, provided_token: &str) -> DomainResult<(String, String)> {
        let user = self
            .user_repo
            .find_by_id(user_id)
            .await?
            .ok_or_else(|| DomainError::Unauthorized("User session not found".into()))?;

        let stored_hash = user
            .refresh_token_hash
            .as_ref()
            .ok_or_else(|| DomainError::Unauthorized("No active session".into()))?;

        let expires_at = user
            .refresh_token_expires_at
            .ok_or_else(|| DomainError::Unauthorized("Refresh token expired".into()))?;

        if Utc::now() > expires_at {
            return Err(DomainError::Unauthorized("Refresh token expired".into()));
        }

        if !self.password_hasher.verify(provided_token, stored_hash) {
            // Compromise detected: invalidate all active tokens for this user immediately!
            let _ = self.user_repo.update_refresh_token(user.id, None, None).await;
            return Err(DomainError::Unauthorized("Invalid refresh token. Session revoked.".into()));
        }

        let (new_refresh_token, new_refresh_hash, new_expires) = self.issue_refresh_token_pair()?;

        self.user_repo
            .update_refresh_token(user.id, Some(new_refresh_hash), Some(new_expires))
            .await?;

        let new_access_token = self.token_provider.generate_access_token(&user)?;

        Ok((new_access_token, new_refresh_token))
    }

    pub async fn logout(&self, user_id: Uuid) -> DomainResult<()> {
        self.user_repo.update_refresh_token(user_id, None, None).await
    }
}
