import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Merchant = {
  id: string;
  display_name: string;
  legal_name: string | null;
  category: string;
  phone: string | null;
  verification_status: string;
  destination_id: string;
  payment_rail: string;
  support_contact: string | null;
  city: string | null;
  rating: number;
  created_at: string;
};

export type Split = {
  id: string;
  title: string;
  category: string;
  currency: string;
  total_amount: number;
  mode: string;
  organizer_name: string;
  organizer_phone: string;
  merchant_id: string | null;
  status: string;
  due_at: string | null;
  note: string | null;
  settlement_percent: number;
  amount_paid: number;
  participant_count: number;
  ref_code: string;
  created_at: string;
  merchant?: Merchant | null;
};

export type Participant = {
  id: string;
  split_id: string;
  name: string;
  phone: string | null;
  allocation_amount: number;
  amount_paid: number;
  status: string;
  paid_at: string | null;
  payment_ref: string | null;
  is_organizer: boolean;
  created_at: string;
};

export type PaymentAttempt = {
  id: string;
  split_participant_id: string;
  amount: number;
  provider: string;
  provider_tx_ref: string | null;
  status: string;
  payment_method: string | null;
  requested_at: string;
  completed_at: string | null;
  failure_code: string | null;
};

export type AuditLog = {
  id: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
