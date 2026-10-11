import React from 'react';
import { X, Smartphone, CheckCircle, Share, MoreVertical, PlusSquare, ArrowUpRight } from 'lucide-react';
import { isIosDevice } from '@/lib/appDetection';

interface InstallGuideModalProps {
  open: boolean;
  onClose: () => void;
}

export const InstallGuideModal: React.FC<InstallGuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  const isIos = isIosDevice();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-[#0C1816] border border-slate-800 p-6 shadow-2xl text-white relative animate-slide-up"
        style={{ backgroundColor: '#0C1816' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#081B17] border border-[#0D382E] text-[#00E599] flex items-center justify-center shadow-[0_0_12px_rgba(0,229,153,0.2)]">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Sakinisha LUMO Split</h3>
              <p className="text-[11px] font-medium text-slate-400">Install Official App on your Phone</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="py-5 space-y-4">
          <p className="text-xs text-slate-300 leading-relaxed">
            Ili kupata app halisi ya LUMO Split bila kupakua mafaili yaliyoharibika, fuata hatua hizi mbili rahisi:
          </p>

          {!isIos ? (
            /* Android Instructions */
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#060D0E] border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-[#00E599] font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="text-xs text-slate-300 leading-snug">
                  Gonga alama ya <span className="font-bold text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800"><MoreVertical className="w-3.5 h-3.5 text-[#00E599] inline" /> Vidoti Vitatu (Menu)</span> juu kulia mwa kivinjari chako cha Chrome.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#060D0E] border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-[#00E599] font-black text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="text-xs text-slate-300 leading-snug">
                  Bonyeza <span className="font-bold text-[#00E599]">"Sakinisha app" (Install app)</span> au <span className="font-bold text-white">"Weka kwenye skrini ya simu" (Add to Home screen)</span>.
                </div>
              </div>
            </div>
          ) : (
            /* iOS Safari Instructions */
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#060D0E] border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-[#00E599] font-black text-xs flex items-center justify-center shrink-0">
                  1
                </div>
                <div className="text-xs text-slate-300 leading-snug">
                  Gonga kitufe cha <span className="font-bold text-white inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded bg-slate-800"><Share className="w-3.5 h-3.5 text-[#00E599] inline" /> Share</span> chini ya kivinjari chako cha Safari.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-[#060D0E] border border-slate-800">
                <div className="w-7 h-7 rounded-xl bg-slate-800 text-[#00E599] font-black text-xs flex items-center justify-center shrink-0">
                  2
                </div>
                <div className="text-xs text-slate-300 leading-snug">
                  Tembeza chini kisha chagua <span className="font-bold text-[#00E599]">"Add to Home Screen" <PlusSquare className="w-3.5 h-3.5 inline ml-0.5" /></span>.
                </div>
              </div>
            </div>
          )}

          <div className="p-3 rounded-2xl bg-[#081B17] border border-[#0D382E] text-slate-300 text-xs flex items-center gap-2.5">
            <CheckCircle className="w-4 h-4 text-[#00E599] shrink-0" />
            <span>App itasakinishwa mara moja kwenye simu yako na kufanya kazi kama app halisi yenye mwonekano kamili.</span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-black text-xs shadow-[0_0_20px_rgba(0,229,153,0.3)] hover:brightness-110 active:scale-[0.98] transition cursor-pointer"
        >
          Nimeelewa (Got it)
        </button>
      </div>
    </div>
  );
};

export default InstallGuideModal;
