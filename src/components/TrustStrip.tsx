import React, { useState } from 'react';
import { ShieldCheck, ChevronRight, X, Lock, CheckCircle2 } from 'lucide-react';
import { getTranslation, type Language } from '@/lib/i18n';

type TrustStripProps = {
  merchantName?: string | null;
  destinationId?: string | null;
  language?: Language;
  onClick?: () => void;
};

export default function TrustStrip({ merchantName, destinationId, language = 'en', onClick }: TrustStripProps) {
  const [isOpen, setIsOpen] = useState(false);
  const destination = merchantName || 'the verified destination';

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        className="bg-[#ECFDF5] border border-[#A7F3D0] rounded-2xl p-3.5 flex items-center justify-between shadow-xs hover:shadow-sm active:scale-[0.99] transition-all cursor-pointer"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 bg-emerald-600 text-white rounded-xl flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 stroke-[2.5px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-[#0B1528] leading-tight truncate">
              Paying directly to <span className="text-emerald-900">{destination}</span>{destinationId ? ` (${destinationId})` : ''}.
            </p>
            <p className="text-[11px] font-semibold text-emerald-700 leading-tight mt-0.5">
              LUMO never holds your money.
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-emerald-600 shrink-0 ml-2 stroke-[2.5px]" />
      </div>

      {/* Trust Guarantee Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fade-in no-tap-highlight">
          <div className="w-full max-w-[500px] bg-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl animate-slide-up border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5px]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-[#0B1528]">Verified Direct Payment</h3>
                  <p className="text-xs text-emerald-700 font-semibold">100% Non-Custodial Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 py-1">
              <div className="p-4 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-emerald-950 leading-relaxed">
                  Your payment goes straight to the verified merchant or recipient through our payment partner. LUMO never holds your money.
                </p>
              </div>

              <div className="space-y-2 text-xs font-medium text-slate-600">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Direct USSD / M-Pesa / Tigo Pesa push payment directly to recipient account.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Real-time instant settlement verification with zero middleman delays.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Full bank-grade encryption with automatic idempotent transaction tracking.</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-[#12285C] hover:bg-[#0B1B40] text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-[0.99]"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
