use axum::{
    extract::{Path, Query, State},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::ReviewTenancyApplicationRequest,
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct ApplicationQuery {
    pub property_id: Option<Uuid>,
    pub status: Option<String>,
}

pub async fn list_tenancy_applications(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<ApplicationQuery>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }

    let scoped_property_id = user.enforce_property_scope(q.property_id)?;
    let apps = state
        .admin_service
        .list_applications(scoped_property_id, q.status)
        .await?;
    Ok(Json(apps).into_response())
}

pub async fn review_tenancy_application(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<ReviewTenancyApplicationRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }

    let existing = state.admin_service.get_application(id).await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }

    let updated = state
        .admin_service
        .review_application(id, user.id, req)
        .await?;
    Ok(Json(updated).into_response())
}

