use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{
    errors::{DomainError, DomainResult},
    payment::Payment,
    repository::PaymentRepository,
};

pub struct PostgresPaymentRepository {
    pool: PgPool,
}

impl PostgresPaymentRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct PaymentRow {
    id: Uuid,
    user_id: Uuid,
    reservation_id: Option<Uuid>,
    parking_spot_id: Option<Uuid>,
    amount_cents: i32,
    currency: String,
    stripe_payment_intent_id: Option<String>,
    stripe_client_secret: Option<String>,
    status: String,
    idempotency_key: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl From<PaymentRow> for Payment {
    fn from(r: PaymentRow) -> Self {
        Self {
            id: r.id,
            user_id: r.user_id,
            reservation_id: r.reservation_id,
            parking_spot_id: r.parking_spot_id,
            amount_cents: r.amount_cents,
            currency: r.currency,
            stripe_payment_intent_id: r.stripe_payment_intent_id,
            stripe_client_secret: r.stripe_client_secret,
            status: r.status.into(),
            idempotency_key: r.idempotency_key,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }
    }
}

#[async_trait]
impl PaymentRepository for PostgresPaymentRepository {
    async fn create(&self, payment: &Payment) -> DomainResult<Payment> {
        let row = sqlx::query_as::<_, PaymentRow>(
            r#"
            INSERT INTO payments (
                id, user_id, reservation_id, parking_spot_id,
                amount_cents, currency, stripe_payment_intent_id,
                stripe_client_secret, status, idempotency_key,
                created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id, user_id, reservation_id, parking_spot_id,
                      amount_cents, currency, stripe_payment_intent_id,
                      stripe_client_secret, status, idempotency_key,
                      created_at, updated_at
            "#,
        )
        .bind(payment.id)
        .bind(payment.user_id)
        .bind(payment.reservation_id)
        .bind(payment.parking_spot_id)
        .bind(payment.amount_cents)
        .bind(&payment.currency)
        .bind(&payment.stripe_payment_intent_id)
        .bind(&payment.stripe_client_secret)
        .bind(payment.status.to_string())
        .bind(&payment.idempotency_key)
        .bind(payment.created_at)
        .bind(payment.updated_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to record payment: {}", e)))?;

        Ok(row.into())
    }

    async fn find_by_stripe_pi(&self, stripe_pi: &str) -> DomainResult<Option<Payment>> {
        let row = sqlx::query_as::<_, PaymentRow>(
            r#"
            SELECT id, user_id, reservation_id, parking_spot_id,
                   amount_cents, currency, stripe_payment_intent_id,
                   stripe_client_secret, status, idempotency_key,
                   created_at, updated_at
            FROM payments
            WHERE stripe_payment_intent_id = $1
            "#,
        )
        .bind(stripe_pi)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to find payment by stripe PI: {}", e)))?;

        Ok(row.map(Into::into))
    }

    async fn update_status(&self, id: Uuid, status: &str) -> DomainResult<()> {
        sqlx::query(
            r#"
            UPDATE payments
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            "#,
        )
        .bind(status)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to update payment status: {}", e)))?;

        Ok(())
    }
}
