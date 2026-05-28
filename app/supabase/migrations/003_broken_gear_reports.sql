-- Broken Gear / Equipment Issue app schema.

create extension if not exists pgcrypto;

create table if not exists public.broken_gear_reports (
  id uuid primary key default gen_random_uuid(),
  gear_item_id bigint references public.gear_items(id) on delete set null,
  gear_id text,
  gear_make text not null,
  gear_model text,
  gear_category text,
  issue_description text not null,
  severity text not null default 'medium',
  remove_from_service boolean not null default true,
  replacement_required boolean not null default false,
  replacement_urgency text,
  replacement_needed_by timestamptz,
  job_id text,
  job_number text,
  job_name text,
  site_name text,
  status text not null default 'reported',
  reported_by text not null,
  reported_at timestamptz not null default now(),
  reviewed_by text,
  reviewed_at timestamptz,
  resolution_notes text,
  notification_sent boolean not null default false,
  notification_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint broken_gear_reports_severity_check check (severity in ('low', 'medium', 'high', 'critical')),
  constraint broken_gear_reports_status_check check (
    status in ('reported', 'reviewed', 'replacement_arranged', 'sent_for_repair', 'repaired', 'retired', 'closed')
  ),
  constraint broken_gear_reports_replacement_urgency_check check (
    replacement_urgency is null or replacement_urgency in ('same_day', 'next_day', 'this_week', 'not_urgent')
  )
);

create table if not exists public.broken_gear_media (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.broken_gear_reports(id) on delete cascade,
  media_type text not null,
  url text not null,
  file_name text,
  created_at timestamptz not null default now(),
  constraint broken_gear_media_type_check check (media_type in ('photo', 'video', 'file'))
);

create or replace function public.set_broken_gear_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_broken_gear_reports_updated_at on public.broken_gear_reports;
create trigger set_broken_gear_reports_updated_at
before update on public.broken_gear_reports
for each row execute function public.set_broken_gear_updated_at();

create index if not exists idx_broken_gear_reports_status on public.broken_gear_reports(status);
create index if not exists idx_broken_gear_reports_reported_at on public.broken_gear_reports(reported_at desc);
create index if not exists idx_broken_gear_reports_gear_item_id on public.broken_gear_reports(gear_item_id);
create index if not exists idx_broken_gear_media_report_id on public.broken_gear_media(report_id);

insert into storage.buckets (id, name, public)
values ('broken-gear-media', 'broken-gear-media', true)
on conflict (id) do nothing;

alter table public.broken_gear_reports enable row level security;
alter table public.broken_gear_media enable row level security;

drop policy if exists "broken_gear_reports_select" on public.broken_gear_reports;
drop policy if exists "broken_gear_reports_insert" on public.broken_gear_reports;
drop policy if exists "broken_gear_reports_update" on public.broken_gear_reports;
drop policy if exists "broken_gear_reports_delete" on public.broken_gear_reports;

drop policy if exists "broken_gear_media_select" on public.broken_gear_media;
drop policy if exists "broken_gear_media_insert" on public.broken_gear_media;
drop policy if exists "broken_gear_media_update" on public.broken_gear_media;
drop policy if exists "broken_gear_media_delete" on public.broken_gear_media;

drop policy if exists "broken_gear_storage_select" on storage.objects;
drop policy if exists "broken_gear_storage_insert" on storage.objects;
drop policy if exists "broken_gear_storage_update" on storage.objects;
drop policy if exists "broken_gear_storage_delete" on storage.objects;

create policy "broken_gear_reports_select" on public.broken_gear_reports for select to anon, service_role using (true);
create policy "broken_gear_reports_insert" on public.broken_gear_reports for insert to anon, service_role with check (true);
create policy "broken_gear_reports_update" on public.broken_gear_reports for update to anon, service_role using (true) with check (true);
create policy "broken_gear_reports_delete" on public.broken_gear_reports for delete to anon, service_role using (true);

create policy "broken_gear_media_select" on public.broken_gear_media for select to anon, service_role using (true);
create policy "broken_gear_media_insert" on public.broken_gear_media for insert to anon, service_role with check (true);
create policy "broken_gear_media_update" on public.broken_gear_media for update to anon, service_role using (true) with check (true);
create policy "broken_gear_media_delete" on public.broken_gear_media for delete to anon, service_role using (true);

create policy "broken_gear_storage_select" on storage.objects for select to anon, service_role
using (bucket_id = 'broken-gear-media');

create policy "broken_gear_storage_insert" on storage.objects for insert to anon, service_role
with check (bucket_id = 'broken-gear-media');

create policy "broken_gear_storage_update" on storage.objects for update to anon, service_role
using (bucket_id = 'broken-gear-media') with check (bucket_id = 'broken-gear-media');

create policy "broken_gear_storage_delete" on storage.objects for delete to anon, service_role
using (bucket_id = 'broken-gear-media');
