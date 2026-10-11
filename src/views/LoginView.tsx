import React, { useEffect, useState } from 'react';
import {
  LockKeyhole,
  Eye,
  EyeOff,
  Delete,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { SixBoxOtpInput } from '@/components/SixBoxOtpInput';
import { OnboardingScreen } from '@/mobile/screens/OnboardingScreen';

export type LoginViewProps = {
  onSuccess: () => void;
  isLocked?: boolean;
  lockReason?: string;
  onLogoutToNewUser?: () => void;
};

type AuthMode =
  | 'phone_check'
  | 'login'
  | 'onboarding'
  | 'forgot_phone'
  | 'forgot_otp'
  | 'forgot_new_passcode';

function normalizeTzPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.startsWith('255')) digits = digits.slice(3);
  return digits ? `255${digits}` : '';
}

function formatDisplayPhone(normalized: string): string {
  if (!normalized) return '';
  if (normalized.startsWith('255')) {
    const local = normalized.slice(3);
    if (local.length === 9) {
      return `+255 ${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
    }
    return `+255 ${local}`;
  }
  return normalized;
}

export default function LoginView({
  onSuccess,
  isLocked = false,
  lockReason,
  onLogoutToNewUser
}: LoginViewProps) {
  // Stored user profile
  const storedUserRaw = localStorage.getItem('lumo_user');
  const initialUser = storedUserRaw ? JSON.parse(storedUserRaw) : null;
  const storedPhone = localStorage.getItem('lumo_user_phone') || (initialUser?.phone ?? '');

  // 1. Initial State: If user already created account, go straight to passcode. Otherwise, phone check!
  const [mode, setMode] = useState<AuthMode>(() => {
    if (storedPhone) return 'login';
    return 'phone_check';
  });

  // State for Phone Check
  const [checkPhoneInput, setCheckPhoneInput] = useState('');
  const [checkingPhone, setCheckingPhone] = useState(false);

  // State for Login
  const [loginPhone, setLoginPhone] = useState(storedPhone);
  const [loginUserName, setLoginUserName] = useState(initialUser?.name || '');
  const [digits, setDigits] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // State for Onboarding Transition
  const [onboardingPhone, setOnboardingPhone] = useState('');

  // State for Forgot Passcode
  const [forgotPhone, setForgotPhone] = useState(storedPhone);
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [showResetPasscode, setShowResetPasscode] = useState(false);

  // Lock body & html background to #060D0E
  useEffect(() => {
    const origBodyBg = document.body.style.backgroundColor;
    const origHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.backgroundColor = '#060D0E';
    document.documentElement.style.backgroundColor = '#060D0E';

    return () => {
      document.body.style.backgroundColor = origBodyBg;
      document.documentElement.style.backgroundColor = origHtmlBg;
    };
  }, []);

  // Keypad effect for 4-digit quick submit in 'login' mode
  useEffect(() => {
    if (mode === 'login' && digits.length === 4 && !busy) {
      void handleLoginSubmit();
    }
  }, [digits, mode, busy]);

  function switchMode(newMode: AuthMode) {
    setError('');
    setSuccessMsg('');
    setDigits('');
    setBusy(false);
    setMode(newMode);
  }

  function addDigit(digit: string) {
    if (digits.length < 4) {
      setError('');
      setDigits((v) => v + digit);
    }
  }

  function removeDigit() {
    setError('');
    setDigits((v) => v.slice(0, -1));
  }

  // -------------------------------------------------------------
  // 1. PHONE CHECK HANDLER (Branch to Passcode or Onboarding)
  // -------------------------------------------------------------
  async function handlePhoneCheckSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const cleanPhone = normalizeTzPhone(checkPhoneInput);
    if (!cleanPhone || cleanPhone.length < 12) {
      setError('Tafadhali ingiza namba sahihi ya simu (mfano: 0712 345 678)');
      return;
    }

    setCheckingPhone(true);
    setError('');

    try {
      const res = await fetch('/api/auth/check-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check phone failed');

      if (data.exists) {
        // User already has an account -> Direct immediately to Passcode section!
        setLoginPhone(cleanPhone);
        if (data.name) setLoginUserName(data.name);
        setDigits('');
        switchMode('login');
      } else {
        // User is new -> Direct immediately to Onboarding stage!
        setOnboardingPhone(cleanPhone);
        switchMode('onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'Hitilafu imetokea. Tafadhali jaribu tena.');
    } finally {
      setCheckingPhone(false);
    }
  }

  // -------------------------------------------------------------
  // 2. LOGIN WITH PASSCODE
  // -------------------------------------------------------------
  async function handleLoginSubmit() {
    if (!loginPhone) {
      setError('Please provide your registered phone number');
      return;
    }
    if (digits.length !== 4) {
      setError('Passcode must be exactly 4 digits');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: loginPhone,
          passcode: digits
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid passcode');
      }

      localStorage.setItem('lumo_authenticated', 'true');
      localStorage.setItem('lumo_onboarded', 'true');
      localStorage.setItem('lumo_user_name', data.user.name);
      localStorage.setItem('lumo_user_phone', data.user.phone);
      if (data.token) localStorage.setItem('lumo_user_token', data.token);
      localStorage.setItem('lumo_user', JSON.stringify(data.user));

      window.dispatchEvent(new Event('lumo-auth-changed'));
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Passcode sio sahihi. Jaribu tena.');
      setDigits('');
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 3. FORGOT PASSCODE FLOW
  // -------------------------------------------------------------
  async function handleForgotSendOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = normalizeTzPhone(forgotPhone);
    if (!cleanPhone || cleanPhone.length < 12) {
      setError('Please enter a valid phone number');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, purpose: 'RESET_PASSCODE' })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setSuccessMsg(data.message || 'OTP verification code sent via SMS');
      setForgotPhone(cleanPhone);
      setForgotOtp('');
      switchMode('forgot_otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || forgotOtp).trim();
    if (code.length !== 6) {
      setError('Please enter all 6 digits of the verification code');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone,
          code,
          purpose: 'RESET_PASSCODE'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP code');

      setSuccessMsg('Phone verified! Enter your new passcode.');
      switchMode('forgot_new_passcode');
    } catch (err: any) {
      setError(err.message || 'Invalid code');
      setForgotOtp('');
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPasscodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPasscode.length !== 4) {
      setError('Passcode must be 4 digits');
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      setError('Passcodes do not match');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/reset-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone,
          newPasscode
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset passcode');

      setSuccessMsg('Passcode reset successfully! You can now log in.');
      setLoginPhone(forgotPhone);
      setDigits('');
      setTimeout(() => {
        switchMode('login');
      }, 900);
    } catch (err: any) {
      setError(err.message || 'Failed to reset passcode');
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // IF USER IS NEW -> RENDER FULL ONBOARDING FLOW
  // -------------------------------------------------------------
  if (mode === 'onboarding') {
    return (
      <OnboardingScreen
        initialPhone={onboardingPhone}
        initialStep="carousel"
        language="en"
        onLanguageChange={() => {}}
        onComplete={() => {
          onSuccess();
        }}
        onBackToPhoneCheck={() => {
          switchMode('phone_check');
        }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#060D0E] text-slate-100 flex flex-col justify-between items-center select-none font-sans"
      style={{ backgroundColor: '#060D0E' }}
    >
      {/* Corner luxury emerald wave ribbons - Matching OnboardingScreen */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden z-0"
        preserveAspectRatio="none"
        viewBox="0 0 400 850"
      >
        <defs>
          <linearGradient id="lumoCornerWave1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E599" stopOpacity="0.7" />
            <stop offset="60%" stopColor="#059669" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#042018" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="lumoCornerWave2" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#042018" stopOpacity="0.0" />
            <stop offset="50%" stopColor="#059669" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00E599" stopOpacity="0.65" />
          </linearGradient>
          <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        <path
          d="M -50,90 C -10,60 30,25 90,-20"
          fill="none"
          stroke="url(#lumoCornerWave1)"
          strokeWidth="2"
          filter="url(#softGlow)"
          opacity="0.6"
        />
        <path
          d="M -40,120 C 10,80 50,40 120,-10"
          fill="none"
          stroke="url(#lumoCornerWave1)"
          strokeWidth="1.2"
          opacity="0.35"
        />
        <path
          d="M 230,860 C 290,820 360,780 460,750"
          fill="none"
          stroke="url(#lumoCornerWave2)"
          strokeWidth="2.5"
          filter="url(#softGlow)"
          opacity="0.6"
        />
        <path
          d="M 270,860 C 330,830 390,800 470,780"
          fill="none"
          stroke="url(#lumoCornerWave2)"
          strokeWidth="1.2"
          opacity="0.35"
        />
      </svg>

      {/* Main Container - Centered and full-height without borders */}
      <div
        className="w-full max-w-md sm:max-w-lg mx-auto min-h-full flex-1 flex flex-col justify-between relative z-10 px-6 pt-7 pb-8 sm:pt-9 sm:pb-10"
        style={{ minHeight: '100dvh' }}
      >
        {/* Header: LUMO Split Brand */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#06241D] to-[#0D382E] border border-[#00E599]/40 flex items-center justify-center text-[#00E599] shadow-[0_0_12px_rgba(0,229,153,0.2)]">
              <span className="text-xs font-black tracking-tight">[|]</span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-xl font-extrabold text-white tracking-tight flex items-center">
                LUMO<span className="text-[#00E599]">Split</span>
              </span>
              <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mt-0.5">
                Group Bills, Settled
              </span>
            </div>
          </div>

          {mode !== 'phone_check' && (
            <button
              onClick={() => switchMode('phone_check')}
              className="text-xs font-bold text-[#00E599] hover:text-[#52ffc2] active:scale-95 transition-all tracking-wide px-2 py-1"
            >
              Change Phone
            </button>
          )}
        </div>

        {/* Alerts */}
        <div className="mt-4 space-y-2">
          {isLocked && (
            <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-[#161208] p-3 text-xs text-amber-300">
              <LockKeyhole className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{lockReason || 'Session locked due to 60s inactivity. Enter passcode to unlock.'}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-[#1C0D11] p-3 text-xs font-semibold text-rose-300 animate-in fade-in">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-2xl border border-[#00E599]/30 bg-[#0A2620] p-3 text-xs font-semibold text-[#00E599] animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00E599]" />
              <span>{successMsg}</span>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------------- */}
        {/* CARD 1: PHONE CHECK ENTRY CARD (First Card to be Seen) */}
        {/* ------------------------------------------------------------- */}
        {mode === 'phone_check' && (
          <div className="my-auto space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-[#0B2520] border border-[#00E599]/40 rounded-2xl flex items-center justify-center mx-auto text-[#00E599] shadow-[0_0_24px_rgba(0,229,153,0.25)]">
                <Smartphone className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Enter your phone number
              </h2>
              <p className="text-slate-400 text-sm max-w-xs mx-auto leading-relaxed">
                Ingiza namba yako ya simu. Ikiwa umesajiliwa utaenda moja kwa moja kwenye passcode, au utaelekezwa kujiunga.
              </p>
            </div>

            <form onSubmit={handlePhoneCheckSubmit} className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#00E599] text-base">
                  +255
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  value={checkPhoneInput}
                  onChange={(e) => {
                    setError('');
                    setCheckPhoneInput(e.target.value);
                  }}
                  placeholder="712 345 678"
                  className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none font-bold text-lg text-white shadow-inner"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={checkingPhone || !checkPhoneInput.trim()}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_28px_rgba(0,229,153,0.38)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {checkingPhone ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Inathibitisha...</span>
                  </>
                ) : (
                  <>
                    <span>Continue</span>
                    <ChevronRight className="w-5 h-5 stroke-[2.8]" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setOnboardingPhone('');
                  switchMode('onboarding');
                }}
                className="text-xs font-bold text-slate-400 hover:text-[#00E599] transition flex items-center justify-center gap-1.5 mx-auto"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#00E599]" />
                <span>New to LUMO? Take a quick tour</span>
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CARD 2: PASSCODE CARD (For Registered Users) */}
        {/* ------------------------------------------------------------- */}
        {mode === 'login' && (
          <div className="my-auto space-y-6 text-center">
            <div>
              <div className="w-16 h-16 bg-[#0B2520] border border-[#00E599]/40 rounded-2xl flex items-center justify-center mx-auto text-[#00E599] shadow-[0_0_24px_rgba(0,229,153,0.25)] mb-3">
                <LockKeyhole className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {loginUserName ? `Habari, ${loginUserName}` : 'Enter your Passcode'}
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm mt-1">
                {loginPhone ? `${formatDisplayPhone(loginPhone)}` : 'Enter your 4-digit passcode to unlock'}
              </p>
            </div>

            {/* Passcode Visual Circles + Eye Toggle */}
            <div className="relative my-4 flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((index) => {
                const char = digits[index];
                const hasValue = digits.length > index;
                return (
                  <div
                    key={index}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-xl font-bold transition-all ${
                      hasValue
                        ? 'border-[#00E599] bg-[#0A2620] text-[#00E599] shadow-[0_0_16px_rgba(0,229,153,0.35)]'
                        : 'border-slate-800 bg-[#0C1518] text-transparent'
                    }`}
                  >
                    {hasValue ? (showPasscode ? char : '●') : ''}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-full border border-slate-800 bg-[#0C1518] text-slate-400 transition hover:bg-slate-800 hover:text-white"
                title={showPasscode ? 'Hide Passcode' : 'Show Passcode'}
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-[#00E599]" />}
              </button>
            </div>

            {/* 3x4 Numeric Keypad */}
            <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => addDigit(digit)}
                  disabled={busy}
                  className="flex h-14 items-center justify-center rounded-2xl border border-slate-800 bg-[#0C1518] text-xl font-bold text-white transition active:scale-95 active:bg-[#00E599]/20 hover:border-[#00E599]/30"
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => addDigit('0')}
                disabled={busy}
                className="flex h-14 items-center justify-center rounded-2xl border border-slate-800 bg-[#0C1518] text-xl font-bold text-white transition active:scale-95 active:bg-[#00E599]/20 hover:border-[#00E599]/30"
              >
                0
              </button>
              <button
                type="button"
                onClick={removeDigit}
                disabled={busy}
                className="flex h-14 items-center justify-center rounded-2xl border border-slate-800/60 text-slate-400 transition active:scale-95 hover:bg-slate-800 hover:text-white"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            {/* Footers */}
            <div className="pt-2 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => switchMode('forgot_phone')}
                className="text-xs font-bold text-[#00E599] transition hover:text-[#52ffc2] hover:underline"
              >
                Umesahau Passcode? (Reset via SMS)
              </button>

              <button
                type="button"
                onClick={() => {
                  setCheckPhoneInput('');
                  switchMode('phone_check');
                }}
                className="text-xs font-medium text-slate-400 hover:text-white transition"
              >
                Switch Account / Different Phone
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CARD 3: FORGOT PASSCODE - PHONE INPUT */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot_phone' && (
          <div className="my-auto space-y-6">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="flex items-center text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Passcode
            </button>

            <div className="w-14 h-14 bg-[#0B2520] border border-[#00E599]/40 rounded-2xl flex items-center justify-center text-[#00E599] shadow-[0_0_20px_rgba(0,229,153,0.25)]">
              <KeyRound className="w-7 h-7" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">Reset Passcode</h1>
              <p className="mt-1 text-xs text-slate-400">
                Enter your registered phone number. We will send an SMS verification code via Meseji.
              </p>
            </div>

            <form onSubmit={handleForgotSendOtp} className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#00E599] text-base">
                  +255
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  placeholder="712 345 678"
                  className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none font-bold text-lg text-white shadow-inner"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_28px_rgba(0,229,153,0.38)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Send OTP Code</span>}
              </button>
            </form>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CARD 4: FORGOT PASSCODE - 6-BOX OTP INPUT */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot_otp' && (
          <div className="my-auto space-y-6 text-center">
            <button
              type="button"
              onClick={() => switchMode('forgot_phone')}
              className="flex items-center text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
            </button>

            <div>
              <h1 className="text-2xl font-extrabold text-white">Enter 6-Digit Code</h1>
              <p className="mt-1 text-xs text-slate-400">
                Code sent to {formatDisplayPhone(forgotPhone)}. Enter the 6 digits to verify.
              </p>
            </div>

            <SixBoxOtpInput
              value={forgotOtp}
              onChange={(val) => {
                setError('');
                setForgotOtp(val);
              }}
              onComplete={(code) => {
                void handleForgotVerifyOtp(code);
              }}
              disabled={busy}
            />

            {busy && (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-[#00E599]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying code...</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleForgotSendOtp}
              disabled={busy}
              className="text-xs font-bold text-[#00E599] hover:text-[#52ffc2] transition"
            >
              Resend Code via Meseji
            </button>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* CARD 5: FORGOT PASSCODE - NEW PASSCODE */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot_new_passcode' && (
          <div className="my-auto space-y-6">
            <div>
              <h1 className="text-2xl font-extrabold text-white">Set New Passcode</h1>
              <p className="mt-1 text-xs text-slate-400">Create a new 4-digit passcode for your account.</p>
            </div>

            <form onSubmit={handleResetPasscodeSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block">New 4-Digit Passcode</label>
                <div className="relative">
                  <input
                    type={showResetPasscode ? 'text' : 'password'}
                    inputMode="numeric"
                    maxLength={4}
                    value={newPasscode}
                    onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none font-bold text-xl text-center text-white tracking-widest shadow-inner"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPasscode(!showResetPasscode)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showResetPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 mb-1 block">Confirm New Passcode</label>
                <input
                  type={showResetPasscode ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={4}
                  value={confirmNewPasscode}
                  onChange={(e) => setConfirmNewPasscode(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none font-bold text-xl text-center text-white tracking-widest shadow-inner"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_28px_rgba(0,229,153,0.38)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <span>Update Passcode</span>}
              </button>
            </form>
          </div>
        )}

        {/* Bottom subtle copyright / info */}
        <div className="text-center pt-4">
          <p className="text-[10px] text-slate-600 font-medium tracking-wide">
            LUMO Split · Bank-grade security & Lipa Namba integration
          </p>
        </div>
      </div>
    </div>
  );
}
