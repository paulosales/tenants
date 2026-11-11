use async_trait::async_trait;
use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::models::*;
use crate::domain::errors::DomainResult;

// ==========================================
// Segregated Repository Traits (ISP)
// Each use-case service depends strictly on the
// narrow repository interface(s) it requires.
// ==========================================

#[async_trait]
pub trait PropertyRepository: Send + Sync {
    async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>>;
    async fn get_property(&self, id: Uuid) -> DomainResult<Option<Property>>;
    async fn create_property(&self, property: Property) -> DomainResult<Property>;
    async fn update_property(&self, property: Property) -> DomainResult<Property>;
    async fn delete_property(&self, id: Uuid) -> DomainResult<()>;
    async fn count_property_units(&self, property_id: Uuid) -> DomainResult<i64>;
}

#[async_trait]
pub trait UnitRepository: Send + Sync {
    async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>>;
    async fn get_unit(&self, id: Uuid) -> DomainResult<Option<Unit>>;
    async fn create_unit(&self, unit: Unit) -> DomainResult<Unit>;
    async fn update_unit(&self, unit: Unit) -> DomainResult<Unit>;
    async fn delete_unit(&self, id: Uuid) -> DomainResult<()>;
    async fn set_unit_status(&self, unit_id: Uuid, status: UnitStatus) -> DomainResult<()>;
    async fn sync_unit_tenants(&self, unit_id: Uuid, tenant_ids: &[Uuid]) -> DomainResult<()>;
    async fn count_active_tenants_for_unit(
        &self,
        unit_id: Uuid,
        exclude_tenant_id: Option<Uuid>,
    ) -> DomainResult<i64>;
}

#[async_trait]
pub trait TenantRepository: Send + Sync {
    async fn list_tenants(
        &self,
        property_id: Option<Uuid>,
        status: Option<TenantStatus>,
        query: Option<String>,
    ) -> DomainResult<Vec<TenantWithUnit>>;
    async fn get_tenant(&self, id: Uuid) -> DomainResult<Option<TenantWithUnit>>;
    async fn create_tenant(&self, tenant: Tenant) -> DomainResult<Tenant>;
    async fn update_tenant(&self, tenant: Tenant) -> DomainResult<Tenant>;
    async fn delete_tenant(&self, id: Uuid) -> DomainResult<()>;
}

#[async_trait]
pub trait AdminAmenityRepository: Send + Sync {
    async fn list_amenities_by_property(&self, property_id: Uuid) -> DomainResult<Vec<AdminAmenity>>;
    async fn get_amenity(&self, id: Uuid) -> DomainResult<Option<AdminAmenity>>;
    async fn create_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity>;
    async fn update_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity>;
    async fn delete_amenity(&self, id: Uuid) -> DomainResult<()>;
}

#[async_trait]
pub trait ParkingLayoutRepository: Send + Sync {
    async fn get_parking_layout(&self, property_id: Uuid) -> DomainResult<Option<ParkingLayoutWithSpots>>;
    async fn save_parking_layout(
        &self,
        property_id: Uuid,
        canvas_width: i32,
        canvas_height: i32,
        grid_size: i32,
        spots: Vec<ParkingSpot>,
    ) -> DomainResult<ParkingLayoutWithSpots>;
}

#[async_trait]
pub trait MaintenanceCallRepository: Send + Sync {
    async fn list_maintenance_calls(
        &self,
        tenant_id: Option<Uuid>,
        property_id: Option<Uuid>,
        status: Option<String>,
    ) -> DomainResult<Vec<MaintenanceCall>>;
    async fn get_maintenance_call(&self, id: Uuid) -> DomainResult<Option<MaintenanceCall>>;
    async fn create_maintenance_call(&self, call: MaintenanceCall) -> DomainResult<MaintenanceCall>;
    async fn update_maintenance_call_status(
        &self,
        id: Uuid,
        status: &str,
        resolution_notes: Option<String>,
    ) -> DomainResult<MaintenanceCall>;
    async fn cancel_maintenance_call(&self, id: Uuid) -> DomainResult<()>;
    async fn assign_maintenance_call_staff(
        &self,
        call_id: Uuid,
        staff_id: Uuid,
        scheduled_date: Option<DateTime<Utc>>,
        resolution_notes: Option<String>,
    ) -> DomainResult<MaintenanceCall>;
}

#[async_trait]
pub trait TenantReservationRepository: Send + Sync {
    async fn list_tenant_reservations(
        &self,
        tenant_id: Option<Uuid>,
    ) -> DomainResult<Vec<TenantReservation>>;
    async fn create_tenant_reservation(&self, res: TenantReservation) -> DomainResult<TenantReservation>;
    async fn cancel_tenant_reservation(&self, id: Uuid) -> DomainResult<()>;
}

#[async_trait]
pub trait PropertyStaffRepository: Send + Sync {
    async fn list_property_staff(
        &self,
        property_id: Option<Uuid>,
        role: Option<String>,
    ) -> DomainResult<Vec<PropertyStaff>>;
    async fn get_property_staff(&self, id: Uuid) -> DomainResult<Option<PropertyStaff>>;
    async fn create_property_staff(&self, staff: PropertyStaff) -> DomainResult<PropertyStaff>;
    async fn update_property_staff(&self, staff: PropertyStaff) -> DomainResult<PropertyStaff>;
    async fn delete_property_staff(&self, id: Uuid) -> DomainResult<()>;
}

/// Composed supertrait combining all domain repository capabilities.
/// Blanket-implemented for any adapter providing all segregated traits.
pub trait AdminRepository:
    PropertyRepository
    + UnitRepository
    + TenantRepository
    + AdminAmenityRepository
    + ParkingLayoutRepository
    + MaintenanceCallRepository
    + TenantReservationRepository
    + PropertyStaffRepository
    + Send
    + Sync
{
}

impl<T> AdminRepository for T where
    T: PropertyRepository
        + UnitRepository
        + TenantRepository
        + AdminAmenityRepository
        + ParkingLayoutRepository
        + MaintenanceCallRepository
        + TenantReservationRepository
        + PropertyStaffRepository
        + Send
        + Sync
{
}

