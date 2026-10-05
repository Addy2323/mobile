import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Clock3, DollarSign,
  Filter, RefreshCw, Search, Shield, ShieldCheck, Store, Users, XCircle, MoreHorizontal,
  CircleDollarSign, ScrollText, ReceiptText, ArrowUpRight,
} from 'lucide-react';
import { supabase, type AuditLog, type Merchant, type PaymentAttempt, type Split } from '@/lib/supabase';
import { formatMoney, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';

type AdminTab = 'overview' | 'splits' | 'merchants' | 'payments' | 'audit';
type AdminSplit = Split & { merchant?: Merchant | null };
type AdminPayment = PaymentAttempt & { participant?: { name: string; phone: string | null; split?: { title: string; ref_code: string } | null } | null };

export default function AdminView() {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [splits, setSplits] = useState<AdminSplit[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    const [splitsRes, merchantsRes, paymentsRes, logsRes] = await Promise.all([
      supabase.from('splits').select('*, merchant:merchants(*)').order('created_at', { ascending: false }),
      supabase.from('merchants').select('*').order('created_at', { ascending: false }),
      supabase.from('payment_attempts').select('*, participant:split_participants(name, phone, split:splits(title, ref_code))').order('requested_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);

    const firstError = splitsRes.error || merchantsRes.error || paymentsRes.error || logsRes.error;
    if (firstError) setError('Some operations data could not be loaded. Refresh to try again.');
    if (splitsRes.data) setSplits(splitsRes.data as AdminSplit[]);
    if (merchantsRes.data) setMerchants(merchantsRes.data as Merchant[]);
    if (paymentsRes.data) setPayments(paymentsRes.data as AdminPayment[]);
    if (logsRes.data) setAuditLogs(logsRes.data as AuditLog[]);
    setLoading(false);
    setRefreshing(false);
  }

  async function refresh() {
    setRefreshing(true);
    await loadData();
  }

  async function updateMerchantStatus(merchant: Merchant, status: string) {
    const { error: updateError } = await supabase.from('merchants').update({ verification_status: status }).eq('id', merchant.id);
    if (updateError) {
      setError('Merchant status could not be updated.');
      return;
    }
    await supabase.from('audit_logs').insert({ actor: 'Admin', action: `MERCHANT_${status}`, entity_type: 'merchant', entity_id: merchant.id, metadata: { display_name: merchant.display_name } });
    setNotice(`${merchant.display_name} is now ${status.toLowerCase().replace('_', ' ')}.`);
    setTimeout(() => setNotice(''), 2500);
    await loadData();
  }

  async function updateSplitStatus(split: AdminSplit, status: string) {
    const { error: updateError } = await supabase.from('splits').update({ status }).eq('id', split.id);
    if (updateError) {
      setError('Split status could not be updated.');
      return;
    }
    await supabase.from('audit_logs').insert({ actor: 'Admin', action: `SPLIT_${status}`, entity_type: 'split', entity_id: split.id, metadata: { ref_code: split.ref_code } });
    setNotice(`${split.ref_code} updated.`);
    setTimeout(() => setNotice(''), 2500);
    await loadData();
  }

  const totalVolume = splits.reduce((sum, split) => sum + split.total_amount, 0);
  const totalCollected = splits.reduce((sum, split) => sum + split.amount_paid, 0);
  const settledSplits = splits.filter((split) => split.status === 'SETTLED').length;
  const activeSplits = splits.filter((split) => ['ACTIVE', 'PARTIALLY_PAID'].includes(split.status)).length;
  const failedPayments = payments.filter((payment) => ['FAILED', 'REVERSED'].includes(payment.status)).length;
  const verifiedMerchants = merchants.filter((merchant) => ['VERIFIED', 'ACTIVE'].includes(merchant.verification_status)).length;

  const filteredSplits = splits.filter((split) => {
    const matchesQuery = !query || `${split.title} ${split.ref_code} ${split.organizer_name} ${split.merchant?.display_name || ''}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || split.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const filteredMerchants = merchants.filter((merchant) => !query || `${merchant.display_name} ${merchant.destination_id} ${merchant.city || ''}`.toLowerCase().includes(query.toLowerCase()));
  const filteredPayments = payments.filter((payment) => !query || `${payment.provider_tx_ref || ''} ${payment.participant?.name || ''} ${payment.participant?.split?.title || ''}`.toLowerCase().includes(query.toLowerCase()));

  const topMerchants = useMemo(() => merchants.map((merchant) => ({ merchant, volume: splits.filter((split) => split.merchant_id === merchant.id).reduce((sum, split) => sum + split.total_amount, 0) })).sort((a, b) => b.volume - a.volume).slice(0, 5), [merchants, splits]);

  if (loading) return <div className="px-4 py-8 md:ml-[258px]"><div className="h-72 rounded-2xl shimmer" /></div>;

  return (
    <div className="min-h-[calc(100vh-78px)] bg-[#f5f6f7] px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1250px] animate-fade-in">
        <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
          <div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary-600"><Shield className="h-4 w-4" /> Admin workspace</div><h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Operations control center</h1><p className="mt-1 text-sm text-slate-500">Manage destinations, monitor payment activity, and keep every split accountable.</p></div>
          <button onClick={() => void refresh()} className="flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Refresh data</button>
        </div>

        {notice && <div className="mb-4 rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm font-semibold text-success-700">{notice}</div>}
        {error && <div className="mb-4 flex items-center justify-between rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm font-semibold text-error-700"><span>{error}</span><button onClick={() => setError('')}><XCircle className="h-4 w-4" /></button></div>}

        <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {([{ id: 'overview', label: 'Overview' }, { id: 'splits', label: 'All splits', count: splits.length }, { id: 'merchants', label: 'Merchants', count: merchants.length }, { id: 'payments', label: 'Payments', count: payments.length }, { id: 'audit', label: 'Audit log', count: auditLogs.length }] as { id: AdminTab; label: string; count?: number }[]).map((item) => <button key={item.id} onClick={() => { setTab(item.id); setQuery(''); setStatusFilter('ALL'); }} className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${tab === item.id ? 'bg-slate-950 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>{item.label}{item.count !== undefined && <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${tab === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500'}`}>{item.count}</span>}</button>)}
        </div>

        {tab === 'overview' && <Overview splits={splits} merchants={merchants} topMerchants={topMerchants} totalVolume={totalVolume} totalCollected={totalCollected} activeSplits={activeSplits} settledSplits={settledSplits} failedPayments={failedPayments} verifiedMerchants={verifiedMerchants} setTab={setTab} />}
        {tab === 'splits' && <DataTableHeader query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} placeholder="Search title, ref, organizer, or merchant" filters={['ALL', 'ACTIVE', 'PARTIALLY_PAID', 'SETTLED', 'EXPIRED', 'CANCELLED']}><SplitsTable splits={filteredSplits} onStatusChange={updateSplitStatus} /></DataTableHeader>}
        {tab === 'merchants' && <DataTableHeader query={query} setQuery={setQuery} placeholder="Search merchant or destination ID"><MerchantsTable merchants={filteredMerchants} onStatusChange={updateMerchantStatus} /></DataTableHeader>}
        {tab === 'payments' && <DataTableHeader query={query} setQuery={setQuery} placeholder="Search reference, participant, or split"><PaymentsTable payments={filteredPayments} /></DataTableHeader>}
        {tab === 'audit' && <AuditTable logs={auditLogs} query={query} setQuery={setQuery} />}
      </div>
    </div>
  );
}

