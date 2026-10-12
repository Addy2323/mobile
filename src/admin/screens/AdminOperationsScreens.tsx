import React, { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, AlertOctagon, CheckCircle2, ShieldAlert, Send } from 'lucide-react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

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
  const [statusFilter, setStatusFilter] = useState('ALL');

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

  const handleApprove = async (w: any) => {
    let dest = w.destination_details || {};
    if (typeof dest === 'string') {
      try { dest = JSON.parse(dest); } catch {}
    }
    const phone = dest.phone || dest.phoneNumber || dest.phone_number || dest.account_number || w.user_phone || 'N/A';
    const gross = Number(w.amount || 0);
    const fee = Number(w.fee || 0);
    const net = Number(w.net_amount || (gross - fee));
    const finalPayout = net > 0 ? net : gross;

    const result = await Swal.fire({
      title: 'Approve & Disburse Payout?',
      html: `
        <div style="text-align: left; font-size: 13px; line-height: 1.6; color: #cbd5e1;">
          <div style="background: #020617; padding: 12px; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 12px; font-family: monospace;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #94a3b8;">Ref Code:</span>
              <strong style="color: #f59e0b;">${w.reference_code}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #94a3b8;">Recipient:</span>
              <strong style="color: #ffffff;">${w.user_name || 'Member'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #94a3b8;">Mobile Phone:</span>
              <strong style="color: #10b981;">${phone}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #94a3b8;">Channel:</span>
              <span style="color: #38bdf8;">${w.destination_type || 'MOBILE_MONEY'}</span>
            </div>
            <hr style="border-color: #334155; margin: 8px 0;" />
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #94a3b8;">Gross Amount:</span>
              <strong>TZS ${gross.toLocaleString()}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span style="color: #94a3b8;">Platform Fee:</span>
              <span style="color: #f43f5e;">TZS ${fee.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #334155;">
              <span style="color: #cbd5e1; font-weight: bold;">Net Disbursement:</span>
              <strong style="color: #10b981;">TZS ${finalPayout.toLocaleString()}</strong>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            Completing this action finalizes the user ledger debit and dispatches mobile money payout to <strong>${phone}</strong> via Snippe API.
          </p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '⚡ Confirm & Disburse Payout',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#475569',
      background: '#0f172a',
      color: '#ffffff',
      customClass: {
        popup: 'border border-slate-800 rounded-2xl shadow-2xl'
      }
    });

    if (!result.isConfirmed) return;

    Swal.fire({
      title: 'Disbursing Mobile Money...',
      html: `<div style="font-size: 13px; color: #94a3b8;">Sending TZS ${finalPayout.toLocaleString()} to <strong>${phone}</strong> via Snippe.sh Gateway...</div>`,
      allowOutsideClick: false,
      background: '#0f172a',
      color: '#ffffff',
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const res = await fetch(`/api/admin/withdrawals/${w.id}/action`, {
        method: 'POST',
        headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'APPROVE', reason: 'Approved by Administrator' })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Disbursement Dispatched!',
          html: `
            <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <p style="color: #34d399; font-weight: bold; margin-bottom: 8px;">✓ Payout successfully sent to recipient's mobile wallet!</p>
              <div><strong>Recipient Phone:</strong> <span style="color: #10b981; font-family: monospace;">${phone}</span></div>
              <div><strong>Amount Disbursed:</strong> TZS ${finalPayout.toLocaleString()}</div>
              <div><strong>Snippe Payout Ref:</strong> <span style="color: #f59e0b; font-family: monospace;">${data.payoutId || 'Pending'}</span></div>
              <div><strong>Status:</strong> <span style="color: #38bdf8; font-weight: bold;">${data.status || 'PROCESSING'}</span></div>
            </div>
          `,
          confirmButtonColor: '#059669',
          background: '#0f172a',
          color: '#ffffff'
        });
      } else {
        await Swal.fire({
          icon: 'warning',
          title: 'Disbursement Notice',
          html: `
            <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
              <p style="color: #fbbf24; font-weight: bold; margin-bottom: 8px;">The ledger debit was approved, but the mobile money gateway returned a notice:</p>
              <div style="background: #1e1b4b; padding: 10px; border-radius: 8px; border: 1px solid #4338ca; color: #e0e7ff; font-family: monospace; font-size: 12px; margin-bottom: 8px; word-break: break-word;">
                ${data.message || data.error || 'Gateway returned an error'}
              </div>
              <p style="color: #94a3b8; font-size: 11px;">You can retry the disbursement anytime by clicking the "Disburse" button.</p>
            </div>
          `,
          confirmButtonColor: '#d97706',
          background: '#0f172a',
          color: '#ffffff'
        });
      }
      fetchWithdrawals();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Network Communication Error',
        text: err.message || 'Could not connect to admin server.',
        confirmButtonColor: '#e11d48',
        background: '#0f172a',
        color: '#ffffff'
      });
    }
  };

  const handleReject = async (w: any) => {
    const { value: reason } = await Swal.fire({
      title: 'Reject Withdrawal Request',
      text: `State reason for rejecting ${w.reference_code}. Reserved funds (TZS ${Number(w.amount).toLocaleString()}) will be immediately refunded to user's available balance:`,
      input: 'textarea',
      inputPlaceholder: 'Enter mandatory reason for audit trail...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Confirm Rejection & Refund',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#475569',
      background: '#0f172a',
      color: '#ffffff',
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'Rejection reason is mandatory!';
        }
      }
    });

    if (!reason) return;

    Swal.fire({
      title: 'Refunding Funds...',
      allowOutsideClick: false,
      background: '#0f172a',
      color: '#ffffff',
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await fetch(`/api/admin/withdrawals/${w.id}/action`, {
        method: 'POST',
        headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REJECT', reason })
      });

      const data = await res.json();
      if (res.ok) {
        await Swal.fire({
          icon: 'success',
          title: 'Withdrawal Rejected',
          text: `Funds (TZS ${Number(w.amount).toLocaleString()}) successfully refunded to user available balance.`,
          confirmButtonColor: '#059669',
          background: '#0f172a',
          color: '#ffffff'
        });
      } else {
        Swal.fire({
          icon: 'error',
          title: 'Rejection Failed',
          text: data.error || 'Failed to reject withdrawal',
          confirmButtonColor: '#e11d48',
          background: '#0f172a',
          color: '#ffffff'
        });
      }
      fetchWithdrawals();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: err.message,
        background: '#0f172a',
        color: '#ffffff'
      });
    }
  };

  const handleRetryDisburse = async (w: any) => {
    let dest = w.destination_details || {};
    if (typeof dest === 'string') {
      try { dest = JSON.parse(dest); } catch {}
    }
    const phone = dest.phone || dest.phoneNumber || dest.phone_number || dest.account_number || w.user_phone || 'N/A';
    const payout = Number(w.net_amount) > 0 ? Number(w.net_amount) : Number(w.amount);

    const confirm = await Swal.fire({
      title: 'Disburse Payout via Snippe?',
      html: `
        <div style="text-align: left; font-size: 13px; color: #cbd5e1; line-height: 1.6;">
          <div style="background: #020617; padding: 12px; border-radius: 12px; border: 1px solid #1e293b; margin-bottom: 12px; font-family: monospace;">
            <div><span style="color: #94a3b8;">Ref Code:</span> <strong style="color: #f59e0b;">${w.reference_code}</strong></div>
            <div><span style="color: #94a3b8;">Recipient Phone:</span> <strong style="color: #10b981;">${phone}</strong></div>
            <div><span style="color: #94a3b8;">Payout Amount:</span> <strong style="color: #ffffff;">TZS ${payout.toLocaleString()}</strong></div>
            <div><span style="color: #94a3b8;">Current Status:</span> <span style="color: #38bdf8;">${w.status}</span></div>
          </div>
          <p style="margin: 0; color: #94a3b8; font-size: 12px;">Trigger live mobile money payout via Snippe Payouts API.</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '⚡ Send Payout Now',
      confirmButtonColor: '#059669',
      cancelButtonColor: '#475569',
      background: '#0f172a',
      color: '#ffffff'
    });

    if (!confirm.isConfirmed) return;

    Swal.fire({
      title: 'Contacting Snippe Gateway...',
      text: `Dispatching TZS ${payout.toLocaleString()} to ${phone}...`,
      allowOutsideClick: false,
      background: '#0f172a',
      color: '#ffffff',
      didOpen: () => Swal.showLoading()
    });

    try {
      const res = await fetch(`/api/admin/withdrawals/${w.id}/disburse`, {
        method: 'POST',
        headers: getHeaders(token)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await Swal.fire({
          icon: 'success',
          title: 'Disbursement Dispatched!',
          html: `
            <div style="text-align: left; font-size: 13px; color: #cbd5e1;">
              <p style="color: #34d399; font-weight: bold;">${data.message}</p>
              <div style="margin-top: 8px; font-family: monospace; color: #f59e0b;">Snippe Ref: ${data.payoutId || 'Sent'}</div>
            </div>
          `,
          confirmButtonColor: '#059669',
          background: '#0f172a',
          color: '#ffffff'
        });
      } else {
        await Swal.fire({
          icon: 'error',
          title: 'Disbursement Notice',
          text: data.message || data.error || 'Failed to dispatch payout',
          confirmButtonColor: '#e11d48',
          background: '#0f172a',
          color: '#ffffff'
        });
      }
      fetchWithdrawals();
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Network Error',
        text: err.message,
        background: '#0f172a',
        color: '#ffffff'
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-white">Controlled Withdrawal Approvals & Ledger Payouts</h2>
        <div className="flex items-center space-x-2">
          {['ALL', 'PENDING_REVIEW', 'APPROVED', 'DISBURSEMENT_FAILED', 'REJECTED', 'COMPLETED'].map((st) => (
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
              withdrawals.map((w) => {
                let dest = w.destination_details || {};
                if (typeof dest === 'string') {
                  try { dest = JSON.parse(dest); } catch {}
                }
                const phoneDisplay = dest?.phone || dest?.phoneNumber || dest?.phone_number || (dest?.bank_name ? `${dest.bank_name} (${dest.account_number || ''})` : w.user_phone || 'N/A');

                return (
                  <tr key={w.id} className="hover:bg-slate-900/40">
                    <td className="p-4 font-mono text-amber-400 font-bold">{w.reference_code}</td>
                    <td className="p-4 text-slate-300 text-[11px]">
                      <div className="font-semibold text-white">{w.user_name || 'Member'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{w.user_phone || w.user_id}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-white">{w.destination_type}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {phoneDisplay}
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-white">TZS {Number(w.amount).toLocaleString()}</td>
                    <td className="p-4 font-mono text-emerald-400 text-[11px]">
                      Net: TZS {Number(w.net_amount || w.amount - (w.fee || 0)).toLocaleString()}
                      <span className="block text-slate-500 text-[10px]">Fee: TZS {Number(w.fee || 0).toLocaleString()}</span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        w.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400' :
                        w.status === 'APPROVED' ? 'bg-indigo-950 text-indigo-400 border border-indigo-800/60' :
                        w.status === 'PENDING_REVIEW' ? 'bg-amber-950 text-amber-400 border border-amber-800/60' :
                        w.status === 'DISBURSEMENT_FAILED' ? 'bg-rose-950 text-rose-300 border border-rose-800/60' :
                        'bg-rose-950 text-rose-400'
                      }`} title={w.rejection_reason || ''}>
                        {w.status}
                      </span>
                      {w.provider_tx_ref && (
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5" title={w.provider_tx_ref}>
                          Ref: {w.provider_tx_ref.slice(0, 12)}...
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {w.status === 'PENDING_REVIEW' && (
                        <>
                          <button
                            onClick={() => handleApprove(w)}
                            className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-[10px] font-bold"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(w)}
                            className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-[10px] font-bold"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(w.status === 'APPROVED' || w.status === 'DISBURSEMENT_FAILED' || (w.status === 'PROCESSING' && !w.provider_tx_ref)) && (
                        <button
                          onClick={() => handleRetryDisburse(w)}
                          className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded-lg text-[10px] font-bold inline-flex items-center gap-1"
                          title="Trigger/Retry live mobile money payout"
                        >
                          <Send className="w-3 h-3" />
                          <span>Disburse</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

