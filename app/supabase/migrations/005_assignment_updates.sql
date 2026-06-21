-- Asset Management — assignment updates.
-- Adds an explicit expected return date to asset_assignments so the
-- allocation flow can show "Asset Not Available till [X] days" and so
-- operational state is stored as a real date column (not encoded in text).

alter table public.asset_assignments
  add column if not exists expected_return_date date;

-- Speeds up "what is due back / currently out" lookups on open assignments.
create index if not exists idx_asset_assignments_return
  on public.asset_assignments(expected_return_date)
  where checked_in_at is null;
