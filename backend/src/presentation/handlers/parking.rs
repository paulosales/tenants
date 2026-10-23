use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::application::dtos::{ReserveSpotRequest, UpdateSvgLayoutRequest, UpsertSpotRequest};
use crate::domain::errors::DomainResult;
use crate::domain::parking::{ParkingLayoutResponse, ParkingSpot, ParkingZone};
use crate::presentation::middleware::auth::{AppState, AuthenticatedUser};

pub async fn list_zones(
    State(state): State<AppState>,
) -> DomainResult<Json<Vec<ParkingZone>>> {
    let zones = state.parking_service.list_zones().await?;
    Ok(Json(zones))
}

pub async fn get_zone_layout(
    State(state): State<AppState>,
    Path(zone_id): Path<Uuid>,
) -> DomainResult<Json<ParkingLayoutResponse>> {
    let layout = state.parking_service.get_layout(zone_id).await?;
    Ok(Json(layout))
}

pub async fn reserve_spot(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    headers: HeaderMap,
    Json(req): Json<ReserveSpotRequest>,
) -> DomainResult<impl IntoResponse> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    state
        .parking_service
        .reserve_spot(&user, req.spot_id, client_ip, user_agent)
        .await?;

    Ok((StatusCode::OK, Json(json!({ "message": "Parking spot reserved successfully" }))))
}

pub async fn upsert_spot(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<UpsertSpotRequest>,
) -> DomainResult<Json<ParkingSpot>> {
    let spot = state.parking_service.upsert_spot(&user, req).await?;
    Ok(Json(spot))
}

pub async fn upload_svg_layout(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(zone_id): Path<Uuid>,
    Json(req): Json<UpdateSvgLayoutRequest>,
) -> DomainResult<impl IntoResponse> {
    let sanitized = state
        .parking_service
        .upload_and_sanitize_svg(&user, zone_id, &req.svg_markup)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({
            "message": "SVG layout validated and stored successfully",
            "svg": sanitized
        })),
    ))
}
