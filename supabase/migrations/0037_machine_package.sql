-- =====================================================================
-- Poslar · 0037 machine package
--   machine: radni strojevi (bageri, traktori, priključci)
--   Tables stay fleet_*: same pattern as marine on moto_*.
-- =====================================================================
alter type public.package_id add value if not exists 'machine';
