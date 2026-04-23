-- Ensure paddocks_geojson enforces RLS from the caller (not the view owner).
-- Without security_invoker, the view runs as postgres and bypasses RLS on paddocks,
-- leaking data across tenants.
alter view public.paddocks_geojson set (security_invoker = true);
