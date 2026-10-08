import React, { useState, useEffect } from 'react';
import { ArrowLeft, Link as LinkIcon, Copy, MessageCircle, Sparkles, Clock, Check, RefreshCw } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';
import { PaymentDestinationSelector, type PaymentDestinationConfig } from '@/components/PaymentDestinationSelector';

interface PayLinkScreenProps {
  onBack: () => void;
  language: Language;
}

export interface PaymentLinkItem {
  id: string;
  public_token: string;
  title: string;
  amount: number;
  currency: string;
  expiration_mode: string;
  expires_at: string | null;
  status: string;
  destination_snapshot: any;
  created_at: string;
}

export const PayLinkScreen: React.FC<PayLinkScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'links'>('create');

  const [title, setTitle] = useState('Weekend Trip Contribution');
  const [amount, setAmount] = useState('50000');
  const [expirationMode, setExpirationMode] = useState('7_DAYS');
  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destination, setDestination] = useState<PaymentDestinationConfig | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const [myLinks, setMyLinks] = useState<PaymentLinkItem[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

  const t = (key: any) => getTranslation(key, language);
  const presets = ['10000', '25000', '50000', '100000'];

  async function fetchMyLinks() {
    setLoadingLinks(true);
    try {
      const res = await fetch('/api/payment-links');
      if (res.ok) {
        const data = await res.json();
        setMyLinks(data);
      }
    } catch (err) {
      console.error('Failed to fetch payment links:', err);
    } finally {
      setLoadingLinks(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'links') {
      fetchMyLinks();
    }
  }, [activeTab]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        title,
        amount: parseFloat(amount),
        expiration_mode: expirationMode,
        destination: useCustomDestination ? destination : null,
      };

      const res = await fetch('/api/payment-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`Error: ${err.error || 'Failed to create payment link'}`);
        return;
      }

      const created = await res.json();
      const publicUrl = `${window.location.origin}/s/${created.public_token}`;
      setGeneratedLink(publicUrl);
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
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
          <h2 className="text-base font-bold text-slate-900">{t('payLink')}</h2>
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
            onClick={() => setActiveTab('links')}
            className={`px-3 py-1 rounded-lg transition-all ${
              activeTab === 'links' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            My Links
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        !generatedLink ? (
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex items-center space-x-3 pb-2 border-b border-slate-100">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Create Instant Pay Link</h3>
                  <p className="text-xs text-slate-500">Generate a direct payment link anyone can pay.</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Link Title / Purpose</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Concert Ticket share"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Requested Amount (TZS)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="50000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-lg text-slate-900 focus:outline-none focus:border-indigo-600"
                    required
                  />

                  {/* Quick Presets */}
                  <div className="flex gap-2 mt-2">
                    {presets.map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setAmount(p)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
                          amount === p ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {formatMoney(parseFloat(p))}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Link Expiration Rule</label>
                  <select
                    value={expirationMode}
                    onChange={(e) => setExpirationMode(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                  >
                    <option value="AFTER_PAYMENT">Single Use (Invalidate After 1 Payment)</option>
                    <option value="24_HOURS">Expires in 24 Hours</option>
                    <option value="7_DAYS">Expires in 7 Days</option>
                    <option value="30_DAYS">Expires in 30 Days</option>
                    <option value="NEVER">Never Expires</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Payment Destination Selector */}
            <PaymentDestinationSelector
              enabled={useCustomDestination}
              onToggleEnabled={setUseCustomDestination}
              destination={destination}
              onChange={setDestination}
              title="Payout Destination for this Link"
            />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all text-sm flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? 'Generating...' : 'Generate Pay Link'}</span>
            </button>
          </form>
        ) : (
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-black text-slate-900">Pay Link Ready!</h3>
              <p className="text-xs font-bold text-indigo-600 mt-1">
                {title} · {formatMoney(parseFloat(amount) || 0)}
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-bold text-slate-700 truncate">
              {generatedLink}
            </div>

            <div className="space-y-2">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Pay via LUMO Split Pay Link for ${title}: ${generatedLink}`)}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow flex items-center justify-center space-x-2 text-sm"
              >
                <MessageCircle className="w-5 h-5" />
                <span>Share via WhatsApp</span>
              </a>

              <button
                onClick={handleCopy}
                className="w-full py-3 bg-white border border-slate-200 text-slate-800 font-bold rounded-2xl text-xs flex items-center justify-center space-x-2 hover:bg-slate-50"
              >
                <Copy className="w-4 h-4 text-indigo-600" />
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={() => setGeneratedLink('')}
                className="text-xs text-slate-500 font-semibold hover:underline pt-2 block mx-auto"
              >
                + Create Another Pay Link
              </button>
            </div>
          </div>
        )
      ) : (
        /* MY ACTIVE LINKS TAB */
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              My Pay Links ({myLinks.length})
            </h3>
            <button
              onClick={fetchMyLinks}
              disabled={loadingLinks}
              className="text-xs font-bold text-indigo-600 inline-flex items-center space-x-1"
            >
              <RefreshCw className={`w-3 h-3 ${loadingLinks ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loadingLinks ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading links...</div>
          ) : myLinks.length === 0 ? (
            <div className="bg-white p-8 rounded-3xl border border-slate-100 text-center space-y-2">
              <Clock className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">No payment links created yet</p>
              <button
                onClick={() => setActiveTab('create')}
                className="text-xs font-extrabold text-indigo-600 hover:underline"
              >
                + Create your first link
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {myLinks.map((l) => {
                const url = `${window.location.origin}/s/${l.public_token}`;
                return (
                  <div key={l.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-xs">{l.title}</h4>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                          l.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                          l.status === 'EXPIRED' ? 'bg-rose-50 text-rose-700' : 'bg-blue-50 text-blue-700'
                        }`}>
                          {l.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5 font-mono">Token: {l.public_token}</p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-slate-900 block">{formatMoney(l.amount)}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          alert(`Link copied: ${url}`);
                        }}
                        className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center space-x-1"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
