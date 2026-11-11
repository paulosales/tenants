use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReservationStatus {
    PendingPayment,
    Confirmed,
    Cancelled,
    Completed,
}

impl std::fmt::Display for ReservationStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ReservationStatus::PendingPayment => "pending_payment",
            ReservationStatus::Confirmed => "confirmed",
            ReservationStatus::Cancelled => "cancelled",
            ReservationStatus::Completed => "completed",
        };
        f.write_str(s)
    }
}

impl From<String> for ReservationStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending_payment" => ReservationStatus::PendingPayment,
            "confirmed" => ReservationStatus::Confirmed,
            "cancelled" => ReservationStatus::Cancelled,
            "completed" => ReservationStatus::Completed,
            _ => ReservationStatus::Confirmed,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reservation {
    pub id: Uuid,
    pub amenity_id: Uuid,
    pub user_id: Uuid,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub total_price_cents: i32,
    pub status: ReservationStatus,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReservationWithDetails {
    pub id: Uuid,
    pub amenity_id: Uuid,
    pub amenity_name: String,
    pub user_id: Uuid,
    pub user_name: String,
    pub user_email: String,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub total_price_cents: i32,
    pub status: ReservationStatus,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}
