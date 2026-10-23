use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::application::dtos::CreateReservationRequest;
use crate::domain::errors::DomainResult;
use crate::domain::reservation::ReservationWithDetails;
use crate::presentation::middleware::auth::{AppState, AuthenticatedUser};

pub async fn create_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    headers: HeaderMap,
    Json(req): Json<CreateReservationRequest>,
) -> DomainResult<impl IntoResponse> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let reservation = state
        .reservation_service
        .create_reservation(&user, req, client_ip, user_agent)
        .await?;

    Ok((StatusCode::CREATED, Json(reservation)))
}

pub async fn list_my_reservations(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Json<Vec<ReservationWithDetails>>> {
    let list = state.reservation_service.list_user_reservations(user.id).await?;
    Ok(Json(list))
}

pub async fn cancel_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> DomainResult<StatusCode> {
    let client_ip = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    let user_agent = headers
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string());

    state
        .reservation_service
        .cancel_reservation(&user, id, client_ip, user_agent)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
