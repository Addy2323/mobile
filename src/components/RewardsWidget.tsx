import { useState } from 'react';
import { Award, Flame, Gift, ShieldCheck, Users, Copy, Check, ChevronRight, Zap } from 'lucide-react';
import { formatMoney } from '@/lib/utils';

export default function RewardsWidget() {
  const [copied, setCopied] = useState(false);
  const referralCode = 'LUMO-ADO2026';
  const streakCount = 5;
  const totalEarned = 12000;

  function copyReferral() {
    void navigator.clipboard?.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-bold">
            <Award className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold">LUMO Rewards & Perks</h3>
              <span className="flex items-center gap-1 rounded-full bg-success-500/20 px-2 py-0.5 text-[10px] font-bold text-success-400">
                <ShieldCheck className="h-3 w-3" /> Trusted Payer
              </span>
            </div>
            <p className="text-xs text-white/60">Earn bonus cash, maintain settled streaks, and unlock merchant perks.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-white/50">Total Earnings</p>
          <p className="text-lg font-extrabold text-amber-400">{formatMoney(totalEarned)}</p>
        </div>
      </div>

      {/* Grid Features */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Streak Counter */}
        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/70">Settled-Split Streak</span>
            <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
          </div>
          <p className="text-2xl font-extrabold text-orange-400">{streakCount} Splits</p>
          <p className="mt-1 text-[11px] text-white/50">100% on-time settlement streak bonus active.</p>
        </div>

        {/* Referral Bonus */}
        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/70">Referral Bonus</span>
            <Users className="h-5 w-5 text-blue-400" />
          </div>
          <p className="text-sm font-bold text-white">Earn TZS 1,000 / friend</p>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-black/40 px-2.5 py-1.5 font-mono text-xs text-white/80">
            <span>{referralCode}</span>
            <button onClick={copyReferral} className="text-xs font-bold text-primary-400 hover:text-primary-300">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Merchant Offers */}
        <div className="rounded-xl bg-white/5 p-4 border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-white/70">Merchant Group Offer</span>
            <Gift className="h-5 w-5 text-purple-400" />
          </div>
          <p className="text-xs font-bold text-purple-300">10% OFF at Samaki Samaki</p>
          <p className="mt-1 text-[11px] text-white/50">Available for group splits over TZS 100,000.</p>
        </div>
      </div>
    </div>
  );
}
