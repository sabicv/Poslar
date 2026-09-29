-- =====================================================================
-- X-Files · 0008 seventh package: Air Files (klime i dizalice topline)
--
-- On its own because a new enum value can only be used after the
-- transaction that adds it has committed (0009 uses it).
-- =====================================================================
alter type public.package_id add value if not exists 'air';
