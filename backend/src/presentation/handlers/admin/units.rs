use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use uuid::Uuid;

use crate::{
    application::admin_service::{CreateUnitRequest, UpdateUnitRequest},
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

pub async fn list_units(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_perform_maintenance() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let units = state.admin_service.units.list_units_by_property(property_id).await?;
    Ok(Json(units).into_response())
}

pub async fn create_unit(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
    Json(req): Json<CreateUnitRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let unit = state.admin_service.units.create_unit(property_id, req).await?;
    Ok((StatusCode::CREATED, Json(unit)).into_response())
}

pub async fn update_unit(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUnitRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.units.get_unit(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    let unit = state.admin_service.units.update_unit(id, req).await?;
    Ok(Json(unit).into_response())
}

pub async fn delete_unit(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.units.get_unit(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    state.admin_service.units.delete_unit(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

