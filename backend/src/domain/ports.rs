use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::{
    errors::DomainResult,
    user::{Role, User},
};

/// Domain claims embedded in verified access tokens.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenClaims {
    pub sub: String,
    pub email: String,
    pub role: Role,
    #[serde(default)]
    pub property_id: Option<Uuid>,
    #[serde(default)]
    pub tenant_id: Option<Uuid>,
    #[serde(default)]
    pub staff_id: Option<Uuid>,
    pub exp: i64,
    pub iat: i64,
    pub jti: String,
}

/// Port for password / secret hashing (DIP: application layer depends on abstraction, not Argon2 directly).
pub trait PasswordHasher: Send + Sync {
    fn hash(&self, password: &str) -> DomainResult<String>;
    fn verify(&self, password: &str, hash: &str) -> bool;
}

/// Port for issuing and verifying authentication tokens (DIP: swaps JWT signing without changing AuthService or middleware).
pub trait TokenProvider: Send + Sync {
    fn generate_access_token(&self, user: &User) -> DomainResult<String>;
    fn verify_access_token(&self, token: &str) -> DomainResult<TokenClaims>;
    fn generate_refresh_token(&self) -> String;
    fn access_token_ttl_seconds(&self) -> i64;
}

/// Port for sanitizing untrusted SVG garage layouts (DIP).
pub trait SvgSanitizerPort: Send + Sync {
    fn sanitize(&self, raw_svg: &str) -> DomainResult<String>;
}

/// Output returned by a PaymentGateway when creating an intent.
#[derive(Debug, Clone)]
pub struct GatewayPaymentIntent {
    pub payment_intent_id: String,
    pub client_secret: String,
}

/// Port for external payment providers (OCP + DIP: swap Mock / Stripe / other gateways without editing PaymentService).
#[async_trait]
pub trait PaymentGateway: Send + Sync {
    async fn create_payment_intent(
        &self,
        amount_cents: i32,
        currency: &str,
    ) -> DomainResult<GatewayPaymentIntent>;

    fn verify_webhook_signature(&self, payload: &str, sig_header: &str) -> DomainResult<()>;
}

