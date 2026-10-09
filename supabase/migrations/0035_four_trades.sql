-- =====================================================================
-- Poslar · 0035 four more trades
--   detail:    auto kozmetika (Radionica)
--   electric:  električar (Teren)
--   appliance: servis kućanskih aparata (Teren)
--   locksmith: bravar (Teren)
--
-- On its own because a new enum value can only be used after the
-- transaction that adds it has committed (0036 adds their object types).
-- =====================================================================
alter type public.package_id add value if not exists 'detail';
alter type public.package_id add value if not exists 'electric';
alter type public.package_id add value if not exists 'appliance';
alter type public.package_id add value if not exists 'locksmith';
