use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use uuid::Uuid;

use crate::{
    application::{
        admin_service::*,
    },
    domain::{
        admin::TenantStatus,
        errors::DomainResult,
    },
    presentation::middleware::auth::AppState,
};

// ==========================================
// Properties Handlers
// ==========================================

pub async fn list_properties(
    State(state): State<AppState>,
) -> DomainResult<Response> {
    let properties = state.admin_service.list_properties().await?;
    Ok(Json(properties).into_response())
}

pub async fn get_property(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let property = state.admin_service.get_property(id).await?;
    Ok(Json(property).into_response())
}

pub async fn create_property(
    State(state): State<AppState>,
    Json(req): Json<CreatePropertyRequest>,
) -> DomainResult<Response> {
    let property = state.admin_service.create_property(req).await?;
    Ok((StatusCode::CREATED, Json(property)).into_response())
}

pub async fn update_property(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdatePropertyRequest>,
) -> DomainResult<Response> {
    let property = state.admin_service.update_property(id, req).await?;
    Ok(Json(property).into_response())
}

pub async fn delete_property(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state.admin_service.delete_property(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

// ==========================================
// Units Handlers
// ==========================================

pub async fn list_units(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    let units = state.admin_service.list_units_by_property(property_id).await?;
    Ok(Json(units).into_response())
}

pub async fn create_unit(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
    Json(req): Json<CreateUnitRequest>,
) -> DomainResult<Response> {
    let unit = state.admin_service.create_unit(property_id, req).await?;
    Ok((StatusCode::CREATED, Json(unit)).into_response())
}

pub async fn update_unit(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateUnitRequest>,
) -> DomainResult<Response> {
    let unit = state.admin_service.update_unit(id, req).await?;
    Ok(Json(unit).into_response())
}

pub async fn delete_unit(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state.admin_service.delete_unit(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

// ==========================================
// Tenants Handlers
// ==========================================

#[derive(Debug, Deserialize)]
pub struct ListTenantsQuery {
    pub property_id: Option<Uuid>,
    pub status: Option<String>,
    pub q: Option<String>,
    pub search: Option<String>,
}

pub async fn list_tenants(
    State(state): State<AppState>,
    Query(query): Query<ListTenantsQuery>,
) -> DomainResult<Response> {
    let status_enum = query.status.as_deref().map(TenantStatus::from_str);
    let search_query = query.q.or(query.search);
    let tenants = state
        .admin_service
        .list_tenants(query.property_id, status_enum, search_query)
        .await?;
    Ok(Json(tenants).into_response())
}

pub async fn get_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let tenant = state.admin_service.get_tenant(id).await?;
    Ok(Json(tenant).into_response())
}

pub async fn create_tenant(
    State(state): State<AppState>,
    Json(req): Json<CreateTenantRequest>,
) -> DomainResult<Response> {
    let tenant = state.admin_service.create_tenant(req).await?;
    Ok((StatusCode::CREATED, Json(tenant)).into_response())
}

pub async fn update_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateTenantRequest>,
) -> DomainResult<Response> {
    let tenant = state.admin_service.update_tenant(id, req).await?;
    Ok(Json(tenant).into_response())
}

pub async fn delete_tenant(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state.admin_service.delete_tenant(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

// ==========================================
// Amenities Handlers
// ==========================================

pub async fn list_property_amenities(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    let amenities = state.admin_service.list_amenities_by_property(property_id).await?;
    Ok(Json(amenities).into_response())
}

pub async fn create_property_amenity(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
    Json(req): Json<CreateAmenityRequest>,
) -> DomainResult<Response> {
    let amenity = state.admin_service.create_amenity(property_id, req).await?;
    Ok((StatusCode::CREATED, Json(amenity)).into_response())
}

pub async fn update_amenity(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateAmenityRequest>,
) -> DomainResult<Response> {
    let amenity = state.admin_service.update_amenity(id, req).await?;
    Ok(Json(amenity).into_response())
}

pub async fn delete_amenity(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    state.admin_service.delete_amenity(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

// ==========================================
// Parking Layout Handlers
// ==========================================

pub async fn get_parking_layout(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    let layout = state.admin_service.get_parking_layout(property_id).await?;
    Ok(Json(layout).into_response())
}

pub async fn save_parking_layout(
    State(state): State<AppState>,
    Path(property_id): Path<Uuid>,
    Json(req): Json<SaveParkingLayoutRequest>,
) -> DomainResult<Response> {
    let layout = state.admin_service.save_parking_layout(property_id, req).await?;
    Ok(Json(json!({
        "message": "Parking layout and spots saved successfully",
        "data": layout
    })).into_response())
}
