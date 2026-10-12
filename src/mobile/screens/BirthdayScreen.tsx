import React, { useState, useEffect } from 'react';
import { ArrowLeft, Gift, EyeOff, Sparkles, Heart, Check, Copy, MessageCircle, RefreshCw } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import ProgressBar from '@/components/ProgressBar';
import { getTranslation, type Language } from '@/lib/i18n';
import { PaymentDestinationSelector, type PaymentDestinationConfig } from '@/components/PaymentDestinationSelector';
import { getOwnerId } from '@/lib/ownerId';

interface BirthdayScreenProps {
  onBack: () => void;
  language: Language;
}

export const BirthdayScreen: React.FC<BirthdayScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'create'>('create');

  const [recipient, setRecipient] = useState('');
  const [giftTitle, setGiftTitle] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [hideFromRecipient, setHideFromRecipient] = useState(true);
  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destination, setDestination] = useState<PaymentDestinationConfig | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pools, setPools] = useState<any[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [currentPool, setCurrentPool] = useState<any | null>(null);
  const [contributors, setContributors] = useState<any[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  async function fetchPools() {
    setLoadingPools(true);
    try {
      const ownerId = getOwnerId();
      const res = await fetch(`/api/birthday-pools?owner_user_id=${encodeURIComponent(ownerId)}`);
      if (res.ok) {
        const data = await res.json();
        setPools(data);
        if (data.length > 0) {
          const active = data[0];
          setCurrentPool(active);
          const linkToken = `BDAY-${active.id.slice(0, 6)}`;
          setGeneratedLink(`${window.location.origin}/s/${linkToken}`);
          fetchContributors(linkToken);
        } else {
          setCurrentPool(null);
        }
      }
    } catch (err) {
      console.error('Failed fetching pools:', err);
    } finally {
      setLoadingPools(false);
    }
  }

  async function fetchContributors(token: string) {
    setLoadingContributors(true);
    try {
      const res = await fetch(`/api/public/links/${encodeURIComponent(token)}/contributors`);
      if (res.ok) {
        setContributors(await res.json());
      }
    } catch (err) {
      console.error('Failed fetching pool contributors:', err);
    } finally {
      setLoadingContributors(false);
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
          owner_user_id: getOwnerId(),
          birthday_person: recipient,
          message: giftTitle,
          target_amount: parseFloat(targetAmount),
          destination: useCustomDestination ? destination : null,
        }),
      });

      if (res.ok) {
        const pool = await res.json();
        setCurrentPool(pool);
        const linkToken = `BDAY-${pool.id.slice(0, 6)}`;
        setGeneratedLink(`${window.location.origin}/s/${linkToken}`);
        fetchContributors(linkToken);
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
    <div className="p-4 space-y-5 no-tap-highlight min-h-screen bg-[#060D0E] text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-1.5 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-white">{t('birthday')} Gift Split</h2>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#081214] border border-white/10 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            + Create
          </button>
          <button
            onClick={() => setActiveTab('tracker')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'tracker' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Tracker
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-white/10">
              <div className="p-3 bg-[#00E599]/15 text-[#00E599] rounded-2xl">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">Create Group Gift Split</h3>
                <p className="text-xs text-white/60">Organize a surprise birthday gift with friends.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Birthday Person (Recipient)</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="e.g. Kelvin, Baraka, Mary"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Gift Description / Title</label>
                <input
                  type="text"
                  value={giftTitle}
                  onChange={(e) => setGiftTitle(e.target.value)}
                  placeholder="e.g. PS5 Controller & Headphones"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-semibold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Target Gift Amount (TZS)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="300000"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-black text-lg text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>

              {/* Secret Surprise Toggle */}
              <div className="p-3.5 bg-[#081214] rounded-2xl border border-white/10 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <EyeOff className="w-5 h-5 text-[#00E599]" />
                  <div>
                    <h4 className="font-bold text-white text-xs">Secret Surprise Mode</h4>
                    <p className="text-[10px] text-white/60">Hide contributions from {recipient || 'recipient'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setHideFromRecipient(!hideFromRecipient)}
                  className={`w-11 h-6 rounded-full transition-colors p-1 flex items-center ${
                    hideFromRecipient ? 'bg-[#00E599] justify-end' : 'bg-white/20 justify-start'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full ${hideFromRecipient ? 'bg-[#060D0E]' : 'bg-white'} shadow-md`} />
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
            className="w-full py-4 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Creating Pool...' : 'Create Birthday Split & Share'}</span>
          </button>
        </form>
      ) : loadingPools ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="w-8 h-8 text-[#00E599] animate-spin" />
          <p className="text-xs font-bold text-white/60">Loading birthday gift splits...</p>
        </div>
      ) : !currentPool ? (
        <div className="bg-[#0C181A] p-8 rounded-3xl border border-white/10 text-center space-y-4 my-8 shadow-xl">
          <div className="w-16 h-16 bg-[#00E599]/15 text-[#00E599] rounded-2xl flex items-center justify-center mx-auto">
            <Gift className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">No Active Birthday Splits</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              You haven't created any group birthday gift splits yet. Create one to invite friends and track contributions in real time.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('create')}
            className="py-3 px-6 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black rounded-2xl text-xs hover:brightness-105 active:scale-95 transition-all inline-flex items-center space-x-2 shadow-lg shadow-[#00E599]/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Create Gift Split</span>
          </button>
        </div>
      ) : (
        /* ACTIVE TRACKER VIEW */
        <div className="space-y-4">
          <div className="bg-[#0C181A] border border-[#00E599]/30 text-white p-6 rounded-3xl shadow-xl space-y-4 relative overflow-hidden">
            <div className="relative z-10 space-y-2">
              <div className="inline-flex items-center px-3 py-1 bg-[#00E599]/15 border border-[#00E599]/30 rounded-full text-xs font-bold space-x-1.5 text-[#00E599]">
                <Heart className="w-3.5 h-3.5 fill-[#00E599]" />
                <span>Group Birthday Gift</span>
              </div>

              <h3 className="text-2xl font-black tracking-tight text-white">{currentPool.birthday_person}'s Birthday Split 🎉</h3>
              <p className="text-white/70 text-xs">{currentPool.message || 'Birthday Gift Fund'}</p>

              <div className="pt-3">
                <div className="flex justify-between items-center text-xs font-bold mb-1 text-white/80">
                  <span>Goal: {formatMoney(Number(currentPool.target_amount || 0))}</span>
                  <span>
                    {Math.min(
                      100,
                      Math.round(
                        ((Number(currentPool.collected_amount || 0)) /
                          (Number(currentPool.target_amount) || 1)) *
                          100
                      )
                    )}% Collected ({formatMoney(Number(currentPool.collected_amount || 0))})
                  </span>
                </div>
                <ProgressBar
                  percent={Math.min(
                    100,
                    Math.round(
                      ((Number(currentPool.collected_amount || 0)) /
                        (Number(currentPool.target_amount) || 1)) *
                        100
                    )
                  )}
                />
              </div>
            </div>
          </div>

          <div className="bg-[#0C181A] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Invite Friends to Contribute</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Contribute to ${currentPool.birthday_person}'s Birthday Gift (${currentPool.message || 'Gift Pool'}): ${generatedLink || `${window.location.origin}/s/BDAY-${currentPool.id.slice(0, 6)}`}`)}`}
                target="_blank"
                rel="noreferrer"
                className="py-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-2xl shadow flex items-center justify-center space-x-1.5 text-xs transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>

              <button
                onClick={copyLink}
                className="py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl shadow flex items-center justify-center space-x-1.5 text-xs transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-[#00E599]" /> : <Copy className="w-4 h-4 text-[#00E599]" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
          </div>

          {/* Real Contributors Tracker */}
          <div className="bg-[#0C181A] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">
                Contributors ({contributors.length})
              </h4>
              <button
                onClick={() => currentPool && fetchContributors(`BDAY-${currentPool.id.slice(0, 6)}`)}
                disabled={loadingContributors}
                className="text-xs font-bold text-[#00E599] inline-flex items-center space-x-1 hover:brightness-110"
              >
                <RefreshCw className={`w-3 h-3 ${loadingContributors ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingContributors ? (
              <div className="text-center py-4 text-xs text-white/40">Loading contributors...</div>
            ) : contributors.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-4">No contributions received yet. Share the link above!</p>
            ) : (
              <div className="space-y-2">
                {contributors.map((c) => (
                  <div key={c.id} className="p-3 bg-[#081214] rounded-2xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-white text-xs">{c.payer_name}</p>
                      <p className="text-[10px] text-white/50 font-mono">{c.payer_phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-[#00E599] text-xs block">+{formatMoney(Number(c.amount))}</span>
                      <span className="text-[9px] text-white/40">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
