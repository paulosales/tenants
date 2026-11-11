use std::sync::Arc;
use chrono::Utc;
use uuid::Uuid;

use super::dtos::{CreateUnitRequest, UpdateUnitRequest};
use crate::domain::{
    admin::{PropertyRepository, Unit, UnitRepository, UnitStatus, UnitWithTenant},
    errors::{DomainError, DomainResult},
};

pub struct UnitService {
    unit_repo: Arc<dyn UnitRepository>,
    property_repo: Arc<dyn PropertyRepository>,
}

impl UnitService {
    pub fn new(
        unit_repo: Arc<dyn UnitRepository>,
        property_repo: Arc<dyn PropertyRepository>,
    ) -> Self {
        Self {
            unit_repo,
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

    pub async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>> {
        self.ensure_property_exists(property_id).await?;
        self.unit_repo.list_units_by_property(property_id).await
    }

    pub async fn get_unit(&self, id: Uuid) -> DomainResult<Unit> {
        self.unit_repo
            .get_unit(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Unit with ID {} not found", id)))
    }

    pub async fn create_unit(&self, property_id: Uuid, req: CreateUnitRequest) -> DomainResult<Unit> {
        self.ensure_property_exists(property_id).await?;
        if req.unit_number.trim().is_empty() {
            return Err(DomainError::ValidationError("Unit number cannot be empty".to_string()));
        }
        let monthly_rent_cents = req.monthly_rent_cents.unwrap_or(185_000);
        if monthly_rent_cents < 0 {
            return Err(DomainError::ValidationError(
                "Monthly rent cannot be negative".to_string(),
            ));
        }
        let now = Utc::now();
        let has_tenants = req.tenant_ids.as_ref().map(|ids| !ids.is_empty()).unwrap_or(false);
        let initial_status = req.status.unwrap_or(if has_tenants {
            UnitStatus::Occupied
        } else {
            UnitStatus::Vacant
        });

        let unit = Unit {
            id: Uuid::new_v4(),
            property_id,
            unit_number: req.unit_number.trim().to_string(),
            floor: req.floor,
            bedrooms: req.bedrooms,
            bathrooms: req.bathrooms,
            square_feet: req.square_feet,
            monthly_rent_cents,
            status: initial_status,
            created_at: now,
            updated_at: now,
        };
        let created = self.unit_repo.create_unit(unit).await?;

        if let Some(ref tenant_ids) = req.tenant_ids {
            self.unit_repo.sync_unit_tenants(created.id, tenant_ids).await?;
            if !tenant_ids.is_empty() && created.status == UnitStatus::Vacant {
                self.unit_repo.set_unit_status(created.id, UnitStatus::Occupied).await?;
            }
        }

        Ok(created)
    }

    pub async fn update_unit(&self, id: Uuid, req: UpdateUnitRequest) -> DomainResult<Unit> {
        let mut unit = self.get_unit(id).await?;
        if req.unit_number.trim().is_empty() {
            return Err(DomainError::ValidationError("Unit number cannot be empty".to_string()));
        }
        if let Some(rent) = req.monthly_rent_cents {
            if rent < 0 {
                return Err(DomainError::ValidationError(
                    "Monthly rent cannot be negative".to_string(),
                ));
            }
            unit.monthly_rent_cents = rent;
        }
        unit.unit_number = req.unit_number.trim().to_string();
        unit.floor = req.floor;
        unit.bedrooms = req.bedrooms;
        unit.bathrooms = req.bathrooms;
        unit.square_feet = req.square_feet;
        unit.status = req.status;
        unit.updated_at = Utc::now();
        let mut updated = self.unit_repo.update_unit(unit).await?;

        if let Some(ref tenant_ids) = req.tenant_ids {
            self.unit_repo.sync_unit_tenants(id, tenant_ids).await?;
            if !tenant_ids.is_empty() && updated.status == UnitStatus::Vacant {
                updated.status = UnitStatus::Occupied;
                self.unit_repo.set_unit_status(id, UnitStatus::Occupied).await?;
            } else if tenant_ids.is_empty() && updated.status == UnitStatus::Occupied {
                updated.status = UnitStatus::Vacant;
                self.unit_repo.set_unit_status(id, UnitStatus::Vacant).await?;
            }
        }

        Ok(updated)
    }

    pub async fn delete_unit(&self, id: Uuid) -> DomainResult<()> {
        let _ = self.get_unit(id).await?;
        self.unit_repo.delete_unit(id).await
    }
}

