-- Site Visit completion, quoting handoff, and permission support.

alter table public.team_members
  add column if not exists can_quote boolean not null default false,
  add column if not exists hubspot_owner_id text;

alter table public.sv_inspections
  alter column locked_by type text using locked_by::text,
  add column if not exists assigned_quoter_id text,
  add column if not exists assigned_quoter_name text,
  add column if not exists ready_to_quote_at timestamptz,
  add column if not exists drive_report_url text;

create index if not exists idx_sv_inspections_assigned_quoter_id
  on public.sv_inspections(assigned_quoter_id);
