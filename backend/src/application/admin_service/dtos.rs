use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::{
    admin::{SpotType, TenantStatus, UnitStatus},
    user::Role,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreatePropertyRequest {
    pub name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state_province: String,
    pub postal_code: String,
    pub rich_description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub pet_policy: Option<String>,
    pub lease_terms: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePropertyRequest {
    pub name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state_province: String,
    pub postal_code: String,
    pub rich_description: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub pet_policy: Option<String>,
    pub lease_terms: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddPropertyFeatureRequest {
    pub label: String,
    pub category: Option<String>,
    pub display_order: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateUnitRequest {
    pub unit_number: String,
    pub floor: i32,
    pub bedrooms: i32,
    pub bathrooms: f64,
    pub square_feet: i32,
    pub monthly_rent_cents: Option<i32>,
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
    pub monthly_rent_cents: Option<i32>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignParkingSpotRequest {
    pub tenant_id: Option<Uuid>,
    pub is_occupied: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewTenantReservationRequest {
    pub status: String,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTenancyApplicationRequest {
    pub property_id: Uuid,
    pub preferred_unit_id: Option<Uuid>,
    pub applicant_first_name: String,
    pub applicant_last_name: String,
    pub applicant_email: String,
    pub applicant_phone: String,
    pub monthly_income_cents: i64,
    pub employment_status: String,
    pub desired_move_in_date: Option<String>,
    pub occupants_count: i32,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewTenancyApplicationRequest {
    pub status: String,
    pub review_notes: Option<String>,
    pub onboard_as_tenant: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStaffMessageRequest {
    pub property_id: Uuid,
    pub recipient_staff_id: Option<Uuid>,
    pub recipient_user_id: Option<Uuid>,
    pub body: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAdminUserRequest {
    pub email: String,
    pub password: String,
    pub full_name: String,
    pub role: Role,
    pub phone: Option<String>,
    pub unit_number: Option<String>,
    pub property_id: Option<Uuid>,
    pub tenant_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAdminUserRequest {
    pub email: Option<String>,
    pub password: Option<String>,
    pub full_name: Option<String>,
    pub role: Option<Role>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub phone: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub unit_number: Option<Option<String>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub property_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub tenant_id: Option<Option<Uuid>>,
    #[serde(default, deserialize_with = "deserialize_optional_nullable")]
    pub staff_id: Option<Option<Uuid>>,
    pub is_active: Option<bool>,
}

fn deserialize_optional_nullable<'de, D, T>(deserializer: D) -> Result<Option<Option<T>>, D::Error>
where
    D: serde::Deserializer<'de>,
    T: serde::Deserialize<'de>,
{
    Ok(Some(Option::<T>::deserialize(deserializer)?))
}

