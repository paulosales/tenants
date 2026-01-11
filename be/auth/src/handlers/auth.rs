use axum::{Json, response::IntoResponse, http::StatusCode};
use crate::models::{GoogleLoginRequest, AuthResponse};
use crate::services::token;


pub async fn exchange_google_token(
    Json(payload): Json<GoogleLoginRequest>,
) -> impl IntoResponse {

    match token::verify_google_access_token(&payload.id_token).await {
        Ok(response) => {
            let access_token = token::generate_access_token(&response.sub).await.unwrap_or_default();
            let refresh_token = token::generate_refresh_token(&response.sub).await.unwrap_or_default();

            let response = AuthResponse {
                access_token,
                refresh_token,
            };
            (StatusCode::OK, Json(response)).into_response()
        }
        Err(err_msg) => {
            (StatusCode::UNAUTHORIZED, Json(err_msg)).into_response()
        }
    }
}