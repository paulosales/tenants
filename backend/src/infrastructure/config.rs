use crate::domain::errors::{DomainError, DomainResult};

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub port: u16,
    pub host: String,
    pub app_env: String,
    pub is_production: bool,
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub jwt_access_expiration_seconds: i64,
    pub jwt_refresh_expiration_seconds: i64,
    pub stripe_secret_key: String,
    pub stripe_webhook_secret: String,
    pub media_s3_endpoint: String,
    pub media_s3_bucket: String,
    pub media_s3_region: String,
    pub media_s3_access_key: String,
    pub media_s3_secret_key: String,
    pub media_cdn_base_url: String,
    pub allowed_origins: Vec<String>,
}

impl AppConfig {
    pub fn from_env() -> DomainResult<Self> {
        let _ = dotenvy::dotenv();

        let port = std::env::var("PORT")
            .unwrap_or_else(|_| "8080".to_string())
            .parse::<u16>()
            .map_err(|e| DomainError::Internal(format!("Invalid PORT: {}", e)))?;

        let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
        let app_env = std::env::var("APP_ENV").unwrap_or_else(|_| "development".to_string());
        let is_production = matches!(app_env.to_lowercase().as_str(), "production" | "staging");

        let database_url = std::env::var("DATABASE_URL").map_err(|_| {
            DomainError::Internal("DATABASE_URL environment variable is mandatory".into())
        })?;

        let redis_url =
            std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());

        let jwt_secret = std::env::var("JWT_SECRET").map_err(|_| {
            DomainError::Internal(
                "JWT_SECRET environment variable is mandatory and cannot be empty".into(),
            )
        })?;

        if jwt_secret.len() < 32 {
            return Err(DomainError::Internal(
                "JWT_SECRET must be at least 32 characters long for cryptographic security".into(),
            ));
        }

        if is_production
            && (jwt_secret.contains("development") || jwt_secret.contains("change_in_prod"))
        {
            return Err(DomainError::Internal(
                "Refusing to start production environment with a development/placeholder JWT_SECRET"
                    .into(),
            ));
        }

        let jwt_access_expiration_seconds = std::env::var("JWT_ACCESS_EXPIRATION_SECONDS")
            .unwrap_or_else(|_| "900".to_string())
            .parse::<i64>()
            .unwrap_or(900);

        let jwt_refresh_expiration_seconds = std::env::var("JWT_REFRESH_EXPIRATION_SECONDS")
            .unwrap_or_else(|_| "604800".to_string())
            .parse::<i64>()
            .unwrap_or(604800);

        let stripe_secret_key = std::env::var("STRIPE_SECRET_KEY")
            .unwrap_or_else(|_| "sk_test_placeholder".to_string());

        let stripe_webhook_secret = std::env::var("STRIPE_WEBHOOK_SECRET")
            .unwrap_or_else(|_| "whsec_placeholder".to_string());

        let media_s3_endpoint = std::env::var("MEDIA_S3_ENDPOINT")
            .unwrap_or_else(|_| "http://localhost:9000".to_string());
        let media_s3_bucket =
            std::env::var("MEDIA_S3_BUCKET").unwrap_or_else(|_| "property-media".to_string());
        let media_s3_region =
            std::env::var("MEDIA_S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());
        let media_s3_access_key =
            std::env::var("MEDIA_S3_ACCESS_KEY").unwrap_or_else(|_| "minioadmin_dev".to_string());
        let media_s3_secret_key = std::env::var("MEDIA_S3_SECRET_KEY")
            .unwrap_or_else(|_| "minioadmin_dev_secret".to_string());
        let media_cdn_base_url = std::env::var("MEDIA_CDN_BASE_URL")
            .unwrap_or_else(|_| format!("http://localhost:9000/{}", media_s3_bucket));

        if is_production
            && (media_s3_access_key.contains("minioadmin_dev")
                || media_s3_secret_key.contains("minioadmin_dev"))
        {
            return Err(DomainError::Internal(
                "Refusing to start production environment with development object-storage credentials"
                    .into(),
            ));
        }

        let allowed_origins_raw = std::env::var("ALLOWED_ORIGINS")
            .unwrap_or_else(|_| "http://localhost:5173,http://127.0.0.1:5173".to_string());
        let allowed_origins = allowed_origins_raw
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Ok(Self {
            port,
            host,
            app_env,
            is_production,
            database_url,
            redis_url,
            jwt_secret,
            jwt_access_expiration_seconds,
            jwt_refresh_expiration_seconds,
            stripe_secret_key,
            stripe_webhook_secret,
            media_s3_endpoint,
            media_s3_bucket,
            media_s3_region,
            media_s3_access_key,
            media_s3_secret_key,
            media_cdn_base_url,
            allowed_origins,
        })
    }
}
