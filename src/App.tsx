import { useState, useEffect } from 'react';
import Header, { type View } from '@/components/Header';
import HomeView from '@/views/HomeView';
import CreateView from '@/views/CreateView';
import SplitDetailView from '@/views/SplitDetailView';
import PaymentView from '@/views/PaymentView';
import MerchantView from '@/views/MerchantView';
import AdminView from '@/views/AdminView';
import LoginView from '@/views/LoginView';
import MoneyFlowView, { type MoneyFlowMode } from '@/views/MoneyFlowView';
import FriendPaymentView from '@/views/FriendPaymentView';
import { FriendPaymentScreen } from '@/mobile/screens/FriendPaymentScreen';
import type { Split, Participant } from '@/lib/supabase';

import ActivityView from '@/views/ActivityView';
import SettingsView from '@/views/SettingsView';
import ControlNumberView from '@/views/ControlNumberView';

import { LayoutSwitch } from '@/mobile/components/LayoutSwitch';
import { MobileShell } from '@/mobile/components/MobileShell';
import { AdminApp } from '@/admin/AdminApp';

function getPublicToken(): string | null {
  const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

function isAdminRoute(): boolean {
  return window.location.pathname.startsWith('/admin');
}

export default function App() {
  if (isAdminRoute()) {
    return <AdminApp />;
  }

  const publicToken = getPublicToken();
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('lumo_authenticated') === 'true');
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState('');
  const [view, setView] = useState<View>('home');
  const [activeSplit, setActiveSplit] = useState<Split | null>(null);
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);

  // 60-second inactivity session lock
  useEffect(() => {
    if (!authenticated) return;

    let timer: NodeJS.Timeout;

    const resetIdleTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log('[LUMO Session] 60s idle threshold reached. Locking active session.');
        setIsLocked(true);
        setLockReason('Session locked due to 60s inactivity. Enter your passcode to unlock.');
        setAuthenticated(false);
      }, 60 * 1000); // 60 seconds
    };

    // Initialize timer
    resetIdleTimer();

    // Listen to user interactions
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((e) => window.addEventListener(e, resetIdleTimer, { passive: true }));

    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, resetIdleTimer));
    };
  }, [authenticated]);

  if (publicToken) {
    return (
      /^PL-/i.test(publicToken)
        ? <FriendPaymentScreen token={publicToken} onBackToSplit={() => { window.location.href = '/'; }} />
        : <FriendPaymentView token={publicToken} />
    );
  }

  function navigateTo(v: View) {
    setView(v);
  }

  function handleSplitClick(split: Split) {
    setActiveSplit(split);
    setView('detail');
  }

  function handleCreate() {
    setActiveSplit(null);
    setView('create');
  }

  function handleCreateComplete(split: Split) {
    setActiveSplit(split);
    setView('detail');
  }

  function handlePay(participant: Participant, split: Split) {
    setActiveParticipant(participant);
    setActiveSplit(split);
    setView('payment');
  }

  function handlePaymentComplete() {
    if (activeSplit) {
      setView('detail');
    } else {
      setView('home');
    }
  }

  if (!authenticated) {
    return (
      <LoginView
        onSuccess={() => {
          setIsLocked(false);
          setLockReason('');
          setAuthenticated(true);
        }}
        isLocked={isLocked}
        lockReason={lockReason}
        onLogoutToNewUser={() => {
          setIsLocked(false);
          setLockReason('');
          localStorage.removeItem('lumo_user');
          localStorage.removeItem('lumo_user_phone');
          localStorage.removeItem('lumo_user_token');
          localStorage.removeItem('lumo_owner_id');
          localStorage.removeItem('lumo_authenticated');
        }}
      />
    );
  }

  return (
    <LayoutSwitch mobileView={<MobileShell />}>
      <div className="min-h-screen bg-[#060D0E] text-slate-100">
        {view !== 'payment' && (
          <Header view={view} onNavigate={navigateTo} onCreate={handleCreate} />
        )}

        <main className={`${view === 'payment' ? '' : 'md:ml-[220px] pt-[68px]'} pb-16 md:pb-0`}>
          {view === 'home' && (
            <HomeView
              onSplitClick={handleSplitClick}
              onCreate={handleCreate}
              onNavigateQuickAction={(action) => {
                if (action === 'control') setView('control');
                else if (action === 'payLink') setView('create');
                else if (action === 'birthday' || action === 'michango') setView('create');
              }}
            />
          )}

          {view === 'activity' && (
            <ActivityView onSelectSplit={handleSplitClick} onBack={() => setView('home')} />
          )}

          {view === 'settings' && <SettingsView />}

          {view === 'control' && (
            <ControlNumberView
              onSplitBill={(biller, amount, ref) => {
                setView('create');
              }}
              onBack={() => setView('home')}
            />
          )}

          {view === 'create' && (
            <CreateView
              onComplete={handleCreateComplete}
              onCancel={() => setView('home')}
            />
          )}

          {view === 'detail' && activeSplit && (
            <SplitDetailView
              split={activeSplit}
              onBack={() => setView('home')}
              onPay={handlePay}
            />
          )}

          {view === 'payment' && activeSplit && activeParticipant && (
            <PaymentView
              split={activeSplit}
              participant={activeParticipant}
              onBack={() => setView('detail')}
              onComplete={handlePaymentComplete}
            />
          )}

          {view === 'merchant' && <MerchantView />}

          {view === 'admin' && <AdminView />}

          {(['send', 'deposit', 'transfer'] as const).includes(view as any) && (
            <MoneyFlowView mode={view as MoneyFlowMode} onBack={() => setView('home')} />
          )}
        </main>

        {view !== 'payment' && (
          <footer className="border-t border-slate-800/80 mt-12 py-6 md:ml-[220px] bg-[#060D0E]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                <p>LUMO Split coordinates split obligations. Regulated payment providers execute payments.</p>
                <p>Tanzania-first · Mobile-money & bank payment ecosystem</p>
              </div>
            </div>
          </footer>
        )}
      </div>
    </LayoutSwitch>
  );
}

