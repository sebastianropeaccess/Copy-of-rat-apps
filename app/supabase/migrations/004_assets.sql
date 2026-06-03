-- Asset Management app schema.
-- Consolidates: Gear Registry (20+ tabs), Test & Tag, Tools & Equipment Assets.

create extension if not exists pgcrypto;

-- ============================================================
-- assets: single master record for every physical item
-- ============================================================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  item_number text not null,
  asset_type text not null,
  category text not null,
  manufacturer text,
  model text,
  serial_number text,
  date_of_manufacture date,
  date_of_purchase date,
  date_of_first_use date,
  date_of_retirement date,
  status text not null default 'available',
  current_assignee_name text,
  nfc_tag_id text,
  barcode text,
  metadata jsonb,
  comments text,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assets_category_check check (
    category in ('rope_access_gear', 'height_safety', 'tools', 'electrical', 'consumables', 'plant', 'vehicles', 'job_kits')
  ),
  constraint assets_status_check check (
    status in ('available', 'assigned', 'on_job', 'in_service', 'broken', 'retired', 'lost', 'quarantine')
  )
);

-- ============================================================
-- asset_inspections: unified PPE visual checks + Test & Tag history
-- ============================================================
create table if not exists public.asset_inspections (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  inspection_type text not null,
  result text not null,
  inspected_by text not null,
  inspection_date date not null,
  next_due_date date,
  action_required text,
  comments text,
  photo_urls text[],
  created_at timestamptz not null default now(),
  constraint asset_inspections_type_check check (
    inspection_type in ('routine_ppe', 'test_and_tag', 'visual')
  ),
  constraint asset_inspections_result_check check (
    result in ('pass', 'fail', 'conditional_pass')
  )
);

-- ============================================================
-- asset_assignments: check-in / check-out history
-- assigned_to_type supports: person, vehicle, storage_location, job
-- assigned_to_id: UUID string for person/vehicle, free text for location/job
-- assigned_to_name: denormalised display string for fast rendering
-- ============================================================
create table if not exists public.asset_assignments (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  assigned_to_type text not null,
  assigned_to_id text not null,
  assigned_to_name text not null,
  job_id text,
  checked_out_at timestamptz not null default now(),
  checked_in_at timestamptz,
  processed_by text not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint asset_assignments_type_check check (
    assigned_to_type in ('person', 'vehicle', 'storage_location', 'job')
  )
);

-- ============================================================
-- Trigger: keep assets.updated_at current
-- ============================================================
create or replace function public.set_assets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_assets_updated_at on public.assets;
create trigger set_assets_updated_at
before update on public.assets
for each row execute function public.set_assets_updated_at();

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_assets_category on public.assets(category);
create index if not exists idx_assets_status on public.assets(status);
create index if not exists idx_assets_item_number on public.assets(item_number);
create index if not exists idx_assets_nfc_tag_id on public.assets(nfc_tag_id) where nfc_tag_id is not null;
create index if not exists idx_assets_barcode on public.assets(barcode) where barcode is not null;
create index if not exists idx_assets_created_at on public.assets(created_at desc);
create index if not exists idx_asset_inspections_asset_id on public.asset_inspections(asset_id);
create index if not exists idx_asset_inspections_date on public.asset_inspections(inspection_date desc);
create index if not exists idx_asset_assignments_asset_id on public.asset_assignments(asset_id);
create index if not exists idx_asset_assignments_open on public.asset_assignments(asset_id) where checked_in_at is null;

-- ============================================================
-- Storage bucket for inspection photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('asset-inspections', 'asset-inspections', true)
on conflict (id) do nothing;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.assets enable row level security;
alter table public.asset_inspections enable row level security;
alter table public.asset_assignments enable row level security;

drop policy if exists "assets_select" on public.assets;
drop policy if exists "assets_insert" on public.assets;
drop policy if exists "assets_update" on public.assets;
drop policy if exists "assets_delete" on public.assets;

drop policy if exists "asset_inspections_select" on public.asset_inspections;
drop policy if exists "asset_inspections_insert" on public.asset_inspections;
drop policy if exists "asset_inspections_update" on public.asset_inspections;
drop policy if exists "asset_inspections_delete" on public.asset_inspections;

drop policy if exists "asset_assignments_select" on public.asset_assignments;
drop policy if exists "asset_assignments_insert" on public.asset_assignments;
drop policy if exists "asset_assignments_update" on public.asset_assignments;
drop policy if exists "asset_assignments_delete" on public.asset_assignments;

drop policy if exists "asset_inspections_storage_select" on storage.objects;
drop policy if exists "asset_inspections_storage_insert" on storage.objects;
drop policy if exists "asset_inspections_storage_update" on storage.objects;
drop policy if exists "asset_inspections_storage_delete" on storage.objects;

create policy "assets_select" on public.assets for select to anon, service_role using (true);
create policy "assets_insert" on public.assets for insert to anon, service_role with check (true);
create policy "assets_update" on public.assets for update to anon, service_role using (true) with check (true);
create policy "assets_delete" on public.assets for delete to anon, service_role using (true);

create policy "asset_inspections_select" on public.asset_inspections for select to anon, service_role using (true);
create policy "asset_inspections_insert" on public.asset_inspections for insert to anon, service_role with check (true);
create policy "asset_inspections_update" on public.asset_inspections for update to anon, service_role using (true) with check (true);
create policy "asset_inspections_delete" on public.asset_inspections for delete to anon, service_role using (true);

create policy "asset_assignments_select" on public.asset_assignments for select to anon, service_role using (true);
create policy "asset_assignments_insert" on public.asset_assignments for insert to anon, service_role with check (true);
create policy "asset_assignments_update" on public.asset_assignments for update to anon, service_role using (true) with check (true);
create policy "asset_assignments_delete" on public.asset_assignments for delete to anon, service_role using (true);

create policy "asset_inspections_storage_select" on storage.objects for select to anon, service_role
  using (bucket_id = 'asset-inspections');
create policy "asset_inspections_storage_insert" on storage.objects for insert to anon, service_role
  with check (bucket_id = 'asset-inspections');
create policy "asset_inspections_storage_update" on storage.objects for update to anon, service_role
  using (bucket_id = 'asset-inspections') with check (bucket_id = 'asset-inspections');
create policy "asset_inspections_storage_delete" on storage.objects for delete to anon, service_role
  using (bucket_id = 'asset-inspections');
