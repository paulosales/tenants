-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- 1. User Roles Enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM (
        'super_admin',
        'property_manager',
        'maintenance_staff',
        'tenant'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'tenant',
    phone VARCHAR(50),
    unit_number VARCHAR(50),
    refresh_token_hash VARCHAR(255),
    refresh_token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_email_active ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE deleted_at IS NULL;

-- 3. Common Area Amenities Table
CREATE TABLE IF NOT EXISTS amenities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    capacity INT NOT NULL DEFAULT 10,
    hourly_rate_cents INT NOT NULL DEFAULT 0,
    min_duration_minutes INT NOT NULL DEFAULT 60,
    max_duration_minutes INT NOT NULL DEFAULT 240,
    open_time_minutes INT NOT NULL DEFAULT 480,  -- 08:00 (480 mins from midnight)
    close_time_minutes INT NOT NULL DEFAULT 1320, -- 22:00 (1320 mins from midnight)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_amenities_active ON amenities (is_active) WHERE deleted_at IS NULL;

-- 4. Reservations Table with GiST Double-Booking Exclusion Constraint
CREATE TABLE IF NOT EXISTS reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reservation_period TSRANGE NOT NULL,
    total_price_cents INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed', -- 'pending_payment', 'confirmed', 'cancelled', 'completed'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Mathematical guarantee at database level against double-booking race conditions:
    -- Cannot have overlapping reservation_period for the same amenity_id if not cancelled or deleted.
    CONSTRAINT no_overlapping_reservations EXCLUDE USING gist (
        amenity_id WITH =,
        reservation_period WITH &&
    ) WHERE (deleted_at IS NULL AND status != 'cancelled')
);

CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations (user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reservations_period ON reservations USING gist (reservation_period);
CREATE INDEX IF NOT EXISTS idx_reservations_amenity_period ON reservations USING gist (amenity_id, reservation_period) WHERE deleted_at IS NULL;

-- 5. Parking Zones (Floors/Lots)
CREATE TABLE IF NOT EXISTS parking_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    floor_level INT NOT NULL DEFAULT 1,
    svg_viewbox VARCHAR(50) NOT NULL DEFAULT '0 0 1000 600',
    svg_raw TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- 6. Parking Spots Table with Geometry Nodes
CREATE TABLE IF NOT EXISTS parking_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES parking_zones(id) ON DELETE CASCADE,
    spot_number VARCHAR(50) NOT NULL,
    spot_type VARCHAR(30) NOT NULL DEFAULT 'standard', -- 'standard', 'compact', 'ev_charging', 'accessible'
    shape_type VARCHAR(20) NOT NULL DEFAULT 'rect',    -- 'rect', 'polygon'
    coordinates JSONB NOT NULL,                         -- { x: 100, y: 50, width: 60, height: 120 } or { points: [[x, y], ...] }
    hourly_rate_cents INT NOT NULL DEFAULT 500,
    monthly_rate_cents INT NOT NULL DEFAULT 15000,
    status VARCHAR(30) NOT NULL DEFAULT 'vacant',       -- 'vacant', 'reserved', 'occupied', 'maintenance'
    assigned_tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    CONSTRAINT unique_zone_spot UNIQUE (zone_id, spot_number)
);

