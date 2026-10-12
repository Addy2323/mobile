import React, { useState, useEffect } from 'react';
import { X, ArrowUpRight, Smartphone, Building, ShieldAlert, Loader2, CheckCircle, Info, ArrowRight } from 'lucide-react';
import { requestWithdrawal, fetchWithdrawalQuote } from '../lib/ledgerApi';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface WithdrawModalProps {
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

// Configured Tiered Fee Schedule (Aligned with server withdrawalService)
const FEE_TIERS = [
  { min: 1, max: 50000, rate: 0.05, label: '5.0%' },
  { min: 50001, max: 200000, rate: 0.045, label: '4.5%' },
  { min: 200001, max: 1000000, rate: 0.02, label: '2.0%' },
  { min: 1000001, max: 5000000, rate: 0.015, label: '1.5%' },
  { min: 5000001, max: Infinity, rate: 0.01, label: '1.0%' }
];

function getLocalTierInfo(amount: number) {
  for (const t of FEE_TIERS) {
    if (amount >= t.min && amount <= t.max) return t;
  }
  return FEE_TIERS[0];
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ availableBalance, onClose, onSuccess }) => {
  useBodyScrollLock();
  const [amount, setAmount] = useState<string>('');
  const [destType, setDestType] = useState<'MOBILE_MONEY' | 'BANK'>('MOBILE_MONEY');
  const [phone, setPhone] = useState<string>(() => localStorage.getItem('lumo_user_phone') || '');
  const [bankName, setBankName] = useState<string>('CRDB Bank');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [recipientName, setRecipientName] = useState<string>(() => localStorage.getItem('lumo_user_name') || '');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);
  const [confirming, setConfirming] = useState<boolean>(false);

  const numAmount = Number(amount) || 0;
  const tier = getLocalTierInfo(numAmount);
  const fee = Math.round(numAmount * tier.rate);
  const netAmount = Math.max(0, numAmount - fee);
  const remainingBalance = Math.max(0, availableBalance - numAmount);

  // Sync quotes with server if user pauses typing
  useEffect(() => {
    if (numAmount < 5000 || numAmount > availableBalance) return;
    const timer = setTimeout(async () => {
      try {
        await fetchWithdrawalQuote(numAmount);
      } catch {
        // Fallback to local calculation
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [numAmount, availableBalance]);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a valid withdrawal amount.');
      return;
    }
    if (numAmount < 5000) {
      setError('Minimum withdrawal request is 5,000 TZS. Please increase withdraw amount.');
      return;
    }
    if (numAmount > availableBalance) {
      setError(`Insufficient available balance. You have TZS ${availableBalance.toLocaleString()}`);
      return;
    }

    if (!confirming) {
      setConfirming(true);
      return;
    }

    const destinationDetails = destType === 'MOBILE_MONEY'
      ? { phone, recipient_name: recipientName }
      : { bank_name: bankName, account_number: accountNumber, recipient_name: recipientName };

    try {
      setLoading(true);
      setError(null);
      const res = await requestWithdrawal(numAmount, destType, destinationDetails);
      setSuccessData(res);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Withdrawal request failed');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn overscroll-contain"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div className="relative w-full max-w-md bg-[#0C181A] border border-white/10 rounded-3xl p-6 shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain text-white">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-white/50 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tight">Withdraw Funds</h3>
            <p className="text-xs text-white/50">Disburse card funds to Mobile Money or Bank</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successData ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/40 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h4 className="text-lg font-bold text-white">Withdrawal Request Received</h4>
            <p className="text-xs text-slate-300">
              Only the requested TZS {numAmount.toLocaleString()} has been reserved.
            </p>
            <div className="p-3 bg-white/5 rounded-xl text-left text-xs space-y-1.5 border border-white/10">
              <div className="flex justify-between text-white/60">
                <span>Requested Amount:</span>
                <span className="font-mono text-white font-bold">TZS {numAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>Processing Fee ({tier.label}):</span>
                <span className="font-mono text-white/70">TZS {fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[#00E599] font-bold pt-1 border-t border-white/10">
                <span>Expected Payout:</span>
                <span className="font-mono">TZS {netAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-cyan-400 font-semibold pt-1">
                <span>Remaining Available:</span>
                <span className="font-mono">TZS {remainingBalance.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-[11px] font-mono text-white/40">Ref: {successData.withdrawal?.reference_code}</p>
          </div>
        ) : (
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            {/* Balance Notice & Withdraw Full Balance Action */}
            <div className="p-3.5 rounded-2xl bg-[#060D0E] border border-white/10 flex items-center justify-between text-xs">
              <div>
                <span className="text-white/50 block text-[11px]">Available Balance</span>
                <span className="font-extrabold text-base text-[#00E599]">TZS {availableBalance.toLocaleString()}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAmount(String(availableBalance));
                  setConfirming(false);
                }}
                className="px-3 py-1.5 rounded-xl bg-[#00E599]/15 hover:bg-[#00E599]/25 text-[#00E599] font-bold text-xs border border-[#00E599]/30 transition-all active:scale-95"
              >
                Withdraw full balance
              </button>
            </div>

            {/* Destination Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDestType('MOBILE_MONEY');
                  setConfirming(false);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all ${
                  destType === 'MOBILE_MONEY'
                    ? 'bg-[#00E599]/15 border-[#00E599] text-[#00E599]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile Money</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setDestType('BANK');
                  setConfirming(false);
                }}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all ${
                  destType === 'BANK'
                    ? 'bg-[#00E599]/15 border-[#00E599] text-[#00E599]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Bank Account</span>
              </button>
            </div>

            {/* Amount Field with Quick Percent Chips */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-white/80">Requested Amount (TZS)</label>
                <div className="flex gap-1">
                  {[0.25, 0.5, 0.75].map((pct) => {
                    const presetVal = Math.floor(availableBalance * pct);
                    if (presetVal < 1000) return null;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setAmount(String(presetVal));
                          setConfirming(false);
                        }}
                        className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold text-white/70"
                      >
                        {pct * 100}%
                      </button>
                    );
                  })}
                </div>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setConfirming(false);
                }}
                placeholder="Enter exact amount to withdraw"
                min="1000"
                max={availableBalance}
                className="w-full px-4 py-3 rounded-xl bg-[#060D0E] border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-[#00E599] text-base font-bold"
                required
              />
            </div>

            {/* Destination fields */}
            {destType === 'MOBILE_MONEY' ? (
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1">Recipient Mobile Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value);
                    setConfirming(false);
                  }}
                  placeholder="255XXXXXXXXX"
                  className="w-full px-4 py-2.5 rounded-xl bg-[#060D0E] border border-white/15 text-white text-sm font-mono focus:outline-none focus:border-[#00E599]"
                  required
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => {
                      setBankName(e.target.value);
                      setConfirming(false);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#060D0E] border border-white/15 text-white text-sm focus:outline-none focus:border-[#00E599]"
                  >
                    <option value="CRDB Bank">CRDB Bank</option>
                    <option value="NMB Bank">NMB Bank</option>
                    <option value="KCB Bank">KCB Bank Tanzania</option>
                    <option value="NBC Bank">NBC Bank</option>
                    <option value="Stanbic Bank">Stanbic Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-white/70 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => {
                      setAccountNumber(e.target.value);
                      setConfirming(false);
                    }}
                    placeholder="Enter bank account number"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#060D0E] border border-white/15 text-white text-sm font-mono focus:outline-none focus:border-[#00E599]"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Beneficiary Full Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => {
                  setRecipientName(e.target.value);
                  setConfirming(false);
                }}
                placeholder="Full name matching account"
                className="w-full px-4 py-2.5 rounded-xl bg-[#060D0E] border border-white/15 text-white text-sm focus:outline-none focus:border-[#00E599]"
                required
              />
            </div>

            {/* Real-time Financial Breakdown Card */}
            {numAmount > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#060D0E] border border-white/10 text-xs space-y-2">
                <div className="flex justify-between text-white/70">
                  <span>Amount to Reserve:</span>
                  <span className="font-mono text-white font-bold">TZS {numAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white/60">
                  <span>Configured Fee ({tier.label}):</span>
                  <span className="font-mono text-white/70">TZS {fee.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#00E599] font-black pt-1.5 border-t border-white/10">
                  <span>Net Payout to Recipient:</span>
                  <span className="font-mono text-sm">TZS {netAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white/60 pt-1">
                  <span>Remaining Available:</span>
                  <span className="font-mono font-semibold text-cyan-400">TZS {remainingBalance.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Confirmation Banner */}
            {confirming && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start space-x-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Please confirm this withdrawal:</span>
                  <span>
                    TZS {numAmount.toLocaleString()} will be reserved from your available balance.
                    Recipient receives TZS {netAmount.toLocaleString()}.
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || numAmount <= 0 || numAmount > availableBalance}
              className={`w-full py-3.5 px-4 rounded-xl font-black text-sm flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2 ${
                confirming
                  ? 'bg-[#00E599] hover:bg-[#00E599]/90 text-slate-950 shadow-lg shadow-[#00E599]/20'
                  : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : confirming ? (
                <>
                  <span>Confirm & Submit Withdrawal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <span>Review Withdrawal</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
