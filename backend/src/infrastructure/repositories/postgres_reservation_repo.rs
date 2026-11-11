use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::{
    errors::{DomainError, DomainResult},
    repository::ReservationRepository,
    reservation::{Reservation, ReservationWithDetails},
};

pub struct PostgresReservationRepository {
    pool: PgPool,
}

impl PostgresReservationRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[derive(sqlx::FromRow)]
struct ReservationRow {
    id: Uuid,
    amenity_id: Uuid,
    user_id: Uuid,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    total_price_cents: i32,
    status: String,
    notes: Option<String>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    deleted_at: Option<DateTime<Utc>>,
}

impl From<ReservationRow> for Reservation {
    fn from(r: ReservationRow) -> Self {
        Self {
            id: r.id,
            amenity_id: r.amenity_id,
            user_id: r.user_id,
            start_time: r.start_time,
            end_time: r.end_time,
            total_price_cents: r.total_price_cents,
            status: r.status.into(),
            notes: r.notes,
            created_at: r.created_at,
            updated_at: r.updated_at,
            deleted_at: r.deleted_at,
        }
    }
}

#[derive(sqlx::FromRow)]
struct ReservationDetailsRow {
    id: Uuid,
    amenity_id: Uuid,
    amenity_name: String,
    user_id: Uuid,
    user_name: String,
    user_email: String,
    start_time: DateTime<Utc>,
    end_time: DateTime<Utc>,
    total_price_cents: i32,
    status: String,
    notes: Option<String>,
    created_at: DateTime<Utc>,
}

impl From<ReservationDetailsRow> for ReservationWithDetails {
    fn from(r: ReservationDetailsRow) -> Self {
        Self {
            id: r.id,
            amenity_id: r.amenity_id,
            amenity_name: r.amenity_name,
            user_id: r.user_id,
            user_name: r.user_name,
            user_email: r.user_email,
            start_time: r.start_time,
            end_time: r.end_time,
            total_price_cents: r.total_price_cents,
            status: r.status.into(),
            notes: r.notes,
            created_at: r.created_at,
        }
    }
}

#[async_trait]
impl ReservationRepository for PostgresReservationRepository {
    async fn find_by_id(&self, id: Uuid) -> DomainResult<Option<Reservation>> {
        let row = sqlx::query_as::<_, ReservationRow>(
            r#"
            SELECT id, amenity_id, user_id,
                   lower(reservation_period) AT TIME ZONE 'UTC' as start_time,
                   upper(reservation_period) AT TIME ZONE 'UTC' as end_time,
                   total_price_cents, status, notes,
                   created_at, updated_at, deleted_at
            FROM reservations
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to find reservation: {}", e)))?;

        Ok(row.map(Into::into))
    }

    async fn find_details_by_id(&self, id: Uuid) -> DomainResult<Option<ReservationWithDetails>> {
        let row = sqlx::query_as::<_, ReservationDetailsRow>(
            r#"
            SELECT r.id, r.amenity_id, a.name as amenity_name,
                   r.user_id, u.full_name as user_name, u.email as user_email,
                   lower(r.reservation_period) AT TIME ZONE 'UTC' as start_time,
                   upper(r.reservation_period) AT TIME ZONE 'UTC' as end_time,
                   r.total_price_cents, r.status, r.notes, r.created_at
            FROM reservations r
            JOIN amenities a ON a.id = r.amenity_id
            JOIN users u ON u.id = r.user_id
            WHERE r.id = $1 AND r.deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to find reservation details: {}", e)))?;

        Ok(row.map(Into::into))
    }

    async fn list_by_amenity_and_range(
        &self,
        amenity_id: Uuid,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
    ) -> DomainResult<Vec<Reservation>> {
        let rows = sqlx::query_as::<_, ReservationRow>(
            r#"
            SELECT id, amenity_id, user_id,
                   lower(reservation_period) AT TIME ZONE 'UTC' as start_time,
                   upper(reservation_period) AT TIME ZONE 'UTC' as end_time,
                   total_price_cents, status, notes,
                   created_at, updated_at, deleted_at
            FROM reservations
            WHERE amenity_id = $1
              AND reservation_period && tsrange($2::timestamp, $3::timestamp, '[)')
              AND deleted_at IS NULL
              AND status != 'cancelled'
            ORDER BY reservation_period ASC
            "#,
        )
        .bind(amenity_id)
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| {
            DomainError::Internal(format!("Failed to list reservations by range: {}", e))
        })?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn list_by_user(&self, user_id: Uuid) -> DomainResult<Vec<ReservationWithDetails>> {
        let rows = sqlx::query_as::<_, ReservationDetailsRow>(
            r#"
            SELECT r.id, r.amenity_id, a.name as amenity_name,
                   r.user_id, u.full_name as user_name, u.email as user_email,
                   lower(r.reservation_period) AT TIME ZONE 'UTC' as start_time,
                   upper(r.reservation_period) AT TIME ZONE 'UTC' as end_time,
                   r.total_price_cents, r.status, r.notes, r.created_at
            FROM reservations r
            JOIN amenities a ON a.id = r.amenity_id
            JOIN users u ON u.id = r.user_id
            WHERE r.user_id = $1 AND r.deleted_at IS NULL
            ORDER BY lower(r.reservation_period) DESC
            "#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to list user reservations: {}", e)))?;

        Ok(rows.into_iter().map(Into::into).collect())
    }

