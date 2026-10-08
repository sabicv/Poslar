// Row shapes of the tables the app reads. Written by hand from
// supabase/migrations (no generated types until a project is linked).

import type { AssetType, JobPhase, LineKind, MeterUnit, PackageId } from '@/config/tenant.config';

export type TenantStatus = 'trial' | 'active' | 'suspended';
export type StaffRole = 'owner' | 'worker';
export type PaymentStatus = 'unpaid' | 'paid';
export type LinePriority = 'urgent' | 'recommended' | 'optional';
export type LineApproval = 'proposed' | 'approved' | 'declined' | 'deferred';
export type InspectionStatus = 'ok' | 'warn' | 'crit' | 'not_checked' | 'na';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  package: PackageId;
  status: TenantStatus;
  trial_ends_at: string | null;
  status_note: string | null;
  domain: string | null;
  oib: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  logo_url: string | null;
  enabled_modules: string[];
  vocabulary: Record<string, unknown>;
  settings: Record<string, unknown>;
  created_at: string;
  // Set only from the tower (not in the owner's column grant).
  plan: 'basic' | 'standard' | 'premium';
  billing_term: 'monthly' | '24m';
  paid_until: string | null;
  // The founder price runs until this date (0028); null: full price.
  founder_until?: string | null;
  admin_notes: string | null;
  ai_quota: Record<string, number> | null;
  // Door QR self-intake (/q/<intake_token>).
  intake_token: string;
  intake_enabled: boolean;
  // The public booking page, "Rezerviraj termin" (0029).
  booking_enabled?: boolean;
  // A branch: the owner's main workshop, which pays for it (0030).
  main_tenant_id?: string | null;
  // Paying by card through Paddle (0032). Server only.
  paddle_customer_id?: string | null;
  paddle_subscription_id?: string | null;
  paddle_status?: string | null;
  // The mobile that forwards calls to the shared Poslar number (0033).
  phone_forward_from?: string | null;
  // Poziv na broj (model HR00) for the subscription payment.
  billing_ref: number;
  // Who sent this workshop (referral), and when that one got its free month.
  referred_by: string | null;
  referral_rewarded_at: string | null;
  // Terms and data processing agreement accepted at registration (version = date).
  terms_accepted_at: string | null;
  terms_version: string | null;
  // The AI phone agent at Vapi: its phone number id and the number to forward to.
  phone_agent_number_id: string | null;
  phone_agent_number: string | null;
  // The 24-hour trial on sample data ends at this time (null = real work),
  // and when the owner asked for news about new features. Server only.
  sample_until: string | null;
  news_consent_at: string | null;
}

export interface Profile {
  id: string;
  tenant_id: string;
  full_name: string | null;
  phone: string | null;
  role: StaffRole;
  fgas_certificate?: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  tenant_id: string;
  kind: 'person' | 'company';
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  oib: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  tenant_id: string;
  client_id: string;
  parent_asset_id: string | null;
  site_id: string | null;
  asset_type: AssetType;
  identifier: string | null;
  vin: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  engine_code: string | null;
  fuel: string | null;
  power_kw: number | null;
  internal_number: string | null;
  meter_primary_unit: MeterUnit;
  meter_secondary_unit: MeterUnit | null;
  paint_code: string | null;
  axle_config: string | null;
  gvw_t: number | null;
  notes: string | null;
  created_at: string;
}

export interface Job {
  id: string;
  tenant_id: string;
  number: number;
  client_id: string;
  asset_id: string;
  phase: JobPhase;
  sub_status: string | null;
  complaint: string | null;
  diagnosis_notes: string | null;
  work_summary: string | null;
  meter_in: number | null;
  meter_out: number | null;
  meter_unit: MeterUnit | null;
  promised_at: string | null;
  bay: string | null;
  assigned_to: string | null;
  source: string;
  is_urgent: boolean;
  payment_status: PaymentStatus;
  paid_at: string | null;
  locked_at: string | null;
  finished_at: string | null;
  collected_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Field work (0009_field.sql)
  work_mode: 'workshop' | 'field';
  site_id: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  arrived_lat: number | null;
  arrived_lng: number | null;
  left_at: string | null;
  customer_notified_at: string | null;
  report_token: string;
  report_shared_at: string | null;
  plan_id: string | null;
  invoice_number: number | null;
  invoice_year: number | null;
  invoice_issued_at: string | null;
  invoice_fiscal_ref: string | null;
  invoice_token: string;
}

