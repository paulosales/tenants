-- =========================================================================
-- Migration 0008: Normalize imported/legacy 'AVAILABLE' unit statuses to
-- canonical 'vacant' status so public portal & filters match consistently.
-- =========================================================================

UPDATE units
SET status = 'vacant'
WHERE LOWER(status) = 'available';

