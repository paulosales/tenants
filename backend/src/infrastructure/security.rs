use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash as Argon2ParsedHash, PasswordHasher as Argon2HasherTrait, PasswordVerifier, SaltString},
    Argon2,
};
use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
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
            property_id: user.property_id,
            tenant_id: user.tenant_id,
            staff_id: user.staff_id,
            exp: exp.timestamp(),
            iat: now.timestamp(),
            jti: Uuid::new_v4().to_string(),
        };

        encode(
            &Header::new(Algorithm::HS256),
            &claims,
            &EncodingKey::from_secret(self.secret.as_bytes()),
        )
        .map_err(|e| DomainError::Internal(format!("JWT generation failed: {}", e)))
    }

    fn verify_access_token(&self, token: &str) -> DomainResult<TokenClaims> {
        // Security: Lock algorithm explicitly to HS256 to reject 'alg: none' or key-confusion attacks.
        let mut validation = Validation::new(Algorithm::HS256);
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::user::Role;

    #[test]
    fn password_hasher_round_trip_and_min_length() {
        const SEED_DEV_HASH: &str =
            "$argon2id$v=19$m=19456,t=2,p=1$Y9tk2yYGbPe7nli24xmzfA$z2srHuwDKMjfa/BuVk8jaPWFbIahDNQQgq8MEzYlscY";

        let hasher = Argon2PasswordHasher;
        assert!(hasher.hash("short").is_err());

        let hashed = hasher.hash("Password123!").expect("hash succeeds");
        assert!(hasher.verify("Password123!", &hashed));
        assert!(hasher.verify("Password123!", SEED_DEV_HASH));
        assert!(!hasher.verify("WrongPassword!", &hashed));
    }

    #[test]
    fn jwt_provider_enforces_hs256_and_expiration() {
        let provider = JwtTokenProvider::new("super_secret_test_key_at_least_32_chars".into(), 900);
        let now = Utc::now();
        let user = User {
            id: Uuid::new_v4(),
            email: "manager@property.local".into(),
            password_hash: "unused".into(),
            full_name: "Sarah Jenkins".into(),
            role: Role::PropertyManager,
            phone: None,
            unit_number: None,
            property_id: Some(Uuid::new_v4()),
            tenant_id: None,
            staff_id: Some(Uuid::new_v4()),
            refresh_token_hash: None,
            refresh_token_expires_at: None,
            created_at: now,
            updated_at: now,
            deleted_at: None,
        };

        let token = provider.generate_access_token(&user).expect("token generates");
        let claims = provider.verify_access_token(&token).expect("token verifies");
        assert_eq!(claims.role, Role::PropertyManager);
        assert_eq!(claims.email, "manager@property.local");
        assert_eq!(claims.property_id, user.property_id);

        // Tampered / alg=none token must fail
        let mut parts: Vec<&str> = token.split('.').collect();
        parts[2] = "";
        assert!(provider.verify_access_token(&parts.join(".")).is_err());
    }
}

