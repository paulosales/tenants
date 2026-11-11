use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::admin::{SpotType, TenantStatus, UnitStatus};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMaintenanceCallRequest {
    pub tenant_id: Option<Uuid>,
    pub property_id: Option<Uuid>,
    pub unit_number: String,
    pub category: String,
    pub priority: Option<String>,
    pub title: String,
    pub description: String,
    pub permission_to_enter: Option<bool>,
    pub preferred_time_window: Option<String>,
    pub contact_phone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateMaintenanceCallStatusRequest {
    pub status: String,
    pub resolution_notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTenantReservationRequest {
    pub amenity_id: Uuid,
    pub tenant_id: Option<Uuid>,
    pub booking_date: Option<String>,
    pub start_time: String,
    pub end_time: String,
    pub attendees_count: Option<i32>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePropertyStaffRequest {
    pub property_id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub title: String,
    pub email: String,
    pub phone: String,
    pub specialization: Option<String>,
    pub shift: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePropertyStaffRequest {
    pub property_id: Option<Uuid>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub role: Option<String>,
    pub title: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub specialization: Option<String>,
    pub shift: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignMaintenanceCallStaffRequest {
    pub staff_id: Uuid,
    pub scheduled_date: Option<String>,
    pub resolution_notes: Option<String>,
}

