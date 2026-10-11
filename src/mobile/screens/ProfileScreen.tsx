import React, { useState } from 'react';
import { User, Phone, Globe, CreditCard, Shield, Store, Settings, LogOut, Download, Bell, ChevronRight, Check } from 'lucide-react';
import { getTranslation, type Language } from '@/lib/i18n';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';

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
  const sanitizeName = (val: string | null) => {
    if (!val || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val) || val.startsWith('user_')) {
      return 'Given Mhema';
    }
    return val;
  };

  const sanitizePhone = (val: string | null) => {
    if (!val || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      return '0754 123 456';
    }
    return val;
  };

  const [userName, setUserName] = useState(() => sanitizeName(localStorage.getItem('lumo_user_name')));
  const [userPhone, setUserPhone] = useState(() => sanitizePhone(localStorage.getItem('lumo_user_phone')));
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(userName);
  const [editPhone, setEditPhone] = useState(userPhone);

  const [showPwaPrompt, setShowPwaPrompt] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallGuideModal, setShowInstallGuideModal] = useState(false);

  React.useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanN = editName.trim() || 'Given Mhema';
    const cleanP = editPhone.trim() || '0754 123 456';
    setUserName(cleanN);
    setUserPhone(cleanP);
    localStorage.setItem('lumo_user_name', cleanN);
    localStorage.setItem('lumo_user_phone', cleanP);
    window.dispatchEvent(new Event('lumo_user_profile_updated'));
    setShowEditModal(false);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice?.outcome === 'accepted') {
        setShowPwaPrompt(false);
      }
      setDeferredPrompt(null);
    } else {
      setShowInstallGuideModal(true);
    }
  };

  const t = (key: any) => getTranslation(key, language);

  useBodyScrollLock(showEditModal);

  return (
    <div className="p-4 space-y-6 no-tap-highlight">
      {/* User Header */}
      <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl shadow-lg shadow-indigo-600/30 flex-shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{userName}</h2>
            <p className="text-xs font-semibold text-slate-500 flex items-center mt-0.5 truncate">
              <Phone className="w-3.5 h-3.5 mr-1 text-slate-400 flex-shrink-0" />
              <span>+255 {userPhone.replace(/^\+255\s*/, '')}</span>
            </p>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-2">
              Verified Member
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setEditName(userName);
            setEditPhone(userPhone);
            setShowEditModal(true);
          }}
          className="p-2.5 bg-slate-50 hover:bg-slate-100 text-indigo-600 rounded-2xl border border-slate-200 text-xs font-bold transition-colors ml-2"
          title="Edit Profile"
        >
          Edit
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 overscroll-contain">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-slate-900 text-base">Edit Cardholder Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Full Name (shown on Card)</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Given Mhema"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-600"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0754 123 456"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-white text-indigo-900 font-extrabold text-xs rounded-xl shadow hover:bg-indigo-50 active:scale-95 transition-all"
          >
            Install
          </button>
        </div>
      )}

      {/* PWA Install Guide Modal */}
      {showInstallGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs">
                  LS
                </div>
                <h3 className="font-extrabold text-slate-900 text-base">Install LUMO App</h3>
              </div>
              <button
                onClick={() => setShowInstallGuideModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Install LUMO Split on your phone for full-screen performance and fast one-tap access:
            </p>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <p className="text-slate-700">Tap browser menu (<strong className="text-slate-900 font-bold">⋮</strong> on Android or <strong className="text-slate-900 font-bold">Share</strong> on iPhone).</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <p className="text-slate-700">Select <strong className="text-slate-900 font-bold">"Add to Home screen"</strong> or <strong className="text-slate-900 font-bold">"Install App"</strong>.</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <p className="text-slate-700">Confirm to launch LUMO with a standalone native app icon.</p>
              </div>
            </div>

            <button
              onClick={() => setShowInstallGuideModal(false)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-colors"
            >
              Got it, thanks!
            </button>
          </div>
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
