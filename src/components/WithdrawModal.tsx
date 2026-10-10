import React, { useState } from 'react';
import { X, ArrowUpRight, Smartphone, Building, ShieldAlert, Loader2, CheckCircle } from 'lucide-react';
import { requestWithdrawal } from '../lib/ledgerApi';

interface WithdrawModalProps {
  availableBalance: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({ availableBalance, onClose, onSuccess }) => {
  const [amount, setAmount] = useState<string>('15000');
  const [destType, setDestType] = useState<'MOBILE_MONEY' | 'BANK'>('MOBILE_MONEY');
  const [phone, setPhone] = useState<string>('255754123456');
  const [bankName, setBankName] = useState<string>('CRDB Bank');
  const [accountNumber, setAccountNumber] = useState<string>('0152849204820');
  const [recipientName, setRecipientName] = useState<string>('Dev Stromer');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const numAmount = Number(amount) || 0;
  const fee = numAmount > 50000 ? 1000 : 500;
  const netAmount = Math.max(0, numAmount - fee);

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      setError('Please enter a valid withdrawal amount');
      return;
    }
    if (numAmount > availableBalance) {
      setError(`Insufficient available balance. You have TZS ${availableBalance.toLocaleString()}`);
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
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white bg-slate-800/80 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Withdraw Funds</h3>
            <p className="text-xs text-slate-400">Transfer from card balance to Mobile or Bank</p>
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
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Request Submitted</h4>
            <p className="text-xs text-slate-300">{successData.message}</p>
            <p className="text-[11px] font-mono text-emerald-400">Ref: {successData.withdrawalRequest?.reference_code}</p>
          </div>
        ) : (
          <form onSubmit={handleWithdrawSubmit} className="space-y-4">
            {/* Balance Notice */}
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Available to Withdraw:</span>
              <span className="font-bold text-emerald-400">TZS {availableBalance.toLocaleString()}</span>
            </div>

            {/* Destination Type Selector */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDestType('MOBILE_MONEY')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all ${
                  destType === 'MOBILE_MONEY'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-4 h-4" />
                <span>Mobile Money</span>
              </button>

              <button
                type="button"
                onClick={() => setDestType('BANK')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center space-x-2 transition-all ${
                  destType === 'BANK'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Building className="w-4 h-4" />
                <span>Bank Account</span>
              </button>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Withdrawal Amount (TZS)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 text-sm font-semibold"
                required
              />
            </div>

            {/* Destination details fields */}
            {destType === 'MOBILE_MONEY' ? (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Recipient Mobile Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="255XXXXXXXXX"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Bank Name</label>
                  <select
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                  >
                    <option value="CRDB Bank">CRDB Bank</option>
                    <option value="NMB Bank">NMB Bank</option>
                    <option value="KCB Bank">KCB Bank Tanzania</option>
                    <option value="NBC Bank">NBC Bank</option>
                    <option value="Stanbic Bank">Stanbic Bank</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Account Number</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Enter bank account number"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Beneficiary Full Name</label>
              <input
                type="text"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="Full name matching account"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            {/* Fee Breakdown Card */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Network Processing Fee:</span>
                <span>TZS {fee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-white font-bold pt-1 border-t border-slate-800">
                <span>Net Transfer Amount:</span>
                <span className="text-emerald-400">TZS {netAmount.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || numAmount > availableBalance}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Request...</span>
                </>
              ) : (
                <span>Submit Withdrawal Request</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
