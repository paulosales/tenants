use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::Row;
use uuid::Uuid;

use super::PostgresAdminRepository;
use crate::domain::{
    admin::{TenantReservation, TenantReservationRepository},
    errors::{DomainError, DomainResult},
};

#[async_trait]
impl TenantReservationRepository for PostgresAdminRepository {
    async fn list_tenant_reservations(
        &self,
        tenant_id: Option<Uuid>,
    ) -> DomainResult<Vec<TenantReservation>> {
        let mut q = "
            SELECT r.id, r.amenity_id, a.name as amenity_name, r.tenant_id,
                   CONCAT(t.first_name, ' ', t.last_name) as tenant_name,
                   a.property_id, u.unit_number,
                   lower(r.reservation_period) AT TIME ZONE 'UTC' as start_time,
                   upper(r.reservation_period) AT TIME ZONE 'UTC' as end_time,
                   r.attendees_count, r.total_price_cents, r.status, r.notes, r.created_at
            FROM reservations r
            JOIN amenities a ON a.id = r.amenity_id
            LEFT JOIN tenants t ON t.id = r.tenant_id
            LEFT JOIN units u ON u.id = t.assigned_unit_id
            WHERE r.deleted_at IS NULL
        "
        .to_string();

        if tenant_id.is_some() {
            q.push_str(" AND r.tenant_id = $1");
        }
        q.push_str(" ORDER BY lower(r.reservation_period) DESC");

        let mut query = sqlx::query(&q);
        if let Some(tid) = tenant_id {
            query = query.bind(tid);
        }

        let rows = query.fetch_all(&self.pool).await.map_err(|e| {
            DomainError::Internal(format!("Failed to list tenant reservations: {}", e))
        })?;

        Ok(rows
            .into_iter()
            .map(|r| {
                let start_time: DateTime<Utc> = r.get("start_time");
                TenantReservation {
                    id: r.get("id"),
                    amenity_id: r.get("amenity_id"),
                    amenity_name: r.get("amenity_name"),
                    tenant_id: r.get("tenant_id"),
                    tenant_name: r.get("tenant_name"),
                    property_id: r.get("property_id"),
                    unit_number: r.get("unit_number"),
                    booking_date: Some(start_time.format("%Y-%m-%d").to_string()),
                    start_time,
                    end_time: r.get("end_time"),
                    attendees_count: r.get("attendees_count"),
                    total_price_cents: r.get("total_price_cents"),
                    status: r.get("status"),
                    notes: r.get("notes"),
                    created_at: r.get("created_at"),
                }
            })
            .collect())
    }

    async fn create_tenant_reservation(
        &self,
        res: TenantReservation,
    ) -> DomainResult<TenantReservation> {
        let row = sqlx::query(
            r#"
            INSERT INTO reservations (
                id, amenity_id, tenant_id, reservation_period, total_price_cents, attendees_count, status, notes, created_at, updated_at
            )
            VALUES (
                $1, $2, $3, tsrange($4::timestamp, $5::timestamp, '[)'), $6, $7, $8, $9, $10, $11
            )
            RETURNING id, amenity_id, tenant_id, 
                      lower(reservation_period) AT TIME ZONE 'UTC' as start_time,
                      upper(reservation_period) AT TIME ZONE 'UTC' as end_time,
                      total_price_cents, attendees_count, status, notes, created_at
            "#
        )
        .bind(res.id)
        .bind(res.amenity_id)
        .bind(res.tenant_id)
        .bind(res.start_time)
        .bind(res.end_time)
        .bind(res.total_price_cents)
        .bind(res.attendees_count)
        .bind(&res.status)
        .bind(&res.notes)
        .bind(res.created_at)
        .bind(res.created_at)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| {
            if e.to_string().contains("no_overlapping_reservations") {
                DomainError::ReservationConflict
            } else {
                DomainError::Internal(format!("Failed to create tenant reservation: {}", e))
            }
        })?;

        let start_time: DateTime<Utc> = row.get("start_time");
        Ok(TenantReservation {
            id: row.get("id"),
            amenity_id: row.get("amenity_id"),
            amenity_name: res.amenity_name,
            tenant_id: row.get("tenant_id"),
            tenant_name: res.tenant_name,
            property_id: res.property_id,
            unit_number: res.unit_number,
            booking_date: res
                .booking_date
                .or_else(|| Some(start_time.format("%Y-%m-%d").to_string())),
            start_time,
            end_time: row.get("end_time"),
            attendees_count: row.get("attendees_count"),
            total_price_cents: row.get("total_price_cents"),
            status: row.get("status"),
            notes: row.get("notes"),
            created_at: row.get("created_at"),
        })
    }

    async fn cancel_tenant_reservation(&self, id: Uuid) -> DomainResult<()> {
        let now = Utc::now();
        sqlx::query(
            r#"
            UPDATE reservations
            SET status = 'cancelled', updated_at = $2
            WHERE id = $1 AND deleted_at IS NULL
            "#,
        )
        .bind(id)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| {
            DomainError::Internal(format!("Failed to cancel tenant reservation: {}", e))
        })?;

        Ok(())
    }

    async fn get_tenant_reservation(&self, id: Uuid) -> DomainResult<Option<TenantReservation>> {
        let row = sqlx::query(
            r#"
            SELECT r.id, r.amenity_id, a.name as amenity_name, r.tenant_id,
                   CONCAT(t.first_name, ' ', t.last_name) as tenant_name,
                   a.property_id, u.unit_number,
                   lower(r.reservation_period) AT TIME ZONE 'UTC' as start_time,
                   upper(r.reservation_period) AT TIME ZONE 'UTC' as end_time,
                   r.attendees_count, r.total_price_cents, r.status, r.notes, r.created_at
            FROM reservations r
            JOIN amenities a ON a.id = r.amenity_id
            LEFT JOIN tenants t ON t.id = r.tenant_id
            LEFT JOIN units u ON u.id = t.assigned_unit_id
            WHERE r.id = $1 AND r.deleted_at IS NULL
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to fetch tenant reservation: {}", e)))?;

        Ok(row.map(|r| {
            let start_time: DateTime<Utc> = r.get("start_time");
            TenantReservation {
                id: r.get("id"),
                amenity_id: r.get("amenity_id"),
                amenity_name: r.get("amenity_name"),
                tenant_id: r.get("tenant_id"),
                tenant_name: r.get("tenant_name"),
                property_id: r.get("property_id"),
                unit_number: r.get("unit_number"),
                booking_date: Some(start_time.format("%Y-%m-%d").to_string()),
                start_time,
                end_time: r.get("end_time"),
                attendees_count: r.get("attendees_count"),
                total_price_cents: r.get("total_price_cents"),
                status: r.get("status"),
                notes: r.get("notes"),
                created_at: r.get("created_at"),
            }
        }))
    }

    async fn review_tenant_reservation(
        &self,
        id: Uuid,
        status: &str,
        notes: Option<String>,
    ) -> DomainResult<TenantReservation> {
        let now = Utc::now();
        let row = sqlx::query(
            r#"
            UPDATE reservations
            SET status = $2,
                notes = COALESCE($3, notes),
                updated_at = $4
            WHERE id = $1 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(status)
        .bind(notes)
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| DomainError::Internal(format!("Failed to review tenant reservation: {}", e)))?
        .ok_or_else(|| DomainError::NotFound(format!("Amenity reservation {} not found", id)))?;

        let updated_id: Uuid = row.get("id");
        self.get_tenant_reservation(updated_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Updated reservation missing".into()))
    }
}
