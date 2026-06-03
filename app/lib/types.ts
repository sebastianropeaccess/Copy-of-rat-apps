export interface TeamMember {
  id: string
  name: string
  pin: string
  position: string
  role: string
  active: boolean
  can_access_apps: string[] | null
  can_generate_reports: boolean
  can_view_all_data: boolean
  can_manage_settings: boolean
  can_quote?: boolean
  hubspot_owner_id?: string | null
  created_at: string
  phone: string | null
  email: string | null
}

export interface RatUser {
  id: string
  name: string
  position: string
  role: string
  can_access_apps?: string[]
  can_generate_reports?: boolean
  can_view_all_data?: boolean
  can_manage_settings?: boolean
}

export interface ToolboxTalk {
  id: string
  date: string
  job_name: string
  presenter: string
  location: string
  topics: string[]
  weather: string
  site_conditions: string
  additional_notes: string | null
  created_by: string
  created_at: string
}

export interface ToolboxTalkSignon {
  id: string
  toolbox_talk_id: string
  team_member_id: string
  team_member_name: string
  signed_at: string
}

export interface GearItem {
  id: string
  gear_id: string
  gear_type: string
  manufacturer: string
  model: string
  size: string | null
  length: string | null
  colour: string | null
  date_of_manufacture: string | null
  date_of_purchase: string | null
  date_of_first_use: string | null
  retirement_rule: string | null
  retirement_date: string | null
  team_member_name: string
  active: boolean
  nfc_uid: string | null
  assigned_to: string | null
  assigned_at: string | null
  created_at: string
}

export interface GearAssignment {
  id: string
  gear_item_id: string
  assigned_to: string
  assigned_by: string
  action: 'assign' | 'return'
  created_at: string
}

export interface GearInspection {
  id: string
  gear_item_id: string
  inspected_by: string
  result: string
  photo_url: string | null
  notes: string | null
  inspected_at: string
}

export interface BrokenGearMedia {
  id: string
  report_id: string
  media_type: 'photo' | 'video' | 'file'
  url: string
  file_name: string | null
  created_at: string
}

export interface BrokenGearReport {
  id: string
  gear_item_id: string | null
  gear_id: string | null
  gear_make: string
  gear_model: string | null
  gear_category: string | null
  issue_description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  remove_from_service: boolean
  replacement_required: boolean
  replacement_urgency: 'same_day' | 'next_day' | 'this_week' | 'not_urgent' | null
  replacement_needed_by: string | null
  job_id: string | null
  job_number: string | null
  job_name: string | null
  site_name: string | null
  status: 'reported' | 'reviewed' | 'replacement_arranged' | 'sent_for_repair' | 'repaired' | 'retired' | 'closed'
  reported_by: string
  reported_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  resolution_notes: string | null
  notification_sent: boolean
  notification_error: string | null
  created_at: string
  updated_at: string
  broken_gear_media?: BrokenGearMedia[]
}

export interface LeaveRequest {
  id: string
  team_member_id: string
  team_member_name: string
  request_type: string
  last_day_work: string | null
  first_day_back: string | null
  days_off: number | null
  leave_early_date: string | null
  leave_early_time: string | null
  reason: string
  status: string
  approved_by: string | null
  created_at: string
}

export interface Service {
  id: string
  project_id: string | null
  name: string
  status: string
  drop_count: number
  drop_labelling: string
  service_type: string
  has_drops: boolean
  created_at: string
  created_by: string | null
}

export interface DropEntry {
  id: string
  service_id: string
  drop: string
  comments: string | null
  completed_at: string | null
  completed_by: string | null
}

export interface DropPhoto {
  id: string
  drop_entry_id: string
  photo_url: string
  sort_order: number
  created_at: string
}

export interface Timesheet {
  id: string
  project_name: string
  simpro_job_id: number | null
  date: string
  description: string
  company_rep_name: string
  company_rep_signature: string | null
  client_rep_name: string
  client_rep_signature: string | null
  total_materials_cost: number
  submitted_by: string
  submitted_at: string
  pdf_url: string | null
  emailed: boolean
}

export interface TimesheetEntry {
  id: string
  timesheet_id: string
  employee_name: string
  onsite_start: string | null
  onsite_finish: string | null
  onsite_breaks: number | null
  onsite_total: number | null
  onsite_comment: string | null
  offsite_start: string | null
  offsite_finish: string | null
  offsite_breaks: number | null
  offsite_total: number | null
  offsite_comment: string | null
}

export interface TimesheetMaterial {
  id: string
  timesheet_id: string
  material_type: string
  quantity: number
  price: number
}

