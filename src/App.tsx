import { useState } from 'react';
import Header, { type View } from '@/components/Header';
import HomeView from '@/views/HomeView';
import CreateView from '@/views/CreateView';
import SplitDetailView from '@/views/SplitDetailView';
import PaymentView from '@/views/PaymentView';
import MerchantView from '@/views/MerchantView';
import AdminView from '@/views/AdminView';
import LoginView from '@/views/LoginView';
import MoneyFlowView, { type MoneyFlowMode } from '@/views/MoneyFlowView';
import type { Split, Participant } from '@/lib/supabase';

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('lumo_authenticated') === 'true');
  const [view, setView] = useState<View>('home');
  const [activeSplit, setActiveSplit] = useState<Split | null>(null);
  const [activeParticipant, setActiveParticipant] = useState<Participant | null>(null);

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
    return <LoginView onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {view !== 'payment' && (
        <Header view={view} onNavigate={navigateTo} onCreate={handleCreate} />
      )}

      <main className={`${view === 'payment' ? '' : 'md:ml-[258px]'} pb-16 md:pb-0`}>
        {view === 'home' && (
          <HomeView onSplitClick={handleSplitClick} onCreate={handleCreate} />
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

        {(['send', 'deposit', 'transfer', 'control'] as const).includes(view as MoneyFlowMode) && (
          <MoneyFlowView mode={view as MoneyFlowMode} onBack={() => setView('home')} />
        )}
      </main>

      {view !== 'payment' && (
        <footer className="border-t border-slate-200 mt-12 py-6 md:ml-[258px]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <p>LUMO Split coordinates split obligations. Regulated payment providers execute payments.</p>
              <p>Tanzania-first · Mobile-money & bank payment ecosystem</p>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
