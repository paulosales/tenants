use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct GoogleLoginRequest {
    pub id_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppClaims {
    pub sub: String,
    pub exp: usize,
    pub iat: usize,
    pub role: String,
}
