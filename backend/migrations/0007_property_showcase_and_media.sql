-- =========================================================================
-- Migration 0007: Property Showcase (Rich Description, Features, CDN Photos,
-- Geo Coordinates) & Suite Monthly Pricing
-- =========================================================================

-- 1. Extend properties with rich-text description, map coordinates, and leasing highlights
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rich_description TEXT NOT NULL DEFAULT '';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS pet_policy VARCHAR(120) DEFAULT 'Cats & Dogs Welcome';
ALTER TABLE properties ADD COLUMN IF NOT EXISTS lease_terms VARCHAR(120) DEFAULT '12-Month Leases';

-- 2. Extend units with monthly rent (cents) for map price-range pins & suite filters
ALTER TABLE units ADD COLUMN IF NOT EXISTS monthly_rent_cents INT NOT NULL DEFAULT 185000;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_units_monthly_rent_non_negative'
    ) THEN
        ALTER TABLE units ADD CONSTRAINT chk_units_monthly_rent_non_negative CHECK (monthly_rent_cents >= 0);
    END IF;
END $$;

-- 3. Property Features Table (admin-managed community & suite highlights)
CREATE TABLE IF NOT EXISTS property_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    label VARCHAR(120) NOT NULL,
    category VARCHAR(60) NOT NULL DEFAULT 'community',
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_features_property
    ON property_features (property_id, display_order ASC, created_at ASC);

-- 4. Property Photos Table (CDN-backed object keys & URLs via MinIO/S3)
CREATE TABLE IF NOT EXISTS property_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    storage_key VARCHAR(512) NOT NULL,
    cdn_url TEXT NOT NULL,
    caption VARCHAR(255),
    is_cover BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_property_photos_property
    ON property_photos (property_id, is_cover DESC, display_order ASC, created_at ASC);

-- 5. Seed geo-coordinates & rich descriptions on existing properties
UPDATE properties
SET
    latitude = COALESCE(latitude, 47.6101),
    longitude = COALESCE(longitude, -122.3421),
    pet_policy = COALESCE(pet_policy, 'Pet Friendly · Dog Wash Station On-Site'),
    lease_terms = COALESCE(lease_terms, '12-Month & Flexible Corporate Leases'),
    rich_description = CASE
        WHEN rich_description = '' THEN
            '<p><strong>Grandview Heights Luxury Residences</strong> pairs panoramic Puget Sound views with walkable downtown convenience. Every open-concept residence features floor-to-ceiling low-E windows, quartz waterfall counters, and a full-size in-suite washer &amp; dryer.</p><h3>Why Residents Love Calling Grandview Home</h3><ul><li><strong>Full 5-Appliance Gourmet Kitchens</strong> with stainless steel ENERGY STAR suites</li><li><strong>Dedicated Subterranean EV Parking</strong> with Level-2 fast chargers</li><li><strong>Skyline Rooftop Lounge</strong>, fitness studio, and 24/7 on-site maintenance care</li></ul>'
        ELSE rich_description
    END
WHERE id = '11111111-2222-3333-4444-555555555551';

UPDATE properties
SET
    latitude = COALESCE(latitude, 33.7670),
    longitude = COALESCE(longitude, -118.1892),
    pet_policy = COALESCE(pet_policy, 'Small Pets & Waterfront Walkways'),
    lease_terms = COALESCE(lease_terms, '12-Month Coastal Residences'),
    rich_description = CASE
        WHEN rich_description = '' THEN
            '<p><strong>Pacific Marina Waterfront Towers</strong> delivers bright coastal living steps from Alamitos Bay, boardwalk cafes, and ocean bike paths.</p><h3>Modern Coastal Comforts</h3><ul><li>Private glass-railing balconies overlooking the marina</li><li>Keyless smart-lock entry, parcel lockers &amp; on-site concierge</li><li>Resort courtyard with EV-ready covered parking</li></ul>'
        ELSE rich_description
    END
WHERE id = '11111111-2222-3333-4444-555555555552';

