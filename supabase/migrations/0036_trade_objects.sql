-- =====================================================================
-- Poslar · 0036 object types of the four new trades
-- Installations, switchboards, solar plants and car chargers (Električar),
-- household appliances (Kućanski aparati), doors and safes (Bravar).
-- Auto kozmetika works on cars, already allowed. No tables of their own:
-- the job, inspections, photos and maintenance plans carry them.
-- =====================================================================
alter table public.assets drop constraint if exists assets_asset_type_check;
alter table public.assets add constraint assets_asset_type_check check (asset_type in (
  'car', 'van', 'truck', 'tractor_unit', 'bus', 'trailer', 'semi_trailer', 'machine',
  'tractor', 'implement', 'motorcycle', 'scooter', 'atv', 'jetski', 'boat', 'outboard', 'inboard',
  'ac_split', 'ac_multi', 'ac_ducted', 'ac_vrf', 'heat_pump', 'ventilation', 'chiller',
  'water_heater', 'gas_boiler', 'plumbing', 'drainage', 'heating', 'pump',
  'electrical', 'switchboard', 'solar_pv', 'ev_charger',
  'washer', 'dishwasher', 'fridge', 'oven', 'dryer', 'coffee_machine', 'small_appliance',
  'door_lock', 'safe'));
