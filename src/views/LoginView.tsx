import { useEffect, useState } from 'react';
import { Delete, LockKeyhole, ShieldCheck } from 'lucide-react';
import Logo from '@/components/Logo';

type LoginViewProps = {
  onSuccess: () => void;
};

type LoginStep = 'setup' | 'confirm' | 'login';

const passcodeKey = 'lumo_passcode_hash';

async function hashPasscode(passcode: string) {
  const bytes = new TextEncoder().encode(passcode);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export default function LoginView({ onSuccess }: LoginViewProps) {
  const [step, setStep] = useState<LoginStep>(() => localStorage.getItem(passcodeKey) ? 'login' : 'setup');
  const [digits, setDigits] = useState('');
  const [firstPasscode, setFirstPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (digits.length !== 4 || busy) return;
    void completeEntry();
  }, [digits, busy]);

  function addDigit(digit: string) {
    if (digits.length < 4) {
      setError('');
      setDigits((value) => value + digit);
    }
  }

  function removeDigit() {
    setError('');
    setDigits((value) => value.slice(0, -1));
  }

  async function completeEntry() {
    setBusy(true);
    const entered = digits;
    setDigits('');

    if (step === 'setup') {
      setFirstPasscode(entered);
      setStep('confirm');
      setBusy(false);
      return;
    }

    if (step === 'confirm') {
      if (entered !== firstPasscode) {
        setError('Those passcodes do not match. Try again.');
        setFirstPasscode('');
        setStep('setup');
        setBusy(false);
        return;
      }
      localStorage.setItem(passcodeKey, await hashPasscode(entered));
      localStorage.setItem('lumo_authenticated', 'true');
      onSuccess();
      setBusy(false);
      return;
    }

    const savedHash = localStorage.getItem(passcodeKey);
    if (savedHash && savedHash === await hashPasscode(entered)) {
      localStorage.setItem('lumo_authenticated', 'true');
      onSuccess();
    } else {
      setError('Incorrect passcode. Try again.');
    }
    setBusy(false);
  }

  const title = step === 'setup' ? 'Create your passcode' : step === 'confirm' ? 'Confirm your passcode' : 'Welcome back';
  const description = step === 'setup' ? 'Set a 4-digit passcode to protect your LUMO account.' : step === 'confirm' ? 'Enter the same passcode once more.' : 'Enter your passcode to continue.';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#090909] px-5 text-white">
      <div className="w-full max-w-[360px] text-center">
        <div className="mb-10 flex justify-center"><Logo size="md" variant="light" /></div>
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5"><LockKeyhole className="h-5 w-5 text-white/80" /></div>
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-6 text-white/45">{description}</p>

        <div className="my-7 flex justify-center gap-3" aria-label={`${digits.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((index) => <span key={index} className={`h-3 w-3 rounded-full border transition-all ${digits.length > index ? 'border-white bg-white' : 'border-white/45 bg-transparent'}`} />)}
        </div>
        <div className="min-h-6 text-xs font-semibold text-error-300">{error}</div>

        <div className="mx-auto mt-3 grid max-w-[270px] grid-cols-3 gap-3">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => <button key={digit} onClick={() => addDigit(digit)} className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 text-xl font-bold transition hover:border-white hover:bg-white/10 active:scale-95">{digit}</button>)}
          <div />
          <button onClick={() => addDigit('0')} className="flex h-16 w-16 items-center justify-center rounded-full border border-white/70 text-xl font-bold transition hover:border-white hover:bg-white/10 active:scale-95">0</button>
          <button onClick={removeDigit} className="flex h-16 w-16 items-center justify-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white" aria-label="Remove last digit"><Delete className="h-5 w-5" /></button>
        </div>

        <div className="mt-10 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35"><ShieldCheck className="h-4 w-4" /> Protected workspace</div>
      </div>
    </main>
  );
}
