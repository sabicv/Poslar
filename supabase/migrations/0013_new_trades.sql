-- =====================================================================
-- TaktiX · 0013 three more trades
--   aqua: vodoinstalater (Teren)
--   tow:  vučna služba i pomoć na cesti (Cesta)
--   deal: trgovac rabljenim vozilima (Prodaja)
--
-- On its own because a new enum value can only be used after the
-- transaction that adds it has committed (0014 uses them).
-- =====================================================================
alter type public.package_id add value if not exists 'aqua';
alter type public.package_id add value if not exists 'tow';
alter type public.package_id add value if not exists 'deal';
