use std::sync::OnceLock;
use std::time::Instant;

use axum::{
    extract::{MatchedPath, Request},
    http::{header::HeaderName, HeaderMap, HeaderValue},
    middleware::Next,
    response::Response,
};
use opentelemetry::{
    global,
    metrics::{Counter, Histogram},
    propagation::Extractor,
    trace::TraceContextExt,
    KeyValue,
};
use tracing::Instrument;
use tracing_opentelemetry::OpenTelemetrySpanExt;

pub static X_TRACE_ID: HeaderName = HeaderName::from_static("x-trace-id");

struct HeaderMapExtractor<'a>(&'a HeaderMap);

impl<'a> Extractor for HeaderMapExtractor<'a> {
    fn get(&self, key: &str) -> Option<&str> {
        self.0.get(key).and_then(|v| v.to_str().ok())
    }

    fn keys(&self) -> Vec<&str> {
        self.0.keys().map(|k| k.as_str()).collect()
    }
}

struct HttpMetrics {
    request_duration_seconds: Histogram<f64>,
    request_total: Counter<u64>,
}

fn http_metrics() -> &'static HttpMetrics {
    static METRICS: OnceLock<HttpMetrics> = OnceLock::new();
    METRICS.get_or_init(|| {
        let meter = global::meter("tenants-backend");
        let request_duration_seconds = meter
            .f64_histogram("http.server.request.duration")
            .with_unit("s")
            .with_description("Duration of incoming HTTP API requests in seconds")
            .build();
        let request_total = meter
            .u64_counter("http.server.requests.total")
            .with_description("Total HTTP API requests handled")
            .build();
        HttpMetrics {
            request_duration_seconds,
            request_total,
        }
    })
}

/// Extracts incoming W3C Trace Context (`traceparent` / `tracestate`), creates an instrumented
/// root server span, propagates `x-trace-id` back on responses, and emits low-cardinality HTTP metrics.
pub async fn telemetry_middleware(req: Request, next: Next) -> Response {
    let start = Instant::now();
    let method = req.method().to_string();
    let route = req
        .extensions()
        .get::<MatchedPath>()
        .map(|m| m.as_str().to_string())
        .unwrap_or_else(|| "unmatched".to_string());

    let parent_cx = global::get_text_map_propagator(|propagator| {
        propagator.extract(&HeaderMapExtractor(req.headers()))
    });

    let span = tracing::info_span!(
        "http_request",
        otel.name = %format!("{} {}", method, route),
        otel.kind = "server",
        http.request.method = %method,
        http.route = %route,
        http.response.status_code = tracing::field::Empty,
        trace_id = tracing::field::Empty,
    );

    let _ = span.set_parent(parent_cx);
    let trace_id = span.context().span().span_context().trace_id().to_string();
    span.record("trace_id", trace_id.as_str());

    let mut response = next.run(req).instrument(span.clone()).await;

    let status_code = response.status().as_u16();
    span.record("http.response.status_code", status_code);

    if trace_id != "00000000000000000000000000000000" {
        if let Ok(val) = HeaderValue::try_from(trace_id.as_str()) {
            response.headers_mut().insert(X_TRACE_ID.clone(), val);
        }
    }

    let elapsed_secs = start.elapsed().as_secs_f64();
    let attrs = [
        KeyValue::new("http.request.method", method),
        KeyValue::new("http.route", route),
        KeyValue::new("http.response.status_code", i64::from(status_code)),
    ];
    let metrics = http_metrics();
    metrics
        .request_duration_seconds
        .record(elapsed_secs, &attrs);
    metrics.request_total.add(1, &attrs);

    response
}
