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
  type: 'PAYMENT_LINK' | 'SPLIT' | 'BIRTHDAY_POOL' | 'MCHANGO' | 'CHARITY' | 'SAVINGS';
  categoryType?: string;
  id: string;
  token: string;
  title: string;
  description?: string;
  beneficiaryName?: string | null;
  beneficiaryOrganization?: string | null;
  amount: number;
  collectedAmount?: number;
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
  const [payerName, setPayerName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [phone, setPhone] = useState('');
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
      if (linkData.type === 'BIRTHDAY_POOL' || linkData.type === 'MCHANGO') {
        setCustomAmount('');
      } else if (linkData.amount) {
        setCustomAmount(String(linkData.amount));
      }
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
    if (!phone) {
      alert('Please enter your mobile phone number.');
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(`/api/public/payment-links/${token}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone,
          name: payerName.trim(),
          payer_name: payerName.trim(),
          amount: customAmount ? Number(customAmount) : (data?.amount || 0),
          payment_method: provider === 'mobile' ? 'Mobile Money' : provider === 'bank' ? 'Bank' : 'Card',
          is_anonymous: isAnonymous,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(`Payment error: ${errJson.error || 'Payment failed'}`);
        setLoading(false);
        return;
      }

      const result = await res.json();
      setTxRef(result.txRef || 'PL-' + Math.floor(100000 + Math.random() * 900000));
      setCountdown(45);
      setStep('waiting');
    } catch {
      alert('Network error. Payment was not started.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#060D0E] text-white flex flex-col justify-between p-4 pb-safe no-tap-highlight max-w-[560px] mx-auto shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between pt-2 pb-2">
        {onBackToSplit ? (
          <button onClick={onBackToSplit} className="p-1.5 -ml-1 text-white/80 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-[#00E599] rounded-xl flex items-center justify-center text-[#060D0E] font-black text-xs">
              LS
            </div>
            <span className="font-extrabold text-white text-sm">LUMO Split</span>
          </div>
        )}
        <span className="text-[11px] font-mono font-bold text-white/40">Ref: {token}</span>
      </div>

      {/* Loading State */}
      {step === 'loading' && (
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 py-12">
          <RefreshCw className="w-8 h-8 text-[#00E599] animate-spin" />
          <p className="text-xs font-bold text-white/60">Verifying payment link...</p>
        </div>
      )}

      {/* Error / Expired / Invalid State */}
      {step === 'error' && (
        <div className="bg-[#0C181A] p-6 rounded-3xl border border-white/10 shadow-xl text-center space-y-4 my-auto text-white">
          <div className="w-16 h-16 bg-rose-500/15 text-rose-400 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-black text-white">Link Unavailable</h3>
            <p className="text-xs text-white/60 mt-1 max-w-xs mx-auto leading-relaxed">{errorMessage}</p>
          </div>

          <button
            onClick={fetchPublicLink}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs flex items-center justify-center space-x-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {data && (step === 'method' || step === 'phone' || step === 'waiting' || step === 'success') && (
        <>
          {/* Link / Bill Overview Card */}
          <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-white/60">
              <span>{data.organizerName ? `${data.organizerName} requested payment` : 'Instant Pay Link'}</span>
              <span className="bg-[#00E599]/15 border border-[#00E599]/30 text-[#00E599] px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                {data.status}
              </span>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white leading-snug">{data.title}</h2>
              {data.destinationSnapshot?.displayName && (
                <div className="flex items-center space-x-1.5 text-xs text-white/60 mt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#00E599] shrink-0" />
                  <span className="font-semibold truncate">
                    Destination: {data.destinationSnapshot.displayName} ({data.destinationSnapshot.accountNumberMasked || 'Verified Account'})
                  </span>
                </div>
              )}
            </div>

            <div className="p-4 bg-[#081214] rounded-2xl border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-[#00E599] uppercase tracking-wider">
                  {data.type === 'BIRTHDAY_POOL' || data.type === 'MCHANGO' || data.type === 'CHARITY' || data.type === 'SAVINGS' ? 'Fundraiser Target' : 'Amount Due'}
                </span>
                <h3 className="text-2xl font-black text-white">{formatMoney(data.amount)}</h3>
                {(data.type === 'BIRTHDAY_POOL' || data.type === 'MCHANGO' || data.type === 'CHARITY' || data.type === 'SAVINGS') && (
                  <p className="text-[11px] font-semibold text-white/60 mt-0.5">
                    Collected: {formatMoney(data.collectedAmount || 0)}
                  </p>
                )}
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-xl border ${
                data.type === 'CHARITY'
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : data.type === 'SAVINGS'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'text-[#00E599] bg-[#00E599]/10 border-[#00E599]/20'
              }`}>
                {data.type === 'BIRTHDAY_POOL' ? 'Birthday Gift' : data.type === 'CHARITY' ? 'Charity Cause' : data.type === 'SAVINGS' ? 'Savings Goal' : data.type === 'MCHANGO' ? 'Michango' : 'Verified Link'}
              </span>
            </div>
          </div>

          {/* STEP 1: Provider Selection */}
          {step === 'method' && (
            <div className="flex-1 flex flex-col justify-between py-4 space-y-4">
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white/60 uppercase tracking-wider px-1">
                  {t('choosePaymentMethod')}
                </h3>

                <div className="space-y-2.5">
                  {/* Mobile Money */}
                  <div
                    onClick={() => setProvider('mobile')}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      provider === 'mobile'
                        ? 'border-[#00E599] bg-[#00E599]/10 shadow-lg shadow-[#00E599]/10'
                        : 'border-white/10 bg-[#0C181A] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-white/5 text-[#00E599] rounded-xl">
                        <Smartphone className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">Mobile Money</h4>
                        <p className="text-xs text-white/50">M-Pesa, Tigo Pesa, Airtel Money, HaloPesa</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        provider === 'mobile' ? 'border-[#00E599] bg-[#00E599] text-[#060D0E]' : 'border-white/30'
                      }`}
                    />
                  </div>

                  {/* Bank Account */}
                  <div
                    onClick={() => setProvider('bank')}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      provider === 'bank'
                        ? 'border-[#00E599] bg-[#00E599]/10 shadow-lg shadow-[#00E599]/10'
                        : 'border-white/10 bg-[#0C181A] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-white/5 text-[#00E599] rounded-xl">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{t('bankAccount')}</h4>
                        <p className="text-xs text-white/50">CRDB, NMB, KCB, Equity Bank</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        provider === 'bank' ? 'border-[#00E599] bg-[#00E599] text-[#060D0E]' : 'border-white/30'
                      }`}
                    />
                  </div>

                  {/* Card */}
                  <div
                    onClick={() => setProvider('card')}
                    className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                      provider === 'card'
                        ? 'border-[#00E599] bg-[#00E599]/10 shadow-lg shadow-[#00E599]/10'
                        : 'border-white/10 bg-[#0C181A] hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-white/5 text-[#00E599] rounded-xl">
                        <CreditCard className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">{t('card')}</h4>
                        <p className="text-xs text-white/50">Visa / Mastercard</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                        provider === 'card' ? 'border-[#00E599] bg-[#00E599] text-[#060D0E]' : 'border-white/30'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => setStep('phone')}
                className="w-full py-4 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 transition-all"
              >
                {t('payNow')} {formatMoney(data.amount)}
              </button>
            </div>
          )}

          {/* STEP 2: Phone & Contributor Input */}
          {step === 'phone' && (
            <form onSubmit={handleStartPayment} className="flex-1 flex flex-col justify-between py-4 space-y-4">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-white">Contributor Details</h3>
                  <p className="text-xs text-white/60 mt-0.5">
                    Enter your name and mobile number to authorize the instant payment.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-white/80 mb-1 block">Your Full Name</label>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="e.g. Kelvin John Mushi"
                      required
                      className="w-full px-4 py-3 bg-[#081214] rounded-2xl border border-white/10 focus:border-[#00E599] focus:outline-none font-bold text-sm text-white placeholder-white/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/80 mb-1 block">Phone Number (M-Pesa / Tigo Pesa / Airtel)</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="0754 123 456"
                      required
                      className="w-full px-4 py-3 bg-[#081214] rounded-2xl border border-white/10 focus:border-[#00E599] focus:outline-none font-bold text-lg text-white font-mono placeholder-white/30"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/80 mb-1 block">
                      {data.type === 'BIRTHDAY_POOL' || data.type === 'MCHANGO' || data.type === 'CHARITY' || data.type === 'SAVINGS' ? 'Your Contribution (TZS)' : 'Amount to Pay (TZS)'}
                    </label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder={data.type === 'BIRTHDAY_POOL' || data.type === 'MCHANGO' || data.type === 'CHARITY' || data.type === 'SAVINGS' ? 'e.g. 20000' : String(data.amount)}
                      required
                      className="w-full px-4 py-3 bg-[#081214] rounded-2xl border border-white/10 focus:border-[#00E599] focus:outline-none font-black text-lg text-white placeholder-white/30"
                    />
                  </div>

                  {(data.type === 'CHARITY' || data.type === 'MCHANGO' || data.type === 'BIRTHDAY_POOL') && (
                    <label className="flex items-center space-x-2.5 cursor-pointer pt-1 px-1">
                      <input
                        type="checkbox"
                        checked={isAnonymous}
                        onChange={(e) => setIsAnonymous(e.target.checked)}
                        className="w-4 h-4 rounded border-white/20 text-[#00E599] focus:ring-0 bg-[#081214]"
                      />
                      <span className="text-xs text-white/70 select-none">
                        Make my contribution anonymous on the public donor list
                      </span>
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (!customAmount && !data.amount)}
                className="w-full py-4 bg-gradient-to-r from-[#00E599] to-[#00C880] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 transition-all disabled:opacity-50"
              >
                {loading ? 'Processing...' : `Confirm & Pay ${formatMoney(Number(customAmount || data.amount || 0))}`}
              </button>
            </form>
          )}

          {/* STEP 3: Waiting Countdown */}
          {step === 'waiting' && (
            <div className="flex-1 flex flex-col justify-between py-8 text-center space-y-6">
              <div className="my-auto space-y-6">
                <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-white/10 border-t-[#00E599] animate-spin" />
                  <span className="text-2xl font-black text-[#00E599]">{countdown}s</span>
                </div>

                <div>
                  <h3 className="text-xl font-extrabold text-white">{t('waitingApproval')}</h3>
                  <p className="text-xs text-white/60 mt-2 max-w-xs mx-auto leading-relaxed">
                    {t('approvalNotice')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setStep('success')}
                className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-xs transition-colors"
              >
                Simulate Instant Success
              </button>
            </div>
          )}

          {/* STEP 4: Success Receipt */}
          {step === 'success' && (
            <div className="flex-1 flex flex-col justify-between py-6 text-center space-y-6">
              <div className="my-auto space-y-6">
                <div className="w-20 h-20 bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <CheckCircle2 className="w-12 h-12" />
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white">{t('paymentSuccessful')}</h2>
                  <p className="text-[#00E599] font-extrabold text-lg mt-1">
                    {formatMoney(data.amount)}
                  </p>
                  <p className="text-xs text-white/60 mt-1">
                    You have successfully paid for {data.title}
                  </p>
                </div>

                {/* Receipt Summary Card */}
                <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl text-left space-y-3">
                  <div className="flex justify-between items-center text-xs pb-2 border-b border-white/10">
                    <span className="text-white/60">Transaction Ref</span>
                    <span className="font-mono font-bold text-white">{txRef}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs pb-2 border-b border-white/10">
                    <span className="text-white/60">Destination</span>
                    <span className="font-bold text-white truncate ml-2">
                      {data.destinationSnapshot?.displayName || 'LUMO Collection'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs">
                    <span className="text-white/60">Status</span>
                    <span className="px-2.5 py-0.5 bg-[#00E599]/20 text-[#00E599] font-extrabold rounded-full text-[11px]">
                      Successful
                    </span>
                  </div>
                </div>
              </div>

              <TrustStrip />

              <button
                onClick={() => onBackToSplit ? onBackToSplit() : fetchPublicLink()}
                className="w-full py-4 bg-[#00E599] hover:brightness-105 active:scale-[0.98] text-[#060D0E] font-black rounded-2xl shadow-lg shadow-[#00E599]/20 transition-all"
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
