import React, { useEffect, useState, useRef } from 'react';
import {
  LockKeyhole,
  ShieldCheck,
  Eye,
  EyeOff,
  Delete,
  ArrowLeft,
  KeyRound,
  UserPlus,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RotateCcw
} from 'lucide-react';
import Logo from '@/components/Logo';

export type LoginViewProps = {
  onSuccess: () => void;
  isLocked?: boolean;
  lockReason?: string;
  onLogoutToNewUser?: () => void;
};

type AuthMode =
  | 'login'
  | 'forgot_phone'
  | 'forgot_otp'
  | 'forgot_new_passcode'
  | 'register_details'
  | 'register_otp'
  | 'register_passcode';

interface SixBoxOtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

function SixBoxOtpInput({ value, onChange, onComplete, disabled = false }: SixBoxOtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first empty box or box 0 on mount
    const firstEmptyIndex = [0, 1, 2, 3, 4, 5].find((i) => !value[i]) ?? 0;
    inputRefs.current[firstEmptyIndex]?.focus();
  }, []);

  const handleDigitChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '');

    if (!digits) {
      // User erased
      const arr = value.split('');
      arr[index] = '';
      const updated = arr.join('').trimEnd();
      onChange(updated);
      return;
    }

    if (digits.length > 1) {
      // Pasted multiple digits
      const pasted = digits.slice(0, 6);
      onChange(pasted);
      if (pasted.length === 6) {
        inputRefs.current[5]?.focus();
        onComplete(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
      return;
    }

    // Single digit entered
    const digit = digits[digits.length - 1];
    const arr = value.padEnd(6, ' ').split('');
    arr[index] = digit;
    const updated = arr.join('').trimEnd();
    onChange(updated);

    if (index < 5 && digit) {
      inputRefs.current[index + 1]?.focus();
    }

    const cleanCode = arr.join('').replace(/\s/g, '');
    if (cleanCode.length === 6) {
      onComplete(cleanCode);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) {
      onChange(pasted);
      if (pasted.length === 6) {
        inputRefs.current[5]?.focus();
        onComplete(pasted);
      } else {
        inputRefs.current[pasted.length]?.focus();
      }
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-2.5 my-3">
      {[0, 1, 2, 3, 4, 5].map((idx) => {
        const char = value[idx] || '';
        return (
          <input
            key={idx}
            ref={(el) => (inputRefs.current[idx] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={char}
            onChange={(e) => handleDigitChange(idx, e)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            onPaste={handlePaste}
            disabled={disabled}
            className={`h-12 w-10 sm:h-13 sm:w-12 text-center text-2xl font-black rounded-xl border transition-all outline-none ${
              char
                ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-950/40'
                : 'border-white/15 bg-white/5 text-white focus:border-emerald-400 focus:bg-white/10'
            }`}
          />
        );
      })}
    </div>
  );
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

  const [mode, setMode] = useState<AuthMode>(() => {
    if (storedPhone) return 'login';
    return 'register_details';
  });

  // State for Login
  const [loginPhone, setLoginPhone] = useState(storedPhone);
  const [digits, setDigits] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  // State for Registration
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [regPasscode, setRegPasscode] = useState('');
  const [regConfirmPasscode, setRegConfirmPasscode] = useState('');
  const [showRegPasscode, setShowRegPasscode] = useState(false);

  // State for Forgot Passcode
  const [forgotPhone, setForgotPhone] = useState(storedPhone);
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmNewPasscode, setConfirmNewPasscode] = useState('');
  const [showResetPasscode, setShowResetPasscode] = useState(false);

  // Keypad effect for 4-digit quick submit in 'login' mode
  useEffect(() => {
    if (mode === 'login' && digits.length === 4 && !busy) {
      void handleLoginSubmit();
    }
  }, [digits, mode, busy]);

  // Clear errors on mode switch
  function switchMode(newMode: AuthMode) {
    setError('');
    setSuccessMsg('');
    setDigits('');
    setBusy(false);
    setMode(newMode);
  }

  // Keypad handlers for login
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
  // 1. LOGIN SUBMIT
  // -------------------------------------------------------------
  async function handleLoginSubmit() {
    if (!loginPhone) {
      setError('Please provide your registered phone number');
      return;
    }
    if (digits.length !== 4) {
      setError('Please enter your 4-digit passcode');
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
        throw new Error(data.error || 'Incorrect passcode. Try again.');
      }

      // Save user session
      localStorage.setItem('lumo_user_token', data.token);
      localStorage.setItem('lumo_user', JSON.stringify(data.user));
      localStorage.setItem('lumo_user_phone', data.user.phone);
      localStorage.setItem('lumo_user_name', data.user.name);
      localStorage.setItem('lumo_owner_id', data.user.id);
      localStorage.setItem('lumo_authenticated', 'true');
      window.dispatchEvent(new Event('lumo_user_profile_updated'));

      setSuccessMsg('Welcome back!');
      setTimeout(() => {
        onSuccess();
      }, 300);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      setDigits('');
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 2. FORGOT PASSCODE - SEND OTP
  // -------------------------------------------------------------
  async function handleForgotSendOtp() {
    if (!forgotPhone || forgotPhone.trim().length < 9) {
      setError('Please enter a valid phone number (e.g. 07XXXXXXXX)');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: forgotPhone,
          purpose: 'FORGOT_PASSCODE'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send reset code');
      }

      setSuccessMsg(`Verification code sent to ${data.phone || forgotPhone}`);
      switchMode('forgot_otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 3. FORGOT PASSCODE - VERIFY OTP
  // -------------------------------------------------------------
  async function handleForgotVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || forgotOtp || '').trim();
    if (code.length !== 6) {
      setError('Please enter the 6-digit verification code sent via SMS');
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
          purpose: 'FORGOT_PASSCODE'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      setSuccessMsg('Phone verified! Set your new passcode.');
      switchMode('forgot_new_passcode');
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
      setForgotOtp('');
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 4. FORGOT PASSCODE - RESET PASSCODE
  // -------------------------------------------------------------
  async function handleResetPasscodeSubmit() {
    if (newPasscode.length !== 4) {
      setError('New passcode must be exactly 4 digits');
      return;
    }
    if (newPasscode !== confirmNewPasscode) {
      setError('Passcodes do not match. Please verify.');
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
          newPasscode,
          otpCode: forgotOtp.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update passcode');
      }

      setLoginPhone(forgotPhone);
      setSuccessMsg('Passcode reset successfully! Please log in.');
      switchMode('login');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 5. REGISTRATION - SEND OTP
  // -------------------------------------------------------------
  async function handleRegisterSendOtp() {
    if (!regPhone || regPhone.trim().length < 9) {
      setError('Please enter a valid phone number (e.g. 07XXXXXXXX)');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: regPhone,
          purpose: 'REGISTER'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send SMS code');
      }

      setSuccessMsg(`Verification code sent via SMS to ${data.phone || regPhone}`);
      switchMode('register_otp');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 6. REGISTRATION - VERIFY OTP
  // -------------------------------------------------------------
  async function handleRegisterVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || regOtp || '').trim();
    if (code.length !== 6) {
      setError('Please enter the 6-digit code received via SMS');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: regPhone,
          code,
          purpose: 'REGISTER'
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Invalid code');
      }

      setSuccessMsg('Phone verified! Now choose your 4-digit passcode.');
      switchMode('register_passcode');
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
      setRegOtp('');
    } finally {
      setBusy(false);
    }
  }

  // -------------------------------------------------------------
  // 7. REGISTRATION - COMPLETE SIGNUP
  // -------------------------------------------------------------
  async function handleRegisterComplete() {
    if (regPasscode.length !== 4) {
      setError('Passcode must be exactly 4 digits');
      return;
    }
    if (regPasscode !== regConfirmPasscode) {
      setError('Passcodes do not match. Try again.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: regPhone,
          name: regName || 'LUMO Member',
          passcode: regPasscode,
          otpCode: regOtp.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Save user session & owner id
      localStorage.setItem('lumo_user_token', data.token);
      localStorage.setItem('lumo_user', JSON.stringify(data.user));
      localStorage.setItem('lumo_user_phone', data.user.phone);
      localStorage.setItem('lumo_user_name', data.user.name);
      localStorage.setItem('lumo_owner_id', data.user.id);
      localStorage.setItem('lumo_authenticated', 'true');
      window.dispatchEvent(new Event('lumo_user_profile_updated'));

      setSuccessMsg('Account created successfully!');
      setTimeout(() => {
        onSuccess();
      }, 400);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07090e] px-4 py-8 text-white selection:bg-emerald-500 selection:text-black">
      <div className="w-full max-w-[390px] rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
        
        {/* Top Header Logo */}
        <div className="mb-6 flex justify-center">
          <Logo size="md" variant="light" />
        </div>

        {/* Lock Screen Inactivity Alert */}
        {isLocked && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            <LockKeyhole className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{lockReason || 'Session locked due to 60s inactivity. Enter passcode to unlock.'}</span>
          </div>
        )}

        {/* Global Notifications */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-300 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: LOGIN MODE */}
        {/* ------------------------------------------------------------- */}
        {mode === 'login' && (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 shadow-inner">
              <LockKeyhole className="h-6 w-6 text-emerald-400" />
            </div>

            <h1 className="text-xl font-black tracking-tight text-white">
              {initialUser?.name ? `Habari, ${initialUser.name}` : 'Welcome back'}
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              {loginPhone ? `Account: ${loginPhone}` : 'Enter your 4-digit passcode to continue'}
            </p>

            {/* If user needs to edit or change phone */}
            {!loginPhone && (
              <div className="mt-4 text-left">
                <label className="text-[11px] font-semibold text-slate-400">Phone Number</label>
                <div className="mt-1 flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5">
                  <Phone className="mr-2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="0744963858"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Passcode Visual Dots / Digits + Eye Toggle */}
            <div className="relative my-6 flex items-center justify-center gap-3">
              {[0, 1, 2, 3].map((index) => {
                const char = digits[index];
                const hasValue = digits.length > index;
                return (
                  <div
                    key={index}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl border text-xl font-bold transition-all ${
                      hasValue
                        ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-md shadow-emerald-950/50'
                        : 'border-white/15 bg-white/5 text-transparent'
                    }`}
                  >
                    {hasValue ? (showPasscode ? char : '●') : ''}
                  </div>
                );
              })}

              {/* Eye Toggle to Show / Hide Passcode */}
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                title={showPasscode ? 'Hide Passcode' : 'Show Passcode'}
                aria-label="Toggle passcode visibility"
              >
                {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-400" />}
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
                  className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl font-bold text-white transition active:scale-95 active:bg-emerald-500/20 hover:border-white/25 hover:bg-white/[0.08]"
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => addDigit('0')}
                disabled={busy}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl font-bold text-white transition active:scale-95 active:bg-emerald-500/20 hover:border-white/25 hover:bg-white/[0.08]"
              >
                0
              </button>
              <button
                type="button"
                onClick={removeDigit}
                disabled={busy}
                className="flex h-14 items-center justify-center rounded-2xl border border-white/5 text-slate-400 transition active:scale-95 hover:bg-white/10 hover:text-white"
                aria-label="Delete last digit"
              >
                <Delete className="h-5 w-5" />
              </button>
            </div>

            {/* Keypad Action Footers */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => switchMode('forgot_phone')}
                className="text-xs font-medium text-emerald-400 transition hover:text-emerald-300 hover:underline"
              >
                Forgot Passcode?
              </button>

              <div className="mt-2 flex items-center justify-center gap-3 border-t border-white/10 pt-4 text-xs">
                <button
                  type="button"
                  onClick={() => switchMode('register_details')}
                  className="font-semibold text-slate-400 transition hover:text-white"
                >
                  Create New Account
                </button>
                {loginPhone && (
                  <>
                    <span className="text-white/20">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem('lumo_user_phone');
                        localStorage.removeItem('lumo_user');
                        setLoginPhone('');
                        switchMode('login');
                      }}
                      className="text-slate-400 transition hover:text-white"
                    >
                      Switch Phone
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: FORGOT PASSCODE - PHONE INPUT */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot_phone' && (
          <div>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className="mb-4 flex items-center text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back to Login
            </button>

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
              <KeyRound className="h-6 w-6 text-amber-400" />
            </div>

            <h1 className="text-lg font-black text-white">Reset Passcode</h1>
            <p className="mt-1 text-xs text-slate-400">
              Enter your registered phone number. We will check our system and send an SMS verification code via Meseji.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Registered Phone Number</label>
                <div className="mt-1.5 flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-emerald-400">
                  <Phone className="mr-2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="0744963858 or 255..."
                    value={forgotPhone}
                    onChange={(e) => setForgotPhone(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleForgotSendOtp}
                disabled={busy}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Verification Code'}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: FORGOT PASSCODE - OTP VERIFICATION */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot_otp' && (
          <div>
            <button
              type="button"
              onClick={() => switchMode('forgot_phone')}
              className="mb-4 flex items-center text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Change Phone
            </button>

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-500/10">
              <Phone className="h-6 w-6 text-teal-400" />
            </div>

            <h1 className="text-lg font-black text-white">Enter SMS Code</h1>
            <p className="mt-1 text-xs text-slate-400">
              We sent a 6-digit verification code to <span className="font-semibold text-white">{forgotPhone}</span> via Meseji.
            </p>

            <div className="mt-5 space-y-4">
              <SixBoxOtpInput
                value={forgotOtp}
                onChange={setForgotOtp}
                onComplete={(code) => handleForgotVerifyOtp(code)}
                disabled={busy}
              />

              {busy && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying code...
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleForgotSendOtp}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 mx-auto text-xs text-slate-400 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" /> Resend Code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: FORGOT PASSCODE - SET NEW PASSCODE */}
        {/* ------------------------------------------------------------- */}
        {mode === 'forgot_new_passcode' && (
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
              <KeyRound className="h-6 w-6 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-black text-white">Set New Passcode</h1>
                <p className="mt-1 text-xs text-slate-400">Choose a 4-digit passcode for your account.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowResetPasscode(!showResetPasscode)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                title="Toggle passcode visibility"
              >
                {showResetPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-400" />}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">New 4-Digit Passcode</label>
                <input
                  type={showResetPasscode ? 'text' : 'password'}
                  maxLength={4}
                  placeholder="••••"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-center text-xl font-bold tracking-widest text-white focus:border-emerald-400 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Confirm New Passcode</label>
                <input
                  type={showResetPasscode ? 'text' : 'password'}
                  maxLength={4}
                  placeholder="••••"
                  value={confirmNewPasscode}
                  onChange={(e) => setConfirmNewPasscode(e.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-center text-xl font-bold tracking-widest text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleResetPasscodeSubmit}
                disabled={busy || newPasscode.length !== 4 || confirmNewPasscode.length !== 4}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Passcode & Login'}
              </button>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: REGISTER - DETAILS (NAME & PHONE) */}
        {/* ------------------------------------------------------------- */}
        {mode === 'register_details' && (
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
              <UserPlus className="h-6 w-6 text-emerald-400" />
            </div>

            <h1 className="text-lg font-black text-white">Create LUMO Account</h1>
            <p className="mt-1 text-xs text-slate-400">
              Register with your phone number to manage splits, payments, and member benefits.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">Full Name</label>
                <div className="mt-1.5 flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-emerald-400">
                  <User className="mr-2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="e.g. John Mlowezi"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Phone Number (Tanzania)</label>
                <div className="mt-1.5 flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 focus-within:border-emerald-400">
                  <Phone className="mr-2 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    placeholder="0744963858 or 255..."
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleRegisterSendOtp}
                disabled={busy}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send SMS Verification Code'}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Already have an account? <span className="font-semibold text-emerald-400">Log In</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: REGISTER - OTP */}
        {/* ------------------------------------------------------------- */}
        {mode === 'register_otp' && (
          <div>
            <button
              type="button"
              onClick={() => switchMode('register_details')}
              className="mb-4 flex items-center text-xs font-semibold text-slate-400 hover:text-white"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Change Phone
            </button>

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-500/30 bg-teal-500/10">
              <Phone className="h-6 w-6 text-teal-400" />
            </div>

            <h1 className="text-lg font-black text-white">Verify Phone Number</h1>
            <p className="mt-1 text-xs text-slate-400">
              Enter the 6-digit code sent via Meseji to <span className="font-semibold text-white">{regPhone}</span>.
            </p>

            <div className="mt-5 space-y-4">
              <SixBoxOtpInput
                value={regOtp}
                onChange={setRegOtp}
                onComplete={(code) => handleRegisterVerifyOtp(code)}
                disabled={busy}
              />

              {busy && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs font-semibold text-emerald-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying code...
                </div>
              )}

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={handleRegisterSendOtp}
                  disabled={busy}
                  className="flex items-center justify-center gap-1.5 mx-auto text-xs text-slate-400 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" /> Resend Code
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* VIEW: REGISTER - SET PASSCODE */}
        {/* ------------------------------------------------------------- */}
        {mode === 'register_passcode' && (
          <div>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
              <LockKeyhole className="h-6 w-6 text-emerald-400" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-black text-white">Create Passcode</h1>
                <p className="mt-1 text-xs text-slate-400">Set a 4-digit passcode to protect your account.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowRegPasscode(!showRegPasscode)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 hover:text-white"
                title="Toggle passcode visibility"
              >
                {showRegPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-emerald-400" />}
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-300">4-Digit Passcode</label>
                <input
                  type={showRegPasscode ? 'text' : 'password'}
                  maxLength={4}
                  placeholder="••••"
                  value={regPasscode}
                  onChange={(e) => setRegPasscode(e.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-center text-xl font-bold tracking-widest text-white focus:border-emerald-400 focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300">Confirm Passcode</label>
                <input
                  type={showRegPasscode ? 'text' : 'password'}
                  maxLength={4}
                  placeholder="••••"
                  value={regConfirmPasscode}
                  onChange={(e) => setRegConfirmPasscode(e.target.value.replace(/\D/g, ''))}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-white/5 py-2.5 text-center text-xl font-bold tracking-widest text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={handleRegisterComplete}
                disabled={busy || regPasscode.length !== 4 || regConfirmPasscode.length !== 4}
                className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:opacity-95 active:scale-[0.98] disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Complete Registration'}
              </button>
            </div>
          </div>
        )}

        {/* Security Footer Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> End-to-End Encrypted Session
        </div>
      </div>
    </main>
  );
}
