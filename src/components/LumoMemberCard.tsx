import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Plus, ArrowUpRight, ShieldCheck, Copy, Check, Award } from 'lucide-react';
import { fetchUserCardBalance, UserCardBalance } from '../lib/ledgerApi';

interface LumoMemberCardProps {
  onOpenDeposit: () => void;
  onOpenWithdraw: () => void;
  onOpenVipShowcase: () => void;
  refreshTrigger?: number;
}

export const VIP_TIER_STYLES: Record<string, { label: string; textClass: string; badgeClass: string }> = {
  STARTER: {
    label: 'LUMO STARTER',
    textClass: 'text-blue-400',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-400/30'
  },
  GREEN: {
    label: 'LUMO GREEN',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
  },
  PRO: {
    label: 'LUMO PRO',
    textClass: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
  },
  ELITE: {
    label: 'LUMO ELITE',
    textClass: 'text-cyan-400',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30'
  },
  VVIP: {
    label: 'LUMO VVIP',
    textClass: 'text-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/30'
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
  const last4 = balanceData?.accountRef ? balanceData.accountRef.slice(-4) : '2038';

  const handleCopyAccountRef = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (balanceData?.accountRef) {
      navigator.clipboard.writeText(balanceData.accountRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto my-2 space-y-3">
      {/* 1. PHYSICAL LUMO MEMBER CARD (Exact Reference Design match) */}
      <div className="relative w-full aspect-[1.586/1] rounded-2xl p-5 sm:p-6 border border-emerald-500/40 bg-[#070C14] shadow-2xl overflow-hidden flex flex-col justify-between selection:bg-none">
        
        {/* Emerald Waves Canvas Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-90 overflow-hidden">
          <svg className="w-full h-full" viewBox="0 0 400 250" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M180 250 C 220 180, 270 120, 400 70 V 250 H 180 Z"
              fill="url(#waveGrad1)"
              opacity="0.85"
            />
            <path
              d="M140 250 C 200 160, 280 80, 400 30 V 250 H 140 Z"
              fill="url(#waveGrad2)"
              opacity="0.5"
            />
            <path
              d="M 230 250 C 280 170, 330 110, 400 90"
              stroke="#10B981"
              strokeWidth="1.5"
              opacity="0.6"
            />
            <path
              d="M 180 250 C 240 150, 310 70, 400 20"
              stroke="#059669"
              strokeWidth="2"
              opacity="0.8"
            />
            <path
              d="M 130 250 C 210 130, 290 40, 400 0"
              stroke="#34D399"
              strokeWidth="1"
              opacity="0.4"
            />
            <defs>
              <linearGradient id="waveGrad1" x1="180" y1="70" x2="400" y2="250" gradientUnits="userSpaceOnUse">
                <stop stopColor="#064E3B" stopOpacity="0.8" />
                <stop offset="1" stopColor="#022C22" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="waveGrad2" x1="140" y1="30" x2="400" y2="250" gradientUnits="userSpaceOnUse">
                <stop stopColor="#059669" stopOpacity="0.4" />
                <stop offset="1" stopColor="#064E3B" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />

        {/* CARD TOP HEADER: LOGO & LUMO MEMBER */}
        <div className="relative z-10 flex items-start justify-between">
          {/* Logo with Green O Accent */}
          <div className="flex items-center space-x-0.5">
            <span className="font-extrabold text-2xl sm:text-3xl tracking-tight text-white font-sans">LUM</span>
            <div className="relative inline-flex items-center justify-center">
              <span className="font-extrabold text-2xl sm:text-3xl tracking-tight text-white font-sans">O</span>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </div>

          {/* LUMO MEMBER Right Label */}
          <div className="text-right">
            <span className="text-[11px] sm:text-xs font-semibold tracking-widest text-slate-300 uppercase">
              LUMO MEMBER
            </span>
          </div>
        </div>

        {/* CARD MIDDLE: EMV CHIP & CONTACTLESS SYMBOL & CARD NUMBER */}
        <div className="relative z-10 my-auto pt-1">
          <div className="flex items-center space-x-3 mb-3">
            {/* Authentic Silver Metallic EMV Chip */}
            <div className="w-10 h-7 sm:w-11 sm:h-8 rounded-[5px] bg-gradient-to-tr from-slate-300 via-slate-100 to-slate-400 p-[1px] shadow-inner flex items-center justify-center border border-slate-400/50">
              <div className="w-full h-full rounded-[3px] bg-gradient-to-br from-slate-200 to-slate-400 border border-slate-500/40 p-0.5 flex flex-col justify-between">
                <div className="flex justify-between h-[30%]">
                  <div className="w-[40%] border-r border-b border-slate-600/40" />
                  <div className="w-[40%] border-l border-b border-slate-600/40" />
                </div>
                <div className="w-full h-[1px] bg-slate-600/40" />
                <div className="flex justify-between h-[30%]">
                  <div className="w-[40%] border-r border-t border-slate-600/40" />
                  <div className="w-[40%] border-l border-t border-slate-600/40" />
                </div>
              </div>
            </div>

            {/* Contactless Icon ))) */}
            <svg className="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <path d="M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
            </svg>
          </div>

          {/* Masked Card Number */}
          <div className="flex items-center justify-between">
            <div className="text-lg sm:text-xl font-mono tracking-[0.2em] font-bold text-white drop-shadow">
              •••• &nbsp;•••• &nbsp;•••• &nbsp;<span className="text-emerald-400">{last4}</span>
            </div>
            
            <button
              onClick={handleCopyAccountRef}
              className="p-1 text-slate-400 hover:text-white transition-colors"
              title="Copy Card Reference"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* CARD BOTTOM FOOTER: NAME, PHONE, TIER & BRAND CIRCLES */}
        <div className="relative z-10 flex items-end justify-between pt-1">
          {/* Cardholder Name & Phone */}
          <div>
            <div className="text-xs sm:text-sm font-bold text-white tracking-wide">
              {balanceData?.userId ? balanceData.userId.replace('user_', 'User ').replace('_101', '') : 'Ado Myamba'}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-mono tracking-wider">
              +255 7XX XXX XXX
            </div>
          </div>

          {/* Right Tier Badge & Mastercard Circles */}
          <div className="flex items-end space-x-3">
            <button
              onClick={onOpenVipShowcase}
              className="text-right group focus:outline-none"
              title="Click to view VIP Tier Benefits"
            >
              <div className={`text-[11px] sm:text-xs font-black tracking-wider uppercase ${tierStyle.textClass} flex items-center justify-end space-x-1`}>
                <span>{tierStyle.label}</span>
                <Award className="w-3 h-3 text-emerald-400" />
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-400 font-mono">
                EXP 05/29
              </div>
            </button>

            {/* Red & Orange Overlapping Circles */}
            <div className="flex items-center -space-x-2 pl-1">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#EB001B] opacity-90 shadow-md" />
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#F79E1B] opacity-90 shadow-md" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. INTEGRATED BALANCE & QUICK ACTION STRIP (Directly below the card) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Available Balance</span>
            <button
              onClick={() => setShowBalance(!showBalance)}
              className="p-1 rounded text-slate-400 hover:text-white transition-colors"
            >
              {showBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Tier Tx Counter */}
          <button
            onClick={onOpenVipShowcase}
            className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center space-x-1"
          >
            <span>{balanceData?.qualifyingTxCount || 0} Txs</span>
            <span className="text-slate-500">•</span>
            <span className="text-amber-400 font-bold">{tierStyle.label}</span>
          </button>
        </div>

        {/* Balance Amount */}
        <div className="flex items-baseline space-x-2">
          <span className="text-xs font-bold text-slate-400">TZS</span>
          <span className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {loading ? (
              <span className="animate-pulse">••••••</span>
            ) : showBalance ? (
              (balanceData?.availableBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
            ) : (
              '••••••••'
            )}
          </span>
        </div>

        {/* Action Buttons: Deposit & Withdraw */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={onOpenDeposit}
            className="py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Deposit</span>
          </button>

          <button
            onClick={onOpenWithdraw}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs sm:text-sm border border-slate-700 flex items-center justify-center space-x-2 transition-all active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
            <span>Withdraw</span>
          </button>
        </div>
      </div>
    </div>
  );
};

