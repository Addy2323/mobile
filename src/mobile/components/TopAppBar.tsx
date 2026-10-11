import React, { useState } from 'react';
import { Bell, Globe, ChevronDown, Download } from 'lucide-react';
import { type Language } from '@/lib/i18n';
import { isStandaloneApp, triggerAppInstallation } from '@/lib/appDetection';

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
  const [inStandalone] = useState(() => isStandaloneApp());
  const [downloading, setDownloading] = useState(false);

  const handleInstallClick = async () => {
    setDownloading(true);
    try {
      await triggerAppInstallation();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <header className="bg-[#060D0E] text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 sticky top-0 z-40 flex items-center justify-between shadow-lg border-b border-[#00E599]/20 no-tap-highlight">
      {/* Brand logo & Tanzania subtitle with Onboarding visual identity */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06241D] to-[#0D382E] border border-[#00E599]/40 flex items-center justify-center text-[#00E599] font-black text-xs shadow-[0_0_12px_rgba(0,229,153,0.25)] shrink-0">
          [|]
        </div>
        <div className="flex flex-col justify-center">
          <h1 className="text-base font-extrabold tracking-tight leading-none text-white font-sans flex items-center">
            LUMO<span className="text-[#00E599]">Split</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-400 leading-none mt-1 flex items-center space-x-1">
            <span>Tanzania</span>
            <span className="text-xs ml-0.5">🇹🇿</span>
          </p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center space-x-2">
        {/* Install App button (ONLY for browser users, NEVER in standalone app) */}
        {!inStandalone && (
          <button
            onClick={handleInstallClick}
            disabled={downloading}
            className="h-9 px-2.5 flex items-center space-x-1.5 bg-[#0C1518] hover:bg-[#06241D] active:scale-95 text-[#00E599] rounded-xl border border-[#00E599]/40 text-xs font-bold transition-all shadow-[0_0_10px_rgba(0,229,153,0.15)] cursor-pointer"
            title="Install Mobile App"
          >
            <Download className="w-3.5 h-3.5 stroke-[2.5]" />
            <span className="hidden sm:inline text-[11px]">Install</span>
          </button>
        )}

        {/* Language Switcher Pill [ 🌐 EN ˅ ] */}
        <button
          onClick={onLanguageToggle}
          className="h-9 px-3 flex items-center space-x-1.5 bg-[#0C1518] hover:bg-[#06241D] active:scale-95 text-slate-200 rounded-xl border border-slate-800 hover:border-[#00E599]/40 text-xs font-bold transition-all"
          title="Toggle Language"
        >
          <Globe className="w-4 h-4 text-[#00E599] stroke-[2px]" />
          <span className="uppercase tracking-wide">{language}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 stroke-[2.5px]" />
        </button>

        {/* Notifications Icon Button */}
        <button
          onClick={onOpenNotifications}
          className="relative w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white bg-[#0C1518] hover:bg-[#06241D] active:scale-95 rounded-xl border border-slate-800 hover:border-[#00E599]/40 transition-all shrink-0"
          title="Notifications"
        >
          <Bell className="w-4.5 h-4.5 stroke-[2px]" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#00E599] rounded-full ring-2 ring-[#060D0E] shadow-[0_0_8px_#00E599]" />
        </button>
      </div>
    </header>
  );
};
