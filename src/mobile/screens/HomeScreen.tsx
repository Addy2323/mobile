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
import { LumoMemberCard } from '@/components/LumoMemberCard';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { VipTierShowcase } from '@/components/VipTierShowcase';
import { fetchUserCardBalance } from '@/lib/ledgerApi';
import { getOwnerId } from '@/lib/ownerId';

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
  const [receivedPayments, setReceivedPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showVipShowcase, setShowVipShowcase] = useState(false);
  const [cardRefreshTrigger, setCardRefreshTrigger] = useState(0);
  const [currentBalanceData, setCurrentBalanceData] = useState<any | null>(null);

  const t = (key: any) => getTranslation(key, language);

  const loadBalanceInfo = async () => {
    try {
      const data = await fetchUserCardBalance();
      setCurrentBalanceData(data);
    } catch (e) {
      console.warn('Balance load error:', e);
    }
  };

  useEffect(() => {
    loadBalanceInfo();
  }, [cardRefreshTrigger]);

  async function fetchActivities() {
    try {
      const ownerId = getOwnerId();
      // 1. Fetch user activities from server endpoint
      const res = await fetch(`/api/user/activities?user_id=${encodeURIComponent(ownerId)}`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.receivedPayments)) {
          setReceivedPayments(json.receivedPayments);
        }
        if (Array.isArray(json.splits) && json.splits.length > 0) {
          setSplits(json.splits);
          setLoading(false);
          setRefreshing(false);
          return;
        }
      }

      // 2. Direct Supabase query fallback for splits
      const { data, error } = await supabase
        .from('splits')
        .select('*, merchant:merchants(*)')
        .order('created_at', { ascending: false })
        .limit(6);

      if (!error && data) {
        setSplits(data as (Split & { merchant?: Merchant | null })[]);
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchActivities();
  }, [cardRefreshTrigger]);

  const handleRefresh = () => {
    setRefreshing(true);
    setCardRefreshTrigger(prev => prev + 1);
    fetchActivities();
  };

  return (
    <div className="p-4 space-y-5 no-tap-highlight">
      {/* LUMO Member Card Component */}
      <LumoMemberCard
        onOpenDeposit={() => setShowDepositModal(true)}
        onOpenWithdraw={() => setShowWithdrawModal(true)}
        onOpenVipShowcase={() => setShowVipShowcase(true)}
        refreshTrigger={cardRefreshTrigger}
      />

      {/* Modals */}
      {showDepositModal && (
        <DepositModal
          onClose={() => setShowDepositModal(false)}
          onSuccess={() => {
            setShowDepositModal(false);
            setCardRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {showWithdrawModal && (
        <WithdrawModal
          availableBalance={currentBalanceData?.availableBalance || 0}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            setCardRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {showVipShowcase && (
        <VipTierShowcase
          currentTier={currentBalanceData?.tier || 'STARTER'}
          txCount={currentBalanceData?.qualifyingTxCount || 0}
          onClose={() => setShowVipShowcase(false)}
        />
      )}

      {/* Quick Action Tile Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Quick Services
          </h3>
          <span className="text-[11px] text-slate-500 font-semibold">5 Instant Actions</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Split a Bill */}
          <button
            onClick={onCreate}
            className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800 hover:border-[#00E599]/40 active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-[#0A2620] text-[#00E599] border border-[#00E599]/20 rounded-xl group-hover:bg-[#00E599] group-hover:text-[#05110E] transition-colors">
                <Plus className="w-5 h-5 stroke-[2.8]" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#00E599] transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">Split a Bill</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Dining & shared expenses</p>
            </div>
          </button>

          {/* Pay Link */}
          <button
            onClick={() => onNavigateQuickAction?.('payLink')}
            className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800 hover:border-[#00E599]/40 active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-[#0D1F2D] text-cyan-400 border border-cyan-500/20 rounded-xl group-hover:bg-cyan-400 group-hover:text-[#05110E] transition-colors">
                <LinkIcon className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">Pay via Link</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Share & collect instantly</p>
            </div>
          </button>

          {/* Birthday */}
          <button
            onClick={() => onNavigateQuickAction?.('birthday')}
            className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800 hover:border-[#00E599]/40 active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-[#1E112A] text-purple-400 border border-purple-500/20 rounded-xl group-hover:bg-purple-400 group-hover:text-[#05110E] transition-colors">
                <Gift className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">Birthday Pool</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Group gifts & celebrations</p>
            </div>
          </button>

          {/* Michango */}
          <button
            onClick={() => onNavigateQuickAction?.('michango')}
            className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800 hover:border-[#00E599]/40 active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-[#0A2620] text-[#00E599] border border-[#00E599]/20 rounded-xl group-hover:bg-[#00E599] group-hover:text-[#05110E] transition-colors">
                <Users className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#00E599] transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">Michango</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Community & events</p>
            </div>
          </button>

          {/* Pay Bill */}
          <button
            onClick={() => onNavigateQuickAction?.('control')}
            className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800 hover:border-[#00E599]/40 active:scale-95 transition-all text-left flex flex-col justify-between space-y-3 group shadow-md"
          >
            <div className="flex items-center justify-between">
              <div className="p-2.5 bg-[#251A0B] text-amber-400 border border-amber-500/20 rounded-xl group-hover:bg-amber-400 group-hover:text-[#05110E] transition-colors">
                <ReceiptText className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-xs">Pay Bills</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">LUKU, DAWASA & Control No.</p>
            </div>
          </button>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Recent Split Activity
          </h3>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center space-x-1 text-xs text-[#00E599] font-bold hover:text-[#52ffc2] active:scale-95 transition-all"
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
        ) : (
          <div className="space-y-3">
            {/* Incoming Received Link & Pool Payments */}
            {receivedPayments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] font-bold text-[#00E599] uppercase tracking-wider">
                    Incoming Contributions & Links
                  </span>
                  <span className="text-[10px] bg-[#0A2620] text-[#00E599] font-extrabold px-2 py-0.5 rounded-full border border-[#00E599]/30">
                    +{receivedPayments.length} credited
                  </span>
                </div>

                {receivedPayments.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#0C1518] p-3.5 rounded-2xl border border-slate-800 shadow-md flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-xl bg-[#0A2620] text-[#00E599] flex items-center justify-center font-bold text-sm">
                        💰
                      </div>
                      <div>
                        <div className="flex items-center space-x-1.5">
                          <span className="font-extrabold text-white text-xs">{p.payer_name}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#0A2620] text-[#00E599] font-bold uppercase border border-[#00E599]/20">
                            {p.link_type?.replace('_', ' ')}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {p.payer_phone} · {timeAgo(p.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-[#00E599] block">+{formatMoney(Number(p.amount))}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{p.provider_tx_ref}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Splits Activity */}
            {splits.length === 0 && receivedPayments.length === 0 ? (
              <div className="bg-[#0C1518] p-8 rounded-3xl border border-slate-800 text-center space-y-3">
                <Zap className="w-8 h-8 text-[#00E599]/60 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-white">No active splits yet</p>
                  <p className="text-xs text-slate-400">
                    Create a split or share a payment link to get started!
                  </p>
                </div>
                <button
                  onClick={onCreate}
                  className="px-4 py-2.5 bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] text-xs font-extrabold rounded-full active:scale-95 transition-all inline-flex items-center space-x-1.5 shadow-[0_0_15px_rgba(0,229,153,0.3)]"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                  <span>Create First Split</span>
                </button>
              </div>
            ) : splits.length > 0 ? (
              <div className="space-y-2.5">
                {splits.map((split) => (
                  <div
                    key={split.id}
                    onClick={() => onSplitClick(split)}
                    className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800 hover:border-[#00E599]/40 active:scale-[0.99] transition-all cursor-pointer space-y-2.5 shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-extrabold text-white text-sm truncate">
                            {split.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">
                          {split.merchant?.display_name || 'Verified merchant'} · {split.participant_count} people · {timeAgo(split.created_at)}
                        </p>
                      </div>

                      <StatusBadge status={split.status as any} />
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold text-white">
                          {formatMoney(split.total_amount)}
                        </span>
                        <span className="font-bold text-[#00E599]">
                          {formatMoney(split.amount_paid)} paid ({split.settlement_percent || 0}%)
                        </span>
                      </div>

                      <ProgressBar percent={split.settlement_percent || 0} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
