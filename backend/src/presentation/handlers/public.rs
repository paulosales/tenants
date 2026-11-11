use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use uuid::Uuid;

use crate::{
    application::admin_service::CreateTenancyApplicationRequest,
    domain::errors::DomainResult,
    presentation::middleware::auth::AppState,
};

/// Unauthenticated portal endpoint exposing non-PII property summaries and vacant unit options.
pub async fn list_public_properties(State(state): State<AppState>) -> DomainResult<Response> {
    let listings = state.admin_service.list_public_properties().await?;
    Ok(Json(listings).into_response())
}

/// Unauthenticated endpoint exposing rich property showcase details, features, CDN photos, and suites.
pub async fn get_public_property(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let listing = state.admin_service.get_public_property(id).await?;
    Ok(Json(listing).into_response())
}

/// Unauthenticated endpoint allowing prospective residents to apply for tenancy,
/// automatically routing the application to the property manager(s) of the chosen building.
pub async fn submit_public_application(
    State(state): State<AppState>,
    Json(req): Json<CreateTenancyApplicationRequest>,
) -> DomainResult<Response> {
    let receipt = state.admin_service.submit_public_application(req).await?;
    Ok((
        StatusCode::CREATED,
        Json(json!({
            "application": receipt.application,
            "managers_notified": receipt.managers_notified,
            "message": "Your tenancy application has been submitted and routed to the property management team."
        })),
    )
        .into_response())
}

