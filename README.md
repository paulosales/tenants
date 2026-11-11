# Apex Living — Property & Tenant Management Platform

[![CI/CD Pipeline](https://github.com/paulosales/tenants/actions/workflows/ci.yml/badge.svg)](https://github.com/paulosales/tenants/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Rust: 1.80+](https://img.shields.io/badge/Rust-1.80+-orange.svg)](https://www.rust-lang.org/)
[![Node: 22+](https://img.shields.io/badge/Node-22+-green.svg)](https://nodejs.org/)
[![Docker Compose](https://img.shields.io/badge/Docker-Turnkey_Dev-blue.svg)](docker-compose.dev.yml)

An enterprise-grade, highly secure, and maintainable Property & Tenant Management Platform featuring a Clean/Hexagonal Architecture Rust backend, an interactive React Web application, and a cross-platform React Native mobile client.

## Documentation & Sales Resources

- **[Application User Manual & Operations Guide](docs/USER_MANUAL.md)** — Complete role-by-role documentation (Public Visitor, Admin, Property Manager, Maintainer, Building Staff, Tenant), Mobile App guide, security architecture, and API reference.
- **[Product Overview & Sales Presentation](docs/SALES_PRESENTATION.md)** — Concise slide-by-slide commercial presentation and ROI pitch deck.

---

## Table of Contents

- [Architectural Overview](#architectural-overview)
- [Documentation & Sales Resources](#documentation--sales-resources)
- [Key Features](#key-features)
- [Monorepo Structure](#monorepo-structure)
- [Quick Start (Docker Turnkey)](#quick-start-docker-turnkey)
- [Backend Architecture (Rust)](#backend-architecture-rust)
  - [Clean Architecture Layers](#clean-architecture-layers)
  - [Database-Level Concurrency Control](#database-level-concurrency-control)
  - [Zero-Trust Security & OWASP ASVS](#zero-trust-security--owasp-asvs)
- [Client Applications](#client-applications)
  - [Web Client (React + Vite + Tailwind CSS)](#web-client-react--vite--tailwind-css)
  - [Mobile Client (React Native + Expo)](#mobile-client-react-native--expo)
  - [Shared Monorepo Packages](#shared-monorepo-packages)
- [Testing Strategy](#testing-strategy)
- [Free-Tier GitHub Actions CI/CD](#free-tier-github-actions-cicd)
- [Environment Variables](#environment-variables)
- [License](#license)

---

## Architectural Overview

```mermaid
graph TD
    subgraph Clients
        Web["Web Client (React 18 + Vite + Tailwind CSS)"]
        Mobile["Mobile Client (React Native + Expo)"]
    end

    subgraph "Edge & Network"
        Proxy["Reverse Proxy / TLS Termination"]
        RateLimit["Redis Token Bucket Rate Limiter"]
    end

    subgraph "Backend (Axum Clean Architecture)"
        subgraph Presentation
            Routes["REST & Webhook Handlers"]
            AuthMw["JWT & ABAC Middleware"]
            SecurityMw["OWASP Security Headers (CSP, HSTS, CORS)"]
        end

        subgraph Application
            ResSvc["Reservation Service"]
            ParkSvc["Parking & SVG Layout Service"]
            AuthSvc["Auth & Token Lifecycle Service"]
            PaySvc["Stripe Payment Service"]
            AuditSvc["Audit Logging Pipeline"]
        end

        subgraph Domain
            Entities["Entities (User, Reservation, Spot, Amenity)"]
            ValueObjects["Value Objects (TsRange, SvgCoordinates)"]
            DomainErrors["Typed Invariants (thiserror)"]
            RepoTraits["Repository Interfaces"]
        end

        subgraph Infrastructure
            PgRepo["SQLx Async PostgreSQL Repositories"]
            StripeClient["Stripe SDK & HMAC Webhook Verifier"]
            RedisClient["Redis Cache & Rate Limiting Engine"]
            SvgSanitizer["Strict XML/SVG Event Sanitizer"]
        end
    end

    subgraph "Data Storage"
        PostgreSQL[("PostgreSQL 16 + GiST (btree_gist/tsrange)")]
        RedisDB[("Redis 7 (Sessions, Token Bucket)")]
    end

    Web --> Proxy
    Mobile --> Proxy
    Proxy --> SecurityMw --> AuthMw --> RateLimit --> Routes
    Routes --> Application
    Application --> Domain
    Application --> Infrastructure
    Infrastructure --> PostgreSQL
    Infrastructure --> RedisDB
    Infrastructure --> StripeClient
```

---

## Key Features

1. **Zero Double-Bookings (DB-Engine Guarantee)**: Calendar reservations utilize PostgreSQL `tsrange` types with GiST exclusion constraints (`EXCLUDE USING gist (amenity_id WITH =, reservation_period WITH &&)`), making concurrent double-booking mathematically impossible at the database engine level.
2. **Interactive SVG Parking Engine**:
   - **Admin Mode**: Visual floorplan editor to draw, resize, and position parking bays, adjust hourly/monthly rates, and export sanitized SVG layouts or typed JSON geometry nodes.
   - **Tenant Mode**: Interactive parking blueprint with real-time occupancy highlighting (vacant, reserved, occupied) and instant one-click reservations.
3. **Optimistic Updates with Automatic Rollback**: TanStack Query mutation hook provides instant UI feedback on booking attempts with automatic rollback if a 409 Conflict occurs.
4. **OWASP ASVS Level 2 Security**:
   - Argon2id password hashing with unique per-user cryptographic salts.
   - Short-lived asymmetric JWT access tokens with rotating refresh tokens stored in HTTP-only, `SameSite=Strict`, `Secure` cookies.
   - Strict server-side XML/SVG sanitizer stripping `<script>`, event handlers (`onload`, `onclick`), DTD entity expansions (`<!ENTITY`), and `javascript:` URIs.
   - Stripe webhook verification with HMAC-SHA256 and replay attack protection.
   - Redis token bucket rate limiting on authentication and mutation endpoints.
5. **Turnkey Docker Local Development**: Sub-second hot reloading using `cargo-watch` and Vite container HMR with isolated build volumes.
6. **Free-Tier GitHub Actions CI/CD**: Optimized for the 2,000 monthly Linux minutes quota using `ubuntu-latest`, `Swatinem/rust-cache@v2`, concurrency cancellation, and path filters.

---

## Monorepo Structure

```text
tenants/
├── backend/                       # Rust Axum Clean Architecture Backend
│   ├── Cargo.toml
│   ├── Dockerfile                 # Multi-stage production container (cargo-chef + distroless)
│   ├── Dockerfile.dev             # Hot-reloading development container (cargo-watch + sqlx-cli)
│   ├── migrations/
│   │   └── 0001_initial_schema.sql # GiST exclusion constraints & initial seed data
│   ├── src/
│   │   ├── domain/                # Pure business logic, entities, and repository traits
│   │   ├── application/           # Use cases, DTOs, and domain services
│   │   ├── infrastructure/        # SQLx repositories, Redis, Stripe, SVG sanitizer
│   │   └── presentation/          # Axum routing, middleware, and HTTP handlers
│   └── tests/
│       └── reservation_concurrency_test.rs # 10-thread concurrent double-booking test
├── packages/
│   ├── shared-types/              # TypeScript contracts mirroring Rust domain models
│   └── shared-ui/                 # Design tokens & useOptimisticBooking headless hook
├── apps/
│   ├── web/                       # React 18, Vite, Tailwind CSS, TanStack Query
│   │   ├── Dockerfile             # Production multi-stage build (Node -> Hardened Nginx)
│   │   ├── Dockerfile.dev         # Development container with HMR polling
│   │   ├── src/
│   │   │   ├── components/        # ParkingMapViewer, ParkingMapEditor, AmenityCalendar
│   │   │   └── tests/             # Vitest & React Testing Library test suites
│   │   └── e2e/                   # Playwright end-to-end user journey tests
│   └── mobile/                    # React Native + Expo mobile client
│       ├── App.tsx
│       └── src/screens/           # DashboardScreen, ParkingMapScreen, AmenityBookingScreen
├── docker-compose.dev.yml         # Development multi-container orchestration
├── docker-compose.yml             # Root compose manifest
├── pnpm-workspace.yaml            # Monorepo workspace configuration
└── .github/
    └── workflows/
        └── ci.yml                 # Free-Tier optimized GitHub Actions workflow
```

---

## Quick Start (Docker Turnkey)

Boot the entire platform (PostgreSQL, Redis, migrations, Axum backend, and Vite frontend) with a single command:

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Service Access URLs

| Service | Local URL | Description |
|---|---|---|
| **Web Application** | [http://localhost:5173](http://localhost:5173) | Vite React Frontend (HMR enabled) |
| **Backend REST API** | [http://localhost:8080/api/v1](http://localhost:8080/api/v1) | Axum Server |
| **Health Check** | [http://localhost:8080/api/v1/health](http://localhost:8080/api/v1/health) | Liveness probe endpoint |
| **PostgreSQL Database** | `localhost:5432` | User: `postgres`, DB: `tenants_db` |
| **Redis Cache** | `localhost:6379` | Token bucket rate limiter & session cache |

---

## Backend Architecture (Rust)

### Clean Architecture Layers

1. **`domain`**:
   - Entities: [`User`](backend/src/domain/user.rs), [`Amenity`](backend/src/domain/amenity.rs), [`Reservation`](backend/src/domain/reservation.rs), [`ParkingSpot`](backend/src/domain/parking.rs), [`ParkingZone`](backend/src/domain/parking.rs), [`Payment`](backend/src/domain/payment.rs), [`AuditLog`](backend/src/domain/audit.rs).
   - Invariants: Typed domain errors implemented with `thiserror` ([`DomainError`](backend/src/domain/errors.rs)).
   - Contracts: Asynchronous repository traits ([`repository.rs`](backend/src/domain/repository.rs)).
2. **`application`**:
   - [`AuthService`](backend/src/application/auth_service.rs): Password hashing with Argon2id, JWT creation, and rotating refresh tokens.
   - [`ReservationService`](backend/src/application/reservation_service.rs): Operating hours enforcement, price calculations, transactional slot creation, and ABAC ownership guards.
   - [`ParkingService`](backend/src/application/parking_service.rs): Layout retrieval, spot status transitions, and strict SVG layout sanitization.
   - [`PaymentService`](backend/src/application/payment_service.rs): Stripe Payment Intent generation and webhook HMAC-SHA256 signature verification.
3. **`infrastructure`**:
   - Concrete PostgreSQL repositories using SQLx with parameterized queries.
   - [`SvgSanitizer`](backend/src/infrastructure/svg_sanitizer.rs): High-performance event-driven XML parser stripping active content and unsafe protocols.
   - [`RedisRateLimiter`](backend/src/infrastructure/redis_client.rs): Atomic fixed-window / token bucket limiter.
4. **`presentation`**:
   - Axum routes ([`routes.rs`](backend/src/presentation/routes.rs)) wrapped with Tower middleware: `TraceLayer`, `CompressionLayer`, `CorsLayer`, `security_headers_middleware`, and `request_id_middleware`.
   - Typed extractors: [`AuthenticatedUser`](backend/src/presentation/middleware/auth.rs) supporting both `Authorization: Bearer <token>` and HTTP-only cookies.
   - Standardized RFC 7807 Problem Details HTTP error mapping ([`error_response.rs`](backend/src/presentation/error_response.rs)).

---

### Database-Level Concurrency Control

Double-bookings are prevented via PostgreSQL `btree_gist` exclusion constraints:

```sql
CONSTRAINT no_overlapping_reservations EXCLUDE USING gist (
    amenity_id WITH =,
    reservation_period WITH &&
) WHERE (deleted_at IS NULL AND status != 'cancelled');
```

When concurrent transactions attempt to book overlapping intervals for the same amenity, PostgreSQL rejects the conflicting insert with SQLSTATE `23P01` (`exclusion_violation`). The repository translates this into a typed `DomainError::ReservationConflict`, returning an **HTTP 409 Conflict** response.

---

### Zero-Trust Security & OWASP ASVS

- **Password Hashing**: Argon2id with unique cryptographic per-user salt.
- **Session Security**: Short-lived JWT access tokens (15 mins) paired with rotating refresh tokens stored in hashed form in the database.
- **Cookie Flags**: Cookies provisioned with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` (production).
- **HTTP Security Headers**:
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';`
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **Input Sanitization**: Client-supplied SVG markup is parsed via an XML stream reader; prohibited elements (`<script>`, `<a>`, `<iframe>`, `on*` event handlers, entity references) are rejected or stripped.
- **Audit Logging**: Immutable audit entries recording actor identity, action, entity IDs, timestamps, and IP addresses.

---

## Client Applications

### Web Client (React + Vite + Tailwind CSS)

Located in `apps/web`:
- **State Management**: TanStack Query with cache isolation.
- **Interactive Parking Map Viewer**: Real-time SVG layout rendering vacant, reserved, and occupied spots with interactive selection.
- **Admin Parking Map Editor**: Visual canvas to draw, resize, and reposition spots, adjust parking rates, and export sanitized blueprints.
- **Amenity Reservation Calendar**: Daily and weekly booking timeline with operating hours constraint checking and optimistic updates.

### Mobile Client (React Native + Expo)

Located in `apps/mobile`:
- Cross-platform support (iOS & Android) built on React Native & Expo.
- Touch-responsive SVG parking blueprint viewer (`react-native-svg`).
- Amenity booking flow with local caching.

### Shared Monorepo Packages

- **`@tenants/shared-types`**: TypeScript type definitions matching Rust domain entities and API DTOs.
- **`@tenants/shared-ui`**: Design tokens and the headless `useOptimisticBooking` hook.

---

## Testing Strategy

The repository includes test coverage across all layers:

### 1. Rust Unit Tests
Domain logic, pricing calculations, password verification, SVG sanitization, and Stripe webhook HMAC verification:
```bash
cargo test --workspace
```

### 2. High-Concurrency Stress Test
Validates that 10 concurrent requests competing for the exact same reservation slot result in **1 success and 9 HTTP 409 Conflicts**:
```bash
cargo test --test reservation_concurrency_test
```

### 3. Web Component Tests (Vitest & React Testing Library)
Tests SVG map rendering, spot selection, and calendar forms:
```bash
pnpm --filter @tenants/web test
```

### 4. Production Web Build Check
```bash
pnpm --filter @tenants/web build
```

---

## Free-Tier GitHub Actions CI/CD

The workflow in [`.github/workflows/ci.yml`](.github/workflows/ci.yml) is specifically engineered for GitHub Free-Tier limits (2,000 Linux minutes/month):

1. **Ubuntu Runners**: Exclusively runs on `ubuntu-latest` (1x cost multiplier vs 10x on macOS).
2. **Aggressive Caching**: Uses `Swatinem/rust-cache@v2` for Rust compilation artifacts and `actions/setup-node` caching for pnpm dependencies.
3. **Concurrency Termination**: Cancels superseded runs immediately when new commits are pushed:
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```
4. **Parallel Jobs**:
   - `lint-and-typecheck`: `cargo fmt`, `cargo clippy`, and TypeScript checks.
   - `test-backend`: Runs database migrations and Rust tests against ephemeral PostgreSQL and Redis service containers.
   - `test-frontend`: Runs Vitest component test suites.

---

## Environment Variables

Copy `.env.example` to `.env` to configure local variables:

```bash
cp .env.example .env
```

| Variable | Default Value | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://postgres:postgres_dev_secret_change_in_prod@localhost:5432/tenants_db` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | *(At least 32 characters)* | HMAC-SHA256 secret for signing JWTs |
| `JWT_ACCESS_EXPIRATION_SECONDS` | `900` (15 minutes) | Access token lifetime |
| `JWT_REFRESH_EXPIRATION_SECONDS` | `604800` (7 days) | Refresh token lifetime |
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe API Secret Key |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe Webhook signing secret |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | CORS allowed origins |

---

## Seed Accounts (Development)

The initial migration pre-seeds the following test accounts (password for all: `Password123!`):

| Role | Email | Unit |
|---|---|---|
| **Super Admin** | `admin@property.local` | PH-1 |
| **Property Manager** | `manager@property.local` | M-101 |
| **Tenant** | `tenant@property.local` | Apt-402 |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
