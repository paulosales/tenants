use std::sync::Arc;

use axum::{
    body::Body,
    http::{header, Method, Request, StatusCode},
};
use serde_json::{json, Value};
use sqlx::PgPool;
use tower::ServiceExt;
use uuid::Uuid;

use backend::{
    application::{AdminService, AuthService, ParkingService, PaymentService, ReservationService},
    domain::ports::{PasswordHasher, PaymentGateway, SvgSanitizerPort, TokenProvider},
    infrastructure::{
        payment_gateway::StripePaymentGateway,
        repositories::{
            PostgresAdminRepository, PostgresAmenityRepository, PostgresAuditRepository,
            PostgresParkingRepository, PostgresPaymentRepository, PostgresReservationRepository,
            PostgresUserRepository,
        },
        security::{Argon2PasswordHasher, JwtTokenProvider},
        svg_sanitizer::DefaultSvgSanitizer,
    },
    presentation::{middleware::auth::AppState, routes::build_router},
};

async fn build_test_router() -> (axum::Router, PgPool) {
    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| {
        "postgres://postgres:postgres_dev_secret_change_in_prod@localhost:5432/tenants_db".to_string()
    });
    let pool = PgPool::connect(&database_url)
        .await
        .expect("Failed to connect to Postgres for RBAC integration test");

    let user_repo = Arc::new(PostgresUserRepository::new(pool.clone()));
    let amenity_repo = Arc::new(PostgresAmenityRepository::new(pool.clone()));
    let reservation_repo = Arc::new(PostgresReservationRepository::new(pool.clone()));
    let parking_repo = Arc::new(PostgresParkingRepository::new(pool.clone()));
    let payment_repo = Arc::new(PostgresPaymentRepository::new(pool.clone()));
    let audit_repo = Arc::new(PostgresAuditRepository::new(pool.clone()));
    let admin_repo = Arc::new(PostgresAdminRepository::new(pool.clone()));

    let password_hasher: Arc<dyn PasswordHasher> = Arc::new(Argon2PasswordHasher);
    let token_provider: Arc<dyn TokenProvider> = Arc::new(JwtTokenProvider::new(
        "integration_test_jwt_secret_key_must_be_at_least_32_bytes".to_string(),
        900,
    ));
    let svg_sanitizer: Arc<dyn SvgSanitizerPort> = Arc::new(DefaultSvgSanitizer);
    let payment_gateway: Arc<dyn PaymentGateway> = Arc::new(StripePaymentGateway::new(
        "sk_test_dummy".into(),
        "whsec_dummy".into(),
    ));

    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        password_hasher.clone(),
        token_provider.clone(),
        604800,
    ));
    let reservation_service = Arc::new(ReservationService::new(
        reservation_repo.clone(),
        amenity_repo.clone(),
        audit_repo.clone(),
    ));
    let parking_service = Arc::new(ParkingService::new(
        parking_repo,
        audit_repo.clone(),
        svg_sanitizer,
    ));
    let payment_service = Arc::new(PaymentService::new(
        payment_repo,
        reservation_repo,
        audit_repo.clone(),
        payment_gateway,
    ));
    let admin_service = Arc::new(AdminService::new(admin_repo, password_hasher));

    let app_state = AppState {
        user_repo,
        token_provider,
        auth_service,
        reservation_service,
        parking_service,
        payment_service,
        amenity_repo,
        audit_repo,
        admin_service,
        cookie_secure: false,
    };

    let router = build_router(
        app_state,
        &[
            "http://localhost:5173".to_string(),
            "http://127.0.0.1:5173".to_string(),
        ],
    );
    (router, pool)
}

async fn login_with_cookies(
    router: &axum::Router,
    email: &str,
    password: &str,
) -> (String, String, String, Value) {
    let req = Request::builder()
        .method(Method::POST)
        .uri("/api/v1/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            json!({ "email": email, "password": password }).to_string(),
        ))
        .unwrap();

    let res = router.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK, "Expected login success for {}", email);

    let set_cookies: Vec<String> = res
        .headers()
        .get_all(header::SET_COOKIE)
        .iter()
        .map(|h| h.to_str().unwrap().to_string())
        .collect();

    let mut access_cookie = String::new();
    let mut csrf_token = String::new();

    for c in &set_cookies {
        let kv = c.split(';').next().unwrap();
        if let Some(val) = kv.strip_prefix("access_token=") {
            assert!(c.contains("HttpOnly"), "access_token must be HttpOnly");
            assert!(c.contains("SameSite=Strict"), "access_token must be SameSite=Strict");
            access_cookie = val.to_string();
        } else if let Some(val) = kv.strip_prefix("csrf_token=") {
            csrf_token = val.to_string();
        }
    }

    assert!(!access_cookie.is_empty(), "Missing access_token cookie");
    assert!(!csrf_token.is_empty(), "Missing csrf_token cookie");

    let body_bytes = axum::body::to_bytes(res.into_body(), usize::MAX)
        .await
        .unwrap();
    let json_body: Value = serde_json::from_slice(&body_bytes).unwrap();
    let bearer = json_body["access_token"].as_str().unwrap().to_string();
    let cookie_header = format!("access_token={}; csrf_token={}", access_cookie, csrf_token);

    (cookie_header, csrf_token, bearer, json_body["user"].clone())
}

