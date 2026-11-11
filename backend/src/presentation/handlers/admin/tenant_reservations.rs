use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::CreateTenantReservationRequest,
    domain::errors::DomainResult,
    presentation::middleware::auth::AppState,
};

#[derive(Debug, Deserialize)]
pub struct TenantReservationQuery {
    pub tenant_id: Option<Uuid>,
}

pub async fn list_tenant_reservations(
    State(state): State<AppState>,
    Query(q): Query<TenantReservationQuery>,
) -> DomainResult<Response> {
    let res = state
        .admin_service
        .reservations
        .list_tenant_reservations(q.tenant_id)
        .await?;
    Ok(Json(res).into_response())
}

pub async fn create_tenant_reservation(
    State(state): State<AppState>,
    Json(req): Json<CreateTenantReservationRequest>,
) -> DomainResult<Response> {
    let res = state
        .admin_service
        .reservations
        .create_tenant_reservation(req)
        .await?;
    Ok((StatusCode::CREATED, Json(res)).into_response())
}

pub async fn cancel_tenant_reservation(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state.admin_service.reservations.cancel_tenant_reservation(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

