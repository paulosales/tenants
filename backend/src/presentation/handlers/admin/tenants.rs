use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::{CreateTenantRequest, UpdateTenantRequest},
    domain::{
        admin::TenantStatus,
        errors::{DomainError, DomainResult},
    },
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct ListTenantsQuery {
    pub property_id: Option<Uuid>,
    pub status: Option<String>,
    pub q: Option<String>,
    pub search: Option<String>,
}

pub async fn list_tenants(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(query): Query<ListTenantsQuery>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let status_enum = query.status.as_deref().map(TenantStatus::from_str);
    let search_query = query.q.or(query.search);
    let tenants = state
        .admin_service
        .tenants
        .list_tenants(query.property_id, status_enum, search_query)
        .await?;
    Ok(Json(tenants).into_response())
}

pub async fn get_tenant(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() && user.tenant_id != Some(id) {
        return Err(DomainError::Forbidden);
    }
    let tenant = state.admin_service.tenants.get_tenant(id).await?;
    Ok(Json(tenant).into_response())
}

pub async fn create_tenant(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreateTenantRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let tenant = state.admin_service.tenants.create_tenant(req).await?;
    Ok((StatusCode::CREATED, Json(tenant)).into_response())
}

pub async fn update_tenant(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTenantRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let tenant = state.admin_service.tenants.update_tenant(id, req).await?;
    Ok(Json(tenant).into_response())
}

pub async fn delete_tenant(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    state.admin_service.tenants.delete_tenant(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

