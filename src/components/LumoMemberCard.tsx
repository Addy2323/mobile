import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Plus, ArrowUpRight, ShieldCheck, Sparkles, Copy, Check, Wifi, Award } from 'lucide-react';
import { fetchUserCardBalance, UserCardBalance } from '../lib/ledgerApi';

interface LumoMemberCardProps {
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenVipShowcase: () => void;
  refreshTrigger?: number;
}

export const VIP_TIER_STYLES: Record<string, { label: string; bgClass: string; badgeClass: string; accentGlow: string }> = {
  STARTER: {
    label: 'LUMO Starter',
    bgClass: 'from-slate-900 via-blue-950 to-slate-950 border-blue-500/30',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    accentGlow: 'from-blue-500/20 to-cyan-500/10'
  },
  GREEN: {
    label: 'LUMO Green',
    bgClass: 'from-slate-950 via-emerald-950 to-slate-900 border-emerald-500/30',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    accentGlow: 'from-emerald-500/20 to-teal-500/10'
  },
  PRO: {
    label: 'LUMO Pro',
    bgClass: 'from-zinc-950 via-emerald-950 to-black border-emerald-400/40 shadow-emerald-900/20',
    badgeClass: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-400/50',
    accentGlow: 'from-emerald-400/25 via-emerald-600/15 to-transparent'
  },
  ELITE: {
    label: 'LUMO Elite',
    bgClass: 'from-zinc-950 via-slate-900 to-emerald-950 border-cyan-400/40 shadow-cyan-900/20',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
    accentGlow: 'from-cyan-400/25 to-emerald-500/20'
  },
  VVIP: {
    label: 'LUMO VVIP',
    bgClass: 'from-black via-zinc-950 to-amber-950/80 border-amber-400/50 shadow-amber-900/30',
    badgeClass: 'bg-gradient-to-r from-amber-500/30 to-yellow-400/30 text-amber-200 border-amber-400/60 font-semibold',
    accentGlow: 'from-amber-400/30 via-yellow-500/20 to-emerald-500/10'
  }
};

