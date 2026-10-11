import { useState, useEffect } from 'react';
import {
  User, Shield, Bell, Languages, CreditCard, Lock, Smartphone, Check,
  KeyRound, Globe, Save, Building2, Plus, Trash2
} from 'lucide-react';
import { translations } from '@/lib/i18n';

type SettingsTab = 'profile' | 'payment_methods' | 'security' | 'notifications' | 'language';

type PaymentMethod = {
  id: string;
  type: 'mobile_money' | 'bank';
  name: string;
  provider: string;
  number: string;
  isDefault: boolean;
};

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [language, setLanguage] = useState<'en' | 'sw'>(
    () => (localStorage.getItem('lumo_language') === 'sw' ? 'sw' : 'en')
  );
  const copy = translations[language];

  // Dynamic Profile state (No hardcoded demo values)
  const [name, setName] = useState<string>(() => {
    try {
      const userStr = localStorage.getItem('lumo_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.full_name || parsed.name) return parsed.full_name || parsed.name;
      }
      const raw = localStorage.getItem('lumo_user_name');
      if (raw && !raw.startsWith('user_') && !/\d/.test(raw)) return raw.trim();
    } catch {}
    return '';
  });

  const [phone, setPhone] = useState<string>(() => {
    return localStorage.getItem('lumo_user_phone') || '';
  });

  const [email, setEmail] = useState<string>(() => {
    try {
      const userStr = localStorage.getItem('lumo_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.email) return parsed.email;
      }
    } catch {}
    return '';
  });

  // Security state
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  // Notification preferences
  const [notifSms, setNotifSms] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifReminders, setNotifReminders] = useState(true);

  // Dynamic Payment methods state
  const [methods, setMethods] = useState<PaymentMethod[]>(() => {
    try {
      const stored = localStorage.getItem('lumo_payment_methods');
      if (stored) return JSON.parse(stored);
    } catch {}
    const userPhone = localStorage.getItem('lumo_user_phone');
    if (userPhone) {
      return [
        { id: '1', type: 'mobile_money', name: 'Primary Mobile Money', provider: 'M-Pesa / Tigo Pesa', number: userPhone, isDefault: true }
      ];
    }
    return [];
  });

  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodProvider, setNewMethodProvider] = useState('Vodacom M-Pesa');
  const [newMethodNumber, setNewMethodNumber] = useState('');

  const [toast, setToast] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem('lumo_payment_methods', JSON.stringify(methods));
    } catch {}
  }, [methods]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  function handleLanguageChange(lang: 'en' | 'sw') {
    setLanguage(lang);
    localStorage.setItem('lumo_language', lang);
    showToast(`Language updated to ${lang === 'en' ? 'English' : 'Kiswahili'}`);
  }

  function handleSaveProfile() {
    if (name.trim()) {
      localStorage.setItem('lumo_user_name', name.trim());
      try {
        const userStr = localStorage.getItem('lumo_user');
        const userObj = userStr ? JSON.parse(userStr) : {};
        userObj.name = name.trim();
        userObj.full_name = name.trim();
        if (email.trim()) userObj.email = email.trim();
        localStorage.setItem('lumo_user', JSON.stringify(userObj));
      } catch {}
      window.dispatchEvent(new Event('lumo-auth-changed'));
    }
    showToast('Profile updated successfully');
  }

  function handleSavePin() {
    if (!newPin || newPin.length !== 4) {
      showToast('PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('PINs do not match');
      return;
    }
    showToast('Security PIN updated successfully');
    setNewPin('');
    setConfirmPin('');
  }

  function handleAddMethod() {
    if (!newMethodName.trim() || !newMethodNumber.trim()) {
      showToast('Please fill all fields');
      return;
    }
    const newEntry: PaymentMethod = {
      id: Date.now().toString(),
      type: newMethodProvider.toLowerCase().includes('bank') ? 'bank' : 'mobile_money',
      name: newMethodName.trim(),
      provider: newMethodProvider,
      number: newMethodNumber.trim(),
      isDefault: methods.length === 0
    };
    setMethods((prev) => [...prev, newEntry]);
    setShowAddMethodModal(false);
    setNewMethodName('');
    setNewMethodNumber('');
    showToast('New payment method added');
  }

  function handleDeleteMethod(id: string) {
    setMethods((prev) => prev.filter((m) => m.id !== id));
    showToast('Payment method removed');
  }

  function handleSetDefault(id: string) {
    setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
    showToast('Default payout method updated');
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-black tracking-tight text-white">Profile & Settings</h1>
        <p className="text-xs text-slate-400">Manage account preferences, payment payout methods, language, and security.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Navigation Sidebar */}
        <div className="space-y-1.5">
          {[
            { id: 'profile', label: 'Account Profile', icon: User },
            { id: 'payment_methods', label: 'Payment Methods', icon: CreditCard },
            { id: 'language', label: 'Language (Lugha)', icon: Languages },
            { id: 'security', label: 'Security & PIN', icon: Shield },
            { id: 'notifications', label: 'Notification Alerts', icon: Bell }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as SettingsTab)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-xs font-bold transition-all ${
                activeTab === id
                  ? 'bg-[#0D382E] text-[#00E599] border border-[#00E599]/40 shadow-[0_0_15px_rgba(0,229,153,0.12)]'
                  : 'bg-[#0C1816] text-slate-400 hover:bg-slate-800/50 hover:text-white border border-slate-800/80'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-8 shadow-2xl space-y-6">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2.5">
                <User className="h-5 w-5 text-[#00E599]" /> Personal Account Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-300">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    placeholder="Enter your full name"
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-[#00E599] focus:ring-1 focus:ring-[#00E599]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Mobile Phone Number (Tanzania)</label>
                  <input
                    type="text"
                    value={phone}
                    placeholder="+255 7XX XXX XXX"
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-[#00E599] focus:ring-1 focus:ring-[#00E599]/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    placeholder="name@example.com"
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-[#00E599] focus:ring-1 focus:ring-[#00E599]/30"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] px-6 py-3 text-xs font-black text-[#060D0E] shadow-[0_0_20px_rgba(0,229,153,0.25)] hover:brightness-110 active:scale-95 transition"
                >
                  <Save className="h-4 w-4" /> Save Profile Changes
                </button>
              </div>
            </div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'payment_methods' && (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-white flex items-center gap-2.5">
                    <CreditCard className="h-5 w-5 text-[#00E599]" /> Saved Payout & Payment Accounts
                  </h2>
                  <p className="text-xs text-slate-400">Configure mobile money and bank accounts for instant split settlements.</p>
                </div>
                <button
                  onClick={() => setShowAddMethodModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-[#00E599] px-3.5 py-2 text-xs font-black text-[#060D0E] hover:brightness-110 transition active:scale-95 shrink-0"
                >
                  <Plus className="h-4 w-4" /> Add Method
                </button>
              </div>

              <div className="space-y-3">
                {methods.length === 0 ? (
                  <div className="rounded-2xl border border-slate-800/80 bg-[#060D0E] p-8 text-center">
                    <CreditCard className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                    <p className="text-xs font-bold text-slate-300">No payment accounts added yet</p>
                    <p className="mt-1 text-[11px] text-slate-500">Add an M-Pesa, Tigo Pesa, Airtel Money, or CRDB account to receive payouts.</p>
                  </div>
                ) : (
                  methods.map((m) => (
                    <div
                      key={m.id}
                      className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                        m.isDefault ? 'border-[#0D382E] bg-[#081B17]' : 'border-slate-800/80 bg-[#060D0E]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0A261F] text-[#00E599]">
                          {m.type === 'bank' ? <Building2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-extrabold text-white">{m.name}</p>
                            {m.isDefault && (
                              <span className="rounded-full bg-[#00E599]/15 border border-[#00E599]/30 px-2 py-0.5 text-[10px] font-extrabold text-[#00E599]">
                                DEFAULT
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{m.provider} · {m.number}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!m.isDefault && (
                          <button
                            onClick={() => handleSetDefault(m.id)}
                            className="rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] font-bold text-slate-300 hover:text-white hover:bg-slate-700 transition"
                          >
                            Make Default
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMethod(m.id)}
                          className="rounded-lg p-2 text-slate-400 hover:bg-red-950/30 hover:text-red-400 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Language Tab */}
          {activeTab === 'language' && (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-8 shadow-2xl space-y-6">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2.5">
                <Globe className="h-5 w-5 text-[#00E599]" /> Language Preferences (Chagua Lugha)
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div
                  onClick={() => handleLanguageChange('en')}
                  className={`flex items-center justify-between rounded-2xl border p-5 cursor-pointer transition ${
                    language === 'en' ? 'border-[#00E599] bg-[#081B17] shadow-[0_0_20px_rgba(0,229,153,0.12)]' : 'border-slate-800 bg-[#060D0E] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <p className="text-sm font-extrabold text-white">English (US/UK)</p>
                    <p className="text-xs text-slate-400">Default interface language</p>
                  </div>
                  {language === 'en' && <Check className="h-5 w-5 text-[#00E599]" />}
                </div>

                <div
                  onClick={() => handleLanguageChange('sw')}
                  className={`flex items-center justify-between rounded-2xl border p-5 cursor-pointer transition ${
                    language === 'sw' ? 'border-[#00E599] bg-[#081B17] shadow-[0_0_20px_rgba(0,229,153,0.12)]' : 'border-slate-800 bg-[#060D0E] hover:border-slate-700'
                  }`}
                >
                  <div>
                    <p className="text-sm font-extrabold text-white">Kiswahili</p>
                    <p className="text-xs text-slate-400">Lugha ya Kiswahili kwa LUMO Split</p>
                  </div>
                  {language === 'sw' && <Check className="h-5 w-5 text-[#00E599]" />}
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-8 shadow-2xl space-y-6">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2.5">
                <KeyRound className="h-5 w-5 text-[#00E599]" /> Passcode & Security Settings
              </h2>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="text-xs font-bold text-slate-300">New 4-Digit Passcode PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="****"
                    className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-white outline-none focus:border-[#00E599]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300">Confirm New PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="****"
                    className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-center font-mono text-lg font-bold tracking-widest text-white outline-none focus:border-[#00E599]"
                  />
                </div>
                <button
                  onClick={handleSavePin}
                  className="w-full rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] py-3 text-xs font-black text-[#060D0E] shadow-[0_0_20px_rgba(0,229,153,0.25)] hover:brightness-110 active:scale-95 transition"
                >
                  Update Passcode PIN
                </button>
              </div>

              <hr className="border-slate-800/80" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-white">Biometric Authentication</p>
                  <p className="text-[11px] text-slate-400">Require FaceID / Fingerprint for high value splits.</p>
                </div>
                <input
                  type="checkbox"
                  checked={biometricEnabled}
                  onChange={(e) => setBiometricEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-[#00E599] focus:ring-[#00E599] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Notification Alerts Tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-3xl border border-slate-800/80 bg-[#0C1816] p-6 sm:p-8 shadow-2xl space-y-6">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2.5">
                <Bell className="h-5 w-5 text-[#00E599]" /> Notification Alert Preferences
              </h2>
              <div className="space-y-4">
                {[
                  { label: 'SMS Instant Payment Alerts', desc: 'Receive instant SMS when a participant completes payment', state: notifSms, setState: setNotifSms },
                  { label: 'Email Receipt Summaries', desc: 'Get full receipt breakdowns sent to your email upon settlement', state: notifEmail, setState: setNotifEmail },
                  { label: 'In-App Push Notifications', desc: 'Get browser push notifications for split updates', state: notifPush, setState: setNotifPush },
                  { label: 'Automated Reminders', desc: 'Allow LUMO to auto-send SMS reminders to pending split participants', state: notifReminders, setState: setNotifReminders }
                ].map(({ label, desc, state, setState }) => (
                  <div key={label} className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div>
                      <p className="text-xs font-extrabold text-white">{label}</p>
                      <p className="text-[11px] text-slate-400">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={state}
                      onChange={(e) => setState(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-700 bg-slate-900 text-[#00E599] focus:ring-[#00E599] cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {showAddMethodModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-[#0C1816] p-6 shadow-2xl animate-scale-in">
            <h3 className="text-base font-extrabold text-white mb-4">Add Payout Method</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300">Account Label Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Airtel Money"
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-[#00E599]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">Provider</label>
                <select
                  value={newMethodProvider}
                  onChange={(e) => setNewMethodProvider(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#00E599]"
                >
                  <option className="bg-[#0C1816]">Vodacom M-Pesa</option>
                  <option className="bg-[#0C1816]">Tigo Pesa</option>
                  <option className="bg-[#0C1816]">Airtel Money</option>
                  <option className="bg-[#0C1816]">HaloPesa</option>
                  <option className="bg-[#0C1816]">CRDB Bank</option>
                  <option className="bg-[#0C1816]">NMB Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300">Mobile / Account Number</label>
                <input
                  type="text"
                  placeholder="+255 7XX XXX XXX or Bank Acc"
                  value={newMethodNumber}
                  onChange={(e) => setNewMethodNumber(e.target.value)}
                  className="mt-1.5 w-full rounded-2xl border border-slate-800 bg-[#060D0E] px-4 py-3 text-xs font-bold text-white placeholder-slate-600 outline-none focus:border-[#00E599]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddMethodModal(false)}
                  className="flex-1 rounded-2xl border border-slate-700 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMethod}
                  className="flex-1 rounded-2xl bg-[#00E599] py-3 text-xs font-black text-[#060D0E] hover:brightness-110 active:scale-95"
                >
                  Save Method
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-[#081B17] border border-[#00E599]/40 px-5 py-3 text-xs font-bold text-[#00E599] shadow-2xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}
