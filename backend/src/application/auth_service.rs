use std::sync::Arc;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::dtos::{AuthResponse, LoginRequest, RegisterRequest};
use crate::domain::{
    errors::{DomainError, DomainResult},
    repository::UserRepository,
    user::{Role, User, UserSummary},
};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JwtClaims {
    pub sub: String,       // user_id
    pub email: String,
    pub role: Role,
    pub exp: i64,          // expiration timestamp
    pub iat: i64,          // issued at
    pub jti: String,       // unique token ID
}

pub struct AuthService {
    user_repo: Arc<dyn UserRepository>,
    jwt_secret: String,
    access_token_exp_seconds: i64,
    refresh_token_exp_seconds: i64,
}

impl AuthService {
    pub fn new(
        user_repo: Arc<dyn UserRepository>,
        jwt_secret: String,
        access_token_exp_seconds: i64,
        refresh_token_exp_seconds: i64,
    ) -> Self {
        Self {
            user_repo,
            jwt_secret,
            access_token_exp_seconds,
            refresh_token_exp_seconds,
        }
    }

    pub fn hash_password(password: &str) -> DomainResult<String> {
        if password.len() < 8 {
            return Err(DomainError::ValidationError(
                "Password must be at least 8 characters long".into(),
            ));
        }

        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        let hash = argon2
            .hash_password(password.as_bytes(), &salt)
            .map_err(|e| DomainError::Internal(format!("Failed to hash password: {}", e)))?
            .to_string();

        Ok(hash)
    }

    pub fn verify_password(password: &str, hash: &str) -> bool {
        if let Ok(parsed_hash) = PasswordHash::new(hash) {
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed_hash)
                .is_ok()
        } else {
            false
        }
    }

    pub fn generate_access_token(&self, user: &User) -> DomainResult<String> {
        let now = Utc::now();
        let exp = now + Duration::seconds(self.access_token_exp_seconds);

        let claims = JwtClaims {
            sub: user.id.to_string(),
            email: user.email.clone(),
            role: user.role,
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.jwt_secret.as_bytes()),
        )
        .map_err(|e| DomainError::Internal(format!("JWT generation failed: {}", e)))
    }

    pub fn generate_refresh_token() -> String {
        let mut bytes = [0u8; 32];
        OsRng.fill_bytes(&mut bytes);
        hex::encode(bytes)
    }

    pub async fn register(&self, req: RegisterRequest) -> DomainResult<(AuthResponse, String)> {
        if let Some(_) = self.user_repo.find_by_email(&req.email).await? {
            return Err(DomainError::ValidationError("A user with this email already exists".into()));
        }

        let password_hash = Self::hash_password(&req.password)?;
        let refresh_token = Self::generate_refresh_token();
        let refresh_token_hash = Self::hash_password(&refresh_token)?;
        let refresh_expires = Utc::now() + Duration::seconds(self.refresh_token_exp_seconds);

        let new_user = User {
            id: Uuid::new_v4(),
            email: req.email.to_lowercase().trim().to_string(),
            password_hash,
            full_name: req.full_name.trim().to_string(),
            role: req.role.unwrap_or(Role::Tenant),
            phone: req.phone,
            unit_number: req.unit_number,
            refresh_token_hash: Some(refresh_token_hash),
            refresh_token_expires_at: Some(refresh_expires),
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        let created_user = self.user_repo.create(&new_user).await?;
        let access_token = self.generate_access_token(&created_user)?;

        let response = AuthResponse {
            user: UserSummary::from(created_user),
            access_token,
            expires_in: self.access_token_exp_seconds,
        };

        Ok((response, refresh_token))
    }

    pub async fn login(&self, req: LoginRequest) -> DomainResult<(AuthResponse, String)> {
        let user = self
            .user_repo
            .find_by_email(&req.email.to_lowercase().trim())
            .await?
            .ok_or(DomainError::InvalidCredentials)?;

        if !Self::verify_password(&req.password, &user.password_hash) {
            return Err(DomainError::InvalidCredentials);
        }

        // Generate rotating refresh token
        let refresh_token = Self::generate_refresh_token();
        let refresh_token_hash = Self::hash_password(&refresh_token)?;
        let refresh_expires = Utc::now() + Duration::seconds(self.refresh_token_exp_seconds);

        self.user_repo
            .update_refresh_token(user.id, Some(refresh_token_hash), Some(refresh_expires))
            .await?;

        let access_token = self.generate_access_token(&user)?;

        let response = AuthResponse {
            user: UserSummary::from(user),
            access_token,
            expires_in: self.access_token_exp_seconds,
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

        if !Self::verify_password(provided_token, stored_hash) {
            // Compromise detected: invalidate all active tokens for this user immediately!
            let _ = self.user_repo.update_refresh_token(user.id, None, None).await;
            return Err(DomainError::Unauthorized("Invalid refresh token. Session revoked.".into()));
        }

        // Rotate token
        let new_refresh_token = Self::generate_refresh_token();
        let new_refresh_hash = Self::hash_password(&new_refresh_token)?;
        let new_expires = Utc::now() + Duration::seconds(self.refresh_token_exp_seconds);

        self.user_repo
            .update_refresh_token(user.id, Some(new_refresh_hash), Some(new_expires))
            .await?;

        let new_access_token = self.generate_access_token(&user)?;

        Ok((new_access_token, new_refresh_token))
    }

    pub async fn logout(&self, user_id: Uuid) -> DomainResult<()> {
        self.user_repo.update_refresh_token(user_id, None, None).await
    }
}
