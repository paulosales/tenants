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
    let scoped_property_id = user.enforce_property_scope(query.property_id)?;
    let status_enum = query.status.as_deref().map(TenantStatus::from_str);
    let search_query = query.q.or(query.search);
    let tenants = state
        .admin_service
        .tenants
        .list_tenants(scoped_property_id, status_enum, search_query)
        .await?;
    Ok(Json(tenants).into_response())
}

pub async fn get_tenant(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let is_self = user.tenant_id == Some(id);
    if !user.role.can_manage_properties() && !is_self {
        return Err(DomainError::Forbidden);
    }
    let tenant = state.admin_service.tenants.get_tenant(id).await?;
    if !is_self {
        if let Some(pid) = tenant.property_id {
            if !user.has_property_access(pid) {
                return Err(DomainError::Forbidden);
            }
        }
    }
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
    if let Some(unit_id) = req.assigned_unit_id {
        let unit = state.admin_service.units.get_unit(unit_id).await?;
        if !user.has_property_access(unit.property_id) {
            return Err(DomainError::Forbidden);
        }
    } else if user.property_id.is_some() {
        return Err(DomainError::ValidationError(
            "Property managers must assign the tenant to a unit within their property".into(),
        ));
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
    let existing = state.admin_service.tenants.get_tenant(id).await?;
    if let Some(pid) = existing.property_id {
        if !user.has_property_access(pid) {
            return Err(DomainError::Forbidden);
        }
    }
    if let Some(new_unit_id) = req.assigned_unit_id {
        let unit = state.admin_service.units.get_unit(new_unit_id).await?;
        if !user.has_property_access(unit.property_id) {
            return Err(DomainError::Forbidden);
        }
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
    let existing = state.admin_service.tenants.get_tenant(id).await?;
    if let Some(pid) = existing.property_id {
        if !user.has_property_access(pid) {
            return Err(DomainError::Forbidden);
        }
    }
    state.admin_service.tenants.delete_tenant(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}
