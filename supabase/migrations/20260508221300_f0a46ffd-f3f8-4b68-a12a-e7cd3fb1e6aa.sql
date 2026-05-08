
-- Smoke test runs and findings for the Reliability tab
create table if not exists public.smoke_test_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','passed','failed','error')),
  triggered_by text not null default 'cron' check (triggered_by in ('cron','manual')),
  triggered_by_user uuid,
  total_checks int not null default 0,
  passed int not null default 0,
  failed int not null default 0,
  auto_fixed int not null default 0,
  duration_ms int,
  summary jsonb
);

create table if not exists public.smoke_test_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.smoke_test_runs(id) on delete cascade,
  category text not null,
  check_name text not null,
  status text not null check (status in ('pass','fail','warn')),
  detail text,
  target text,
  auto_fixed boolean not null default false,
  fix_notes text,
  created_at timestamptz not null default now()
);

create index if not exists smoke_test_findings_run_id_idx on public.smoke_test_findings(run_id);
create index if not exists smoke_test_runs_started_idx on public.smoke_test_runs(started_at desc);

alter table public.smoke_test_runs enable row level security;
alter table public.smoke_test_findings enable row level security;

create policy "Admins read smoke runs" on public.smoke_test_runs
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "Admins read smoke findings" on public.smoke_test_findings
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
-- writes happen via service role from edge function; no insert policy needed.
