use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash as Argon2ParsedHash, PasswordHasher as Argon2HasherTrait, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use rand::RngCore;
use uuid::Uuid;

use crate::domain::{
    errors::{DomainError, DomainResult},
    ports::{PasswordHasher, TokenClaims, TokenProvider},
    user::User,
};

/// Argon2id implementation of the domain `PasswordHasher` port.
#[derive(Debug, Default, Clone)]
pub struct Argon2PasswordHasher;

impl PasswordHasher for Argon2PasswordHasher {
    fn hash(&self, password: &str) -> DomainResult<String> {
        if password.len() < 8 {
            return Err(DomainError::ValidationError(
                "Password must be at least 8 characters long".into(),
            ));
        }

        let salt = SaltString::generate(&mut OsRng);
        Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map(|h| h.to_string())
            .map_err(|e| DomainError::Internal(format!("Failed to hash password: {}", e)))
    }

    fn verify(&self, password: &str, hash: &str) -> bool {
        Argon2ParsedHash::new(hash)
            .map(|parsed| Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok())
            .unwrap_or(false)
    }
}

/// JWT + CSPRNG refresh-token implementation of the domain `TokenProvider` port.
#[derive(Debug, Clone)]
pub struct JwtTokenProvider {
    secret: String,
    access_token_exp_seconds: i64,
}

impl JwtTokenProvider {
    pub fn new(secret: String, access_token_exp_seconds: i64) -> Self {
        Self {
            secret,
            access_token_exp_seconds,
        }
    }
}

impl TokenProvider for JwtTokenProvider {
    fn generate_access_token(&self, user: &User) -> DomainResult<String> {
        let now = Utc::now();
        let exp = now + Duration::seconds(self.access_token_exp_seconds);

        let claims = TokenClaims {
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
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|e| DomainError::Internal(format!("JWT generation failed: {}", e)))
    }

    fn verify_access_token(&self, token: &str) -> DomainResult<TokenClaims> {
        let mut validation = Validation::default();
        validation.validate_exp = true;

        decode::<TokenClaims>(
            token,
            &DecodingKey::from_secret(self.secret.as_bytes()),
            &validation,
        )
        .map(|data| data.claims)
        .map_err(|e| DomainError::Unauthorized(format!("Invalid or expired token: {}", e)))
    }

    fn generate_refresh_token(&self) -> String {
        let mut bytes = [0u8; 32];
        OsRng.fill_bytes(&mut bytes);
        hex::encode(bytes)
    }

    fn access_token_ttl_seconds(&self) -> i64 {
        self.access_token_exp_seconds
    }
}