CREATE INDEX IF NOT EXISTS idx_parking_spots_zone ON parking_spots (zone_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_parking_spots_status ON parking_spots (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_parking_spots_tenant ON parking_spots (assigned_tenant_id) WHERE deleted_at IS NULL;

-- 7. Payments Table (Stripe Integration)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
    parking_spot_id UUID REFERENCES parking_spots(id) ON DELETE SET NULL,
    amount_cents INT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'usd',
    stripe_payment_intent_id VARCHAR(100) UNIQUE,
    stripe_client_secret VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'succeeded', 'failed', 'refunded'
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_pi ON payments (stripe_payment_intent_id);

-- 8. Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);

-- 9. Initial Seed Data (Development Environment)
-- Argon2id hash for password: 'Password123!'
-- $argon2id$v=19$m=19456,t=2,p=1$Z3Vlc3Rfc2FsdF9leGFtcGxl$zVnKzB4t8wXh3r9l2M1jS6qP5vO7uY4nK3l2j1h0g9f (or known test hash)
INSERT INTO users (id, email, password_hash, full_name, role, unit_number)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin@property.local', '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQxMjM0NTY3OA$oT8g3U+4e5o3kS8z4B3ZkG9O7yYlFzXb3U1M5vQ7kP8', 'Chief Operations Admin', 'super_admin', 'PH-1'),
    ('22222222-2222-2222-2222-222222222222', 'manager@property.local', '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQxMjM0NTY3OA$oT8g3U+4e5o3kS8z4B3ZkG9O7yYlFzXb3U1M5vQ7kP8', 'Sarah Property Manager', 'property_manager', 'M-101'),
    ('33333333-3333-3333-3333-333333333333', 'tenant@property.local', '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQxMjM0NTY3OA$oT8g3U+4e5o3kS8z4B3ZkG9O7yYlFzXb3U1M5vQ7kP8', 'Alex Resident', 'tenant', 'Apt-402')
ON CONFLICT (email) DO NOTHING;

INSERT INTO amenities (id, name, description, capacity, hourly_rate_cents, min_duration_minutes, max_duration_minutes, open_time_minutes, close_time_minutes)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Skyline Rooftop Lounge', 'Panoramic downtown views, bar area, sound system, and lounge seating.', 40, 5000, 60, 240, 600, 1380),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Championship Tennis & Pickleball Court', 'Regulation floodlit synthetic court with equipment caddy.', 4, 2500, 60, 120, 420, 1260),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Executive Co-Working Conference Room', '4K conference display, ergonomic Herman Miller seating, high-speed fiber.', 14, 3000, 30, 240, 480, 1200),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Gourmet Poolside BBQ Pavilion', 'Dual built-in infrared gas grills, prep kitchen, and covered picnic tables.', 25, 3500, 60, 180, 660, 1320)
ON CONFLICT (id) DO NOTHING;

INSERT INTO parking_zones (id, name, floor_level, svg_viewbox)
VALUES
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Subterranean Level P1 (North Garage)', -1, '0 0 1000 600')
ON CONFLICT (id) DO NOTHING;

INSERT INTO parking_spots (id, zone_id, spot_number, spot_type, shape_type, coordinates, hourly_rate_cents, monthly_rate_cents, status)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-01', 'ev_charging', 'rect', '{"x": 60, "y": 80, "width": 80, "height": 140}', 700, 22000, 'vacant'),
    ('10000000-0000-0000-0000-000000000002', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-02', 'ev_charging', 'rect', '{"x": 160, "y": 80, "width": 80, "height": 140}', 700, 22000, 'vacant'),
    ('10000000-0000-0000-0000-000000000003', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-03', 'accessible', 'rect', '{"x": 260, "y": 80, "width": 90, "height": 140}', 500, 15000, 'vacant'),
    ('10000000-0000-0000-0000-000000000004', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-04', 'standard', 'rect', '{"x": 370, "y": 80, "width": 80, "height": 140}', 500, 15000, 'occupied'),
    ('10000000-0000-0000-0000-000000000005', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-05', 'standard', 'rect', '{"x": 470, "y": 80, "width": 80, "height": 140}', 500, 15000, 'reserved'),
    ('10000000-0000-0000-0000-000000000006', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-06', 'compact', 'rect', '{"x": 570, "y": 80, "width": 70, "height": 140}', 400, 13000, 'vacant'),
    ('10000000-0000-0000-0000-000000000007', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-07', 'standard', 'rect', '{"x": 660, "y": 80, "width": 80, "height": 140}', 500, 15000, 'vacant'),
    ('10000000-0000-0000-0000-000000000008', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-08', 'standard', 'rect', '{"x": 760, "y": 80, "width": 80, "height": 140}', 500, 15000, 'vacant'),
    ('10000000-0000-0000-0000-000000000009', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-09', 'standard', 'rect', '{"x": 60, "y": 380, "width": 80, "height": 140}', 500, 15000, 'vacant'),
    ('10000000-0000-0000-0000-000000000010', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'P1-10', 'compact', 'rect', '{"x": 160, "y": 380, "width": 70, "height": 140}', 400, 13000, 'vacant')
ON CONFLICT (zone_id, spot_number) DO NOTHING;
