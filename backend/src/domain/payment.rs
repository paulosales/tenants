use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymentStatus {
    Pending,
    Succeeded,
    Failed,
    Refunded,
}

impl ToString for PaymentStatus {
    fn to_string(&self) -> String {
        match self {
            PaymentStatus::Pending => "pending".to_string(),
            PaymentStatus::Succeeded => "succeeded".to_string(),
            PaymentStatus::Failed => "failed".to_string(),
            PaymentStatus::Refunded => "refunded".to_string(),
        }
    }
}

impl From<String> for PaymentStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "pending" => PaymentStatus::Pending,
            "succeeded" => PaymentStatus::Succeeded,
            "failed" => PaymentStatus::Failed,
            "refunded" => PaymentStatus::Refunded,
            _ => PaymentStatus::Pending,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: Uuid,
    pub user_id: Uuid,
    pub reservation_id: Option<Uuid>,
    pub parking_spot_id: Option<Uuid>,
    pub amount_cents: i32,
    pub currency: String,
    pub stripe_payment_intent_id: Option<String>,
    pub stripe_client_secret: Option<String>,
    pub status: PaymentStatus,
    pub idempotency_key: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
