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
        className="bg-[#0C181A] border border-[#00E599]/30 rounded-2xl p-3.5 flex items-center justify-between shadow-xs hover:border-[#00E599]/60 active:scale-[0.99] transition-all cursor-pointer"
      >
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 bg-[#00E599]/20 text-[#00E599] border border-[#00E599]/30 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5 stroke-[2.5px]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-extrabold text-white leading-tight truncate">
              Paying directly to <span className="text-[#00E599]">{destination}</span>{destinationId ? ` (${destinationId})` : ''}.
            </p>
            <p className="text-[11px] font-semibold text-white/60 leading-tight mt-0.5">
              LUMO never holds your money.
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#00E599] shrink-0 ml-2 stroke-[2.5px]" />
      </div>

      {/* Trust Guarantee Bottom Sheet Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-fade-in no-tap-highlight">
          <div className="w-full max-w-[500px] bg-[#0C181A] text-white rounded-t-3xl sm:rounded-3xl p-6 space-y-4 shadow-2xl animate-slide-up border border-white/10">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-10 h-10 bg-[#00E599]/15 text-[#00E599] rounded-xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 stroke-[2.5px]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Verified Direct Payment</h3>
                  <p className="text-xs text-[#00E599] font-semibold">100% Non-Custodial Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 py-1">
              <div className="p-4 bg-[#081214] border border-[#00E599]/30 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-white/90 leading-relaxed">
                  Your payment goes straight to the verified merchant or recipient through our payment partner. LUMO never holds your money.
                </p>
              </div>

              <div className="space-y-2 text-xs font-medium text-white/70">
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00E599] shrink-0 mt-0.5" />
                  <span>Direct USSD / M-Pesa / Tigo Pesa push payment directly to recipient account.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-[#00E599] shrink-0 mt-0.5" />
                  <span>Real-time instant settlement verification with zero middleman delays.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <Lock className="w-4 h-4 text-[#00E599] shrink-0 mt-0.5" />
                  <span>Full bank-grade encryption with automatic idempotent transaction tracking.</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-3 bg-[#00E599] hover:brightness-105 text-[#060D0E] font-black text-xs rounded-xl shadow-md transition-all active:scale-[0.99]"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}
    </>
  );
}
