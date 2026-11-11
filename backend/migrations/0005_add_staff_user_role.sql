-- =========================================================================
-- Migration 0005: Extend user_role enum with building staff login role
-- =========================================================================
-- Executed separately so the new enum label commits before subsequent DDL/DML uses it.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff';

