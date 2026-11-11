use async_trait::async_trait;
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use uuid::Uuid;

use crate::domain::{
    errors::{DomainError, DomainResult},
    ports::{GatewayPaymentIntent, PaymentGateway},
};

type HmacSha256 = Hmac<Sha256>;

/// Stripe gateway adapter implementing the domain `PaymentGateway` port (OCP + DIP).
#[derive(Debug, Clone)]
pub struct StripePaymentGateway {
    #[allow(dead_code)]
    secret_key: String,
    webhook_secret: String,
}

impl StripePaymentGateway {
    pub fn new(secret_key: String, webhook_secret: String) -> Self {
        Self {
            secret_key,
            webhook_secret,
        }
    }

    /// Verifies Stripe Webhook HMAC-SHA256 signature with 300s replay attack protection.
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

        let t_num: i64 = t_val.parse().map_err(|_| {
            DomainError::WebhookVerificationFailed("Invalid timestamp format in stripe-signature".into())
        })?;
        let now = Utc::now().timestamp();
        if (now - t_num).abs() > 300 {
            return Err(DomainError::WebhookVerificationFailed(
                "Webhook timestamp too old or skewed (replay protection)".into(),
            ));
        }

        let signed_payload = format!("{}.{}", t_val, payload);

        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|e| {
            DomainError::WebhookVerificationFailed(format!("HMAC init failed: {}", e))
        })?;
        mac.update(signed_payload.as_bytes());

        // Constant-time HMAC verification against decoded hex signatures (mitigates CWE-208 timing oracle).
        let matched = signatures.iter().any(|&sig| {
            hex::decode(sig)
                .map(|sig_bytes| mac.clone().verify_slice(&sig_bytes).is_ok())
                .unwrap_or(false)
        });
        if !matched {
            return Err(DomainError::WebhookVerificationFailed(
                "HMAC signature mismatch".into(),
            ));
        }

        Ok(())
    }
}

#[async_trait]
impl PaymentGateway for StripePaymentGateway {
    async fn create_payment_intent(
        &self,
        _amount_cents: i32,
        _currency: &str,
    ) -> DomainResult<GatewayPaymentIntent> {
        let payment_intent_id = format!("pi_mock_{}", Uuid::new_v4());
        let client_secret = format!("{}_secret_mock", payment_intent_id);
        Ok(GatewayPaymentIntent {
            payment_intent_id,
            client_secret,
        })
    }

    fn verify_webhook_signature(&self, payload: &str, sig_header: &str) -> DomainResult<()> {
        Self::verify_stripe_signature(payload, sig_header, &self.webhook_secret)
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

        let signed_payload = format!("{}.{}", now, payload);
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        let sig_header = format!("t={},v1={}", now, sig);
        let res = StripePaymentGateway::verify_stripe_signature(payload, &sig_header, secret);
        assert!(res.is_ok());
    }

    #[test]
    fn test_stripe_signature_replay_attack_rejected() {
        let secret = "whsec_test_secret_12345";
        let old_time = Utc::now().timestamp() - 600;
        let payload = r#"{"id":"evt_123","type":"payment_intent.succeeded"}"#;

        let signed_payload = format!("{}.{}", old_time, payload);
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).unwrap();
        mac.update(signed_payload.as_bytes());
        let sig = hex::encode(mac.finalize().into_bytes());

        let sig_header = format!("t={},v1={}", old_time, sig);
        let res = StripePaymentGateway::verify_stripe_signature(payload, &sig_header, secret);
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
        let tampered_payload = r#"{"id":"evt_123","type":"payment_intent.succeeded","amount":999999}"#;

        let res = StripePaymentGateway::verify_stripe_signature(tampered_payload, &sig_header, secret);
        assert!(res.is_err());
    }

    #[test]
    fn test_stripe_signature_wrong_same_length_hex_rejected() {
        let secret = "whsec_test_secret_12345";
        let now = Utc::now().timestamp();
        let payload = r#"{"id":"evt_123","type":"payment_intent.succeeded"}"#;
        let bogus_sig = "0".repeat(64);
        let sig_header = format!("t={},v1={}", now, bogus_sig);
        let res = StripePaymentGateway::verify_stripe_signature(payload, &sig_header, secret);
        assert!(res.is_err());
    }
}
