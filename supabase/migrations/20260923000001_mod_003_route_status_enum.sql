-- MOD-003 patch A: add pending and rejected values to route_status enum
-- Must be in a separate migration from anything that USES these values (PG15 constraint).
ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'pending' AFTER 'active';
ALTER TYPE route_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'pending';
