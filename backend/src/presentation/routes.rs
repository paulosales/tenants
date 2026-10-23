use axum::{
    http::{header, HeaderValue, Method},
    middleware as axum_middleware,
    routing::{get, post, put},
    Router,
};
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use crate::presentation::{
    handlers::{
        amenities::{check_availability, get_amenity, list_amenities},
        audit::list_audit_logs,
        auth::{login, logout, me, refresh, register},
        parking::{get_zone_layout, list_zones, reserve_spot, upload_svg_layout, upsert_spot},
        reservations::{cancel_reservation, create_reservation, list_my_reservations},
        webhooks::stripe_webhook,
    },
    middleware::{
        auth::AppState,
        request_id::request_id_middleware,
        security_headers::security_headers_middleware,
    },
};

pub fn build_router(state: AppState, allowed_origins: &[String]) -> Router {
    // 1. CORS Configuration (OWASP compliant: no wildcard '*' with credentials)
    let origin_headers: Vec<HeaderValue> = allowed_origins
        .iter()
        .filter_map(|o| HeaderValue::try_from(o.as_str()).ok())
        .collect();

    let cors_layer = CorsLayer::new()
        .allow_origin(AllowOrigin::list(origin_headers))
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::COOKIE,
            header::HeaderName::from_static("x-request-id"),
        ])
        .allow_credentials(true);

    // 2. API Routes
    let api_router = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        // Auth
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/refresh", post(refresh))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
        // Amenities & Reservations
        .route("/amenities", get(list_amenities))
        .route("/amenities/:id", get(get_amenity))
        .route("/amenities/availability", get(check_availability))
        .route("/reservations", post(create_reservation))
        .route("/reservations/my", get(list_my_reservations))
        .route("/reservations/:id/cancel", post(cancel_reservation))
        // Parking
        .route("/parking/zones", get(list_zones))
        .route("/parking/zones/:id/layout", get(get_zone_layout))
        .route("/parking/reserve", post(reserve_spot))
        .route("/parking/spots", post(upsert_spot))
        .route("/parking/zones/:id/svg", put(upload_svg_layout))
        // Stripe Webhook
        .route("/webhooks/stripe", post(stripe_webhook))
        // Audit
        .route("/audit/logs", get(list_audit_logs));

    // 3. Assemble root router with layered middleware
    Router::new()
        .nest("/api/v1", api_router)
        .layer(axum_middleware::from_fn(security_headers_middleware))
        .layer(axum_middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors_layer)
        .with_state(state)
}
