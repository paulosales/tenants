use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::CreateStaffMessageRequest,
    domain::{
        errors::{DomainError, DomainResult},
        user::Role,
    },
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub property_id: Option<Uuid>,
    pub staff_id: Option<Uuid>,
}

pub async fn list_staff_messages(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<MessagesQuery>,
) -> DomainResult<Response> {
    if !user.role.can_access_staff_messages() {
        return Err(DomainError::Forbidden);
    }

    let property_id = user
        .enforce_property_scope(q.property_id)?
        .ok_or_else(|| DomainError::ValidationError("property_id is required".into()))?;

    // Staff & Maintainers are scoped to their own direct messages and property broadcasts
    let effective_staff_id = match user.role {
        Role::Staff | Role::MaintenanceStaff => user.staff_id,
        _ => q.staff_id,
    };

    let msgs = state
        .admin_service
        .list_messages(property_id, effective_staff_id)
        .await?;
    Ok(Json(msgs).into_response())
}

pub async fn send_staff_message(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreateStaffMessageRequest>,
) -> DomainResult<Response> {
    if !user.role.can_access_staff_messages() {
        return Err(DomainError::Forbidden);
    }
    if !user.has_property_access(req.property_id) {
        return Err(DomainError::Forbidden);
    }

    let created = state.admin_service.send_message(&user, req).await?;
    Ok((StatusCode::CREATED, Json(created)).into_response())
}

pub async fn mark_staff_message_read(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_access_staff_messages() {
        return Err(DomainError::Forbidden);
    }

    let updated = state.admin_service.mark_message_read(&user, id).await?;
    Ok(Json(updated).into_response())
}

