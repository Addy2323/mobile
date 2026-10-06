import React, { useState } from 'react';
import { User, Phone, Globe, CreditCard, Shield, Store, Settings, LogOut, Download, Bell, ChevronRight, Check } from 'lucide-react';
import { getTranslation, type Language } from '@/lib/i18n';

interface ProfileScreenProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  onNavigateView: (view: 'merchant' | 'admin' | 'settings') => void;
  onOpenNotifications: () => void;
  onSignOut: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  language,
  onLanguageChange,
  onNavigateView,
  onOpenNotifications,
  onSignOut,
}) => {
  const userName = localStorage.getItem('lumo_user_name') || 'Given Mhema';
  const userPhone = localStorage.getItem('lumo_user_phone') || '0754 123 456';
  const [showPwaPrompt, setShowPwaPrompt] = useState(true);

  const t = (key: any) => getTranslation(key, language);

  return (
    <div className="p-4 space-y-6 no-tap-highlight">
      {/* User Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center space-x-4">
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-600/30">
          {userName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-900 truncate">{userName}</h2>
          <p className="text-xs font-semibold text-slate-500 flex items-center mt-0.5">
            <Phone className="w-3.5 h-3.5 mr-1 text-slate-400" />
            <span>+255 {userPhone}</span>
          </p>
          <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-2">
            Verified User
          </div>
        </div>
      </div>

      {/* Language Choice */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
        <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
          <Globe className="w-4 h-4 text-indigo-600" />
          <span>{t('selectLanguage')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onLanguageChange('en')}
            className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
              language === 'en'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>English</span>
            {language === 'en' && <Check className="w-4 h-4 text-indigo-600" />}
          </button>

          <button
            onClick={() => onLanguageChange('sw')}
            className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
              language === 'sw'
                ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span>Kiswahili</span>
            {language === 'sw' && <Check className="w-4 h-4 text-indigo-600" />}
          </button>
        </div>
      </div>

      {/* Account & Security Menu */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm divide-y divide-slate-100 overflow-hidden">
        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-800 text-sm">{t('notifications')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Payment Methods */}
        <div className="p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">Payment Methods</span>
              <span className="text-[11px] text-slate-500 block">M-Pesa, Tigo Pesa, Bank Card</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </div>

        {/* Role-based Merchant Access */}
        <button
          onClick={() => onNavigateView('merchant')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-800 text-sm">{t('merchants')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>

        {/* Role-based Admin / Operations */}
        <button
          onClick={() => onNavigateView('admin')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-50 active:bg-slate-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-800 text-sm">{t('operations')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* PWA Add to Home Screen prompt */}
      {showPwaPrompt && (
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 text-white p-4 rounded-3xl shadow-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Download className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <p className="font-bold text-xs">Install LUMO Split App</p>
              <p className="text-[11px] text-indigo-200">Add to Home Screen for fast access</p>
            </div>
          </div>
          <button
            onClick={() => {
              alert('To install: Tap browser menu and select "Add to Home Screen"');
              setShowPwaPrompt(false);
            }}
            className="px-3 py-1.5 bg-white text-indigo-900 font-extrabold text-xs rounded-xl shadow hover:bg-indigo-50"
          >
            Install
          </button>
        </div>
      )}

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full py-3.5 bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold rounded-2xl flex items-center justify-center space-x-2 text-sm transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>
    </div>
  );
};
