use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::{CreatePropertyStaffRequest, UpdatePropertyStaffRequest},
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct StaffQuery {
    pub property_id: Option<Uuid>,
    pub role: Option<String>,
}

pub async fn list_property_staff(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<StaffQuery>,
) -> DomainResult<Response> {
    if !user.role.can_access_staff_messages() {
        return Err(DomainError::Forbidden);
    }
    let scoped_property_id = user.enforce_property_scope(q.property_id)?;
    let staff = state
        .admin_service
        .staff
        .list_property_staff(scoped_property_id, q.role)
        .await?;
    Ok(Json(staff).into_response())
}

pub async fn get_property_staff(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_access_staff_messages() {
        return Err(DomainError::Forbidden);
    }
    let staff = state.admin_service.staff.get_property_staff(id).await?;
    if !user.has_property_access(staff.property_id) {
        return Err(DomainError::Forbidden);
    }
    Ok(Json(staff).into_response())
}

pub async fn create_property_staff(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreatePropertyStaffRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(req.property_id) {
        return Err(DomainError::Forbidden);
    }
    let staff = state.admin_service.staff.create_property_staff(req).await?;
    Ok((StatusCode::CREATED, Json(staff)).into_response())
}

pub async fn update_property_staff(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdatePropertyStaffRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.staff.get_property_staff(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    if let Some(target_pid) = req.property_id {
        if !user.has_property_access(target_pid) {
            return Err(DomainError::Forbidden);
        }
    }
    let staff = state.admin_service.staff.update_property_staff(id, req).await?;
    Ok(Json(staff).into_response())
}

pub async fn delete_property_staff(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.staff.get_property_staff(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    state.admin_service.staff.delete_property_staff(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

