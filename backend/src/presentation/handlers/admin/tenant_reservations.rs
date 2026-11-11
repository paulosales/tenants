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
        CreateTenantReservationRequest, ReviewTenantReservationRequest,
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
    Ok(Json(res).into_response())
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

    if user.role == Role::Tenant {
        req.tenant_id = Some(user.tenant_id.ok_or(DomainError::Forbidden)?);
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
    if user.role == Role::Tenant {
        let existing = state
            .admin_service
            .reservations
            .get_tenant_reservation(id)
            .await?;
        if Some(existing.tenant_id) != user.tenant_id {
            return Err(DomainError::Forbidden);
        }
    } else if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }

    state.admin_service.reservations.cancel_tenant_reservation(id).await?;
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

    let res = state
        .admin_service
        .review_tenant_reservation(id, req)
        .await?;
    Ok(Json(res).into_response())
}

