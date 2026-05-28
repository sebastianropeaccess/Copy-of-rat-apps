-- Site Visit schema
-- Four-layer model: properties, companies, deals, inspections, media, audit log.

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.sv_properties (
  id uuid primary key default gen_random_uuid(),
  address text,
  building_name text,
  building_notes jsonb not null default '{}'::jsonb,
  height_safety_system jsonb not null default '{}'::jsonb,
  site_logistics jsonb not null default '{}'::jsonb,
  permanent_hazards jsonb not null default '{}'::jsonb,
  elevations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sv_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'other',
  discovery_answers jsonb not null default '{}'::jsonb,
  hubspot_company_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sv_companies_type_check check (type in ('body_corp', 'builder', 'strata_mgr', 'other'))
);

create table if not exists public.sv_deals (
  id uuid primary key default gen_random_uuid(),
  hubspot_deal_id text,
  pipeline text,
  stage text,
  property_id uuid references public.sv_properties(id) on delete set null,
  company_id uuid references public.sv_companies(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sv_inspections (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.sv_deals(id) on delete set null,
  property_id uuid references public.sv_properties(id) on delete set null,
  company_id uuid references public.sv_companies(id) on delete set null,
  salesperson_id text,
  status text not null default 'enquiry',
  visit_date date,
  site_name text,
  site_address text,
  site_contact text,
  site_phone text,
  site_email text,
  cts_sp_number text,
  site_classification text,
  enquiry_date date,
  proposal_due_date date,
  decision_date date,
  expected_start_date date,
  reason_for_contact text,
  how_heard_about_us text,
  scopes jsonb not null default '[]'::jsonb,
  scope_answers jsonb not null default '{}'::jsonb,
  todays_hazards jsonb not null default '{}'::jsonb,
  specific_equipment jsonb not null default '{}'::jsonb,
  building_notes_snapshot jsonb not null default '{}'::jsonb,
  height_safety_snapshot jsonb not null default '{}'::jsonb,
  site_logistics_snapshot jsonb not null default '{}'::jsonb,
  elevations_snapshot jsonb not null default '{}'::jsonb,
  property_data_inherited boolean not null default false,
  company_data_inherited boolean not null default false,
  locked boolean not null default false,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text,
  constraint sv_inspections_status_check check (
    status in (
      'enquiry',
      'site_visit_scheduled',
      'site_visit_in_progress',
      'inspection_complete',
      'quoted',
      'won',
      'lost'
    )
  ),
  constraint sv_inspections_site_classification_check check (
    site_classification is null or site_classification in ('simple', 'complex')
  )
);

create table if not exists public.sv_inspection_media (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.sv_inspections(id) on delete cascade,
  section text,
  media_type text not null,
  url text not null,
  thumbnail_url text,
  include_in_proposal boolean not null default false,
  comment text,
  created_at timestamptz not null default now(),
  constraint sv_inspection_media_media_type_check check (media_type in ('photo', 'video'))
);

create table if not exists public.sv_audit_log (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.sv_inspections(id) on delete cascade,
  user_name text,
  action text,
  field_name text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists set_sv_properties_updated_at on public.sv_properties;
create trigger set_sv_properties_updated_at
before update on public.sv_properties
for each row execute function public.set_updated_at();

drop trigger if exists set_sv_companies_updated_at on public.sv_companies;
create trigger set_sv_companies_updated_at
before update on public.sv_companies
for each row execute function public.set_updated_at();

drop trigger if exists set_sv_deals_updated_at on public.sv_deals;
create trigger set_sv_deals_updated_at
before update on public.sv_deals
for each row execute function public.set_updated_at();

drop trigger if exists set_sv_inspections_updated_at on public.sv_inspections;
create trigger set_sv_inspections_updated_at
before update on public.sv_inspections
for each row execute function public.set_updated_at();

create index if not exists idx_sv_deals_property_id on public.sv_deals(property_id);
create index if not exists idx_sv_deals_company_id on public.sv_deals(company_id);
create index if not exists idx_sv_inspections_deal_id on public.sv_inspections(deal_id);
create index if not exists idx_sv_inspections_property_id on public.sv_inspections(property_id);
create index if not exists idx_sv_inspections_company_id on public.sv_inspections(company_id);
create index if not exists idx_sv_inspections_status on public.sv_inspections(status);
create index if not exists idx_sv_inspection_media_inspection_id on public.sv_inspection_media(inspection_id);
create index if not exists idx_sv_audit_log_inspection_id on public.sv_audit_log(inspection_id);

alter table public.sv_properties enable row level security;
alter table public.sv_companies enable row level security;
alter table public.sv_deals enable row level security;
alter table public.sv_inspections enable row level security;
alter table public.sv_inspection_media enable row level security;
alter table public.sv_audit_log enable row level security;

create policy "sv_properties_select" on public.sv_properties for select to anon, service_role using (true);
create policy "sv_properties_insert" on public.sv_properties for insert to anon, service_role with check (true);
create policy "sv_properties_update" on public.sv_properties for update to anon, service_role using (true) with check (true);
create policy "sv_properties_delete" on public.sv_properties for delete to anon, service_role using (true);

create policy "sv_companies_select" on public.sv_companies for select to anon, service_role using (true);
create policy "sv_companies_insert" on public.sv_companies for insert to anon, service_role with check (true);
create policy "sv_companies_update" on public.sv_companies for update to anon, service_role using (true) with check (true);
create policy "sv_companies_delete" on public.sv_companies for delete to anon, service_role using (true);

create policy "sv_deals_select" on public.sv_deals for select to anon, service_role using (true);
create policy "sv_deals_insert" on public.sv_deals for insert to anon, service_role with check (true);
create policy "sv_deals_update" on public.sv_deals for update to anon, service_role using (true) with check (true);
create policy "sv_deals_delete" on public.sv_deals for delete to anon, service_role using (true);

create policy "sv_inspections_select" on public.sv_inspections for select to anon, service_role using (true);
create policy "sv_inspections_insert" on public.sv_inspections for insert to anon, service_role with check (true);
create policy "sv_inspections_update" on public.sv_inspections for update to anon, service_role using (true) with check (true);
create policy "sv_inspections_delete" on public.sv_inspections for delete to anon, service_role using (true);

create policy "sv_inspection_media_select" on public.sv_inspection_media for select to anon, service_role using (true);
create policy "sv_inspection_media_insert" on public.sv_inspection_media for insert to anon, service_role with check (true);
create policy "sv_inspection_media_update" on public.sv_inspection_media for update to anon, service_role using (true) with check (true);
create policy "sv_inspection_media_delete" on public.sv_inspection_media for delete to anon, service_role using (true);

create policy "sv_audit_log_select" on public.sv_audit_log for select to anon, service_role using (true);
create policy "sv_audit_log_insert" on public.sv_audit_log for insert to anon, service_role with check (true);
create policy "sv_audit_log_update" on public.sv_audit_log for update to anon, service_role using (true) with check (true);
create policy "sv_audit_log_delete" on public.sv_audit_log for delete to anon, service_role using (true);
