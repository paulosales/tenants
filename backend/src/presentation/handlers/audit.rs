use axum::{
    extract::{Query, State},
    Json,
};
use serde::Deserialize;

use crate::domain::audit::AuditLog;
use crate::domain::errors::{DomainError, DomainResult};
use crate::presentation::middleware::auth::{AppState, AuthenticatedUser};

#[derive(Debug, Deserialize)]
pub struct AuditQuery {
    pub limit: Option<i64>,
}

pub async fn list_audit_logs(
    State(state): State<AppState>,
    AuthenticatedUser(user): AuthenticatedUser,
    Query(query): Query<AuditQuery>,
) -> DomainResult<Json<Vec<AuditLog>>> {
    if !user.role.can_view_audit_logs() {
        return Err(DomainError::Forbidden);
    }

    let limit = query.limit.unwrap_or(50).clamp(1, 200);
    let logs = state.audit_repo.list_recent(limit).await?;
    Ok(Json(logs))
}
