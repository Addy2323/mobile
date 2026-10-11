import React, { useState, useEffect } from 'react';
import { ArrowLeft, HeartHandshake, CheckCircle2, Clock, Plus, Users, Sparkles, MessageCircle, Copy, Check, RefreshCw } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import ProgressBar from '@/components/ProgressBar';
import { getTranslation, type Language } from '@/lib/i18n';
import { PaymentDestinationSelector, type PaymentDestinationConfig } from '@/components/PaymentDestinationSelector';
import { getOwnerId } from '@/lib/ownerId';

interface MichangoScreenProps {
  onBack: () => void;
  language: Language;
}

export const MichangoScreen: React.FC<MichangoScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'create'>('create');

  const [title, setTitle] = useState('Harusi ya Baraka & Mary');
  const [category, setCategory] = useState('Harusi');
  const [targetAmount, setTargetAmount] = useState('2000000');
  const [suggestedPledge, setSuggestedPledge] = useState('100000');
  const [organizer, setOrganizer] = useState('Given Mhema');

  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destination, setDestination] = useState<PaymentDestinationConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<any | null>(null);
  const [contributors, setContributors] = useState<any[]>([]);
  const [loadingContributors, setLoadingContributors] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  const categories = [
    { name: 'Harusi', label: 'Wedding' },
    { name: 'Msiba', label: 'Funeral' },
    { name: 'Matibabu', label: 'Medical' },
    { name: 'Elimu', label: 'Education' },
    { name: 'Ujenzi', label: 'Building' },
  ];

  async function fetchEvents() {
    setLoadingEvents(true);
    try {
      const ownerId = getOwnerId();
      const res = await fetch(`/api/michango-events?owner_user_id=${encodeURIComponent(ownerId)}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        if (data.length > 0) {
          const active = data[0];
          setCurrentEvent(active);
          fetchContributors(`MCHANG-${active.id.slice(0, 6)}`);
        }
      }
    } catch (err) {
      console.error('Failed fetching michango events:', err);
    } finally {
      setLoadingEvents(false);
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
      console.error('Failed fetching contributors:', err);
    } finally {
      setLoadingContributors(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'tracker') fetchEvents();
  }, [activeTab]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !targetAmount) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/michango-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_user_id: getOwnerId(),
          title,
          event_type: category === 'Harusi' ? 'WEDDING' : category === 'Msiba' ? 'FUNERAL' : category === 'Matibabu' ? 'MEDICAL' : 'OTHER',
          target_amount: parseFloat(targetAmount),
          destination: useCustomDestination ? destination : null,
        }),
      });

      if (res.ok) {
        const ev = await res.json();
        setCurrentEvent(ev);
        const linkToken = `MCHANG-${ev.id.slice(0, 6)}`;
        setGeneratedLink(`${window.location.origin}/s/${linkToken}`);
        fetchContributors(linkToken);
        setActiveTab('tracker');
      } else {
        alert('Failed creating Michango campaign');
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(generatedLink || `${window.location.origin}/s/MCHANGO-BARAKA`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalTarget = parseFloat(targetAmount) || 2000000;

  return (
    <div className="p-4 space-y-5 no-tap-highlight">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-slate-900">{t('michango')} Tracker</h2>
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
            Campaigns
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Create Michango Campaign</h3>
                <p className="text-xs text-slate-500">Collect pledges and payments for community causes.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Fundraiser Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      type="button"
                      key={c.name}
                      onClick={() => setCategory(c.name)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        category === c.name
                          ? 'bg-amber-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {c.name} ({c.label})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Campaign Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Harusi ya Baraka & Mary"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-amber-600"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Target Goal (TZS)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="2000000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-slate-900 focus:outline-none focus:border-amber-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Pledge / Person</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={suggestedPledge}
                    onChange={(e) => setSuggestedPledge(e.target.value)}
                    placeholder="100000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </div>
            </div>
          </div>

          <PaymentDestinationSelector
            enabled={useCustomDestination}
            onToggleEnabled={setUseCustomDestination}
            destination={destination}
            onChange={setDestination}
            title="Michango Payout Destination Account"
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Launching...' : 'Launch Campaign & Share'}</span>
          </button>
        </form>
      ) : (
        /* ACTIVE CAMPAIGN TRACKER VIEW */
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-amber-500 via-orange-600 to-indigo-700 text-white p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center space-x-2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold w-fit">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{category} Fundraiser</span>
            </div>

            <div>
              <h3 className="text-2xl font-black">{currentEvent?.title || title}</h3>
              <p className="text-amber-100 text-xs mt-0.5">Target: {formatMoney(Number(currentEvent?.target_amount || totalTarget))}</p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <span>Collected: {formatMoney(Number(currentEvent?.collected_amount || 0))}</span>
                <span>
                  {Math.min(
                    100,
                    Math.round(
                      ((Number(currentEvent?.collected_amount || 0)) /
                        (Number(currentEvent?.target_amount || totalTarget) || 1)) *
                        100
                    )
                  )}
                  % Settled
                </span>
              </div>
              <ProgressBar
                percent={Math.min(
                  100,
                  Math.round(
                    ((Number(currentEvent?.collected_amount || 0)) /
                      (Number(currentEvent?.target_amount || totalTarget) || 1)) *
                      100
                  )
                )}
              />
            </div>
          </div>

          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">Share Michango Link</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Changia ${title} via LUMO Split: ${generatedLink || window.location.href}`)}`}
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

          {/* Real Contributors Tracker */}
          <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                Contributors ({contributors.length})
              </h4>
              <button
                onClick={() => currentEvent && fetchContributors(`MCHANG-${currentEvent.id.slice(0, 6)}`)}
                disabled={loadingContributors}
                className="text-xs font-bold text-amber-600 inline-flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingContributors ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {loadingContributors ? (
              <div className="text-center py-4 text-xs text-slate-400">Loading contributors...</div>
            ) : contributors.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No pledges or contributions received yet. Share the link above!</p>
            ) : (
              <div className="space-y-2">
                {contributors.map((c) => (
                  <div key={c.id} className="p-3 bg-amber-50/40 rounded-2xl border border-amber-100/60 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{c.payer_name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{c.payer_phone}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-amber-600 text-xs block">+{formatMoney(Number(c.amount))}</span>
                      <span className="text-[9px] text-slate-400">{new Date(c.created_at).toLocaleDateString()}</span>
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
