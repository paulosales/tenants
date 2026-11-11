use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use uuid::Uuid;

use crate::{
    application::admin_service::{CreateAmenityRequest, UpdateAmenityRequest},
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

pub async fn list_property_amenities(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let amenities = state
        .admin_service
        .amenities
        .list_amenities_by_property(property_id)
        .await?;
    Ok(Json(amenities).into_response())
}

pub async fn create_property_amenity(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
    Json(req): Json<CreateAmenityRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let amenity = state
        .admin_service
        .amenities
        .create_amenity(property_id, req)
        .await?;
    Ok((StatusCode::CREATED, Json(amenity)).into_response())
}

pub async fn update_amenity(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAmenityRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.amenities.get_amenity(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    let amenity = state
        .admin_service
        .amenities
        .update_amenity(id, req)
        .await?;
    Ok(Json(amenity).into_response())
}

pub async fn delete_amenity(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.amenities.get_amenity(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    state.admin_service.amenities.delete_amenity(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}
