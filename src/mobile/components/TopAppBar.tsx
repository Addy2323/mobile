import React from 'react';
import { Bell, Globe, ChevronDown } from 'lucide-react';
import { type Language } from '@/lib/i18n';

interface TopAppBarProps {
  language: Language;
  onLanguageToggle: () => void;
  onOpenNotifications: () => void;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  language,
  onLanguageToggle,
  onOpenNotifications,
}) => {
  return (
    <header className="bg-[#0B1B40] text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 sticky top-0 z-40 flex items-center justify-between shadow-md border-b border-indigo-950/60 no-tap-highlight">
      {/* Brand logo & Tanzania subtitle (No ASCII "TZ") */}
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-[#12285C] border border-indigo-800/50 rounded-xl flex items-center justify-center font-black text-sm text-white tracking-wider shadow-md shrink-0">
          LS
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-base font-black tracking-tight leading-none text-white font-sans">LUMO Split</h1>
          <p className="text-[11px] font-semibold text-slate-300 leading-none mt-1 flex items-center space-x-1">
            <span>Tanzania</span>
            <span className="text-xs ml-0.5">🇹🇿</span>
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-2">
        {/* Language Switcher Pill [ 🌐 EN ˅ ] */}
        <button
          onClick={onLanguageToggle}
          className="h-9 px-3 flex items-center space-x-1.5 bg-[#172A59] hover:bg-[#1E3773] active:scale-95 text-slate-200 rounded-xl border border-indigo-800/40 text-xs font-bold transition-all"
          title="Toggle Language"
        >
          <Globe className="w-4 h-4 text-slate-300 stroke-[2px]" />
          <span className="uppercase tracking-wide">{language}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 stroke-[2.5px]" />
        </button>

        {/* Notifications Icon Button */}
        <button
          onClick={onOpenNotifications}
          className="relative w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white bg-[#172A59] hover:bg-[#1E3773] active:scale-95 rounded-xl border border-indigo-800/40 transition-all shrink-0"
          title="Notifications"
        >
          <Bell className="w-4.5 h-4.5 stroke-[2px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#3B6FF5] rounded-full ring-2 ring-[#0B1B40]" />
        </button>
      </div>
    </header>
  );
};
