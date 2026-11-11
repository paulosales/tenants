import { describe, it, expect, afterEach } from 'vitest';
import { context, propagation, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { InMemorySpanExporter, SimpleSpanProcessor, WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import {
  buildAllowedTraceCorsUrls,
  initWebTelemetry,
} from '../infrastructure/telemetry';

describe('Frontend OpenTelemetry SDK & W3C TraceContext Propagation', () => {
  afterEach(() => {
    propagation.disable();
    trace.disable();
    context.disable();
  });

  it('restricts W3C traceparent CORS propagation strictly to first-party backend API URLs', () => {
    const allowed = buildAllowedTraceCorsUrls('https://api.apexliving.example/api/v1');

    expect(allowed.some((re) => re.test('http://localhost:8080/api/v1/public/properties'))).toBe(
      true
    );
    expect(allowed.some((re) => re.test('https://api.apexliving.example/api/v1/auth/me'))).toBe(
      true
    );
    expect(allowed.some((re) => re.test('https://tile.openstreetmap.org/12/10/15.png'))).toBe(
      false
    );
    expect(allowed.some((re) => re.test('https://nominatim.openstreetmap.org/reverse'))).toBe(
      false
    );
  });

  it('generates spans and injects valid W3C traceparent header onto carrier', () => {
    const memoryExporter = new InMemorySpanExporter();
    const provider = new WebTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(memoryExporter)],
    });
    provider.register({
      propagator: new W3CTraceContextPropagator(),
    });

    const tracer = provider.getTracer('tenants-web-test');
    const carrier: Record<string, string> = {};

    tracer.startActiveSpan('fetch.public.properties', (span) => {
      propagation.inject(context.active(), carrier);
      span.end();
    });

    expect(carrier.traceparent).toMatch(/^00-[0-9a-f]{32}-[0-9a-f]{16}-01$/);
    expect(memoryExporter.getFinishedSpans()).toHaveLength(1);
    expect(memoryExporter.getFinishedSpans()[0].name).toBe('fetch.public.properties');
  });

  it('skips automatic startup side effects in Vitest unless force is passed', () => {
    expect(initWebTelemetry()).toBeNull();
  });
});

