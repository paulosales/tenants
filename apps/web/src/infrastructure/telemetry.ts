import { context, trace } from '@opentelemetry/api';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

let initialized = false;
let activeProvider: WebTracerProvider | null = null;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Restricts W3C `traceparent` header injection strictly to first-party backend origins
 * so trace metadata never leaks to external map/tile/CDN providers.
 */
export function buildAllowedTraceCorsUrls(apiBaseUrl?: string): RegExp[] {
  const patterns: RegExp[] = [
    /^http:\/\/localhost:8080(\/|$)/,
    /^http:\/\/127\.0\.0\.1:8080(\/|$)/,
  ];

  if (apiBaseUrl) {
    try {
      const origin = new URL(apiBaseUrl).origin;
      const originRegex = new RegExp(`^${escapeRegExp(origin)}(\\/|$)`);
      if (!patterns.some((p) => p.source === originRegex.source)) {
        patterns.push(originRegex);
      }
    } catch {
      // Ignore relative API paths; same-origin fetches receive W3C headers automatically
    }
  }

  return patterns;
}

export interface InitWebTelemetryOptions {
  exporterUrl?: string;
  serviceName?: string;
  apiBaseUrl?: string;
  force?: boolean;
}

/**
 * Initializes OpenTelemetry JS Web SDK with Batch OTLP/HTTP export, ZoneContextManager
 * for async React/Fetch tracking, and W3C TraceContext header propagation (`traceparent`).
 */
export function initWebTelemetry(
  options: InitWebTelemetryOptions = {}
): WebTracerProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }
  if (import.meta.env.MODE === 'test' && !options.force) {
    return null;
  }
  if (initialized && !options.force) {
    return activeProvider;
  }

  const serviceName =
    options.serviceName || import.meta.env.VITE_OTEL_SERVICE_NAME || 'tenants-web';
  const exporterUrl =
    options.exporterUrl ||
    import.meta.env.VITE_OTEL_EXPORTER_URL ||
    'http://localhost:4318/v1/traces';
  const apiBaseUrl = options.apiBaseUrl || import.meta.env.VITE_API_URL;

  const exporter = new OTLPTraceExporter({
    url: exporterUrl,
  });

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    spanProcessors: [
      new BatchSpanProcessor(exporter, {
        maxQueueSize: 512,
        maxExportBatchSize: 64,
        scheduledDelayMillis: 2500,
      }),
    ],
  });

  provider.register({
    contextManager: new ZoneContextManager(),
    propagator: new W3CTraceContextPropagator(),
  });

  registerInstrumentations({
    instrumentations: [
      new FetchInstrumentation({
        clearTimingResources: true,
        propagateTraceHeaderCorsUrls: buildAllowedTraceCorsUrls(apiBaseUrl),
        ignoreUrls: [
          new RegExp(`^${escapeRegExp(exporterUrl)}`),
          /tile\.openstreetmap\.org/,
          /nominatim\.openstreetmap\.org/,
        ],
      }),
    ],
  });

  initialized = true;
  activeProvider = provider;
  return provider;
}

export function getActiveTraceId(): string | null {
  const span = trace.getSpan(context.active());
  const traceId = span?.spanContext().traceId;
  return traceId && traceId !== '00000000000000000000000000000000' ? traceId : null;
}

export async function withUiSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer('tenants-web-ui');
  return tracer.startActiveSpan(name, async (span) => {
    try {
      return await fn();
    } finally {
      span.end();
    }
  });
}

