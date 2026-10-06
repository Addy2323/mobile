import React from 'react';
import { Home, Activity, QrCode, Award, User } from 'lucide-react';
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
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[560px] bg-white border-t border-slate-200/80 px-1 py-1.5 z-40 shadow-2xl pb-safe no-tap-highlight">
      <div className="grid grid-cols-5 items-center justify-items-center w-full">
        {/* 1. Home */}
        <button
          onClick={() => onTabChange('home')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'home' ? 'text-[#12285C] font-bold' : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'home' ? 'bg-[#EAF0FF]' : 'bg-transparent'}`}>
            <Home className={`w-5 h-5 ${currentTab === 'home' ? 'stroke-[2.5px] text-[#12285C]' : 'stroke-2 text-[#64748B]'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('home')}</span>
        </button>

        {/* 2. Activity */}
        <button
          onClick={() => onTabChange('activity')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'activity' ? 'text-[#12285C] font-bold' : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'activity' ? 'bg-[#EAF0FF]' : 'bg-transparent'}`}>
            <Activity className={`w-5 h-5 ${currentTab === 'activity' ? 'stroke-[2.5px] text-[#12285C]' : 'stroke-2 text-[#64748B]'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('activity')}</span>
        </button>

        {/* 3. Raised Scan Button (Navy Square with QR) */}
        <button
          onClick={() => onTabChange('scan')}
          className="relative -top-3.5 flex flex-col items-center justify-center group active:scale-95 transition-all w-full"
        >
          <div className="w-13 h-13 bg-gradient-to-tr from-[#12285C] to-[#1E3A8A] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-950/35 border-4 border-white group-hover:scale-105 transition-transform p-3">
            <QrCode className="w-6 h-6 stroke-[2.5px]" />
          </div>
          <span className="text-[11px] font-extrabold text-[#12285C] mt-0.5 leading-tight">{t('scan')}</span>
        </button>

        {/* 4. Rewards */}
        <button
          onClick={() => onTabChange('rewards')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'rewards' ? 'text-[#12285C] font-bold' : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'rewards' ? 'bg-[#EAF0FF]' : 'bg-transparent'}`}>
            <Award className={`w-5 h-5 ${currentTab === 'rewards' ? 'stroke-[2.5px] text-[#12285C]' : 'stroke-2 text-[#64748B]'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('rewards')}</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => onTabChange('profile')}
          className={`flex flex-col items-center justify-center w-full py-1 transition-all active:scale-95 group ${
            currentTab === 'profile' ? 'text-[#12285C] font-bold' : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          <div className={`px-3 py-1 rounded-full transition-colors ${currentTab === 'profile' ? 'bg-[#EAF0FF]' : 'bg-transparent'}`}>
            <User className={`w-5 h-5 ${currentTab === 'profile' ? 'stroke-[2.5px] text-[#12285C]' : 'stroke-2 text-[#64748B]'}`} />
          </div>
          <span className="text-[11px] mt-0.5 leading-tight font-extrabold truncate max-w-full">{t('profile')}</span>
        </button>
      </div>
    </nav>
  );
};
