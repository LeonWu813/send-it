-- MOD-002 patch: add city_zh and district_zh columns to gyms table

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS city_zh     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS district_zh TEXT NOT NULL DEFAULT '';

-- Update all 13 seeded gyms
UPDATE public.gyms SET city_zh = '新北市', district_zh = '新莊區' WHERE name = 'MegaSTONE Climbing Gym';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '中山區' WHERE name = 'CORNER 角攀岩館 — Zhongshan';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '中正區' WHERE name = 'CORNER 角攀岩館 — Huashan';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '萬華區' WHERE name = 'T-UP 原岩攀岩館 — Wanhua';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '南港區' WHERE name = 'T-UP 原岩攀岩館 — Nangang';
UPDATE public.gyms SET city_zh = '新北市', district_zh = '新店區' WHERE name = 'T-UP 原岩攀岩館 — Xindian';
UPDATE public.gyms SET city_zh = '新北市', district_zh = '中和區' WHERE name = 'T-UP 原岩攀岩館 — Zhonghe';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '北投區' WHERE name = 'T-UP 原岩攀岩館 — Mingde';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '大同區' WHERE name = 'double8 Climbing Lab';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '南港區' WHERE name = 'Shimin Bouldering Gym';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '南港區' WHERE name = 'Chiyan Climbing Gym';
UPDATE public.gyms SET city_zh = '台北市', district_zh = '士林區' WHERE name = 'RedRock Climbing — Shilin';
UPDATE public.gyms SET city_zh = '新北市', district_zh = '永和區' WHERE name = 'Yonghe Climbing Gym';
