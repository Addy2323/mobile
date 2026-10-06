import React, { useState } from 'react';
import { ArrowLeft, Zap, Droplet, Landmark, GraduationCap, Tv, Search, Users, ArrowRight } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';

interface PayBillScreenProps {
  onBack: () => void;
  onSplitBill: (billerName: string, amount: number) => void;
  language: Language;
}

export const PayBillScreen: React.FC<PayBillScreenProps> = ({ onBack, onSplitBill, language }) => {
  const [controlNumber, setControlNumber] = useState('991234567890');
  const [biller, setBiller] = useState('TANESCO LUKU');
  const [amount, setAmount] = useState('40000');
  const [validated, setValidated] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  const billers = [
    { name: 'TANESCO LUKU', category: 'Electricity', icon: <Zap className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
    { name: 'DAWASA Water', category: 'Water', icon: <Droplet className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
    { name: 'Govt Control No (GePG)', category: 'Tax / Permit', icon: <Landmark className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
    { name: 'University / School', category: 'Education', icon: <GraduationCap className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50' },
    { name: 'Azam / DSTV', category: 'TV Subscription', icon: <Tv className="w-5 h-5 text-rose-500" />, bg: 'bg-rose-50' },
  ];

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!controlNumber) return;
    setValidated(true);
  };

  return (
    <div className="p-4 space-y-5 no-tap-highlight">
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-1.5 -ml-1 text-slate-700 hover:text-slate-900 rounded-full hover:bg-slate-100">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-slate-900">{t('payABill')}</h2>
      </div>

      {/* Billers list selector */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Select Service Provider</h3>

        <div className="grid grid-cols-2 gap-2.5">
          {billers.map((b) => (
            <button
              key={b.name}
              onClick={() => {
                setBiller(b.name);
                setValidated(false);
              }}
              className={`p-3.5 rounded-2xl border-2 text-left flex items-center space-x-3 transition-all ${
                biller === b.name ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 bg-white hover:border-slate-200'
              }`}
            >
              <div className={`p-2.5 rounded-xl ${b.bg}`}>{b.icon}</div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-slate-900 text-xs truncate">{b.name}</h4>
                <p className="text-[10px] text-slate-500 truncate">{b.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Control Number Input */}
      <form onSubmit={handleValidate} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-600 mb-1 block">Control Number / Meter / Account</label>
          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              value={controlNumber}
              onChange={(e) => {
                setControlNumber(e.target.value);
                setValidated(false);
              }}
              placeholder="e.g. 991234567890"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 text-sm focus:outline-none focus:border-indigo-600"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs hover:bg-indigo-700"
            >
              Lookup
            </button>
          </div>
        </div>

        {validated && (
          <div className="space-y-4 pt-3 border-t border-slate-100">
            <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-1">
              <span className="text-[10px] font-bold text-indigo-700 uppercase">Validated Bill Info</span>
              <h4 className="font-extrabold text-slate-900 text-sm">Customer: GIVEN MHEMA</h4>
              <p className="text-xs text-slate-600">Biller: {biller}</p>
              <p className="text-sm font-black text-indigo-600 pt-1">Due Amount: {formatMoney(parseFloat(amount) || 40000)}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onSplitBill(biller, parseFloat(amount) || 40000)}
                className="py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow text-xs flex items-center justify-center space-x-1.5"
              >
                <Users className="w-4 h-4" />
                <span>Split This Bill</span>
              </button>

              <button
                type="button"
                onClick={() => alert('Proceeding to solo bill payment')}
                className="py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow text-xs flex items-center justify-center space-x-1.5"
              >
                <span>Pay Solo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
