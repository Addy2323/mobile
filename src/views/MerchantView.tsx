import { useState, useEffect } from 'react';
import {
  Store, TrendingUp, Users, CheckCircle2, Clock, Download,
  ShieldCheck, Star, Phone, MapPin, Receipt,
} from 'lucide-react';
import { supabase, type Merchant, type Split } from '@/lib/supabase';
import { formatMoney, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { CategoryIcon } from '@/components/CategoryIcon';

export default function MerchantView() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [selected, setSelected] = useState<Merchant | null>(null);
  const [splits, setSplits] = useState<(Split & { participants: any[] })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMerchants();
  }, []);

  async function loadMerchants() {
    setLoading(true);
    const { data } = await supabase
      .from('merchants')
      .select('*')
      .eq('verification_status', 'VERIFIED')
      .order('display_name');
    if (data) {
      setMerchants(data as Merchant[]);
      if (data.length > 0 && !selected) {
        setSelected(data[0] as Merchant);
        loadSplits(data[0].id);
      }
    }
    setLoading(false);
  }

  async function loadSplits(merchantId: string) {
    const { data } = await supabase
      .from('splits')
      .select('*, split_participants!inner(*)')
      .eq('merchant_id', merchantId)
      .order('created_at', { ascending: false });
    if (data) setSplits(data as any);
  }

  function selectMerchant(m: Merchant) {
    setSelected(m);
    loadSplits(m.id);
  }

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-8"><div className="h-64 rounded-2xl shimmer" /></div>;
  }

  const totalVolume = splits.reduce((s, sp) => s + sp.total_amount, 0);
  const totalCollected = splits.reduce((s, sp) => s + sp.amount_paid, 0);
  const activeSplits = splits.filter((s) => s.status === 'ACTIVE' || s.status === 'PARTIALLY_PAID').length;
  const settledSplits = splits.filter((s) => s.status === 'SETTLED').length;
  const totalParticipants = splits.reduce((s, sp) => s + sp.participant_count, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Store className="h-5 w-5 text-primary-600" />
        <span className="text-sm font-semibold text-primary-600 uppercase tracking-wide">Merchant Dashboard</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6">Verified Destination Portal</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Merchant list */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Merchants</h3>
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {merchants.map((m) => (
                <button
                  key={m.id}
                  onClick={() => selectMerchant(m)}
                  className={`w-full flex items-center gap-2.5 p-2.5 rounded-lg text-left transition-all ${
                    selected?.id === m.id ? 'bg-primary-50 border border-primary-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <CategoryIcon category={m.category} className="h-4 w-4 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{m.display_name}</p>
                    <p className="text-[10px] text-slate-400">{m.city}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dashboard content */}
        <div className="lg:col-span-3 space-y-5">
          {selected && (
            <>
              {/* Merchant profile card */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
                      <CategoryIcon category={selected.category} className="h-8 w-8 text-slate-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-extrabold text-slate-900">{selected.display_name}</h2>
                      <p className="text-sm text-slate-400">{selected.legal_name}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-success-600 font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified
                        </span>
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <MapPin className="h-3 w-3" /> {selected.city}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {selected.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-medium text-slate-400 uppercase">Destination ID</p>
                    <p className="font-mono text-sm text-slate-700">{selected.destination_id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <StatBox icon={Receipt} label="Total Splits" value={splits.length.toString()} />
                  <StatBox icon={Users} label="Participants" value={totalParticipants.toString()} />
                  <StatBox icon={TrendingUp} label="Volume" value={formatMoney(totalVolume)} small />
                  <StatBox icon={CheckCircle2} label="Collected" value={formatMoney(totalCollected)} small />
                </div>
              </div>

              {/* Activity stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <Clock className="h-5 w-5 text-amber-500 mb-2" />
                  <p className="text-2xl font-extrabold text-slate-900">{activeSplits}</p>
                  <p className="text-xs text-slate-400">Active Splits</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <CheckCircle2 className="h-5 w-5 text-success-500 mb-2" />
                  <p className="text-2xl font-extrabold text-slate-900">{settledSplits}</p>
                  <p className="text-xs text-slate-400">Settled Splits</p>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 p-4">
                  <div className="h-5 mb-2 flex items-center">
                    <div className="h-2 w-8 rounded-full bg-primary-500" />
                  </div>
                  <p className="text-2xl font-extrabold text-slate-900">
                    {totalVolume > 0 ? Math.round((totalCollected / totalVolume) * 100) : 0}%
                  </p>
                  <p className="text-xs text-slate-400">Avg Settlement</p>
                </div>
              </div>

              {/* Incoming splits */}
              <div className="bg-white rounded-2xl border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">Incoming Split Activity</h3>
                  <button className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600">
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                </div>

                {splits.length === 0 ? (
                  <div className="text-center py-8">
                    <Receipt className="h-10 w-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No split activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {splits.map((sp) => (
                      <div key={sp.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-slate-900 text-sm truncate">{sp.title}</p>
                            <StatusBadge status={sp.status} />
                          </div>
                          <p className="text-xs text-slate-400">
                            by {sp.organizer_name} · {sp.participant_count} people · {timeAgo(sp.created_at)}
                          </p>
                          <div className="mt-2">
                            <ProgressBar percent={sp.settlement_percent} size="sm" />
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-slate-900 text-sm">{formatMoney(sp.total_amount)}</p>
                          <p className="text-xs text-success-600 font-medium">{formatMoney(sp.amount_paid)} paid</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon: Icon, label, value, small }: { icon: typeof Receipt; label: string; value: string; small?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-slate-50">
      <Icon className="h-4 w-4 text-slate-400 mb-1.5" />
      <p className={`font-extrabold text-slate-900 ${small ? 'text-sm' : 'text-lg'}`}>{value}</p>
      <p className="text-[10px] text-slate-400 font-medium">{label}</p>
    </div>
  );
}