    async fn create_transactional(&self, reservation: &Reservation) -> DomainResult<Reservation> {
        let mut tx = self.pool.begin().await.map_err(|e| {
            DomainError::Internal(format!("Failed to start database transaction: {}", e))
        })?;

        // Optional row-level lock on the amenity row to serialize concurrent booking decisions
        let _ = sqlx::query("SELECT id FROM amenities WHERE id = $1 FOR UPDATE")
            .bind(reservation.amenity_id)
            .fetch_one(&mut *tx)
            .await
            .map_err(|e| DomainError::Internal(format!("Failed to lock amenity row: {}", e)))?;

        // Execute the insertion into reservations table.
        // The GiST exclusion constraint mathematically prevents any overlapping reservation period.
        let result = sqlx::query_as::<_, ReservationRow>(
            r#"
            INSERT INTO reservations (
                id, amenity_id, user_id, reservation_period,
                total_price_cents, status, notes, created_at, updated_at
            )
            VALUES ($1, $2, $3, tsrange($4::timestamp, $5::timestamp, '[)'), $6, $7, $8, $9, $10)
            RETURNING id, amenity_id, user_id,
                      lower(reservation_period) AT TIME ZONE 'UTC' as start_time,
                      upper(reservation_period) AT TIME ZONE 'UTC' as end_time,
                      total_price_cents, status, notes,
                      created_at, updated_at, deleted_at
            "#,
        )
        .bind(reservation.id)
        .bind(reservation.amenity_id)
        .bind(reservation.user_id)
        .bind(reservation.start_time)
        .bind(reservation.end_time)
        .bind(reservation.total_price_cents)
        .bind(reservation.status.to_string())
        .bind(&reservation.notes)
        .bind(reservation.created_at)
        .bind(reservation.updated_at)
        .fetch_one(&mut *tx)
        .await;

        match result {
            Ok(row) => {
                tx.commit().await.map_err(|e| {
                    DomainError::Internal(format!(
                        "Failed to commit reservation transaction: {}",
                        e
                    ))
                })?;
                Ok(row.into())
            }
            Err(sqlx::Error::Database(ref db_err))
                if db_err.code() == Some(std::borrow::Cow::Borrowed("23P01")) =>
            {
                let _ = tx.rollback().await;
                Err(DomainError::ReservationConflict)
            }
            Err(e) => {
                let _ = tx.rollback().await;
                Err(DomainError::Internal(format!(
                    "Database error during reservation creation: {}",
                    e
                )))
            }
        }
    }

    async fn cancel(&self, id: Uuid, _user_id: Uuid) -> DomainResult<()> {
        let mut tx =
            self.pool.begin().await.map_err(|e| {
                DomainError::Internal(format!("Failed to begin transaction: {}", e))
            })?;

        // Row-level lock during state transition
        let res = sqlx::query(
            r#"
            UPDATE reservations
            SET status = 'cancelled', updated_at = NOW()
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to cancel reservation: {}", e)))?;

        if res.rows_affected() == 0 {
            let _ = tx.rollback().await;
            return Err(DomainError::NotFound("Reservation not found".into()));
        }

        tx.commit().await.map_err(|e| {
            DomainError::Internal(format!("Failed to commit cancel transaction: {}", e))
        })?;

        Ok(())
    }
}
