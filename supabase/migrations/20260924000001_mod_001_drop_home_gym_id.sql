-- MOD-001 Rev 7: Remove home_gym_id from the users table.
-- The dependent FK (users_home_gym_id_fkey to public.gyms) drops automatically
-- with the column (Postgres behavior). No RLS policy or trigger references
-- home_gym_id (verified clean). The SavedGym join table (MOD-012) replaces
-- the single home_gym_id field.
ALTER TABLE public.users DROP COLUMN IF EXISTS home_gym_id;
