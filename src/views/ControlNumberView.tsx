import { useState } from 'react';
import { ScanLine, ArrowRight, ShieldCheck, AlertCircle, Building2, CheckCircle2, ArrowLeft } from 'lucide-react';
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
      setError('Please enter a Control Number or Lipa Namba');
      return;
    }

    setSearching(true);
    setTimeout(() => {
      setSearching(false);
      const trimmed = controlNum.trim();
      if (MOCK_CONTROL_NUMBERS[trimmed]) {
        setResult(MOCK_CONTROL_NUMBERS[trimmed]);
      } else {
        // Fallback mock result for any 8-digit number
        if (/^\d{6,12}$/.test(trimmed)) {
          setResult({
            biller: `Verified Merchant (#${trimmed.slice(-4)})`,
            amount: 75000,
            description: 'Verified Biller Invoice',
            provider: 'Interbank Lipa Namba'
          });
        } else {
          setError('Control Number or Lipa Namba not found or expired. Try "99123456" or "15024928".');
        }
      }
    }, 600);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 animate-fade-in">
      <button
        onClick={onBack}
        className="mb-4 flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Dashboard
      </button>

      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
            <ScanLine className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900">Control Number & Lipa Namba Verification</h1>
            <p className="text-xs text-slate-500">Lookup official biller details and split directly with friends.</p>
          </div>
        </div>

        {/* Form input */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-700">Enter Lipa Namba or Government Control Number</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={controlNum}
                onChange={(e) => setControlNum(e.target.value)}
                placeholder="e.g. 99123456 or 15024928"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-4 font-mono text-sm font-bold text-slate-900 outline-none focus:border-primary-500 focus:bg-white"
              />
            </div>
            <button
              onClick={handleLookup}
              disabled={searching}
              className="rounded-xl bg-primary-600 px-5 py-3 text-xs font-bold text-white hover:bg-primary-700 transition disabled:opacity-50"
            >
              {searching ? 'Verifying...' : 'Lookup Bill'}
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl border border-error-100 bg-error-50 p-4 text-xs font-semibold text-error-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Verification Result Card */}
        {result && (
          <div className="rounded-2xl border border-primary-200 bg-primary-50/30 p-5 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-primary-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary-600" />
                <div>
                  <p className="text-sm font-extrabold text-slate-900">{result.biller}</p>
                  <p className="text-[11px] text-slate-500">{result.provider} · Verified PSP Confirmation</p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-success-100 px-2.5 py-0.5 text-[10px] font-bold text-success-700">
                <ShieldCheck className="h-3.5 w-3.5" /> VERIFIED
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">{result.description}</p>
                <p className="text-xl font-extrabold text-slate-900">{formatMoney(result.amount)}</p>
              </div>
              <button
                onClick={() => onSplitBill(result.biller, result.amount, controlNum)}
                className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-xs font-bold text-white shadow-sm hover:bg-primary-700 transition"
              >
                Split This Bill <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl bg-slate-50 p-4 text-[11px] text-slate-500 leading-relaxed">
          <p className="font-bold text-slate-700 mb-1">PSP Confirmation Notice</p>
          Control number validation depends on payment service provider (PSP) API support. Real-time bill verification guarantees that the recipient name and amount match before funds are released.
        </div>
      </div>
    </div>
  );
}
