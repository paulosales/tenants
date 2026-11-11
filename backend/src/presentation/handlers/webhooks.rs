use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::domain::errors::{DomainError, DomainResult};
use crate::presentation::middleware::auth::AppState;

pub async fn stripe_webhook(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: String,
) -> DomainResult<impl IntoResponse> {
    let sig_header = headers
        .get("stripe-signature")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            DomainError::WebhookVerificationFailed("Missing stripe-signature header".into())
        })?;

    state
        .payment_service
        .handle_webhook(&body, sig_header)
        .await?;

    Ok((StatusCode::OK, Json(json!({ "received": true }))))
}
