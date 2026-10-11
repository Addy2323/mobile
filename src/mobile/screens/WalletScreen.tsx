import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Users,
  Receipt,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Filter
} from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';
import { LumoBalanceActionsWidget } from '@/components/LumoMemberCard';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { VipTierShowcase } from '@/components/VipTierShowcase';
import { fetchUserCardBalance, fetchLedgerTransactions, type LedgerTransaction, type UserCardBalance } from '@/lib/ledgerApi';

interface WalletScreenProps {
  language: Language;
}

type FilterType = 'ALL' | 'IN' | 'OUT' | 'PENDING';

export const WalletScreen: React.FC<WalletScreenProps> = ({ language }) => {
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showVipShowcase, setShowVipShowcase] = useState(false);
  const [cardRefreshTrigger, setCardRefreshTrigger] = useState(0);
  const [balanceData, setBalanceData] = useState<UserCardBalance | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');

  const t = (key: any) => getTranslation(key, language);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [balance, txs] = await Promise.all([
        fetchUserCardBalance().catch(() => null),
        fetchLedgerTransactions().catch(() => [])
      ]);
      if (balance) setBalanceData(balance);
      setTransactions(txs || []);
    } catch (e) {
      console.error('Failed to load wallet data:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [cardRefreshTrigger, loadData]);

  const filteredTransactions = transactions.filter(tx => {
    if (filter === 'IN') return tx.direction === 'CREDIT';
    if (filter === 'OUT') return tx.direction === 'DEBIT';
    if (filter === 'PENDING') return tx.status === 'PENDING' || tx.status === 'PENDING_REVIEW' || tx.status === 'PROCESSING';
    return true;
  });

  const formatTxDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (isToday) return `Today, ${timeStr}`;

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${timeStr}`;

      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  };

  const getTxDetails = (tx: LedgerTransaction) => {
    const isCredit = tx.direction === 'CREDIT';
    const type = (tx.transaction_type || '').toUpperCase();

    if (type === 'SPLIT_COLLECTION' || tx.reference_type === 'SPLIT') {
      const participant = tx.metadata?.participant_name || 'Participant';
      const splitTitle = tx.metadata?.split_title || 'Bill Split';
      return {
        title: `Contribution: ${participant}`,
        subtitle: `${splitTitle}`,
        icon: Users,
        iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
        badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
      };
    }

    if (type.includes('DEPOSIT') || tx.reference_type === 'DEPOSIT') {
      const phone = tx.metadata?.phone ? `(${tx.metadata.phone})` : '';
      return {
        title: 'Deposit via Mobile Money',
        subtitle: `Wallet Top-up ${phone}`.trim(),
        icon: ArrowDownLeft,
        iconBg: 'bg-blue-50 text-blue-600 border border-blue-100',
        badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
      };
    }

    if (type.includes('WITHDRAW') || tx.reference_type === 'WITHDRAWAL') {
      const dest = tx.metadata?.destination_type === 'BANK' ? 'Bank Account' : 'Mobile Money';
      return {
        title: 'Withdrawal to Account',
        subtitle: `Payout to ${dest}`,
        icon: ArrowUpRight,
        iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
        badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
      };
    }

    if (type.includes('BILL') || type.includes('PAYMENT')) {
      return {
        title: 'Bill Settlement',
        subtitle: tx.metadata?.biller || 'Merchant Payment',
        icon: Receipt,
        iconBg: 'bg-purple-50 text-purple-600 border border-purple-100',
        badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
      };
    }

    return {
      title: isCredit ? 'Credit Transaction' : 'Debit Transaction',
      subtitle: tx.reference_id || 'Wallet Adjustment',
      icon: Wallet,
      iconBg: isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600',
      badgeColor: 'bg-slate-50 text-slate-700 border-slate-200'
    };
  };

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s === 'COMPLETED' || s === 'SUCCESS' || s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>Success</span>
        </span>
      );
    }
    if (s === 'PENDING' || s === 'PENDING_REVIEW' || s === 'PROCESSING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 animate-pulse">
          <Clock className="w-2.5 h-2.5" />
          <span>Pending</span>
        </span>
      );
    }
    if (s === 'FAILED' || s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">
          <XCircle className="w-2.5 h-2.5" />
          <span>Failed</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
        <AlertCircle className="w-2.5 h-2.5" />
        <span>{status}</span>
      </span>
    );
  };

  return (
    <div className="p-4 space-y-5 no-tap-highlight pb-24">
      {/* 1. LUMO Card Available Balance & Action Strip */}
      <LumoBalanceActionsWidget
        onOpenDeposit={() => setShowDepositModal(true)}
        onOpenWithdraw={() => setShowWithdrawModal(true)}
        onOpenVipShowcase={() => setShowVipShowcase(true)}
        refreshTrigger={cardRefreshTrigger}
      />

      {/* Financial Modals */}
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
          availableBalance={balanceData?.availableBalance || 0}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            setCardRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {showVipShowcase && (
        <VipTierShowcase
          currentTier={balanceData?.tier || 'STARTER'}
          txCount={balanceData?.qualifyingTxCount || 0}
          onClose={() => setShowVipShowcase(false)}
        />
      )}

      {/* 2. Recent Wallet Activity Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>Recent Activity</span>
              <span className="text-[11px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                {transactions.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium">Real-time deposits, splits & payouts</p>
          </div>

          <button
            onClick={() => loadData()}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors active:scale-95 flex items-center justify-center disabled:opacity-50"
            title="Refresh transactions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {(
            [
              { key: 'ALL', label: 'All' },
              { key: 'IN', label: 'Received (+)' },
              { key: 'OUT', label: 'Spent (-)' },
              { key: 'PENDING', label: 'Pending' }
            ] as const
          ).map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap active:scale-95 ${
                filter === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200/70 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-2xl mx-auto flex items-center justify-center text-slate-400">
              <Wallet className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h4 className="font-extrabold text-slate-800 text-sm">No wallet activity yet</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                When you deposit funds, receive split contributions, or request withdrawals, they will appear here live.
              </p>
            </div>
            <button
              onClick={() => setShowDepositModal(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20 active:scale-95 transition-all"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Make First Deposit</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map(tx => {
              const details = getTxDetails(tx);
              const Icon = details.icon;
              const isCredit = tx.direction === 'CREDIT';

              return (
                <div
                  key={tx.id}
                  className="bg-white p-3.5 rounded-2xl border border-slate-100/90 shadow-sm hover:border-slate-200 transition-all flex items-center justify-between gap-3 group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${details.iconBg}`}>
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-xs truncate max-w-[170px]">
                          {details.title}
                        </h4>
                        {getStatusBadge(tx.status)}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate max-w-[200px] font-medium">
                        {details.subtitle}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {formatTxDate(tx.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`text-xs font-black block tracking-tight ${
                        isCredit ? 'text-emerald-600' : 'text-slate-800'
                      }`}
                    >
                      {isCredit ? '+' : '-'} TZS {formatMoney(tx.amount)}
                    </span>
                    {tx.provider_tx_ref && (
                      <span className="text-[9px] font-mono text-slate-400 truncate block max-w-[85px]">
                        {tx.provider_tx_ref}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