export interface PurchaseReceipt {
  id: string
  date_of_purchase: string | null
  date: string | null
  payment_type: string | null
  card_or_account: string | null
  card_account: string | null
  total_inc_gst: number | null
  total: number | null
  store_name: string
  is_for_job: boolean | null
  job_linked: boolean | null
  job_id: number | null
  job_name: string | null
  job_number: string | null
  purchase_category: string | null
  purchase_for: string | null
  purchase_type: string | null
  sub_category: string | null
  vehicle_id: string | null
  vehicle: string | null
  details: string | null
  receipt_photo_url: string | null
  photo_url: string | null
  status: string
  submitted_by: string | null
  team_member_name: string | null
  submitted_at: string | null
  approved_by: string | null
  approved_at: string | null
}

export interface Vehicle {
  id: string
  name: string
  rego: string | null
  active: boolean
}

export interface SupervisorReview {
  id: string
  supervisor: string
  job_name: string
  service_types: string[]
  job_date: string
  start_time: string
  finish_time: string
  team_members: string[]
  incidents: boolean
  incident_report_filed: boolean | null
  incident_details: string | null
  delays: boolean
  delay_details: string | null
  walkaround_completed: boolean
  walkaround_by: string[]
  job_notes_sufficient: boolean
  job_notes_feedback: string | null
  client_aware: boolean
  client_details: string | null
  client_conversation: boolean
  client_conversation_details: string | null
  ops_notified: boolean
  submitted_by: string
  submitted_at: string
}

// === Simple Repair Tracker ===
export interface RepairBuilding {
  id: string
  name: string
  drop_count: number
  drop_labelling: 'alpha' | 'numeric'
  floor_count: number
  skipped_levels: number[]
  ground_is_level_one: boolean
  drop_plan_url: string | null
  drop_plan_urls: string[] | null
  relevant_locations: string[] | null
  relevant_defect_types: string[] | null
  created_by: string
  created_at: string
}

export interface Repair {
  id: string
  building_id: string
  building_name: string
  drop_label: string
  floor_number: string
  defect_type: string
  sub_type: string | null
  location: string | null
  repair_number: string | null
  height_mm: number | null
  length_mm: number | null
  depth_mm: number | null
  quantity: number | null
  initial_photo_url: string | null
  initial_photo_urls: string[] | null
  initial_comments: string | null
  completion_photo_url: string | null
  completion_photo_urls: string[] | null
  completion_comments: string | null
  status: 'in_progress' | 'completed'
  started_at: string
  completed_at: string | null
  completed_by: string | null
  accumulated_seconds: number | null
  created_by: string
  created_at: string
}

export interface RepairStep {
  id: string
  repair_id: string
  step_number: number
  step_name: string | null
  photo_url: string | null
  photo_urls: string[] | null
  comments: string | null
  created_by: string
  created_at: string
}

// === Facade Inspection ===
export interface FacadeInspection {
  id: string
  building_name: string
  drop_count: number
  floor_count: number
  drop_labelling: string
  relevant_locations: string[]
  relevant_defect_types: string[]
  drop_plan_url: string | null
  inspector_names: string[]
  status: string
  created_by: string
  created_at: string
}

export interface FacadeDefect {
  id: string
  inspection_id: string
  drop: string
  floor: number
  location: string
  defect_type: string
  sub_type: string | null
  repair_number: string
  length_mm: number | null
  height_mm: number | null
  depth_mm: number | null
  quantity: number | null
  photo1_url: string | null
  photo2_url: string | null
  comments: string | null
  created_by: string
  created_at: string
}

// === HSS Inspection ===
export interface HssInspection {
  id: string
  building_name: string
  inspection_date: string
  inspectors: string[]
  gauges_used: string[]
  anchor_plan_urls: string[]
  inspection_complete: boolean
  created_by: string
  created_at: string
}

export interface HssAnchor {
  id: string
  inspection_id: string
  anchor_number: string
  anchor_type: string
  location: string
  condition: string
  result: 'Pass' | 'Fail' | 'N/A'
  photo_url: string | null
  comments: string | null
  corrective_action: string | null
  created_by: string
  created_at: string
}

// === Facade Repair ===
export interface FacadeRepair {
  id: string
  inspection_id: string
  defect_id: string | null
  building_name: string
  drop: string
  floor: number
  defect_type: string
  sub_type: string | null
  repair_number: string
  initial_photo_url: string | null
  completion_photo_url: string | null
  completion_comments: string | null
  status: 'not_started' | 'in_progress' | 'completed'
  completed_at: string | null
  completed_by: string | null
  created_by: string
  created_at: string
}

export interface FacadeRepairStep {
  id: string
  facade_repair_id: string
  step_number: number
  step_name: string
  photo_url: string | null
  comments: string | null
  completed: boolean
  completed_at: string | null
  completed_by: string | null
}

