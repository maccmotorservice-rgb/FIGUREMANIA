-- Future migration: run in a Supabase SQL editor. Not required by the local app.
-- Authentication uses auth.users. Never expose a service-role key in the client.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.figures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null default 0 check (revision >= 0),
  state jsonb not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (id, user_id)
);
create table if not exists public.match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null,
  ordinal integer not null,
  payload jsonb not null,
  foreign key (match_id, user_id) references public.matches(id, user_id) on delete cascade,
  unique (match_id, revision, ordinal)
);
alter table public.profiles enable row level security;
alter table public.figures enable row level security;
alter table public.matches enable row level security;
alter table public.match_events enable row level security;
create policy "own profile" on public.profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "own figures" on public.figures for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own matches" on public.matches for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own events" on public.match_events for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists figures_by_user on public.figures(user_id);
create index if not exists matches_by_user on public.matches(user_id);
create index if not exists events_by_user_match on public.match_events(user_id, match_id);
-- Future remote adapter must update matches with WHERE revision = expected_revision,
-- atomically append events in an authenticated RPC, and reject stale revisions.
-- If media moves to Supabase Storage, use a private bucket and owner-scoped policies.
-- RLS migration is prepared, not executed or verified against a remote database.
