create table if not exists public.photo_shares (
  id uuid primary key default gen_random_uuid(),
  photo_path text not null unique,
  qr_path text not null unique,
  share_url text not null,
  created_at timestamptz not null default now()
);

alter table public.photo_shares enable row level security;
revoke all on table public.photo_shares from anon, authenticated;
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.photo_shares to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('halloween-photos', 'halloween-photos', false, 15728640, array['image/png'])
on conflict (id) do update set public = false, file_size_limit = 15728640, allowed_mime_types = array['image/png'];
