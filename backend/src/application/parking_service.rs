use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use crate::application::dtos::UpsertSpotRequest;
use crate::domain::{
    audit::AuditLog,
    errors::{DomainError, DomainResult},
    parking::{ParkingLayoutResponse, ParkingSpot, ParkingZone, SpotStatus},
    ports::SvgSanitizerPort,
    repository::{AuditRepository, ParkingRepository},
    user::User,
};

pub struct ParkingService {
    parking_repo: Arc<dyn ParkingRepository>,
    audit_repo: Arc<dyn AuditRepository>,
    svg_sanitizer: Arc<dyn SvgSanitizerPort>,
}

impl ParkingService {
    pub fn new(
        parking_repo: Arc<dyn ParkingRepository>,
        audit_repo: Arc<dyn AuditRepository>,
        svg_sanitizer: Arc<dyn SvgSanitizerPort>,
    ) -> Self {
        Self {
            parking_repo,
            audit_repo,
            svg_sanitizer,
        }
    }

    pub async fn list_zones(&self) -> DomainResult<Vec<ParkingZone>> {
        self.parking_repo.list_zones().await
    }

    pub async fn get_layout(&self, zone_id: Uuid) -> DomainResult<ParkingLayoutResponse> {
        self.parking_repo
            .get_zone_layout(zone_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Parking zone not found".into()))
    }

    pub async fn get_layout_for_viewer(
        &self,
        actor: &User,
        zone_id: Uuid,
    ) -> DomainResult<ParkingLayoutResponse> {
        let mut layout = self.get_layout(zone_id).await?;
        if !actor.role.can_manage_properties() {
            for spot in &mut layout.spots {
                if spot.assigned_tenant_id != Some(actor.id) {
                    spot.assigned_tenant_id = None;
                }
            }
        }
        Ok(layout)
    }

    pub async fn reserve_spot(
        &self,
        actor: &User,
        spot_id: Uuid,
        client_ip: Option<String>,
        user_agent: Option<String>,
    ) -> DomainResult<()> {
        let spot = self
            .parking_repo
            .find_spot_by_id(spot_id)
            .await?
            .ok_or_else(|| DomainError::NotFound("Parking spot not found".into()))?;

        if spot.status != SpotStatus::Vacant {
            return Err(DomainError::SpotUnavailable(spot.spot_number));
        }

        // Atomically update spot status to reserved with tenant assignment
        self.parking_repo
            .update_spot_status(spot_id, SpotStatus::Reserved, Some(actor.id))
            .await?;

        // Audit log
        let _ = self
            .audit_repo
            .record(&AuditLog {
                id: Uuid::new_v4(),
                actor_id: Some(actor.id),
                actor_email: Some(actor.email.clone()),
                action: "RESERVE_PARKING_SPOT".to_string(),
                entity_type: "parking_spot".to_string(),
                entity_id: Some(spot_id),
                old_values: Some(serde_json::json!({ "status": "vacant" })),
                new_values: Some(serde_json::json!({ "status": "reserved", "tenant_id": actor.id })),
                ip_address: client_ip,
                user_agent,
                created_at: Utc::now(),
            })
            .await;

        Ok(())
    }

    pub async fn upsert_spot(
        &self,
        actor: &User,
        req: UpsertSpotRequest,
    ) -> DomainResult<ParkingSpot> {
        if !actor.role.can_manage_properties() {
            return Err(DomainError::Forbidden);
        }
        if req.hourly_rate_cents < 0 || req.monthly_rate_cents < 0 {
            return Err(DomainError::ValidationError(
                "Parking rates cannot be negative".into(),
            ));
        }

        let spot = ParkingSpot {
            id: Uuid::new_v4(),
            zone_id: req.zone_id,
            spot_number: req.spot_number,
            spot_type: req.spot_type,
            shape_type: req.shape_type,
            coordinates: req.coordinates,
            hourly_rate_cents: req.hourly_rate_cents,
            monthly_rate_cents: req.monthly_rate_cents,
            status: SpotStatus::Vacant,
            assigned_tenant_id: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            deleted_at: None,
        };

        self.parking_repo.upsert_spot(&spot).await
    }

    pub async fn upload_and_sanitize_svg(
        &self,
        actor: &User,
        zone_id: Uuid,
        raw_svg: &str,
    ) -> DomainResult<String> {
        if !actor.role.can_manage_properties() {
            return Err(DomainError::Forbidden);
        }

        let sanitized_svg = self.svg_sanitizer.sanitize(raw_svg)?;
        self.parking_repo.save_svg_layout(zone_id, &sanitized_svg).await?;

        Ok(sanitized_svg)
    }
}
