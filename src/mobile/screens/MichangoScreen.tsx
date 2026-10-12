import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Plus,
  Users,
  Sparkles,
  MessageCircle,
  Copy,
  Check,
  RefreshCw,
  FileDown,
  Download,
  PiggyBank,
  Heart,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import ProgressBar from '@/components/ProgressBar';
import { getTranslation, type Language } from '@/lib/i18n';
import { PaymentDestinationSelector, type PaymentDestinationConfig } from '@/components/PaymentDestinationSelector';
import { getOwnerId } from '@/lib/ownerId';

interface MichangoScreenProps {
  onBack: () => void;
  language: Language;
}

type CampaignCategory = 'ALL' | 'GENERAL' | 'CHARITY' | 'SAVINGS';

export const MichangoScreen: React.FC<MichangoScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'tracker' | 'create'>('tracker');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<CampaignCategory>('ALL');

  // Form State
  const [formCategoryType, setFormCategoryType] = useState<'GENERAL' | 'CHARITY' | 'SAVINGS'>('GENERAL');
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('Harusi');
  const [description, setDescription] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');
  const [beneficiaryOrg, setBeneficiaryOrg] = useState('');
  const [beneficiaryPhone, setBeneficiaryPhone] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destination, setDestination] = useState<PaymentDestinationConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Tracker State
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<any | null>(null);
  const [timeframe, setTimeframe] = useState<string>('all');
  const [campaignReport, setCampaignReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [downloadingSummaryPdf, setDownloadingSummaryPdf] = useState(false);
  const [downloadingStatementKey, setDownloadingStatementKey] = useState<string | null>(null);

  // Savings Withdrawal Modal
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawNarration, setWithdrawNarration] = useState('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState('');

  const t = (key: any) => getTranslation(key, language);

  const eventCategories = [
    { name: 'Harusi', label: 'Wedding' },
    { name: 'Msiba', label: 'Funeral' },
    { name: 'Matibabu', label: 'Medical' },
    { name: 'Elimu', label: 'Education' },
    { name: 'Ujenzi', label: 'Building & Church' },
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
          // If we already have a selected event, keep it, else select first
          const existing = currentEvent ? data.find((e: any) => e.id === currentEvent.id) : null;
          const active = existing || data[0];
          selectEvent(active);
        } else {
          setCurrentEvent(null);
          setCampaignReport(null);
        }
      }
    } catch (err) {
      console.error('Failed fetching campaigns:', err);
    } finally {
      setLoadingEvents(false);
    }
  }

  function selectEvent(ev: any) {
    setCurrentEvent(ev);
    const cat = (ev.category_type || ev.event_type || 'GENERAL').toUpperCase();
    const prefix = cat === 'CHARITY' ? 'CHARITY' : cat === 'SAVINGS' ? 'SAVE' : 'MCHANG';
    const linkToken = `${prefix}-${ev.id.slice(0, 6).toUpperCase()}`;
    setGeneratedLink(`${window.location.origin}/s/${linkToken}`);
    fetchCampaignReport(ev.id, cat, timeframe);
  }

  async function fetchCampaignReport(id: string, catType: string, selectedTf: string) {
    setLoadingReport(true);
    try {
      const res = await fetch(`/api/campaigns/${catType}/${id}?timeframe=${selectedTf}`);
      if (res.ok) {
        const data = await res.json();
        setCampaignReport(data);
      }
    } catch (err) {
      console.error('Failed fetching campaign report:', err);
    } finally {
      setLoadingReport(false);
    }
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (currentEvent) {
      const cat = (currentEvent.category_type || currentEvent.event_type || 'GENERAL').toUpperCase();
      fetchCampaignReport(currentEvent.id, cat, timeframe);
    }
  }, [timeframe]);

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
          category_type: formCategoryType,
          event_type: formCategoryType === 'CHARITY' ? 'CHARITY' : formCategoryType === 'SAVINGS' ? 'SAVINGS' : eventType,
          description,
          target_amount: parseFloat(targetAmount),
          beneficiary_name: beneficiaryName.trim() || null,
          beneficiary_organization: beneficiaryOrg.trim() || null,
          beneficiary_phone: beneficiaryPhone.trim() || null,
          end_date: endDate || null,
          is_public: isPublic,
          destination: useCustomDestination ? destination : null,
        }),
      });

      if (res.ok) {
        const ev = await res.json();
        // Reset form
        setTitle('');
        setDescription('');
        setTargetAmount('');
        setBeneficiaryName('');
        setBeneficiaryOrg('');
        setBeneficiaryPhone('');
        setEndDate('');
        setActiveTab('tracker');
        await fetchEvents();
        selectEvent(ev);
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed creating campaign: ${errData.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyLink = () => {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download Consolidated Summary PDF
  const downloadSummaryPdf = async () => {
    if (!currentEvent) return;
    setDownloadingSummaryPdf(true);
    try {
      const cat = (currentEvent.category_type || currentEvent.event_type || 'GENERAL').toUpperCase();
      const res = await fetch(`/api/campaigns/${cat}/${currentEvent.id}/reports/pdf?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to generate summary PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentEvent.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Summary_${timeframe}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`PDF Download Error: ${err.message}`);
    } finally {
      setDownloadingSummaryPdf(false);
    }
  };

  // Download Individual Contributor Statement PDF
  const downloadStatementPdf = async (contributorKey: string, contributorName: string) => {
    if (!currentEvent) return;
    setDownloadingStatementKey(contributorKey);
    try {
      const cat = (currentEvent.category_type || currentEvent.event_type || 'GENERAL').toUpperCase();
      const res = await fetch(`/api/campaigns/${cat}/${currentEvent.id}/statements/${encodeURIComponent(contributorKey)}/pdf?timeframe=${timeframe}`);
      if (!res.ok) throw new Error('Failed to generate statement PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${contributorName.replace(/[^a-zA-Z0-9_-]/g, '_')}_Statement.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Statement PDF Download Error: ${err.message}`);
    } finally {
      setDownloadingStatementKey(null);
    }
  };

  // Savings Withdrawal Action
  const handleWithdrawSavings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentEvent || !withdrawAmount) return;
    setIsWithdrawing(true);
    setWithdrawSuccessMsg('');

    try {
      const token = localStorage.getItem('lumo_token');
      const res = await fetch(`/api/campaigns/${currentEvent.id}/savings/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
          'x-user-id': getOwnerId()
        },
        body: JSON.stringify({
          amount: parseFloat(withdrawAmount),
          narration: withdrawNarration || `Withdrawal from ${currentEvent.title}`
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(`Withdrawal failed: ${errJson.error || 'Server error'}`);
        return;
      }

      const result = await res.json();
      setWithdrawSuccessMsg(`Success! TZS ${Number(withdrawAmount).toLocaleString()} withdrawn. Ref: ${result.referenceCode}`);
      setWithdrawAmount('');
      setWithdrawNarration('');
      // Refresh campaign report
      await fetchEvents();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Filtered event list based on category tab
  const filteredEvents = events.filter((ev) => {
    if (selectedCategoryTab === 'ALL') return true;
    const cat = (ev.category_type || (ev.event_type === 'CHARITY' ? 'CHARITY' : ev.event_type === 'SAVINGS' ? 'SAVINGS' : 'GENERAL')).toUpperCase();
    return cat === selectedCategoryTab;
  });

  return (
    <div className="p-4 space-y-4 no-tap-highlight min-h-screen bg-[#060D0E] text-white max-w-[620px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2">
          <button onClick={onBack} className="p-1.5 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-black text-white">Michango & Funds</h2>
            <p className="text-[10px] text-white/50">Charity • Savings • Pledges</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-[#081214] border border-white/10 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setActiveTab('tracker')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'tracker' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            Campaigns
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'create' ? 'bg-[#00E599] text-[#060D0E] font-black shadow-md' : 'text-white/60 hover:text-white'
            }`}
          >
            + Create
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        /* CREATE CAMPAIGN / CHARITY / SAVINGS FORM */
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div className="space-y-1">
              <h3 className="font-extrabold text-white text-base">Select Fundraiser Type</h3>
              <p className="text-xs text-white/60">Choose the appropriate financial model for your campaign.</p>
            </div>

            {/* Type Selector (Pills) */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormCategoryType('GENERAL')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  formCategoryType === 'GENERAL'
                    ? 'border-[#00E599] bg-[#00E599]/15 text-white'
                    : 'border-white/10 bg-[#081214] text-white/60 hover:border-white/20'
                }`}
              >
                <HeartHandshake className={`w-5 h-5 mx-auto mb-1 ${formCategoryType === 'GENERAL' ? 'text-[#00E599]' : 'text-white/40'}`} />
                <span className="text-xs font-bold block">Community</span>
                <span className="text-[10px] text-white/40 block">Weddings & Pledges</span>
              </button>

              <button
                type="button"
                onClick={() => setFormCategoryType('CHARITY')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  formCategoryType === 'CHARITY'
                    ? 'border-[#00E599] bg-[#00E599]/15 text-white'
                    : 'border-white/10 bg-[#081214] text-white/60 hover:border-white/20'
                }`}
              >
                <Heart className={`w-5 h-5 mx-auto mb-1 ${formCategoryType === 'CHARITY' ? 'text-rose-400' : 'text-white/40'}`} />
                <span className="text-xs font-bold block">Charity</span>
                <span className="text-[10px] text-white/40 block">Public Aid & Causes</span>
              </button>

              <button
                type="button"
                onClick={() => setFormCategoryType('SAVINGS')}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  formCategoryType === 'SAVINGS'
                    ? 'border-[#00E599] bg-[#00E599]/15 text-white'
                    : 'border-white/10 bg-[#081214] text-white/60 hover:border-white/20'
                }`}
              >
                <PiggyBank className={`w-5 h-5 mx-auto mb-1 ${formCategoryType === 'SAVINGS' ? 'text-amber-400' : 'text-white/40'}`} />
                <span className="text-xs font-bold block">Savings</span>
                <span className="text-[10px] text-white/40 block">Target Goals</span>
              </button>
            </div>

            <div className="space-y-3 pt-2">
              {/* If Community Event: category chips */}
              {formCategoryType === 'GENERAL' && (
                <div>
                  <label className="text-xs font-bold text-white/80 mb-1.5 block">Event Category</label>
                  <div className="flex flex-wrap gap-2">
                    {eventCategories.map((c) => (
                      <button
                        type="button"
                        key={c.name}
                        onClick={() => setEventType(c.name)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          eventType === c.name
                            ? 'bg-[#00E599] text-[#060D0E] font-black'
                            : 'bg-[#081214] border border-white/10 text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {c.name} ({c.label})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">
                  {formCategoryType === 'CHARITY' ? 'Charity / Campaign Title' : formCategoryType === 'SAVINGS' ? 'Savings Goal Name' : 'Campaign Title'}
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    formCategoryType === 'CHARITY'
                      ? 'e.g. Msaada kwa Watoto Yatima Kigamboni'
                      : formCategoryType === 'SAVINGS'
                      ? 'e.g. Akiba ya Kuanzisha Biashara'
                      : 'e.g. Harusi ya Baraka & Mary'
                  }
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-2xl font-bold text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>

              {/* Target Amount */}
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">
                  {formCategoryType === 'SAVINGS' ? 'Target Savings Goal (TZS)' : 'Fundraising Target Goal (TZS)'}
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="3000000"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-2xl font-black text-lg text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>

              {/* Charity Specific Fields */}
              {formCategoryType === 'CHARITY' && (
                <div className="space-y-3 p-3.5 bg-[#081214] rounded-2xl border border-white/10">
                  <h4 className="text-xs font-bold text-[#00E599] uppercase tracking-wider">Charity Beneficiary Info</h4>
                  <div>
                    <label className="text-xs font-semibold text-white/70 mb-1 block">Organization / Foundation</label>
                    <input
                      type="text"
                      value={beneficiaryOrg}
                      onChange={(e) => setBeneficiaryOrg(e.target.value)}
                      placeholder="e.g. Hope Orphanage Centre"
                      className="w-full px-3.5 py-2.5 bg-[#0C181A] border border-white/10 rounded-xl text-xs font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-1 block">Contact Person</label>
                      <input
                        type="text"
                        value={beneficiaryName}
                        onChange={(e) => setBeneficiaryName(e.target.value)}
                        placeholder="e.g. Sr. Mary Ndunguru"
                        className="w-full px-3.5 py-2.5 bg-[#0C181A] border border-white/10 rounded-xl text-xs font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-white/70 mb-1 block">Beneficiary Phone</label>
                      <input
                        type="tel"
                        value={beneficiaryPhone}
                        onChange={(e) => setBeneficiaryPhone(e.target.value)}
                        placeholder="0754 000 000"
                        className="w-full px-3.5 py-2.5 bg-[#0C181A] border border-white/10 rounded-xl text-xs font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Purpose & Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain why this fundraiser matters or notes for your savings goal..."
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-2xl text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                />
              </div>

              {/* End Date */}
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Target Completion Date (Optional)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-2xl text-xs font-bold text-white focus:outline-none focus:border-[#00E599]"
                />
              </div>
            </div>
          </div>

          <PaymentDestinationSelector
            enabled={useCustomDestination}
            onToggleEnabled={setUseCustomDestination}
            destination={destination}
            onChange={setDestination}
            title={formCategoryType === 'SAVINGS' ? 'Vault Settlement Destination' : 'Payout Destination Account'}
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 flex items-center justify-center space-x-2 text-sm transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSubmitting
                ? 'Processing...'
                : formCategoryType === 'CHARITY'
                ? 'Launch Charity Fundraiser'
                : formCategoryType === 'SAVINGS'
                ? 'Create Savings Goal Vault'
                : 'Launch Michango Campaign'}
            </span>
          </button>
        </form>
      ) : loadingEvents ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <RefreshCw className="w-8 h-8 text-[#00E599] animate-spin" />
          <p className="text-xs font-bold text-white/60">Loading your campaigns...</p>
        </div>
      ) : events.length === 0 ? (
        /* EMPTY STATE */
        <div className="bg-[#0C181A] p-8 rounded-3xl border border-white/10 text-center space-y-4 my-8 shadow-xl">
          <div className="w-16 h-16 bg-[#00E599]/15 text-[#00E599] rounded-2xl flex items-center justify-center mx-auto">
            <HeartHandshake className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-white">No Campaigns Launched Yet</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Create a Community fundraiser, a verified Charity cause, or a personal Savings Goal with one click.
            </p>
          </div>
          <button
            onClick={() => setActiveTab('create')}
            className="py-3 px-6 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black rounded-2xl text-xs hover:brightness-105 active:scale-95 transition-all inline-flex items-center space-x-2 shadow-lg shadow-[#00E599]/20"
          >
            <Sparkles className="w-4 h-4" />
            <span>+ Create Campaign</span>
          </button>
        </div>
      ) : (
        /* CAMPAIGNS DASHBOARD & LIVE TRACKER */
        <div className="space-y-4">
          {/* Category Filter Tabs */}
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {(['ALL', 'GENERAL', 'CHARITY', 'SAVINGS'] as CampaignCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategoryTab(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategoryTab === cat
                    ? 'bg-white/15 text-white border border-white/20'
                    : 'bg-[#081214] text-white/50 border border-white/5 hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Campaigns' : cat === 'GENERAL' ? 'Community' : cat === 'CHARITY' ? 'Charity' : 'Savings Goals'}
              </button>
            ))}
          </div>

          {/* Campaign Selector Pills */}
          <div className="flex space-x-2 overflow-x-auto pb-1 scrollbar-none">
            {filteredEvents.map((ev) => {
              const isSelected = currentEvent?.id === ev.id;
              const cat = (ev.category_type || ev.event_type || 'GENERAL').toUpperCase();
              return (
                <button
                  key={ev.id}
                  onClick={() => selectEvent(ev)}
                  className={`px-3.5 py-2 rounded-2xl border text-left shrink-0 transition-all ${
                    isSelected
                      ? 'border-[#00E599] bg-[#00E599]/15 text-white shadow-lg shadow-[#00E599]/10'
                      : 'border-white/10 bg-[#0C181A] text-white/70 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 mb-0.5">
                    {cat === 'CHARITY' ? (
                      <Heart className="w-3 h-3 text-rose-400" />
                    ) : cat === 'SAVINGS' ? (
                      <PiggyBank className="w-3 h-3 text-amber-400" />
                    ) : (
                      <HeartHandshake className="w-3 h-3 text-[#00E599]" />
                    )}
                    <span className="text-[10px] font-mono font-bold text-white/50">{ev.id.slice(0, 6).toUpperCase()}</span>
                  </div>
                  <p className="text-xs font-extrabold truncate max-w-[140px]">{ev.title}</p>
                </button>
              );
            })}
          </div>

          {currentEvent && (
            <>
              {/* CURRENT CAMPAIGN HERO CARD */}
              <div className="bg-[#0C181A] border border-white/10 text-white p-5 rounded-3xl shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase border ${
                        currentEvent.category_type === 'CHARITY'
                          ? 'bg-rose-500/15 border-rose-500/30 text-rose-400'
                          : currentEvent.category_type === 'SAVINGS'
                          ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                          : 'bg-[#00E599]/15 border-[#00E599]/30 text-[#00E599]'
                      }`}
                    >
                      {currentEvent.category_type === 'CHARITY' ? 'Charity Cause' : currentEvent.category_type === 'SAVINGS' ? 'Savings Goal' : 'Community Event'}
                    </span>
                    <span className="text-[11px] font-mono text-white/40">
                      Ref: {campaignReport?.campaign?.token || currentEvent.id.slice(0, 6)}
                    </span>
                  </div>

                  <span className="text-[11px] font-bold text-white/60">
                    Status: <span className="text-[#00E599] font-black">{currentEvent.status}</span>
                  </span>
                </div>

                <div>
                  <h3 className="text-xl font-black text-white leading-tight">{currentEvent.title}</h3>
                  {currentEvent.beneficiary_organization && (
                    <p className="text-xs text-white/60 mt-0.5">Beneficiary: {currentEvent.beneficiary_organization}</p>
                  )}
                  {currentEvent.description && (
                    <p className="text-xs text-white/50 mt-1 italic leading-relaxed">{currentEvent.description}</p>
                  )}
                </div>

                {/* KPI Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  <div className="p-3 bg-[#081214] rounded-2xl border border-white/10">
                    <span className="text-[10px] font-bold text-white/50 uppercase block">Target Goal</span>
                    <span className="text-sm font-black text-white block mt-0.5">
                      {formatMoney(Number(currentEvent.target_amount || 0))}
                    </span>
                  </div>

                  <div className="p-3 bg-[#081214] rounded-2xl border border-white/10">
                    <span className="text-[10px] font-bold text-[#00E599] uppercase block">
                      {currentEvent.category_type === 'SAVINGS' ? 'Retained Savings' : 'Verified Collected'}
                    </span>
                    <span className="text-sm font-black text-[#00E599] block mt-0.5">
                      {currentEvent.category_type === 'SAVINGS'
                        ? formatMoney(Number(campaignReport?.metrics?.retainedSavings ?? currentEvent.retained_savings ?? currentEvent.collected_amount ?? 0))
                        : formatMoney(Number(campaignReport?.metrics?.verifiedAllTimeCollected ?? currentEvent.collected_amount ?? 0))}
                    </span>
                  </div>

                  <div className="p-3 bg-[#081214] rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-white/50 uppercase block">Remaining</span>
                    <span className="text-sm font-black text-white/90 block mt-0.5">
                      {formatMoney(Number(campaignReport?.metrics?.remainingAmount ?? Math.max(0, (currentEvent.target_amount || 0) - (currentEvent.collected_amount || 0))))}
                    </span>
                  </div>
                </div>

                {/* Visual Progress Bar */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between items-center text-xs font-bold text-white/70">
                    <span>Progress</span>
                    <span className="text-[#00E599]">
                      {campaignReport?.metrics?.cappedProgressPercentage ??
                        Math.min(100, Math.round(((Number(currentEvent.collected_amount || 0)) / (Number(currentEvent.target_amount) || 1)) * 100))}
                      %
                    </span>
                  </div>
                  <ProgressBar
                    percent={
                      campaignReport?.metrics?.cappedProgressPercentage ??
                      Math.min(100, Math.round(((Number(currentEvent.collected_amount || 0)) / (Number(currentEvent.target_amount) || 1)) * 100))
                    }
                  />
                </div>

                {/* Savings Withdrawal CTA (for savings goals) */}
                {currentEvent.category_type === 'SAVINGS' && (
                  <div className="pt-2">
                    <button
                      onClick={() => setShowWithdrawModal(true)}
                      className="w-full py-2.5 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/20 text-amber-300 font-extrabold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
                    >
                      <ArrowUpRight className="w-4 h-4 text-amber-400" />
                      <span>Withdraw from Savings Goal</span>
                    </button>
                  </div>
                )}
              </div>

              {/* REPORTING CONTROLS & PDF EXPORT BANNER */}
              <div className="bg-[#0C181A] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-white text-xs uppercase tracking-wider flex items-center space-x-1.5">
                    <FileDown className="w-3.5 h-3.5 text-[#00E599]" />
                    <span>Official Reports & Exports</span>
                  </h4>

                  {/* Timeframe selector */}
                  <select
                    value={timeframe}
                    onChange={(e) => setTimeframe(e.target.value)}
                    className="bg-[#081214] text-white/80 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-[#00E599]"
                  >
                    <option value="all">All-Time</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">This Month</option>
                    <option value="this_year">This Year</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Download Consolidated Summary PDF */}
                  <button
                    onClick={downloadSummaryPdf}
                    disabled={downloadingSummaryPdf}
                    className="py-3 px-3 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 flex items-center justify-center space-x-1.5 text-xs transition-all disabled:opacity-50"
                  >
                    {downloadingSummaryPdf ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>{downloadingSummaryPdf ? 'Generating...' : 'Download Summary PDF'}</span>
                  </button>

                  {/* WhatsApp Share */}
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`Changia ${currentEvent.title} kupitia LUMO Split: ${generatedLink}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3 px-3 bg-[#25D366] hover:bg-[#20ba59] text-white font-bold rounded-2xl shadow flex items-center justify-center space-x-1.5 text-xs transition-colors"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>Share on WhatsApp</span>
                  </a>
                </div>

                {/* Copy Link Button */}
                <button
                  onClick={copyLink}
                  className="w-full py-2.5 bg-[#081214] border border-white/10 hover:bg-white/5 text-white/80 font-bold rounded-2xl flex items-center justify-center space-x-1.5 text-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-[#00E599]" /> : <Copy className="w-3.5 h-3.5 text-[#00E599]" />}
                  <span>{copied ? 'Link Copied to Clipboard!' : `Copy Link (${generatedLink})`}</span>
                </button>
              </div>

              {/* DEDUPLICATED CONTRIBUTORS LEDGER */}
              <div className="bg-[#0C181A] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">
                      Contributors ({campaignReport?.contributors?.length ?? 0} Donors)
                    </h4>
                    <p className="text-[10px] text-white/50">Deduplicated donor ledger with individual statements.</p>
                  </div>
                  <button
                    onClick={() => {
                      const cat = (currentEvent.category_type || currentEvent.event_type || 'GENERAL').toUpperCase();
                      fetchCampaignReport(currentEvent.id, cat, timeframe);
                    }}
                    disabled={loadingReport}
                    className="text-xs font-bold text-[#00E599] inline-flex items-center space-x-1 hover:brightness-110"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingReport ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {loadingReport ? (
                  <div className="text-center py-6 text-xs text-white/40">Aggregating donor transactions...</div>
                ) : !campaignReport?.contributors || campaignReport.contributors.length === 0 ? (
                  <div className="p-6 text-center space-y-1">
                    <p className="text-xs font-semibold text-white/50">No contributions received for {timeframe === 'all' ? 'this campaign' : 'this period'}.</p>
                    <p className="text-[11px] text-white/30">Share your campaign link to collect verified payments.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {campaignReport.contributors.map((c: any, idx: number) => {
                      const isDownloadingStatement = downloadingStatementKey === c.identityKey;
                      return (
                        <div
                          key={c.identityKey || idx}
                          className="p-3 bg-[#081214] rounded-2xl border border-white/10 flex items-center justify-between"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5">
                              <span className="text-xs font-extrabold text-white">{c.name}</span>
                              <span className="text-[10px] font-bold text-[#00E599] bg-[#00E599]/10 px-1.5 py-0.5 rounded-md">
                                {c.transactionCount} payment{c.transactionCount > 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-[10px] text-white/50 font-mono">{c.phone || 'Anonymous'}</p>
                          </div>

                          <div className="flex items-center space-x-2">
                            <div className="text-right">
                              <span className="font-black text-[#00E599] text-xs block">
                                +{formatMoney(Number(c.totalContributed))}
                              </span>
                              <span className="text-[9px] text-white/40">
                                {new Date(c.lastPaymentDate).toLocaleDateString()}
                              </span>
                            </div>

                            {/* Download Individual Contributor Statement PDF */}
                            <button
                              onClick={() => downloadStatementPdf(c.identityKey, c.name)}
                              disabled={isDownloadingStatement}
                              title="Download Statement PDF"
                              className="p-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-[#00E599] rounded-xl border border-white/10 transition-colors"
                            >
                              {isDownloadingStatement ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00E599]" />
                              ) : (
                                <FileDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* WITHDRAW SAVINGS MODAL */}
          {showWithdrawModal && currentEvent && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-[#0C181A] border border-white/20 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl">
                      <PiggyBank className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">Withdraw Savings</h3>
                      <p className="text-[10px] text-white/50">{currentEvent.title}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setWithdrawSuccessMsg('');
                    }}
                    className="text-white/60 hover:text-white text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3 bg-[#081214] rounded-2xl border border-white/10 text-xs">
                  <span className="text-white/50 block">Available Retained Balance:</span>
                  <span className="text-lg font-black text-[#00E599]">
                    {formatMoney(Number(campaignReport?.metrics?.retainedSavings ?? currentEvent.retained_savings ?? 0))}
                  </span>
                </div>

                {withdrawSuccessMsg ? (
                  <div className="p-3 bg-[#00E599]/15 border border-[#00E599]/30 rounded-2xl text-xs text-[#00E599] font-bold text-center">
                    {withdrawSuccessMsg}
                  </div>
                ) : (
                  <form onSubmit={handleWithdrawSavings} className="space-y-3">
                    <div>
                      <label className="text-xs font-bold text-white/80 mb-1 block">Withdrawal Amount (TZS)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="e.g. 50000"
                        className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl font-bold text-sm text-white focus:outline-none focus:border-[#00E599]"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-white/80 mb-1 block">Reason / Narration</label>
                      <input
                        type="text"
                        value={withdrawNarration}
                        onChange={(e) => setWithdrawNarration(e.target.value)}
                        placeholder="e.g. Capital purchase"
                        className="w-full px-3.5 py-2.5 bg-[#081214] border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[#00E599]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isWithdrawing || !withdrawAmount}
                      className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-xl text-xs transition-all disabled:opacity-50"
                    >
                      {isWithdrawing ? 'Withdrawing...' : 'Confirm Withdrawal'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
