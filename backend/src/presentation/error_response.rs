use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::domain::errors::DomainError;

impl IntoResponse for DomainError {
    fn into_response(self) -> Response {
        let (status, title, detail) = match self {
            DomainError::NotFound(msg) => (
                StatusCode::NOT_FOUND,
                "Resource Not Found",
                msg,
            ),
            DomainError::ReservationConflict => (
                StatusCode::CONFLICT,
                "Reservation Conflict",
                "The requested amenity time slot has already been reserved. Please select another time.".to_string(),
            ),
            DomainError::Conflict(msg) => (
                StatusCode::CONFLICT,
                "Conflict",
                msg,
            ),
            DomainError::OutsideOperatingHours { open_time, close_time } => (
                StatusCode::BAD_REQUEST,
                "Outside Operating Hours",
                format!("Requested reservation time is outside operating hours ({} to {})", open_time, close_time),
            ),
            DomainError::InvalidDuration { duration_mins, min_mins, max_mins } => (
                StatusCode::BAD_REQUEST,
                "Invalid Duration",
                format!("Reservation duration of {}m is invalid (allowed: {}m - {}m)", duration_mins, min_mins, max_mins),
            ),
            DomainError::SpotUnavailable(spot) => (
                StatusCode::CONFLICT,
                "Parking Spot Unavailable",
                format!("Parking spot {} is occupied, reserved, or under maintenance", spot),
            ),
            DomainError::InvalidSvgMarkup(err) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "Invalid SVG Markup",
                format!("SVG failed strict sanitization: {}", err),
            ),
            DomainError::InvalidCredentials => (
                StatusCode::UNAUTHORIZED,
                "Authentication Failed",
                "Invalid email or password".to_string(),
            ),
            DomainError::Unauthorized(msg) => (
                StatusCode::UNAUTHORIZED,
                "Unauthorized",
                msg,
            ),
            DomainError::Forbidden => (
                StatusCode::FORBIDDEN,
                "Forbidden",
                "You do not have permission to perform this action".to_string(),
            ),
            DomainError::ValidationError(msg) => (
                StatusCode::UNPROCESSABLE_ENTITY,
                "Validation Error",
                msg,
            ),
            DomainError::PaymentError(msg) => (
                StatusCode::PAYMENT_REQUIRED,
                "Payment Processing Error",
                msg,
            ),
            DomainError::WebhookVerificationFailed(msg) => (
                StatusCode::BAD_REQUEST,
                "Webhook Signature Invalid",
                msg,
            ),
            DomainError::RateLimitExceeded(retry_after) => (
                StatusCode::TOO_MANY_REQUESTS,
                "Rate Limit Exceeded",
                format!("Too many requests. Please retry after {} seconds.", retry_after),
            ),
            DomainError::Internal(msg) => {
                tracing::error!("Internal server error: {}", msg);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Internal Server Error",
                    "An unexpected error occurred. Please contact system support.".to_string(),
                )
            }
        };

        let body = Json(json!({
            "type": "about:blank",
            "title": title,
            "status": status.as_u16(),
            "detail": detail,
        }));

        (status, body).into_response()
    }
}
