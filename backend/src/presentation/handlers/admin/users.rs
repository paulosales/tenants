use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::{CreateAdminUserRequest, UpdateAdminUserRequest},
    domain::{
        errors::{DomainError, DomainResult},
        user::Role,
    },
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct ListAdminUsersQuery {
    pub role: Option<Role>,
    pub property_id: Option<Uuid>,
    pub q: Option<String>,
}

pub async fn list_admin_users(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<ListAdminUsersQuery>,
) -> DomainResult<Response> {
    if !user.role.is_admin() {
        return Err(DomainError::Forbidden);
    }

    let users = state
        .admin_service
        .list_admin_users(q.role, q.property_id, q.q)
        .await?;
    Ok(Json(users).into_response())
}

pub async fn list_roles(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Response> {
    if !user.role.is_admin() {
        return Err(DomainError::Forbidden);
    }

    let roles = state.admin_service.list_roles().await?;
    Ok(Json(roles).into_response())
}

pub async fn get_admin_user(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.is_admin() {
        return Err(DomainError::Forbidden);
    }

    let found = state.admin_service.get_admin_user(id).await?;
    Ok(Json(found).into_response())
}

pub async fn create_admin_user(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreateAdminUserRequest>,
) -> DomainResult<Response> {
    if !user.role.is_admin() {
        return Err(DomainError::Forbidden);
    }

    let created = state.admin_service.create_admin_user(req).await?;
    Ok((StatusCode::CREATED, Json(created)).into_response())
}

pub async fn update_admin_user(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAdminUserRequest>,
) -> DomainResult<Response> {
    if !user.role.is_admin() {
        return Err(DomainError::Forbidden);
    }

    let updated = state
        .admin_service
        .update_admin_user(user.id, id, req)
        .await?;
    Ok(Json(updated).into_response())
}

pub async fn delete_admin_user(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.is_admin() {
        return Err(DomainError::Forbidden);
    }

    state.admin_service.delete_admin_user(user.id, id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

