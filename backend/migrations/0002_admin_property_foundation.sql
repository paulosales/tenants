-- =========================================================================
-- Migration 0002: Admin Property Management Foundation
-- =========================================================================

-- 1. Properties Table
CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state_province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_properties_name ON properties (name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties (city) WHERE deleted_at IS NULL;

-- 2. Units Table (Child of Property)
CREATE TABLE IF NOT EXISTS units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    floor INT NOT NULL DEFAULT 1,
    bedrooms INT NOT NULL DEFAULT 1,
    bathrooms NUMERIC(3, 1) NOT NULL DEFAULT 1.0,
    square_feet INT NOT NULL DEFAULT 500,
    status VARCHAR(30) NOT NULL DEFAULT 'vacant', -- 'vacant', 'occupied', 'maintenance'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_property_unit UNIQUE (property_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_units_property ON units (property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_units_status ON units (status) WHERE deleted_at IS NULL;

-- 3. Tenants Table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(50) NOT NULL,
    emergency_contact_name VARCHAR(150),
    emergency_contact_phone VARCHAR(50),
    assigned_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    lease_start_date DATE,
    lease_end_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'past', 'applicant'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_unit ON tenants (assigned_unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants (status) WHERE deleted_at IS NULL;

-- 4. Extend / Harmonize Amenities Table
ALTER TABLE amenities ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE CASCADE;
ALTER TABLE amenities ADD COLUMN IF NOT EXISTS fee_cents INT NOT NULL DEFAULT 0;
ALTER TABLE amenities ADD COLUMN IF NOT EXISTS deposit_cents INT NOT NULL DEFAULT 0;
ALTER TABLE amenities ADD COLUMN IF NOT EXISTS rules TEXT;

CREATE INDEX IF NOT EXISTS idx_amenities_property ON amenities (property_id) WHERE deleted_at IS NULL;

-- 5. Parking Layouts Table (Child of Property, 1-to-1)
CREATE TABLE IF NOT EXISTS parking_layouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
    canvas_width INT NOT NULL DEFAULT 1200,
    canvas_height INT NOT NULL DEFAULT 800,
    grid_size INT NOT NULL DEFAULT 20,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_layouts_property ON parking_layouts (property_id);

-- 6. Recreate Parking Spots Table for Visual Builder
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS parking_spots CASCADE;
DROP TABLE IF EXISTS parking_zones CASCADE;

CREATE TABLE IF NOT EXISTS parking_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    layout_id UUID NOT NULL REFERENCES parking_layouts(id) ON DELETE CASCADE,
    spot_label VARCHAR(50) NOT NULL,
    x DOUBLE PRECISION NOT NULL DEFAULT 0,
    y DOUBLE PRECISION NOT NULL DEFAULT 0,
    width DOUBLE PRECISION NOT NULL DEFAULT 60,
    height DOUBLE PRECISION NOT NULL DEFAULT 120,
    rotation DOUBLE PRECISION NOT NULL DEFAULT 0,
    spot_type VARCHAR(30) NOT NULL DEFAULT 'standard', -- 'standard', 'compact', 'ev_charging', 'handicap'
    is_occupied BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_layout_spot_label UNIQUE (layout_id, spot_label)
);

CREATE INDEX IF NOT EXISTS idx_parking_spots_layout ON parking_spots (layout_id);
CREATE INDEX IF NOT EXISTS idx_parking_spots_tenant ON parking_spots (assigned_tenant_id);

-- 7. Seed Initial Data for Development
INSERT INTO properties (id, name, address_line1, address_line2, city, state_province, postal_code)
VALUES 
    ('11111111-2222-3333-4444-555555555551', 'Grandview Heights Luxury Residences', '1200 Grandview Avenue', 'Tower A', 'Seattle', 'WA', '98101'),
    ('11111111-2222-3333-4444-555555555552', 'Pacific Marina Waterfront Towers', '450 Ocean Boulevard', 'Suite 100', 'Long Beach', 'CA', '90802')
ON CONFLICT (id) DO NOTHING;

-- Seed Units
INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, status)
VALUES
    ('22222222-1111-1111-1111-111111111101', '11111111-2222-3333-4444-555555555551', '101', 1, 1, 1.0, 680, 'occupied'),
    ('22222222-1111-1111-1111-111111111102', '11111111-2222-3333-4444-555555555551', '102', 1, 2, 2.0, 950, 'occupied'),
    ('22222222-1111-1111-1111-111111111103', '11111111-2222-3333-4444-555555555551', '201', 2, 2, 2.0, 1020, 'vacant'),
    ('22222222-1111-1111-1111-111111111104', '11111111-2222-3333-4444-555555555551', 'PH-1', 12, 3, 3.5, 2200, 'maintenance'),
    ('22222222-1111-1111-1111-111111111201', '11111111-2222-3333-4444-555555555552', 'A-101', 1, 1, 1.0, 720, 'occupied'),
    ('22222222-1111-1111-1111-111111111202', '11111111-2222-3333-4444-555555555552', 'A-102', 1, 2, 2.0, 1100, 'vacant')
ON CONFLICT (id) DO NOTHING;

-- Seed Tenants
INSERT INTO tenants (id, first_name, last_name, email, phone, emergency_contact_name, emergency_contact_phone, assigned_unit_id, lease_start_date, lease_end_date, status)
VALUES
    ('33333333-1111-1111-1111-111111111001', 'Marcus', 'Vance', 'marcus.vance@example.com', '+1 (206) 555-0192', 'Sandra Vance', '+1 (206) 555-0199', '22222222-1111-1111-1111-111111111101', '2026-01-01', '2027-01-01', 'active'),
    ('33333333-1111-1111-1111-111111111002', 'Elena', 'Rostova', 'elena.rostova@example.com', '+1 (206) 555-0144', 'Dmitri Rostov', '+1 (206) 555-0188', '22222222-1111-1111-1111-111111111102', '2026-02-15', '2027-02-15', 'active'),
    ('33333333-1111-1111-1111-111111111003', 'David', 'Chen', 'david.chen@example.com', '+1 (562) 555-0123', 'Mei Chen', '+1 (562) 555-0124', '22222222-1111-1111-1111-111111111201', '2025-11-01', '2026-11-01', 'active')
ON CONFLICT (id) DO NOTHING;

-- Update existing amenities with property association
UPDATE amenities 
SET property_id = '11111111-2222-3333-4444-555555555551',
    fee_cents = 3500,
    deposit_cents = 15000,
    rules = 'Reservation required 24h in advance. Clean grills and dispose of trash upon completion. Quiet hours after 10 PM.'
WHERE property_id IS NULL;

-- Seed Parking Layout for Grandview Heights
INSERT INTO parking_layouts (id, property_id, canvas_width, canvas_height, grid_size)
VALUES 
    ('44444444-1111-1111-1111-111111111001', '11111111-2222-3333-4444-555555555551', 1200, 800, 20),
    ('44444444-1111-1111-1111-111111111002', '11111111-2222-3333-4444-555555555552', 1200, 800, 20)
ON CONFLICT (id) DO NOTHING;

-- Seed Parking Spots for Grandview Heights
INSERT INTO parking_spots (id, layout_id, spot_label, x, y, width, height, rotation, spot_type, is_occupied, assigned_tenant_id)
VALUES
    ('55555555-1111-1111-1111-111111111001', '44444444-1111-1111-1111-111111111001', 'P-01', 80, 80, 60, 120, 0, 'ev_charging', TRUE, '33333333-1111-1111-1111-111111111001'),
    ('55555555-1111-1111-1111-111111111002', '44444444-1111-1111-1111-111111111001', 'P-02', 160, 80, 60, 120, 0, 'standard', TRUE, '33333333-1111-1111-1111-111111111002'),
    ('55555555-1111-1111-1111-111111111003', '44444444-1111-1111-1111-111111111001', 'P-03', 240, 80, 60, 120, 0, 'standard', FALSE, NULL),
    ('55555555-1111-1111-1111-111111111004', '44444444-1111-1111-1111-111111111001', 'P-04', 320, 80, 60, 120, 0, 'compact', FALSE, NULL),
    ('55555555-1111-1111-1111-111111111005', '44444444-1111-1111-1111-111111111001', 'P-05', 400, 80, 80, 120, 0, 'handicap', FALSE, NULL),
    ('55555555-1111-1111-1111-111111111006', '44444444-1111-1111-1111-111111111001', 'P-06', 80, 360, 60, 120, 0, 'standard', FALSE, NULL),
    ('55555555-1111-1111-1111-111111111007', '44444444-1111-1111-1111-111111111001', 'P-07', 160, 360, 60, 120, 0, 'standard', FALSE, NULL),
    ('55555555-1111-1111-1111-111111111008', '44444444-1111-1111-1111-111111111001', 'P-08', 240, 360, 60, 120, 0, 'compact', FALSE, NULL)
ON CONFLICT (id) DO NOTHING;
