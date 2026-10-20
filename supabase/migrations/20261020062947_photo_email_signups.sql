create table if not exists public.photo_email_signups (
  photo_id uuid not null references public.photo_shares(id) on delete cascade,
  email text not null check (char_length(email) between 3 and 254),
  consent_text text not null,
  created_at timestamptz not null default now(),
  primary key (photo_id, email)
);

alter table public.photo_email_signups enable row level security;
revoke all on table public.photo_email_signups from anon, authenticated;
grant select, insert, update, delete on table public.photo_email_signups to service_role;
create index if not exists photo_email_signups_created_idx on public.photo_email_signups (created_at desc);
