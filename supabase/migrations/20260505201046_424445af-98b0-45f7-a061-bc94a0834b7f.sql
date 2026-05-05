
create table if not exists public.backup_payment_rails (
  id uuid primary key default gen_random_uuid(),
  provider_key text not null,
  display_label text not null,
  environment text not null default 'sandbox' check (environment in ('sandbox','live')),
  status text not null default 'standby' check (status in ('standby','active','disabled')),
  credentials jsonb not null default '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_key, environment)
);

alter table public.backup_payment_rails enable row level security;

create policy "Admins manage backup rails"
  on public.backup_payment_rails for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

create or replace function public.touch_backup_payment_rails()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_touch_backup_rails on public.backup_payment_rails;
create trigger trg_touch_backup_rails before update on public.backup_payment_rails
for each row execute function public.touch_backup_payment_rails();
