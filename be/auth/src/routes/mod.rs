use axum::{routing::post, Router};
use crate::handlers::auth;

pub fn auth_routes() -> Router {
    Router::new()
        .route("/exchange_google_token", post(auth::exchange_google_token))
}
