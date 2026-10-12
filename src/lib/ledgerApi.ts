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

export type UserSummary = {
  balance: {
    available: number;
    pending: number;
    reserved: number;
    tier: string;
    accountRef: string;
    qualifyingTxCount: number;
  };
  stats: {
    splitsCount: number;
    totalVolume: number;
    totalCollected: number;
  };
  recentTransactions: any[];
  recentSplits: any[];
};

export async function fetchUserCardBalance(): Promise<UserCardBalance> {
  const res = await authFetch(`${API_BASE}/me/balance`);
  if (!res.ok) {
    // Graceful fallback to legacy /api/user/card-balance if needed
    const fallbackRes = await authFetch(`${API_BASE}/user/card-balance`);
    if (!fallbackRes.ok) throw new Error('Could not fetch card balance');
    return fallbackRes.json();
  }
  return res.json();
}

export async function fetchLedgerTransactions(): Promise<LedgerTransaction[]> {
  const res = await authFetch(`${API_BASE}/me/transactions`);
  if (!res.ok) {
    const fallbackRes = await authFetch(`${API_BASE}/user/ledger-transactions`);
    if (!fallbackRes.ok) throw new Error('Could not fetch ledger history');
    return fallbackRes.json();
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.transactions || []);
}

export async function fetchUserSummary(): Promise<UserSummary> {
  const res = await authFetch(`${API_BASE}/me/summary`);
  if (!res.ok) throw new Error('Could not fetch user dashboard summary');
  return res.json();
}

export async function fetchUserSplits(): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/me/splits`);
  if (!res.ok) {
    const ownerId = getOwnerId();
    const fallbackRes = await authFetch(`${API_BASE}/splits?owner_user_id=${encodeURIComponent(ownerId)}`);
    if (!fallbackRes.ok) return [];
    return fallbackRes.json();
  }
  const data = await res.json();
  return data.splits || [];
}

export async function fetchUserActivities(): Promise<any[]> {
  const res = await authFetch(`${API_BASE}/me/activities`);
  if (!res.ok) {
    const fallbackRes = await authFetch(`${API_BASE}/user/activities`);
    if (!fallbackRes.ok) return [];
    const fb = await fallbackRes.json();
    return fb.splits || [];
  }
  const data = await res.json();
  return data.activities || [];
}

export async function initiateDeposit(amount: number, phone: string, provider: string = 'M-Pesa') {
  const res = await authFetch(`${API_BASE}/me/deposits/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, phone, provider })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Deposit failed');
  return data;
}

export type DepositStatusResult = {
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  isPaid: boolean;
  isFailed?: boolean;
  depositRef?: string;
  amount?: number;
  message?: string;
};

export async function checkDepositStatus(depositRef?: string, providerTxRef?: string, amount?: number): Promise<DepositStatusResult> {
  const params = new URLSearchParams();
  if (depositRef) params.set('deposit_ref', depositRef);
  if (providerTxRef) params.set('provider_tx_ref', providerTxRef);
  if (amount) params.set('amount', amount.toString());

  const res = await authFetch(`${API_BASE}/me/deposits/status?${params.toString()}`);
  if (!res.ok) throw new Error('Could not verify deposit status');
  return res.json();
}

export async function fetchWithdrawalQuote(amount: number) {
  const res = await authFetch(`${API_BASE}/me/withdrawals/quote?amount=${amount}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not fetch fee quote');
  }
  return res.json();
}

export async function requestWithdrawal(amount: number, destinationType: 'MOBILE_MONEY' | 'BANK', destinationDetails: any) {
  const res = await authFetch(`${API_BASE}/me/withdrawals/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, destinationType, destinationDetails })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Withdrawal request failed');
  return data;
}

export async function fetchUserWithdrawals(): Promise<WithdrawalRequest[]> {
  const res = await authFetch(`${API_BASE}/me/withdrawals`);
  if (!res.ok) throw new Error('Could not fetch withdrawal requests');
  const data = await res.json();
  return data.withdrawals || [];
}

export async function executeBillPayment(provider: string, meterNumber: string, amount: number) {
  const res = await authFetch(`${API_BASE}/me/bill-payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider, accountMeterNumber: meterNumber, amount })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Bill payment failed');
  return data;
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('lumo_user_token');
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', 'Bearer ' + token);
  return fetch(input, { ...init, headers });
}
