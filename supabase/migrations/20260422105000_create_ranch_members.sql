create table if not exists public.ranch_members (
  ranch_id uuid not null references public.ranches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (ranch_id, user_id),
  constraint ranch_members_role_check check (role in ('owner', 'member'))
);
