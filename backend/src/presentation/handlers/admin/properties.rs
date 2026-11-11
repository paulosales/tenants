use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use uuid::Uuid;

use crate::{
    application::admin_service::{CreatePropertyRequest, UpdatePropertyRequest},
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

pub async fn list_properties(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Response> {
    let properties = state.admin_service.properties.list_properties().await?;
    let scoped: Vec<_> = properties
        .into_iter()
        .filter(|p| user.has_property_access(p.id))
        .collect();
    Ok(Json(scoped).into_response())
}

pub async fn get_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.has_property_access(id) {
        return Err(DomainError::Forbidden);
    }
    let property = state.admin_service.properties.get_property(id).await?;
    Ok(Json(property).into_response())
}

pub async fn create_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreatePropertyRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || user.property_id.is_some() {
        return Err(DomainError::Forbidden);
    }
    let property = state.admin_service.properties.create_property(req).await?;
    Ok((StatusCode::CREATED, Json(property)).into_response())
}

pub async fn update_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdatePropertyRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(id) {
        return Err(DomainError::Forbidden);
    }
    let property = state.admin_service.properties.update_property(id, req).await?;
    Ok(Json(property).into_response())
}

pub async fn delete_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(id) {
        return Err(DomainError::Forbidden);
    }
    state.admin_service.properties.delete_property(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

