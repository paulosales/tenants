pub mod services;
pub mod models;
pub mod routes;
pub mod handlers;

use tokio::net::TcpListener;
use std::env;
use dotenvy::dotenv;

#[tokio::main]
async fn main() {
    dotenv().ok();

    let app = axum::Router::new()
        .nest("/", routes::auth_routes());
    let port = env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr = format!("0.0.0.0:{port}");

    println!("🚀 Auth service raised at http://{addr}");

    let listener = TcpListener::bind(&addr).await.unwrap();

    axum::serve(listener, app).await.unwrap();
}
