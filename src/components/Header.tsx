import { useState } from 'react';
import {
  LayoutDashboard, Plus, ReceiptText, Store, Shield, Settings, HelpCircle,
  Bell, MessageCircle, ChevronDown, WalletCards, ArrowDownToLine, ArrowLeftRight,
  Send, Hash, MoreHorizontal,
} from 'lucide-react';
import Logo from './Logo';
import { translations } from '@/lib/i18n';

export type View = 'home' | 'create' | 'merchant' | 'admin' | 'detail' | 'payment' | 'send' | 'deposit' | 'transfer' | 'control';

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
    { id: 'control', label: copy.controlNumbers, icon: Hash },
    { id: 'create', label: copy.createSplit, icon: Plus },
    { id: 'detail', label: copy.activeSplits, icon: ReceiptText },
    { id: 'merchant', label: copy.merchants, icon: Store },
    { id: 'admin', label: copy.operations, icon: Shield },
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
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[258px] flex-col md:flex bg-[#090909] text-white lg:flex">
        <div className="flex h-[78px] items-center border-b border-white/10 px-7">
          <Logo size="sm" variant="light" />
        </div>

        <div className="flex-1 px-3 py-6">
          <p className="px-4 pb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Workspace</p>
          <nav className="space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => id === 'create' ? onCreate() : onNavigate(id)}
                className={`group flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors ${
                  isActive(id) ? 'bg-white text-black' : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
                {label}
                {id === 'detail' && <span className="ml-auto rounded-full bg-primary-500 px-1.5 py-0.5 text-[10px] text-white">3</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => setMoreOpen((open) => !open)} className="mt-5 flex w-full items-center justify-between rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white"><span>{copy.more}</span><ChevronDown className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} /></button>
          {moreOpen && <div className="mt-1 space-y-1 rounded-lg bg-white/5 p-1">{walletItems.map(({ label, icon: Icon }) => <div key={label} className="flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-white/35"><span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span><span className="text-[9px] uppercase tracking-wide">{copy.comingSoon}</span></div>)}</div>}

          <p className="px-4 pb-3 pt-9 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">Account</p>
          <nav className="space-y-1">
            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white">
              <WalletCards className="h-[17px] w-[17px]" /> Payment methods
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white">
              <Settings className="h-[17px] w-[17px]" /> Settings
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-white/65 transition-colors hover:bg-white/10 hover:text-white">
              <HelpCircle className="h-[17px] w-[17px]" /> Help center
            </button>
          </nav>
        </div>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-500 text-xs font-bold">AD</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Ado Daniel</p>
              <p className="truncate text-xs text-white/40">Organizer account</p>
            </div>
            <ChevronDown className="h-4 w-4 text-white/45" />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white md:ml-[258px]">
        <div className="flex h-[78px] items-center justify-between px-4 sm:px-7">
          <div className="md:hidden"><Logo size="sm" /></div>
          <div className="hidden lg:block">
            <p className="text-xs font-medium text-slate-400">Monday, 05 October 2026</p>
            <p className="text-sm font-semibold text-slate-800">Good afternoon, Ado</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button className="relative rounded-full border border-slate-200 p-2.5 text-slate-500 transition hover:bg-slate-50">
              <Bell className="h-4 w-4" />
              <span className="absolute right-0 top-0 h-2 w-2 rounded-full border-2 border-white bg-accent-500" />
            </button>
            <button onClick={toggleLanguage} className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-slate-50">{language === 'en' ? 'EN / SW' : 'SW / EN'}</button>
            <button className="hidden items-center gap-2 rounded-full bg-black px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 sm:flex">
              <MessageCircle className="h-4 w-4" /> Chat with support
            </button>
            <button onClick={onCreate} className="flex items-center gap-2 rounded-full bg-primary-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-700 sm:px-4">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">New split</span>
            </button>
          </div>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[68px] items-center justify-around border-t border-slate-200 bg-white px-2 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.35)] md:hidden">
          {[navItems[0], navItems[2], navItems[3], navItems[4]].map(({ id, label, icon: Icon }) => <button key={id} onClick={() => id === 'create' ? onCreate() : onNavigate(id)} className={`flex min-w-[58px] flex-col items-center gap-1 text-[10px] font-bold ${isActive(id) ? 'text-primary-700' : 'text-slate-400'}`}><Icon className="h-4 w-4" />{id === 'create' ? 'New split' : label}</button>)}
          {ENABLE_WALLET_FEATURES && <button onClick={() => setMoreOpen((open) => !open)} className="flex min-w-[58px] flex-col items-center gap-1 text-[10px] font-bold text-slate-400"><MoreHorizontal className="h-4 w-4" />More</button>}
        </nav>
      </header>
    </>
  );
}
