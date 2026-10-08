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

const getHeaders = (token: string) => ({
  Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
  'x-admin-key': token
});

// -------------------------------------------------------------
// FEATURE MODULES: BIRTHDAY POOLS
// -------------------------------------------------------------
export const AdminPoolsScreen: React.FC<ModProps> = ({ token }) => {
  const [pools, setPools] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/pools', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setPools(Array.isArray(d) ? d : []));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Birthday Gift Pools Monitoring</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {pools.map((p) => (
          <div key={p.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between">
            <div>
              <div className="font-bold text-white text-sm">{p.title}</div>
              <div className="text-xs text-slate-400 mt-1">Creator: {p.creator_name}</div>
            </div>
            <div className="text-right font-mono font-bold text-indigo-400">
              TZS {Number(p.total_amount).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// FEATURE MODULES: MICHANGO & COMMUNITY EVENTS
// -------------------------------------------------------------
export const AdminMichangoScreen: React.FC<ModProps> = ({ token }) => {
  const [michango, setMichango] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/michango', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setMichango(Array.isArray(d) ? d : []));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Michango & Community Campaigns</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {michango.map((m) => (
          <div key={m.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between">
            <div>
              <div className="font-bold text-white text-sm">{m.title}</div>
              <div className="text-xs text-slate-400 mt-1">Organizer: {m.creator_name}</div>
            </div>
            <div className="text-right font-mono font-bold text-emerald-400">
              TZS {Number(m.total_amount).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// FEATURE MODULES: PAY BILLS / HOUSE CONTRIBUTIONS
// -------------------------------------------------------------
export const AdminBillsScreen: React.FC<ModProps> = ({ token }) => {
  const [bills, setBills] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/bills', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setBills(Array.isArray(d) ? d : []));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Pay Bills & House Contributions</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bills.map((b) => (
          <div key={b.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex justify-between">
            <div>
              <div className="font-bold text-white text-sm">{b.title}</div>
              <div className="text-xs text-slate-400 mt-1">Provider: TANESCO/DAWASA</div>
            </div>
            <div className="text-right font-mono font-bold text-cyan-400">
              TZS {Number(b.total_amount).toLocaleString()}
            </div>
          </div>
        ))}
      </div>
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
      alert('Internal note added to ticket');
      setNote('');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white flex items-center justify-between">
        <span>Customer Support Operations</span>
      </h2>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Ticket Number</th>
              <th className="p-4">Customer</th>
              <th className="p-4">Title</th>
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
                  <td className="p-4 font-semibold text-white">{t.user_name}</td>
                  <td className="p-4 text-slate-300">{t.title}</td>
                  <td className="p-4 text-slate-400">{t.category}</td>
                  <td className="p-4 text-[10px] font-extrabold uppercase text-amber-400">{t.priority}</td>
                  <td className="p-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                      {t.status}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => setSelectedTicket(t)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white rounded-lg text-[10px] font-bold"
                    >
                      Add Note
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
            <h3 className="text-sm font-extrabold text-white">Add Internal Support Note</h3>
            <p className="text-xs text-slate-400">{selectedTicket.ticket_number}: {selectedTicket.title}</p>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Internal operational notes for staff (hidden from customer)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
            />
            <div className="flex space-x-3">
              <button onClick={() => setSelectedTicket(null)} className="flex-1 py-2 bg-slate-800 text-xs font-semibold text-slate-300 rounded-xl">Close</button>
              <button onClick={handleAddNote} className="flex-1 py-2 bg-indigo-600 font-bold text-xs text-white rounded-xl">Save Note</button>
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
  const [data, setData] = useState<{ discrepancyCount: number; items: any[] } | null>(null);
  useEffect(() => {
    fetch('/api/admin/reconciliation', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then(setData);
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
        <Scale className="w-5 h-5 text-indigo-400" />
        <span>Financial Reconciliation Centre</span>
      </h2>

      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-slate-400">Database vs Provider Settlement Mismatches</div>
            <div className="text-xl font-black text-white mt-1">{data?.discrepancyCount || 0} Pending Discrepancies</div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
            Automated Audit Active
          </span>
        </div>

        {data?.items.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs font-semibold border border-dashed border-slate-800 rounded-xl">
            ✅ All database payments match provider payout records with zero discrepancies!
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {data?.items.map((item) => (
              <div key={item.payment_id} className="py-3 flex justify-between items-center text-xs">
                <div>
                  <div className="font-mono text-indigo-400">{item.merchant_reference}</div>
                  <div className="text-[10px] text-slate-500">Provider: {item.provider_reference || 'N/A'}</div>
                </div>
                <div className="font-mono font-bold text-white">TZS {Number(item.amount).toLocaleString()}</div>
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
            <div className="text-emerald-400 font-bold mt-1">{system?.database || 'HEALTHY'}</div>
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
// REPORTS & CSV EXPORT SCREEN
// -------------------------------------------------------------
export const AdminReportsScreen: React.FC<ModProps> = ({ token }) => {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800 p-5 rounded-2xl">
        <div>
          <h2 className="text-base font-extrabold text-white">Financial & Operational Reports</h2>
          <p className="text-xs text-slate-400 mt-1">Export masked production financial reports for audit compliance.</p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white text-xs rounded-xl shadow-lg shadow-indigo-600/30"
        >
          <Download className="w-4 h-4" />
          <span>Export Masked Financial CSV</span>
        </button>
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

  useEffect(() => {
    fetch('/api/admin/audit-logs', { headers: getHeaders(token) })
      .then((r) => r.json())
      .then((d) => setLogs(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-4">
      <h2 className="text-base font-extrabold text-white">Administrative Security Audit Trail</h2>
      <div className="bg-slate-950/70 border border-slate-800 rounded-2xl overflow-hidden">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900 text-slate-400 font-semibold border-b border-slate-800 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-4">Admin Email</th>
              <th className="p-4">Action</th>
              <th className="p-4">Resource</th>
              <th className="p-4">IP Address</th>
              <th className="p-4">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading audit log trail...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500">No audit log entries recorded yet</td></tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-900/40">
                  <td className="p-4 text-indigo-400 font-bold">{l.admin_email}</td>
                  <td className="p-4 text-emerald-400 font-bold">{l.action}</td>
                  <td className="p-4 text-slate-300">{l.resource_type}:{l.resource_id || 'N/A'}</td>
                  <td className="p-4 text-slate-500">{l.ip_address || '127.0.0.1'}</td>
                  <td className="p-4 text-slate-500">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
