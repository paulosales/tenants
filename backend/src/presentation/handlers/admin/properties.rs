use axum::{
    body::Bytes,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use uuid::Uuid;

use crate::{
    application::admin_service::{
        AddPropertyFeatureRequest, CreatePropertyRequest, UpdatePropertyRequest,
    },
    domain::errors::{DomainError, DomainResult},
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct PhotoUploadQuery {
    pub caption: Option<String>,
    pub is_cover: Option<bool>,
}

pub async fn list_properties(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
) -> DomainResult<Response> {
    let properties = state.admin_service.properties.list_properties().await?;
    let scoped: Vec<_> = properties
        .into_iter()
        .filter(|p| user.has_property_access(p.id))
        .collect();
    Ok(Json(scoped).into_response())
}

pub async fn get_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.has_property_access(id) {
        return Err(DomainError::Forbidden);
    }
    let property = state.admin_service.properties.get_property(id).await?;
    Ok(Json(property).into_response())
}

pub async fn create_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(req): Json<CreatePropertyRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || user.property_id.is_some() {
        return Err(DomainError::Forbidden);
    }
    let property = state.admin_service.properties.create_property(req).await?;
    Ok((StatusCode::CREATED, Json(property)).into_response())
}

pub async fn update_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdatePropertyRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(id) {
        return Err(DomainError::Forbidden);
    }
    let property = state
        .admin_service
        .properties
        .update_property(id, req)
        .await?;
    Ok(Json(property).into_response())
}

pub async fn delete_property(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(id) {
        return Err(DomainError::Forbidden);
    }
    state.admin_service.properties.delete_property(id).await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn list_property_features(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let features = state
        .admin_service
        .list_property_features(property_id)
        .await?;
    Ok(Json(features).into_response())
}

pub async fn add_property_feature(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
    Json(req): Json<AddPropertyFeatureRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let created = state
        .admin_service
        .add_property_feature(property_id, req)
        .await?;
    Ok((StatusCode::CREATED, Json(created)).into_response())
}

pub async fn delete_property_feature(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((property_id, feature_id)): Path<(Uuid, Uuid)>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    state
        .admin_service
        .delete_property_feature(property_id, feature_id)
        .await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn list_property_photos(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
) -> DomainResult<Response> {
    if !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let photos = state
        .admin_service
        .list_property_photos(property_id)
        .await?;
    Ok(Json(photos).into_response())
}

pub async fn upload_property_photo(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(property_id): Path<Uuid>,
    Query(query): Query<PhotoUploadQuery>,
    headers: HeaderMap,
    body: Bytes,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    let photo = state
        .admin_service
        .upload_property_photo(
            property_id,
            content_type,
            &body,
            query.caption,
            query.is_cover.unwrap_or(false),
        )
        .await?;
    Ok((StatusCode::CREATED, Json(photo)).into_response())
}

pub async fn set_cover_property_photo(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((property_id, photo_id)): Path<(Uuid, Uuid)>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    let photo = state
        .admin_service
        .set_cover_property_photo(property_id, photo_id)
        .await?;
    Ok(Json(photo).into_response())
}

pub async fn delete_property_photo(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path((property_id, photo_id)): Path<(Uuid, Uuid)>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() || !user.has_property_access(property_id) {
        return Err(DomainError::Forbidden);
    }
    state
        .admin_service
        .delete_property_photo(property_id, photo_id)
        .await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}
