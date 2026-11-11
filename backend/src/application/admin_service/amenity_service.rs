use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use super::dtos::{CreateAmenityRequest, UpdateAmenityRequest};
use crate::domain::{
    admin::{AdminAmenity, AdminAmenityRepository, PropertyRepository},
    errors::{DomainError, DomainResult},
};

pub struct AdminAmenityService {
    amenity_repo: Arc<dyn AdminAmenityRepository>,
    property_repo: Arc<dyn PropertyRepository>,
}

impl AdminAmenityService {
    pub fn new(
        amenity_repo: Arc<dyn AdminAmenityRepository>,
        property_repo: Arc<dyn PropertyRepository>,
    ) -> Self {
        Self {
            amenity_repo,
            property_repo,
        }
    }

    async fn ensure_property_exists(&self, property_id: Uuid) -> DomainResult<()> {
        self.property_repo
            .get_property(property_id)
            .await?
            .ok_or_else(|| {
                DomainError::NotFound(format!("Property with ID {} not found", property_id))
            })?;
        Ok(())
    }

    pub async fn list_amenities_by_property(
        &self,
        property_id: Uuid,
    ) -> DomainResult<Vec<AdminAmenity>> {
        self.ensure_property_exists(property_id).await?;
        self.amenity_repo
            .list_amenities_by_property(property_id)
            .await
    }

    pub async fn get_amenity(&self, id: Uuid) -> DomainResult<AdminAmenity> {
        self.amenity_repo
            .get_amenity(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Amenity with ID {} not found", id)))
    }

    pub async fn create_amenity(
        &self,
        property_id: Uuid,
        req: CreateAmenityRequest,
    ) -> DomainResult<AdminAmenity> {
        self.ensure_property_exists(property_id).await?;
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "Amenity name cannot be empty".to_string(),
            ));
        }
        let now = Utc::now();
        let amenity = AdminAmenity {
            id: Uuid::new_v4(),
            property_id,
            name: req.name.trim().to_string(),
            description: req.description.map(|s| s.trim().to_string()),
            capacity: if req.capacity > 0 { req.capacity } else { 10 },
            fee_cents: req.fee_cents,
            deposit_cents: req.deposit_cents,
            rules: req.rules.map(|s| s.trim().to_string()),
            is_active: req.is_active.unwrap_or(true),
            created_at: now,
            updated_at: now,
        };
        self.amenity_repo.create_amenity(amenity).await
    }

    pub async fn update_amenity(
        &self,
        id: Uuid,
        req: UpdateAmenityRequest,
    ) -> DomainResult<AdminAmenity> {
        let mut amenity = self.get_amenity(id).await?;
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError(
                "Amenity name cannot be empty".to_string(),
            ));
        }
        amenity.name = req.name.trim().to_string();
        amenity.description = req.description.map(|s| s.trim().to_string());
        amenity.capacity = req.capacity;
        amenity.fee_cents = req.fee_cents;
        amenity.deposit_cents = req.deposit_cents;
        amenity.rules = req.rules.map(|s| s.trim().to_string());
        amenity.is_active = req.is_active;
        amenity.updated_at = Utc::now();
        self.amenity_repo.update_amenity(amenity).await
    }

    pub async fn delete_amenity(&self, id: Uuid) -> DomainResult<()> {
        let _ = self.get_amenity(id).await?;
        self.amenity_repo.delete_amenity(id).await
    }
}
