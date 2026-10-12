import React, { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

interface OpsProps {
  token: string;
}

const getHeaders = (token: string) => {
  const headers: Record<string, string> = {
    Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`
  };
  if (!token.includes('.')) {
    headers['x-admin-key'] = token;
  }
  return headers;
};

// -------------------------------------------------------------
// SPLITS OPERATIONS SCREEN
// -------------------------------------------------------------
export const AdminSplitsScreen: React.FC<OpsProps> = ({ token }) => {
  const [splits, setSplits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/splits', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((data) => setSplits(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Splits Operations Monitoring</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Ref Code</th>
              <th className="p-4">Creator</th>
              <th className="p-4">Total Amount</th>
              <th className="p-4">Type</th>
              <th className="p-4">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading splits...</td></tr>
            ) : splits.map((s) => (
              <tr key={s.id} className="hover:bg-slate-900/40">
                <td className="p-4 font-bold text-white">{s.title}</td>
                <td className="p-4 font-mono text-indigo-400">{s.ref_code}</td>
                <td className="p-4">{s.creator_name || 'Anonymous'}</td>
                <td className="p-4 font-mono font-bold text-emerald-400">TZS {Number(s.total_amount).toLocaleString()}</td>
                <td className="p-4 text-[10px] font-bold text-slate-400 uppercase">{s.split_type || 'STANDARD'}</td>
                <td className="p-4 font-mono text-slate-500 text-[11px]">{new Date(s.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// PAYMENTS OPERATIONS SCREEN (WITH REFUND CONTROL)
// -------------------------------------------------------------
export const AdminPaymentsScreen: React.FC<OpsProps> = ({ token }) => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPayments = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/payments', { headers: getHeaders(token) });
    if (res.ok) setPayments(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchPayments(); }, [token]);

  const handleRefund = async (paymentId: string) => {
    const reason = prompt('State reason for controlled provider refund:');
    if (!reason) return;

    const res = await fetch(`/api/admin/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    if (res.ok) {
      alert('Payment marked as REFUNDED and recorded in audit log');
      fetchPayments();
    } else {
      const err = await res.json();
      alert(err.error || 'Refund failed');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Payment Operations & Refund Control</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Reference</th>
              <th className="p-4">Payer Phone</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Provider</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading payments...</td></tr>
            ) : payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-900/40">
                <td className="p-4 font-mono text-indigo-400">{p.merchant_reference}</td>
                <td className="p-4 font-mono">{p.phone_number}</td>
                <td className="p-4 font-mono font-bold text-white">TZS {Number(p.amount).toLocaleString()}</td>
                <td className="p-4 font-semibold text-slate-400">{p.provider || 'SNIPPE'}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                    p.status === 'REFUNDED' ? 'bg-purple-950 text-purple-400' : 'bg-rose-950 text-rose-400'
                  }`}>
                    {p.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {p.status === 'COMPLETED' && (
                    <button
                      onClick={() => handleRefund(p.id)}
                      className="px-2.5 py-1 bg-purple-950 hover:bg-purple-900 border border-purple-800 text-purple-300 rounded-lg text-[10px] font-bold"
                    >
                      Initiate Refund
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// SETTLEMENTS MONITORING & RETRY SCREEN
// -------------------------------------------------------------
export const AdminSettlementsScreen: React.FC<OpsProps> = ({ token }) => {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedSettlement, setSelectedSettlement] = useState<any | null>(null);

  const fetchSettlements = async () => {
    setLoading(true);
    const url = statusFilter === 'ALL' 
      ? '/api/admin/settlements' 
      : `/api/admin/settlements?status=${statusFilter}`;
    const res = await fetch(url, { headers: getHeaders(token) });
    if (res.ok) setSettlements(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSettlements(); }, [token, statusFilter]);

  const handleRetry = async (settlementId: string) => {
    if (!confirm('Initiate idempotent settlement retry? This will re-trigger payout resolution safely.')) return;

    const res = await fetch(`/api/admin/settlements/${settlementId}/retry`, {
      method: 'POST',
      headers: getHeaders(token)
    });

    if (res.ok) {
      alert('Settlement retry queued');
      fetchSettlements();
    } else {
      const err = await res.json();
      alert(err.error || 'Retry failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-white">Settlement Operations & Payout Tracking</h2>
        <div className="flex items-center space-x-2">
          {['ALL', 'SETTLED', 'PROCESSING', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Reference / ID</th>
              <th className="p-4">Split / Purpose</th>
              <th className="p-4">Provider</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Attempts</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading settlements...</td></tr>
            ) : settlements.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">No settlement records found</td></tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} className="hover:bg-slate-900/40">
                  <td className="p-4 font-mono text-indigo-400 font-bold">
                    {s.provider_reference || (s.id ? s.id.slice(0, 8) : 'N/A')}
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-white">{s.split_title || 'General Settlement'}</div>
                    <div className="text-[11px] text-slate-400">{s.organizer_name || 'System Payout'}</div>
                  </td>
                  <td className="p-4 font-semibold text-slate-300">{s.provider || 'SNIPPE'}</td>
                  <td className="p-4 font-mono font-bold text-white">
                    {s.currency || 'TZS'} {Number(s.amount || 0).toLocaleString()}
                  </td>
                  <td className="p-4 font-mono text-slate-400">{s.attempt_count || 1}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'SETTLED' || s.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                      s.status === 'PROCESSING' ? 'bg-amber-950 text-amber-400' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-500 text-[11px]">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => setSelectedSettlement(s)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      Details
                    </button>
                    {s.status !== 'SETTLED' && s.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleRetry(s.id)}
                        className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedSettlement && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-white">Settlement Details</h3>
            <div className="space-y-2 text-xs font-mono bg-slate-950 p-4 rounded-xl border border-slate-800 overflow-x-auto text-slate-300">
              <div><strong className="text-slate-400">ID:</strong> {selectedSettlement.id}</div>
              <div><strong className="text-slate-400">Provider Ref:</strong> {selectedSettlement.provider_reference || 'N/A'}</div>
              <div><strong className="text-slate-400">Amount:</strong> TZS {Number(selectedSettlement.amount || 0).toLocaleString()}</div>
              <div><strong className="text-slate-400">Status:</strong> {selectedSettlement.status}</div>
              <div><strong className="text-slate-400">Failure Reason:</strong> {selectedSettlement.failure_reason || 'None'}</div>
              <div><strong className="text-slate-400">Destination Snapshot:</strong></div>
              <pre className="text-[10px] text-indigo-300 whitespace-pre-wrap">{JSON.stringify(selectedSettlement.destination_snapshot, null, 2)}</pre>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedSettlement(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// PAYMENT LINKS SCREEN (WITH REVOCATION)
// -------------------------------------------------------------
export const AdminPaymentLinksScreen: React.FC<OpsProps> = ({ token }) => {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLinks = async () => {
    setLoading(true);
    const url = search 
      ? `/api/admin/payment-links?query=${encodeURIComponent(search)}` 
      : '/api/admin/payment-links';
    const res = await fetch(url, { headers: getHeaders(token) });
    if (res.ok) setLinks(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchLinks(); }, [token]);

  const handleRevoke = async (linkId: string) => {
    if (!confirm('Revoke this payment link? Users will no longer be able to submit payments via this link.')) return;

    const res = await fetch(`/api/admin/payment-links/${linkId}/revoke`, {
      method: 'PATCH',
      headers: getHeaders(token)
    });

    if (res.ok) {
      alert('Payment link revoked');
      fetchLinks();
    } else {
      alert('Revocation failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-white">Payment Links Operational Monitoring</h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLinks()}
            placeholder="Search by title, token, creator..."
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={fetchLinks}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl"
          >
            Filter
          </button>
        </div>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Creator</th>
              <th className="p-4">Public Token</th>
              <th className="p-4">Target / Unit</th>
              <th className="p-4">Collected</th>
              <th className="p-4">Contributions</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">Loading payment links...</td></tr>
            ) : links.length === 0 ? (
              <tr><td colSpan={8} className="p-8 text-center text-slate-500">No payment links found</td></tr>
            ) : (
              links.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/40">
                  <td className="p-4 font-bold text-white">{l.title}</td>
                  <td className="p-4">
                    <div className="text-white font-medium">{l.creator_name || 'Anonymous'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{l.creator_phone || ''}</div>
                  </td>
                  <td className="p-4 font-mono text-indigo-400">{l.public_token}</td>
                  <td className="p-4 font-mono font-bold text-white">
                    {l.amount ? `TZS ${Number(l.amount).toLocaleString()}` : 'OPEN'}
                  </td>
                  <td className="p-4 font-mono font-bold text-emerald-400">
                    TZS {Number(l.collected_amount || 0).toLocaleString()}
                  </td>
                  <td className="p-4 font-mono text-slate-300">{l.contributions_count || 0}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      l.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {l.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleRevoke(l.id)}
                        className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-[10px] font-bold"
                      >
                        Revoke Link
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// DESTINATIONS MANAGEMENT SCREEN (WITH VERIFICATION & TOGGLE)
// -------------------------------------------------------------
export const AdminDestinationsScreen: React.FC<OpsProps> = ({ token }) => {
  const [destinations, setDestinations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDestinations = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/destinations', { headers: getHeaders(token) });
    if (res.ok) setDestinations(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchDestinations(); }, [token]);

  const handleVerify = async (destId: string) => {
    const res = await fetch(`/api/admin/destinations/${destId}/verify`, {
      method: 'POST',
      headers: getHeaders(token)
    });

    if (res.ok) {
      alert('Destination verified');
      fetchDestinations();
    } else {
      alert('Verification failed');
    }
  };

  const handleToggleStatus = async (destId: string) => {
    const res = await fetch(`/api/admin/destinations/${destId}/toggle-status`, {
      method: 'PATCH',
      headers: getHeaders(token)
    });

    if (res.ok) {
      fetchDestinations();
    } else {
      alert('Failed to update destination status');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Payment Destinations Verification & Registry</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Beneficiary / Owner</th>
              <th className="p-4">Type</th>
              <th className="p-4">Account / Phone</th>
              <th className="p-4">Provider / Bank</th>
              <th className="p-4">Verification</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading destinations...</td></tr>
            ) : destinations.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No payment destinations found</td></tr>
            ) : (
              destinations.map((d) => (
                <tr key={d.id} className="hover:bg-slate-900/40">
                  <td className="p-4 font-bold text-white">
                    <div>{d.display_name || d.owner_name || 'Account Holder'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{d.owner_phone || ''}</div>
                  </td>
                  <td className="p-4 text-[10px] font-bold text-slate-400 uppercase">{d.type}</td>
                  <td className="p-4 font-mono text-indigo-400">
                    {d.phone_number || d.account_number || 'N/A'}
                  </td>
                  <td className="p-4 text-slate-300">{d.provider || d.bank_name || 'Mobile Money'}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      d.is_verified || d.verification_status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400' 
                        : 'bg-amber-950 text-amber-400'
                    }`}>
                      {d.is_verified || d.verification_status === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      d.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {d.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {!d.is_verified && (
                      <button
                        onClick={() => handleVerify(d.id)}
                        className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-[10px] font-bold"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleStatus(d.id)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded-lg text-[10px] font-bold"
                    >
                      {d.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// WITHDRAWALS APPROVAL QUEUE SCREEN (WITH FULL CONFIRMATION MODAL)
// -------------------------------------------------------------
export const AdminWithdrawalsScreen: React.FC<OpsProps> = ({ token }) => {
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [modalItem, setModalItem] = useState<{ withdrawal: any; action: 'APPROVE' | 'REJECT' } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchWithdrawals = async () => {
    setLoading(true);
    const url = statusFilter === 'ALL'
      ? '/api/admin/withdrawals'
      : `/api/admin/withdrawals?status=${statusFilter}`;
    const res = await fetch(url, { headers: getHeaders(token) });
    if (res.ok) setWithdrawals(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchWithdrawals(); }, [token, statusFilter]);

  const executeAction = async () => {
    if (!modalItem) return;
    const { withdrawal, action } = modalItem;

    if (action === 'REJECT' && !actionReason.trim()) {
      alert('Please provide a mandatory reason for rejection.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/admin/withdrawals/${withdrawal.id}/action`, {
        method: 'POST',
        headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason: actionReason })
      });

      if (res.ok) {
        alert(`Withdrawal request ${action}D successfully!`);
        setModalItem(null);
        setActionReason('');
        fetchWithdrawals();
      } else {
        const err = await res.json();
        alert(err.error || 'Action failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-white">Controlled Withdrawal Approvals & Ledger Payouts</h2>
        <div className="flex items-center space-x-2">
          {['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                statusFilter === st
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Ref Code</th>
              <th className="p-4">User</th>
              <th className="p-4">Destination</th>
              <th className="p-4">Gross Amount</th>
              <th className="p-4">Fee / Net</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading withdrawal queue...</td></tr>
            ) : withdrawals.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No withdrawal requests found for this filter</td></tr>
            ) : (
              withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-slate-900/40">
                  <td className="p-4 font-mono text-amber-400 font-bold">{w.reference_code}</td>
                  <td className="p-4 text-slate-300 text-[11px]">
                    <div className="font-semibold text-white">{w.user_name || 'Member'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{w.user_phone || w.user_id}</div>
                  </td>
                  <td className="p-4">
                    <div className="font-semibold text-white">{w.destination_type}</div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {w.destination_details?.phone || `${w.destination_details?.bank_name || 'Bank'} (${w.destination_details?.account_number || ''})`}
                    </div>
                  </td>
                  <td className="p-4 font-mono font-bold text-white">TZS {Number(w.amount).toLocaleString()}</td>
                  <td className="p-4 font-mono text-emerald-400 text-[11px]">
                    Net: TZS {Number(w.net_amount || w.amount - (w.fee || 0)).toLocaleString()}
                    <span className="block text-slate-500 text-[10px]">Fee: TZS {Number(w.fee || 0).toLocaleString()}</span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      w.status === 'COMPLETED' || w.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400' :
                      w.status === 'PENDING_REVIEW' ? 'bg-amber-950 text-amber-400 border border-amber-800/60' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {w.status}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    {w.status === 'PENDING_REVIEW' && (
                      <>
                        <button
                          onClick={() => {
                            setActionReason('');
                            setModalItem({ withdrawal: w, action: 'APPROVE' });
                          }}
                          className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-[10px] font-bold"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setActionReason('');
                            setModalItem({ withdrawal: w, action: 'REJECT' });
                          }}
                          className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-[10px] font-bold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalItem && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-white">
              {modalItem.action === 'APPROVE' ? 'Confirm Withdrawal Approval' : 'Reject Withdrawal Request'}
            </h3>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Reference:</span>
                <span className="text-amber-400 font-bold">{modalItem.withdrawal.reference_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Recipient:</span>
                <span className="text-white">{modalItem.withdrawal.user_name || 'Member'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gross Amount:</span>
                <span className="text-white font-bold">TZS {Number(modalItem.withdrawal.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Platform Fee:</span>
                <span className="text-rose-400">TZS {Number(modalItem.withdrawal.fee || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-2 font-bold">
                <span className="text-slate-300">Net Disbursement:</span>
                <span className="text-emerald-400">TZS {Number(modalItem.withdrawal.net_amount).toLocaleString()}</span>
              </div>
            </div>

            {modalItem.action === 'REJECT' ? (
              <div>
                <label className="block text-xs font-bold text-rose-400 mb-1">
                  Rejection Reason (Required - Reserved funds will be refunded):
                </label>
                <textarea
                  rows={3}
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Explain why this request is rejected..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Approval Notes / Payout Instruction (Optional):
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Optional note for audit logs..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="flex space-x-3 pt-2">
              <button
                disabled={submitting}
                onClick={() => setModalItem(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={submitting}
                onClick={executeAction}
                className={`flex-1 py-2.5 font-bold text-xs text-white rounded-xl ${
                  modalItem.action === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-rose-600 hover:bg-rose-500'
                }`}
              >
                {submitting ? 'Processing...' : modalItem.action === 'APPROVE' ? 'Confirm & Disburse' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

