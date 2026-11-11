use axum::{
    extract::{Path, State},
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    application::admin_service::SaveParkingLayoutRequest,
    domain::errors::DomainResult,
    presentation::middleware::auth::AppState,
};

pub async fn get_parking_layout(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    let layout = state.admin_service.parking_layouts.get_parking_layout(property_id).await?;
    Ok(Json(layout).into_response())
}

pub async fn save_parking_layout(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
    Json(req): Json<SaveParkingLayoutRequest>,
) -> DomainResult<Response> {
    let layout = state.admin_service.parking_layouts.save_parking_layout(property_id, req).await?;
    Ok(Json(json!({
        "message": "Parking layout and spots saved successfully",
        "data": layout
    }))
    .into_response())
}

