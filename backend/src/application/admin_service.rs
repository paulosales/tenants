use std::sync::Arc;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::{
    admin::*,
    errors::{DomainError, DomainResult},
};

// ==========================================
// DTOs
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePropertyRequest {
    pub name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state_province: String,
    pub postal_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePropertyRequest {
    pub name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state_province: String,
    pub postal_code: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUnitRequest {
    pub unit_number: String,
    pub floor: i32,
    pub bedrooms: i32,
    pub bathrooms: f64,
    pub square_feet: i32,
    pub status: Option<UnitStatus>,
    #[serde(default)]
    pub tenant_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateUnitRequest {
    pub unit_number: String,
    pub floor: i32,
    pub bedrooms: i32,
    pub bathrooms: f64,
    pub square_feet: i32,
    pub status: UnitStatus,
    #[serde(default)]
    pub tenant_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTenantRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub assigned_unit_id: Option<Uuid>,
    pub lease_start_date: Option<chrono::NaiveDate>,
    pub lease_end_date: Option<chrono::NaiveDate>,
    pub status: Option<TenantStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateTenantRequest {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub assigned_unit_id: Option<Uuid>,
    pub lease_start_date: Option<chrono::NaiveDate>,
    pub lease_end_date: Option<chrono::NaiveDate>,
    pub status: TenantStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAmenityRequest {
    pub name: String,
    pub description: Option<String>,
    pub capacity: i32,
    pub fee_cents: i32,
    pub deposit_cents: i32,
    pub rules: Option<String>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAmenityRequest {
    pub name: String,
    pub description: Option<String>,
    pub capacity: i32,
    pub fee_cents: i32,
    pub deposit_cents: i32,
    pub rules: Option<String>,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveParkingSpotDto {
    pub id: Option<Uuid>,
    pub spot_label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub spot_type: SpotType,
    pub is_occupied: bool,
    pub assigned_tenant_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SaveParkingLayoutRequest {
    pub canvas_width: i32,
    pub canvas_height: i32,
    pub grid_size: i32,
    pub spots: Vec<SaveParkingSpotDto>,
}

// ==========================================
// Service Implementation
// ==========================================

pub struct AdminService {
    repo: Arc<dyn AdminRepository>,
}

impl AdminService {
    pub fn new(repo: Arc<dyn AdminRepository>) -> Self {
        Self { repo }
    }

    // ------------------------------------------
    // Properties Logic
    // ------------------------------------------
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

    // ------------------------------------------
    // Units Logic
    // ------------------------------------------
    pub async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>> {
        let _ = self.get_property(property_id).await?;
        self.repo.list_units_by_property(property_id).await
    }

    pub async fn get_unit(&self, id: Uuid) -> DomainResult<Unit> {
        self.repo
            .get_unit(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Unit with ID {} not found", id)))
    }

    pub async fn create_unit(&self, property_id: Uuid, req: CreateUnitRequest) -> DomainResult<Unit> {
        let _ = self.get_property(property_id).await?;
        if req.unit_number.trim().is_empty() {
            return Err(DomainError::ValidationError("Unit number cannot be empty".to_string()));
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
            status: initial_status,
            created_at: now,
            updated_at: now,
        };
        let created = self.repo.create_unit(unit).await?;

        if let Some(ref tenant_ids) = req.tenant_ids {
            self.repo.sync_unit_tenants(created.id, tenant_ids).await?;
            if !tenant_ids.is_empty() && created.status == UnitStatus::Vacant {
                self.repo.set_unit_status(created.id, UnitStatus::Occupied).await?;
            }
        }

        Ok(created)
    }

    pub async fn update_unit(&self, id: Uuid, req: UpdateUnitRequest) -> DomainResult<Unit> {
        let mut unit = self.get_unit(id).await?;
        if req.unit_number.trim().is_empty() {
            return Err(DomainError::ValidationError("Unit number cannot be empty".to_string()));
        }
        unit.unit_number = req.unit_number.trim().to_string();
        unit.floor = req.floor;
        unit.bedrooms = req.bedrooms;
        unit.bathrooms = req.bathrooms;
        unit.square_feet = req.square_feet;
        unit.status = req.status;
        unit.updated_at = Utc::now();
        let mut updated = self.repo.update_unit(unit).await?;

        if let Some(ref tenant_ids) = req.tenant_ids {
            self.repo.sync_unit_tenants(id, tenant_ids).await?;
            if !tenant_ids.is_empty() && updated.status == UnitStatus::Vacant {
                updated.status = UnitStatus::Occupied;
                self.repo.set_unit_status(id, UnitStatus::Occupied).await?;
            } else if tenant_ids.is_empty() && updated.status == UnitStatus::Occupied {
                updated.status = UnitStatus::Vacant;
                self.repo.set_unit_status(id, UnitStatus::Vacant).await?;
            }
        }

        Ok(updated)
    }

    pub async fn delete_unit(&self, id: Uuid) -> DomainResult<()> {
        let _ = self.get_unit(id).await?;
        self.repo.delete_unit(id).await
    }

    // ------------------------------------------
    // Tenants Logic
    // ------------------------------------------
    pub async fn list_tenants(
        &self,
        property_id: Option<Uuid>,
        status: Option<TenantStatus>,
        query: Option<String>,
    ) -> DomainResult<Vec<TenantWithUnit>> {
        self.repo.list_tenants(property_id, status, query).await
    }

    pub async fn get_tenant(&self, id: Uuid) -> DomainResult<TenantWithUnit> {
        self.repo
            .get_tenant(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Tenant with ID {} not found", id)))
    }

    pub async fn create_tenant(&self, req: CreateTenantRequest) -> DomainResult<Tenant> {
        if req.first_name.trim().is_empty() || req.last_name.trim().is_empty() {
            return Err(DomainError::ValidationError("First and last names are required".to_string()));
        }
        if req.email.trim().is_empty() || !req.email.contains('@') {
            return Err(DomainError::ValidationError("A valid email address is required".to_string()));
        }

        // If assigning to a unit, verify unit exists and update unit status to occupied
        if let Some(unit_id) = req.assigned_unit_id {
            let unit = self.get_unit(unit_id).await?;
            if unit.status == UnitStatus::Occupied {
                tracing::info!("Assigning tenant to already occupied unit {}", unit.unit_number);
            }
            self.repo.set_unit_status(unit_id, UnitStatus::Occupied).await?;
        }

        let now = Utc::now();
        let tenant = Tenant {
            id: Uuid::new_v4(),
            first_name: req.first_name.trim().to_string(),
            last_name: req.last_name.trim().to_string(),
            email: req.email.trim().to_lowercase(),
            phone: req.phone.trim().to_string(),
            emergency_contact_name: req.emergency_contact_name.map(|s| s.trim().to_string()),
            emergency_contact_phone: req.emergency_contact_phone.map(|s| s.trim().to_string()),
            assigned_unit_id: req.assigned_unit_id,
            lease_start_date: req.lease_start_date,
            lease_end_date: req.lease_end_date,
            status: req.status.unwrap_or(TenantStatus::Active),
            created_at: now,
            updated_at: now,
        };

        self.repo.create_tenant(tenant).await
    }

    pub async fn update_tenant(&self, id: Uuid, req: UpdateTenantRequest) -> DomainResult<Tenant> {
        let existing = self.get_tenant(id).await?;
        if req.first_name.trim().is_empty() || req.last_name.trim().is_empty() {
            return Err(DomainError::ValidationError("First and last names are required".to_string()));
        }
        if req.email.trim().is_empty() || !req.email.contains('@') {
            return Err(DomainError::ValidationError("A valid email address is required".to_string()));
        }

        // Handle unit status changes on reassignment
        if existing.assigned_unit_id != req.assigned_unit_id {
            if let Some(old_unit_id) = existing.assigned_unit_id {
                let remaining_active = self.repo.count_active_tenants_for_unit(old_unit_id, Some(id)).await?;
                if remaining_active == 0 {
                    self.repo.set_unit_status(old_unit_id, UnitStatus::Vacant).await?;
                }
            }
            if let Some(new_unit_id) = req.assigned_unit_id {
                self.repo.set_unit_status(new_unit_id, UnitStatus::Occupied).await?;
            }
        }

        let tenant = Tenant {
            id,
            first_name: req.first_name.trim().to_string(),
            last_name: req.last_name.trim().to_string(),
            email: req.email.trim().to_lowercase(),
            phone: req.phone.trim().to_string(),
            emergency_contact_name: req.emergency_contact_name.map(|s| s.trim().to_string()),
            emergency_contact_phone: req.emergency_contact_phone.map(|s| s.trim().to_string()),
            assigned_unit_id: req.assigned_unit_id,
            lease_start_date: req.lease_start_date,
            lease_end_date: req.lease_end_date,
            status: req.status,
            created_at: existing.created_at,
            updated_at: Utc::now(),
        };

        self.repo.update_tenant(tenant).await
    }

    pub async fn delete_tenant(&self, id: Uuid) -> DomainResult<()> {
        let tenant = self.get_tenant(id).await?;
        if let Some(unit_id) = tenant.assigned_unit_id {
            let remaining_active = self.repo.count_active_tenants_for_unit(unit_id, Some(id)).await?;
            if remaining_active == 0 {
                self.repo.set_unit_status(unit_id, UnitStatus::Vacant).await?;
            }
        }
        self.repo.delete_tenant(id).await
    }

    // ------------------------------------------
    // Amenities Logic
    // ------------------------------------------
    pub async fn list_amenities_by_property(&self, property_id: Uuid) -> DomainResult<Vec<AdminAmenity>> {
        let _ = self.get_property(property_id).await?;
        self.repo.list_amenities_by_property(property_id).await
    }

    pub async fn get_amenity(&self, id: Uuid) -> DomainResult<AdminAmenity> {
        self.repo
            .get_amenity(id)
            .await?
            .ok_or_else(|| DomainError::NotFound(format!("Amenity with ID {} not found", id)))
    }

    pub async fn create_amenity(&self, property_id: Uuid, req: CreateAmenityRequest) -> DomainResult<AdminAmenity> {
        let _ = self.get_property(property_id).await?;
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError("Amenity name cannot be empty".to_string()));
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
        self.repo.create_amenity(amenity).await
    }

    pub async fn update_amenity(&self, id: Uuid, req: UpdateAmenityRequest) -> DomainResult<AdminAmenity> {
        let mut amenity = self.get_amenity(id).await?;
        if req.name.trim().is_empty() {
            return Err(DomainError::ValidationError("Amenity name cannot be empty".to_string()));
        }
        amenity.name = req.name.trim().to_string();
        amenity.description = req.description.map(|s| s.trim().to_string());
        amenity.capacity = req.capacity;
        amenity.fee_cents = req.fee_cents;
        amenity.deposit_cents = req.deposit_cents;
        amenity.rules = req.rules.map(|s| s.trim().to_string());
        amenity.is_active = req.is_active;
        amenity.updated_at = Utc::now();
        self.repo.update_amenity(amenity).await
    }

    pub async fn delete_amenity(&self, id: Uuid) -> DomainResult<()> {
        let _ = self.get_amenity(id).await?;
        self.repo.delete_amenity(id).await
    }

    // ------------------------------------------
    // Parking Layout & Spots Logic
    // ------------------------------------------
    pub async fn get_parking_layout(&self, property_id: Uuid) -> DomainResult<ParkingLayoutWithSpots> {
        let _ = self.get_property(property_id).await?;
        match self.repo.get_parking_layout(property_id).await? {
            Some(layout) => Ok(layout),
            None => {
                // Return default initialized empty layout
                self.repo
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
        let _ = self.get_property(property_id).await?;

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
                layout_id: Uuid::nil(), // Assigned by repository inside transaction
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

        self.repo
            .save_parking_layout(property_id, req.canvas_width, req.canvas_height, grid_size, spots)
            .await
    }
}
