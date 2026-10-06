import React, { useState } from 'react';
import { ArrowLeft, Link as LinkIcon, Copy, Share2, MessageCircle, Check, Sparkles, Clock, Layers } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';

interface PayLinkScreenProps {
  onBack: () => void;
  language: Language;
}

export const PayLinkScreen: React.FC<PayLinkScreenProps> = ({ onBack, language }) => {
  const [activeTab, setActiveTab] = useState<'create' | 'links'>('create');

  const [title, setTitle] = useState('Weekend Trip Contribution');
  const [amount, setAmount] = useState('50000');
  const [expiryDays, setExpiryDays] = useState('7');
  const [generatedLink, setGeneratedLink] = useState('');
  const [copied, setCopied] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  const presets = ['10000', '25000', '50000', '100000'];

  const activeLinks = [
    { title: 'Concert Ticket Share', amount: 35000, token: 'S-77A1', expires: 'In 3 days', status: 'Active' },
    { title: 'Weekend Lunch Split', amount: 20000, token: 'S-99B2', expires: 'In 6 days', status: 'Active' },
  ];

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const token = 'PAY-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    setGeneratedLink(`${window.location.origin}/s/${token}`);
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
          <form onSubmit={handleGenerate} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
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
                <label className="text-xs font-bold text-slate-600 mb-1 block">Link Expiry</label>
                <select
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-sm text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="1">Expires in 24 Hours</option>
                  <option value="7">Expires in 7 Days</option>
                  <option value="30">Expires in 30 Days</option>
                  <option value="0">Never Expires</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all text-sm flex items-center justify-center space-x-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Generate Pay Link</span>
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
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
            Active Pay Links ({activeLinks.length})
          </h3>

          <div className="space-y-2">
            {activeLinks.map((l, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs">{l.title}</h4>
                  <p className="text-[10px] text-slate-500">{l.expires}</p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-black text-slate-900 block">{formatMoney(l.amount)}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/s/${l.token}`);
                      alert(`Link copied: ${window.location.origin}/s/${l.token}`);
                    }}
                    className="text-[10px] font-bold text-indigo-600 hover:underline inline-flex items-center space-x-1"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
