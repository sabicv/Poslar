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
}

export interface Profile {
  id: string;
  tenant_id: string;
  full_name: string | null;
  phone: string | null;
  role: StaffRole;
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
}

export type JobWithRefs = Job & { client: Client; asset: Asset; assignee: { id: string; full_name: string | null } | null };

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
