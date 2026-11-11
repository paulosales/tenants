use std::sync::Arc;
use tokio::net::TcpListener;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

use backend::{
    application::{AdminService, AuthService, ParkingService, PaymentService, ReservationService},
    domain::ports::{PasswordHasher, PaymentGateway, SvgSanitizerPort, TokenProvider},
    infrastructure::{
        config::AppConfig,
        db::create_postgres_pool,
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

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. Initialize structured logging with JSON formatting in production
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,backend=debug,tower_http=debug"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    tracing::info!("Initializing Property & Tenant Management Platform Backend...");

    // 2. Load Configuration
    let config = AppConfig::from_env().map_err(|e| {
        tracing::error!("Configuration failure: {}", e);
        e
    })?;

    // 3. Database Connection Pool
    let pool = create_postgres_pool(&config.database_url).await.map_err(|e| {
        tracing::error!("Database initialization failed: {}", e);
        e
    })?;

    tracing::info!("PostgreSQL connection pool established successfully.");

    // Automatically apply and verify database migrations on startup
    if let Err(e) = sqlx::migrate!("./migrations").run(&pool).await {
        tracing::error!("Database schema migration failed: {}", e);
        return Err(e.into());
    }
    tracing::info!("Database schema migrations applied successfully.");

    // 4. Initialize Concrete Repositories (Hexagonal Infrastructure)
    let user_repo = Arc::new(PostgresUserRepository::new(pool.clone()));
    let amenity_repo = Arc::new(PostgresAmenityRepository::new(pool.clone()));
    let reservation_repo = Arc::new(PostgresReservationRepository::new(pool.clone()));
    let parking_repo = Arc::new(PostgresParkingRepository::new(pool.clone()));
    let payment_repo = Arc::new(PostgresPaymentRepository::new(pool.clone()));
    let audit_repo = Arc::new(PostgresAuditRepository::new(pool.clone()));
    let admin_repo = Arc::new(PostgresAdminRepository::new(pool.clone()));

    // 5. Initialize Infrastructure Adapters (Ports)
    let password_hasher: Arc<dyn PasswordHasher> = Arc::new(Argon2PasswordHasher);
    let token_provider: Arc<dyn TokenProvider> = Arc::new(JwtTokenProvider::new(
        config.jwt_secret.clone(),
        config.jwt_access_expiration_seconds,
    ));
    let svg_sanitizer: Arc<dyn SvgSanitizerPort> = Arc::new(DefaultSvgSanitizer);
    let payment_gateway: Arc<dyn PaymentGateway> = Arc::new(StripePaymentGateway::new(
        config.stripe_secret_key.clone(),
        config.stripe_webhook_secret.clone(),
    ));

    // 6. Initialize Application Use Case Services
    let auth_service = Arc::new(AuthService::new(
        user_repo.clone(),
        password_hasher.clone(),
        token_provider.clone(),
        config.jwt_refresh_expiration_seconds,
    ));

    let reservation_service = Arc::new(ReservationService::new(
        reservation_repo.clone(),
        amenity_repo.clone(),
        audit_repo.clone(),
    ));

    let parking_service = Arc::new(ParkingService::new(
        parking_repo.clone(),
        audit_repo.clone(),
        svg_sanitizer,
    ));

    let payment_service = Arc::new(PaymentService::new(
        payment_repo.clone(),
        reservation_repo.clone(),
        audit_repo.clone(),
        payment_gateway,
    ));

    let admin_service = Arc::new(AdminService::new(admin_repo.clone(), password_hasher));

    // 7. Assemble Router with AppState
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
        cookie_secure: config.is_production,
    };

    let router = build_router(app_state, &config.allowed_origins);

    // 7. Bind TCP listener with Graceful Shutdown
    let addr = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&addr).await?;
    tracing::info!("Server listening on http://{}", addr);

    axum::serve(listener, router)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    tracing::info!("Server shut down cleanly.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C, starting graceful termination...");
        },
        _ = terminate => {
            tracing::info!("Received SIGTERM, starting graceful termination...");
        },
    }
}
