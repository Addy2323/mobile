import React, { useState } from 'react';
import { Gift, Award, Share2, Copy, Sparkles, Check, ChevronRight } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';

interface RewardsScreenProps {
  language: Language;
}

export const RewardsScreen: React.FC<RewardsScreenProps> = ({ language }) => {
  const [copied, setCopied] = useState(false);
  const t = (key: any) => getTranslation(key, language);

  const referralCode = 'LUMO-GIVEN99';
  const referralLink = `${window.location.origin}/invite?code=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const rewards = [
    { title: 'Dinner Split Bonus', points: '+150 pts', date: 'Yesterday', value: 'TZS 1,500' },
    { title: 'Friend Referral (Kelvin)', points: '+500 pts', date: '3 days ago', value: 'TZS 5,000' },
    { title: 'DAWASA Bill Split', points: '+50 pts', date: '1 week ago', value: 'TZS 500' },
  ];

  return (
    <div className="p-4 space-y-5 no-tap-highlight">
      {/* Rewards Hero Card */}
      <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-800 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute right-3 top-3 opacity-15">
          <Award className="w-32 h-32" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold space-x-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>LUMO Rewards Club</span>
          </div>

          <div>
            <span className="text-indigo-200 text-xs font-semibold block uppercase">Total Points Balance</span>
            <h2 className="text-3xl font-black tracking-tight">1,450 PTS</h2>
            <p className="text-emerald-300 text-xs font-bold mt-0.5">≈ TZS 14,500 Cashback Value</p>
          </div>
        </div>
      </div>

      {/* Referral Invite Card */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Invite Friends & Earn</h3>
            <p className="text-xs text-slate-500">Get TZS 2,000 for every friend who creates their first split.</p>
          </div>
        </div>

        <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
          <span className="font-mono font-bold text-slate-800 text-xs truncate mr-2">{referralCode}</span>
          <button
            onClick={copyCode}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center space-x-1"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* History */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Rewards Activity</h3>

        <div className="space-y-2">
          {rewards.map((r, idx) => (
            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">{r.title}</h4>
                <p className="text-[11px] text-slate-400">{r.date}</p>
              </div>

              <div className="text-right">
                <span className="text-xs font-extrabold text-emerald-600 block">{r.points}</span>
                <span className="text-[10px] text-slate-500 font-semibold">{r.value}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
