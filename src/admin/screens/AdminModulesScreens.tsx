import React, { useEffect, useState } from 'react';
import {
  LifeBuoy,
  Scale,
  Activity,
  FileSpreadsheet,
  FileText,
  Plus,
  MessageSquare,
  AlertTriangle,
  Download,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { SupportTicket, AuditLogItem } from '../types';

interface ModProps {
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
// FEATURE MODULES: BIRTHDAY POOLS
// -------------------------------------------------------------
export const AdminPoolsScreen: React.FC<ModProps> = ({ token }) => {
  const [pools, setPools] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/pools', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setPools(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Birthday Gift Pools Operational Registry</h2>
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading birthday pools...</div>
      ) : pools.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs font-semibold border border-dashed border-slate-800 rounded-2xl">
          No birthday gift pools created yet. Real records will populate dynamically.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pools.map((p) => {
            const pct = p.target_amount > 0 ? Math.min(100, Math.round((p.collected_amount / p.target_amount) * 100)) : 0;
            return (
              <div key={p.id} className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-white text-sm">{p.birthday_person || p.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Organizer: <span className="text-slate-200">{p.creator_name || 'Anonymous'}</span>
                      {p.creator_phone && <span className="font-mono text-slate-400"> ({p.creator_phone})</span>}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    p.status === 'ACTIVE' || p.status === 'COMPLETED' ? 'bg-indigo-950 text-indigo-400' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {p.status || 'ACTIVE'}
                  </span>
                </div>
                {p.message && <p className="text-xs text-slate-400 italic line-clamp-2">"{p.message}"</p>}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Collected:</span>
                    <span className="text-emerald-400 font-bold">TZS {Number(p.collected_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Target:</span>
                    <span className="text-white">TZS {Number(p.target_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-1">
                    <div className="bg-indigo-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-right text-[10px] text-slate-500">{pct}% funded</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// FEATURE MODULES: MICHANGO & COMMUNITY EVENTS
// -------------------------------------------------------------
export const AdminMichangoScreen: React.FC<ModProps> = ({ token }) => {
  const [michango, setMichango] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/michango', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setMichango(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Michango & Community Campaigns Registry</h2>
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading michango campaigns...</div>
      ) : michango.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs font-semibold border border-dashed border-slate-800 rounded-2xl">
          No michango campaigns created yet. Live community campaigns will display here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {michango.map((m) => {
            const pct = m.target_amount > 0 ? Math.min(100, Math.round((m.collected_amount / m.target_amount) * 100)) : 0;
            return (
              <div key={m.id} className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-extrabold text-white text-sm">{m.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Organizer: <span className="text-slate-200">{m.creator_name || 'Member'}</span>
                      {m.creator_phone && <span className="font-mono text-slate-400"> ({m.creator_phone})</span>}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400">
                    {m.event_type || 'MICHANGO'}
                  </span>
                </div>
                {m.description && <p className="text-xs text-slate-400 line-clamp-2">{m.description}</p>}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Collected:</span>
                    <span className="text-emerald-400 font-bold">TZS {Number(m.collected_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Goal:</span>
                    <span className="text-white">TZS {Number(m.target_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden mt-1">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-right text-[10px] text-slate-500">{pct}% funded</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// FEATURE MODULES: PAY BILLS / HOUSE CONTRIBUTIONS
// -------------------------------------------------------------
export const AdminBillsScreen: React.FC<ModProps> = ({ token }) => {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/bills', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setBills(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Pay Bills & House Contributions Registry</h2>
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading utility and bill splits...</div>
      ) : bills.length === 0 ? (
        <div className="p-8 text-center text-slate-500 text-xs font-semibold border border-dashed border-slate-800 rounded-2xl">
          No bill payments recorded yet. Active house splits and utility payments will appear here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bills.map((b) => (
            <div key={b.id} className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-extrabold text-white text-sm">{b.title || 'Bill Payment'}</div>
                  <div className="text-[11px] text-cyan-400 font-semibold mt-0.5">
                    Provider: {b.bill_provider || 'TANESCO LUKU'}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  b.bill_payment_status === 'PAID' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'
                }`}>
                  {b.bill_payment_status || 'PENDING'}
                </span>
              </div>
              <div className="space-y-1 text-xs">
                {b.biller_control_number && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-400">Control No:</span>
                    <span className="text-white font-bold">{b.biller_control_number}</span>
                  </div>
                )}
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Organizer:</span>
                  <span className="text-slate-300">{b.creator_name || 'Member'}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Total Bill:</span>
                  <span className="text-cyan-400 font-bold">TZS {Number(b.total_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-mono">
                  <span className="text-slate-400">Collected:</span>
                  <span className="text-emerald-400 font-bold">TZS {Number(b.collected_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// SUPPORT CENTRE TICKETING & INTERNAL NOTES
// -------------------------------------------------------------
export const AdminSupportScreen: React.FC<ModProps> = ({ token }) => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [note, setNote] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/support/tickets', { headers: getHeaders(token) });
    if (res.ok) setTickets(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchTickets(); }, [token]);

  const handleAddNote = async () => {
    if (!selectedTicket || !note.trim()) return;
    const res = await fetch(`/api/admin/support/tickets/${selectedTicket.id}/notes`, {
      method: 'POST',
      headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, isInternal: true })
    });

    if (res.ok) {
      alert('Internal note saved to ticket history');
      setNote('');
      fetchTickets();
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    setUpdatingStatus(true);
    const res = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
      method: 'PATCH',
      headers: { ...getHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    if (res.ok) {
      fetchTickets();
      if (selectedTicket && selectedTicket.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus as any });
      }
    }
    setUpdatingStatus(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
          <LifeBuoy className="w-5 h-5 text-indigo-400" />
          <span>Customer Support Operations</span>
        </h2>
        <span className="text-xs text-slate-400 font-mono">
          {tickets.filter((t) => t.status === 'OPEN').length} Open Tickets
        </span>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Ticket</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Subject</th>
              <th className="p-4">Category</th>
              <th className="p-4">Priority</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">Loading support tickets...</td></tr>
            ) : tickets.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-500">No support tickets found</td></tr>
            ) : (
              tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-900/40">
                  <td className="p-4 font-mono font-bold text-indigo-400">{t.ticket_number}</td>
                  <td className="p-4">
                    <div className="font-semibold text-white">{t.user_name || 'Customer'}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{t.user_phone || t.user_email || ''}</div>
                  </td>
                  <td className="p-4 text-slate-200 font-medium">{t.title}</td>
                  <td className="p-4 text-slate-400">{t.category}</td>
                  <td className="p-4">
                    <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                      t.priority === 'URGENT' || t.priority === 'HIGH' ? 'bg-rose-950 text-rose-400' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="p-4">
                    <select
                      value={t.status}
                      disabled={updatingStatus}
                      onChange={(e) => handleStatusChange(t.id, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="WAITING_FOR_USER">WAITING USER</option>
                      <option value="RESOLVED">RESOLVED</option>
                      <option value="CLOSED">CLOSED</option>
                    </select>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedTicket(t)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white rounded-lg text-[10px] font-bold"
                    >
                      Inspect / Note
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-base font-extrabold text-white">Ticket Note & Overview</h3>
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="font-mono text-indigo-400 font-bold">{selectedTicket.ticket_number}</div>
              <div className="text-white font-bold">{selectedTicket.title}</div>
              <div className="text-slate-400 text-[11px]">Customer: {selectedTicket.user_name} ({selectedTicket.user_phone || selectedTicket.user_email || 'N/A'})</div>
              <div className="text-slate-400 text-[11px]">Category: {selectedTicket.category} | Priority: {selectedTicket.priority}</div>
            </div>

            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal operational notes for staff (hidden from customer)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex space-x-3">
              <button onClick={() => setSelectedTicket(null)} className="flex-1 py-2.5 bg-slate-800 text-xs font-semibold text-slate-300 rounded-xl">Close</button>
              <button onClick={handleAddNote} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-xs text-white rounded-xl">Save Internal Note</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// RECONCILIATION CENTRE
// -------------------------------------------------------------
export const AdminReconciliationScreen: React.FC<ModProps> = ({ token }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchReconciliation = async () => {
    setLoading(true);
    const res = await fetch('/api/admin/reconciliation', { headers: getHeaders(token) });
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchReconciliation(); }, [token]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
          <Scale className="w-5 h-5 text-indigo-400" />
          <span>Financial Reconciliation & Invariant Engine</span>
        </h2>
        <button
          onClick={fetchReconciliation}
          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl"
        >
          Re-Run Audit
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-semibold">Total Discrepancies</div>
          <div className="text-2xl font-black text-white mt-1">{data?.discrepancyCount ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-1">Cross-system inconsistencies</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-semibold">Unsettled Payments</div>
          <div className="text-2xl font-black text-amber-400 mt-1">
            {data?.summary?.unsettledPaymentsDiscrepancies ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Completed but missing payout</div>
        </div>
        <div className="bg-slate-950/70 border border-slate-800 p-4 rounded-2xl">
          <div className="text-xs text-slate-400 font-semibold">Negative Balances</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {data?.summary?.negativeBalancesCount ?? 0}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">Ledger invariant status</div>
        </div>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-bold text-slate-300">Detailed Invariant Audit Records</div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
            Real-time Database Check Active
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Running live reconciliation audit...</div>
        ) : !data?.items || data.items.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-semibold border border-dashed border-slate-800 rounded-xl">
            ✅ All database payments match provider payout records with zero discrepancies!
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {data.items.map((item: any, idx: number) => (
              <div key={item.payment_id || idx} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <div className="font-mono text-indigo-400 font-semibold">{item.merchant_reference || 'REF-' + idx}</div>
                  <div className="text-[10px] text-slate-400">
                    Type: <span className="text-amber-400">{item.issue_type || 'Unsettled'}</span> | Provider: {item.provider || 'N/A'}
                  </div>
                </div>
                <div className="font-mono font-bold text-white">TZS {Number(item.amount || 0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// PROVIDERS & SYSTEM HEALTH SCREEN
// -------------------------------------------------------------
export const AdminProvidersScreen: React.FC<ModProps> = ({ token }) => {
  const [providers, setProviders] = useState<any[]>([]);
  const [system, setSystem] = useState<any>(null);

  useEffect(() => {
    fetch('/api/admin/providers', { headers: getHeaders(token) }).then((r) => r.json()).then(setProviders);
    fetch('/api/admin/system', { headers: getHeaders(token) }).then((r) => r.json()).then(setSystem);
  }, [token]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-extrabold text-white mb-3">Payment Provider Connectivity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {providers.map((p) => (
            <div key={p.name} className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-white">{p.name} Merchant Gateway</div>
                <div className="text-xs text-slate-400 mt-1">Environment: {p.environment}</div>
                {p.activeApps && <div className="text-[11px] text-slate-500 mt-0.5">{p.activeApps} Active Apps Connected</div>}
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                p.status === 'CONNECTED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400'
              }`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-base font-extrabold text-white mb-3">System Health & Services</h2>
        <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-slate-400 font-semibold">Application Service:</span>
            <div className="text-emerald-400 font-bold mt-1">{system?.application || 'HEALTHY'}</div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-slate-400 font-semibold">PostgreSQL Database:</span>
            <div className="text-emerald-400 font-bold mt-1">
              {system?.database || 'HEALTHY'} {system?.dbLatencyMs !== undefined && `(${system.dbLatencyMs}ms)`}
            </div>
          </div>
          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl">
            <span className="text-slate-400 font-semibold">System Uptime:</span>
            <div className="text-indigo-400 font-mono font-bold mt-1">{Math.floor(system?.uptimeSeconds || 0)}s</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// REPORTS & LIVE ANALYTICS SCREEN
// -------------------------------------------------------------
export const AdminReportsScreen: React.FC<ModProps> = ({ token }) => {
  const [summary, setSummary] = useState<any>(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/reports/summary?timeframe=${timeframe}`, { headers: getHeaders(token) });
    if (res.ok) setSummary(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchSummary(); }, [token, timeframe]);

  const exportCSV = async () => {
    const res = await fetch('/api/admin/payments', { headers: getHeaders(token) });
    if (!res.ok) return;
    const payments = await res.json();
    
    let csv = 'Merchant_Reference,Phone_Masked,Amount,Status,Provider,Created_At\n';
    payments.forEach((p: any) => {
      const maskedPhone = p.phone_number ? p.phone_number.substring(0, 5) + '****' : 'N/A';
      csv += `${p.merchant_reference},${maskedPhone},${p.amount},${p.status},${p.provider},${p.created_at}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LUMO_Financial_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-base font-extrabold text-white">Financial & Operational Analytics</h2>
          <p className="text-xs text-slate-400 mt-1">Live metrics across payment collections, withdrawal disbursements, and revenues.</p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs font-bold">
            {['7d', '30d', '90d', 'all'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2.5 py-1 rounded-lg uppercase ${
                  timeframe === tf ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs rounded-xl shadow-lg shadow-indigo-600/30"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400">Total Payment Volume</div>
          <div className="text-xl font-black text-white mt-2 font-mono">
            TZS {Number(summary?.payments?.totalVolume || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-400 mt-1 font-semibold">
            {summary?.payments?.completedCount || 0} completed payments
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400">Gross Withdrawals</div>
          <div className="text-xl font-black text-amber-400 mt-2 font-mono">
            TZS {Number(summary?.withdrawals?.totalGross || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-semibold">
            {summary?.withdrawals?.completedCount || 0} approved payouts
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400">Platform Revenue (Fees)</div>
          <div className="text-xl font-black text-emerald-400 mt-2 font-mono">
            TZS {Number(summary?.withdrawals?.totalFees || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Disbursement service fee</div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-5 rounded-2xl">
          <div className="text-xs font-bold text-slate-400">Net Disbursed Funds</div>
          <div className="text-xl font-black text-cyan-400 mt-2 font-mono">
            TZS {Number(summary?.withdrawals?.totalNet || 0).toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">To user bank / mobile money</div>
        </div>
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// AUDIT LOGS SCREEN
// -------------------------------------------------------------
export const AdminAuditLogsScreen: React.FC<ModProps> = ({ token }) => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    const url = search ? `/api/admin/audit-logs?query=${encodeURIComponent(search)}` : '/api/admin/audit-logs';
    const res = await fetch(url, { headers: getHeaders(token) });
    if (res.ok) setLogs(await res.json());
    setLoading(false);
  };

  useEffect(() => { fetchLogs(); }, [token]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h2 className="text-base font-extrabold text-white">Administrative Security Audit Trail</h2>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            placeholder="Search email, action, resource..."
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={fetchLogs}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white rounded-xl"
          >
            Search
          </button>
        </div>
      </div>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Admin Email</th>
              <th className="p-4">Action</th>
              <th className="p-4">Resource</th>
              <th className="p-4">IP Address</th>
              <th className="p-4">Timestamp</th>
              <th className="p-4 text-right">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading audit log trail...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-500">No audit log entries recorded yet</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/40">
                  <td className="p-4 text-indigo-400 font-bold">{l.admin_email}</td>
                  <td className="p-4 text-emerald-400 font-bold">{l.action}</td>
                  <td className="p-4 text-slate-300">{l.resource_type}:{l.resource_id || 'N/A'}</td>
                  <td className="p-4 text-slate-500">{l.ip_address || '127.0.0.1'}</td>
                  <td className="p-4 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="p-4 text-right">
                    {(l.before_state || l.after_state) && (
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="px-2 py-0.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 rounded text-[10px]"
                      >
                        Inspect
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-extrabold text-white">Audit State Snapshot</h3>
            <div className="space-y-3 text-xs font-mono max-h-96 overflow-y-auto">
              {selectedLog.before_state && (
                <div>
                  <div className="text-rose-400 font-bold mb-1">Before State:</div>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.before_state, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.after_state && (
                <div>
                  <div className="text-emerald-400 font-bold mb-1">After State:</div>
                  <pre className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[10px] text-slate-300 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog.after_state, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
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
