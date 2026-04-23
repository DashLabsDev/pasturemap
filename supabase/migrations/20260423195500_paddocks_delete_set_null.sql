-- Allow deleting paddocks by making child FKs ON DELETE SET NULL.
-- Historical grazing_sessions and move_events survive with null paddock refs.
-- Active grazing sessions are blocked at the app layer (UI check in paddocks page).

-- Ensure child columns are nullable so SET NULL can actually apply.
alter table public.grazing_sessions alter column paddock_id drop not null;
alter table public.herds            alter column current_paddock_id drop not null;
alter table public.move_events      alter column from_paddock_id   drop not null;
alter table public.move_events      alter column to_paddock_id     drop not null;
alter table public.paddocks         alter column parent_paddock_id drop not null;

do $$
declare
  r record;
begin
  for r in
    select tc.table_schema, tc.table_name, tc.constraint_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
      and (
        (tc.table_name = 'herds'            and kcu.column_name = 'current_paddock_id') or
        (tc.table_name = 'grazing_sessions' and kcu.column_name = 'paddock_id')         or
        (tc.table_name = 'move_events'      and kcu.column_name in ('from_paddock_id','to_paddock_id')) or
        (tc.table_name = 'paddocks'         and kcu.column_name = 'parent_paddock_id')
      )
  loop
    execute format('alter table %I.%I drop constraint %I',
                   r.table_schema, r.table_name, r.constraint_name);
  end loop;
end $$;

alter table public.herds
  add constraint herds_current_paddock_id_fkey
  foreign key (current_paddock_id) references public.paddocks(id) on delete set null;

alter table public.grazing_sessions
  add constraint grazing_sessions_paddock_id_fkey
  foreign key (paddock_id) references public.paddocks(id) on delete set null;

alter table public.move_events
  add constraint move_events_from_paddock_id_fkey
  foreign key (from_paddock_id) references public.paddocks(id) on delete set null;

alter table public.move_events
  add constraint move_events_to_paddock_id_fkey
  foreign key (to_paddock_id) references public.paddocks(id) on delete set null;

alter table public.paddocks
  add constraint paddocks_parent_paddock_id_fkey
  foreign key (parent_paddock_id) references public.paddocks(id) on delete set null;
