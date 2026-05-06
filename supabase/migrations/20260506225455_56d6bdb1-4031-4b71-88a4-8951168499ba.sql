create table if not exists public.route_404_events (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  referrer text,
  user_agent text,
  user_id uuid,
  user_role text,
  release_id text,
  created_at timestamptz not null default now()
);

create index if not exists route_404_events_path_idx on public.route_404_events (path);
create index if not exists route_404_events_created_at_idx on public.route_404_events (created_at desc);

alter table public.route_404_events enable row level security;

create policy "anyone can log a 404"
  on public.route_404_events
  for insert
  to anon, authenticated
  with check (true);

create policy "admins read 404 events"
  on public.route_404_events
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));
