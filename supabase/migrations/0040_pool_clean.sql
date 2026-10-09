-- =====================================================================
-- Poslar · 0040 two more trades
--   pool:  održavanje bazena (Teren)
--   clean: čišćenje apartmana i ureda (Teren)
--
-- On its own because a new enum value can only be used after the
-- transaction that adds it has committed (0041 adds their object types).
-- =====================================================================
alter type public.package_id add value if not exists 'pool';
alter type public.package_id add value if not exists 'clean';
