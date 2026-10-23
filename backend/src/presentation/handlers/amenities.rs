use axum::{
    extract::{Path, Query, State},
    Json,
};
use uuid::Uuid;

use crate::application::dtos::CheckAvailabilityQuery;
use crate::domain::amenity::Amenity;
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::reservation::Reservation;
use crate::presentation::middleware::auth::AppState;

pub async fn list_amenities(
    State(state): State<AppState>,
) -> DomainResult<Json<Vec<Amenity>>> {
    let list = state.amenity_repo.list_all().await?;
    Ok(Json(list))
}

pub async fn get_amenity(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Json<Amenity>> {
    let amenity = state
        .amenity_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| DomainError::NotFound("Amenity not found".into()))?;

    Ok(Json(amenity))
}

pub async fn check_availability(
    State(state): State<AppState>,
    Query(query): Query<CheckAvailabilityQuery>,
) -> DomainResult<Json<Vec<Reservation>>> {
    let reservations = state.reservation_service.check_availability(query).await?;
    Ok(Json(reservations))
}
