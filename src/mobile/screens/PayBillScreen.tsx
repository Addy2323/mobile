import React, { useState } from 'react';
import { ArrowLeft, Zap, Droplet, Landmark, GraduationCap, Tv, Users, ArrowRight, Home } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';
import { PaymentDestinationSelector, type PaymentDestinationConfig } from '@/components/PaymentDestinationSelector';
import { executeBillPayment } from '@/lib/ledgerApi';

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

  const [useCustomDestination, setUseCustomDestination] = useState(false);
  const [destination, setDestination] = useState<PaymentDestinationConfig | null>(null);

  const t = (key: any) => getTranslation(key, language);

  const billers = [
    { name: 'TANESCO LUKU', category: 'Electricity', icon: <Zap className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50' },
    { name: 'DAWASA Water', category: 'Water', icon: <Droplet className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50' },
    { name: 'House Utilities Share', category: 'Rent / House Bill', icon: <Home className="w-5 h-5 text-indigo-500" />, bg: 'bg-indigo-50' },
    { name: 'Govt Control No (GePG)', category: 'Tax / Permit', icon: <Landmark className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50' },
    { name: 'University / School', category: 'Education', icon: <GraduationCap className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-50' },
    { name: 'Azam / DSTV', category: 'TV Subscription', icon: <Tv className="w-5 h-5 text-rose-500" />, bg: 'bg-rose-50' },
  ];

  const handleValidate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!controlNumber) return;
    setValidated(true);
  };

  const [payingSolo, setPayingSolo] = useState(false);
  const [billReceipt, setBillReceipt] = useState<any | null>(null);
  const [billError, setBillError] = useState<string | null>(null);

  const handlePaySolo = async () => {
    try {
      setPayingSolo(true);
      setBillError(null);
      const res = await executeBillPayment(biller, controlNumber, parseFloat(amount) || 40000);
      setBillReceipt(res.billPayment || res);
    } catch (err: any) {
      setBillError(err.message || 'Bill payment failed');
    } finally {
      setPayingSolo(false);
    }
  };

  const handleCreateHouseContribution = async () => {
    try {
      const res = await fetch('/api/house-contributions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: `${biller} Bill`,
          bill_provider: biller,
          biller_control_number: controlNumber,
          amount_per_member: (parseFloat(amount) || 40000) / 2,
          target_members: 2,
          destination: useCustomDestination ? destination : null,
        }),
      });

      if (res.ok) {
        onSplitBill(biller, parseFloat(amount) || 40000);
      } else {
        onSplitBill(biller, parseFloat(amount) || 40000);
      }
    } catch {
      onSplitBill(biller, parseFloat(amount) || 40000);
    }
  };

  return (
    <div className="p-4 space-y-5 no-tap-highlight min-h-screen bg-[#060D0E] text-white">
      <div className="flex items-center space-x-2">
        <button onClick={onBack} className="p-1.5 -ml-1 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-white">{t('payABill')}</h2>
      </div>

      {/* Billers list selector */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider px-1">Select Service Provider</h3>

        <div className="grid grid-cols-2 gap-2.5">
          {billers.map((b) => (
            <button
              key={b.name}
              onClick={() => {
                setBiller(b.name);
                setValidated(false);
                setBillReceipt(null);
                setBillError(null);
              }}
              className={`p-3.5 rounded-2xl border-2 text-left flex items-center space-x-3 transition-all ${
                biller === b.name
                  ? 'border-[#00E599] bg-[#00E599]/10 shadow-lg shadow-[#00E599]/10'
                  : 'border-white/10 bg-[#0C181A] hover:border-white/20'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-white/5">{b.icon}</div>
              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-white text-xs truncate">{b.name}</h4>
                <p className="text-[10px] text-white/50 truncate">{b.category}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {billReceipt ? (
        <div className="bg-[#0C181A] text-white p-6 rounded-3xl space-y-4 border border-[#00E599]/30 shadow-xl text-center">
          <div className="w-12 h-12 rounded-full bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40 flex items-center justify-center mx-auto">
            <Zap className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Bill Payment Successful!</h3>
          <p className="text-xs text-white/70">Provider: {billReceipt.provider || biller}</p>
          <p className="text-xs text-white/70">Meter / Control No: {billReceipt.account_meter_number || controlNumber}</p>
          <p className="text-xl font-extrabold text-[#00E599]">TZS {(billReceipt.amount || parseFloat(amount) || 40000).toLocaleString()}</p>

          {billReceipt.token_code && (
            <div className="p-3.5 bg-[#081214] rounded-2xl border border-[#00E599]/30 text-left space-y-1">
              <span className="text-[10px] font-bold text-[#00E599] uppercase tracking-wider block">Electricity Token Code (LUKU)</span>
              <p className="font-mono text-base font-bold text-white tracking-widest">{billReceipt.token_code}</p>
              {billReceipt.units_purchased && (
                <p className="text-xs text-white/60">Units: {billReceipt.units_purchased}</p>
              )}
            </div>
          )}

          <p className="text-[11px] font-mono text-white/50">Receipt Ref: {billReceipt.receipt_ref || 'BILL-OK'}</p>

          <button
            onClick={() => { setBillReceipt(null); setValidated(false); }}
            className="w-full py-3 bg-[#00E599] hover:brightness-105 text-[#060D0E] font-black rounded-xl text-xs transition-all"
          >
            Done
          </button>
        </div>
      ) : (
        /* Control Number Input Form */
        <form onSubmit={handleValidate} className="space-y-4">
          <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl space-y-4">
            <div>
              <label className="text-xs font-bold text-white/80 mb-1 block">Control Number / Meter / Account</label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={controlNumber}
                  onChange={(e) => {
                    setControlNumber(e.target.value);
                    setValidated(false);
                    setBillError(null);
                  }}
                  placeholder="e.g. 991234567890"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl font-mono font-bold text-white text-sm placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#00E599] text-[#060D0E] font-black rounded-lg text-xs hover:brightness-105 transition-all"
                >
                  Lookup
                </button>
              </div>
            </div>

            {billError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium">
                {billError}
              </div>
            )}

            {validated && (
              <div className="space-y-4 pt-3 border-t border-white/10">
                <div className="p-3.5 bg-[#081214] rounded-2xl border border-[#00E599]/30 space-y-1">
                  <span className="text-[10px] font-bold text-[#00E599] uppercase">Validated Bill Info</span>
                  <h4 className="font-extrabold text-white text-sm">Customer Account Identified</h4>
                  <p className="text-xs text-white/70">Biller: {biller}</p>
                  <p className="text-sm font-black text-[#00E599] pt-1">Amount: {formatMoney(parseFloat(amount) || 40000)}</p>
                </div>

                <PaymentDestinationSelector
                  enabled={useCustomDestination}
                  onToggleEnabled={setUseCustomDestination}
                  destination={destination}
                  onChange={setDestination}
                  title="Biller / Settlement Destination"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCreateHouseContribution}
                    className="py-3.5 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 text-xs flex items-center justify-center space-x-1.5 transition-all"
                  >
                    <Users className="w-4 h-4" />
                    <span>Split This Bill</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePaySolo}
                    disabled={payingSolo}
                    className="py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold rounded-2xl shadow text-xs flex items-center justify-center space-x-1.5 disabled:opacity-50 transition-colors"
                  >
                    <span>{payingSolo ? 'Processing...' : 'Pay Solo'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
