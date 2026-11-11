use axum::{
    extract::{Path, State},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    application::admin_service::{AssignParkingSpotRequest, SaveParkingLayoutRequest},
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

pub async fn get_parking_layout(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let layout = state
        .admin_service
        .get_parking_layout_for_viewer(&user, property_id)
        .await?;
    Ok(Json(layout).into_response())
}

pub async fn save_parking_layout(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
    Json(req): Json<SaveParkingLayoutRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let layout = state.admin_service.parking_layouts.save_parking_layout(property_id, req).await?;
    Ok(Json(json!({
        "message": "Parking layout and spots saved successfully",
        "data": layout
    }))
    .into_response())
}

pub async fn assign_parking_spot(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(spot_id): Path<Uuid>,
    Json(req): Json<AssignParkingSpotRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let spot_property_id = state
        .admin_service
        .get_parking_spot_property_id(spot_id)
        .await?;
    if !user.has_property_access(spot_property_id) {
        return Err(DomainError::Forbidden);
    }
    let spot = state.admin_service.assign_parking_spot(spot_id, req).await?;
    Ok(Json(spot).into_response())
}

