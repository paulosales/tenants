-- =========================================================================
-- Migration 0004: Properties Staff & Maintenance Call Assignment
-- =========================================================================

-- 1. Create Property Staff Table (managers, maintainers, security, cleaners, etc.)
CREATE TABLE IF NOT EXISTS property_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL, -- 'manager', 'maintainer', 'security', 'cleaner', 'other'
    title VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    specialization VARCHAR(150),
    shift VARCHAR(100) NOT NULL DEFAULT 'Day (08:00 - 17:00)',
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'on_leave', 'inactive'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_property_staff_property ON property_staff (property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_staff_role ON property_staff (role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_staff_status ON property_staff (status) WHERE deleted_at IS NULL;

-- 2. Link Maintenance Calls to Assigned Property Staff
ALTER TABLE maintenance_calls 
    ADD COLUMN IF NOT EXISTS assigned_staff_id UUID REFERENCES property_staff(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maintenance_calls_assigned_staff 
    ON maintenance_calls (assigned_staff_id) WHERE deleted_at IS NULL;

-- 3. Seed Initial Staff Members Across Managed Properties
INSERT INTO property_staff (
    id, property_id, first_name, last_name, role, title, email, phone, specialization, shift, status, created_at, updated_at
) VALUES 
-- Grandview Heights Luxury Residences (11111111-2222-3333-4444-555555555551)
(
    '88888888-1111-1111-1111-111111111000',
    '11111111-2222-3333-4444-555555555551',
    'Sarah',
    'Jenkins',
    'manager',
    'Senior Property Director',
    's.jenkins@grandview.example.com',
    '+1 (206) 555-0111',
    'Portfolio Operations & Lease Compliance',
    'Day (08:30 - 17:30)',
    'active',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
),
(
    '88888888-1111-1111-1111-111111111001',
    '11111111-2222-3333-4444-555555555551',
    'Carlos',
    'Mendez',
    'maintainer',
    'Lead Plumber & Mechanical Systems Tech',
    'carlos.m@grandview.example.com',
    '+1 (555) 019-3321',
    'Plumbing, Boiler & Hydraulic Lines',
    'Morning (07:00 - 15:30)',
    'active',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '25 days'
),
(
    '88888888-1111-1111-1111-111111111002',
    '11111111-2222-3333-4444-555555555551',
    'Elena',
    'Santos',
    'maintainer',
    'HVAC & Smart Climate Specialist',
    'elena.s@grandview.example.com',
    '+1 (555) 019-7788',
    'HVAC, Heat Pumps & Digital Thermostats',
    'Day (08:00 - 16:30)',
    'active',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '20 days'
),
(
    '88888888-1111-1111-1111-111111111003',
    '11111111-2222-3333-4444-555555555551',
    'Dave',
    'Kowalski',
    'maintainer',
    'General Facilities & Appliances Contractor',
    'dave.k@grandview.example.com',
    '+1 (555) 019-4412',
    'Appliances, Carpentry & Electrical Fixtures',
    'On-Call / Flexible',
    'active',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days'
),
(
    '88888888-1111-1111-1111-111111111004',
    '11111111-2222-3333-4444-555555555551',
    'Marcus',
    'Vance',
    'security',
    'Chief of Physical Security & Access',
    'm.vance@grandview.example.com',
    '+1 (206) 555-0144',
    'CCTV Monitoring & Biometric Gate Control',
    'Night (20:00 - 04:00)',
    'active',
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '18 days'
),
(
    '88888888-1111-1111-1111-111111111005',
    '11111111-2222-3333-4444-555555555551',
    'Maria',
    'Gonzalez',
    'cleaner',
    'Head of Housekeeping & Sanitation',
    'maria.g@grandview.example.com',
    '+1 (206) 555-0177',
    'Amenity Pavilions, Lobby & Deep Sanitation',
    'Morning (06:00 - 14:00)',
    'active',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '12 days'
),

-- Pacific Marina Waterfront Towers (11111111-2222-3333-4444-555555555552)
(
    '88888888-1111-1111-1111-111111111006',
    '11111111-2222-3333-4444-555555555552',
    'David',
    'Ross',
    'manager',
    'Resident Operations & Leasing Manager',
    'd.ross@pacificmarina.example.com',
    '+1 (562) 555-0182',
    'Tenant Relations & Building Compliance',
    'Day (09:00 - 18:00)',
    'active',
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '28 days'
),
(
    '88888888-1111-1111-1111-111111111007',
    '11111111-2222-3333-4444-555555555552',
    'Kevin',
    'Lee',
    'maintainer',
    'Senior Facilities Engineer',
    'kevin.l@pacificmarina.example.com',
    '+1 (562) 555-0199',
    'High-Rise Elevators, Pumps & Generators',
    'Day (08:00 - 16:30)',
    'active',
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '22 days'
),
(
    '88888888-1111-1111-1111-111111111008',
    '11111111-2222-3333-4444-555555555552',
    'Priya',
    'Patel',
    'security',
    'Marina Gate & Perimeter Security Officer',
    'priya.p@pacificmarina.example.com',
    '+1 (562) 555-0133',
    'Waterfront Perimeter Patrol & Night Watch',
    'Night (22:00 - 06:00)',
    'active',
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '14 days'
),
(
    '88888888-1111-1111-1111-111111111009',
    '11111111-2222-3333-4444-555555555552',
    'James',
    'Wilson',
    'cleaner',
    'Sanitation & Grounds Crew Leader',
    'j.wilson@pacificmarina.example.com',
    '+1 (562) 555-0155',
    'Rooftop Deck, Poolside & Fitness Center Deep Cleaning',
    'Early Morning (05:00 - 13:00)',
    'active',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '10 days'
)
ON CONFLICT (id) DO NOTHING;

-- 4. Associate Existing Seeded Maintenance Calls with Maintainers
UPDATE maintenance_calls 
SET assigned_staff_id = '88888888-1111-1111-1111-111111111001' 
WHERE id = '66666666-1111-1111-1111-111111111001' AND assigned_staff_id IS NULL;

UPDATE maintenance_calls 
SET assigned_staff_id = '88888888-1111-1111-1111-111111111003' 
WHERE id = '66666666-1111-1111-1111-111111111002' AND assigned_staff_id IS NULL;

UPDATE maintenance_calls 
SET assigned_staff_id = '88888888-1111-1111-1111-111111111002' 
WHERE id = '66666666-1111-1111-1111-111111111003' AND assigned_staff_id IS NULL;

