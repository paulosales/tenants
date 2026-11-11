use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::{CreatePropertyRequest, UpdatePropertyRequest};
use crate::domain::{
    admin::{Property, PropertyRepository, PropertyWithStats},
    errors::{DomainError, DomainResult},
};

pub struct PropertyService {
    repo: Arc<dyn PropertyRepository>,
}

impl PropertyService {
    pub fn new(repo: Arc<dyn PropertyRepository>) -> Self {
        Self { repo }
    }

    pub async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>> {
        self.repo.list_properties().await
    }

    pub async fn get_property(&self, id: Uuid) -> DomainResult<Property> {
        self.repo
            .get_property(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Property with ID {} not found", id)))
    }

    pub async fn create_property(&self, req: CreatePropertyRequest) -> DomainResult<Property> {
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError("Property name cannot be empty".to_string()));
        }
        if req.address_line1.trim().is_empty() {
            return Err(DomainError::ValidationError("Address line 1 cannot be empty".to_string()));
        }
        let now = Utc::now();
        let prop = Property {
            id: Uuid::new_v4(),
            name: req.name.trim().to_string(),
            address_line1: req.address_line1.trim().to_string(),
            address_line2: req.address_line2.map(|s| s.trim().to_string()),
            city: req.city.trim().to_string(),
            state_province: req.state_province.trim().to_string(),
            postal_code: req.postal_code.trim().to_string(),
            created_at: now,
            updated_at: now,
        };
        self.repo.create_property(prop).await
    }

    pub async fn update_property(&self, id: Uuid, req: UpdatePropertyRequest) -> DomainResult<Property> {
        let mut prop = self.get_property(id).await?;
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError("Property name cannot be empty".to_string()));
        }
        prop.name = req.name.trim().to_string();
        prop.address_line1 = req.address_line1.trim().to_string();
        prop.address_line2 = req.address_line2.map(|s| s.trim().to_string());
        prop.city = req.city.trim().to_string();
        prop.state_province = req.state_province.trim().to_string();
        prop.postal_code = req.postal_code.trim().to_string();
        prop.updated_at = Utc::now();
        self.repo.update_property(prop).await
    }

    pub async fn delete_property(&self, id: Uuid) -> DomainResult<()> {
        let _ = self.get_property(id).await?;
        let unit_count = self.repo.count_property_units(id).await?;
        if unit_count > 0 {
            return Err(DomainError::Conflict(format!(
                "Cannot delete property that still contains {} unit(s). Please delete or reassign all units first.",
                unit_count
            )));
        }
        self.repo.delete_property(id).await
    }
}