export interface Site {
  id: string;
  tenant_id: string;
  client_id: string;
  label: string | null;
  kind: 'house' | 'flat' | 'apartment' | 'office' | 'commercial' | 'other';
  address: string;
  city: string | null;
  postal_code: string | null;
  lat: number | null;
  lng: number | null;
  access_notes: string | null;
  contact_name: string | null;
  contact_phone: string | null;
}

export interface MaintenancePlan {
  id: string;
  tenant_id: string;
  client_id: string;
  site_id: string | null;
  asset_id: string | null;
  title: string;
  interval_months: number;
  next_due_date: string;
  template_code: string | null;
  active: boolean;
  last_job_id: string | null;
  last_reminded_at: string | null;
  notes: string | null;
}

export type JobWithRefs = Job & { client: Client; asset: Asset; assignee: { id: string; full_name: string | null } | null; site: Site | null };

export interface JobLine {
  id: string;
  tenant_id: string;
  job_id: string;
  sort: number;
  kind: LineKind;
  code: string | null;
  description: string;
  qty: number;
  unit: string;
  priority: LinePriority | null;
  approval: LineApproval;
  declined_reason: string | null;
  source: string;
  inspection_result_id: string | null;
  template_code: string | null;
  technician_id: string | null;
  time_spent_h: number | null;
  created_at: string;
}

export interface JobLinePrice {
  job_line_id: string;
  tenant_id: string;
  unit_price: number;
  purchase_price: number | null;
  discount_pct: number;
  vat_rate: number;
}

export interface Inspection {
  id: string;
  tenant_id: string;
  job_id: string;
  template_code: string;
  title: string;
  performed_by: string | null;
  meter_value: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface InspectionResult {
  id: string;
  tenant_id: string;
  inspection_id: string;
  item_code: string;
  status: InspectionStatus;
  measure_value: number | null;
  measure_unit: string | null;
  note: string | null;
  photo_ids: string[];
  job_line_id: string | null;
}

export interface ConditionMark {
  zone: string;
  code: 'O' | 'U' | 'P' | 'K' | 'L' | 'N';
  note?: string;
}

export interface ConditionReport {
  id: string;
  tenant_id: string;
  job_id: string;
  kind: 'intake' | 'handover';
  diagram: string;
  marks: ConditionMark[];
  equipment: { item: string; present: boolean }[];
  fuel_level: string | null;
  signer_name: string | null;
  signature_path: string | null;
  signed_at: string | null;
}

export interface Attachment {
  id: string;
  tenant_id: string;
  job_id: string | null;
  asset_id: string | null;
  path: string;
  mime: string | null;
  tag: string | null;
  caption: string | null;
  visibility: 'internal' | 'customer' | 'insurer';
  stage: 'before' | 'during' | 'after' | null;
  zone: string | null;
  has_thumb: boolean;
  taken_at: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
  created_at: string;
}

export interface Approval {
  id: string;
  tenant_id: string;
  job_id: string;
  token: string;
  status: 'sent' | 'viewed' | 'decided' | 'expired';
  sent_at: string;
  viewed_at: string | null;
  decided_at: string | null;
  expires_at: string;
  decisions: { lineId: string; decision: 'approved' | 'declined' }[];
  signer_name: string | null;
}

export interface JobEvent {
  id: string;
  job_id: string;
  event_type: string;
  actor_id: string | null;
  message: string;
  created_at: string;
}

export interface JobMessage {
  id: string;
  tenant_id: string;
  job_id: string | null;
  sender_id: string;
  receiver_id: string | null;
  kind: 'task' | 'help';
  body: string;
  status: 'open' | 'taken' | 'done';
  created_at: string;
}

export interface JobTotals {
  job_id: string;
  net_total: number;
  gross_total: number;
}
