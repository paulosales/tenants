use axum::{
    extract::Request,
    http::{header::HeaderName, HeaderValue},
    middleware::Next,
    response::Response,
};
use uuid::Uuid;

pub static X_REQUEST_ID: HeaderName = HeaderName::from_static("x-request-id");

pub async fn request_id_middleware(mut req: Request, next: Next) -> Response {
    let req_id = match req.headers().get(&X_REQUEST_ID) {
        Some(val) => val.clone(),
        None => {
            let new_id = Uuid::new_v4().to_string();
            HeaderValue::try_from(new_id).unwrap_or_else(|_| HeaderValue::from_static("unknown"))
        }
    };

    req.headers_mut()
        .insert(X_REQUEST_ID.clone(), req_id.clone());

    let mut response = next.run(req).await;
    response.headers_mut().insert(X_REQUEST_ID.clone(), req_id);

    response
}
