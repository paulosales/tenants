use thiserror::Error;

#[derive(Error, Debug)]
pub enum DomainError {
    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Reservation conflict: the requested amenity time slot is already booked")]
    ReservationConflict,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Requested time is outside operating hours ({open_time} - {close_time})")]
    OutsideOperatingHours { open_time: String, close_time: String },

    #[error("Reservation duration {duration_mins}m is outside permitted limits ({min_mins}m - {max_mins}m)")]
    InvalidDuration {
        duration_mins: i64,
        min_mins: i32,
        max_mins: i32,
    },

    #[error("Parking spot {0} is currently unavailable")]
    SpotUnavailable(String),

    #[error("Invalid SVG markup: {0}")]
    InvalidSvgMarkup(String),

    #[error("Authentication failed: invalid email or password")]
    InvalidCredentials,

    #[error("Unauthorized: {0}")]
    Unauthorized(String),

    #[error("Forbidden: insufficient permissions for this operation")]
    Forbidden,

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Payment processing error: {0}")]
    PaymentError(String),

    #[error("Stripe webhook verification failed: {0}")]
    WebhookVerificationFailed(String),

    #[error("Rate limit exceeded. Please retry after {0} seconds")]
    RateLimitExceeded(u64),

    #[error("Internal domain error: {0}")]
    Internal(String),
}

pub type DomainResult<T> = Result<T, DomainError>;
