-- ──────────────────────────────────────────────────────────────────────────────
-- MOD-002: Gym Directory — gyms + gym_requests tables + Phase 1 seed
-- ──────────────────────────────────────────────────────────────────────────────
-- Creates:
--   • `gyms`         — admin-curated, branch-level gym rows (readable by all
--                      authenticated users; writable by service_role only)
--   • `gym_requests` — "request a gym" submissions (insertable by authenticated
--                      users; readable by admins only)
--
-- RLS is enabled from creation per the project convention.
-- The FK from users.home_gym_id → gyms.id is added here now that gyms exists.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Gym type enum ─────────────────────────────────────────────────────────────

CREATE TYPE gym_type AS ENUM ('bouldering', 'top_rope', 'both');

-- ── Gyms table ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.gyms (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT        NOT NULL,
  name_zh                  TEXT        NOT NULL,
  branch_label             TEXT,                          -- nullable: e.g. '萬華', '南港'
  city                     TEXT        NOT NULL,          -- e.g. 'Taipei', 'New Taipei'
  district                 TEXT        NOT NULL,          -- e.g. 'Wanhua', 'Nangang'
  address_text             TEXT        NOT NULL,
  lat                      DOUBLE PRECISION NOT NULL,
  lng                      DOUBLE PRECISION NOT NULL,
  gym_type                 gym_type    NOT NULL DEFAULT 'bouldering',
  photo_url                TEXT,
  official_grading_system  TEXT        NOT NULL DEFAULT 'V',
  bouldering_only_note     TEXT,                          -- note for mixed gyms
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── RLS on gyms ───────────────────────────────────────────────────────────────

ALTER TABLE public.gyms ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read gyms (public directory data)
CREATE POLICY "gyms_select_authenticated"
  ON public.gyms
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only service_role can insert / update / delete gyms (admin via Supabase Studio)
-- No explicit INSERT/UPDATE/DELETE policy → only service_role bypasses RLS

-- ── FK: users.home_gym_id → gyms.id ──────────────────────────────────────────
-- MOD-001 left this FK un-added; wire it now that gyms table exists.

ALTER TABLE public.users
  ADD CONSTRAINT users_home_gym_id_fkey
  FOREIGN KEY (home_gym_id) REFERENCES public.gyms(id)
  ON DELETE SET NULL;

-- ── GymRequests table ─────────────────────────────────────────────────────────

CREATE TYPE gym_request_status AS ENUM ('pending', 'added', 'rejected');

CREATE TABLE IF NOT EXISTS public.gym_requests (
  id                   UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by_user_id UUID               NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 TEXT               NOT NULL,
  city                 TEXT               NOT NULL,
  google_maps_url      TEXT,
  status               gym_request_status NOT NULL DEFAULT 'pending',
  created_at           TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  reviewed_at          TIMESTAMPTZ
);

-- ── RLS on gym_requests ───────────────────────────────────────────────────────

ALTER TABLE public.gym_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own requests
CREATE POLICY "gym_requests_insert_own"
  ON public.gym_requests
  FOR INSERT
  WITH CHECK (auth.uid() = requested_by_user_id AND auth.role() = 'authenticated');

-- Only service_role can select / update gym_requests (admin review via Studio)
-- No SELECT/UPDATE/DELETE policy → regular authenticated users cannot read or modify rows

-- ── updated_at trigger for gyms ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.gyms_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER gyms_updated_at_trigger
  BEFORE UPDATE ON public.gyms
  FOR EACH ROW EXECUTE FUNCTION public.gyms_set_updated_at();

-- ──────────────────────────────────────────────────────────────────────────────
-- Phase 1 seed — 13 branch-level gym rows (Taipei + New Taipei)
-- Excluded: Camp4 達文西攀岩館 (top-rope focused), Wusa 攀岩館 (top-rope focused)
-- Mixed gyms (double8, 永和): included with bouldering_only_note
-- Coordinates are approximate map-pin values; must be verified before Phase 1 GA.
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO public.gyms
  (name, name_zh, branch_label, city, district, address_text, lat, lng, gym_type, official_grading_system, bouldering_only_note)
VALUES

-- 1. MegaSTONE Climbing Gym (新北 新莊)
(
  'MegaSTONE Climbing Gym',
  'MegaSTONE 巨石攀岩館',
  NULL,
  'New Taipei',
  'Xinzhuang',
  '新北市新莊區思源路171號',
  25.0363,
  121.4447,
  'bouldering',
  'V',
  NULL
),

-- 2. CORNER 角攀岩館 中山店
(
  'CORNER 角攀岩館 — Zhongshan',
  'CORNER 角攀岩館',
  '中山店',
  'Taipei',
  'Zhongshan',
  '台北市中山區南京東路二段18號4樓',
  25.0525,
  121.5329,
  'bouldering',
  'V',
  NULL
),

-- 3. CORNER 角攀岩館 華山店
(
  'CORNER 角攀岩館 — Huashan',
  'CORNER 角攀岩館',
  '華山店',
  'Taipei',
  'Zhongshan',
  '台北市中正區林森北路27號B1',
  25.0445,
  121.5249,
  'bouldering',
  'V',
  NULL
),

-- 4. 原岩攀岩館 (T-UP) 萬華
(
  'T-UP 原岩攀岩館 — Wanhua',
  '原岩攀岩館',
  '萬華',
  'Taipei',
  'Wanhua',
  '台北市萬華區艋舺大道101號',
  25.0351,
  121.4998,
  'bouldering',
  'V',
  NULL
),

-- 5. 原岩攀岩館 (T-UP) 南港
(
  'T-UP 原岩攀岩館 — Nangang',
  '原岩攀岩館',
  '南港',
  'Taipei',
  'Nangang',
  '台北市南港區忠孝東路七段520號',
  25.0523,
  121.6073,
  'bouldering',
  'V',
  NULL
),

-- 6. 原岩攀岩館 (T-UP) 新店
(
  'T-UP 原岩攀岩館 — Xindian',
  '原岩攀岩館',
  '新店',
  'New Taipei',
  'Xindian',
  '新北市新店區中正路501號',
  24.9706,
  121.5366,
  'bouldering',
  'V',
  NULL
),

-- 7. 原岩攀岩館 (T-UP) 中和
(
  'T-UP 原岩攀岩館 — Zhonghe',
  '原岩攀岩館',
  '中和',
  'New Taipei',
  'Zhonghe',
  '新北市中和區景安路168號',
  24.9986,
  121.5081,
  'bouldering',
  'V',
  NULL
),

-- 8. 原岩攀岩館 (T-UP) 明德
(
  'T-UP 原岩攀岩館 — Mingde',
  '原岩攀岩館',
  '明德',
  'Taipei',
  'Beitou',
  '台北市北投區明德路163號',
  25.1044,
  121.5056,
  'bouldering',
  'V',
  NULL
),

-- 9. double8 岩究所 (mixed — bouldering area only)
(
  'double8 Climbing Lab',
  'double8 岩究所',
  NULL,
  'Taipei',
  'Dadaocheng',
  '台北市大同區迪化街一段14號',
  25.0572,
  121.5098,
  'both',
  'V',
  'Only the bouldering area is represented in Send It. Top-rope routes are excluded.'
),

-- 10. 市民抱石攀岩館
(
  'Shimin Bouldering Gym',
  '市民抱石攀岩館',
  NULL,
  'Taipei',
  'Nangang',
  '台北市南港區市民大道七段50號',
  25.0499,
  121.5996,
  'bouldering',
  'V',
  NULL
),

-- 11. 奇岩攀岩館
(
  'Chiyan Climbing Gym',
  '奇岩攀岩館',
  NULL,
  'Taipei',
  'Nangang',
  '台北市南港區研究院路一段96號',
  25.0548,
  121.6134,
  'bouldering',
  'V',
  NULL
),

-- 12. RedRock 紅石攀岩 士林
(
  'RedRock Climbing — Shilin',
  'RedRock 紅石攀岩',
  '士林',
  'Taipei',
  'Shilin',
  '台北市士林區文林路661號',
  25.0900,
  121.5269,
  'bouldering',
  'V',
  NULL
),

-- 13. 永和攀岩場 (mixed — bouldering area only)
(
  'Yonghe Climbing Gym',
  '永和攀岩場',
  NULL,
  'New Taipei',
  'Yonghe',
  '新北市永和區永和路二段235號',
  25.0090,
  121.5148,
  'both',
  'V',
  'Only the bouldering area is represented in Send It. Top-rope routes are excluded.'
);
