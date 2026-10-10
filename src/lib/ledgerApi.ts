import { getOwnerId } from './ownerId';

const API_BASE = '/api';

export type UserCardBalance = {
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  reservedBalance: number;
  totalCredits: number;
  totalDebits: number;
  tier: 'STARTER' | 'GREEN' | 'PRO' | 'ELITE' | 'VVIP';
  qualifyingTxCount: number;
  accountRef: string;
  updatedAt: string;
};

export type LedgerTransaction = {
  id: string;
  user_id: string;
  transaction_type: string;
  direction: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: string;
  status: string;
  reference_type?: string;
  reference_id?: string;
  provider_tx_ref?: string;
  metadata?: any;
  created_at: string;
};

export type WithdrawalRequest = {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  netAmount: number;
  currency: string;
  destination_type: 'MOBILE_MONEY' | 'BANK';
  destination_details: { phone?: string; bank_name?: string; account_number?: string; recipient_name?: string };
  status: 'PENDING_REVIEW' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'FAILED';
  reference_code: string;
  rejection_reason?: string;
  created_at: string;
};

export async function fetchUserCardBalance(): Promise<UserCardBalance> {
  const userId = getOwnerId();
  const res = await fetch(`${API_BASE}/user/card-balance?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error('Could not fetch card balance');
  }
  return res.json();
}

export async function fetchLedgerTransactions(): Promise<LedgerTransaction[]> {
  const userId = getOwnerId();
  const res = await fetch(`${API_BASE}/user/ledger-transactions?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error('Could not fetch ledger history');
  }
  return res.json();
}

export async function initiateDeposit(amount: number, phone: string, provider: string = 'M-Pesa') {
  const userId = getOwnerId();
  const res = await fetch(`${API_BASE}/user/deposits/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount, phone, provider })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Deposit failed');
  return data;
}

export async function requestWithdrawal(amount: number, destinationType: 'MOBILE_MONEY' | 'BANK', destinationDetails: any) {
  const userId = getOwnerId();
  const res = await fetch(`${API_BASE}/user/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, amount, destination_type: destinationType, destination_details: destinationDetails })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Withdrawal request failed');
  return data;
}

export async function fetchUserWithdrawals(): Promise<WithdrawalRequest[]> {
  const userId = getOwnerId();
  const res = await fetch(`${API_BASE}/user/withdrawals?user_id=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error('Could not fetch withdrawal requests');
  return res.json();
}

export async function executeBillPayment(provider: string, meterNumber: string, amount: number) {
  const userId = getOwnerId();
  const res = await fetch(`${API_BASE}/user/bill-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, provider, account_meter_number: meterNumber, amount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Bill payment failed');
  return data;
}
