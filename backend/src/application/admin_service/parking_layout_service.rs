use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::SaveParkingLayoutRequest;
use crate::domain::{
    admin::{ParkingLayoutRepository, ParkingLayoutWithSpots, ParkingSpot, PropertyRepository},
    errors::{DomainError, DomainResult},
};

pub struct ParkingLayoutService {
    layout_repo: Arc<dyn ParkingLayoutRepository>,
    property_repo: Arc<dyn PropertyRepository>,
}

impl ParkingLayoutService {
    pub fn new(
        layout_repo: Arc<dyn ParkingLayoutRepository>,
        property_repo: Arc<dyn PropertyRepository>,
    ) -> Self {
        Self {
            layout_repo,
            property_repo,
        }
    }

    async fn ensure_property_exists(&self, property_id: Uuid) -> DomainResult<()> {
        self.property_repo
            .get_property(property_id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Property with ID {} not found", property_id)))?;
        Ok(())
    }

    pub async fn get_parking_layout(&self, property_id: Uuid) -> DomainResult<ParkingLayoutWithSpots> {
        self.ensure_property_exists(property_id).await?;
        match self.layout_repo.get_parking_layout(property_id).await? {
            Some(layout) => Ok(layout),
            None => {
                self.layout_repo
                    .save_parking_layout(property_id, 1200, 800, 20, Vec::new())
                    .await
            }
        }
    }

    pub async fn save_parking_layout(
        &self,
        property_id: Uuid,
        req: SaveParkingLayoutRequest,
    ) -> DomainResult<ParkingLayoutWithSpots> {
        self.ensure_property_exists(property_id).await?;

        if req.canvas_width < 200 || req.canvas_height < 200 {
            return Err(DomainError::ValidationError(
                "Canvas dimensions must be at least 200x200 pixels".to_string(),
            ));
        }
        let grid_size = if req.grid_size > 0 { req.grid_size } else { 20 };

        let now = Utc::now();
        let spots = req
            .spots
            .into_iter()
            .map(|s| ParkingSpot {
                id: s.id.unwrap_or_else(Uuid::new_v4),
                layout_id: Uuid::nil(),
                spot_label: s.spot_label.trim().to_string(),
                x: s.x,
                y: s.y,
                width: if s.width > 10.0 { s.width } else { 60.0 },
                height: if s.height > 10.0 { s.height } else { 120.0 },
                rotation: s.rotation,
                spot_type: s.spot_type,
                is_occupied: s.is_occupied,
                assigned_tenant_id: s.assigned_tenant_id,
                tenant_name: None,
                created_at: now,
                updated_at: now,
            })
            .collect();

        self.layout_repo
            .save_parking_layout(property_id, req.canvas_width, req.canvas_height, grid_size, spots)
            .await
    }
}

