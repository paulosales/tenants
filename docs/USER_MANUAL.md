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

## 4. Public Property Portal (Unauthenticated Visitors)

Prospective tenants do **not** need an account to explore communities or apply:

1. On the **Public Leasing Portal**, browse listed properties along with vacant unit counts, available floorplans (`bedrooms`, `bathrooms`, `square_feet`), and community amenities.
2. Use the **Search** bar to filter by building name, city, or street address.
3. Click **Apply to Be a Tenant** on any property card.
4. Optionally select a **Preferred Vacant Unit**, fill in contact details, monthly income, employment status, desired move-in date, occupant count, and notes.
5. Click **Submit Application**.
   - Applications enter the queue with status `pending` and are routed directly to that property's **Property Manager(s)**.

---

## 5. Administrator Guide (`super_admin`)

Administrators have complete visibility across every building and module:

- **Properties**: Create, edit, or remove buildings (protected by a dependency guard preventing accidental deletion while units exist).
- **Units**: Manage apartment floorplans, multi-tenant unit assignments, and occupancy states (`vacant`, `occupied`, `maintenance`).
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
  - **Database Queries**: 100% parameterized SQLx queries; strict ownership and role validation on every endpoint.

---

## 12. API Endpoints Reference

Base URL: `/api/v1`

| Area | Method & Path | Access | Description |
| :--- | :--- | :--- | :--- |
| **Public** | `GET /public/properties` | Public | List active properties, vacant floorplans, amenity names (non-PII) |
| **Public** | `POST /public/applications` | Public | Submit tenancy application routed to property manager(s) |
| **Auth** | `POST /auth/login` | Public | Authenticate user, issue cookies + CSRF token + mobile JWT |
| **Auth** | `POST /auth/register` | Public | Self-register a new `tenant` account |
| **Auth** | `POST /auth/logout`, `GET /auth/me` | Authenticated | Revoke session / fetch current user profile |
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

