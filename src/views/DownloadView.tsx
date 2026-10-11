import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Share,
  MoreVertical,
  PlusSquare,
  QrCode,
  Zap,
  Users,
  CreditCard,
  Lock,
  ArrowLeft,
  Info,
  HelpCircle
} from 'lucide-react';
import { triggerAppInstallation, isStandaloneApp, isIosDevice, isAndroidDevice } from '@/lib/appDetection';
import InstallGuideModal from '@/components/InstallGuideModal';

interface ReleaseInfo {
  id: string;
  platform: string;
  version_name: string;
  version_code: number;
  file_url: string;
  file_type: string;
  file_size?: number;
  sha256_checksum?: string;
  release_notes?: string;
  min_os_version?: string;
  updated_at?: string;
}

interface DownloadViewProps {
  onBack?: () => void;
}

export const DownloadView: React.FC<DownloadViewProps> = ({ onBack }) => {
  const [platform, setPlatform] = useState<'android' | 'ios' | 'desktop'>('desktop');
  const [isStandalone, setIsStandalone] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [installSuccess, setInstallSuccess] = useState(false);
  const [releases, setReleases] = useState<Record<string, ReleaseInfo>>({});
  const [showQr, setShowQr] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'android' | 'ios' | 'desktop'>('all');

  useEffect(() => {
    // Platform detection
    if (isAndroidDevice()) {
      setPlatform('android');
      setActiveTab('android');
    } else if (isIosDevice()) {
      setPlatform('ios');
      setActiveTab('ios');
    } else {
      setPlatform('desktop');
      setActiveTab('desktop');
    }

    setIsStandalone(isStandaloneApp());

    // Fetch official release metadata from backend
    fetch('/api/releases/latest')
      .then((res) => res.json())
      .then((data) => {
        if (data.latest) {
          setReleases(data.latest);
        }
      })
      .catch((err) => console.warn('[DownloadCenter] Error loading releases:', err));
  }, []);

  const handleInstallClick = async () => {
    const result = await triggerAppInstallation();
    if (result.method === 'pwa' && result.success) {
      setInstallSuccess(true);
    } else {
      setGuideModalOpen(true);
    }
  };

  const handleReturnHome = () => {
    if (onBack) {
      onBack();
    } else {
      window.location.href = '/';
    }
  };

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#060D0E] text-slate-100 selection:bg-[#00E599] selection:text-[#060D0E]">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#060D0E]/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleReturnHome}
            className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Rudi Nyumbani (Home)</span>
          </button>
          <div className="flex items-center gap-2.5">
            <img
              src="/favicon.png"
              alt="LUMO Split"
              className="w-8 h-8 rounded-lg shadow-[0_0_12px_rgba(0,229,153,0.3)] object-cover"
            />
            <div className="leading-tight">
              <span className="font-extrabold text-sm tracking-tight text-white">
                LUMO<span className="text-[#00E599]">Split</span>
              </span>
              <span className="hidden md:inline-block ml-2 text-[10px] uppercase font-bold tracking-widest text-[#00E599]/80 bg-[#00E599]/10 px-2 py-0.5 rounded-full border border-[#00E599]/20">
                Official Download Center
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQr(!showQr)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-[#00E599]/40 text-xs font-medium text-slate-300 hover:text-white transition flex items-center gap-1.5"
          >
            <QrCode className="w-4 h-4 text-[#00E599]" />
            <span className="hidden sm:inline">QR Code</span>
          </button>
          <button
            onClick={handleInstallClick}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-bold text-xs shadow-[0_0_16px_rgba(0,229,153,0.3)] hover:brightness-110 active:scale-95 transition"
          >
            Install App
          </button>
        </div>
      </header>

      {/* QR Code Modal Drawer */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#0A1614] border border-[#00E599]/30 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <h3 className="text-base font-extrabold text-white mb-1">Scan to Install on Mobile</h3>
            <p className="text-xs text-slate-400 mb-4">
              Open your phone's camera to visit the official LUMO Split install center.
            </p>
            <div className="bg-white p-4 rounded-2xl mx-auto w-48 h-48 flex items-center justify-center shadow-inner">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  window.location.origin + '/download'
                )}`}
                alt="Scan to Install LUMO Split"
                className="w-full h-full"
              />
            </div>
            <p className="text-[11px] font-mono text-[#00E599] mt-3 break-all">
              {window.location.origin}/download
            </p>
            <button
              onClick={() => setShowQr(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition"
            >
              Funga (Close)
            </button>
          </div>
        </div>
      )}

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
        {/* Section 1: Hero */}
        <section className="relative rounded-3xl overflow-hidden border border-slate-800/80 bg-gradient-to-b from-[#091D19] via-[#061211] to-[#060D0E] p-6 sm:p-12 text-center sm:text-left shadow-2xl">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-[#00E599]/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-8 justify-between">
            <div className="space-y-4 max-w-xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E599]/10 border border-[#00E599]/30 text-[#00E599] text-xs font-bold tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                <span>OFFICIAL LUMO SPLIT INSTALLATION</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
                LUMO Split, <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-[#00E599]">
                  Ready When You Are.
                </span>
              </h1>
              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
                Split bills, coordinate group payments, and keep track of who has paid—all from your device. Fast, verified, and always in sync across Tanzania.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <button
                  onClick={handleInstallClick}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-black text-sm shadow-[0_0_24px_rgba(0,229,153,0.35)] hover:brightness-110 active:scale-95 transition flex items-center gap-2 cursor-pointer"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>Install LUMO Split</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleReturnHome}
                  className="px-6 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white font-bold text-sm transition flex items-center gap-2 cursor-pointer"
                >
                  <span>Explore the web app</span>
                  <ExternalLink className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {isStandalone && (
                <div className="inline-flex items-center gap-2 text-xs text-[#00E599] bg-[#00E599]/10 px-3 py-1.5 rounded-xl border border-[#00E599]/20">
                  <CheckCircle className="w-4 h-4" />
                  <span>App is already installed and running in standalone mode!</span>
                </div>
              )}
            </div>

            {/* Official App Icon Showcase */}
            <div className="relative group shrink-0">
              <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-3xl p-1 bg-gradient-to-br from-[#00E599]/40 via-transparent to-[#00E599]/20 shadow-[0_0_40px_rgba(0,229,153,0.25)]">
                <img
                  src="/app-icon.png"
                  alt="Official LUMO Split App Badge"
                  className="w-full h-full rounded-[22px] object-cover shadow-2xl transition duration-300 group-hover:scale-[1.02]"
                />
              </div>
              <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-[#061211] border border-[#00E599]/40 px-3 py-1 rounded-full text-[11px] font-bold text-[#00E599] shadow-lg whitespace-nowrap">
                v1.0 Official Release
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Available installation methods */}
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Choose Your Device</h2>
              <p className="text-xs text-slate-400 mt-1">
                Install LUMO Split on any device with verified instant updates and secure transaction guarantees.
              </p>
            </div>

            {/* Platform filter pills */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 text-xs">
              {(['all', 'android', 'ios', 'desktop'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-xl font-bold capitalize transition ${
                    activeTab === tab
                      ? 'bg-[#00E599] text-[#060D0E] shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab === 'all' ? 'All Devices' : tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Android */}
            {(activeTab === 'all' || activeTab === 'android') && (
              <div
                className={`relative rounded-3xl border p-6 flex flex-col justify-between transition ${
                  platform === 'android'
                    ? 'bg-gradient-to-b from-[#091D19] to-[#071312] border-[#00E599]/60 shadow-[0_0_24px_rgba(0,229,153,0.15)] ring-1 ring-[#00E599]/40'
                    : 'bg-[#081214] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {platform === 'android' && (
                  <span className="absolute -top-3 right-6 bg-[#00E599] text-[#060D0E] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    Your Device
                  </span>
                )}
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#081B17] border border-[#0D382E] text-[#00E599] flex items-center justify-center">
                    <Smartphone className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Android Application</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Native WebAPK experience with zero installation corruption or package parsing errors. Runs full-screen with instant launch.
                    </p>
                  </div>

                  <div className="pt-2 space-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Version:</span>
                      <span className="font-semibold">{releases.android?.version_name || '1.0.0'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Compatibility:</span>
                      <span className="font-semibold">{releases.android?.min_os_version || 'Android 8.0+'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Method:</span>
                      <span className="font-semibold text-[#00E599]">Native WebAPK / PWA</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2"
                  >
                    <span>Install on Android</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] text-center text-slate-500 mt-2">
                    Chrome or Samsung Internet · No manual APK parsing required
                  </p>
                </div>
              </div>
            )}

            {/* Card 2: iPhone and iPad */}
            {(activeTab === 'all' || activeTab === 'ios') && (
              <div
                className={`relative rounded-3xl border p-6 flex flex-col justify-between transition ${
                  platform === 'ios'
                    ? 'bg-gradient-to-b from-[#091D19] to-[#071312] border-[#00E599]/60 shadow-[0_0_24px_rgba(0,229,153,0.15)] ring-1 ring-[#00E599]/40'
                    : 'bg-[#081214] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {platform === 'ios' && (
                  <span className="absolute -top-3 right-6 bg-[#00E599] text-[#060D0E] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    Your Device
                  </span>
                )}
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#081B17] border border-[#0D382E] text-[#00E599] flex items-center justify-center">
                    <Share className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">iPhone & iPad</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Add to Home Screen directly from Safari. Enjoy full screen navigation, high-DPI icons, and instant load speeds.
                    </p>
                  </div>

                  <div className="pt-2 space-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Version:</span>
                      <span className="font-semibold">{releases.ios?.version_name || '1.0.0'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Compatibility:</span>
                      <span className="font-semibold">{releases.ios?.min_os_version || 'iOS 14.0+ (Safari)'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Method:</span>
                      <span className="font-semibold text-[#00E599]">Safari Add to Home Screen</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => setGuideModalOpen(true)}
                    className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition flex items-center justify-center gap-2"
                  >
                    <span>View iOS Install Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] text-center text-slate-500 mt-2">
                    Tap Share <Share className="w-3 h-3 inline mx-0.5" /> then "Add to Home Screen"
                  </p>
                </div>
              </div>
            )}

            {/* Card 3: Desktop */}
            {(activeTab === 'all' || activeTab === 'desktop') && (
              <div
                className={`relative rounded-3xl border p-6 flex flex-col justify-between transition ${
                  platform === 'desktop'
                    ? 'bg-gradient-to-b from-[#091D19] to-[#071312] border-[#00E599]/60 shadow-[0_0_24px_rgba(0,229,153,0.15)] ring-1 ring-[#00E599]/40'
                    : 'bg-[#081214] border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {platform === 'desktop' && (
                  <span className="absolute -top-3 right-6 bg-[#00E599] text-[#060D0E] text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                    Your Device
                  </span>
                )}
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#081B17] border border-[#0D382E] text-[#00E599] flex items-center justify-center">
                    <PlusSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Desktop (PC / Mac)</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Install directly through Chrome, Edge, or Brave. Pin to your taskbar or macOS dock for quick access during bill splitting.
                    </p>
                  </div>

                  <div className="pt-2 space-y-2 text-[11px] text-slate-300">
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Version:</span>
                      <span className="font-semibold">{releases.desktop?.version_name || '1.0.0'}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Compatibility:</span>
                      <span className="font-semibold">Windows 10+, macOS, Linux</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                      <span className="text-slate-500">Method:</span>
                      <span className="font-semibold text-[#00E599]">PWA App Window</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-bold text-xs shadow-md hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2"
                  >
                    <span>Install on Desktop</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <p className="text-[10px] text-center text-slate-500 mt-2">
                    Click install icon in browser address bar or menu
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Section 3: What users can do */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto">
            <h2 className="text-2xl font-extrabold text-white">What You Can Do With LUMO Split</h2>
            <p className="text-xs text-slate-400 mt-1">
              Purpose-built for dining out, group events, birthdays, and shared bills across Tanzania.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-[#081514] border border-slate-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 text-[#00E599] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">Create and Share Splits</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Create a split once, enter items or equal shares, and share a clean payment link via WhatsApp or SMS.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#081514] border border-slate-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 text-[#00E599] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">Real-Time Status Tracking</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Watch live as participants pay. See who has settled and who is pending until 100% of the bill is collected.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#081514] border border-slate-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 text-[#00E599] flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">All Local Payment Rails</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Accept and pay via M-Pesa, Airtel Money, Tigo Pesa, Halopesa, CRDB, and NMB bank accounts instantly.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#081514] border border-slate-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 text-[#00E599] flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">4-Digit Security Passcode</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Personal security PIN protects your wallet and account details with 60-second inactivity auto-lock.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#081514] border border-slate-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 text-[#00E599] flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">Birthday & Michango Pools</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Collect group contributions for celebrations, weddings, and emergencies with transparent public progress bars.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#081514] border border-slate-800/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00E599]/10 text-[#00E599] flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">Verified Merchant Settlement</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Direct bill payment to partner hotels, lounges, and supermarkets with verified merchant destination codes.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Security and updates */}
        <section className="rounded-3xl bg-[#081715] border border-[#0D382E] p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-[#00E599]/10 border border-[#00E599]/30 text-[#00E599] flex items-center justify-center shrink-0">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div className="space-y-1.5 text-center sm:text-left">
            <h3 className="text-base font-extrabold text-white">Official Security & Financial Integrity</h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              LUMO Split never caches financial balances, payment credentials, or unverified transaction results offline. All payment confirmations are verified authoritatively through regulated bank and telecom payment gateways. Always install from the official domain <span className="text-[#00E599] font-mono font-semibold">nosplit.lumo.co.tz</span>.
            </p>
          </div>
        </section>

        {/* Section 5: Help & Troubleshooting */}
        <section className="space-y-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-[#00E599]" />
            <h2 className="text-xl font-bold text-white">Installation Help & Troubleshooting</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#071312] border border-slate-800/80 space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-[#00E599] flex items-center justify-center text-[11px]">1</span>
                Android: Chrome says "This app cannot be installed"?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Refresh the page once to load the updated manifest. Tap Chrome's three dots (<MoreVertical className="w-3.5 h-3.5 inline text-[#00E599]" />) and select <strong>"Add to Home screen"</strong> or <strong>"Install app"</strong>.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#071312] border border-slate-800/80 space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-[#00E599] flex items-center justify-center text-[11px]">2</span>
                iOS: Can't find the install button in Safari?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Apple requires installing web apps via the Safari Share menu. Tap the <strong>Share button</strong> (<Share className="w-3.5 h-3.5 inline text-[#00E599]" />), scroll down and tap <strong>"Add to Home Screen"</strong>.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#071312] border border-slate-800/80 space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-[#00E599] flex items-center justify-center text-[11px]">3</span>
                Will I lose my existing split data?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                No. All your splits and participant payment confirmations are safely linked to your phone number on our server. Logging in on any installed device restores everything instantly.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-[#071312] border border-slate-800/80 space-y-2">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-[#00E599] flex items-center justify-center text-[11px]">4</span>
                How do updates work?
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                LUMO Split updates automatically in the background whenever you open the app. You never need to download manual update files.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 mt-20 py-8 bg-[#060D0E]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="LUMO" className="w-5 h-5 rounded" />
            <span>© {currentYear} LUMO Split. Regulated payment rails coordinate all settlements.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <button onClick={handleReturnHome} className="hover:text-white transition">
              Home
            </button>
            <button onClick={handleInstallClick} className="hover:text-[#00E599] transition">
              Install App
            </button>
            <a href="https://nosplit.lumo.co.tz" className="hover:text-white transition">
              nosplit.lumo.co.tz
            </a>
          </div>
        </div>
      </footer>

      {/* Step-by-Step Install Guide Modal */}
      <InstallGuideModal open={guideModalOpen} onClose={() => setGuideModalOpen(false)} />
    </div>
  );
};

export default DownloadView;
