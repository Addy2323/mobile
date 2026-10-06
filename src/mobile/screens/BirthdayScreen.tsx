import React, { useState } from 'react';
import { ArrowLeft, Gift, EyeOff, Eye, Check, Users, Sparkles, Heart, Plus, Share2, MessageCircle, Copy } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import ProgressBar from '@/components/ProgressBar';
import { getTranslation, type Language } from '@/lib/i18n';

interface BirthdayScreenProps {
  onBack: () => void;
  language: Language;
}

export const BirthdayScreen: React.FC<BirthdayScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'create'>('create');

  // Form State for Creation
  const [recipient, setRecipient] = useState('Kelvin');
  const [giftTitle, setGiftTitle] = useState('PlayStation 5 Controller & Gift Box');
  const [targetAmount, setTargetAmount] = useState('300000');
  const [hideFromRecipient, setHideFromRecipient] = useState(true);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  // Active Tracker State
  const [isRevealed, setIsRevealed] = useState(false);
  const t = (key: any) => getTranslation(key, language);

  const total = parseFloat(targetAmount) || 300000;
  const collected = 240000;
  const pct = Math.round((collected / total) * 100);

  const contributors = [
    { name: 'Asia Msechu', amount: 30000, status: 'Paid' },
    { name: 'Joseph Paul', amount: 30000, status: 'Paid' },
    { name: 'Ado Omari', amount: 30000, status: 'Paid' },
    { name: 'Given Mhema (You)', amount: 150000, status: 'Paid' },
  ];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !targetAmount) return;
    const token = 'BDAY-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    setGeneratedLink(`${window.location.origin}/s/${token}`);
    setActiveTab('tracker');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink || `${window.location.origin}/s/BDAY-KELVIN`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 space-y-5 no-tap-highlight">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-slate-900">{t('birthday')} Gift Split</h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            + Create
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'tracker' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tracker
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* CREATE BIRTHDAY GIFT FORM */
        <form onSubmit={handleCreate} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
            <div className="p-3 bg-pink-50 text-pink-600 rounded-2xl">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Create Group Gift Split</h3>
              <p className="text-xs text-slate-500">Organize a surprise birthday gift with friends.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Birthday Person (Recipient)</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="e.g. Kelvin, Baraka, Mary"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-pink-600"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Gift Description / Title</label>
              <input
                type="text"
                value={giftTitle}
                onChange={(e) => setGiftTitle(e.target.value)}
                placeholder="e.g. PS5 Controller & Headphones"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:border-pink-600"
                required
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 mb-1 block">Target Gift Amount (TZS)</label>
              <input
                type="number"
                inputMode="decimal"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                placeholder="300000"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-900 focus:outline-none focus:border-pink-600"
                required
              />
            </div>

            {/* Secret Surprise Toggle */}
            <div className="p-3.5 bg-pink-50/60 rounded-2xl border border-pink-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <EyeOff className="w-5 h-5 text-pink-600" />
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">Secret Surprise Mode</h4>
                  <p className="text-[10px] text-slate-500">Hide contributions from {recipient || 'recipient'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHideFromRecipient(!hideFromRecipient)}
                className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center ${
                  hideFromRecipient ? 'bg-pink-600 justify-end' : 'bg-slate-200 justify-start'
                }`}
              >
                <div className="w-4 h-4 rounded-full bg-white shadow-md" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Birthday Split & Share</span>
          </button>
        </form>
      ) : (
        /* ACTIVE TRACKER VIEW */
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-rose-500 via-pink-600 to-indigo-700 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
            <div className="absolute right-2 top-2 opacity-15">
              <Gift className="w-32 h-32" />
            </div>

            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold space-x-1.5">
                <Heart className="w-3.5 h-3.5 fill-white" />
                <span>{hideFromRecipient ? 'Secret Surprise Gift' : 'Open Birthday Gift'}</span>
              </div>

              <h3 className="text-2xl font-black tracking-tight">{recipient}'s Birthday Split 🎉</h3>
              <p className="text-rose-100 text-xs">{giftTitle}</p>

              <div className="pt-3">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span>Goal: {formatMoney(total)}</span>
                  <span>{pct}% Collected</span>
                </div>
                <ProgressBar percent={pct} />
              </div>
            </div>
          </div>

          {/* Share Actions */}
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Invite Friends to Contribute</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Contribute to ${recipient}'s Birthday Gift (${giftTitle}): ${generatedLink || window.location.href}`)}`}
                target="_blank"
                rel="noreferrer"
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow flex items-center justify-center space-x-1.5 text-xs"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>

              <button
                onClick={copyLink}
                className="py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow flex items-center justify-center space-x-1.5 text-xs"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Contributors */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
              Contributions ({contributors.length})
            </h3>

            <div className="space-y-2">
              {contributors.map((c, idx) => (
                <div key={idx} className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-xs">{c.name}</span>
                  <span className="text-xs font-extrabold text-slate-900">{formatMoney(c.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
