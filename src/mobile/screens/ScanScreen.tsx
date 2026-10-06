import React, { useState } from 'react';
import { Camera, Zap, Keyboard, QrCode, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { BottomSheet } from '../components/BottomSheet';
import { getTranslation, type Language } from '@/lib/i18n';

interface ScanScreenProps {
  onScanComplete: (merchantName: string, amount: number, lipaNamba?: string) => void;
  language: Language;
}

export const ScanScreen: React.FC<ScanScreenProps> = ({ onScanComplete, language }) => {
  const [flash, setFlash] = useState(false);
  const [activeTab, setActiveTab] = useState<'qr' | 'receipt'>('qr');
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [manualNumber, setManualNumber] = useState('');
  const [manualAmount, setManualAmount] = useState('120000');
  const [manualName, setManualName] = useState('The View Restaurant');

  const t = (key: any) => getTranslation(key, language);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualNumber) return;
    setIsManualOpen(false);
    onScanComplete(manualName || 'Merchant Biller', parseFloat(manualAmount) || 0, manualNumber);
  };

  const handleSimulatedScan = () => {
    onScanComplete('The View Restaurant (Lipa Namba 1234567)', 120000, '1234567');
  };

  return (
    <div className="relative min-h-dvh bg-slate-950 text-white flex flex-col justify-between p-4 pb-safe no-tap-highlight">
      {/* Top Overlay Controls */}
      <div className="pt-2 flex items-center justify-between z-10">
        <div className="flex bg-slate-800/80 backdrop-blur-md p-1 rounded-2xl text-xs font-bold text-slate-300">
          <button
            onClick={() => setActiveTab('qr')}
            className={`px-3 py-1.5 rounded-xl flex items-center space-x-1 transition-all ${
              activeTab === 'qr' ? 'bg-indigo-600 text-white shadow-md' : 'hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan QR / Lipa Namba</span>
          </button>
          <button
            onClick={() => setActiveTab('receipt')}
            className={`px-3 py-1.5 rounded-xl flex items-center space-x-1 transition-all ${
              activeTab === 'receipt' ? 'bg-indigo-600 text-white shadow-md' : 'hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Scan Bill Receipt</span>
          </button>
        </div>

        <button
          onClick={() => setFlash(!flash)}
          className={`p-2.5 rounded-full border transition-all ${
            flash ? 'bg-amber-400 border-amber-300 text-slate-900' : 'bg-slate-800/80 border-slate-700 text-slate-300'
          }`}
          title="Toggle Flashlight"
        >
          <Zap className="w-5 h-5" />
        </button>
      </div>

      {/* Simulated Camera Viewfinder Frame */}
      <div className="my-auto flex flex-col items-center justify-center space-y-6">
        <div 
          onClick={handleSimulatedScan}
          className="relative w-64 h-64 border-2 border-indigo-500/50 rounded-3xl overflow-hidden flex items-center justify-center bg-slate-900/40 backdrop-blur-xs cursor-pointer group active:scale-95 transition-all shadow-2xl"
        >
          {/* Animated Scanning Laser Line */}
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent shadow-[0_0_15px_#6366f1] animate-pulse" />

          {/* Corner Framing Brackets */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-xl" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-xl" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-xl" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-xl" />

          {/* Simulated QR graphic inside */}
          <div className="text-center p-4 group-hover:scale-105 transition-transform">
            <QrCode className="w-24 h-24 text-indigo-400 opacity-40 mx-auto mb-2" />
            <span className="text-[11px] font-bold text-indigo-300 bg-indigo-950/80 px-2.5 py-1 rounded-full border border-indigo-500/30">
              Tap frame to simulate scan
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400 font-medium text-center max-w-xs leading-relaxed">
          {activeTab === 'qr'
            ? 'Align the Lipa Namba QR code inside the frame to split instantly'
            : 'Snap a photo of your restaurant receipt to assign items to friends'}
        </p>
      </div>

      {/* Bottom Manual Entry CTA */}
      <div className="space-y-3 z-10 pb-4">
        <button
          onClick={() => setIsManualOpen(true)}
          className="w-full py-4 bg-slate-900 border border-slate-800 hover:bg-slate-800 active:scale-[0.98] text-white font-bold rounded-2xl shadow-xl flex items-center justify-center space-x-2 transition-all"
        >
          <Keyboard className="w-5 h-5 text-indigo-400" />
          <span>{t('enterManually')}</span>
        </button>
      </div>

      {/* Manual Lipa Namba Entry Bottom Sheet */}
      <BottomSheet
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
        title="Enter Lipa Namba / Account"
      >
        <form onSubmit={handleManualSubmit} className="space-y-4 text-slate-900 pt-1">
          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">
              {t('lipaNambaPlaceholder')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={manualNumber}
              onChange={(e) => setManualNumber(e.target.value)}
              placeholder="e.g. 1234567"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-mono font-bold focus:outline-none focus:border-indigo-600"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">
              Merchant / Biller Name
            </label>
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder="e.g. Samaki Samaki"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-1 block">
              Total Bill Amount (TZS)
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              placeholder="120000"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold focus:outline-none focus:border-indigo-600"
            />
          </div>

          <button
            type="submit"
            disabled={!manualNumber}
            className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            <span>Proceed to Split</span>
            <ArrowRight className="w-5 h-5" />
          </button>
        </form>
      </BottomSheet>
    </div>
  );
};
