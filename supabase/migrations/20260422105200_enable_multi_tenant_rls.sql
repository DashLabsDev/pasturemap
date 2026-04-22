create or replace function public.user_has_ranch_access(rid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.ranches where id = rid and owner_id = auth.uid()
    union
    select 1 from public.ranch_members where ranch_id = rid and user_id = auth.uid()
  );
$$;

revoke all on function public.user_has_ranch_access(uuid) from public;
grant execute on function public.user_has_ranch_access(uuid) to authenticated, anon;

alter table public.ranches enable row level security;
alter table public.paddocks enable row level security;
alter table public.herds enable row level security;
alter table public.grazing_sessions enable row level security;
alter table public.move_events enable row level security;
alter table public.animals enable row level security;
alter table public.weight_records enable row level security;
alter table public.ranch_members enable row level security;

drop policy if exists ranches_select on public.ranches;
drop policy if exists ranches_insert on public.ranches;
drop policy if exists ranches_update on public.ranches;
drop policy if exists ranches_delete on public.ranches;
create policy ranches_select on public.ranches for select using (public.user_has_ranch_access(id));
create policy ranches_insert on public.ranches for insert with check (owner_id = auth.uid());
create policy ranches_update on public.ranches for update using (public.user_has_ranch_access(id)) with check (public.user_has_ranch_access(id));
create policy ranches_delete on public.ranches for delete using (owner_id = auth.uid());

drop policy if exists paddocks_all on public.paddocks;
create policy paddocks_all on public.paddocks for all using (public.user_has_ranch_access(ranch_id)) with check (public.user_has_ranch_access(ranch_id));

drop policy if exists herds_all on public.herds;
create policy herds_all on public.herds for all using (public.user_has_ranch_access(ranch_id)) with check (public.user_has_ranch_access(ranch_id));

drop policy if exists grazing_sessions_all on public.grazing_sessions;
create policy grazing_sessions_all on public.grazing_sessions for all using (public.user_has_ranch_access(ranch_id)) with check (public.user_has_ranch_access(ranch_id));

drop policy if exists move_events_all on public.move_events;
create policy move_events_all on public.move_events for all using (public.user_has_ranch_access(ranch_id)) with check (public.user_has_ranch_access(ranch_id));

drop policy if exists animals_all on public.animals;
create policy animals_all on public.animals for all
  using (public.user_has_ranch_access((select ranch_id from public.herds where id = animals.herd_id)))
  with check (public.user_has_ranch_access((select ranch_id from public.herds where id = animals.herd_id)));

drop policy if exists weight_records_all on public.weight_records;
create policy weight_records_all on public.weight_records for all
  using (
    public.user_has_ranch_access((
      select h.ranch_id from public.herds h
      join public.animals a on a.herd_id = h.id
      where a.id = weight_records.animal_id
    ))
  )
  with check (
    public.user_has_ranch_access((
      select h.ranch_id from public.herds h
      join public.animals a on a.herd_id = h.id
      where a.id = weight_records.animal_id
    ))
  );

drop policy if exists ranch_members_select on public.ranch_members;
drop policy if exists ranch_members_owner_manage on public.ranch_members;
create policy ranch_members_select on public.ranch_members for select
  using (user_id = auth.uid() or public.user_has_ranch_access(ranch_id));
create policy ranch_members_owner_manage on public.ranch_members for all
  using (exists (select 1 from public.ranches where id = ranch_id and owner_id = auth.uid()))
  with check (exists (select 1 from public.ranches where id = ranch_id and owner_id = auth.uid()));
