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

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Harusi');
  const [targetAmount, setTargetAmount] = useState('');
  const [suggestedPledge, setSuggestedPledge] = useState('');
  const [organizer, setOrganizer] = useState(() => {
    try {
      const uStr = localStorage.getItem('lumo_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u?.full_name?.trim()) return u.full_name.trim();
        if (u?.name?.trim()) return u.name.trim();
      }
      const raw = localStorage.getItem('lumo_user_name');
      if (raw && !raw.startsWith('user_') && !/\d/.test(raw)) return raw.trim();
    } catch {}
    return '';
  });

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
          const linkToken = `MCHANG-${active.id.slice(0, 6)}`;
          setGeneratedLink(`${window.location.origin}/s/${linkToken}`);
          fetchContributors(linkToken);
        } else {
          setCurrentEvent(null);
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
    <div className="p-4 space-y-5 no-tap-highlight min-h-screen bg-[#060D0E] text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-1.5 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base font-bold text-white">{t('michango')} Tracker</h2>
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
            Campaigns
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-white/10">
              <div className="p-3 bg-[#00E599]/15 text-[#00E599] rounded-2xl">
                <HeartHandshake className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-sm">Create Michango Campaign</h3>
                <p className="text-xs text-white/60">Collect pledges and payments for community causes.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Fundraiser Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      type="button"
                      key={c.name}
                      onClick={() => setCategory(c.name)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        category === c.name
                          ? 'bg-[#00E599] text-[#060D0E] font-black shadow-sm'
                          : 'bg-[#081214] border border-white/10 text-white/70 hover:bg-white/10'
                      }`}
                    >
                      {c.name} ({c.label})
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Campaign Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Harusi ya Baraka & Mary"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-white/80 mb-1 block">Target Goal (TZS)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="2000000"
                    className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-black text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-white/80 mb-1 block">Pledge / Person</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={suggestedPledge}
                    onChange={(e) => setSuggestedPledge(e.target.value)}
                    placeholder="100000"
                    className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
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
            className="w-full py-4 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Launching...' : 'Launch Campaign & Share'}</span>
          </button>
        </form>
      ) : loadingEvents ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="w-8 h-8 text-[#00E599] animate-spin" />
          <p className="text-xs font-bold text-white/60">Loading michango campaigns...</p>
        </div>
      ) : !currentEvent ? (
        <div className="bg-[#0C181A] p-8 rounded-3xl border border-white/10 text-center space-y-4 my-8 shadow-xl">
          <div className="w-16 h-16 bg-[#00E599]/15 text-[#00E599] rounded-2xl flex items-center justify-center mx-auto">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">No Active Michango Campaigns</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              You haven't launched any community fundraisers or michango campaigns yet. Launch one to collect pledges transparently.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('create')}
            className="py-3 px-6 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black rounded-2xl text-xs hover:brightness-105 active:scale-95 transition-all inline-flex items-center space-x-2 shadow-lg shadow-[#00E599]/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Launch Campaign</span>
          </button>
        </div>
      ) : (
        /* ACTIVE CAMPAIGN TRACKER VIEW */
        <div className="space-y-4">
          <div className="bg-[#0C181A] border border-[#00E599]/30 text-white p-6 rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center space-x-2 bg-[#00E599]/15 border border-[#00E599]/30 px-3 py-1 rounded-full text-xs font-bold w-fit text-[#00E599]">
              <HeartHandshake className="w-3.5 h-3.5" />
              <span>{currentEvent.event_type || category} Fundraiser</span>
            </div>

            <div>
              <h3 className="text-2xl font-black text-white">{currentEvent.title}</h3>
              <p className="text-white/70 text-xs mt-0.5">Target: {formatMoney(Number(currentEvent.target_amount || 0))}</p>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between items-center text-xs font-bold text-white/80">
                <span>Collected: {formatMoney(Number(currentEvent.collected_amount || 0))}</span>
                <span>
                  {Math.min(
                    100,
                    Math.round(
                      ((Number(currentEvent.collected_amount || 0)) /
                        (Number(currentEvent.target_amount) || 1)) *
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
                    ((Number(currentEvent.collected_amount || 0)) /
                      (Number(currentEvent.target_amount) || 1)) *
                      100
                  )
                )}
              />
            </div>
          </div>

          <div className="bg-[#0C181A] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
            <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">Share Michango Link</h4>
            
            <div className="grid grid-cols-2 gap-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Changia ${currentEvent.title} via LUMO Split: ${generatedLink || `${window.location.origin}/s/MCHANG-${currentEvent.id.slice(0, 6)}`}`)}`}
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
                onClick={() => currentEvent && fetchContributors(`MCHANG-${currentEvent.id.slice(0, 6)}`)}
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
              <p className="text-xs text-white/40 text-center py-4">No pledges or contributions received yet. Share the link above!</p>
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
