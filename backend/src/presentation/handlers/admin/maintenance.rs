use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::{
        AssignMaintenanceCallStaffRequest, CreateMaintenanceCallRequest,
        UpdateMaintenanceCallStatusRequest,
    },
    domain::errors::DomainResult,
    presentation::middleware::auth::AppState,
};

#[derive(Debug, Deserialize)]
pub struct MaintenanceQuery {
    pub tenant_id: Option<Uuid>,
    pub property_id: Option<Uuid>,
    pub status: Option<String>,
}

pub async fn list_maintenance_calls(
    State(state): State<AppState>,
    Query(q): Query<MaintenanceQuery>,
) -> DomainResult<Response> {
    let calls = state
        .admin_service
        .maintenance
        .list_maintenance_calls(q.tenant_id, q.property_id, q.status)
        .await?;
    Ok(Json(calls).into_response())
}

pub async fn get_maintenance_call(State(state): State<AppState>, Path(id): Path<Uuid>) -> DomainResult<Response> {
    let call = state.admin_service.maintenance.get_maintenance_call(id).await?;
    Ok(Json(call).into_response())
}

pub async fn create_maintenance_call(
    State(state): State<AppState>,
    Json(req): Json<CreateMaintenanceCallRequest>,
) -> DomainResult<Response> {
    let call = state.admin_service.maintenance.create_maintenance_call(req).await?;
    Ok((StatusCode::CREATED, Json(call)).into_response())
}

pub async fn update_maintenance_call_status(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateMaintenanceCallStatusRequest>,
) -> DomainResult<Response> {
    let call = state
        .admin_service
        .maintenance
        .update_maintenance_call_status(id, req)
        .await?;
    Ok(Json(call).into_response())
}

pub async fn cancel_maintenance_call(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state.admin_service.maintenance.cancel_maintenance_call(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn assign_maintenance_call_staff(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<AssignMaintenanceCallStaffRequest>,
) -> DomainResult<Response> {
    let call = state
        .admin_service
        .maintenance
        .assign_maintenance_call_staff(id, req)
        .await?;
    Ok(Json(call).into_response())
}

