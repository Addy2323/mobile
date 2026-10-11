import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Smartphone, CheckCircle, AlertCircle, Loader2, ArrowRight, RefreshCw, ShieldCheck } from 'lucide-react';
import { initiateDeposit, checkDepositStatus, type DepositStatusResult } from '../lib/ledgerApi';

interface DepositModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

type Step = 'INPUT' | 'WAITING_PIN' | 'SUCCESS' | 'FAILED';

export const DepositModal: React.FC<DepositModalProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<Step>('INPUT');
  const [amount, setAmount] = useState<string>('10000');
  const [phone, setPhone] = useState<string>(''); // Clean, no pre-filled numbers
  const [provider, setProvider] = useState<string>('Vodacom M-Pesa');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Transaction Tracking State
  const [depositRef, setDepositRef] = useState<string>('');
  const [providerTxRef, setProviderTxRef] = useState<string>('');
  const [countdown, setCountdown] = useState<number>(90);
  const [successDetails, setSuccessDetails] = useState<any | null>(null);

  const pollIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const formatPhoneNumber = (raw: string) => {
    let clean = raw.trim().replace(/[^\d+]/g, '');
    if (clean.startsWith('+')) clean = clean.slice(1);
    if (clean.startsWith('0')) clean = '255' + clean.slice(1);
    if (!clean.startsWith('255') && clean.length === 9) clean = '255' + clean;
    return clean;
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 500) {
      setError('Please enter an amount of at least TZS 500');
      return;
    }

    const cleanPhone = formatPhoneNumber(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      setError('Please enter a valid phone number (e.g. 0754 123 456)');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await initiateDeposit(numAmount, cleanPhone, provider);

      setDepositRef(res.depositRef || '');
      setProviderTxRef(res.providerTxRef || '');

      // If sandbox immediate confirm
      if (res.isConfirmed) {
        setSuccessDetails({
          amount: numAmount,
          ref: res.depositRef,
          phone: cleanPhone,
          message: res.message
        });
        setStep('SUCCESS');
        return;
      }

      // Switch to Waiting for USSD PIN state
      setStep('WAITING_PIN');
      setCountdown(90);
      startPolling(res.depositRef, res.providerTxRef, numAmount);
    } catch (err: any) {
      setError(err.message || 'Deposit initiation failed');
    } finally {
      setLoading(false);
    }
  };

  const startPolling = (ref: string, pRef: string, numAmount: number) => {
    // Clear existing
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    // 1. Countdown timer
    timerIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          clearInterval(pollIntervalRef.current);
          setError('Payment confirmation timed out. If you entered your PIN, your balance will update shortly.');
          setStep('FAILED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // 2. Poll every 2.5 seconds
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes: DepositStatusResult = await checkDepositStatus(ref, pRef, numAmount);
        if (statusRes.status === 'SUCCESS' || statusRes.isPaid) {
          clearInterval(pollIntervalRef.current);
          clearInterval(timerIntervalRef.current);
          setSuccessDetails({
            amount: numAmount,
            ref: statusRes.depositRef || ref,
            phone: formatPhoneNumber(phone),
            message: statusRes.message || 'Deposit confirmed successfully!'
          });
          setStep('SUCCESS');
        } else if (statusRes.status === 'FAILED' || statusRes.isFailed) {
          clearInterval(pollIntervalRef.current);
          clearInterval(timerIntervalRef.current);
          setError(statusRes.message || 'Transaction was rejected or cancelled.');
          setStep('FAILED');
        }
      } catch (e) {
        // Continue polling silently
      }
    }, 2500);
  };

  const handleFinishSuccess = () => {
    onSuccess();
    onClose();
  };

  const handleRetry = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setError(null);
    setStep('INPUT');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        {step !== 'WAITING_PIN' && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* STEP 1: INPUT FORM */}
        {step === 'INPUT' && (
          <div>
            <div className="flex items-center space-x-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Deposit Funds</h3>
                <p className="text-xs text-slate-400">Load money into your LUMO Member Card</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleDepositSubmit} className="space-y-4">
              {/* Quick Amount Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">Select Amount (TZS)</label>
                <div className="grid grid-cols-3 gap-2">
                  {QUICK_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setAmount(val.toString())}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                        amount === val.toString()
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                          : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      TZS {val.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Amount Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Custom Amount (TZS)</label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-sm font-semibold"
                  required
                />
              </div>

              {/* Mobile Provider */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Money Provider</label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-medium focus:outline-none focus:border-emerald-500"
                >
                  <option value="Vodacom M-Pesa">Vodacom M-Pesa</option>
                  <option value="Tigo Pesa">Tigo Pesa</option>
                  <option value="Airtel Money">Airtel Money</option>
                  <option value="HaloPesa">HaloPesa</option>
                </select>
              </div>

              {/* Phone Number Input (Blank with helpful placeholder) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Phone Number</label>
                <div className="relative">
                  <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0754 123 456 or 255754123456"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">A USSD push notification will be sent to this handset.</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Sending USSD Prompt...</span>
                  </>
                ) : (
                  <span>Confirm Deposit</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: WAITING FOR USSD PIN CONFIRMATION */}
        {step === 'WAITING_PIN' && (
          <div className="py-4 text-center space-y-5">
            {/* Pulsing Phone Animation */}
            <div className="relative flex items-center justify-center w-24 h-24 mx-auto">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping opacity-75" />
              <div className="absolute inset-2 rounded-full bg-emerald-500/30 animate-pulse" />
              <div className="relative z-10 w-16 h-16 rounded-full bg-slate-950 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-xl shadow-emerald-500/30">
                <Smartphone className="w-8 h-8 animate-bounce" />
              </div>
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>USSD Prompt Sent</span>
              </span>
              <h3 className="text-xl font-black text-white">Approve on Your Phone</h3>
              <p className="text-xs text-slate-300 max-w-xs mx-auto leading-relaxed">
                Please check your handset for the <strong className="text-emerald-400">{provider}</strong> prompt and enter your Mobile Money PIN to authorize <strong className="text-white">TZS {Number(amount).toLocaleString()}</strong>.
              </p>
            </div>

            {/* Target Phone & Countdown Info */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-1.5 text-xs text-slate-400 font-mono">
              <div className="flex justify-between items-center">
                <span>Target Phone:</span>
                <span className="text-white font-bold">{formatPhoneNumber(phone)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Reference:</span>
                <span className="text-emerald-400 font-bold">{depositRef || 'Pending'}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-800/80">
                <span>Time Remaining:</span>
                <span className="text-amber-400 font-bold">{Math.floor(countdown / 60)}:{('0' + (countdown % 60)).slice(-2)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center space-x-2 text-xs text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Waiting for your PIN confirmation...</span>
            </div>

            <button
              onClick={handleRetry}
              className="text-xs text-slate-400 hover:text-white underline transition-colors pt-1"
            >
              Cancel or change phone number
            </button>
          </div>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION */}
        {step === 'SUCCESS' && (
          <div className="py-4 text-center space-y-5 animate-scaleUp">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border-2 border-emerald-400/60 flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/25">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Transaction</span>
              </span>
              <h3 className="text-2xl font-black text-white">Deposit Successful!</h3>
              <p className="text-xs text-slate-300 max-w-xs mx-auto">
                <strong className="text-emerald-400 text-base font-black">
                  TZS {Number(successDetails?.amount || amount).toLocaleString()}
                </strong>{' '}
                has been credited to your LUMO Member Card.
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs font-mono space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Ref Code:</span>
                <span className="text-white font-bold">{successDetails?.ref || depositRef}</span>
              </div>
              <div className="flex justify-between">
                <span>Method:</span>
                <span className="text-slate-300">{provider}</span>
              </div>
            </div>

            <button
              onClick={handleFinishSuccess}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all"
            >
              <span>Done & View Card Balance</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* STEP 4: FAILED / TIMED OUT */}
        {step === 'FAILED' && (
          <div className="py-4 text-center space-y-5 animate-scaleUp">
            <div className="w-16 h-16 rounded-full bg-rose-500/20 text-rose-400 border-2 border-rose-400/60 flex items-center justify-center mx-auto shadow-xl shadow-rose-500/25">
              <AlertCircle className="w-10 h-10" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white">Deposit Not Completed</h3>
              <p className="text-xs text-rose-300 max-w-xs mx-auto">
                {error || 'The USSD prompt was rejected or timed out before PIN authorization.'}
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-400 leading-relaxed text-left">
              <p className="font-bold text-slate-300 mb-1">Common reasons:</p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                <li>Handset did not display the prompt in time</li>
                <li>Incorrect Mobile Money PIN entered</li>
                <li>Insufficient balance on mobile money SIM</li>
              </ul>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleRetry}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center space-x-1.5 transition-all shadow-lg shadow-emerald-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
