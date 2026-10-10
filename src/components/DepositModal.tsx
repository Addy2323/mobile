import React, { useState } from 'react';
import { X, Plus, Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { initiateDeposit } from '../lib/ledgerApi';

interface DepositModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

export const DepositModal: React.FC<DepositModalProps> = ({ onClose, onSuccess }) => {
  const [amount, setAmount] = useState<string>('10000');
  const [phone, setPhone] = useState<string>('255754123456');
  const [provider, setProvider] = useState<string>('M-Pesa');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid deposit amount');
      return;
    }
    if (!phone || phone.length < 6) {
      setError('Please enter a valid mobile number');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await initiateDeposit(numAmount, phone, provider);
      setSuccessData(res);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Deposit failed');
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

        {successData ? (
          <div className="py-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <h4 className="text-lg font-bold text-white">Deposit Initiated!</h4>
            <p className="text-xs text-slate-300">{successData.message}</p>
            <p className="text-[11px] font-mono text-slate-400">Ref: {successData.depositRef}</p>
          </div>
        ) : (
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
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter deposit amount"
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
                <option value="M-Pesa">Vodacom M-Pesa</option>
                <option value="Tigo Pesa">Tigo Pesa</option>
                <option value="Airtel Money">Airtel Money</option>
                <option value="HaloPesa">HaloPesa</option>
              </select>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mobile Phone Number</label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="255XXXXXXXXX"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 mt-2"
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
        )}
      </div>
    </div>
  );
};
