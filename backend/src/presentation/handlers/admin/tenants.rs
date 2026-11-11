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
    domain::{admin::TenantStatus, errors::DomainResult},
    presentation::middleware::auth::AppState,
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
    Query(query): Query<ListTenantsQuery>,
) -> DomainResult<Response> {
    let status_enum = query.status.as_deref().map(TenantStatus::from_str);
    let search_query = query.q.or(query.search);
    let tenants = state
        .admin_service
        .tenants
        .list_tenants(query.property_id, status_enum, search_query)
        .await?;
    Ok(Json(tenants).into_response())
}

pub async fn get_tenant(State(state): State<AppState>, Path(id): Path<Uuid>) -> DomainResult<Response> {
    let tenant = state.admin_service.tenants.get_tenant(id).await?;
    Ok(Json(tenant).into_response())
}

pub async fn create_tenant(
    State(state): State<AppState>,
    Json(req): Json<CreateTenantRequest>,
) -> DomainResult<Response> {
    let tenant = state.admin_service.tenants.create_tenant(req).await?;
    Ok((StatusCode::CREATED, Json(tenant)).into_response())
}

pub async fn update_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTenantRequest>,
) -> DomainResult<Response> {
    let tenant = state.admin_service.tenants.update_tenant(id, req).await?;
    Ok(Json(tenant).into_response())
}

pub async fn delete_tenant(State(state): State<AppState>, Path(id): Path<Uuid>) -> DomainResult<Response> {
    state.admin_service.tenants.delete_tenant(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

