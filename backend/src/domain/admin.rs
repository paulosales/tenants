use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::errors::DomainResult;

// ==========================================
// 1. Enums
// ==========================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum UnitStatus {
    Vacant,
    Occupied,
    Maintenance,
}

impl UnitStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Vacant => "vacant",
            Self::Occupied => "occupied",
            Self::Maintenance => "maintenance",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "occupied" => Self::Occupied,
            "maintenance" => Self::Maintenance,
            _ => Self::Vacant,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TenantStatus {
    Active,
    Past,
    Applicant,
}

impl TenantStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::Past => "past",
            Self::Applicant => "applicant",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "past" => Self::Past,
            "applicant" => Self::Applicant,
            _ => Self::Active,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpotType {
    Standard,
    Compact,
    EvCharging,
    Handicap,
}

impl SpotType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Standard => "standard",
            Self::Compact => "compact",
            Self::EvCharging => "ev_charging",
            Self::Handicap => "handicap",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "compact" => Self::Compact,
            "ev_charging" => Self::EvCharging,
            "handicap" | "accessible" => Self::Handicap,
            _ => Self::Standard,
        }
    }
}

// ==========================================
// 2. Entities
// ==========================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Property {
    pub id: Uuid,
    pub name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state_province: String,
    pub postal_code: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyWithStats {
    pub id: Uuid,
    pub name: String,
    pub address_line1: String,
    pub address_line2: Option<String>,
    pub city: String,
    pub state_province: String,
    pub postal_code: String,
    pub unit_count: i64,
    pub occupied_units_count: i64,
    pub tenant_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unit {
    pub id: Uuid,
    pub property_id: Uuid,
    pub unit_number: String,
    pub floor: i32,
    pub bedrooms: i32,
    pub bathrooms: f64,
    pub square_feet: i32,
    pub status: UnitStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnitWithTenant {
    pub id: Uuid,
    pub property_id: Uuid,
    pub unit_number: String,
    pub floor: i32,
    pub bedrooms: i32,
    pub bathrooms: f64,
    pub square_feet: i32,
    pub status: UnitStatus,
    pub tenant_id: Option<Uuid>,
    pub tenant_name: Option<String>,
    pub tenant_email: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Tenant {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub assigned_unit_id: Option<Uuid>,
    pub lease_start_date: Option<NaiveDate>,
    pub lease_end_date: Option<NaiveDate>,
    pub status: TenantStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantWithUnit {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub emergency_contact_name: Option<String>,
    pub emergency_contact_phone: Option<String>,
    pub assigned_unit_id: Option<Uuid>,
    pub unit_number: Option<String>,
    pub property_id: Option<Uuid>,
    pub property_name: Option<String>,
    pub lease_start_date: Option<NaiveDate>,
    pub lease_end_date: Option<NaiveDate>,
    pub status: TenantStatus,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminAmenity {
    pub id: Uuid,
    pub property_id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub capacity: i32,
    pub fee_cents: i32,
    pub deposit_cents: i32,
    pub rules: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingLayout {
    pub id: Uuid,
    pub property_id: Uuid,
    pub canvas_width: i32,
    pub canvas_height: i32,
    pub grid_size: i32,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingSpot {
    pub id: Uuid,
    pub layout_id: Uuid,
    pub spot_label: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub rotation: f64,
    pub spot_type: SpotType,
    pub is_occupied: bool,
    pub assigned_tenant_id: Option<Uuid>,
    pub tenant_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingLayoutWithSpots {
    pub layout: ParkingLayout,
    pub spots: Vec<ParkingSpot>,
}

// ==========================================
// 3. Admin Repository Trait
// ==========================================

#[async_trait]
pub trait AdminRepository: Send + Sync {
    // Properties
    async fn list_properties(&self) -> DomainResult<Vec<PropertyWithStats>>;
    async fn get_property(&self, id: Uuid) -> DomainResult<Option<Property>>;
    async fn create_property(&self, property: Property) -> DomainResult<Property>;
    async fn update_property(&self, property: Property) -> DomainResult<Property>;
    async fn delete_property(&self, id: Uuid) -> DomainResult<()>;
    async fn count_property_units(&self, property_id: Uuid) -> DomainResult<i64>;

    // Units
    async fn list_units_by_property(&self, property_id: Uuid) -> DomainResult<Vec<UnitWithTenant>>;
    async fn get_unit(&self, id: Uuid) -> DomainResult<Option<Unit>>;
    async fn create_unit(&self, unit: Unit) -> DomainResult<Unit>;
    async fn update_unit(&self, unit: Unit) -> DomainResult<Unit>;
    async fn delete_unit(&self, id: Uuid) -> DomainResult<()>;
    async fn set_unit_status(&self, unit_id: Uuid, status: UnitStatus) -> DomainResult<()>;

    // Tenants
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

    // Amenities
    async fn list_amenities_by_property(&self, property_id: Uuid) -> DomainResult<Vec<AdminAmenity>>;
    async fn get_amenity(&self, id: Uuid) -> DomainResult<Option<AdminAmenity>>;
    async fn create_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity>;
    async fn update_amenity(&self, amenity: AdminAmenity) -> DomainResult<AdminAmenity>;
    async fn delete_amenity(&self, id: Uuid) -> DomainResult<()>;

    // Parking Layout & Spots
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