#[tokio::test]
async fn test_public_portal_and_rbac_csrf_enforcement() {
    let (router, pool) = build_test_router().await;

    // 1. Unauthenticated access: protected endpoint must reject (401), public portal must pass (200)
    let unauth_tenants = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/tenants")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(unauth_tenants.status(), StatusCode::UNAUTHORIZED);

    let public_props = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/public/properties")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(public_props.status(), StatusCode::OK);

    // 2. Unauthenticated visitor submits a tenancy application -> routed to Property Manager
    let prop_id = "11111111-2222-3333-4444-555555555551";
    let applicant_email = format!("public-applicant-{}@example.com", Uuid::new_v4());
    let apply_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/public/applications")
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "property_id": prop_id,
                        "applicant_first_name": "Amelia",
                        "applicant_last_name": "Pond",
                        "applicant_email": applicant_email,
                        "applicant_phone": "+1 (206) 555-0199",
                        "monthly_income_cents": 820000,
                        "employment_status": "full_time",
                        "occupants_count": 2,
                        "notes": "Looking forward to moving next month"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(apply_res.status(), StatusCode::CREATED);
    let apply_json: Value = serde_json::from_slice(
        &axum::body::to_bytes(apply_res.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let app_id = apply_json["application"]["id"].as_str().unwrap().to_string();
    assert_eq!(apply_json["application"]["status"], "pending");

    // 3. Tenant login: allowed on tenant portal routes, FORBIDDEN on admin/manager/staff/application routes
    let (tenant_cookie, tenant_csrf, _, tenant_user) =
        login_with_cookies(&router, "tenant@property.local", "Password123!").await;
    assert_eq!(tenant_user["role"], "tenant");

    let tenant_blocked = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/tenancy-applications")
                .header(header::COOKIE, &tenant_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(tenant_blocked.status(), StatusCode::FORBIDDEN);

    let tenant_sessions = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/amenity-sessions")
                .header(header::COOKIE, &tenant_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(tenant_sessions.status(), StatusCode::OK);

    // 4. CSRF check: Cookie-authenticated mutation WITHOUT X-CSRF-Token must return 403 Forbidden
    let csrf_missing = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/maintenance-calls")
                .header(header::COOKIE, &tenant_cookie)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "unit_number": "101",
                        "category": "plumbing",
                        "priority": "routine",
                        "title": "Sink faucet loose",
                        "description": "Tap handle needs tightening",
                        "contact_phone": "+1 (206) 555-0192"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(csrf_missing.status(), StatusCode::FORBIDDEN);

    // Same request WITH valid X-CSRF-Token must succeed (201 Created)
    let csrf_ok = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/maintenance-calls")
                .header(header::COOKIE, &tenant_cookie)
                .header("x-csrf-token", &tenant_csrf)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "unit_number": "101",
                        "category": "plumbing",
                        "priority": "routine",
                        "title": "Sink faucet loose",
                        "description": "Tap handle needs tightening",
                        "contact_phone": "+1 (206) 555-0192"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(csrf_ok.status(), StatusCode::CREATED);
    let created_call: Value = serde_json::from_slice(
        &axum::body::to_bytes(csrf_ok.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let created_call_id = created_call["id"].as_str().unwrap().to_string();

    // 5. Building Staff login (Bearer token - simulates Mobile client): can message manager, cannot read maintenance calls
    let (_, _, staff_bearer, _) =
        login_with_cookies(&router, "staff@property.local", "Password123!").await;

    let staff_no_maint = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/maintenance-calls")
                .header(header::AUTHORIZATION, format!("Bearer {}", staff_bearer))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(staff_no_maint.status(), StatusCode::FORBIDDEN);

    let staff_msg_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/staff-messages")
                .header(header::AUTHORIZATION, format!("Bearer {}", staff_bearer))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "property_id": prop_id,
                        "body": "Mobile check-in from cleaning team"
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(staff_msg_res.status(), StatusCode::CREATED);
    let created_msg: Value = serde_json::from_slice(
        &axum::body::to_bytes(staff_msg_res.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let created_msg_id = created_msg["id"].as_str().unwrap().to_string();

    // 6. Maintainer login (Mobile Bearer): updates maintenance call status to 'resolved'
    let (_, _, maint_bearer, _) =
        login_with_cookies(&router, "maintainer@property.local", "Password123!").await;

    let maint_solve = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri(format!("/api/v1/maintenance-calls/{}/status", created_call_id))
                .header(header::AUTHORIZATION, format!("Bearer {}", maint_bearer))
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "status": "resolved",
                        "resolution_notes": "Tightened fixture valve and checked seals."
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(maint_solve.status(), StatusCode::OK);
    let solved_json: Value = serde_json::from_slice(
        &axum::body::to_bytes(maint_solve.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(solved_json["status"], "resolved");

    // 7. Property Manager login: reviews application & reviews amenity session
    let (mgr_cookie, mgr_csrf, _, _) =
        login_with_cookies(&router, "manager@property.local", "Password123!").await;

    let review_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PATCH)
                .uri(format!("/api/v1/tenancy-applications/{}/review", app_id))
                .header(header::COOKIE, &mgr_cookie)
                .header("x-csrf-token", &mgr_csrf)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "status": "approved",
                        "review_notes": "Approved after income check",
                        "onboard_as_tenant": false
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(review_res.status(), StatusCode::OK);

    // 8. Users & Roles Administration RBAC + CRUD (Super Admin allowed, Property Manager forbidden)
    let mgr_users_blocked = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/users")
                .header(header::COOKIE, &mgr_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(mgr_users_blocked.status(), StatusCode::FORBIDDEN);

    let (admin_cookie, admin_csrf, _, _) =
        login_with_cookies(&router, "admin@property.local", "Password123!").await;

    let roles_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/users/roles")
                .header(header::COOKIE, &admin_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(roles_res.status(), StatusCode::OK);
    let roles_json: Value = serde_json::from_slice(
        &axum::body::to_bytes(roles_res.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(roles_json.as_array().unwrap().len(), 5);

    let temp_email = format!("rbac-managed-{}@property.local", Uuid::new_v4());
    let create_user_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/api/v1/users")
                .header(header::COOKIE, &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "email": temp_email,
                        "password": "Password123!",
                        "full_name": "Rory Williams",
                        "role": "staff",
                        "property_id": prop_id
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_user_res.status(), StatusCode::CREATED);
    let created_user_json: Value = serde_json::from_slice(
        &axum::body::to_bytes(create_user_res.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    let created_user_id = created_user_json["id"].as_str().unwrap().to_string();
    assert_eq!(created_user_json["role"], "staff");

    let update_user_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::PUT)
                .uri(format!("/api/v1/users/{}", created_user_id))
                .header(header::COOKIE, &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .header(header::CONTENT_TYPE, "application/json")
                .body(Body::from(
                    json!({
                        "role": "maintenance_staff",
                        "is_active": true
                    })
                    .to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_user_res.status(), StatusCode::OK);
    let updated_user_json: Value = serde_json::from_slice(
        &axum::body::to_bytes(update_user_res.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(updated_user_json["role"], "maintenance_staff");

    let delete_user_res = router
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::DELETE)
                .uri(format!("/api/v1/users/{}", created_user_id))
                .header(header::COOKIE, &admin_cookie)
                .header("x-csrf-token", &admin_csrf)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_user_res.status(), StatusCode::NO_CONTENT);

    // Clean up test rows created in Postgres (including leftover rows from earlier aborted runs)
    let _ = sqlx::query("DELETE FROM users WHERE id = $1::uuid")
        .bind(&created_user_id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM staff_messages WHERE id = $1::uuid")
        .bind(&created_msg_id)
        .execute(&pool)
        .await;
    let _ = sqlx::query("DELETE FROM maintenance_calls WHERE id = $1::uuid")
        .bind(&created_call_id)
        .execute(&pool)
        .await;
    let _ = sqlx::query(
        "DELETE FROM tenancy_applications WHERE id = $1::uuid OR applicant_email LIKE 'public-applicant-%@example.com'",
    )
    .bind(&app_id)
    .execute(&pool)
    .await;
}
