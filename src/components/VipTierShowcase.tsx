import React from 'react';
import { X, Award, CheckCircle2, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { VIP_TIER_STYLES } from './LumoMemberCard';

interface VipTierShowcaseProps {
  currentTier: string;
  txCount: number;
  onClose: () => void;
}

const TIERS_LIST = [
  { key: 'STARTER', minTx: 0, maxTx: 9, perk: 'Standard split fees & live ledger tracking' },
  { key: 'GREEN', minTx: 10, maxTx: 19, perk: '5% cashback on utility bill payments' },
  { key: 'PRO', minTx: 20, maxTx: 49, perk: 'Instant withdrawal reviews & zero fee bill payments' },
  { key: 'ELITE', minTx: 50, maxTx: 99, perk: 'Priority 24/7 dedicated support & high daily limit' },
  { key: 'VVIP', minTx: 100, maxTx: Infinity, perk: 'Exclusive VIP black/gold card, custom ref, zero fees' }
];

export const VipTierShowcase: React.FC<VipTierShowcaseProps> = ({ currentTier, txCount, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">LUMO Member Card Tiers</h3>
            <p className="text-xs text-slate-400">Automatic card upgrades based on transaction activity</p>
          </div>
        </div>

        {/* Current User Tier Banner */}
        <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <span className="text-[11px] text-slate-400 uppercase font-semibold">Your Current Card Tier</span>
            <div className="text-lg font-extrabold text-white flex items-center space-x-2 mt-0.5">
              <span>{VIP_TIER_STYLES[currentTier]?.label || 'LUMO Starter'}</span>
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-emerald-400">{txCount}</span>
            <span className="text-[10px] text-slate-400 block uppercase font-medium">Completed Txs</span>
          </div>
        </div>

        {/* TIERS LIST */}
        <div className="mt-6 space-y-3">
          {TIERS_LIST.map((t) => {
            const isCurrent = currentTier === t.key;
            const style = VIP_TIER_STYLES[t.key];
            const isUnlocked = txCount >= t.minTx;

            return (
              <div
                key={t.key}
                className={`p-4 rounded-2xl border transition-all ${
                  isCurrent
                    ? 'border-emerald-400 bg-emerald-950/40 shadow-lg shadow-emerald-950/30 ring-1 ring-emerald-500/50'
                    : isUnlocked
                    ? 'border-slate-800 bg-slate-900/80 opacity-90'
                    : 'border-slate-800/60 bg-slate-950/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs border font-bold ${style.badgeClass}`}>
                      {style.label}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] bg-emerald-500 text-slate-950 px-2 py-0.5 rounded-full font-bold uppercase">
                        Active Card
                      </span>
                    )}
                  </div>

                  <span className="text-xs text-slate-400 font-mono font-medium">
                    {t.maxTx === Infinity ? `${t.minTx}+ Txs` : `${t.minTx}–${t.maxTx} Txs`}
                  </span>
                </div>

                <div className="mt-2 flex items-start space-x-2 text-xs text-slate-300">
                  <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isUnlocked ? 'text-emerald-400' : 'text-slate-600'}`} />
                  <span>{t.perk}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center space-x-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 inline" />
            <span>Card tier upgrades recalculate automatically upon transaction completion</span>
          </p>
        </div>
      </div>
    </div>
  );
};