export const LumoMemberCard: React.FC<LumoMemberCardProps> = ({
  onOpenDeposit,
  onOpenWithdraw,
  onOpenVipShowcase,
  refreshTrigger = 0
}) => {
  const [balanceData, setBalanceData] = useState<UserCardBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchUserCardBalance();
        if (mounted) setBalanceData(data);
      } catch (err) {
        console.warn('Could not load user card balance:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadData();
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const tierKey = balanceData?.tier || 'PRO';
  const tierStyle = VIP_TIER_STYLES[tierKey] || VIP_TIER_STYLES.PRO;

  const handleCopyAccountRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (balanceData?.accountRef) {
      navigator.clipboard.writeText(balanceData.accountRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-3">
      {/* CARD CONTAINER */}
      <div
        className={`relative overflow-hidden rounded-3xl p-6 sm:p-7 border bg-gradient-to-br ${tierStyle.bgClass} shadow-2xl transition-all duration-300 transform hover:scale-[1.01]`}
      >
        {/* Dynamic Background Contours & Emerald Waves */}
        <div className={`absolute -top-24 -right-24 w-72 h-72 rounded-full bg-gradient-to-br ${tierStyle.accentGlow} blur-3xl pointer-events-none opacity-80`} />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-gradient-to-tr from-emerald-500/10 to-transparent blur-3xl pointer-events-none" />

        {/* Waves SVG pattern overlay */}
        <svg
          className="absolute inset-0 w-full h-full opacity-15 pointer-events-none"
          viewBox="0 0 400 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-50 120 C 50 180, 150 40, 250 110 C 350 180, 450 60, 500 120 V250 H-50 Z"
            fill="url(#emeraldWave)"
          />
          <defs>
            <linearGradient id="emeraldWave" x1="0" y1="0" x2="400" y2="240" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" stopOpacity="0.4" />
              <stop offset="1" stopColor="#059669" stopOpacity="0.0" />
            </linearGradient>
          </defs>
        </svg>

        {/* CARD HEADER ROW */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Metallic Chip */}
            <div className="w-11 h-8 rounded-md bg-gradient-to-tr from-amber-300 via-amber-200 to-yellow-400 p-[1px] shadow-sm flex items-center justify-center">
              <div className="w-full h-full rounded-[4px] border border-amber-600/30 bg-gradient-to-br from-yellow-200/90 to-amber-400/90 flex flex-col justify-between p-1">
                <div className="w-full h-[1px] bg-amber-700/40" />
                <div className="w-full h-[1px] bg-amber-700/40" />
              </div>
            </div>

            {/* Brand Logo */}
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-black tracking-widest text-lg sm:text-xl text-white">LUMO</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Card
                </span>
              </div>
              <p className="text-[10px] text-slate-400 tracking-wider uppercase font-medium">Digital Account</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Contactless Icon */}
            <Wifi className="w-5 h-5 text-slate-400 rotate-90 transform" />
            
            {/* Tier Badge Trigger */}
            <button
              onClick={onOpenVipShowcase}
              className={`flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs border backdrop-blur-md transition-all hover:opacity-90 ${tierStyle.badgeClass}`}
              title="Click to view VIP Card Tiers"
            >
              <Award className="w-3.5 h-3.5 text-amber-300" />
              <span>{tierStyle.label}</span>
            </button>
          </div>
        </div>

        {/* ACCOUNT REFERENCE ROW */}
        <div className="relative z-10 mt-5 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-slate-300 text-xs sm:text-sm font-mono tracking-widest bg-black/40 backdrop-blur-md px-3 py-1 rounded-lg border border-white/10">
            <span>{balanceData?.accountRef || 'LUMO-••••2038'}</span>
            <button
              onClick={handleCopyAccountRef}
              className="text-slate-400 hover:text-white transition-colors"
              title="Copy Account Reference"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-medium">Tier Progress</span>
            <span className="text-xs text-emerald-400 font-semibold">{balanceData?.qualifyingTxCount || 0} Transactions</span>
          </div>
        </div>

        {/* LIVE BALANCE DISPLAY */}
        <div className="relative z-10 mt-6 pt-2 border-t border-white/10">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-medium flex items-center space-x-1">
              <span>Available Balance</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 inline" />
            </span>

            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <div className="mt-1 flex items-baseline space-x-2">
            <span className="text-sm font-semibold text-slate-400">TZS</span>
            <span className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {loading ? (
                <span className="animate-pulse">••••••</span>
              ) : showBalance ? (
                (balanceData?.availableBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
              ) : (
                '••••••••'
              )}
            </span>
          </div>

          {/* Reserved balance note if > 0 */}
          {balanceData && balanceData.reservedBalance > 0 && showBalance && (
            <div className="mt-1 flex items-center space-x-1.5 text-xs text-amber-400/90 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
              <span>TZS {balanceData.reservedBalance.toLocaleString()} reserved for pending withdrawal/bill</span>
            </div>
          )}
        </div>

        {/* QUICK ACTION BUTTONS */}
        <div className="relative z-10 mt-6 pt-4 flex items-center space-x-3">
          <button
            onClick={onOpenDeposit}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Deposit</span>
          </button>

          <button
            onClick={onOpenWithdraw}
            className="flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 backdrop-blur-md flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span>Withdraw</span>
          </button>
        </div>

        {/* FINTECH OVERLAPPING CIRCLES SECURITY LOGO */}
        <div className="absolute bottom-4 right-4 z-10 opacity-70 pointer-events-none flex items-center -space-x-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/60 mix-blend-screen blur-[0.3px]" />
          <div className="w-7 h-7 rounded-full bg-teal-400/60 mix-blend-screen blur-[0.3px]" />
        </div>
      </div>
    </div>
  );
};
