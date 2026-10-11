import React from 'react';
import { Home, Activity, QrCode, Award, User, Wallet } from 'lucide-react';
import { getTranslation, type Language } from '@/lib/i18n';

export type TabType = 'home' | 'activity' | 'scan' | 'rewards' | 'profile';

interface BottomNavProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  language: Language;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, language }) => {
  const t = (key: any) => getTranslation(key, language);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-[#060D0E]/95 backdrop-blur-md border-t border-slate-800/80 px-1 py-1.5 z-40 shadow-[0_-4px_25px_rgba(0,0,0,0.6)] pb-safe no-tap-highlight">
      <div className="grid grid-cols-5 items-center justify-items-center w-full">
        {/* 1. Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'home' ? 'text-[#00E599] font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'home' ? 'bg-[#0A2620] border border-[#00E599]/30 shadow-[0_0_10px_rgba(0,229,153,0.2)]' : 'bg-transparent'}`}>
            <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5px] text-[#00E599]' : 'stroke-2 text-slate-400'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('home')}</span>
        </button>

        {/* 2. Activity */}
        <button
          onClick={() => onTabChange('activity')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'activity' ? 'text-[#00E599] font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'activity' ? 'bg-[#0A2620] border border-[#00E599]/30 shadow-[0_0_10px_rgba(0,229,153,0.2)]' : 'bg-transparent'}`}>
            <Activity className={`w-5 h-5 ${currentTab === 'activity' ? 'stroke-[2.5px] text-[#00E599]' : 'stroke-2 text-slate-400'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('activity')}</span>
        </button>

        {/* 3. Raised Scan Button (Neon Mint with QR) */}
        <button
          onClick={() => onTabChange('scan')}
          className="relative -top-3.5 flex flex-col items-center justify-center group active:scale-95 transition-all w-full"
        >
          <div className="w-13 h-13 bg-gradient-to-tr from-[#00E599] to-[#00C782] rounded-2xl flex items-center justify-center text-[#05110E] shadow-[0_0_24px_rgba(0,229,153,0.45)] border-4 border-[#060D0E] group-hover:scale-105 transition-transform p-3">
            <QrCode className="w-6 h-6 stroke-[2.8px]" />
          </div>
          <span className="text-[11px] font-extrabold text-[#00E599] mt-0.5 leading-tight">{t('scan')}</span>
        </button>

        {/* 4. Wallet */}
        <button
          onClick={() => onTabChange('rewards')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'rewards' ? 'text-[#00E599] font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'rewards' ? 'bg-[#0A2620] border border-[#00E599]/30 shadow-[0_0_10px_rgba(0,229,153,0.2)]' : 'bg-transparent'}`}>
            <Wallet className={`w-5 h-5 ${currentTab === 'rewards' ? 'stroke-[2.5px] text-[#00E599]' : 'stroke-2 text-slate-400'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('wallet')}</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'profile' ? 'text-[#00E599] font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'profile' ? 'bg-[#0A2620] border border-[#00E599]/30 shadow-[0_0_10px_rgba(0,229,153,0.2)]' : 'bg-transparent'}`}>
            <User className={`w-5 h-5 ${currentTab === 'profile' ? 'stroke-[2.5px] text-[#00E599]' : 'stroke-2 text-slate-400'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('profile')}</span>
        </button>
      </div>
    </nav>
  );
};
