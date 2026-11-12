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
        AmenityCalendarQuery, CreateTenantReservationRequest, ReviewTenantReservationRequest,
    },
    domain::errors::DomainResult,
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct TenantReservationQuery {
    pub tenant_id: Option<Uuid>,
}

pub async fn list_amenity_calendar(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<AmenityCalendarQuery>,
) -> DomainResult<Response> {
    let events = state
        .admin_service
        .list_amenity_calendar_for_viewer(&user, q)
        .await?;
    Ok(Json(events).into_response())
}

pub async fn list_tenant_reservations(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<TenantReservationQuery>,
) -> DomainResult<Response> {
    let scoped = state
        .admin_service
        .reservations
        .list_for_viewer(&user, q.tenant_id)
        .await?;
    Ok(Json(scoped).into_response())
}

pub async fn create_tenant_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreateTenantReservationRequest>,
) -> DomainResult<Response> {
    let res = state
        .admin_service
        .reservations
        .create_for_viewer(&user, req)
        .await?;
    Ok((StatusCode::CREATED, Json(res)).into_response())
}

pub async fn cancel_tenant_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state
        .admin_service
        .reservations
        .cancel_for_viewer(&user, id)
        .await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn review_tenant_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<ReviewTenantReservationRequest>,
) -> DomainResult<Response> {
    let res = state
        .admin_service
        .reservations
        .review_for_viewer(&user, id, req)
        .await?;
    Ok(Json(res).into_response())
}
