use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
pub struct UnitTenantSummary {
    pub id: Uuid,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
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
    #[serde(default)]
    pub tenants: Vec<UnitTenantSummary>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceCall {
    pub id: Uuid,
    pub ticket_number: String,
    pub tenant_id: Uuid,
    pub tenant_name: Option<String>,
    pub property_id: Uuid,
    pub property_name: Option<String>,
    pub unit_number: String,
    pub category: String,
    pub priority: String,
    pub title: String,
    pub description: String,
    pub permission_to_enter: bool,
    pub preferred_time_window: String,
    pub contact_phone: String,
    pub status: String,
    pub assigned_staff_id: Option<Uuid>,
    pub assigned_technician: Option<String>,
    pub technician_phone: Option<String>,
    pub scheduled_date: Option<DateTime<Utc>>,
    pub resolution_notes: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyStaff {
    pub id: Uuid,
    pub property_id: Uuid,
    pub property_name: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    pub title: String,
    pub email: String,
    pub phone: String,
    pub specialization: Option<String>,
    pub shift: String,
    pub status: String,
    pub assigned_calls_count: i64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TenantReservation {
    pub id: Uuid,
    pub amenity_id: Uuid,
    pub amenity_name: String,
    pub tenant_id: Uuid,
    pub tenant_name: Option<String>,
    pub property_id: Option<Uuid>,
    pub unit_number: Option<String>,
    pub booking_date: Option<String>,
    pub start_time: DateTime<Utc>,
    pub end_time: DateTime<Utc>,
    pub attendees_count: i32,
    pub total_price_cents: i32,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: DateTime<Utc>,
}

