import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye, EyeOff, Plus, ArrowUpRight, ShieldCheck, Copy, Check,
  Zap, Users, Link as LinkIcon, Gift, ArrowDownLeft, ChevronRight,
  TrendingUp, Award, Clock, ArrowRight, BarChart2, Crown, FileText,
} from 'lucide-react';
import { supabase, type Split, type Merchant } from '@/lib/supabase';
import { formatMoney, timeAgo } from '@/lib/utils';
import { fetchUserCardBalance, fetchLedgerTransactions, fetchUserSplits, type UserCardBalance, type LedgerTransaction } from '@/lib/ledgerApi';
import { DepositModal } from '@/components/DepositModal';
import { WithdrawModal } from '@/components/WithdrawModal';
import { VipTierShowcase } from '@/components/VipTierShowcase';

type HomeViewProps = {
  onSplitClick: (split: Split) => void;
  onCreate: () => void;
  onNavigateQuickAction?: (action: 'payLink' | 'birthday' | 'michango' | 'control') => void;
};

export default function HomeView({ onSplitClick, onCreate, onNavigateQuickAction }: HomeViewProps) {
  const [balanceData, setBalanceData] = useState<UserCardBalance | null>(null);
  const [ledgerTxs, setLedgerTxs] = useState<LedgerTransaction[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [copied, setCopied] = useState(false);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showVipShowcase, setShowVipShowcase] = useState(false);
  const [cardRefreshTrigger, setCardRefreshTrigger] = useState(0);

  // Dynamic user name and phone from localStorage
  const getCardholderName = () => {
    if (typeof window === 'undefined') return 'LUMO Member';
    try {
      const userStr = localStorage.getItem('lumo_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.full_name || parsed.name) return parsed.full_name || parsed.name;
      }
      const raw = localStorage.getItem('lumo_user_name');
      if (raw && !raw.startsWith('user_') && !/\d/.test(raw) && raw.trim().length > 1) {
        return raw.trim();
      }
    } catch (e) {}
    return 'LUMO Member';
  };

  const getCardholderPhone = () => {
    if (typeof window === 'undefined') return '';
    try {
      const userStr = localStorage.getItem('lumo_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.phone) return parsed.phone;
      }
    } catch (e) {}
    const raw = localStorage.getItem('lumo_user_phone');
    if (!raw) return '';
    if (raw.startsWith('+')) return raw;
    return `+255 ${raw.replace(/^0/, '').slice(0, 3)} XXX XXX`;
  };

  const [cardholderName] = useState(getCardholderName);
  const [cardholderPhone] = useState(getCardholderPhone);

  const loadData = async () => {
    try {
      setLoading(true);
      const [bal, txs, splitRes] = await Promise.allSettled([
        fetchUserCardBalance(),
        fetchLedgerTransactions(),
        fetchUserSplits(),
      ]);

      if (bal.status === 'fulfilled') setBalanceData(bal.value);
      if (txs.status === 'fulfilled') setLedgerTxs(txs.value || []);
      if (splitRes.status === 'fulfilled' && splitRes.value) {
        setSplits(splitRes.value as any);
      }
    } catch (e) {
      console.warn('Dashboard data load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [cardRefreshTrigger]);

  const last4 = useMemo(() => {
    if (balanceData?.accountRef) {
      const clean = balanceData.accountRef.replace(/\D/g, '');
      if (clean.length >= 4) return clean.slice(-4);
    }
    return '••••';
  }, [balanceData]);

  const availableBalance = balanceData?.availableBalance ?? 0;
  const pendingBalance = balanceData?.pendingBalance ?? 0;
  const reservedBalance = balanceData?.reservedBalance ?? 0;
  const totalCollected = balanceData?.totalCredits ?? (splits.reduce((sum, s) => sum + (s.amount_paid || 0), 0) || 0);
  const txCount = balanceData?.qualifyingTxCount ?? (ledgerTxs.length || splits.length || 0);
  const tierName = balanceData?.tier || 'PRO';

  // Format currency helpers
  const formatTZS = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#060D0E] text-slate-100 p-6 lg:p-8 no-tap-highlight font-sans">
      <div className="max-w-[1360px] mx-auto space-y-6">

        {/* =========================================================================
            ROW 1: TWO MAIN CARDS (LUMO Member Card & Available Balance Card)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* LEFT: LUMO MEMBER VIRTUAL CARD */}
          <div className="relative rounded-[26px] bg-[#071312] p-7 overflow-hidden border border-[#00E599]/30 shadow-[0_0_30px_rgba(0,229,153,0.12)] flex flex-col justify-between min-h-[270px]">
            {/* Background SVG Wave Ribbon Graphics */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-90">
              <svg
                className="w-full h-full object-cover"
                viewBox="0 0 500 300"
                preserveAspectRatio="none"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Emerald fluid wave ribbons */}
                <path
                  d="M 240 300 C 320 200, 390 110, 500 40 L 500 300 Z"
                  fill="url(#cardWaveGrad1)"
                  opacity="0.85"
                />
                <path
                  d="M 180 300 C 270 170, 350 70, 500 0 L 500 300 Z"
                  fill="url(#cardWaveGrad2)"
                  opacity="0.5"
                />
                <path
                  d="M 280 300 C 340 190, 420 100, 500 30"
                  stroke="#00E599"
                  strokeWidth="2.5"
                  opacity="0.9"
                />
                <path
                  d="M 230 300 C 300 180, 380 90, 500 15"
                  stroke="#059669"
                  strokeWidth="1.5"
                  opacity="0.75"
                />
                <path
                  d="M 180 300 C 260 160, 340 50, 500 0"
                  stroke="#34D399"
                  strokeWidth="1"
                  opacity="0.45"
                />
                <defs>
                  <linearGradient id="cardWaveGrad1" x1="240" y1="100" x2="500" y2="300" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#064E3B" stopOpacity="0.8" />
                    <stop offset="1" stopColor="#022C22" stopOpacity="0.95" />
                  </linearGradient>
                  <linearGradient id="cardWaveGrad2" x1="180" y1="40" x2="500" y2="300" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#059669" stopOpacity="0.4" />
                    <stop offset="1" stopColor="#064E3B" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            {/* Subtle corner glow */}
            <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Top Header of Card */}
            <div className="relative z-10 flex items-start justify-between">
              {/* LUMO Logo with Green Circle */}
              <div className="flex items-center space-x-1">
                <span className="text-3xl font-black tracking-tight text-white font-sans">LUM</span>
                <div className="relative inline-flex items-center justify-center">
                  <span className="text-3xl font-black tracking-tight text-white font-sans">O</span>
                  <span className="absolute inset-0 m-auto w-3 h-3 rounded-full border-[3px] border-[#00E599] bg-transparent" />
                </div>
              </div>

              {/* LUMO MEMBER label */}
              <span className="text-xs font-semibold tracking-widest text-slate-300 uppercase">
                LUMO MEMBER
              </span>
            </div>

            {/* Middle: EMV Chip + Contactless + Masked Number */}
            <div className="relative z-10 my-auto py-2">
              <div className="flex items-center space-x-3.5 mb-3.5">
                {/* Silver/Gold EMV Chip Graphic */}
                <div className="w-11 h-8 rounded-[6px] bg-gradient-to-tr from-amber-200 via-amber-100 to-amber-300 p-[1px] shadow-inner flex items-center justify-center border border-amber-400/60">
                  <div className="w-full h-full rounded-[4px] bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 border border-amber-400/50 p-0.5 flex flex-col justify-between">
                    <div className="flex justify-between h-[30%]">
                      <div className="w-[40%] border-r border-b border-amber-600/40" />
                      <div className="w-[40%] border-l border-b border-amber-600/40" />
                    </div>
                    <div className="w-full h-[1px] bg-amber-600/40" />
                    <div className="flex justify-between h-[30%]">
                      <div className="w-[40%] border-r border-t border-amber-600/40" />
                      <div className="w-[40%] border-l border-t border-amber-600/40" />
                    </div>
                  </div>
                </div>

                {/* Contactless symbol ))) */}
                <svg className="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <path d="M12 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" fill="currentColor" />
                </svg>
              </div>

              {/* Masked Card Number */}
              <div className="text-xl sm:text-2xl font-mono tracking-[0.25em] font-bold text-white drop-shadow-md">
                •••• &nbsp;•••• &nbsp;•••• &nbsp;<span className="text-white">{last4}</span>
              </div>
            </div>

            {/* Bottom: Cardholder Name, Phone & Tier / Mastercard Badge */}
            <div className="relative z-10 flex items-end justify-between pt-1">
              <div>
                <p className="text-sm font-bold text-white tracking-wide">
                  {cardholderName}
                </p>
                <p className="text-xs text-slate-400 font-mono tracking-wider mt-0.5">
                  {cardholderPhone}
                </p>
              </div>

              <div className="flex flex-col items-end">
                <div className="text-right mb-1">
                  <span className="text-xs font-black text-[#00E599] uppercase tracking-wider block">
                    LUMO {tierName}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    EXP 05/29
                  </span>
                </div>

                {/* Mastercard Overlapping Circles */}
                <div className="flex items-center -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-[#EB001B] shadow-sm" />
                  <div className="w-6 h-6 rounded-full bg-[#FF5F00] opacity-90 shadow-sm" />
                </div>
              </div>
            </div>
          </div>


          {/* RIGHT: AVAILABLE BALANCE & STATS CARD */}
          <div className="bg-[#0C1518] border border-slate-800/90 rounded-[26px] p-7 flex flex-col justify-between shadow-xl">
            {/* Top Row: Available Balance Header with Eye Toggle */}
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-300">
                  Available Balance
                </span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-slate-400 hover:text-white transition-colors"
                  title="Toggle balance visibility"
                >
                  {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>

              {/* Main Balance Display */}
              <div className="mt-3">
                <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-sans">
                  {showBalance ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-bold mr-2 text-slate-200">TZS</span>
                      <span>{formatTZS(availableBalance)}</span>
                    </>
                  ) : (
                    <span>TZS ••••••••</span>
                  )}
                </h2>
              </div>

              {/* Sub-Metrics: Pending, Reserved, Total Collected */}
              <div className="grid grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-800/80">
                <div>
                  <p className="text-xs text-slate-400 font-medium">Pending</p>
                  <p className="text-sm font-bold text-white mt-1">
                    TZS {formatTZS(pendingBalance)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-medium">Reserved</p>
                  <p className="text-sm font-bold text-white mt-1">
                    TZS {formatTZS(reservedBalance)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-400 font-medium">Total Collected</p>
                  <p className="text-sm font-bold text-[#00E599] mt-1">
                    TZS {formatTZS(totalCollected)}
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom Row: Membership Tier & Transaction Count */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-5 border-t border-slate-800/80">
              {/* Membership Tier */}
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Crown className="w-5 h-5 fill-amber-400/20" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Membership Tier</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-sm font-bold text-white">LUMO {tierName.charAt(0) + tierName.slice(1).toLowerCase()}</span>
                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-[#0A2620] text-[#00E599] border border-[#00E599]/30">
                      {tierName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Transaction Count */}
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Transaction Count</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {txCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>


        {/* =========================================================================
            ROW 2: ACTION BUTTONS (Deposit, Withdraw, View Transactions)
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* 1. Deposit Button */}
          <button
            onClick={() => setShowDepositModal(true)}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-bold text-sm flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(0,229,153,0.3)] hover:brightness-105 active:scale-[0.98] transition-all"
          >
            <div className="w-5 h-5 rounded-full border-2 border-[#05110E] flex items-center justify-center font-black text-xs">
              +
            </div>
            <span>Deposit</span>
          </button>

          {/* 2. Withdraw Button */}
          <button
            onClick={() => setShowWithdrawModal(true)}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#0C1B18] border border-[#00E599]/30 text-white font-bold text-sm flex items-center justify-center space-x-2 hover:bg-[#0E2822] active:scale-[0.98] transition-all"
          >
            <ArrowDownLeft className="w-4 h-4 text-[#00E599]" />
            <span>Withdraw</span>
          </button>

          {/* 3. View Transactions Button */}
          <button
            onClick={() => {
              const recentElem = document.getElementById('recent-transactions-section');
              if (recentElem) recentElem.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-[#0C1518] border border-slate-800 text-white font-bold text-sm flex items-center justify-center space-x-2 hover:border-slate-700 active:scale-[0.98] transition-all"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>View Transactions</span>
          </button>
        </div>


        {/* =========================================================================
            ROW 3: BOTTOM GRID (Left: Quick Actions + Recent Txs, Right: Level Up Card)
           ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.9fr] gap-6 items-start">
          
          {/* LEFT COLUMN: Quick Actions & Recent Transactions */}
          <div className="space-y-6">
            
            {/* 1. Quick Actions */}
            <div>
              <h3 className="text-sm font-bold text-slate-200 mb-3 px-1">
                Quick Actions
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                {/* Pay Bills */}
                <button
                  onClick={() => onNavigateQuickAction?.('control')}
                  className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800/90 hover:border-cyan-500/40 text-left flex flex-col justify-between space-y-3 group transition-all active:scale-95 shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 fill-cyan-400/20" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Pay Bills</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">Electricity, water & more</p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>

                {/* Create Split */}
                <button
                  onClick={onCreate}
                  className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800/90 hover:border-purple-500/40 text-left flex flex-col justify-between space-y-3 group transition-all active:scale-95 shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Create Split</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">Share costs with friends</p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>

                {/* Payment Links */}
                <button
                  onClick={() => onNavigateQuickAction?.('payLink')}
                  className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800/90 hover:border-[#00E599]/40 text-left flex flex-col justify-between space-y-3 group transition-all active:scale-95 shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#0A2620] text-[#00E599] border border-[#00E599]/20 flex items-center justify-center">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Payment Links</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">Get paid easily</p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#00E599] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>

                {/* Send Gift */}
                <button
                  onClick={() => onNavigateQuickAction?.('birthday')}
                  className="bg-[#0C1518] p-4 rounded-2xl border border-slate-800/90 hover:border-pink-500/40 text-left flex flex-col justify-between space-y-3 group transition-all active:scale-95 shadow-md"
                >
                  <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20 flex items-center justify-center">
                    <Gift className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">Send Gift</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">Make someone's day</p>
                  </div>
                  <div className="flex justify-end pt-1">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-pink-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Recent Transactions Section */}
            <div id="recent-transactions-section" className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-200">
                  Recent Transactions
                </h3>
                <button
                  onClick={() => onNavigateQuickAction?.('control')}
                  className="text-xs font-bold text-slate-400 hover:text-[#00E599] transition-colors flex items-center space-x-1"
                >
                  <span>View All</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Transactions List Container */}
              <div className="bg-[#0C1518] border border-slate-800/90 rounded-2xl p-3.5 space-y-2.5 shadow-md">
                {ledgerTxs.length > 0 ? (
                  ledgerTxs.slice(0, 5).map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl bg-[#081013] border border-slate-800/60 flex items-center justify-between hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                          tx.direction === 'CREDIT' ? 'bg-emerald-500/20 text-[#00E599]' : 'bg-red-500/20 text-red-400'
                        }`}>
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {tx.metadata?.title || tx.reference_type?.replace(/_/g, ' ') || 'Ledger Transaction'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {timeAgo(tx.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className={`text-xs font-black ${
                          tx.direction === 'CREDIT' ? 'text-[#00E599]' : 'text-slate-200'
                        }`}>
                          {tx.direction === 'CREDIT' ? '+' : '-'} TZS {formatTZS(Number(tx.amount))}
                        </p>
                        <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          {tx.status || 'Completed'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : splits.length > 0 ? (
                  splits.slice(0, 5).map((split) => (
                    <div
                      key={split.id}
                      onClick={() => onSplitClick(split)}
                      className="p-3 rounded-xl bg-[#081013] border border-slate-800/60 flex items-center justify-between hover:border-[#00E599]/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-[#00E599] flex items-center justify-center font-bold">
                          <ArrowDownLeft className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">
                            {split.title}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {timeAgo(split.created_at)} · {split.participant_count} people
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-xs font-black text-[#00E599]">
                          + TZS {formatTZS(split.amount_paid || split.total_amount)}
                        </p>
                        <span className="inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                          {split.status === 'SETTLED' ? 'Completed' : 'Active'}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  /* Clean Empty State for New Registered Users (No Dummy Data) */
                  <div className="py-8 text-center space-y-2">
                    <Clock className="w-7 h-7 text-slate-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-300">No transactions yet</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Deposit funds or create your first split bill to start recording activity.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>


          {/* RIGHT COLUMN: LEVEL UP YOUR CARD SHOWCASE CARD */}
          <div className="bg-[#0C1518] border border-slate-800/90 rounded-[26px] p-6 relative overflow-hidden flex flex-col justify-between min-h-[340px] shadow-xl group">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Left Content */}
            <div className="relative z-10 max-w-[240px]">
              {/* Crown Icon */}
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                <Crown className="w-5 h-5 fill-amber-400/20" />
              </div>

              {/* Title & Description */}
              <h3 className="text-lg font-extrabold text-white mt-4 tracking-tight">
                Level Up Your Card
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Use LUMO more and unlock exclusive tiers with better benefits, more limits and premium features.
              </p>

              {/* Learn More Button */}
              <button
                onClick={() => setShowVipShowcase(true)}
                className="mt-6 inline-flex items-center space-x-1.5 px-4 py-2 rounded-full bg-[#0A2620] border border-[#00E599]/30 text-[#00E599] text-xs font-bold hover:bg-[#00E599] hover:text-[#05110E] transition-all active:scale-95 shadow-sm"
              >
                <span>Learn More</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Right Visual: 3D Angled Fan Card Stack (Matches Screenshot 1:1) */}
            <div className="absolute right-[-20px] top-[25px] bottom-[-20px] w-[210px] pointer-events-none flex items-center justify-center">
              <div className="relative w-full h-[260px]">
                {/* 1. Starter Tier (Blue Card) */}
                <div
                  className="absolute right-12 top-4 w-[160px] h-[100px] rounded-xl bg-gradient-to-br from-blue-700 to-indigo-900 border border-blue-400/30 p-2.5 shadow-2xl transition-transform duration-500"
                  style={{ transform: 'rotate(12deg)' }}
                >
                  <span className="text-[9px] font-bold text-blue-200">Starter</span>
                </div>

                {/* 2. Green Tier (Emerald Card) */}
                <div
                  className="absolute right-8 top-16 w-[160px] h-[100px] rounded-xl bg-gradient-to-br from-emerald-600 to-teal-900 border border-emerald-400/30 p-2.5 shadow-2xl transition-transform duration-500"
                  style={{ transform: 'rotate(16deg)' }}
                >
                  <div className="flex items-center space-x-1">
                    <span className="text-[9px] font-bold text-emerald-200">Green</span>
                  </div>
                </div>

                {/* 3. Pro Tier (Dark Green Card) */}
                <div
                  className="absolute right-4 top-28 w-[160px] h-[100px] rounded-xl bg-gradient-to-br from-[#0B2E24] to-[#041712] border border-[#00E599]/40 p-2.5 shadow-2xl transition-transform duration-500"
                  style={{ transform: 'rotate(20deg)' }}
                >
                  <span className="text-[9px] font-bold text-[#00E599]">Pro</span>
                </div>

                {/* 4. Elite Tier (Front Golden/Titanium Card) */}
                <div
                  className="absolute right-0 top-40 w-[170px] h-[110px] rounded-xl bg-gradient-to-br from-[#1A1813] via-[#2A2315] to-[#12100C] border-2 border-amber-400/60 p-3 shadow-[0_10px_35px_rgba(0,0,0,0.8)] transition-transform duration-500"
                  style={{ transform: 'rotate(24deg)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1 text-amber-300">
                      <Crown className="w-3.5 h-3.5 fill-amber-400" />
                      <span className="text-[10px] font-black tracking-wider text-amber-200 uppercase">LUMO</span>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-[9px] text-amber-400 font-mono tracking-widest block">ELITE</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* =========================================================================
          MODALS
         ========================================================================= */}
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
          availableBalance={availableBalance}
          onClose={() => setShowWithdrawModal(false)}
          onSuccess={() => {
            setShowWithdrawModal(false);
            setCardRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {showVipShowcase && (
        <VipTierShowcase
          currentTier={balanceData?.tier || 'PRO'}
          txCount={txCount}
          onClose={() => setShowVipShowcase(false)}
        />
      )}
    </div>
  );
}
