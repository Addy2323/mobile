import { useState, useEffect } from 'react';
import {
  Search, Download, Share2, Receipt, Filter, CheckCircle2, Clock, Ban,
  Banknote, ArrowLeft, ArrowUpRight, Calendar, User, FileText
} from 'lucide-react';
import { supabase, type Split, type PaymentAttempt } from '@/lib/supabase';
import { formatMoney, formatDateTime, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';

type FilterType = 'ALL' | 'OPEN' | 'SETTLED' | 'EXPIRED' | 'CASH';

type ActivityViewProps = {
  onSelectSplit: (split: Split) => void;
  onBack: () => void;
};

export default function ActivityView({ onSelectSplit, onBack }: ActivityViewProps) {
  const [splits, setSplits] = useState<Split[]>([]);
  const [payments, setPayments] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [activeTab, setActiveTab] = useState<'splits' | 'payments'>('splits');
  const [toast, setToast] = useState('');

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const { data: splitsData } = await supabase.from('splits').select('*').order('created_at', { ascending: false });
    const { data: paymentsData } = await supabase.from('payment_attempts').select('*').order('requested_at', { ascending: false });
    if (splitsData) setSplits(splitsData as Split[]);
    if (paymentsData) setPayments(paymentsData as PaymentAttempt[]);
    setLoading(false);
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const filteredSplits = splits.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.ref_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.organizer_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'OPEN') return s.status === 'ACTIVE' || s.status === 'PARTIALLY_PAID';
    if (activeFilter === 'SETTLED') return s.status === 'SETTLED';
    if (activeFilter === 'EXPIRED') return s.status === 'EXPIRED' || s.status === 'CANCELLED';
    if (activeFilter === 'CASH') return s.mode === 'cash' || s.note?.toLowerCase().includes('cash');

    return true;
  });

  const filteredPayments = payments.filter((p) => {
    const matchesSearch =
      (p.provider_tx_ref || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.provider.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === 'SETTLED') return p.status === 'SUCCESS';
    if (activeFilter === 'OPEN') return p.status === 'PENDING';
    if (activeFilter === 'CASH') return p.provider.toLowerCase() === 'cash';

    return true;
  });

  function downloadReceipt(split: Split) {
    const receiptText = `
========================================
             LUMO SPLIT RECEIPT
========================================
Reference Code: ${split.ref_code}
Title:          ${split.title}
Organizer:      ${split.organizer_name}
Total Amount:   ${formatMoney(split.total_amount)}
Amount Settled: ${formatMoney(split.amount_paid)}
Status:         ${split.status}
Date Created:   ${formatDateTime(split.created_at)}
========================================
Thank you for using LUMO Split!
    `.trim();

    const blob = new Blob([receiptText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${split.ref_code}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Receipt downloaded for ${split.ref_code}`);
  }

  function shareSplit(split: Split) {
    const url = `${window.location.origin}/s/${split.ref_code}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(url);
      showToast(`Split link copied: ${url}`);
    } else {
      showToast(`Share link: ${url}`);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 animate-fade-in text-white">
      {/* Top Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            onClick={onBack}
            className="mb-2 flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" /> Dashboard
          </button>
          <h1 className="text-2xl font-black tracking-tight text-white">Activity & Transactions</h1>
          <p className="text-xs text-slate-400">Track all split bills, payment attempts, and cash entries in real-time.</p>
        </div>

        {/* Tab switch */}
        <div className="flex rounded-2xl bg-[#0C1816] border border-slate-800/80 p-1.5 shadow-xl">
          <button
            onClick={() => setActiveTab('splits')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
              activeTab === 'splits'
                ? 'bg-[#0D382E] text-[#00E599] border border-[#00E599]/40 shadow-[0_0_15px_rgba(0,229,153,0.15)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Split Bills ({splits.length})
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
              activeTab === 'payments'
                ? 'bg-[#0D382E] text-[#00E599] border border-[#00E599]/40 shadow-[0_0_15px_rgba(0,229,153,0.15)]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Payment Attempts ({payments.length})
          </button>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="mb-6 rounded-3xl border border-slate-800/80 bg-[#0C1816] p-4 sm:p-5 shadow-2xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, ref code, provider or name..."
              className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] py-2.5 pl-10 pr-4 text-xs font-medium text-white placeholder-slate-600 outline-none focus:border-[#00E599] focus:ring-1 focus:ring-[#00E599]/30"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', 'OPEN', 'SETTLED', 'EXPIRED', 'CASH'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`rounded-xl px-3 py-1.5 text-[11px] font-black transition ${
                  activeFilter === filter
                    ? 'bg-[#00E599] text-[#060D0E] shadow-[0_0_12px_rgba(0,229,153,0.25)]'
                    : 'bg-[#060D0E] border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 w-full rounded-3xl bg-[#0C1816] border border-slate-800/80 animate-pulse" />
          ))}
        </div>
      ) : activeTab === 'splits' ? (
        <div className="space-y-3">
          {filteredSplits.length === 0 ? (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-12 text-center shadow-2xl">
              <Receipt className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm font-bold text-slate-300">No split bills found</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your search or filter options.</p>
            </div>
          ) : (
            filteredSplits.map((s) => (
              <div
                key={s.id}
                onClick={() => onSelectSplit(s)}
                className="group flex flex-col gap-3 rounded-3xl border border-slate-800/80 bg-[#0C1816] p-5 transition hover:border-[#00E599]/40 hover:shadow-[0_0_20px_rgba(0,229,153,0.08)] cursor-pointer sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#081B17] border border-[#0D382E] font-bold text-[#00E599]">
                    <Receipt className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white group-hover:text-[#00E599] transition">
                        {s.title}
                      </h3>
                      <StatusBadge status={s.status} />
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>Ref: <strong className="font-mono text-white">{s.ref_code}</strong></span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {s.organizer_name}</span>
                      <span>•</span>
                      <span>{s.participant_count} people</span>
                      <span>•</span>
                      <span>{timeAgo(s.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end sm:gap-6 border-t border-slate-800/80 pt-3 sm:border-t-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-black text-white">{formatMoney(s.total_amount)}</p>
                    <p className="text-[11px] font-extrabold text-[#00E599]">
                      {formatMoney(s.amount_paid)} collected ({s.settlement_percent}%)
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        downloadReceipt(s);
                      }}
                      className="rounded-xl border border-slate-800 bg-[#060D0E] p-2 text-slate-400 hover:text-white hover:border-[#00E599]/40 transition"
                      title="Download Receipt"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        shareSplit(s);
                      }}
                      className="rounded-xl border border-slate-800 bg-[#060D0E] p-2 text-slate-400 hover:text-white hover:border-[#00E599]/40 transition"
                      title="Share Split"
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Payments Tab */
        <div className="space-y-3">
          {filteredPayments.length === 0 ? (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-12 text-center shadow-2xl">
              <Banknote className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="text-sm font-bold text-slate-300">No payment attempts found</p>
            </div>
          ) : (
            filteredPayments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-[#0C1816] p-4 shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    p.status === 'SUCCESS'
                      ? 'bg-[#081B17] text-[#00E599] border border-[#0D382E]'
                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  }`}>
                    {p.status === 'SUCCESS' ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-white">
                      {p.provider} Transaction ({p.status})
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Ref: {p.provider_tx_ref || 'Pending'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-black text-white">{formatMoney(p.amount)}</p>
                  <p className="text-[11px] text-slate-500">{timeAgo(p.requested_at)}</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#081B17] border border-[#00E599]/40 px-5 py-3 text-xs font-bold text-[#00E599] shadow-2xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}
