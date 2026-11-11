use axum::{
    extract::DefaultBodyLimit,
    http::{header, HeaderValue, Method},
    middleware as axum_middleware,
    routing::{get, patch, post, put},
    Router,
};
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, CorsLayer},
    trace::TraceLayer,
};

use crate::presentation::{
    handlers::{
        admin::{
            assign_maintenance_call_staff, assign_parking_spot, cancel_maintenance_call,
            cancel_tenant_reservation, create_admin_user, create_maintenance_call, create_property,
            create_property_amenity, create_property_staff, create_tenant,
            create_tenant_reservation, create_unit, delete_admin_user, delete_amenity,
            delete_property, delete_property_staff, delete_tenant, delete_unit, get_admin_user,
            get_maintenance_call, get_parking_layout, get_property, get_property_staff, get_tenant,
            list_admin_users, list_maintenance_calls, list_properties, list_property_amenities,
            list_property_staff, list_roles, list_staff_messages, list_tenancy_applications,
            list_tenant_reservations, list_tenants, list_units, mark_staff_message_read,
            review_tenancy_application, review_tenant_reservation, save_parking_layout,
            send_staff_message, update_admin_user, update_amenity, update_maintenance_call_status,
            update_property, update_property_staff, update_tenant, update_unit,
        },
        amenities::{check_availability, get_amenity, list_amenities},
        audit::list_audit_logs,
        auth::{login, logout, me, refresh, register},
        parking::{get_zone_layout, list_zones, reserve_spot, upload_svg_layout, upsert_spot},
        public::{list_public_properties, submit_public_application},
        reservations::{cancel_reservation, create_reservation, list_my_reservations},
        webhooks::stripe_webhook,
    },
    middleware::{
        auth::AppState,
        csrf::csrf_protection_middleware,
        rate_limit::rate_limit_middleware,
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
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            header::ACCEPT,
            header::COOKIE,
            header::HeaderName::from_static("x-request-id"),
            header::HeaderName::from_static("x-csrf-token"),
        ])
        .allow_credentials(true);

    // 2. API Routes
    let api_router = Router::new()
        // Health check
        .route("/health", get(|| async { "OK" }))
        // Unauthenticated Public Property Portal & Tenancy Applications
        .route("/public/properties", get(list_public_properties))
        .route("/public/applications", post(submit_public_application))
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
        .route(
            "/parking/zones/:id/svg",
            put(upload_svg_layout).layer(DefaultBodyLimit::max(640 * 1024)),
        )
        // Stripe Webhook
        .route("/webhooks/stripe", post(stripe_webhook))
        // Audit
        .route("/audit/logs", get(list_audit_logs))
        // Admin & Property Manager: Tenancy Applications Review
        .route("/tenancy-applications", get(list_tenancy_applications))
        .route("/tenancy-applications/:id/review", patch(review_tenancy_application))
        // Admin: Properties API
        .route("/properties", get(list_properties).post(create_property))
        .route("/properties/:id", get(get_property).put(update_property).delete(delete_property))
        // Admin: Units API
        .route("/properties/:property_id/units", get(list_units).post(create_unit))
        .route("/units/:id", put(update_unit).delete(delete_unit))
        // Admin: Tenants API
        .route("/tenants", get(list_tenants).post(create_tenant))
        .route("/tenants/:id", get(get_tenant).put(update_tenant).delete(delete_tenant))
        // Admin: Amenities API
        .route("/properties/:property_id/amenities", get(list_property_amenities).post(create_property_amenity))
        .route("/amenities/:id", put(update_amenity).delete(delete_amenity))
        // Admin & Manager: Parking Layout & Spot Assignment API
        .route("/properties/:property_id/parking-layout", get(get_parking_layout).put(save_parking_layout))
        .route("/parking-spots/:id/assign", post(assign_parking_spot))
        // Tenant Portal & Admin & Maintainer: Maintenance Calls API
        .route("/maintenance-calls", get(list_maintenance_calls).post(create_maintenance_call))
        .route("/maintenance-calls/:id", get(get_maintenance_call))
        .route("/maintenance-calls/:id/status", put(update_maintenance_call_status).patch(update_maintenance_call_status))
        .route("/maintenance-calls/:id/cancel", post(cancel_maintenance_call))
        .route("/maintenance-calls/:id/assign-staff", post(assign_maintenance_call_staff))
        // Tenant Portal & Property Manager Review: Amenity Sessions API
        .route("/amenity-sessions", get(list_tenant_reservations).post(create_tenant_reservation))
        .route("/amenity-sessions/my", get(list_tenant_reservations))
        .route("/amenity-sessions/:id/cancel", post(cancel_tenant_reservation))
        .route("/amenity-sessions/:id/review", patch(review_tenant_reservation))
        // Admin & Management: Property Staff API
        .route("/staff", get(list_property_staff).post(create_property_staff))
        .route("/staff/:id", get(get_property_staff).put(update_property_staff).delete(delete_property_staff))
        // Manager <-> Staff Messaging API
        .route("/staff-messages", get(list_staff_messages).post(send_staff_message))
        .route("/staff-messages/:id/read", patch(mark_staff_message_read))
        // Super Admin: Users & Roles Management API
        .route("/users", get(list_admin_users).post(create_admin_user))
        .route("/users/roles", get(list_roles))
        .route("/users/:id", get(get_admin_user).put(update_admin_user).delete(delete_admin_user))
        .layer(DefaultBodyLimit::max(256 * 1024))
        .layer(axum_middleware::from_fn(csrf_protection_middleware));

    // 3. Assemble root router with layered middleware
    Router::new()
        .nest("/api/v1", api_router)
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            rate_limit_middleware,
        ))
        .layer(axum_middleware::from_fn(security_headers_middleware))
        .layer(axum_middleware::from_fn(request_id_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors_layer)
        .with_state(state)
}
