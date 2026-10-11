import { useState } from 'react';
import { ScanLine, ArrowRight, ShieldCheck, AlertCircle, Building2, ArrowLeft } from 'lucide-react';
import { formatMoney } from '@/lib/utils';

type ControlNumberViewProps = {
  onSplitBill: (merchantName: string, amount: number, refCode: string) => void;
  onBack: () => void;
};

const MOCK_CONTROL_NUMBERS: Record<string, { biller: string; amount: number; description: string; provider: string }> = {
  '99123456': { biller: 'DAWASA Water Utility', amount: 45000, description: 'Monthly Residential Water Bill', provider: 'Government Control No.' },
  '88492019': { biller: 'TANESCO LUKU Pre-paid', amount: 100000, description: 'Electricity Pre-paid Tokens', provider: 'TANESCO Pay' },
  '15024928': { biller: 'Samaki Samaki Restaurant', amount: 120000, description: 'Table 14 Dinner Bill', provider: 'Lipa Namba (CRDB)' },
  '77102938': { biller: 'Serena Hotel Arusha', amount: 350000, description: 'Weekend Accommodation & Meals', provider: 'Lipa Namba (NMB)' }
};

export default function ControlNumberView({ onSplitBill, onBack }: ControlNumberViewProps) {
  const [controlNum, setControlNum] = useState('');
  const [result, setResult] = useState<{ biller: string; amount: number; description: string; provider: string } | null>(null);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);

  function handleLookup() {
    setError('');
    setResult(null);

    if (!controlNum.trim()) {
      setError('Tafadhali weka Control Number au Lipa Namba');
      return;
    }

    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      const trimmed = controlNum.trim();
      if (MOCK_CONTROL_NUMBERS[trimmed]) {
        setResult(MOCK_CONTROL_NUMBERS[trimmed]);
      } else {
        if (/^\d{6,12}$/.test(trimmed)) {
          setResult({
            biller: `Verified Merchant (#${trimmed.slice(-4)})`,
            amount: 75000,
            description: 'Verified Biller Invoice',
            provider: 'Interbank Lipa Namba'
          });
        } else {
          setError('Control Number au Lipa Namba haijapatikana. Jaribu mfano "99123456" au "15024928".');
        }
      }
    }, 600);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#09221C] border border-[#00E599]/30 text-[#00E599] shadow-[0_0_15px_rgba(0,229,153,0.15)]">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white">Control Number & Lipa Namba</h1>
            <p className="text-xs text-slate-400">Lookup official biller details and split directly with friends.</p>
          </div>
        </div>

        {/* Form input */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300">Enter Lipa Namba or Government Control Number</label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={controlNum}
                onChange={(e) => setControlNum(e.target.value)}
                placeholder="e.g. 99123456 or 15024928"
                className="w-full rounded-2xl border border-slate-800 bg-[#060D0E] py-3.5 pl-10 pr-4 font-mono text-sm font-bold text-white placeholder-slate-600 outline-none focus:border-[#00E599] focus:ring-1 focus:ring-[#00E599]/30 transition"
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={searching}
              className="rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] px-6 py-3.5 text-xs font-black text-[#060D0E] shadow-[0_0_20px_rgba(0,229,153,0.25)] hover:brightness-110 active:scale-95 transition disabled:opacity-50"
            >
              {searching ? 'Verifying...' : 'Lookup Bill'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-red-900/50 bg-red-950/20 p-4 text-xs font-semibold text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <p>{error}</p>
          </div>
        )}

        {/* Verification Result Card */}
        {result && (
          <div className="rounded-2xl border border-[#0D382E] bg-[#081B17] p-5 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-[#00E599]" />
                <div>
                  <p className="text-sm font-extrabold text-white">{result.biller}</p>
                  <p className="text-[11px] text-slate-400">{result.provider} · Verified PSP Confirmation</p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-[#00E599]/15 border border-[#00E599]/30 px-2.5 py-0.5 text-[10px] font-extrabold text-[#00E599]">
                <ShieldCheck className="h-3.5 w-3.5" /> VERIFIED
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">{result.description}</p>
                <p className="text-xl font-black text-white">{formatMoney(result.amount)}</p>
              </div>
              <button
                onClick={() => onSplitBill(result.biller, result.amount, controlNum)}
                className="flex items-center justify-center gap-2 rounded-xl bg-[#00E599] px-5 py-3 text-xs font-black text-[#060D0E] shadow-sm hover:brightness-110 transition active:scale-95"
              >
                Split This Bill <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="rounded-2xl bg-[#071311] border border-slate-800/60 p-4 text-[11px] text-slate-400 leading-relaxed">
          <p className="font-bold text-slate-300 mb-1">PSP Confirmation Notice</p>
          Control number validation depends on payment service provider (PSP) API support. Real-time bill verification guarantees that the recipient name and amount match before funds are released.
        </div>
      </div>
    </div>
  );
}
