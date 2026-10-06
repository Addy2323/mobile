import { useState } from 'react';
import {
  LayoutDashboard, Plus, ReceiptText, Store, Shield, Settings,
  Bell, MessageCircle, ChevronDown, WalletCards, ArrowDownToLine, ArrowLeftRight,
  Send, Hash, MoreHorizontal,
} from 'lucide-react';
import Logo from './Logo';
import { translations } from '@/lib/i18n';

import NotificationCenter from './NotificationCenter';

export type View = 'home' | 'create' | 'merchant' | 'admin' | 'detail' | 'payment' | 'send' | 'deposit' | 'transfer' | 'control' | 'activity' | 'settings';

type HeaderProps = {
  view: View;
  onNavigate: (view: View) => void;
  onCreate: () => void;
};

export default function Header({ view, onNavigate, onCreate }: HeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [language, setLanguage] = useState<'en' | 'sw'>(() => localStorage.getItem('lumo_language') === 'sw' ? 'sw' : 'en');
  const copy = translations[language];
  const ENABLE_WALLET_FEATURES = false;
  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'home', label: copy.dashboard, icon: LayoutDashboard },
    { id: 'activity', label: 'Activity & History', icon: ReceiptText },
    { id: 'control', label: copy.controlNumbers, icon: Hash },
    { id: 'create', label: copy.createSplit, icon: Plus },
    { id: 'merchant', label: copy.merchants, icon: Store },
    { id: 'admin', label: copy.operations, icon: Shield },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];
  const walletItems: { id: View; label: string; icon: typeof ArrowDownToLine }[] = [
    { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
    { id: 'send', label: 'Send', icon: Send },
    { id: 'transfer', label: 'Transfer', icon: ArrowLeftRight },
  ];

  function toggleLanguage() {
    const next = language === 'en' ? 'sw' : 'en';
    setLanguage(next);
    localStorage.setItem('lumo_language', next);
  }

  const isActive = (id: View) => {
    if (id === 'home') return view === 'home';
    if (id === 'create') return view === 'create';
    if (id === 'detail') return view === 'detail' || view === 'payment';
    return view === id;
  };

  return (
    <>
      {/* Desktop Sidebar with Navy Palette (#0B1B40) */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[258px] flex-col md:flex bg-[#0B1B40] text-white lg:flex border-r border-indigo-950">
        <div className="flex h-[78px] items-center border-b border-white/10 px-7">
          <Logo size="sm" variant="light" />
        </div>

        <div className="flex-1 px-3 py-6">
          <p className="px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Workspace</p>
          <nav className="space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => id === 'create' ? onCreate() : onNavigate(id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${
                  isActive(id) ? 'bg-white text-[#12285C] shadow-md font-extrabold' : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
                {label}
                {id === 'detail' && <span className="ml-auto rounded-full bg-[#3B6FF5] px-1.5 py-0.5 text-[10px] text-white">3</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => setMoreOpen((open) => !open)} className="mt-5 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"><span>{copy.more}</span><ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} /></button>
          {moreOpen && <div className="mt-1 space-y-1 rounded-lg bg-white/5 p-1">{walletItems.map(({ label, icon: Icon }) => <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-white/40"><span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span><span className="text-[9px] uppercase tracking-wide">{copy.comingSoon}</span></div>)}</div>}

          <p className="px-4 pb-3 pt-9 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">Account</p>
          <nav className="space-y-1">
            <button
              onClick={() => onNavigate('settings')}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <WalletCards className="h-[17px] w-[17px]" /> Payment methods
            </button>
            <button
              onClick={() => onNavigate('settings')}
              className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Settings className="h-[17px] w-[17px]" /> Settings
            </button>
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/10 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#12285C] text-xs font-bold text-white border border-white/20">AD</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Ado Daniel</p>
              <p className="truncate text-xs text-white/50">Organizer account</p>
            </div>
            <ChevronDown className="h-4 w-4 text-white/45" />
          </div>
        </div>
      </aside>

      {/* Desktop Top Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white md:ml-[258px]">
        <div className="flex h-[78px] items-center justify-between px-4 sm:px-7">
          <div className="md:hidden"><Logo size="sm" /></div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-slate-400">Tuesday, 06 October 2026</p>
            <p className="text-sm font-bold text-[#0F172A]">Good afternoon, Ado</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <NotificationCenter />
            <button onClick={toggleLanguage} className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50">{language === 'en' ? 'EN / SW' : 'SW / EN'}</button>
            <button className="hidden items-center gap-2 rounded-full bg-[#0F172A] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:flex">
              <MessageCircle className="h-4 w-4" /> Support
            </button>

            {/* Primary Navy Button (#12285C) */}
            <button onClick={onCreate} className="flex items-center gap-2 rounded-full bg-[#12285C] hover:bg-[#0B1B40] px-3.5 py-2.5 text-xs font-extrabold text-white shadow-md transition sm:px-4">
              <Plus className="h-4 w-4 stroke-[3px]" /> <span className="hidden sm:inline">New split</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
