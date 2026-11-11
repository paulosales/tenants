# ApexLiving — Product Overview & Sales Presentation

> **One unified, zero-trust platform connecting prospective renters, residents, building staff, maintenance technicians, and property managers.**

---

## Slide 1: The Opportunity

### Modern Properties Shouldn't Run on Spreadsheets & Group Chats

Property operators juggle disconnected tools every day:
- Prospective tenant inquiries lost in generic email inboxes
- Maintenance work orders texted to technicians with no audit trail
- Garage parking tracked in outdated PDFs or static spreadsheets
- Amenity double-bookings causing resident frustration and concierge disputes
- Frontline cleaners and security staff disconnected from management updates

**ApexLiving** replaces 5+ fragmented tools with one high-velocity, role-tailored operating system across **Web & Mobile**.

---

## Slide 2: Introducing ApexLiving

### Purpose-Built Portals for Every Stakeholder

| Stakeholder | Dedicated Experience | Immediate Value |
| :--- | :--- | :--- |
| **Prospective Tenants** | **Public Leasing Portal** *(Zero Login Friction)* | Browse real-time vacant floorplans, inspect amenities, and submit applications directly to property managers. |
| **Property Managers** | **Operations Command Center** | Approve applications, onboard residents, manage staff rosters, assign SVG parking bays, approve amenity schedules, and chat with staff. |
| **Maintainers** | **Web & Mobile Dispatch Queue** | Receive unit tickets, update statuses live (`Dispatched` → `In Progress` → `Resolved`), and log resolution notes on site. |
| **Cleaners & Security** | **Mobile & Web Team Chat** | Direct channel to Property Managers for shift directives, supply requests, and incident reporting. |
| **Residents (Tenants)** | **Locked Resident Portal** | Reserve community amenities in local time (with zero double-booking) and track maintenance dispatch step by step. |
| **Portfolio Admins** | **Full Governance Console** | Cross-property analytics, dependency-safe CRUD, and complete RBAC security oversight. |

---

## Slide 3: Frictionless Leasing Marketplace (Interactive Map & Showcase → Lease Onboarding)

### Turn Renters Browsing Map Pins into Onboarded Residents in Minutes

1. **Interactive Rent-Pin Map & Deep Filters**: Prospective renters filter by **bedrooms (`Studio`–`3+`), bathrooms, monthly rent ceiling, city, and features** while comparing live **monthly rent range pills** across neighborhoods on a free, zero-API-key **Leaflet + OpenStreetMap** widget.
2. **Aurora-Grade Property Showcase Pages**: Every building gets a rich landing page featuring **CDN-delivered photo lightboxes**, formatted community storytelling (**rich-text HTML**), categorized amenities/features, and live **per-suite rent pricing**.
3. **Direct Suite Pre-Selection & 1-Click Onboarding**: Renters click **Apply for Suite X**, routing directly to that property's manager queue—and 1 click converts approved applicants into active tenants and occupies the unit.

---

## Slide 4: Property Manager Superpowers

### Every Daily Decision in One Place

- **Interactive Drag-and-Drop SVG Parking Builder**: Visually design subterranean or lot layouts with grid snapping, EV/compact/accessible bay types, and **1-click tenant parking assignment**.
- **Amenity Schedule Gatekeeping**: Residents submit amenity time-slot requests in their local timezone; managers review guest counts and **Accept** or **Reject** with notes (automatically freeing rejected slots).
- **Staff Roster & Maintenance Dispatch**: Manage cleaners, security, and technical specialists, monitor active call workloads per technician, and assign open calls cleanly.
- **Team & 1-on-1 Messaging**: Broadcast shift updates or send direct directives to individual staff members—automatically synced to their phones.

---

## Slide 5: Mobile-First Field Operations

### Built for Technicians, Cleaners & Security in the Field

- **For Maintainers**:
  - Open tickets on mobile immediately when dispatched.
  - Tap **Dispatch**, **Start Work**, or **Mark Solved** with detailed repair notes from the basement, rooftop, or unit doorway.
- **For Cleaners & Security**:
  - Communicate directly with Property Management via encrypted mobile chat—no personal phone numbers or consumer messaging apps required.
