use crate::models::AppClaims;
use chrono::{Duration, Utc, DateTime};
use jsonwebtoken::{encode, EncodingKey, Header};
use jsonwebtoken::errors::{Error as JwtError};
use google_oauth::{AsyncClient, GooglePayload, Error as GoogleOauthError};

pub async fn verify_google_access_token(google_access_token: &str) -> Result<GooglePayload, String> {
    let client_id: String = std::env::var("GOOGLE_OAUTH_CLIENT_ID").unwrap_or_default();

    let client: AsyncClient = AsyncClient::new(client_id);

    client.validate_id_token(google_access_token).await
        .map_err(|e: GoogleOauthError| format!("Failed to validate ID token: {}", e))
}

pub async fn generate_access_token(sub: &str) -> Result<String, String> {
    let exp: DateTime<Utc> = Utc::now() + Duration::minutes(5);

    generate_token(sub, exp.timestamp() as usize).await
}

pub async fn generate_refresh_token(
    sub: &str
) -> Result<String, String> {
    let refresh_exp: DateTime<Utc> = Utc::now() + Duration::days(30);

    generate_token(sub, refresh_exp.timestamp() as usize).await
}

pub async fn generate_token(
    sub: &str,
    exp: usize
) -> Result<String, String> {
    let jwt_secret = std::env::var("JWT_SECRET").unwrap_or_default();

    let claims: AppClaims = AppClaims {
        sub: sub.to_string(),
        exp: exp,
        iat: Utc::now().timestamp() as usize,
        role: "user".to_string(),
    };

    encode(&Header::default(), &claims, &EncodingKey::from_secret(jwt_secret.as_ref()))
        .map_err(|e: JwtError| format!("Failed to encode JWT: {}", e) )
}