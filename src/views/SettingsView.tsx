import { useState } from 'react';
import {
  User, Shield, Bell, Languages, CreditCard, Lock, Smartphone, Check,
  KeyRound, ChevronRight, Globe, Save, Sparkles, Building2, Plus, Trash2
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

  // Profile state
  const [name, setName] = useState('Ado Daniel');
  const [phone, setPhone] = useState('+255 754 123 456');
  const [email, setEmail] = useState('ado@lumosplit.co.tz');

  // Security state
  const [pin, setPin] = useState('1234');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [biometricEnabled, setBiometricEnabled] = useState(true);

  // Notification preferences
  const [notifSms, setNotifSms] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifPush, setNotifPush] = useState(true);
  const [notifReminders, setNotifReminders] = useState(true);

  // Payment methods state
  const [methods, setMethods] = useState<PaymentMethod[]>([
    { id: '1', type: 'mobile_money', name: 'Personal M-Pesa', provider: 'Vodacom M-Pesa', number: '+255 754 123 456', isDefault: true },
    { id: '2', type: 'bank', name: 'CRDB Main Account', provider: 'CRDB Bank', number: '015024928100', isDefault: false }
  ]);

  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodName, setNewMethodName] = useState('');
  const [newMethodProvider, setNewMethodProvider] = useState('Vodacom M-Pesa');
  const [newMethodNumber, setNewMethodNumber] = useState('');

  const [toast, setToast] = useState('');

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
    showToast('Profile updated successfully');
  }

  function handleSavePin() {
    if (!newPin || newPin.length !== 4) {
      showToast('PIN must be 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('New PIN and confirm PIN do not match');
      return;
    }
    setPin(newPin);
    setNewPin('');
    setConfirmPin('');
    showToast('Security PIN updated successfully');
  }

  function handleAddMethod() {
    if (!newMethodName || !newMethodNumber) {
      showToast('Please fill in method name and number');
      return;
    }
    const isBank = newMethodProvider.includes('Bank') || newMethodProvider.includes('CRDB') || newMethodProvider.includes('NMB');
    const newEntry: PaymentMethod = {
      id: Date.now().toString(),
      type: isBank ? 'bank' : 'mobile_money',
      name: newMethodName,
      provider: newMethodProvider,
      number: newMethodNumber,
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
    <div className="mx-auto max-w-4xl px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-slate-900">Profile & Settings</h1>
        <p className="text-xs text-slate-500">Manage account preferences, payment payout methods, language, and security.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        {/* Navigation Sidebar */}
        <div className="space-y-1">
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
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-xs font-bold transition ${
                activeTab === id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="md:col-span-3">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-6">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <User className="h-5 w-5 text-primary-600" /> Personal Account Details
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Mobile Phone Number (Tanzania)</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-primary-500"
                  />
                </div>
                <button
                  onClick={handleSaveProfile}
                  className="flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-primary-700 transition"
                >
                  <Save className="h-4 w-4" /> Save Profile Changes
                </button>
              </div>
            </div>
          )}

          {/* Payment Methods Tab */}
          {activeTab === 'payment_methods' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary-600" /> Saved Payout & Payment Accounts
                  </h2>
                  <p className="text-xs text-slate-500">Configure mobile money and bank accounts for instant split settlements.</p>
                </div>
                <button
                  onClick={() => setShowAddMethodModal(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-primary-700"
                >
                  <Plus className="h-4 w-4" /> Add Method
                </button>
              </div>

              <div className="space-y-3">
                {methods.map((m) => (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between rounded-xl border p-4 transition ${
                      m.isDefault ? 'border-primary-200 bg-primary-50/20' : 'border-slate-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                        {m.type === 'bank' ? <Building2 className="h-5 w-5 text-blue-600" /> : <Smartphone className="h-5 w-5 text-success-600" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-extrabold text-slate-900">{m.name}</p>
                          {m.isDefault && (
                            <span className="rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-700">
                              DEFAULT
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">{m.provider} · {m.number}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!m.isDefault && (
                        <button
                          onClick={() => handleSetDefault(m.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50"
                        >
                          Make Default
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteMethod(m.id)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-error-50 hover:text-error-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Language Tab */}
          {activeTab === 'language' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-6">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary-600" /> Language Preferences (Chagua Lugha)
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div
                  onClick={() => handleLanguageChange('en')}
                  className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition ${
                    language === 'en' ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">English (US/UK)</p>
                    <p className="text-xs text-slate-500">Default interface language</p>
                  </div>
                  {language === 'en' && <Check className="h-5 w-5 text-primary-600" />}
                </div>

                <div
                  onClick={() => handleLanguageChange('sw')}
                  className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition ${
                    language === 'sw' ? 'border-primary-500 bg-primary-50/30 ring-2 ring-primary-500/20' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">Kiswahili</p>
                    <p className="text-xs text-slate-500">Lugha ya Kiswahili kwa LUMO Split</p>
                  </div>
                  {language === 'sw' && <Check className="h-5 w-5 text-primary-600" />}
                </div>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-6">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary-600" /> Passcode & Security Settings
              </h2>
              <div className="space-y-4 max-w-sm">
                <div>
                  <label className="text-xs font-bold text-slate-600">New 4-Digit Passcode PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="****"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest outline-none focus:border-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600">Confirm New PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="****"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-center font-mono text-lg font-bold tracking-widest outline-none focus:border-primary-500"
                  />
                </div>
                <button
                  onClick={handleSavePin}
                  className="w-full rounded-xl bg-primary-600 py-2.5 text-xs font-bold text-white hover:bg-primary-700 transition"
                >
                  Update Passcode PIN
                </button>
              </div>

              <hr className="border-slate-100" />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-extrabold text-slate-900">Biometric Authentication</p>
                  <p className="text-[11px] text-slate-500">Require FaceID / Fingerprint for high value splits.</p>
                </div>
                <input
                  type="checkbox"
                  checked={biometricEnabled}
                  onChange={(e) => setBiometricEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Notification Alerts Tab */}
          {activeTab === 'notifications' && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-xs space-y-6">
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary-600" /> Notification Alert Preferences
              </h2>
              <div className="space-y-4">
                {[
                  { label: 'SMS Instant Payment Alerts', desc: 'Receive instant SMS when a participant completes payment', state: notifSms, setState: setNotifSms },
                  { label: 'Email Receipt Summaries', desc: 'Get full receipt breakdowns sent to your email upon settlement', state: notifEmail, setState: setNotifEmail },
                  { label: 'In-App Push Notifications', desc: 'Get browser push notifications for split updates', state: notifPush, setState: setNotifPush },
                  { label: 'Automated Reminders', desc: 'Allow LUMO to auto-send SMS reminders to pending split participants', state: notifReminders, setState: setNotifReminders }
                ].map(({ label, desc, state, setState }) => (
                  <div key={label} className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">{label}</p>
                      <p className="text-[11px] text-slate-500">{desc}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={state}
                      onChange={(e) => setState(e.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
            <h3 className="text-base font-extrabold text-slate-900 mb-4">Add Payout Method</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600">Account Label Name</label>
                <input
                  type="text"
                  placeholder="e.g. My Airtel Money"
                  value={newMethodName}
                  onChange={(e) => setNewMethodName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Provider</label>
                <select
                  value={newMethodProvider}
                  onChange={(e) => setNewMethodProvider(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-primary-500 bg-white"
                >
                  <option>Vodacom M-Pesa</option>
                  <option>Tigo Pesa</option>
                  <option>Airtel Money</option>
                  <option>HaloPesa</option>
                  <option>CRDB Bank</option>
                  <option>NMB Bank</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">Mobile / Account Number</label>
                <input
                  type="text"
                  placeholder="+255 7XX XXX XXX or Bank Acc"
                  value={newMethodNumber}
                  onChange={(e) => setNewMethodNumber(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold outline-none focus:border-primary-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddMethodModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddMethod}
                  className="flex-1 rounded-xl bg-primary-600 py-2.5 text-xs font-bold text-white hover:bg-primary-700"
                >
                  Save Method
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold text-white shadow-xl animate-slide-up">
          {toast}
        </div>
      )}
    </div>
  );
}