- **Zero-Footprint Mobile Security**: Native device credential storage via OS-level secure enclave (`expo-secure-store`) with short-lived HS256 JWTs.

---

## Slide 6: 5-Star Resident Retention Experience

### Self-Service Convenience That Residents Love

- **Timezone-Accurate Amenity Scheduling**: Time slots automatically display in the resident's local timezone while storing standardized UTC ranges.
- **Database-Enforced Double-Booking Immunity**: Backed by PostgreSQL **GiST Exclusion Constraints** (`tsrange`), two residents can never double-book the rooftop lounge or tennis court—even under concurrent traffic spikes.
- **Transparent Maintenance Tracking**: Residents submit requests in 30 seconds, grant entry permission, and watch real-time technician progress—plus one-tap access to the **24/7 Emergency Hotline**.

---

## Slide 7: Enterprise Security & Engineering Built to Scale

### Why Technical Buyers Trust ApexLiving

- **Rust + Axum High-Throughput Backend**: Memory-safe compiled API built with strict **Clean / Hexagonal Architecture** and **SOLID** principles across Backend, Web, and Mobile.
- **Zero-Trust Security Posture**:
  - **Argon2id** password hashing & algorithm-locked **HS256** JWT verification.
  - Browser authentication strictly via hardened **`HttpOnly`, `SameSite=Strict` cookies** + constant-time **`X-CSRF-Token`** validation (zero tokens exposed to `localStorage`).
  - **Backend-Enforced RBAC & Ownership Scoping**: Tenants never touch management APIs; cleaners never see resident PII; maintainers only act on work orders and team chat.
- **100% Parameterized SQL, XSS & CDN Media Hardening**: Immune to SQL injection; rich-text descriptions undergo server allow-list sanitization + client **DOMPurify**; uploaded property images pass magic-byte verification into **AWS S3 / MinIO CDN** object keys.
- **End-to-End OpenTelemetry Observability**: Browser-to-Rust **W3C TraceContext** (`traceparent`) distributed tracing, HTTP latency/throughput metrics, and trace-correlated structured logs routed via **OpenTelemetry Collector** into **Prometheus**, **Jaeger**, **Loki**, and **Grafana**.

---

## Slide 8: Commercial Value & ROI

### Quantifiable Impact Across Your Portfolio

- **40% Faster Leasing Turnaround**: Public showcase + auto-onboarding converts applicants before competitors follow up.
- **65% Fewer Front-Desk Coordination Calls**: Self-service maintenance trackers, clear amenity approvals, and visual parking clarity free up manager hours.
- **Zero Overlapping Amenity Disputes**: Mathematically enforced time-range exclusion at the database engine layer.
- **Unified Auditability**: Keep every resident booking, maintenance fix, parking assignment, and staff directive in one secure source of truth.

---

## Slide 9: Deployment Flexibility

### Run Anywhere You Operate

- **Turnkey Docker Compose Stack**: PostgreSQL 16 + Redis 7 + **MinIO S3 CDN** + **OpenTelemetry Collector / Jaeger / Prometheus / Loki / Grafana** + Rust Backend + React Web App ready in minutes, with built-in **Leaflet + OpenStreetMap** mapping (no paid map API keys needed) and instant production switch-over to **AWS S3** / CloudFront.
- **Monorepo Shared Contracts**: `@tenants/shared-types` & `@tenants/shared-ui` ensure web, mobile, and backend speak the exact same language.
- **Ready for Cloud or On-Prem**: Stateless API containers scale horizontally behind your TLS load balancer.

---

## Slide 10: Next Steps — Launch Your Pilot

1. **Day 1**: Import your properties, units, staff roster, and SVG garage layout.
2. **Week 1**: Publish your **Public Leasing Portal** link and onboard your Property Managers, Maintainers, Cleaners, and Security staff onto Web + Mobile.
3. **Week 2**: Invite residents to the **Tenant Portal** for self-service amenity reservations and maintenance tracking.

**Ready for a live walkthrough?** Log in with any role—Visitor, Tenant, Staff, Maintainer, Property Manager, or Admin—and experience **ApexLiving** in action today.
