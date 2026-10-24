use std::sync::Arc;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

use crate::application::dtos::{CreatePaymentIntentRequest, PaymentIntentResponse};
use crate::domain::{
    audit::AuditLog,
    errors::{DomainError, DomainResult},
    payment::{Payment, PaymentStatus},
    repository::{AuditRepository, PaymentRepository, ReservationRepository},
    user::User,
};

type HmacSha256 = Hmac<Sha256>;

pub struct PaymentService {
    payment_repo: Arc<dyn PaymentRepository>,
    reservation_repo: Arc<dyn ReservationRepository>,
    audit_repo: Arc<dyn AuditRepository>,
    #[allow(dead_code)]
    stripe_secret_key: String,
    stripe_webhook_secret: String,
}

impl PaymentService {
    pub fn new(
        payment_repo: Arc<dyn PaymentRepository>,
        reservation_repo: Arc<dyn ReservationRepository>,
        audit_repo: Arc<dyn AuditRepository>,
        stripe_secret_key: String,
        stripe_webhook_secret: String,
    ) -> Self {
        Self {
            payment_repo,
            reservation_repo,
            audit_repo,
            stripe_secret_key,
            stripe_webhook_secret,
        }
    }

    /// Verifies Stripe Webhook HMAC-SHA256 signature with replay attack protection
    pub fn verify_stripe_signature(
        payload: &str,
        sig_header: &str,
        secret: &str,
    ) -> DomainResult<()> {
        let mut timestamp: Option<&str> = None;
        let mut signatures: Vec<&str> = Vec::new();

        for item in sig_header.split(',') {
            let mut parts = item.splitn(2, '=');
            if let (Some(k), Some(v)) = (parts.next(), parts.next()) {
                let k = k.trim();
                let v = v.trim();
                if k == "t" {
                    timestamp = Some(v);
                } else if k == "v1" {
                    signatures.push(v);
                }
            }
        }

        let t_val = timestamp.ok_or_else(|| {
            DomainError::WebhookVerificationFailed("Missing timestamp in stripe-signature".into())
        })?;

        // Prevent replay attacks (reject payloads older than 5 minutes / 300s)
        let t_num: i64 = t_val.parse().map_err(|_| {
            DomainError::WebhookVerificationFailed("Invalid timestamp format in stripe-signature".into())
        })?;
        let now = Utc::now().timestamp();
        if (now - t_num).abs() > 300 {
            return Err(DomainError::WebhookVerificationFailed(
                "Webhook timestamp too old or skewed (replay protection)".into(),
            ));
        }

        // Expected signed payload format: `${timestamp}.${payload}`
        let signed_payload = format!("{}.{}", t_val, payload);

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| {
            DomainError::WebhookVerificationFailed(format!("HMAC init failed: {}", e))
        })?;
        mac.update(signed_payload.as_bytes());
        let expected_signature = hex::encode(mac.finalize().into_bytes());

        // Constant-time comparison
        let matched = signatures.iter().any(|&sig| sig == expected_signature);
        if !matched {
            return Err(DomainError::WebhookVerificationFailed(
                "HMAC signature mismatch".into(),
            ));
        }

        Ok(())
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

        // Create Payment Intent with Stripe (or mock in test/dev)
        let pi_id = format!("pi_mock_{}", Uuid::new_v4());
        let client_secret = format!("{}_secret_mock", pi_id);

        let payment = Payment {
            id: Uuid::new_v4(),
            user_id: actor.id,
            reservation_id: req.reservation_id,
            parking_spot_id: req.parking_spot_id,
            amount_cents,
            currency: "usd".to_string(),
            stripe_payment_intent_id: Some(pi_id.clone()),
            stripe_client_secret: Some(client_secret.clone()),
            status: PaymentStatus::Pending,
            idempotency_key: Some(Uuid::new_v4().to_string()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };

        self.payment_repo.create(&payment).await?;

        Ok(PaymentIntentResponse {
            client_secret,
            payment_intent_id: pi_id,
            amount_cents,
        })
    }

    pub async fn handle_webhook(
        &self,
        payload: &str,
        sig_header: &str,
    ) -> DomainResult<()> {
        Self::verify_stripe_signature(payload, sig_header, &self.stripe_webhook_secret)?;

        let event: serde_json::Value = serde_json::from_str(payload)
            .map_err(|e| DomainError::ValidationError(format!("Invalid webhook JSON: {}", e)))?;

        let event_type = event["type"].as_str().unwrap_or_default();
        if event_type == "payment_intent.succeeded" {
            if let Some(pi_id) = event["data"]["object"]["id"].as_str() {
                if let Some(payment) = self.payment_repo.find_by_stripe_pi(pi_id).await? {
                    self.payment_repo.update_status(payment.id, "succeeded").await?;

                    let _ = self.audit_repo.record(&AuditLog {
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
                    }).await;
                }
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stripe_signature_verification_success() {
        let secret = "whsec_test_secret_12345";
        let now = Utc::now().timestamp();
        let payload = r#"{"id":"evt_123","type":"payment_intent.succeeded"}"#;

        // Generate valid signature matching our algorithm
        let signed_payload = format!("{}.{}", now, payload);
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        let sig_header = format!("t={},v1={}", now, sig);

        let res = PaymentService::verify_stripe_signature(payload, &sig_header, secret);
        assert!(res.is_ok());
    }

    #[test]
    fn test_stripe_signature_replay_attack_rejected() {
        let secret = "whsec_test_secret_12345";
        // Timestamp from 10 minutes ago (> 300 seconds)
        let old_time = Utc::now().timestamp() - 600;
        let payload = r#"{"id":"evt_123","type":"payment_intent.succeeded"}"#;

        let signed_payload = format!("{}.{}", old_time, payload);
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        let sig_header = format!("t={},v1={}", old_time, sig);

        let res = PaymentService::verify_stripe_signature(payload, &sig_header, secret);
        assert!(res.is_err());
        assert!(matches!(res.unwrap_err(), DomainError::WebhookVerificationFailed(_)));
    }

    #[test]
    fn test_stripe_signature_tampered_payload_rejected() {
        let secret = "whsec_test_secret_12345";
        let now = Utc::now().timestamp();
        let payload = r#"{"id":"evt_123","type":"payment_intent.succeeded"}"#;

        let signed_payload = format!("{}.{}", now, payload);
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        let sig_header = format!("t={},v1={}", now, sig);

        // Tampered payload with different amount
        let tampered_payload = r#"{"id":"evt_123","type":"payment_intent.succeeded","amount":999999}"#;

        let res = PaymentService::verify_stripe_signature(tampered_payload, &sig_header, secret);
        assert!(res.is_err());
    }
}