-- 6. Assign distinct suite pricing on existing seeded units for rich map price-range pins
UPDATE units SET monthly_rent_cents = 179500 WHERE id = '22222222-1111-1111-1111-111111111101';
UPDATE units SET monthly_rent_cents = 229500 WHERE id = '22222222-1111-1111-1111-111111111102';
UPDATE units SET monthly_rent_cents = 245000 WHERE id = '22222222-1111-1111-1111-111111111103';
UPDATE units SET monthly_rent_cents = 415000 WHERE id = '22222222-1111-1111-1111-111111111104';
UPDATE units SET monthly_rent_cents = 192000 WHERE id = '22222222-1111-1111-1111-111111111201';
UPDATE units SET monthly_rent_cents = 259000 WHERE id = '22222222-1111-1111-1111-111111111202';

-- 7. Seed two additional rental-friendly showcase properties (Winnipeg & Seattle) + vacant suites
INSERT INTO properties (
    id, name, address_line1, address_line2, city, state_province, postal_code,
    latitude, longitude, pet_policy, lease_terms, rich_description
)
VALUES
(
    '11111111-2222-3333-4444-555555555553',
    'Aurora Heights Commons',
    '115 North Point Boulevard',
    'West Kildonan',
    'Winnipeg',
    'MB',
    'R2V 5B5',
    49.9612,
    -97.1394,
    'Pet Friendly · Cats & Dogs Welcome',
    '12-Month Leases · Water & Heat Included',
    '<p>Welcome to <strong>Aurora Heights Commons</strong> in North Winnipeg—spacious, quiet pet-friendly suites surrounded by Kildonan Park trails and quick shopping at Garden City.</p><h3>Designed for Everyday Ease</h3><ul><li><strong>In-Suite Laundry</strong> &amp; 5 full-size appliances in every floorplan</li><li>Central air conditioning, private balconies &amp; walk-in closets</li><li>Powered outdoor &amp; heated indoor parking, fitness studio &amp; 24/7 maintenance</li></ul>'
),
(
    '11111111-2222-3333-4444-555555555554',
    'Harborview Terrace Suites',
    '880 Elliott Avenue West',
    'Lower Queen Anne',
    'Seattle',
    'WA',
    '98119',
    47.6264,
    -122.3688,
    'Pet Friendly · Rooftop Pet Run',
    '12-Month Leases · Move-In Ready',
    '<p><strong>Harborview Terrace Suites</strong> blends Elliott Bay waterfront views with boutique 1-, 2-, and 3-bedroom apartments minutes from Climate Pledge Arena and Olympic Sculpture Park.</p><h3>Standout Residence Features</h3><ul><li>Open-concept chef kitchens with quartz islands</li><li>Bike workshop, EV charging bays &amp; high-speed fiber-ready suites</li><li>On-site community co-working lounge and landscaped terrace</li></ul>'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO units (id, property_id, unit_number, floor, bedrooms, bathrooms, square_feet, monthly_rent_cents, status)
VALUES
    ('22222222-1111-1111-1111-111111111301', '11111111-2222-3333-4444-555555555553', '104', 1, 1, 1.0, 668, 152500, 'vacant'),
    ('22222222-1111-1111-1111-111111111302', '11111111-2222-3333-4444-555555555553', '208', 2, 2, 1.0, 909, 178500, 'vacant'),
    ('22222222-1111-1111-1111-111111111303', '11111111-2222-3333-4444-555555555553', '312', 3, 2, 2.0, 1047, 194500, 'vacant'),
    ('22222222-1111-1111-1111-111111111304', '11111111-2222-3333-4444-555555555553', '405', 4, 3, 2.0, 1240, 229500, 'vacant'),
    ('22222222-1111-1111-1111-111111111401', '11111111-2222-3333-4444-555555555554', '108', 1, 0, 1.0, 520, 159500, 'vacant'),
    ('22222222-1111-1111-1111-111111111402', '11111111-2222-3333-4444-555555555554', '215', 2, 2, 2.0, 995, 238500, 'vacant'),
    ('22222222-1111-1111-1111-111111111403', '11111111-2222-3333-4444-555555555554', '318', 3, 3, 2.5, 1340, 295000, 'vacant')
ON CONFLICT (id) DO NOTHING;

-- 8. Seed curated property features
INSERT INTO property_features (id, property_id, label, category, display_order)
VALUES
    ('66666666-1111-1111-1111-111111111001', '11111111-2222-3333-4444-555555555551', 'In-Suite Laundry', 'suite', 1),
    ('66666666-1111-1111-1111-111111111002', '11111111-2222-3333-4444-555555555551', 'EV Charging', 'community', 2),
    ('66666666-1111-1111-1111-111111111003', '11111111-2222-3333-4444-555555555551', 'Underground Parking', 'community', 3),
    ('66666666-1111-1111-1111-111111111004', '11111111-2222-3333-4444-555555555551', 'Pet Friendly', 'policies', 4),
    ('66666666-1111-1111-1111-111111111005', '11111111-2222-3333-4444-555555555551', '24/7 Fitness Center', 'community', 5),
    ('66666666-1111-1111-1111-111111111006', '11111111-2222-3333-4444-555555555552', 'Waterfront Balconies', 'suite', 1),
    ('66666666-1111-1111-1111-111111111007', '11111111-2222-3333-4444-555555555552', 'Keyless Smart Entry', 'community', 2),
    ('66666666-1111-1111-1111-111111111008', '11111111-2222-3333-4444-555555555552', 'Air Conditioning', 'suite', 3),
    ('66666666-1111-1111-1111-111111111009', '11111111-2222-3333-4444-555555555553', 'In-Suite Laundry', 'suite', 1),
    ('66666666-1111-1111-1111-111111111010', '11111111-2222-3333-4444-555555555553', 'Pet Friendly', 'policies', 2),
    ('66666666-1111-1111-1111-111111111011', '11111111-2222-3333-4444-555555555553', 'Air Conditioning', 'suite', 3),
    ('66666666-1111-1111-1111-111111111012', '11111111-2222-3333-4444-555555555553', 'Dog Wash Station', 'community', 4),
    ('66666666-1111-1111-1111-111111111013', '11111111-2222-3333-4444-555555555553', 'Powered Parking', 'community', 5),
    ('66666666-1111-1111-1111-111111111014', '11111111-2222-3333-4444-555555555553', 'Private Balcony / Patio', 'suite', 6),
    ('66666666-1111-1111-1111-111111111015', '11111111-2222-3333-4444-555555555554', 'EV Charging', 'community', 1),
    ('66666666-1111-1111-1111-111111111016', '11111111-2222-3333-4444-555555555554', 'In-Suite Laundry', 'suite', 2),
    ('66666666-1111-1111-1111-111111111017', '11111111-2222-3333-4444-555555555554', 'Pet Friendly', 'policies', 3),
    ('66666666-1111-1111-1111-111111111018', '11111111-2222-3333-4444-555555555554', 'Bike Storage & Workshop', 'community', 4)
ON CONFLICT (id) DO NOTHING;

-- 9. Seed MinIO CDN photos for all showcase properties
INSERT INTO property_photos (id, property_id, storage_key, cdn_url, caption, is_cover, display_order)
VALUES
    ('77777777-1111-1111-1111-111111111001', '11111111-2222-3333-4444-555555555551', 'seed/grandview-hero.png', 'http://localhost:9000/property-media/seed/grandview-hero.png', 'Grandview Heights Twin Towers Exterior at Dusk', TRUE, 1),
    ('77777777-1111-1111-1111-111111111002', '11111111-2222-3333-4444-555555555551', 'seed/grandview-interior.png', 'http://localhost:9000/property-media/seed/grandview-interior.png', 'Skyline Courtyard & Resident Lounge Terrace', FALSE, 2),
    ('77777777-1111-1111-1111-111111111003', '11111111-2222-3333-4444-555555555552', 'seed/pacific-marina-hero.png', 'http://localhost:9000/property-media/seed/pacific-marina-hero.png', 'Pacific Marina Waterfront Skyline View', TRUE, 1),
    ('77777777-1111-1111-1111-111111111004', '11111111-2222-3333-4444-555555555553', 'seed/aurora-heights-hero.png', 'http://localhost:9000/property-media/seed/aurora-heights-hero.png', 'Aurora Heights Commons North Point Facade', TRUE, 1),
    ('77777777-1111-1111-1111-111111111005', '11111111-2222-3333-4444-555555555554', 'seed/harborview-hero.png', 'http://localhost:9000/property-media/seed/harborview-hero.png', 'Harborview Terrace Elliott Bay Twilight', TRUE, 1)
ON CONFLICT (id) DO NOTHING;

