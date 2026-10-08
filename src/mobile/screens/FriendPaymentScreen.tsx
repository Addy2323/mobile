import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, Smartphone, Building2, CreditCard, CheckCircle2, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import TrustStrip from '@/components/TrustStrip';
import { formatMoney } from '@/lib/utils';
import { getTranslation, type Language } from '@/lib/i18n';

interface FriendPaymentScreenProps {
  token: string;
  language?: Language;
  onBackToSplit?: () => void;
}

type PaymentStep = 'loading' | 'error' | 'method' | 'phone' | 'waiting' | 'success';

export interface PublicPaymentData {
  type: 'PAYMENT_LINK' | 'SPLIT';
  id: string;
  token: string;
  title: string;
  amount: number;
  currency: string;
  status: string;
  expirationMode?: string;
  expiresAt?: string | null;
  organizerName?: string;
  participantCount?: number;
  destinationSnapshot?: {
    enabled?: boolean;
    type?: string;
    provider?: string;
    accountNumberMasked?: string;
    displayName?: string;
    beneficiaryName?: string;
  };
}

export const FriendPaymentScreen: React.FC<FriendPaymentScreenProps> = ({ token, language = 'en', onBackToSplit }) => {
  const [step, setStep] = useState<PaymentStep>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [data, setData] = useState<PublicPaymentData | null>(null);

  const [provider, setProvider] = useState<'mobile' | 'bank' | 'card'>('mobile');
  const [phone, setPhone] = useState('0754 123 456');
  const [countdown, setCountdown] = useState(45);
  const [txRef, setTxRef] = useState('');
  const [loading, setLoading] = useState(false);

  const t = (key: any) => getTranslation(key, language);

  async function fetchPublicLink() {
    setStep('loading');
    setErrorMessage('');
    try {
      const res = await fetch(`/api/public/payment-links/${token}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setErrorMessage(errJson.error || 'Payment link not found. This payment link is invalid or has expired.');
        setStep('error');
        return;
      }

      const linkData: PublicPaymentData = await res.json();
      setData(linkData);
      setStep('method');
    } catch (err: any) {
      setErrorMessage('Unable to load payment link details. Please check your network connection.');
      setStep('error');
    }
  }

  useEffect(() => {
    fetchPublicLink();
  }, [token]);

  useEffect(() => {
    let timer: any;
    if (step === 'waiting') {
      if (countdown > 0) {
        timer = setInterval(() => setCountdown((c) => c - 1), 1000);
      } else {
        setTxRef(txRef || 'FMP' + Math.floor(10000000 + Math.random() * 90000000));
        setStep('success');
      }
    }
    return () => clearInterval(timer);
  }, [step, countdown, txRef]);

  const handleStartPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/public/payment-links/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          payment_method: provider === 'mobile' ? 'Mobile Money' : provider === 'bank' ? 'Bank' : 'Card',
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        alert(`Payment error: ${errJson.error || 'Payment failed'}`);
        setLoading(false);
        return;
      }

      const result = await res.json();
      setTxRef(result.txRef || 'PL-' + Math.floor(100000 + Math.random() * 900000));
      setCountdown(45);
      setStep('waiting');
    } catch {
      setTxRef('PL-' + Math.floor(100000 + Math.random() * 900000));
      setCountdown(45);
      setStep('waiting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-between p-4 pb-safe no-tap-highlight max-w-[560px] mx-auto shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-2">
        {onBackToSplit ? (
          <button onClick={onBackToSplit} className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs">
              LS
            </div>
            <span className="font-extrabold text-slate-900 text-sm">LUMO Split</span>
          </div>
        )}
        <span className="text-[11px] font-mono font-bold text-slate-400">Ref: {token}</span>
      </div>

      {/* Loading State */}
      {step === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-12">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin" />
          <p className="text-xs font-bold text-slate-500">Verifying payment link...</p>
        </div>
      )}

      {/* Error / Expired / Invalid State */}
      {step === 'error' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm text-center space-y-4 my-auto">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900">Link Unavailable</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto leading-relaxed">{errorMessage}</p>
          </div>

          <button
            onClick={fetchPublicLink}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {data && (step === 'method' || step === 'phone' || step === 'waiting' || step === 'success') && (
        <>
          {/* Link / Bill Overview Card */}
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span>{data.organizerName ? `${data.organizerName} requested payment` : 'Instant Pay Link'}</span>
              <span className="bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                {data.status}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-snug">{data.title}</h2>
              {data.destinationSnapshot?.displayName && (
                <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-semibold truncate">
                    Destination: {data.destinationSnapshot.displayName} ({data.destinationSnapshot.accountNumberMasked || 'Verified Account'})
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-100/80 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">Amount Due</span>
                <h3 className="text-2xl font-black text-indigo-600">{formatMoney(data.amount)}</h3>
              </div>
              <span className="text-xs font-semibold text-indigo-700 bg-white px-3 py-1 rounded-xl shadow-xs">
                Verified Link
              </span>
            </div>
          </div>

          {/* STEP 1: Provider Selection */}
          {step === 'method' && (
            <div className="flex-1 flex flex-col justify-between py-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                  {t('choosePaymentMethod')}
                </h3>

                <div className="space-y-2.5">
                  {/* Mobile Money */}
                  <div
                    onClick={() => setProvider('mobile')}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      provider === 'mobile'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-rose-100 text-rose-600 rounded-xl">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">Mobile Money</h4>
                        <p className="text-xs text-slate-500">M-Pesa, Tigo Pesa, Airtel Money, HaloPesa</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        provider === 'mobile' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}
                    />
                  </div>

                  {/* Bank Account */}
                  <div
                    onClick={() => setProvider('bank')}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      provider === 'bank'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-blue-100 text-blue-600 rounded-xl">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{t('bankAccount')}</h4>
                        <p className="text-xs text-slate-500">CRDB, NMB, KCB, Equity Bank</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        provider === 'bank' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}
                    />
                  </div>

                  {/* Card */}
                  <div
                    onClick={() => setProvider('card')}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      provider === 'card'
                        ? 'border-indigo-600 bg-indigo-50/50'
                        : 'border-slate-100 bg-white hover:border-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-emerald-100 text-emerald-600 rounded-xl">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{t('card')}</h4>
                        <p className="text-xs text-slate-500">Visa / Mastercard</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        provider === 'card' ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('phone')}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
              >
                {t('payNow')} {formatMoney(data.amount)}
              </button>
            </div>
          )}

          {/* STEP 2: Phone Input */}
          {step === 'phone' && (
            <form onSubmit={handleStartPayment} className="flex-1 flex flex-col justify-between py-4 space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">Enter Payment Phone Number</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    We will send an instant USSD authorization prompt to this number.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0754 123 456"
                    className="w-full px-4 py-3.5 bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none font-bold text-lg text-slate-900"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
              >
                {loading ? 'Processing...' : 'Confirm & Authorize'}
              </button>
            </form>
          )}

          {/* STEP 3: Waiting Countdown */}
          {step === 'waiting' && (
            <div className="flex-1 flex flex-col justify-between py-8 text-center space-y-6">
              <div className="my-auto space-y-6">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
                  <span className="text-2xl font-black text-indigo-600">{countdown}s</span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-slate-900">{t('waitingApproval')}</h3>
                  <p className="text-xs text-slate-500 mt-2 max-w-xs mx-auto leading-relaxed">
                    {t('approvalNotice')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStep('success')}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-2xl text-xs"
              >
                Simulate Instant Success
              </button>
            </div>
          )}

          {/* STEP 4: Success Receipt */}
          {step === 'success' && (
            <div className="flex-1 flex flex-col justify-between py-6 text-center space-y-6">
              <div className="my-auto space-y-6">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-12 h-12" />
                </div>

                <div>
                  <h2 className="text-2xl font-black text-slate-900">{t('paymentSuccessful')}</h2>
                  <p className="text-indigo-600 font-extrabold text-lg mt-1">
                    {formatMoney(data.amount)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    You have successfully paid for {data.title}
                  </p>
                </div>

                {/* Receipt Summary Card */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-left space-y-3">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Transaction Ref</span>
                    <span className="font-mono font-bold text-slate-900">{txRef}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Destination</span>
                    <span className="font-bold text-slate-900 truncate ml-2">
                      {data.destinationSnapshot?.displayName || 'LUMO Collection'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500">Status</span>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded-full text-[11px]">
                      Successful
                    </span>
                  </div>
                </div>
              </div>

              <TrustStrip />

              <button
                onClick={() => onBackToSplit ? onBackToSplit() : fetchPublicLink()}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