// === External Users ===
export interface ExternalUser {
  id: string | number
  email: string
  name: string
  company: string
  role: 'view_only' | 'allocate' | 'full'
  view_level: 'summary' | 'detailed'
  building_ids: number[]
  can_allocate: boolean
  can_download_reports: boolean
  created_at: string
  auth_user_id?: string | null
  authorised?: boolean
  auth_status?: 'authorised' | 'blocked' | 'missing_auth'
  banned_until?: string | null
  last_sign_in_at?: string | null
}

export interface Candidate {
  id: string
  name: string
  email: string | null
  phone: string | null
  irata_level: string | null
  location: string | null
  source: string | null
  status: string
  skills: string[] | null
  notes: string | null
  cover_letter_keyword: boolean
  screening_score: number | null
  added_by: string | null
  created_at: string
  updated_at: string | null
}

// === Site Visit ===
export type SvJson = Record<string, unknown> | unknown[]

export interface SvProperty {
  id: string
  address: string | null
  building_name: string | null
  building_notes: SvJson
  height_safety_system: SvJson
  site_logistics: SvJson
  permanent_hazards: SvJson
  elevations: SvJson
  created_at: string
  updated_at: string
}

export interface SvCompany {
  id: string
  name: string
  type: 'body_corp' | 'builder' | 'strata_mgr' | 'other'
  discovery_answers: SvJson
  hubspot_company_id: string | null
  created_at: string
  updated_at: string
}

export interface SvDeal {
  id: string
  hubspot_deal_id: string | null
  pipeline: string | null
  stage: string | null
  property_id: string | null
  company_id: string | null
  created_at: string
  updated_at: string
}

export interface SvInspection {
  id: string
  deal_id: string | null
  property_id: string | null
  company_id: string | null
  salesperson_id: string | null
  status:
    | 'enquiry'
    | 'site_visit_scheduled'
    | 'site_visit_in_progress'
    | 'inspection_complete'
    | 'quoted'
    | 'won'
    | 'lost'
  visit_date: string | null
  site_name: string | null
  site_address: string | null
  site_contact: string | null
  site_phone: string | null
  site_email: string | null
  cts_sp_number: string | null
  site_classification: 'simple' | 'complex' | null
  enquiry_date: string | null
  proposal_due_date: string | null
  decision_date: string | null
  expected_start_date: string | null
  reason_for_contact: string | null
  how_heard_about_us: string | null
  scopes: SvJson
  scope_answers: SvJson
  todays_hazards: SvJson
  specific_equipment: SvJson
  building_notes_snapshot: SvJson
  height_safety_snapshot: SvJson
  site_logistics_snapshot: SvJson
  elevations_snapshot: SvJson
  property_data_inherited: boolean
  company_data_inherited: boolean
  locked: boolean
  locked_at: string | null
  locked_by: string | null
  assigned_quoter_id?: string | null
  assigned_quoter_name?: string | null
  ready_to_quote_at?: string | null
  drive_report_url?: string | null
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface SvInspectionMedia {
  id: string
  inspection_id: string
  section: string | null
  media_type: 'photo' | 'video'
  url: string
  thumbnail_url: string | null
  include_in_proposal: boolean
  comment: string | null
  created_at: string
}

export interface SvAuditLog {
  id: string
  inspection_id: string
  user_name: string | null
  action: string | null
  field_name: string | null
  old_value: SvJson | null
  new_value: SvJson | null
  created_at: string
}

// === Asset Management ===
export type AssetCategory = 'rope_access_gear' | 'height_safety' | 'tools' | 'electrical' | 'consumables' | 'plant' | 'vehicles' | 'job_kits'
export type AssetStatus = 'available' | 'assigned' | 'on_job' | 'in_service' | 'broken' | 'retired' | 'lost' | 'quarantine'
export type InspectionType = 'routine_ppe' | 'test_and_tag' | 'visual'
export type InspectionResult = 'pass' | 'fail' | 'conditional_pass'
export type AssignmentType = 'person' | 'vehicle' | 'storage_location' | 'job'

export interface Asset {
  id: string
  item_number: string
  asset_type: string
  category: AssetCategory
  manufacturer: string | null
  model: string | null
  serial_number: string | null
  date_of_manufacture: string | null
  date_of_purchase: string | null
  date_of_first_use: string | null
  date_of_retirement: string | null
  status: AssetStatus
  current_assignee_name: string | null
  nfc_tag_id: string | null
  barcode: string | null
  metadata: Record<string, unknown> | null
  comments: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface AssetInspection {
  id: string
  asset_id: string
  inspection_type: InspectionType
  result: InspectionResult
  inspected_by: string
  inspection_date: string
  next_due_date: string | null
  action_required: string | null
  comments: string | null
  photo_urls: string[] | null
  created_at: string
}

export interface AssetAssignment {
  id: string
  asset_id: string
  assigned_to_type: AssignmentType
  assigned_to_id: string
  assigned_to_name: string
  job_id: string | null
  checked_out_at: string
  checked_in_at: string | null
  processed_by: string
  notes: string | null
  created_at: string
}
