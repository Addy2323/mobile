import React, { useState, useEffect } from 'react';
import { TopAppBar } from './TopAppBar';
import { BottomNav, type TabType } from './BottomNav';
import { HomeScreen } from '../screens/HomeScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CreateSplitScreen } from '../screens/CreateSplitScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { FriendPaymentScreen } from '../screens/FriendPaymentScreen';
import { SplitStatusScreen } from '../screens/SplitStatusScreen';
import { PayLinkScreen } from '../screens/PayLinkScreen';
import { BirthdayScreen } from '../screens/BirthdayScreen';
import { MichangoScreen } from '../screens/MichangoScreen';
import { PayBillScreen } from '../screens/PayBillScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { NotificationsSheet } from '../screens/NotificationsSheet';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { Toast, type ToastMessage } from './Toast';
import { type Split } from '@/lib/supabase';
import { type Language } from '@/lib/i18n';

export const MobileShell: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [activeView, setActiveView] = useState<
    'main' | 'create' | 'splitStatus' | 'payLink' | 'birthday' | 'michango' | 'payBill' | 'friendPayment'
  >('main');

  const [language, setLanguage] = useState<Language>('en');
  const [hasOnboarded, setHasOnboarded] = useState<boolean>(() => {
    return localStorage.getItem('lumo_onboarded') === 'true';
  });

  const [selectedSplit, setSelectedSplit] = useState<Split | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);

  // Check URL path or query params for payment link (/s/:token)
  useEffect(() => {
    const path = window.location.pathname;
    if (path.startsWith('/s/')) {
      setActiveView('friendPayment');
    }
  }, []);

  const showToast = (title: string, message?: string, type: 'success' | 'error' | 'info' = 'success') => {
    setActiveToast({ id: Date.now().toString(), type, title, message });
  };

  const handleOnboardingComplete = () => {
    localStorage.setItem('lumo_onboarded', 'true');
    setHasOnboarded(true);
    showToast('Welcome to LUMO Split! 🎉', 'Your mobile wallet and bill splitting hub is ready.');
  };

  if (!hasOnboarded) {
    return (
      <OnboardingScreen
        onComplete={handleOnboardingComplete}
        language={language}
        onLanguageChange={setLanguage}
      />
    );
  }

  // Handle /s/:token guest payment screen view
  if (activeView === 'friendPayment') {
    const token = window.location.pathname.replace('/s/', '') || 'BH7K2';
    return (
      <FriendPaymentScreen
        token={token}
        language={language}
        onBackToSplit={() => setActiveView('main')}
      />
    );
  }

  return (
    <div className="min-h-dvh bg-[#070D18] flex justify-center selection:bg-[#FF6500] selection:text-white font-sans antialiased">
      {/* Mobile container - centered 560px on tablets/iPad, 100% on phone */}
      <div className="w-full max-w-[560px] min-h-dvh bg-slate-50 flex flex-col relative shadow-2xl overflow-x-hidden border-x border-slate-900/20">
        
        {/* Top App Bar (visible on main views) - header seamlessly blends status bar */}
        {activeView === 'main' && (
          <TopAppBar
            language={language}
            onLanguageToggle={() => setLanguage(language === 'en' ? 'sw' : 'en')}
            onOpenNotifications={() => setIsNotificationsOpen(true)}
          />
        )}

        {/* Dynamic Screen Renderer with exact safe bottom padding */}
        <main className={`flex-1 overflow-y-auto ${activeView === 'main' ? 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px)+24px)]' : 'pb-12'}`}>
          {activeView === 'main' && (
            <>
              {currentTab === 'home' && (
                <HomeScreen
                  language={language}
                  onSplitClick={(split: Split) => {
                    setSelectedSplit(split);
                    setActiveView('splitStatus');
                  }}
                  onCreate={() => setActiveView('create')}
                  onNavigateQuickAction={(action) => {
                    if (action === 'payLink') setActiveView('payLink');
                    if (action === 'birthday') setActiveView('birthday');
                    if (action === 'michango') setActiveView('michango');
                    if (action === 'control') setActiveView('payBill');
                  }}
                />
              )}

              {currentTab === 'activity' && (
                <ActivityScreen
                  language={language}
                  onSelectSplit={(split: Split) => {
                    setSelectedSplit(split);
                    setActiveView('splitStatus');
                  }}
                />
              )}

              {currentTab === 'scan' && (
                <ScanScreen
                  language={language}
                  onScanComplete={(merchantName, amount) => {
                    setActiveView('create');
                  }}
                />
              )}

              {currentTab === 'rewards' && <RewardsScreen language={language} />}

              {currentTab === 'profile' && (
                <ProfileScreen
                  language={language}
                  onLanguageChange={setLanguage}
                  onNavigateView={(view) => {
                    if (view === 'merchant') showToast('Merchant Portal', 'Navigating to Merchant Dashboard');
                    if (view === 'admin') showToast('Operations', 'Navigating to Admin & Operations');
                  }}
                  onOpenNotifications={() => setIsNotificationsOpen(true)}
                  onSignOut={() => {
                    localStorage.removeItem('lumo_onboarded');
                    setHasOnboarded(false);
                  }}
                />
              )}
            </>
          )}

          {activeView === 'create' && (
            <CreateSplitScreen
              language={language}
              onCancel={() => setActiveView('main')}
              onComplete={(split: Split) => {
                setSelectedSplit(split);
                setActiveView('splitStatus');
                showToast('Split Created', 'Share link sent to participants.');
              }}
            />
          )}

          {activeView === 'splitStatus' && selectedSplit && (
            <SplitStatusScreen
              split={selectedSplit}
              language={language}
              onBack={() => setActiveView('main')}
              onPay={(participant, split: Split) => {
                setActiveView('friendPayment');
              }}
            />
          )}

          {activeView === 'payLink' && (
            <PayLinkScreen language={language} onBack={() => setActiveView('main')} />
          )}

          {activeView === 'birthday' && (
            <BirthdayScreen language={language} onBack={() => setActiveView('main')} />
          )}

          {activeView === 'michango' && (
            <MichangoScreen language={language} onBack={() => setActiveView('main')} />
          )}

          {activeView === 'payBill' && (
            <PayBillScreen
              language={language}
              onBack={() => setActiveView('main')}
              onSplitBill={(billerName, amount) => {
                setActiveView('create');
              }}
            />
          )}
        </main>

        {/* Bottom Navigation Bar (visible in main tabbed views) */}
        {activeView === 'main' && (
          <BottomNav
            currentTab={currentTab}
            onTabChange={(tab: TabType) => setCurrentTab(tab)}
            language={language}
          />
        )}

        {/* Notifications Bottom Sheet */}
        <NotificationsSheet
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          language={language}
        />

        {/* Toast Notifications */}
        <Toast toast={activeToast} onClose={() => setActiveToast(null)} />
      </div>
    </div>
  );
};
