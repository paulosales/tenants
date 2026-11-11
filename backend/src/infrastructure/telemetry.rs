use opentelemetry::{global, trace::TracerProvider as _, KeyValue};
use opentelemetry_appender_tracing::layer::OpenTelemetryTracingBridge;
use opentelemetry_otlp::{LogExporter, MetricExporter, Protocol, SpanExporter, WithExportConfig};
use opentelemetry_sdk::{
    logs::SdkLoggerProvider, metrics::SdkMeterProvider, propagation::TraceContextPropagator,
    trace::SdkTracerProvider, Resource,
};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// RAII handle owning OpenTelemetry providers so traces, metrics, and logs flush on shutdown.
#[derive(Default)]
pub struct TelemetryGuard {
    tracer_provider: Option<SdkTracerProvider>,
    meter_provider: Option<SdkMeterProvider>,
    logger_provider: Option<SdkLoggerProvider>,
}

impl TelemetryGuard {
    pub fn shutdown(self) {
        if let Some(provider) = self.logger_provider {
            let _ = provider.shutdown();
        }
        if let Some(provider) = self.meter_provider {
            let _ = provider.shutdown();
        }
        if let Some(provider) = self.tracer_provider {
            let _ = provider.shutdown();
        }
    }
}

fn normalize_otlp_signal_url(base_endpoint: &str, signal_path: &str) -> String {
    let trimmed = base_endpoint.trim().trim_end_matches('/');
    let stripped = trimmed
        .strip_suffix("/v1/traces")
        .or_else(|| trimmed.strip_suffix("/v1/metrics"))
        .or_else(|| trimmed.strip_suffix("/v1/logs"))
        .unwrap_or(trimmed);
    format!("{}/v1/{}", stripped, signal_path.trim_start_matches('/'))
}

/// Initializes W3C TraceContext propagation, structured JSON tracing logs, and (when an
/// `OTEL_EXPORTER_OTLP_ENDPOINT` is configured) OTLP export for traces, metrics, and logs.
pub fn init_telemetry(
    service_name: &str,
    environment: &str,
    otlp_endpoint: Option<&str>,
) -> TelemetryGuard {
    // Always register W3C TraceContext propagator so tests and handlers parse traceparent consistently.
    global::set_text_map_propagator(TraceContextPropagator::new());

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,backend=debug,tower_http=debug"));

    let resource = Resource::builder()
        .with_service_name(service_name.to_string())
        .with_attribute(KeyValue::new(
            "deployment.environment.name",
            environment.to_string(),
        ))
        .build();

    let Some(endpoint) = otlp_endpoint.map(str::trim).filter(|s| !s.is_empty()) else {
        let local_provider = SdkTracerProvider::builder().with_resource(resource).build();
        global::set_tracer_provider(local_provider.clone());
        let local_tracer = local_provider.tracer(service_name.to_string());

        let _ = tracing_subscriber::registry()
            .with(env_filter)
            .with(tracing_subscriber::fmt::layer().json())
            .with(tracing_opentelemetry::layer().with_tracer(local_tracer))
            .try_init();
        return TelemetryGuard {
            tracer_provider: Some(local_provider),
            ..Default::default()
        };
    };

    let tracer_provider = SpanExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpBinary)
        .with_endpoint(normalize_otlp_signal_url(endpoint, "traces"))
        .build()
        .ok()
        .map(|exporter| {
            let provider = SdkTracerProvider::builder()
                .with_resource(resource.clone())
                .with_batch_exporter(exporter)
                .build();
            global::set_tracer_provider(provider.clone());
            provider
        });

    let meter_provider = MetricExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpBinary)
        .with_endpoint(normalize_otlp_signal_url(endpoint, "metrics"))
        .build()
        .ok()
        .map(|exporter| {
            let provider = SdkMeterProvider::builder()
                .with_resource(resource.clone())
                .with_periodic_exporter(exporter)
                .build();
            global::set_meter_provider(provider.clone());
            provider
        });

    let logger_provider = LogExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpBinary)
        .with_endpoint(normalize_otlp_signal_url(endpoint, "logs"))
        .build()
        .ok()
        .map(|exporter| {
            SdkLoggerProvider::builder()
                .with_resource(resource)
                .with_batch_exporter(exporter)
                .build()
        });

    let trace_layer = tracer_provider.as_ref().map(|provider| {
        let tracer = provider.tracer(service_name.to_string());
        tracing_opentelemetry::layer().with_tracer(tracer)
    });

    let log_layer = logger_provider
        .as_ref()
        .map(OpenTelemetryTracingBridge::new);

    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(tracing_subscriber::fmt::layer().json())
        .with(trace_layer)
        .with(log_layer)
        .try_init();

    TelemetryGuard {
        tracer_provider,
        meter_provider,
        logger_provider,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_otlp_signal_url() {
        assert_eq!(
            normalize_otlp_signal_url("http://otel-collector:4318", "traces"),
            "http://otel-collector:4318/v1/traces"
        );
        assert_eq!(
            normalize_otlp_signal_url("http://otel-collector:4318/v1/traces/", "metrics"),
            "http://otel-collector:4318/v1/metrics"
        );
    }
}
