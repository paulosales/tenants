use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use crate::application::dtos::{CreatePaymentIntentRequest, PaymentIntentResponse};
use crate::domain::{
    audit::AuditLog,
    errors::{DomainError, DomainResult},
    payment::{Payment, PaymentStatus},
    ports::PaymentGateway,
    repository::{AuditRepository, PaymentRepository, ReservationRepository},
    user::User,
};

pub struct PaymentService {
    payment_repo: Arc<dyn PaymentRepository>,
    reservation_repo: Arc<dyn ReservationRepository>,
    audit_repo: Arc<dyn AuditRepository>,
    gateway: Arc<dyn PaymentGateway>,
}

impl PaymentService {
    pub fn new(
        payment_repo: Arc<dyn PaymentRepository>,
        reservation_repo: Arc<dyn ReservationRepository>,
        audit_repo: Arc<dyn AuditRepository>,
        gateway: Arc<dyn PaymentGateway>,
    ) -> Self {
        Self {
            payment_repo,
            reservation_repo,
            audit_repo,
            gateway,
        }
    }

    pub async fn create_payment_intent(
        &self,
        actor: &User,
        req: CreatePaymentIntentRequest,
    ) -> DomainResult<PaymentIntentResponse> {
        let amount_cents = if let Some(res_id) = req.reservation_id {
            let res = self
                .reservation_repo
                .find_by_id(res_id)
                .await?
                .ok_or_else(|| DomainError::NotFound("Reservation not found".into()))?;

            if res.user_id != actor.id && !actor.role.can_manage_properties() {
                return Err(DomainError::Forbidden);
            }
            res.total_price_cents
        } else {
            // Default flat rate or spot fee
            2500
        };

        let currency = "usd";
        let intent = self
            .gateway
            .create_payment_intent(amount_cents, currency)
            .await?;

        let payment = Payment {
            id: Uuid::new_v4(),
            user_id: actor.id,
            reservation_id: req.reservation_id,
            parking_spot_id: req.parking_spot_id,
            amount_cents,
            currency: currency.to_string(),
            stripe_payment_intent_id: Some(intent.payment_intent_id.clone()),
            stripe_client_secret: Some(intent.client_secret.clone()),
            status: PaymentStatus::Pending,
            idempotency_key: Some(Uuid::new_v4().to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.payment_repo.create(&payment).await?;

        Ok(PaymentIntentResponse {
            client_secret: intent.client_secret,
            payment_intent_id: intent.payment_intent_id,
            amount_cents,
        })
    }

    pub async fn handle_webhook(&self, payload: &str, sig_header: &str) -> DomainResult<()> {
        self.gateway.verify_webhook_signature(payload, sig_header)?;

        let event: serde_json::Value = serde_json::from_str(payload)
            .map_err(|e| DomainError::ValidationError(format!("Invalid webhook JSON: {}", e)))?;

        let event_type = event["type"].as_str().unwrap_or_default();
        if event_type == "payment_intent.succeeded" {
            if let Some(pi_id) = event["data"]["object"]["id"].as_str() {
                if let Some(payment) = self.payment_repo.find_by_stripe_pi(pi_id).await? {
                    self.payment_repo.update_status(payment.id, "succeeded").await?;

                    let _ = self
                        .audit_repo
                        .record(&AuditLog {
                            id: Uuid::new_v4(),
                            actor_id: None,
                            actor_email: Some("system@stripe.webhook".into()),
                            action: "PAYMENT_SUCCEEDED".to_string(),
                            entity_type: "payment".to_string(),
                            entity_id: Some(payment.id),
                            old_values: Some(serde_json::json!({ "status": "pending" })),
                            new_values: Some(serde_json::json!({ "status": "succeeded" })),
                            ip_address: None,
                            user_agent: Some("Stripe-Webhook".into()),
                            created_at: Utc::now(),
                        })
                        .await;
                }
            }
        }

        Ok(())
    }
}
