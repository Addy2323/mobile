import { useState, useEffect } from 'react';
import {
  Home, Users, FileText, Link as LinkIcon, RotateCcw, CreditCard, Settings,
  Bell, ChevronDown, Check, LogOut,
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';

export type View = 'home' | 'create' | 'merchant' | 'admin' | 'detail' | 'payment' | 'send' | 'deposit' | 'transfer' | 'control' | 'activity' | 'settings';

type HeaderProps = {
  view: View;
  onNavigate: (view: View) => void;
  onCreate: () => void;
};

export default function Header({ view, onNavigate, onCreate }: HeaderProps) {
  const [userName, setUserName] = useState<string>('');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  useEffect(() => {
    try {
      const userStr = localStorage.getItem('lumo_user');
      if (userStr) {
        const parsed = JSON.parse(userStr);
        if (parsed.full_name || parsed.name) {
          setUserName(parsed.full_name || parsed.name);
          return;
        }
      }
      const raw = localStorage.getItem('lumo_user_name');
      if (raw && !raw.startsWith('user_') && !/\d/.test(raw) && raw.trim().length > 1) {
        setUserName(raw.trim());
      }
    } catch (e) {}
  }, []);

  const navItems = [
    { id: 'home' as View, label: 'Home', icon: Home, action: () => onNavigate('home') },
    { id: 'create' as View, label: 'Split', icon: Users, action: () => onCreate() },
    { id: 'control' as View, label: 'Pay Bills', icon: FileText, action: () => onNavigate('control') },
    { id: 'create' as View, label: 'Payment Links', icon: LinkIcon, action: () => onNavigate('create') },
    { id: 'activity' as View, label: 'Transactions', icon: RotateCcw, action: () => onNavigate('activity') },
    { id: 'settings' as View, label: 'Card', icon: CreditCard, action: () => onNavigate('settings') },
    { id: 'settings' as View, label: 'Settings', icon: Settings, action: () => onNavigate('settings') },
  ];

  const isCurrentActive = (itemLabel: string) => {
    if (itemLabel === 'Home') return view === 'home';
    if (itemLabel === 'Split') return view === 'create' || view === 'detail';
    if (itemLabel === 'Pay Bills') return view === 'control';
    if (itemLabel === 'Payment Links') return view === 'merchant';
    if (itemLabel === 'Transactions') return view === 'activity';
    if (itemLabel === 'Card') return false;
    if (itemLabel === 'Settings') return view === 'settings';
    return false;
  };

  return (
    <>
      {/* 1. TOP HEADER BAR (Matches Screenshot 1:1) */}
      <header className="fixed top-0 left-0 right-0 h-[68px] z-50 bg-[#060D0E] border-b border-slate-800/80 px-6 flex items-center justify-between no-tap-highlight">
        {/* Left: LUMO Brand Logo + Tagline */}
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-1 cursor-pointer" onClick={() => onNavigate('home')}>
            <span className="text-2xl font-black tracking-tight text-white font-sans">LUM</span>
            <div className="relative inline-flex items-center justify-center">
              <span className="text-2xl font-black tracking-tight text-white font-sans">O</span>
              <span className="absolute inset-0 m-auto w-2.5 h-2.5 rounded-full border-[2.5px] border-[#00E599] bg-transparent" />
            </div>
          </div>
          <span className="hidden sm:inline-block text-sm text-slate-300 font-normal tracking-wide">
            More Together. More Possible.
          </span>
        </div>

        {/* Right: Notifications & User Profile */}
        <div className="flex items-center space-x-4">
          {/* Notification Bell with Red Badge (1) */}
          <div className="relative">
            <button
              className="relative p-2 text-slate-300 hover:text-white transition-colors rounded-full hover:bg-slate-800/50"
              title="Notifications"
            >
              <Bell className="w-5 h-5 stroke-[2]" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#EF4444] rounded-full ring-2 ring-[#060D0E]" />
            </button>
          </div>

          {/* User Profile Dropdown Pill */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center space-x-3 p-1.5 pr-2.5 rounded-full hover:bg-slate-800/60 active:scale-95 transition-all text-left"
            >
              {/* Circular Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#00E599] to-[#0D382E] p-[1.5px] shadow-sm shrink-0">
                <div className="w-full h-full rounded-full bg-[#061814] overflow-hidden flex items-center justify-center text-xs font-bold text-[#00E599]">
                  {userName ? userName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'LM'}
                </div>
              </div>

              {/* Name & Dropdown Chevron */}
              <div className="flex items-center space-x-1.5">
                <span className="text-sm font-semibold text-slate-100 hidden md:inline-block">
                  {userName || 'Member'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400 stroke-[2.5]" />
              </div>
            </button>

            {/* Dropdown Menu */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-[#0C1518] border border-slate-800 rounded-2xl shadow-2xl py-2 z-50 text-xs">
                <div className="px-4 py-2 border-b border-slate-800/80">
                  <p className="font-bold text-white truncate">{userName || 'Member'}</p>
                  <p className="text-[11px] text-[#00E599]">Verified Account</p>
                </div>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    onNavigate('settings');
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-800/60 text-slate-200 flex items-center space-x-2"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  <span>Account Settings</span>
                </button>
                <button
                  onClick={() => {
                    setUserDropdownOpen(false);
                    sessionStorage.removeItem('lumo_authenticated');
                    localStorage.removeItem('lumo_authenticated');
                    localStorage.removeItem('lumo_user_token');
                    localStorage.removeItem('lumo_user_phone');
                    localStorage.removeItem('lumo_user');
                    localStorage.removeItem('lumo_user_name');
                    window.dispatchEvent(new Event('lumo-auth-changed'));
                    window.location.reload();
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-red-950/30 text-red-400 flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. LEFT SIDEBAR NAVIGATION (Matches Screenshot 1:1) */}
      <aside className="fixed top-[68px] left-0 bottom-0 w-[220px] bg-[#060D0E] border-r border-slate-800/80 py-5 px-3 hidden md:flex flex-col z-40">
        <nav className="space-y-1.5 flex-1">
          {navItems.map((item, idx) => {
            const active = isCurrentActive(item.label);
            const IconComponent = item.icon;
            return (
              <button
                key={`${item.label}-${idx}`}
                onClick={item.action}
                className={`w-full flex items-center space-x-3.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                  active
                    ? 'bg-[#0E2822] text-[#00E599] font-bold shadow-[inset_0_1px_1px_rgba(0,229,153,0.15)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900/40'
                }`}
              >
                <IconComponent className={`w-5 h-5 shrink-0 ${active ? 'text-[#00E599] stroke-[2.4]' : 'stroke-2'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
