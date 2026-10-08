import React, { useState, useEffect } from 'react';
import { ArrowLeft, Gift, EyeOff, Sparkles, Heart, Check, Copy, MessageCircle, RefreshCw } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import ProgressBar from '@/components/ProgressBar';
import { getTranslation, type Language } from '@/lib/i18n';
import { PaymentDestinationSelector, type PaymentDestinationConfig } from '@/components/PaymentDestinationSelector';

interface BirthdayScreenProps {
  onBack: () => void;
  language: Language;
}

export const BirthdayScreen: React.FC<BirthdayScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'create'>('create');

  const [recipient, setRecipient] = useState('Kelvin');
  const [giftTitle, setGiftTitle] = useState('PlayStation 5 Controller & Gift Box');
  const [targetAmount, setTargetAmount] = useState('300000');
  const [hideFromRecipient, setHideFromRecipient] = useState(true);
  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destination, setDestination] = useState<PaymentDestinationConfig | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pools, setPools] = useState<any[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  async function fetchPools() {
    setLoadingPools(true);
    try {
      const res = await fetch('/api/birthday-pools');
      if (res.ok) setPools(await res.json());
    } catch (err) {
      console.error('Failed fetching pools:', err);
    } finally {
      setLoadingPools(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'tracker') fetchPools();
  }, [activeTab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !targetAmount) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/birthday-pools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthday_person: recipient,
          message: giftTitle,
          target_amount: parseFloat(targetAmount),
          destination: useCustomDestination ? destination : null,
        }),
      });

      if (res.ok) {
        const pool = await res.json();
        setGeneratedLink(`${window.location.origin}/s/BDAY-${pool.id.slice(0, 6)}`);
        setActiveTab('tracker');
      } else {
        alert('Failed creating birthday pool');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink || `${window.location.origin}/s/BDAY-POOL`);
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
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
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
          </div>

          <PaymentDestinationSelector
            enabled={useCustomDestination}
            onToggleEnabled={setUseCustomDestination}
            destination={destination}
            onChange={setDestination}
            title="Birthday Gift Payout Account"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating Pool...' : 'Create Birthday Split & Share'}</span>
          </button>
        </form>
      ) : (
        /* ACTIVE TRACKER VIEW */
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-rose-500 via-pink-600 to-indigo-700 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold space-x-1.5">
                <Heart className="w-3.5 h-3.5 fill-white" />
                <span>{hideFromRecipient ? 'Secret Surprise Gift' : 'Open Birthday Gift'}</span>
              </div>

              <h3 className="text-2xl font-black tracking-tight">{recipient}'s Birthday Split 🎉</h3>
              <p className="text-rose-100 text-xs">{giftTitle}</p>

              <div className="pt-3">
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span>Goal: {formatMoney(parseFloat(targetAmount) || 300000)}</span>
                  <span>0% Collected</span>
                </div>
                <ProgressBar percent={0} />
              </div>
            </div>
          </div>

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
        </div>
      )}
    </div>
  );
};
