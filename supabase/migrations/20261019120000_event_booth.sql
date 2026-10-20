create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  host_pin_salt text not null,
  host_pin_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.photo_shares
  add column if not exists event_id uuid references public.events(id) on delete cascade;

create index if not exists photo_shares_event_created_idx
  on public.photo_shares (event_id, created_at desc);

alter table public.events enable row level security;
revoke all on table public.events from anon, authenticated;
grant select, insert, update, delete on table public.events to service_role;
