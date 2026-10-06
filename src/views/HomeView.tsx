import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Eye, EyeOff, RefreshCw,
  Copy, Check, Plus, ReceiptText, Users, CircleDollarSign, ChevronRight,
  ShieldCheck, Clock3, MoreHorizontal, Search,
} from 'lucide-react';
import { supabase, type Merchant, type Split } from '@/lib/supabase';
import { formatMoney, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';
import RewardsWidget from '@/components/RewardsWidget';

type HomeViewProps = {
  onSplitClick: (split: Split) => void;
  onCreate: () => void;
};

export default function HomeView({ onSplitClick, onCreate }: HomeViewProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    async function loadSplits() {
      const { data } = await supabase.from('splits').select('*, merchant:merchants(*)').order('created_at', { ascending: false });
      if (data) setSplits(data as (Split & { merchant: Merchant })[]);
      setLoading(false);
    }
    void loadSplits();
  }, []);

  const totalVolume = useMemo(() => splits.reduce((sum, split) => sum + split.total_amount, 0), [splits]);
  const totalCollected = useMemo(() => splits.reduce((sum, split) => sum + split.amount_paid, 0), [splits]);
  const pending = splits.filter((split) => split.status !== 'SETTLED').length;
  const visibleSplits = showAll ? splits : splits.slice(0, 4);
  const accountNumber = 'LUMO  121344805547';

  function copyAccount() {
    void navigator.clipboard?.writeText(accountNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="min-h-[calc(100vh-78px)] bg-[#f5f6f7] px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
      <div className="mx-auto max-w-[1190px]">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Overview</p>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Your split account</h1>
          </div>
          <button onClick={onCreate} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 sm:flex">
            <Plus className="h-4 w-4" /> Create a split
          </button>
        </div>

        <section className="rounded-[22px] bg-black p-5 text-white shadow-[0_14px_30px_-18px_rgba(0,0,0,0.45)] sm:p-7">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="mb-1 text-sm font-medium text-white/70">Confirmed contributions</p><p className="mb-3 text-xs text-white/45">Recorded payments, not a wallet balance</p>
              <div className="flex items-center gap-3">
                <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                  {hidden ? 'TZS •••••••' : formatMoney(totalCollected)}
                </p>
                <button onClick={() => setHidden((value) => !value)} className="rounded-full bg-white/10 p-2 text-white/80 transition hover:bg-white/20" aria-label="Toggle balance visibility">
                  {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-white/45">Confirmed payments across {splits.length} split bills</p>
            </div>
            <button className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-900">TZS <ChevronRight className="h-3.5 w-3.5 rotate-90" /></button>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={onCreate} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
              <ArrowUpFromLine className="h-4 w-4" /> Create split
            </button>
            <button onClick={() => document.getElementById('recent-splits')?.scrollIntoView({ behavior: 'smooth' })} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
              <ArrowDownToLine className="h-4 w-4" /> Collect a share
            </button>
            <button onClick={() => setShowAll((value) => !value)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e5e5e5] text-sm font-semibold text-slate-950 transition hover:bg-slate-100 sm:col-span-2">
              <ArrowLeftRight className="h-4 w-4" /> {showAll ? 'Hide extra splits' : 'View all split activity'}
            </button>
          </div>

          <button onClick={copyAccount} className="mt-5 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 font-mono text-[11px] font-bold text-slate-900 transition hover:bg-slate-100">
            {copied ? <Check className="h-3.5 w-3.5 text-success-600" /> : <Copy className="h-3.5 w-3.5" />}
            {accountNumber}
          </button>
        </section>

        <section className="mt-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50"><ShieldCheck className="h-4 w-4 text-slate-700" /></div>
            <div><p className="text-sm font-bold text-slate-900">Verified destination protection</p><p className="text-xs text-slate-400">Payments route through trusted partner records</p></div>
          </div>
          <div className="hidden items-center gap-2 sm:flex"><span className="h-2 w-2 rounded-full bg-success-500" /><span className="text-xs font-semibold text-slate-500">All systems operational</span></div>
        </section>

        <div className="mt-6">
          <RewardsWidget />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[1.45fr_0.85fr]">
          <section id="recent-splits" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 className="text-lg font-extrabold text-slate-950">Recent split activity</h2><p className="mt-1 text-xs text-slate-400">Keep track of every group bill in one place</p></div>
              <button onClick={() => setShowAll((value) => !value)} className="text-xs font-bold text-primary-600 hover:text-primary-700">{showAll ? 'Show less' : 'View all'}</button>
            </div>
            {loading ? <div className="h-52 rounded-xl shimmer" /> : visibleSplits.length === 0 ? <EmptyState onCreate={onCreate} /> : <div className="space-y-2.5">{visibleSplits.map((split) => <SplitRow key={split.id} split={split} onClick={() => onSplitClick(split)} />)}</div>}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-extrabold text-slate-950">Account summary</h2><p className="mt-1 text-xs text-slate-400">Your activity at a glance</p></div><MoreHorizontal className="h-5 w-5 text-slate-400" /></div>
            <div className="space-y-2.5">
              <SummaryRow icon={ReceiptText} label="Total split bills" value={splits.length.toString()} />
              <SummaryRow icon={Clock3} label="Awaiting payment" value={pending.toString()} />
              <SummaryRow icon={Users} label="People total" value={splits.reduce((sum, split) => sum + split.participant_count, 0).toString()} />
              <SummaryRow icon={CircleDollarSign} label="Total bill value" value={formatMoney(totalVolume)} />
            </div>
            <div className="mt-5 rounded-xl bg-slate-50 p-4"><div className="mb-2 flex justify-between"><span className="text-xs font-semibold text-slate-500">Overall collection</span><span className="text-xs font-bold text-slate-900">{totalVolume ? Math.round((totalCollected / totalVolume) * 100) : 0}%</span></div><ProgressBar percent={totalVolume ? Math.round((totalCollected / totalVolume) * 100) : 0} size="sm" /></div>
            <button onClick={onCreate} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 py-3 text-sm font-bold text-white transition hover:bg-slate-800"><Plus className="h-4 w-4" /> Start a new split</button>
          </section>
        </div>
      </div>
    </div>
  );
}

function SplitRow({ split, onClick }: { split: Split & { merchant?: Merchant | null }; onClick: () => void }) {
  return <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 p-3 text-left transition hover:border-slate-200 hover:bg-slate-50"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100"><CategoryIcon category={split.category} className="h-4.5 w-4.5 text-slate-600" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold text-slate-900">{split.title}</p><StatusBadge status={split.status} /></div><p className="mt-1 truncate text-xs text-slate-400">{split.merchant?.display_name || 'Verified destination'} · {split.participant_count} people total · {timeAgo(split.created_at)}</p><div className="mt-2 max-w-[220px]"><ProgressBar percent={split.settlement_percent} size="sm" /></div></div><div className="text-right"><p className="text-sm font-extrabold text-slate-900">{formatMoney(split.total_amount)}</p><p className="mt-1 text-[11px] font-semibold text-success-600">{formatMoney(split.amount_paid)} paid</p></div><ChevronRight className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-600" /></button>;
}

function SummaryRow({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50"><Icon className="h-4 w-4 text-slate-600" /></div><span className="flex-1 text-sm text-slate-500">{label}</span><span className="text-sm font-extrabold text-slate-900">{value}</span></div>;
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return <div className="py-12 text-center"><Search className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="mb-4 text-sm text-slate-500">No split activity yet.</p><button onClick={onCreate} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white">Create your first split</button></div>;
}
