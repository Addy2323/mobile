import React, { useEffect, useState } from 'react';
import { RefreshCw, RotateCcw, AlertOctagon, CheckCircle2, ShieldAlert } from 'lucide-react';

interface OpsProps {
  token: string;
}

const getHeaders = (token: string) => ({
  Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  'x-admin-key': token
});

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

  const fetchSettlements = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/settlements', { headers: getHeaders(token) });
    if (res.ok) setSettlements(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSettlements(); }, [token]);

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
      <h2 className="text-base font-extrabold text-white">Settlement Operations & Safe Payout Retries</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Reference</th>
              <th className="p-4">Provider</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Status</th>
              <th className="p-4">Created</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading settlements...</td></tr>
            ) : settlements.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No active settlement records</td></tr>
            ) : (
              settlements.map((s) => (
                <tr key={s.id} className="hover:bg-slate-900/40">
                  <td className="p-4 font-mono text-indigo-400">{s.reference}</td>
                  <td className="p-4 font-semibold">{s.provider || 'SNIPPE'}</td>
                  <td className="p-4 font-mono font-bold text-white">TZS {Number(s.amount).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      s.status === 'SETTLED' ? 'bg-emerald-950 text-emerald-400' :
                      s.status === 'PROCESSING' ? 'bg-amber-950 text-amber-400' : 'bg-rose-950 text-rose-400'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="p-4 font-mono text-slate-500 text-[11px]">{new Date(s.created_at).toLocaleDateString()}</td>
                  <td className="p-4 text-right">
                    {s.status !== 'SETTLED' && (
                      <button
                        onClick={() => handleRetry(s.id)}
                        className="px-2.5 py-1 bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 rounded-lg text-[10px] font-bold flex items-center gap-1 inline-flex"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Retry Payout</span>
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
// PAYMENT LINKS SCREEN (WITH REVOCATION)
// -------------------------------------------------------------
export const AdminPaymentLinksScreen: React.FC<OpsProps> = ({ token }) => {
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLinks = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/payment-links', { headers: getHeaders(token) });
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
      <h2 className="text-base font-extrabold text-white">Payment Links Operational Monitoring</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Title</th>
              <th className="p-4">Token</th>
              <th className="p-4">Amount</th>
              <th className="p-4">Mode</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading payment links...</td></tr>
            ) : links.map((l) => (
              <tr key={l.id} className="hover:bg-slate-900/40">
                <td className="p-4 font-bold text-white">{l.title}</td>
                <td className="p-4 font-mono text-indigo-400">{l.public_token}</td>
                <td className="p-4 font-mono font-bold text-white">
                  {l.amount ? `TZS ${Number(l.amount).toLocaleString()}` : 'CUSTOM'}
                </td>
                <td className="p-4 text-[10px] font-bold text-slate-400">{l.expiration_mode}</td>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// DESTINATIONS MANAGEMENT SCREEN (WITH VERIFICATION)
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
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Payment Destinations Verification</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Beneficiary</th>
              <th className="p-4">Type</th>
              <th className="p-4">Account / Phone</th>
              <th className="p-4">Bank</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading destinations...</td></tr>
            ) : destinations.map((d) => (
              <tr key={d.id} className="hover:bg-slate-900/40">
                <td className="p-4 font-bold text-white">{d.beneficiary_name}</td>
                <td className="p-4 text-[10px] font-bold text-slate-400 uppercase">{d.type}</td>
                <td className="p-4 font-mono text-indigo-400">{d.account_number}</td>
                <td className="p-4 text-slate-400">{d.bank_code || 'M-Pesa/Tigo'}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    d.is_verified ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                  }`}>
                    {d.is_verified ? 'VERIFIED' : 'UNVERIFIED'}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {!d.is_verified && (
                    <button
                      onClick={() => handleVerify(d.id)}
                      className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded-lg text-[10px] font-bold"
                    >
                      Verify Destination
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
