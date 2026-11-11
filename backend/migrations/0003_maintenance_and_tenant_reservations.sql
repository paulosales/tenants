-- =========================================================================
-- Migration 0003: Maintenance Records & Tenant Reservations Link
-- =========================================================================

-- 1. Create Maintenance Calls Table
CREATE TABLE IF NOT EXISTS maintenance_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(30) NOT NULL DEFAULT 'routine', -- 'routine', 'urgent', 'emergency'
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    permission_to_enter BOOLEAN NOT NULL DEFAULT TRUE,
    preferred_time_window VARCHAR(100) NOT NULL DEFAULT 'Morning (08:00 - 12:00)',
    contact_phone VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'reported', -- 'reported', 'dispatched', 'in_progress', 'resolved', 'cancelled'
    assigned_technician VARCHAR(150),
    technician_phone VARCHAR(50),
    scheduled_date TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_maintenance_calls_tenant ON maintenance_calls (tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_property ON maintenance_calls (property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_status ON maintenance_calls (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_calls_priority ON maintenance_calls (priority) WHERE deleted_at IS NULL;

-- 2. Extend Reservations Table with Tenant Link & Attendees
ALTER TABLE reservations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS attendees_count INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_reservations_tenant ON reservations (tenant_id) WHERE deleted_at IS NULL;

-- 3. Seed Maintenance Calls for Seeded Tenants
INSERT INTO maintenance_calls (
    id, ticket_number, tenant_id, property_id, unit_number, category, priority, 
    title, description, permission_to_enter, preferred_time_window, contact_phone, 
    status, assigned_technician, technician_phone, scheduled_date, resolution_notes, created_at, updated_at
) VALUES 
(
    '66666666-1111-1111-1111-111111111001',
    'MNT-2026-0418',
    '33333333-1111-1111-1111-111111111001',
    '11111111-2222-3333-4444-555555555551',
    '101',
    'plumbing',
    'routine',
    'Slow draining bathroom sink and minor faucet drip',
    'The master bathroom sink drains very slowly after running water for more than 30 seconds. Aerator might need cleaning.',
    TRUE,
    'Morning (08:00 - 12:00)',
    '+1 (206) 555-0192',
    'in_progress',
    'Carlos M. (Lead Plumber)',
    '+1 (555) 019-3321',
    NOW() + INTERVAL '1 day',
    NULL,
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
),
(
    '66666666-1111-1111-1111-111111111002',
    'MNT-2026-0502',
    '33333333-1111-1111-1111-111111111001',
    '11111111-2222-3333-4444-555555555551',
    '101',
    'hvac',
    'urgent',
    'Thermostat unresponsive / low cooling in bedroom',
    'Digital thermostat display does not respond to temperature change buttons. Room temperature remains at 76F.',
    TRUE,
    'Afternoon (12:00 - 16:00)',
    '+1 (206) 555-0192',
    'dispatched',
    'Dave K. (Climate Specialist)',
    '+1 (555) 019-4412',
    NOW() + INTERVAL '2 days',
    NULL,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '6 hours'
),
(
    '66666666-1111-1111-1111-111111111003',
    'MNT-2026-0389',
    '33333333-1111-1111-1111-111111111001',
    '11111111-2222-3333-4444-555555555551',
    '101',
    'appliances',
    'routine',
    'Dishwasher door latch replacement',
    'The front door latch does not click securely without pressing hard against the frame.',
    TRUE,
    'Morning (08:00 - 12:00)',
    '+1 (206) 555-0192',
    'resolved',
    'Elena S. (Appliance Tech)',
    '+1 (555) 019-7788',
    NOW() - INTERVAL '3 days',
    'Replaced spring latch assembly with OEM part. Tested wash cycle successfully.',
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '3 days'
),
(
    '66666666-1111-1111-1111-111111111004',
    'MNT-2026-0511',
    '33333333-1111-1111-1111-111111111002',
    '11111111-2222-3333-4444-555555555551',
    '102',
    'electrical',
    'routine',
    'Flickering recessed LED downlight in corridor',
    'The center recessed ceiling light in the main entryway hallway flickers intermittently.',
    TRUE,
    'Morning (08:00 - 12:00)',
    '+1 (206) 555-0144',
    'reported',
    NULL,
    NULL,
    NULL,
    NULL,
    NOW() - INTERVAL '4 hours',
    NOW() - INTERVAL '4 hours'
)
ON CONFLICT (ticket_number) DO NOTHING;

-- 4. Seed Tenant Reservations
INSERT INTO reservations (
    id, amenity_id, tenant_id, reservation_period, total_price_cents, attendees_count, status, notes, created_at, updated_at
) VALUES 
(
    '77777777-1111-1111-1111-111111111001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-1111-1111-1111-111111111001',
    tsrange(
        (date_trunc('day', NOW() + INTERVAL '1 day') + INTERVAL '18 hours')::timestamp,
        (date_trunc('day', NOW() + INTERVAL '1 day') + INTERVAL '20 hours')::timestamp,
        '[)'
    ),
    10000,
    4,
    'confirmed',
    'Sunset dinner gathering with colleagues',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
),
(
    '77777777-1111-1111-1111-111111111002',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-1111-1111-1111-111111111001',
    tsrange(
        (date_trunc('day', NOW() + INTERVAL '3 days') + INTERVAL '10 hours')::timestamp,
        (date_trunc('day', NOW() + INTERVAL '3 days') + INTERVAL '12 hours')::timestamp,
        '[)'
    ),
    5000,
    2,
    'confirmed',
    'Singles friendly practice match',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
),
(
    '77777777-1111-1111-1111-111111111003',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '33333333-1111-1111-1111-111111111002',
    tsrange(
        (date_trunc('day', NOW() + INTERVAL '2 days') + INTERVAL '13 hours')::timestamp,
        (date_trunc('day', NOW() + INTERVAL '2 days') + INTERVAL '15 hours')::timestamp,
        '[)'
    ),
    7000,
    8,
    'confirmed',
    'Family weekend barbecue pavilion gathering',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
)
ON CONFLICT (id) DO NOTHING;

