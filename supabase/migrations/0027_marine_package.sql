-- TaktiX · 0027 marine package
-- Splits "Moto i nautika" into two products: Moto (motorcycles, scooters,
-- quads) keeps the 'moto' id; the marine side (boats, jet-skis, outboard
-- and inboard engines) becomes its own package 'marine'. Same tables as
-- before (moto_storage_locations, moto_vessel_details, moto_engine_details,
-- moto_seasonal_protocols, moto_storage_stays): both products use them,
-- so nothing is renamed or moved, only a new package id is added.
alter type public.package_id add value if not exists 'marine';
