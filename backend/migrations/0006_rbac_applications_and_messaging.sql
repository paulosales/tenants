-- =========================================================================
-- Migration 0006: RBAC Scoped Identities, Public Tenancy Applications & Staff Messaging
-- =========================================================================

-- 1. Link user identities to their property, tenant, or staff profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES property_staff(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_users_role ON users (role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_property ON users (property_id) WHERE deleted_at IS NULL;

-- 2. Tenancy Applications submitted by unauthenticated visitors via the Public Portal
CREATE TABLE IF NOT EXISTS tenancy_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    preferred_unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    applicant_first_name VARCHAR(100) NOT NULL,
    applicant_last_name VARCHAR(100) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    applicant_phone VARCHAR(50) NOT NULL,
    monthly_income_cents BIGINT NOT NULL DEFAULT 0,
    employment_status VARCHAR(80) NOT NULL DEFAULT 'full_time',
    desired_move_in_date DATE,
    occupants_count INT NOT NULL DEFAULT 1,
    notes TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'under_review', 'approved', 'rejected'
    reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tenancy_applications_property
    ON tenancy_applications (property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenancy_applications_status
    ON tenancy_applications (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tenancy_applications_created_at
    ON tenancy_applications (created_at DESC) WHERE deleted_at IS NULL;

-- 3. Property Manager <-> Staff / Maintainer Messaging
CREATE TABLE IF NOT EXISTS staff_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_staff_id UUID REFERENCES property_staff(id) ON DELETE SET NULL,
    recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_staff_id UUID REFERENCES property_staff(id) ON DELETE SET NULL,
    sender_name VARCHAR(150) NOT NULL,
    sender_role VARCHAR(50) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_messages_property_created
    ON staff_messages (property_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_staff_messages_recipient_staff
    ON staff_messages (recipient_staff_id, is_read);

-- 4. Allow rejected amenity reservations to release the time slot cleanly
ALTER TABLE reservations DROP CONSTRAINT IF EXISTS no_overlapping_reservations;
ALTER TABLE reservations ADD CONSTRAINT no_overlapping_reservations
    EXCLUDE USING gist (amenity_id WITH =, reservation_period WITH &&)
    WHERE (deleted_at IS NULL AND status NOT IN ('cancelled', 'rejected'));

-- 5. Seed / Refresh Working Demo Accounts Across All RBAC Roles (Password123!)
INSERT INTO users (
    id, email, password_hash, full_name, role, phone, unit_number, property_id, tenant_id, staff_id, is_active
) VALUES
(
    '11111111-1111-1111-1111-111111111111',
    'admin@property.local',
    '$argon2id$v=19$m=19456,t=2,p=1$Y9tk2yYGbPe7nli24xmzfA$z2srHuwDKMjfa/BuVk8jaPWFbIahDNQQgq8MEzYlscY',
    'Chief Operations Admin',
    'super_admin',
    '+1 (206) 555-0100',
    'PH-1',
    NULL,
    NULL,
    NULL,
    TRUE
),
(
    '22222222-2222-2222-2222-222222222222',
    'manager@property.local',
    '$argon2id$v=19$m=19456,t=2,p=1$Y9tk2yYGbPe7nli24xmzfA$z2srHuwDKMjfa/BuVk8jaPWFbIahDNQQgq8MEzYlscY',
    'Sarah Jenkins',
    'property_manager',
    '+1 (206) 555-0111',
    'M-101',
    '11111111-2222-3333-4444-555555555551',
    NULL,
    '88888888-1111-1111-1111-111111111000',
    TRUE
),
(
    '44444444-4444-4444-4444-444444444444',
    'maintainer@property.local',
    '$argon2id$v=19$m=19456,t=2,p=1$Y9tk2yYGbPe7nli24xmzfA$z2srHuwDKMjfa/BuVk8jaPWFbIahDNQQgq8MEzYlscY',
    'Carlos Mendez',
    'maintenance_staff',
    '+1 (555) 019-3321',
    NULL,
    '11111111-2222-3333-4444-555555555551',
    NULL,
    '88888888-1111-1111-1111-111111111001',
    TRUE
),
(
    '55555555-5555-5555-5555-555555555555',
    'staff@property.local',
    '$argon2id$v=19$m=19456,t=2,p=1$Y9tk2yYGbPe7nli24xmzfA$z2srHuwDKMjfa/BuVk8jaPWFbIahDNQQgq8MEzYlscY',
    'Maria Gonzalez',
    'staff',
    '+1 (206) 555-0177',
    NULL,
    '11111111-2222-3333-4444-555555555551',
    NULL,
    '88888888-1111-1111-1111-111111111005',
    TRUE
),
(
    '33333333-3333-3333-3333-333333333333',
    'tenant@property.local',
    '$argon2id$v=19$m=19456,t=2,p=1$Y9tk2yYGbPe7nli24xmzfA$z2srHuwDKMjfa/BuVk8jaPWFbIahDNQQgq8MEzYlscY',
    'Marcus Vance',
    'tenant',
    '+1 (206) 555-0192',
    '101',
    '11111111-2222-3333-4444-555555555551',
    '33333333-1111-1111-1111-111111111001',
    NULL,
    TRUE
)
ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone,
    unit_number = EXCLUDED.unit_number,
    property_id = EXCLUDED.property_id,
    tenant_id = EXCLUDED.tenant_id,
    staff_id = EXCLUDED.staff_id,
    is_active = TRUE;

-- 6. Seed Sample Tenancy Applications routed to Property Managers
INSERT INTO tenancy_applications (
    id, property_id, preferred_unit_id, applicant_first_name, applicant_last_name,
    applicant_email, applicant_phone, monthly_income_cents, employment_status,
    desired_move_in_date, occupants_count, notes, status, created_at, updated_at
) VALUES
(
    '99999999-1111-1111-1111-111111111001',
    '11111111-2222-3333-4444-555555555551',
    '22222222-1111-1111-1111-111111111103',
    'Clara',
    'Oswald',
    'clara.oswald@example.com',
    '+1 (206) 555-0188',
    950000,
    'full_time',
    CURRENT_DATE + INTERVAL '21 days',
    2,
    'Relocating to downtown Seattle. Looking for an EV parking stall and 12-month lease.',
    'pending',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
),
(
    '99999999-1111-1111-1111-111111111002',
    '11111111-2222-3333-4444-555555555552',
    '22222222-1111-1111-1111-111111111202',
    'Mateo',
    'Silva',
    'mateo.silva@example.com',
    '+1 (562) 555-0141',
    1120000,
    'self_employed',
    CURRENT_DATE + INTERVAL '30 days',
    1,
    'Software architect with strong credit history and prior landlord references ready.',
    'under_review',
    NOW() - INTERVAL '12 hours',
    NOW() - INTERVAL '12 hours'
)
ON CONFLICT (id) DO NOTHING;

-- 7. Seed One Pending Amenity Session for Manager Approval Queue
INSERT INTO reservations (
    id, amenity_id, tenant_id, reservation_period, total_price_cents, attendees_count, status, notes, created_at, updated_at
) VALUES
(
    '77777777-1111-1111-1111-111111111001',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-1111-1111-1111-111111111001',
    tsrange(
        (date_trunc('day', NOW() + INTERVAL '5 days') + INTERVAL '18 hours')::timestamp,
        (date_trunc('day', NOW() + INTERVAL '5 days') + INTERVAL '20 hours')::timestamp,
        '[)'
    ),
    10000,
    12,
    'pending',
    'Resident welcome mixer for Tower A 1st-floor neighbors.',
    NOW() - INTERVAL '3 hours',
    NOW() - INTERVAL '3 hours'
)
ON CONFLICT (id) DO NOTHING;

-- 8. Seed Initial Manager <-> Staff Conversations
INSERT INTO staff_messages (
    id, property_id, sender_user_id, sender_staff_id, recipient_user_id, recipient_staff_id,
    sender_name, sender_role, body, is_read, created_at
) VALUES
(
    'abababab-1111-1111-1111-111111111001',
    '11111111-2222-3333-4444-555555555551',
    '22222222-2222-2222-2222-222222222222',
    '88888888-1111-1111-1111-111111111000',
    '44444444-4444-4444-4444-444444444444',
    '88888888-1111-1111-1111-111111111001',
    'Sarah Jenkins',
    'property_manager',
    'Good morning Carlos — please prioritize Unit 101 sink trap inspection before noon.',
    TRUE,
    NOW() - INTERVAL '4 hours'
),
(
    'abababab-1111-1111-1111-111111111002',
    '11111111-2222-3333-4444-555555555551',
    '44444444-4444-4444-4444-444444444444',
    '88888888-1111-1111-1111-111111111001',
    '22222222-2222-2222-2222-222222222222',
    '88888888-1111-1111-1111-111111111000',
    'Carlos Mendez',
    'maintenance_staff',
    'On it! Checking P-trap and aerator valve now and will update ticket MNT-2026-0418 shortly.',
    FALSE,
    NOW() - INTERVAL '2 hours'
),
(
    'abababab-1111-1111-1111-111111111003',
    '11111111-2222-3333-4444-555555555551',
    '55555555-5555-5555-5555-555555555555',
    '88888888-1111-1111-1111-111111111005',
    '22222222-2222-2222-2222-222222222222',
    '88888888-1111-1111-1111-111111111000',
    'Maria Gonzalez',
    'staff',
    'Lobby and Skyline Lounge deep clean finished ahead of schedule. Supply restock needed for Level B2.',
    FALSE,
    NOW() - INTERVAL '45 minutes'
)
ON CONFLICT (id) DO NOTHING;

