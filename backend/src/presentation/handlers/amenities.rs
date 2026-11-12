use axum::{
    extract::{Path, Query, State},
    Json,
};
use uuid::Uuid;

use crate::application::dtos::CheckAvailabilityQuery;
use crate::domain::amenity::Amenity;
use crate::domain::errors::{DomainError, DomainResult};
use crate::domain::reservation::Reservation;
use crate::presentation::middleware::auth::{AppState, AuthenticatedUser};

pub async fn list_amenities(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Json<Vec<Amenity>>> {
    let list = state
        .amenity_repo
        .list_all()
        .await?
        .into_iter()
        .filter(|a| {
            a.property_id
                .map(|p| user.has_property_access(p))
                .unwrap_or(true)
        })
        .collect();
    Ok(Json(list))
}

pub async fn get_amenity(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Json<Amenity>> {
    let amenity = state
        .amenity_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| DomainError::NotFound("Amenity not found".into()))?;

    if let Some(pid) = amenity.property_id {
        if !user.has_property_access(pid) {
            return Err(DomainError::Forbidden);
        }
    }

    Ok(Json(amenity))
}

pub async fn check_availability(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(query): Query<CheckAvailabilityQuery>,
) -> DomainResult<Json<Vec<Reservation>>> {
    let amenity = state
        .amenity_repo
        .find_by_id(query.amenity_id)
        .await?
        .ok_or_else(|| DomainError::NotFound("Amenity not found".into()))?;
    if let Some(pid) = amenity.property_id {
        if !user.has_property_access(pid) {
            return Err(DomainError::Forbidden);
        }
    }

    let reservations = state
        .reservation_service
        .check_availability_for_viewer(&user, query)
        .await?;
    Ok(Json(reservations))
}
