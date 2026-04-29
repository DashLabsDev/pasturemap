-- Move PostGIS from public to the extensions schema to clear Supabase's
-- rls_disabled_in_public advisor (spatial_ref_sys is owned by supabase_admin
-- and cannot have RLS enabled, and PostGIS itself rejects ALTER EXTENSION
-- ... SET SCHEMA — so the only path is drop + recreate in the target schema).
--
-- Safety: 3 paddocks, all with boundaries. Boundaries are backed up to a
-- temporary text column (GeoJSON) inside the same transaction, and restored
-- after the extension is recreated. Any failure rolls the entire transaction
-- back; PostgreSQL DDL is transactional including DROP/CREATE EXTENSION and
-- ALTER ROLE.

begin;

-- 1. Drop user objects that depend on PostGIS so the extension can be dropped cleanly.
drop view if exists public.paddocks_geojson;
drop function if exists public.upsert_paddock(uuid, uuid, text, numeric, jsonb, uuid, text, text, text, text);

-- 2. Backup paddock boundaries as GeoJSON text (survives the extension drop).
alter table public.paddocks add column _boundary_backup_geojson text;
update public.paddocks set _boundary_backup_geojson = st_asgeojson(boundary) where boundary is not null;
alter table public.paddocks drop column boundary;  -- also drops idx_paddocks_boundary

-- 3. Drop and recreate PostGIS in extensions schema.
drop extension postgis;
create extension postgis with schema extensions;

-- 4. Add `extensions` to the search_path of every role that runs API queries
--    so unqualified ST_* and the geometry type still resolve.
alter role anon set search_path = "$user", public, extensions;
alter role authenticated set search_path = "$user", public, extensions;
alter role authenticator set search_path = "$user", public, extensions;
alter role service_role set search_path = "$user", public, extensions;

-- 5. Restore paddocks.boundary column with the new schema's geometry type.
alter table public.paddocks add column boundary extensions.geometry(Polygon, 4326);

update public.paddocks
   set boundary = extensions.st_setsrid(extensions.st_geomfromgeojson(_boundary_backup_geojson), 4326)
 where _boundary_backup_geojson is not null;

alter table public.paddocks drop column _boundary_backup_geojson;

-- 6. Recreate GIST index on boundary.
create index idx_paddocks_boundary on public.paddocks using gist (boundary);

-- 7. Recreate paddocks_geojson view (security_invoker preserved per 20260423153000).
create or replace view public.paddocks_geojson
with (security_invoker = true) as
 select id,
    ranch_id,
    name,
    coalesce(acreage,
        case
            when boundary is not null then round((extensions.st_area(extensions.st_transform(boundary, 5070)) / 4046.8564224::double precision)::numeric, 2)::numeric(10,2)
            else null::numeric
        end) as acreage,
    extensions.st_asgeojson(boundary)::jsonb as boundary_geojson,
    parent_paddock_id,
    fence_type,
    water_source,
    color,
    notes,
    created_at,
    updated_at
   from paddocks;

-- 8. Recreate upsert_paddock with explicit search_path so it doesn't depend on caller's.
create or replace function public.upsert_paddock(
  p_id uuid default null::uuid,
  p_ranch_id uuid default null::uuid,
  p_name text default null::text,
  p_acreage numeric default null::numeric,
  p_boundary_geojson jsonb default null::jsonb,
  p_parent_paddock_id uuid default null::uuid,
  p_fence_type text default null::text,
  p_water_source text default null::text,
  p_color text default null::text,
  p_notes text default null::text
)
returns uuid
language plpgsql
set search_path = public, extensions
as $function$
declare
  result_id uuid;
  computed_boundary extensions.geometry;
  computed_acreage numeric;
begin
  if p_boundary_geojson is not null then
    computed_boundary := st_setsrid(st_geomfromgeojson(p_boundary_geojson::text), 4326);
    if p_acreage is null then
      computed_acreage := round((st_area(st_transform(computed_boundary, 5070)) / 4046.8564224)::numeric, 2);
    else
      computed_acreage := p_acreage;
    end if;
  else
    computed_boundary := null;
    computed_acreage := p_acreage;
  end if;

  if p_id is not null then
    update paddocks set
      name = coalesce(p_name, name),
      acreage = coalesce(computed_acreage, acreage),
      boundary = case when computed_boundary is not null then computed_boundary else boundary end,
      parent_paddock_id = p_parent_paddock_id,
      fence_type = coalesce(p_fence_type, fence_type),
      water_source = coalesce(p_water_source, water_source),
      color = coalesce(p_color, color),
      notes = p_notes,
      updated_at = now()
    where id = p_id
    returning id into result_id;
  else
    insert into paddocks (ranch_id, name, acreage, boundary, parent_paddock_id, fence_type, water_source, color, notes)
    values (
      p_ranch_id, p_name, computed_acreage,
      computed_boundary,
      p_parent_paddock_id, p_fence_type, p_water_source, p_color, p_notes
    )
    returning id into result_id;
  end if;

  return result_id;
end;
$function$;

commit;