function Overview({ splits, merchants, topMerchants, totalVolume, totalCollected, activeSplits, settledSplits, failedPayments, verifiedMerchants, setTab }: { splits: AdminSplit[]; merchants: Merchant[]; topMerchants: { merchant: Merchant; volume: number }[]; totalVolume: number; totalCollected: number; activeSplits: number; settledSplits: number; failedPayments: number; verifiedMerchants: number; setTab: (tab: AdminTab) => void }) {
  const collection = totalVolume ? Math.round((totalCollected / totalVolume) * 100) : 0;
  return <>
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4"><Kpi icon={Users} label="Organizers" value={String(new Set(splits.map((split) => split.organizer_phone)).size)} tone="blue" /><Kpi icon={Store} label="Verified merchants" value={`${verifiedMerchants}/${merchants.length}`} tone="green" /><Kpi icon={Activity} label="Active splits" value={String(activeSplits)} tone="amber" /><Kpi icon={CircleDollarSign} label="Split volume" value={formatMoney(totalVolume)} tone="orange" small /></div>
    <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-start justify-between"><div><h2 className="text-lg font-extrabold text-slate-950">Platform health</h2><p className="mt-1 text-xs text-slate-400">Live operating signals from your payment workflow</p></div><Activity className="h-5 w-5 text-primary-500" /></div><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><HealthItem label="Collection rate" value={`${collection}%`} tone="green" /><HealthItem label="Settled bills" value={String(settledSplits)} tone="blue" /><HealthItem label="Failed payments" value={String(failedPayments)} tone="red" /><HealthItem label="Total collected" value={formatMoney(totalCollected)} tone="slate" /></div><div className="mt-6 rounded-xl bg-slate-50 p-4"><div className="mb-2 flex justify-between text-xs font-semibold"><span className="text-slate-500">Money confirmed against total obligations</span><span className="text-slate-900">{collection}%</span></div><ProgressBar percent={collection} size="md" /></div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-slate-950">Top destinations</h2><p className="mt-1 text-xs text-slate-400">By split bill volume</p></div><BarChart3 className="h-5 w-5 text-slate-400" /></div><div className="space-y-3">{topMerchants.map(({ merchant, volume }, index) => <div key={merchant.id} className="flex items-center gap-3"><span className="w-4 text-xs font-bold text-slate-400">{index + 1}</span><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50"><CategoryIcon category={merchant.category} className="h-4 w-4 text-slate-600" /></div><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{merchant.display_name}</span><span className="text-xs font-bold text-slate-900">{formatMoney(volume)}</span></div>)}</div><button onClick={() => setTab('merchants')} className="mt-5 flex items-center gap-1 text-xs font-bold text-primary-600">Manage merchants <ArrowUpRight className="h-3.5 w-3.5" /></button></div>
    </div>
    <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-3"><ActionCard icon={ReceiptText} title="Review all splits" description="Filter, inspect, and close split bills" onClick={() => setTab('splits')} /><ActionCard icon={Store} title="Verify destinations" description="Keep payment routing trusted" onClick={() => setTab('merchants')} /><ActionCard icon={DollarSign} title="Monitor payments" description="Find failures and exceptions" onClick={() => setTab('payments')} /></div>
  </>;
}

function DataTableHeader({ query, setQuery, statusFilter, setStatusFilter, placeholder, filters, children }: { query: string; setQuery: (value: string) => void; statusFilter?: string; setStatusFilter?: (value: string) => void; placeholder: string; filters?: string[]; children: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-lg font-extrabold text-slate-950">{filters ? 'Split management' : 'Operations records'}</h2><p className="mt-1 text-xs text-slate-400">Search and manage live platform records.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 sm:w-72" /></div>{filters && statusFilter && setStatusFilter && <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-500"><Filter className="h-4 w-4" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-transparent py-2.5 font-semibold outline-none"><>{filters.map((filter) => <option key={filter}>{filter}</option>)}</></select></label>}</div></div><div className="mt-5">{children}</div></div>;
}

function SplitsTable({ splits, onStatusChange }: { splits: AdminSplit[]; onStatusChange: (split: AdminSplit, status: string) => Promise<void> }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><th className="pb-3 font-bold">Split</th><th className="pb-3 font-bold">Organizer</th><th className="pb-3 font-bold">Destination</th><th className="pb-3 font-bold">Settlement</th><th className="pb-3 font-bold">Status</th><th className="pb-3 text-right font-bold">Manage</th></tr></thead><tbody>{splits.map((split) => <tr key={split.id} className="border-b border-slate-50 text-sm last:border-0"><td className="py-4"><p className="font-bold text-slate-900">{split.title}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{split.ref_code}</p></td><td className="py-4"><p className="font-semibold text-slate-700">{split.organizer_name}</p><p className="text-xs text-slate-400">{split.organizer_phone}</p></td><td className="py-4 text-slate-600">{split.merchant?.display_name || 'Manual'}</td><td className="w-44 py-4"><div className="mb-1 flex justify-between text-xs"><span className="font-bold text-slate-700">{split.settlement_percent}%</span><span className="text-slate-400">{formatMoney(split.amount_paid)}</span></div><ProgressBar percent={split.settlement_percent} size="sm" /></td><td className="py-4"><StatusBadge status={split.status} /></td><td className="py-4 text-right"><select value={split.status} onChange={(event) => void onStatusChange(split, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none"><option>ACTIVE</option><option>PARTIALLY_PAID</option><option>SETTLED</option><option>EXPIRED</option><option>CANCELLED</option><option>DISPUTED</option></select></td></tr>)}</tbody></table>{splits.length === 0 && <EmptyRecords label="No matching split bills" />}</div>;
}

function MerchantsTable({ merchants, onStatusChange }: { merchants: Merchant[]; onStatusChange: (merchant: Merchant, status: string) => Promise<void> }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><th className="pb-3 font-bold">Destination</th><th className="pb-3 font-bold">Category</th><th className="pb-3 font-bold">Location</th><th className="pb-3 font-bold">Destination ID</th><th className="pb-3 font-bold">Status</th><th className="pb-3 text-right font-bold">Manage</th></tr></thead><tbody>{merchants.map((merchant) => <tr key={merchant.id} className="border-b border-slate-50 text-sm last:border-0"><td className="py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50"><CategoryIcon category={merchant.category} className="h-4 w-4 text-slate-600" /></div><div><p className="font-bold text-slate-900">{merchant.display_name}</p><p className="text-xs text-slate-400">{merchant.legal_name}</p></div></div></td><td className="py-4 capitalize text-slate-600">{merchant.category}</td><td className="py-4 text-slate-600">{merchant.city || '—'}</td><td className="py-4 font-mono text-xs text-slate-500">{merchant.destination_id}</td><td className="py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${merchant.verification_status === 'VERIFIED' || merchant.verification_status === 'ACTIVE' ? 'bg-success-50 text-success-700' : merchant.verification_status === 'SUSPENDED' ? 'bg-error-50 text-error-700' : 'bg-amber-50 text-amber-700'}`}>{merchant.verification_status}</span></td><td className="py-4 text-right"><select value={merchant.verification_status} onChange={(event) => void onStatusChange(merchant, event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700 outline-none"><option>VERIFIED</option><option>ACTIVE</option><option>PENDING_VERIFICATION</option><option>SUSPENDED</option><option>INACTIVE</option></select></td></tr>)}</tbody></table>{merchants.length === 0 && <EmptyRecords label="No matching merchants" />}</div>;
}

function PaymentsTable({ payments }: { payments: AdminPayment[] }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left"><thead><tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400"><th className="pb-3 font-bold">Participant</th><th className="pb-3 font-bold">Split</th><th className="pb-3 font-bold">Provider</th><th className="pb-3 font-bold">Amount</th><th className="pb-3 font-bold">Reference</th><th className="pb-3 font-bold">Status</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-slate-50 text-sm last:border-0"><td className="py-4"><p className="font-bold text-slate-900">{payment.participant?.name || 'Unknown participant'}</p><p className="text-xs text-slate-400">{payment.participant?.phone || 'No phone'}</p></td><td className="py-4"><p className="max-w-[180px] truncate font-semibold text-slate-700">{payment.participant?.split?.title || 'Unknown split'}</p><p className="font-mono text-[10px] text-slate-400">{payment.participant?.split?.ref_code || '—'}</p></td><td className="py-4 text-slate-600">{payment.provider}</td><td className="py-4 font-bold text-slate-900">{formatMoney(payment.amount)}</td><td className="py-4 font-mono text-xs text-slate-500">{payment.provider_tx_ref || 'Pending'}</td><td className="py-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${payment.status === 'SUCCESS' ? 'bg-success-50 text-success-700' : payment.status === 'FAILED' || payment.status === 'REVERSED' ? 'bg-error-50 text-error-700' : 'bg-amber-50 text-amber-700'}`}>{payment.status}</span></td></tr>)}</tbody></table>{payments.length === 0 && <EmptyRecords label="No payment attempts found" />}</div>;
}

function AuditTable({ logs, query, setQuery }: { logs: AuditLog[]; query: string; setQuery: (value: string) => void }) {
  const filtered = logs.filter((log) => !query || `${log.action} ${log.actor} ${log.entity_type}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold text-slate-950">Audit trail</h2><p className="mt-1 text-xs text-slate-400">Money-related and privileged actions across the platform.</p></div><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" className="rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-primary-400" /></div></div><div className="divide-y divide-slate-100">{filtered.map((log) => <div key={log.id} className="flex items-center gap-3 py-4"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600"><ScrollText className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-sm font-bold text-slate-900">{log.action.replace(/_/g, ' ')}</p><p className="mt-1 text-xs text-slate-400">{log.actor} · {log.entity_type} · {timeAgo(log.created_at)}</p></div><span className="hidden font-mono text-[10px] text-slate-400 sm:block">{log.entity_id?.slice(0, 8) || 'system'}</span></div>)}{filtered.length === 0 && <EmptyRecords label="No matching audit events" />}</div></div>;
}

function Kpi({ icon: Icon, label, value, tone, small }: { icon: typeof Users; label: string; value: string; tone: 'blue' | 'green' | 'amber' | 'orange'; small?: boolean }) {
  const tones = { blue: 'bg-primary-50 text-primary-600', green: 'bg-success-50 text-success-600', amber: 'bg-amber-50 text-amber-600', orange: 'bg-accent-50 text-accent-600' };
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon className="h-5 w-5" /></div><p className={`${small ? 'text-base' : 'text-2xl'} font-extrabold text-slate-950`}>{value}</p><p className="mt-1 text-xs font-medium text-slate-400">{label}</p></div>;
}

function HealthItem({ label, value, tone }: { label: string; value: string; tone: 'green' | 'blue' | 'red' | 'slate' }) { const colors = { green: 'text-success-600', blue: 'text-primary-600', red: 'text-error-600', slate: 'text-slate-900' }; return <div className="rounded-xl border border-slate-100 p-3"><p className={`text-xl font-extrabold ${colors[tone]}`}>{value}</p><p className="mt-1 text-[11px] text-slate-400">{label}</p></div>; }
function ActionCard({ icon: Icon, title, description, onClick }: { icon: typeof ReceiptText; title: string; description: string; onClick: () => void }) { return <button onClick={onClick} className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"><div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white"><Icon className="h-5 w-5" /></div><p className="font-extrabold text-slate-950">{title}</p><p className="mt-1 text-xs text-slate-400">{description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary-600">Open workspace <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span></button>; }
function EmptyRecords({ label }: { label: string }) { return <div className="py-12 text-center text-sm text-slate-400">{label}</div>; }
