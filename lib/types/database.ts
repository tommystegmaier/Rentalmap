// Minimal hand-rolled Database types. After connecting Supabase, regenerate via:
//   npx supabase gen types typescript --project-id <id> > lib/types/database.ts

export type UserRole = 'landlord' | 'tenant';
export type LeaseStatus = 'active' | 'ended' | 'pending';
export type PaymentMethod =
  | 'ach'
  | 'card'
  | 'zelle'
  | 'venmo'
  | 'cashapp'
  | 'check'
  | 'cash'
  | 'other';
export type PaymentStatus = 'pending' | 'settled' | 'failed' | 'manual';
export type WorkOrderStatus = 'open' | 'in_progress' | 'closed';
export type WorkOrderUrgency = 'emergency' | 'urgent' | 'normal' | 'low';
export type ContactPreference = 'phone' | 'text' | 'email';
export type InvitationStatus = 'pending' | 'accepted' | 'expired';
export type UtilityPayer = 'tenant' | 'landlord' | 'shared';

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  emergency_contact: string | null;
  employer: string | null;
  vehicle_info: string | null;
  notification_prefs: { email: boolean; push: boolean };
  stripe_customer_id: string | null;
  stripe_connect_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertyRow {
  id: string;
  owner_id: string;
  address: string;
  type: string;
  purchase_price_cents: number | null;
  placed_in_service: string | null;
  depreciable_basis_cents: number | null;
  annual_depreciation_cents: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeaseRow {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  monthly_rent_cents: number;
  due_day: number;
  late_after_day: number;
  late_fee_cents: number;
  security_deposit_cents: number;
  pets_allowed: boolean;
  utilities_paid_by: UtilityPayer;
  lawn_care_by: UtilityPayer;
  terms_notes: string | null;
  status: LeaseStatus;
  created_at: string;
  updated_at: string;
}

export interface LeaseTenantRow {
  id: string;
  lease_id: string;
  user_id: string;
  created_at: string;
}

export interface RentPaymentRow {
  id: string;
  lease_id: string;
  expected_date: string;
  received_date: string | null;
  amount_cents: number;
  method: PaymentMethod | null;
  stripe_payment_intent_id: string | null;
  notes: string | null;
  status: PaymentStatus;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRow {
  id: string;
  property_id: string;
  date: string;
  amount_cents: number;
  category: string;
  vendor: string | null;
  notes: string | null;
  receipt_url: string | null;
  work_order_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderRow {
  id: string;
  property_id: string;
  lease_id: string | null;
  submitted_by_user_id: string;
  submitted_at: string;
  request_type: string;
  description: string;
  urgency: WorkOrderUrgency;
  status: WorkOrderStatus;
  photo_urls: string[];
  vendor_name: string | null;
  vendor_phone: string | null;
  total_cost_cents: number | null;
  closed_at: string | null;
  landlord_notes_internal: string | null;
  landlord_notes_shared: string | null;
  tenant_contact_preference: ContactPreference;
  updated_at: string;
}

export interface ApplianceRow {
  id: string;
  property_id: string;
  name: string;
  install_date: string | null;
  warranty_end: string | null;
  serial: string | null;
  model: string | null;
  last_service_date: string | null;
  next_service_due: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRow {
  id: string;
  property_id: string;
  lease_id: string | null;
  type: string;
  filename: string;
  file_url: string;
  date_added: string;
  visible_to_tenant: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface ReminderRow {
  id: string;
  user_id: string;
  property_id: string | null;
  type: string;
  trigger_date: string;
  recurrence: string | null;
  message: string;
  dismissed: boolean;
  created_at: string;
}

export interface TenantInvitationRow {
  id: string;
  landlord_id: string;
  lease_id: string;
  email: string;
  status: InvitationStatus;
  invited_at: string;
  accepted_at: string | null;
  token: string;
}

type Insertable<T> = Partial<T> & Pick<T, never>;

export interface Database {
  public: {
    Tables: {
      users: { Row: UserRow; Insert: Insertable<UserRow>; Update: Partial<UserRow> };
      properties: { Row: PropertyRow; Insert: Insertable<PropertyRow>; Update: Partial<PropertyRow> };
      leases: { Row: LeaseRow; Insert: Insertable<LeaseRow>; Update: Partial<LeaseRow> };
      lease_tenants: { Row: LeaseTenantRow; Insert: Insertable<LeaseTenantRow>; Update: Partial<LeaseTenantRow> };
      rent_payments: { Row: RentPaymentRow; Insert: Insertable<RentPaymentRow>; Update: Partial<RentPaymentRow> };
      expenses: { Row: ExpenseRow; Insert: Insertable<ExpenseRow>; Update: Partial<ExpenseRow> };
      work_orders: { Row: WorkOrderRow; Insert: Insertable<WorkOrderRow>; Update: Partial<WorkOrderRow> };
      appliances: { Row: ApplianceRow; Insert: Insertable<ApplianceRow>; Update: Partial<ApplianceRow> };
      documents: { Row: DocumentRow; Insert: Insertable<DocumentRow>; Update: Partial<DocumentRow> };
      reminders: { Row: ReminderRow; Insert: Insertable<ReminderRow>; Update: Partial<ReminderRow> };
      tenant_invitations: { Row: TenantInvitationRow; Insert: Insertable<TenantInvitationRow>; Update: Partial<TenantInvitationRow> };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      lease_status: LeaseStatus;
      payment_method: PaymentMethod;
      payment_status: PaymentStatus;
      work_order_status: WorkOrderStatus;
      work_order_urgency: WorkOrderUrgency;
      contact_preference: ContactPreference;
      invitation_status: InvitationStatus;
      utility_payer: UtilityPayer;
    };
  };
}
