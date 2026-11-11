use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use uuid::Uuid;

use crate::{
    application::admin_service::{CreateUnitRequest, UpdateUnitRequest},
    domain::errors::DomainResult,
    presentation::middleware::auth::AppState,
};

pub async fn list_units(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    let units = state.admin_service.units.list_units_by_property(property_id).await?;
    Ok(Json(units).into_response())
}

pub async fn create_unit(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
    Json(req): Json<CreateUnitRequest>,
) -> DomainResult<Response> {
    let unit = state.admin_service.units.create_unit(property_id, req).await?;
    Ok((StatusCode::CREATED, Json(unit)).into_response())
}

pub async fn update_unit(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUnitRequest>,
) -> DomainResult<Response> {
    let unit = state.admin_service.units.update_unit(id, req).await?;
    Ok(Json(unit).into_response())
}

pub async fn delete_unit(State(state): State<AppState>, Path(id): Path<Uuid>) -> DomainResult<Response> {
    state.admin_service.units.delete_unit(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

