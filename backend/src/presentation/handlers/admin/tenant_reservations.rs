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
    domain::{
        errors::{DomainError, DomainResult},
        user::Role,
    },
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
    if !matches!(
        user.role,
        Role::Tenant | Role::PropertyManager | Role::SuperAdmin
    ) {
        return Err(DomainError::Forbidden);
    }

    let amenity = state
        .admin_service
        .amenities
        .get_amenity(q.amenity_id)
        .await?;

    let events = state
        .admin_service
        .list_amenity_calendar_for_viewer(
            &user,
            q.amenity_id,
            amenity.property_id,
            q.start_date,
            q.end_date,
        )
        .await?;
    Ok(Json(events).into_response())
}

pub async fn list_tenant_reservations(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<TenantReservationQuery>,
) -> DomainResult<Response> {
    let scoped_tenant_id = if user.role == Role::Tenant {
        Some(user.tenant_id.ok_or(DomainError::Forbidden)?)
    } else if user.role.can_manage_properties() {
        q.tenant_id
    } else {
        return Err(DomainError::Forbidden);
    };

    let res = state
        .admin_service
        .reservations
        .list_tenant_reservations(scoped_tenant_id)
        .await?;
    let scoped: Vec<_> = if user.role == Role::Tenant {
        res
    } else {
        res.into_iter()
            .filter(|r| {
                r.property_id
                    .map(|p| user.has_property_access(p))
                    .unwrap_or(true)
            })
            .collect()
    };
    Ok(Json(scoped).into_response())
}

pub async fn create_tenant_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(mut req): Json<CreateTenantReservationRequest>,
) -> DomainResult<Response> {
    if !matches!(
        user.role,
        Role::Tenant | Role::PropertyManager | Role::SuperAdmin
    ) {
        return Err(DomainError::Forbidden);
    }

    let amenity = state
        .admin_service
        .amenities
        .get_amenity(req.amenity_id)
        .await?;
    if !user.has_property_access(amenity.property_id) {
        return Err(DomainError::Forbidden);
    }
    if !amenity.is_active {
        return Err(DomainError::ValidationError(
            "This amenity is currently unavailable".into(),
        ));
    }
    if let Some(count) = req.attendees_count {
        if count < 1 || count > amenity.capacity {
            return Err(DomainError::ValidationError(format!(
                "Attendees count must be between 1 and {} guests",
                amenity.capacity
            )));
        }
    }

    if user.role == Role::Tenant {
        req.tenant_id = Some(user.tenant_id.ok_or(DomainError::Forbidden)?);
    } else if req.tenant_id.is_none() {
        return Err(DomainError::ValidationError("tenant_id is required".into()));
    }

    let res = state
        .admin_service
        .reservations
        .create_tenant_reservation(req)
        .await?;
    Ok((StatusCode::CREATED, Json(res)).into_response())
}

pub async fn cancel_tenant_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let existing = state
        .admin_service
        .reservations
        .get_tenant_reservation(id)
        .await?;

    if user.role == Role::Tenant {
        if Some(existing.tenant_id) != user.tenant_id {
            return Err(DomainError::Forbidden);
        }
    } else if !user.role.can_manage_properties()
        || existing
            .property_id
            .map(|p| !user.has_property_access(p))
            .unwrap_or(false)
    {
        return Err(DomainError::Forbidden);
    }

    state
        .admin_service
        .reservations
        .cancel_tenant_reservation(id)
        .await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn review_tenant_reservation(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<ReviewTenantReservationRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state.admin_service.get_tenant_reservation(id).await?;
    if let Some(pid) = existing.property_id {
        if !user.has_property_access(pid) {
            return Err(DomainError::Forbidden);
        }
    }

    let res = state
        .admin_service
        .review_tenant_reservation(id, req)
        .await?;
    Ok(Json(res).into_response())
}
