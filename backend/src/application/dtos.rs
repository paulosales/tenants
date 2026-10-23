use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::{
    parking::{GeometryCoordinates, ShapeType, SpotType},
    user::{Role, UserSummary},
};

// --- Auth DTOs ---

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub role: Option<Role>,
    pub unit_number: Option<String>,
    pub phone: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: UserSummary,
    pub access_token: String,
    pub expires_in: i64,
}

#[derive(Debug, Deserialize)]
pub struct RefreshTokenRequest {
    pub refresh_token: String,
}

// --- Reservation DTOs ---

#[derive(Debug, Deserialize)]
pub struct CreateReservationRequest {
    pub amenity_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CheckAvailabilityQuery {
    pub amenity_id: Uuid,
    pub start_date: DateTime<Utc>,
    pub end_date: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct AvailabilitySlot {
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub is_available: bool,
}

// --- Parking DTOs ---

#[derive(Debug, Deserialize)]
pub struct UpsertSpotRequest {
    pub zone_id: Uuid,
    pub spot_number: String,
    pub spot_type: SpotType,
    pub shape_type: ShapeType,
    pub coordinates: GeometryCoordinates,
    pub hourly_rate_cents: i32,
    pub monthly_rate_cents: i32,
}

#[derive(Debug, Deserialize)]
pub struct UpdateSvgLayoutRequest {
    pub svg_markup: String,
}

#[derive(Debug, Deserialize)]
pub struct ReserveSpotRequest {
    pub spot_id: Uuid,
}

// --- Payment DTOs ---

#[derive(Debug, Deserialize)]
pub struct CreatePaymentIntentRequest {
    pub reservation_id: Option<Uuid>,
    pub parking_spot_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct PaymentIntentResponse {
    pub client_secret: String,
    pub payment_intent_id: String,
    pub amount_cents: i32,
}
