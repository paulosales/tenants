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
        AssignMaintenanceCallStaffRequest, CreateMaintenanceCallRequest,
        UpdateMaintenanceCallStatusRequest,
    },
    domain::{
        errors::{DomainError, DomainResult},
        user::Role,
    },
    presentation::middleware::auth::{AppState, AuthenticatedUser},
};

#[derive(Debug, Deserialize)]
pub struct MaintenanceQuery {
    pub tenant_id: Option<Uuid>,
    pub property_id: Option<Uuid>,
    pub status: Option<String>,
}

pub async fn list_maintenance_calls(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(q): Query<MaintenanceQuery>,
) -> DomainResult<Response> {
    if matches!(user.role, Role::Staff) {
        return Err(DomainError::Forbidden);
    }

    let (scoped_tenant_id, scoped_property_id) = if user.role == Role::Tenant {
        (
            Some(user.tenant_id.ok_or(DomainError::Forbidden)?),
            user.property_id,
        )
    } else if user.role.can_perform_maintenance() {
        (q.tenant_id, user.enforce_property_scope(q.property_id)?)
    } else {
        return Err(DomainError::Forbidden);
    };

    let calls = state
        .admin_service
        .maintenance
        .list_maintenance_calls(scoped_tenant_id, scoped_property_id, q.status)
        .await?;
    Ok(Json(calls).into_response())
}

pub async fn get_maintenance_call(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    if matches!(user.role, Role::Staff) {
        return Err(DomainError::Forbidden);
    }
    let call = state
        .admin_service
        .maintenance
        .get_maintenance_call(id)
        .await?;
    if user.role == Role::Tenant {
        if Some(call.tenant_id) != user.tenant_id {
            return Err(DomainError::Forbidden);
        }
    } else if !user.has_property_access(call.property_id) {
        return Err(DomainError::Forbidden);
    }
    Ok(Json(call).into_response())
}

pub async fn create_maintenance_call(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Json(mut req): Json<CreateMaintenanceCallRequest>,
) -> DomainResult<Response> {
    if !matches!(
        user.role,
        Role::Tenant | Role::PropertyManager | Role::SuperAdmin
    ) {
        return Err(DomainError::Forbidden);
    }

    if user.role == Role::Tenant {
        let tid = user.tenant_id.ok_or(DomainError::Forbidden)?;
        req.tenant_id = Some(tid);
        if let Some(prop_id) = user.property_id {
            if let Some(req_prop) = req.property_id {
                if req_prop != prop_id {
                    return Err(DomainError::Forbidden);
                }
            }
            req.property_id = Some(prop_id);
        } else if req.property_id.is_none() {
            return Err(DomainError::ValidationError(
                "property_id is required".into(),
            ));
        }
    } else {
        if req.tenant_id.is_none() {
            return Err(DomainError::ValidationError("tenant_id is required".into()));
        }
        req.property_id = user.enforce_property_scope(req.property_id)?;
        if req.property_id.is_none() {
            return Err(DomainError::ValidationError(
                "property_id is required".into(),
            ));
        }
    }

    let call = state
        .admin_service
        .maintenance
        .create_maintenance_call(req)
        .await?;
    Ok((StatusCode::CREATED, Json(call)).into_response())
}

pub async fn update_maintenance_call_status(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateMaintenanceCallStatusRequest>,
) -> DomainResult<Response> {
    if !user.role.can_perform_maintenance() {
        return Err(DomainError::Forbidden);
    }
    let existing = state
        .admin_service
        .maintenance
        .get_maintenance_call(id)
        .await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    if user.role == Role::MaintenanceStaff {
        if let (Some(assigned), Some(caller_staff)) = (existing.assigned_staff_id, user.staff_id) {
            if assigned != caller_staff {
                return Err(DomainError::Forbidden);
            }
        }
    }
    let call = state
        .admin_service
        .maintenance
        .update_maintenance_call_status(id, req)
        .await?;
    Ok(Json(call).into_response())
}

pub async fn cancel_maintenance_call(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
) -> DomainResult<Response> {
    let existing = state
        .admin_service
        .maintenance
        .get_maintenance_call(id)
        .await?;
    if user.role == Role::Tenant {
        if Some(existing.tenant_id) != user.tenant_id {
            return Err(DomainError::Forbidden);
        }
    } else if !user.role.can_manage_properties() || !user.has_property_access(existing.property_id)
    {
        return Err(DomainError::Forbidden);
    }

    state
        .admin_service
        .maintenance
        .cancel_maintenance_call(id)
        .await?;
    Ok(StatusCode::NO_CONTENT.into_response())
}

pub async fn assign_maintenance_call_staff(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Path(id): Path<Uuid>,
    Json(req): Json<AssignMaintenanceCallStaffRequest>,
) -> DomainResult<Response> {
    if !user.role.can_manage_properties() {
        return Err(DomainError::Forbidden);
    }
    let existing = state
        .admin_service
        .maintenance
        .get_maintenance_call(id)
        .await?;
    if !user.has_property_access(existing.property_id) {
        return Err(DomainError::Forbidden);
    }
    let call = state
        .admin_service
        .maintenance
        .assign_maintenance_call_staff(id, req)
        .await?;
    Ok(Json(call).into_response())
}
