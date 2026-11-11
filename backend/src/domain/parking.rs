use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpotStatus {
    Vacant,
    Reserved,
    Occupied,
    Maintenance,
}

impl std::fmt::Display for SpotStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            SpotStatus::Vacant => "vacant",
            SpotStatus::Reserved => "reserved",
            SpotStatus::Occupied => "occupied",
            SpotStatus::Maintenance => "maintenance",
        };
        f.write_str(s)
    }
}

impl From<String> for SpotStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "vacant" => SpotStatus::Vacant,
            "reserved" => SpotStatus::Reserved,
            "occupied" => SpotStatus::Occupied,
            "maintenance" => SpotStatus::Maintenance,
            _ => SpotStatus::Vacant,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpotType {
    Standard,
    Compact,
    EvCharging,
    Accessible,
}

impl std::fmt::Display for SpotType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            SpotType::Standard => "standard",
            SpotType::Compact => "compact",
            SpotType::EvCharging => "ev_charging",
            SpotType::Accessible => "accessible",
        };
        f.write_str(s)
    }
}

impl From<String> for SpotType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "standard" => SpotType::Standard,
            "compact" => SpotType::Compact,
            "ev_charging" => SpotType::EvCharging,
            "accessible" => SpotType::Accessible,
            _ => SpotType::Standard,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ShapeType {
    Rect,
    Polygon,
}

impl std::fmt::Display for ShapeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let s = match self {
            ShapeType::Rect => "rect",
            ShapeType::Polygon => "polygon",
        };
        f.write_str(s)
    }
}

impl From<String> for ShapeType {
    fn from(s: String) -> Self {
        match s.as_str() {
            "rect" => ShapeType::Rect,
            "polygon" => ShapeType::Polygon,
            _ => ShapeType::Rect,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum GeometryCoordinates {
    Rect {
        x: f64,
        y: f64,
        width: f64,
        height: f64,
        #[serde(default)]
        rotation: f64,
    },
    Polygon {
        points: Vec<[f64; 2]>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingZone {
    pub id: Uuid,
    pub name: String,
    pub floor_level: i32,
    pub svg_viewbox: String,
    pub svg_raw: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingSpot {
    pub id: Uuid,
    pub zone_id: Uuid,
    pub spot_number: String,
    pub spot_type: SpotType,
    pub shape_type: ShapeType,
    pub coordinates: GeometryCoordinates,
    pub hourly_rate_cents: i32,
    pub monthly_rate_cents: i32,
    pub status: SpotStatus,
    pub assigned_tenant_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingSpotNode {
    pub id: Uuid,
    pub spot_number: String,
    pub spot_type: SpotType,
    pub shape: ShapeType,
    pub coordinates: GeometryCoordinates,
    pub status: SpotStatus,
    pub hourly_rate_cents: i32,
    pub monthly_rate_cents: i32,
    pub assigned_tenant_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParkingLayoutResponse {
    pub zone: ParkingZone,
    pub spots: Vec<ParkingSpotNode>,
}
