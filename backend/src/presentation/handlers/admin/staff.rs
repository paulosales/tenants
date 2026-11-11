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
    domain::errors::DomainResult,
    presentation::middleware::auth::AppState,
};

#[derive(Debug, Deserialize)]
pub struct StaffQuery {
    pub property_id: Option<Uuid>,
    pub role: Option<String>,
}

pub async fn list_property_staff(
    State(state): State<AppState>,
    Query(q): Query<StaffQuery>,
) -> DomainResult<Response> {
    let staff = state.admin_service.staff.list_property_staff(q.property_id, q.role).await?;
    Ok(Json(staff).into_response())
}

pub async fn get_property_staff(State(state): State<AppState>, Path(id): Path<Uuid>) -> DomainResult<Response> {
    let staff = state.admin_service.staff.get_property_staff(id).await?;
    Ok(Json(staff).into_response())
}

pub async fn create_property_staff(
    State(state): State<AppState>,
    Json(req): Json<CreatePropertyStaffRequest>,
) -> DomainResult<Response> {
    let staff = state.admin_service.staff.create_property_staff(req).await?;
    Ok((StatusCode::CREATED, Json(staff)).into_response())
}

pub async fn update_property_staff(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdatePropertyStaffRequest>,
) -> DomainResult<Response> {
    let staff = state.admin_service.staff.update_property_staff(id, req).await?;
    Ok(Json(staff).into_response())
}

pub async fn delete_property_staff(State(state): State<AppState>, Path(id): Path<Uuid>) -> DomainResult<Response> {
    state.admin_service.staff.delete_property_staff(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

