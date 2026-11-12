use axum::{
    extract::{Path, Query, State},
    Json,
};
use uuid::Uuid;

use crate::application::dtos::CheckAvailabilityQuery;
use crate::domain::amenity::Amenity;
use crate::domain::errors::DomainResult;
use crate::domain::reservation::Reservation;
use crate::presentation::middleware::auth::{AppState, AuthenticatedUser};

pub async fn list_amenities(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Json<Vec<Amenity>>> {
    let list = state
        .reservation_service
        .list_amenities_for_viewer(&user)
        .await?;
    Ok(Json(list))
}

pub async fn get_amenity(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Json<Amenity>> {
    let amenity = state
        .reservation_service
        .get_amenity_for_viewer(&user, id)
        .await?;
    Ok(Json(amenity))
}

pub async fn check_availability(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(query): Query<CheckAvailabilityQuery>,
) -> DomainResult<Json<Vec<Reservation>>> {
    let reservations = state
        .reservation_service
        .check_availability_for_viewer(&user, query)
        .await?;
    Ok(Json(reservations))
}
