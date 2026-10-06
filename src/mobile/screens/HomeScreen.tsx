import React, { useState, useEffect } from 'react';
import {
  Plus,
  Link as LinkIcon,
  Gift,
  Users,
  ReceiptText,
  ChevronRight,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { supabase, type Split, type Merchant } from '@/lib/supabase';
import { formatMoney, timeAgo } from '@/lib/utils';
import StatusBadge from '@/components/StatusBadge';
import ProgressBar from '@/components/ProgressBar';
import { getTranslation, type Language } from '@/lib/i18n';
import { CardSkeleton } from '../components/SkeletonLoader';

export interface HomeScreenProps {
  language: Language;
  onSplitClick: (split: Split) => void;
  onCreate: () => void;
  onNavigateQuickAction?: (action: 'payLink' | 'birthday' | 'michango' | 'control') => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  language,
  onSplitClick,
  onCreate,
  onNavigateQuickAction,
}) => {
  const [splits, setSplits] = useState<(Split & { merchant?: Merchant | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  async function fetchSplits() {
    try {
      const { data, error } = await supabase
        .from('splits')
        .select('*, merchant:merchants(*)')
        .order('created_at', { ascending: false })
        .limit(6);

      if (!error && data) {
        setSplits(data as (Split & { merchant?: Merchant | null })[]);
      }
    } catch (err) {
      console.error('Error fetching home splits:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchSplits();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchSplits();
  };

  return (
    <div className="p-4 space-y-5 no-tap-highlight">
      {/* Premium Hero Card with Restaurant Background & Navy Gradient */}
      <div className="relative rounded-3xl overflow-hidden shadow-xl border border-slate-800/40 text-white min-h-[190px] flex flex-col justify-between p-6">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center z-0 transition-transform duration-700 hover:scale-105"
          style={{ backgroundImage: `url('/hero-bg.jpg')` }}
        />

        {/* 3-Stop Navy Gradient Overlay for optimal contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#07132B] via-[#0B1B40]/85 to-transparent z-[1]" />

        {/* Top Badge & Micro-Status */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-slate-900/60 backdrop-blur-md rounded-full border border-blue-400/30 text-xs font-bold text-blue-200">
            <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse" />
            <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
            <span>Instant Split Hub</span>
          </div>

          <div className="flex items-center space-x-1 text-[11px] font-medium text-blue-200/80 bg-black/30 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Protected</span>
          </div>
        </div>

        {/* Content & Action */}
        <div className="relative z-10 pt-4 space-y-3">
          <div>
            <h2 className="text-[24px] font-black tracking-tight leading-tight">
              Split{' '}
              <span className="bg-gradient-to-r from-[#60A5FA] via-[#93C5FD] to-white bg-clip-text text-transparent">
                a Bill
              </span>
            </h2>
            <p className="text-xs text-blue-100/80 mt-0.5 font-medium">
              Share dining, utilities, & group expenses seamlessly.
            </p>
          </div>

          <div className="pt-1">
            <button
              onClick={onCreate}
              className="group inline-flex items-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-[#FF6500] to-[#FF8533] text-white font-extrabold text-xs rounded-full shadow-lg shadow-black/25 active:scale-95 transition-all duration-200 hover:shadow-orange-500/25 hover:scale-[1.02]"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Split</span>
              <ArrowUpRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Action Tile Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Quick Services
          </h3>
          <span className="text-[11px] text-slate-400 font-semibold">4 Instant Actions</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Pay Link */}
          <button
            onClick={() => onNavigateQuickAction?.('payLink')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <LinkIcon className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs">Pay via Link</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Share & collect instantly</p>
            </div>
          </button>

          {/* Birthday */}
          <button
            onClick={() => onNavigateQuickAction?.('birthday')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Gift className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs">Birthday Pool</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Group gifts & celebrations</p>
            </div>
          </button>

          {/* Michango */}
          <button
            onClick={() => onNavigateQuickAction?.('michango')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs">Michango</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Community & events</p>
            </div>
          </button>

          {/* Pay Bill */}
          <button
            onClick={() => onNavigateQuickAction?.('control')}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <ReceiptText className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-xs">Pay Bills</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">LUKU, DAWASA & Control No.</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Recent Split Activity
          </h3>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1 text-xs text-indigo-600 font-bold hover:text-indigo-700 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : splits.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-3">
            <Zap className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">No active splits yet</p>
              <p className="text-xs text-slate-400">
                Create a split or share a payment link to get started!
              </p>
            </div>
            <button
              onClick={onCreate}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl active:scale-95 transition-all inline-flex items-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Split</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {splits.map((split) => (
              <div
                key={split.id}
                onClick={() => onSplitClick(split)}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-900 text-sm truncate">
                        {split.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {split.merchant?.display_name || 'Verified merchant'} · {split.participant_count} people · {timeAgo(split.created_at)}
                    </p>
                  </div>

                  <StatusBadge status={split.status as any} />
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-100/80">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-900">
                      {formatMoney(split.total_amount)}
                    </span>
                    <span className="font-bold text-emerald-600">
                      {formatMoney(split.amount_paid)} paid ({split.settlement_percent || 0}%)
                    </span>
                  </div>

                  <ProgressBar percent={split.settlement_percent || 0} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
