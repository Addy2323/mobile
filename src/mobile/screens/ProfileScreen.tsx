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
  const getInitialName = () => {
    try {
      const uStr = localStorage.getItem('lumo_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u?.full_name?.trim()) return u.full_name.trim();
        if (u?.name?.trim()) return u.name.trim();
      }
    } catch {}
    const val = localStorage.getItem('lumo_user_name');
    if (val && !val.startsWith('user_') && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      return val.trim();
    }
    return 'LUMO Member';
  };

  const getInitialPhone = () => {
    try {
      const uStr = localStorage.getItem('lumo_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u?.phone) return u.phone;
      }
    } catch {}
    const val = localStorage.getItem('lumo_user_phone');
    if (val && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      return val;
    }
    return '';
  };

  const [userName, setUserName] = useState(getInitialName);
  const [userPhone, setUserPhone] = useState(getInitialPhone);
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
    const cleanN = editName.trim() || 'LUMO Member';
    const cleanP = editPhone.trim();
    setUserName(cleanN);
    setUserPhone(cleanP);
    localStorage.setItem('lumo_user_name', cleanN);
    if (cleanP) localStorage.setItem('lumo_user_phone', cleanP);
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
    <div className="p-4 space-y-6 no-tap-highlight text-white">
      {/* User Header */}
      <div className="bg-[#0C181A] p-5 rounded-3xl border border-white/10 shadow-xl flex items-center justify-between">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-16 h-16 bg-gradient-to-tr from-[#00E599] to-[#00C880] rounded-2xl flex items-center justify-center text-[#060D0E] font-black text-2xl shadow-lg shadow-[#00E599]/20 flex-shrink-0">
            {userName.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-white truncate">{userName}</h2>
            <p className="text-xs font-semibold text-white/60 flex items-center mt-0.5 truncate">
              <Phone className="w-3.5 h-3.5 mr-1 text-[#00E599] flex-shrink-0" />
              <span>+255 {userPhone.replace(/^\+255\s*/, '')}</span>
            </p>
            <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30 mt-2">
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
          className="p-2.5 bg-white/5 hover:bg-white/10 text-[#00E599] rounded-2xl border border-white/10 text-xs font-bold transition-all ml-2"
          title="Edit Profile"
        >
          Edit
        </button>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn overscroll-contain"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bg-[#0C181A] border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 overscroll-contain text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-white text-base">Edit Cardholder Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-white/40 hover:text-white p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Full Name (shown on Card)</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Given Mhema"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl text-sm font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/80 mb-1 block">Phone Number</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="0754 123 456"
                  className="w-full px-4 py-3 bg-[#081214] border border-white/10 rounded-xl text-sm font-bold text-white placeholder-white/30 focus:outline-none focus:border-[#00E599]"
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-bold rounded-2xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black rounded-2xl text-xs transition-colors hover:brightness-105 active:scale-95 shadow-lg shadow-[#00E599]/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Language Choice */}
      <div className="bg-[#0C181A] p-4 rounded-3xl border border-white/10 shadow-xl space-y-3">
        <div className="flex items-center space-x-2 text-white font-bold text-sm">
          <Globe className="w-4 h-4 text-[#00E599]" />
          <span>{t('selectLanguage')}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onLanguageChange('en')}
            className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
              language === 'en'
                ? 'border-[#00E599] bg-[#00E599]/15 text-[#00E599]'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            <span>English</span>
            {language === 'en' && <Check className="w-4 h-4 text-[#00E599]" />}
          </button>

          <button
            onClick={() => onLanguageChange('sw')}
            className={`py-2.5 px-3 rounded-xl border font-bold text-xs flex items-center justify-between transition-all ${
              language === 'sw'
                ? 'border-[#00E599] bg-[#00E599]/15 text-[#00E599]'
                : 'border-white/10 text-white/60 hover:bg-white/5'
            }`}
          >
            <span>Kiswahili</span>
            {language === 'sw' && <Check className="w-4 h-4 text-[#00E599]" />}
          </button>
        </div>
      </div>

      {/* Account & Security Menu */}
      <div className="bg-[#0C181A] rounded-3xl border border-white/10 shadow-xl divide-y divide-white/5 overflow-hidden">
        {/* Notifications */}
        <button
          onClick={onOpenNotifications}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#00E599]/15 text-[#00E599] rounded-xl">
              <Bell className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-sm">{t('notifications')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </button>

        {/* Payment Methods */}
        <div className="p-4 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#00E599]/15 text-[#00E599] rounded-xl">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white text-sm block">Payment Methods</span>
              <span className="text-[11px] text-white/50 block">M-Pesa, Tigo Pesa, Bank Card</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </div>

        {/* Role-based Merchant Access */}
        <button
          onClick={() => onNavigateView('merchant')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/15 text-purple-400 rounded-xl">
              <Store className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-sm">{t('merchants')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </button>

        {/* Role-based Admin / Operations */}
        <button
          onClick={() => onNavigateView('admin')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 active:bg-white/10 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/15 text-amber-400 rounded-xl">
              <Shield className="w-5 h-5" />
            </div>
            <span className="font-bold text-white text-sm">{t('operations')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-white/40" />
        </button>
      </div>

      {/* PWA Add to Home Screen prompt */}
      {showPwaPrompt && (
        <div className="bg-gradient-to-r from-[#0C181A] to-[#0F2224] border border-[#00E599]/30 text-white p-4 rounded-3xl shadow-xl flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#00E599]/15 rounded-xl">
              <Download className="w-6 h-6 text-[#00E599]" />
            </div>
            <div>
              <p className="font-black text-xs text-white">Install LUMO Split App</p>
              <p className="text-[11px] text-white/60">Add to Home Screen for fast access</p>
            </div>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black text-xs rounded-xl shadow-md hover:brightness-105 active:scale-95 transition-all"
          >
            Install
          </button>
        </div>
      )}

      {/* PWA Install Guide Modal */}
      {showInstallGuideModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn text-white">
          <div className="bg-[#0C181A] border border-white/10 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] flex items-center justify-center font-black text-xs">
                  LS
                </div>
                <h3 className="font-extrabold text-white text-base">Install LUMO App</h3>
              </div>
              <button
                onClick={() => setShowInstallGuideModal(false)}
                className="text-white/40 hover:text-white p-1 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-white/60">
              Install LUMO Split on your phone for full-screen performance and fast one-tap access:
            </p>

            <div className="space-y-3 bg-[#081214] p-4 rounded-2xl border border-white/10 text-xs">
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00E599]/20 text-[#00E599] font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <p className="text-white/80">Tap browser menu (<strong className="text-white font-bold">⋮</strong> on Android or <strong className="text-white font-bold">Share</strong> on iPhone).</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00E599]/20 text-[#00E599] font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <p className="text-white/80">Select <strong className="text-[#00E599] font-bold">"Add to Home screen"</strong> or <strong className="text-[#00E599] font-bold">"Install App"</strong>.</p>
              </div>
              <div className="flex items-start space-x-2.5">
                <span className="w-5 h-5 rounded-full bg-[#00E599]/20 text-[#00E599] font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                <p className="text-white/80">Confirm to launch LUMO with a standalone native app icon.</p>
              </div>
            </div>

            <button
              onClick={() => setShowInstallGuideModal(false)}
              className="w-full py-3 bg-gradient-to-r from-[#00E599] to-[#00C880] text-[#060D0E] font-black rounded-2xl text-xs hover:brightness-105 active:scale-95 transition-all shadow-lg shadow-[#00E599]/20"
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}

      {/* Sign Out */}
      <button
        onClick={onSignOut}
        className="w-full py-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-bold rounded-2xl flex items-center justify-center space-x-2 text-sm transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>
    </div>
  );
};
