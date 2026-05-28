-- RAT Apps — New tables for all modules
-- Run this in Supabase SQL Editor

-- ============================================
-- TOOLBOX TALKS
-- ============================================
CREATE TABLE toolbox_talks (
  id bigint generated always as identity primary key,
  date date NOT NULL DEFAULT CURRENT_DATE,
  job_name text NOT NULL,
  presenter text NOT NULL,
  location text,
  topics text[], -- array of topic strings
  weather text,
  site_conditions text,
  additional_notes text,
  photo_url text,
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE toolbox_talk_signons (
  id bigint generated always as identity primary key,
  toolbox_talk_id bigint NOT NULL references toolbox_talks(id) ON DELETE CASCADE,
  team_member_name text NOT NULL,
  signed_at timestamptz DEFAULT now()
);

-- ============================================
-- LEAVE REQUESTS
-- ============================================
CREATE TABLE leave_requests (
  id bigint generated always as identity primary key,
  team_member_name text NOT NULL,
  request_type text NOT NULL DEFAULT 'time_off', -- time_off, leave_early
  last_day_work timestamptz,
  first_day_back timestamptz,
  leave_early_time text, -- for leave_early type
  reason text,
  status text NOT NULL DEFAULT 'requested', -- requested, approved, denied, cancelled
  approved_by text,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PURCHASE RECEIPTS
-- ============================================
CREATE TABLE purchase_receipts (
  id bigint generated always as identity primary key,
  team_member_name text NOT NULL,
  date_of_purchase date NOT NULL DEFAULT CURRENT_DATE,
  payment_type text, -- receipt_for_record, invoice_for_payment, receipt_for_reimbursement
  card_or_account text,
  total_inc_gst numeric,
  store_name text,
  is_for_job boolean DEFAULT false,
  job_name text,
  job_number text,
  purchase_category text, -- materials, fuel, other
  purchase_for text, -- waterproofing, all_other_services, etc
  vehicle text,
  details text,
  approved_by text,
  receipt_photo_url text,
  receipt_pdf_url text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  confirmed_by text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- VEHICLES
-- ============================================
CREATE TABLE vehicles (
  id bigint generated always as identity primary key,
  name text NOT NULL,
  make text,
  model text,
  rego text,
  last_service_date date,
  next_service_date date,
  current_kms numeric,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- PERSONAL GEAR / EQUIPMENT REGISTRY
-- ============================================
CREATE TABLE gear_items (
  id bigint generated always as identity primary key,
  gear_id text NOT NULL, -- serial number
  team_member_name text NOT NULL,
  gear_type text NOT NULL, -- harness, lanyard, carabiner, descender, helmet, rope, etc
  manufacturer text,
  model text,
  size text,
  length text,
  colour text,
  date_of_manufacture date,
  date_of_purchase date,
  date_of_first_use date,
  retirement_rule text, -- when_fails_inspection, 10_years_from_dom
  retirement_date date,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE gear_inspections (
  id bigint generated always as identity primary key,
  gear_item_id bigint NOT NULL references gear_items(id) ON DELETE CASCADE,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  inspector_name text NOT NULL,
  result text NOT NULL, -- pass, fail
  notes text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- SUPERVISOR REVIEWS / DAILY CHECKLIST
-- ============================================
CREATE TABLE supervisor_reviews (
  id bigint generated always as identity primary key,
  supervisor_name text NOT NULL,
  job_name text NOT NULL,
  service_types text[], -- array: window_cleaning, facade_repairs, etc
  job_date date NOT NULL DEFAULT CURRENT_DATE,
  start_time text,
  finish_time text,
  incidents boolean DEFAULT false,
  incident_report_filed boolean DEFAULT false,
  incident_details text,
  delays boolean DEFAULT false,
  delay_details text,
  walkround_completed boolean DEFAULT false,
  walkround_by text[],
  job_notes_sufficient boolean DEFAULT true,
  job_notes_feedback text,
  client_aware boolean DEFAULT true,
  client_details text,
  client_conversation boolean DEFAULT false,
  client_conversation_details text,
  ops_notified boolean DEFAULT false,
  team_members text[], -- who was on site
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- FACADE INSPECTIONS
-- ============================================
CREATE TABLE facade_inspections (
  id bigint generated always as identity primary key,
  building_name text NOT NULL,
  drop_count int,
  floor_count int,
  relevant_locations text[],
  relevant_defect_types text[],
  relevant_sub_types jsonb, -- {concrete: [spalling, cracking], brick: [loose, pointing]}
  drop_plans text[], -- array of image URLs
  inspector_names text[],
  status text DEFAULT 'in_progress', -- in_progress, completed
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE facade_defects (
  id bigint generated always as identity primary key,
  inspection_id bigint NOT NULL references facade_inspections(id) ON DELETE CASCADE,
  repair_number text NOT NULL,
  drop_letter text NOT NULL,
  floor_number int NOT NULL,
  sequence_number int NOT NULL,
  location text, -- wall, window, slab_end, soffit, column, etc
  defect_type text, -- concrete, brick, joint_sealing, coatings, etc
  sub_type text, -- spalling, cracking, around_frame, etc
  length_mm numeric,
  height_mm numeric,
  depth_mm numeric,
  quantity numeric,
  photo1_url text,
  photo2_url text,
  comments text,
  inspector text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- HEIGHT SAFETY INSPECTIONS
-- ============================================
CREATE TABLE hss_inspections (
  id bigint generated always as identity primary key,
  building_name text NOT NULL,
  inspection_date date NOT NULL DEFAULT CURRENT_DATE,
  report_number text,
  report_url text,
  inspectors text[],
  gauges_used text[],
  inspection_complete boolean DEFAULT false,
  report_complete boolean DEFAULT false,
  anchor_plans text[], -- array of image URLs
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE hss_anchors (
  id bigint generated always as identity primary key,
  inspection_id bigint NOT NULL references hss_inspections(id) ON DELETE CASCADE,
  anchor_number text NOT NULL,
  anchor_type text, -- anchor, access_system, rail_static_line, compliance_plate
  location text,
  condition text,
  result text NOT NULL, -- pass, fail, na
  photo_url text,
  comments text,
  corrective_action text,
  inspector text,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- RLS POLICIES (allow all for now)
-- ============================================
ALTER TABLE toolbox_talks ENABLE ROW LEVEL SECURITY;
ALTER TABLE toolbox_talk_signons ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gear_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE facade_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE facade_defects ENABLE ROW LEVEL SECURITY;
ALTER TABLE hss_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE hss_anchors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON toolbox_talks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON toolbox_talk_signons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON purchase_receipts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON gear_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON gear_inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON supervisor_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON facade_inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON facade_defects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON hss_inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON hss_anchors FOR ALL USING (true) WITH CHECK (true);

-- Pre-populate vehicles
INSERT INTO vehicles (name, make, model, rego, active) VALUES
  ('HIACE - 259OH9', 'Toyota', 'HIACE', '259OH9', true),
  ('HIACE - 668MV4', 'Toyota', 'HIACE', '668MV4', true),
  ('HIACE - 697KY6', 'Toyota', 'HIACE', '697KY6', true),
  ('Transit - 622BB5', 'Ford', 'Transit', '622BB5', true),
  ('Transit - ROP3S', 'Ford', 'Transit', 'ROP3S', true),
  ('Tiguan - QXIXO1', 'VW', 'Tiguan', 'QXIXO1', true),
  ('Caddy - 552VFJ', 'VW', 'Caddy', '552VFJ', true),
  ('Personal', 'Personal', 'Personal', 'N/A', true);
