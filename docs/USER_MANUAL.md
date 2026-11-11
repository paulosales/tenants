# ApexLiving — Application User Manual & Operations Guide

Welcome to the **ApexLiving Property & Tenant Management Platform** user manual. This guide covers every workflow across the **Web Portal**, **Mobile Application**, and **Backend API**, organized by user role.

---

## Table of Contents

1. [Platform Overview & Roles](#1-platform-overview--roles)
2. [Role-Based Access Matrix](#2-role-based-access-matrix)
3. [Getting Started & Development Login Accounts](#3-getting-started--development-login-accounts)
4. [Public Property Portal (Unauthenticated Visitors)](#4-public-property-portal-unauthenticated-visitors)
5. [Administrator Guide (`super_admin`)](#5-administrator-guide-super_admin)
6. [Property Manager Guide (`property_manager`)](#6-property-manager-guide-property_manager)
7. [Maintainer Guide (`maintenance_staff`)](#7-maintainer-guide-maintenance_staff)
8. [Building Staff Guide (`staff`: Cleaners, Security & Concierge)](#8-building-staff-guide-staff-cleaners-security--concierge)
9. [Tenant / Resident Guide (`tenant`)](#9-tenant--resident-guide-tenant)
10. [Mobile App Guide (`@tenants/mobile`)](#10-mobile-app-guide-tenantsmobile)
11. [Timezones, Scheduling Guarantees & Security Architecture](#11-timezones-scheduling-guarantees--security-architecture)
12. [API Endpoints Reference](#12-api-endpoints-reference)

---

## 1. Platform Overview & Roles

ApexLiving connects prospective renters, active residents, building staff, maintenance technicians, property managers, and portfolio administrators on a single synchronized platform:

| Persona | Primary Clients | Key Responsibilities |
| :--- | :--- | :--- |
| **Public Visitor** | Web (no login required) | Browse managed properties, inspect vacant units & amenities, and submit a tenancy application to Property Management. |
| **Super Admin** (`super_admin`) | Web + API | Full portfolio governance, properties, units, tenants, staff, applications, amenities, parking, maintenance, messaging, audit logs, and Resident View preview. |
| **Property Manager** (`property_manager`) | Web + Mobile | Review & approve/reject tenancy applications, manage staff (cleaners, maintainers, security), assign parking spots, accept/reject amenity schedules, dispatch maintenance calls, and message staff. |
| **Maintainer** (`maintenance_staff`) | Web + Mobile | Receive assigned/open maintenance calls, advance call status (`dispatched` → `in_progress` → `resolved`), record resolution notes, and message the Property Manager. |
| **Building Staff** (`staff`) | Mobile + Web | Cleaners, security officers, and concierge staff communicate directly with Property Managers and view team broadcasts. |
| **Tenant / Resident** (`tenant`) | Web + Mobile | Scoped strictly to **Tenant View** (schedule amenity sessions in local time, track/cancel own bookings, file/track own maintenance calls, view parking/amenities on mobile). |

---

## 2. Role-Based Access Matrix

All permissions are strictly enforced both in the UI and on the Rust Axum backend (`401 Unauthorized` / `403 Forbidden`):

| Capability | Unauthenticated | Tenant | Staff | Maintainer | Property Manager | Super Admin |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Browse public property listings | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit tenancy application | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View & manage own amenity sessions | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| View & file own maintenance calls | ❌ | ✅ | ❌ | ❌ | ✅ | ✅ |
| Accept / Reject amenity schedules | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Receive & update maintenance call status | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Staff ↔ Property Manager messaging | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ |
| Review & approve tenancy applications | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage property staff (add/edit/delete) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Design garage layout & assign parking spots | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create/delete properties, units & audit logs | ❌ | ❌ | ❌ | ❌ | ⚠️ Props/Units (`✅`), Audit (`❌`) | ✅ |

---

## 3. Getting Started & Development Login Accounts

When running locally with Docker Compose (`docker compose up`), database migrations automatically seed the following local development accounts.

> **Important Security Notice:** Development accounts share a sample demo password strictly for local testing. Always rotate passwords and secrets before deploying to staging or production.

| Role | Email | Linked Identity | Default Password (Dev Only) |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin@property.local` | Chief Operations Admin | `Password123!` |
| **Property Manager** | `manager@property.local` | Sarah Jenkins (Grandview Heights) | `Password123!` |
| **Maintainer** | `maintainer@property.local` | Carlos Mendez (Lead Plumber) | `Password123!` |
| **Building Staff** | `staff@property.local` | Maria Gonzalez (Head of Housekeeping) | `Password123!` |
| **Tenant** | `tenant@property.local` | Marcus Vance (Unit 101) | `Password123!` |

### Signing In
1. Navigate to the Web URL (`http://localhost:5173`). Unauthenticated visitors land on the **Public Leasing Portal**.
2. Click **Sign In to Workspace** in the top-right header to open the **Login Page**.
3. Click any role card in the **Role Directory** on the right to pre-fill the corresponding email, enter your password, and click **Sign In**.
4. Your browser session uses backend-issued `HttpOnly; SameSite=Strict` cookies plus an `X-CSRF-Token` double-submit header (zero tokens in `localStorage` or `sessionStorage`).

---

## 4. Public Property Portal & Interactive Rental Search (Unauthenticated Visitors)

Prospective tenants do **not** need an account to search communities, inspect floorplans, or apply:

1. **Automatic City Detection & Multi-Criteria Search**: On initial visit (when no `?city=` query param is specified), the portal checks browser geolocation locally against property coordinates to auto-filter to the visitor's current city when properties exist nearby (with a one-click **Near Me** re-detect button and **View all cities** override). Filter communities by keyword, city, bedrooms (`Any`, `Studio`, `1+`, `2+`, `3+` — synced via URL query parameters such as `?beds=2`), minimum bathrooms, monthly rent range (`Min $` / `Max $`), expandable **Features** tags, **Available Now Only**, and sort order (`Recommended`, `Rent: Low to High`, `Rent: High to Low`, `Most Available Units`).
2. **Interactive Free Map Widget with Rent Price Pins**: Switch between **Split List & Map**, **Grid View**, or **Map Only** powered by **Leaflet + OpenStreetMap** (zero API key required). Each map pin displays the community's live monthly rent price range (e.g., `$1,650 – $2,350/mo`). Hovering or clicking a pin highlights the card, previews photos and availability, and links straight to the showcase or application.
3. **Dedicated Property Showcase Page**: Click **Explore Community** (or a community banner) to view the full **Community Showcase**:
   - **CDN Photo Gallery & Lightbox** with multi-photo thumbnails.
   - **About This Community** rich-text overview, **Pet Policy**, and **Lease Terms**.
   - **Categorized Features & Resident Perks** (`Community`, `In-Suite`, `Utilities`, `Policies`, `Transit`).
   - **Available Suites & Floorplans** filterable by bedroom count with exact monthly rent and direct **Apply for Suite X** buttons.
   - **Embedded Neighborhood Map** centered on the property coordinates.
4. **Submitting an Application**: Click **Apply for Suite X** or **Apply to Be a Tenant**, review the pre-selected preferred unit, complete contact/income/employment details, and click **Submit Application**.
   - Applications enter the queue with status `pending` and route directly to that property's **Property Manager(s)**.

---

## 5. Administrator Guide (`super_admin`)

Administrators have complete visibility across every building and module:

- **Properties & Showcase Media**: Create, edit, or remove buildings (protected by a dependency guard preventing accidental deletion while units exist), and click **Showcase & Media** on any property row to:
  - Edit the **Rich-Text Community Description**, **Pet Policy**, **Lease Terms**, and **Map Geo-Coordinates** (`Latitude`, `Longitude`).
  - **Add or Remove Property Features** categorized across Community, In-Suite, Utilities, Policies, and Transit.
  - **Upload, Set Cover, or Remove CDN Photos** stored in S3-compatible object storage (**MinIO** in local dev; AWS S3 in production). Supported formats: JPEG, PNG, WebP up to 5 MB.
- **Units & Monthly Rent Pricing**: Manage apartment floorplans, **Monthly Rent (`$/mo`)**, multi-tenant unit assignments, and occupancy states (`vacant`, `occupied`, `maintenance`). Updating a unit's rent immediately recalculates the community price range on public cards and map pins.
- **Tenants**: Full tenant directory, lease dates, emergency contacts, and search.
- **Users & Roles**: Provision user accounts across all RBAC roles, reassign roles cleanly, link accounts to properties/staff/tenants, toggle active/suspended access, and inspect the live permissions & user-count matrix.
- **Applications / Staff / Messages / Amenity Approvals / Parking / Maintenance**: Full supervisory control.
- **Tenant View Toggle**: Switch to **Tenant View** via the top header or sidebar to inspect the exact resident portal experience.

---

## 6. Property Manager Guide (`property_manager`)

Signing in as `manager@property.local` opens a management-focused workspace containing these core workflows:

### 6.1 Reviewing Tenancy Applications (`Applications`)
1. Open the **Applications** tab to see all applications sent from the Public Portal, filterable by status (`pending`, `under_review`, `approved`, `rejected`) and active property.
2. Click **Start Review** to mark an application `under_review`.
3. Click **Approve** or **Reject** to open the confirmation modal and record optional review notes.
4. When approving, keep **Automatically onboard applicant as an Active Tenant and mark preferred unit as Occupied** checked to create the resident record immediately.

### 6.2 Managing Staff & Dispatching Maintenance (`Staff & Team` & `Maintenance Calls`)
1. In **Staff & Team**, filter staff by role (`manager`, `maintainer`, `security`, `cleaner`, `other`) or add/edit/remove staff members.
2. Click **Assign Call** on a maintainer card to dispatch an open maintenance ticket to that technician, optionally setting a target date and instructions.

### 6.3 Assigning Parking Spots (`Parking Map`)
1. Open **Parking Map** and choose a property.
2. Select any bay on the interactive SVG garage canvas (e.g., `P-03`, `EV-01`, `ACC-01`).
3. In the right **Spot Inspector**, choose a resident from **Assigned Tenant**, toggle occupancy, and click **Apply Assignment Immediately** (or edit the visual garage geometry and click **Save Layout**).

### 6.4 Accepting or Rejecting Amenity Schedules (`Amenity Approvals`)
1. Resident amenity booking requests start in `pending` status (while holding the slot against overlapping bookings in PostgreSQL).
2. Open **Amenity Approvals** to inspect the resident name, guest count, and **Local Time** window.
3. Click **Accept Schedule** (`confirmed`) or **Reject Schedule** (`rejected`) with an optional note (e.g., gate code or rejection reason). Rejected slots are automatically released for other residents.

### 6.5 Messaging Staff (`Staff Messages`)
1. Open **Staff Messages**.
2. Choose **All Property Staff (Broadcast / Feed)** or select an individual staff member (e.g., Carlos Mendez or Maria Gonzalez) on the left.
3. Send instructions or updates; staff see and reply to messages on both Web and the **Mobile App**.

---

## 7. Maintainer Guide (`maintenance_staff`)

Signing in as `maintainer@property.local` scopes the workspace strictly to field maintenance operations and manager communication:

- **Maintenance Calls (Web & Mobile)**:
  - View all work orders for your property or toggle **Only Assigned to Me**.
  - Advance ticket statuses as work progresses:
    1. **Accept / Dispatch** (`dispatched`)
    2. **Start Work** (`in_progress`)
    3. **Mark Solved** (`resolved`) — opens the resolution notes form to document parts replaced and verification checks.
- **Staff Messages**: Reply directly to the Property Manager or team channel.

---

## 8. Building Staff Guide (`staff`: Cleaners, Security & Concierge)

Signing in as `staff@property.local` (e.g., cleaner or security personnel) provides:

- Focused **Staff Messages** workspace on Web and **Manager Chat** on Mobile to receive instructions, report supply needs or perimeter incidents, and mark messages read.
- Restricted access: non-manager building staff cannot view resident PII, financial application details, or admin CRUD controls.

---

## 9. Tenant / Resident Guide (`tenant`)

Signing in as `tenant@property.local` restricts the session **strictly to the Resident Tenant View** (zero access to admin dashboards, staff chats, or other tenants' data):

1. **Amenities Session Scheduling**:
   - Browse property amenities, choose a date and duration, and inspect live **Local Time Window** previews (`America/New_York`, `America/Los_Angeles`, etc. — converted cleanly to UTC on storage).
   - View booking status (`PENDING`, `CONFIRMED`, `REJECTED`, `CANCELLED`) under **My Booked Sessions** and cancel upcoming bookings if needed.
2. **Maintenance Call & Dispatch**:
   - Submit maintenance requests with category (`plumbing`, `hvac`, `electrical`, etc.), priority (`routine`, `urgent`, `emergency`), entry permission, and callback phone.
   - Track live technician assignment and status transitions (`Reported` → `Dispatched` → `In Progress` → `Resolved`), or use the **24/7 Emergency Call** hotline button.

---

## 10. Mobile App Guide (`@tenants/mobile`)

The React Native / Expo mobile application (`apps/mobile`) supports role-authenticated Bearer sessions backed by `expo-secure-store` (native encrypted keystore/keychain on device):

1. **Login Screen**: Enter email & password (or tap a Role Account Hint to fill the email address).
2. **Role-Specific Home Dashboard**:
   - **Maintainers**: Tap **Maintenance Calls** to tap a ticket, enter resolution notes, and press **Dispatch**, **Start Work**, or **Mark Solved** (`PUT /api/v1/maintenance-calls/:id/status`), or tap **Manager Chat** to talk to the Property Manager.
   - **Building Staff (Cleaners / Security)**: Tap **Manager Chat** to message Property Management in real time (`GET/POST /api/v1/staff-messages`).
   - **Tenants**: Access **Reserve Parking** (interactive SVG Level P1 garage map) and **Book Amenity** shortcuts plus current spot/reservation summary cards.

Set `EXPO_PUBLIC_API_URL` if connecting from a physical device or emulator to a non-localhost backend host (default: `http://localhost:8080/api/v1`).

---

## 11. Timezones, Scheduling Guarantees & Security Architecture

- **UTC Storage / Local Display**: All timestamps in PostgreSQL and API payloads use UTC RFC3339 timestamps. The Web client converts user-selected local date/time windows to UTC on submission and renders booked sessions in the user's browser local timezone (with a UTC audit reference).
- **Double-Booking Prevention**: `reservations` enforces a PostgreSQL `EXCLUDE USING gist (amenity_id WITH =, reservation_period WITH &&)` constraint ignoring only `'cancelled'` and `'rejected'` reservations — guaranteeing atomic race-condition immunity.
- **Session & API Security**:
  - **Passwords**: Hashed with Argon2id (minimum 8 characters enforced on registration).
  - **Tokens**: Short-lived JWTs explicitly locked to `Algorithm::HS256` (`exp` validated) with CSPRNG refresh-token rotation and compromise revocation.
  - **Web Storage**: Zero tokens in `localStorage` or `sessionStorage`; Web relies exclusively on `HttpOnly`, `SameSite=Strict` cookies and a constant-time verified `X-CSRF-Token` double-submit header on cookie mutations.
  - **Rich-Text XSS Defense-in-Depth**: Community descriptions are sanitized server-side via an allow-list HTML sanitizer (max 32 KB, stripping `<script>`, event attributes, and `javascript:`/`data:` URLs, enforcing `rel="noopener noreferrer"`) and client-side via **DOMPurify**.
  - **Object Storage & Upload Hardening**: Photos are validated by HTTP `DefaultBodyLimit` (`6 MB`, enforcing `<= 5 MB` image payload), MIME verification, and raw **magic-byte signatures** (JPEG, PNG, WebP) before streaming via AWS SigV4 into UUID object keys in MinIO/S3.
  - **Database Queries**: 100% parameterized SQLx queries; strict ownership and `has_property_access()` validation on every endpoint.
- **Full-Stack OpenTelemetry Observability**:
  - **React Web SDK**: Initializes `@opentelemetry/sdk-trace-web` + `FetchInstrumentation`, exporting client spans over OTLP HTTP (`:4318`) and propagating **W3C Trace Context** (`traceparent` / `tracestate`) strictly to first-party backend API URLs.
  - **Rust Backend Telemetry**: Uses `tracing` + `tracing-opentelemetry` + `opentelemetry-otlp` + `opentelemetry-appender-tracing` to extract incoming W3C `traceparent` headers, attach `x-trace-id` onto responses, emit low-cardinality HTTP latency/count metrics (`MatchedPath`), and correlate JSON logs with active `trace_id`s.
  - **Collection & Storage Stack**: **OpenTelemetry Collector** (`:4317` gRPC / `:4318` HTTP) routes traces to **Jaeger** (`http://localhost:16686`), metrics to **Prometheus** (`http://localhost:9090`), and OTLP logs to **Loki** (`http://localhost:3100`), pre-wired in **Grafana** (`http://localhost:3001`).

---

## 12. API Endpoints Reference

Base URL: `/api/v1`

| Area | Method & Path | Access | Description |
| :--- | :--- | :--- | :--- |
| **Public** | `GET /public/properties` | Public | List active properties, rent ranges, CDN cover/gallery photos, features, and vacant floorplans (non-PII) |
| **Public** | `GET /public/properties/:id` | Public | Fetch full single-property showcase payload for deep links and detail view |
| **Public** | `POST /public/applications` | Public | Submit tenancy application routed to property manager(s) |
| **Auth** | `POST /auth/login` | Public | Authenticate user, issue cookies + CSRF token + mobile JWT |
| **Auth** | `POST /auth/register` | Public | Self-register a new `tenant` account |
| **Auth** | `POST /auth/logout`, `GET /auth/me` | Authenticated | Revoke session / fetch current user profile |
| **Showcase** | `GET/POST /properties/:id/features`, `DELETE .../features/:feature_id` | Read: Auth, Write: Admin/Manager | Manage categorized community & suite features (property-scoped) |
| **CDN Media** | `GET/POST /properties/:id/photos`, `PATCH .../cover`, `DELETE .../photos/:photo_id` | Read: Auth, Write: Admin/Manager | Upload/manage property photos in MinIO / AWS S3 CDN (`<= 5 MB`, magic-byte verified) |
| **Applications** | `GET /tenancy-applications` | Admin, Manager | List applications (`?property_id=&status=`) |
| **Applications** | `PATCH /tenancy-applications/:id/review` | Admin, Manager | Review (`under_review` / `approved` / `rejected`) + auto-onboard |
| **Staff** | `GET /staff`, `POST /staff`, `PUT/DELETE /staff/:id` | Read: All Staff+, Write: Admin/Manager | Manage cleaners, maintainers, security, managers |
| **Messaging** | `GET/POST /staff-messages`, `PATCH /staff-messages/:id/read` | Admin, Manager, Maintainer, Staff | Property team & 1-on-1 Manager ↔ Staff chat |
| **Parking** | `GET/PUT /properties/:id/parking-layout` | Read: Auth, Write: Admin/Manager | Interactive SVG garage layout builder |
| **Parking** | `POST /parking-spots/:id/assign` | Admin, Manager | Assign or unassign a parking spot to a tenant |
| **Amenities** | `GET/POST /amenity-sessions`, `POST /amenity-sessions/:id/cancel` | Tenant (own), Admin/Manager | Schedule/view/cancel amenity sessions |
| **Amenities** | `PATCH /amenity-sessions/:id/review` | Admin, Manager | Accept (`confirmed`) or reject (`rejected`) scheduled session |
| **Maintenance** | `GET/POST /maintenance-calls`, `POST .../assign-staff` | Tenant (own), Maintainer, Manager, Admin | Report, assign, and track maintenance calls |
| **Maintenance** | `PUT/PATCH /maintenance-calls/:id/status` | Maintainer, Manager, Admin | Advance call status & record resolution notes |
| **Users & Roles** | `GET/POST /users`, `GET /users/roles`, `PUT/DELETE /users/:id` | Super Admin only | List roles with live counts; create, re-role, suspend, or remove users |

