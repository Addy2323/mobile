import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Fingerprint,
  Sparkles,
  Users,
  Lock,
  Check
} from 'lucide-react';
import { getTranslation, type Language } from '@/lib/i18n';

interface OnboardingScreenProps {
  onComplete: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

type OnboardingStep = 'carousel' | 'language' | 'phone' | 'otp' | 'name' | 'pin' | 'biometric';

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({
  onComplete,
  language,
  onLanguageChange
}) => {
  const [step, setStep] = useState<OnboardingStep>('carousel');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');

  // Lock body & html background to #060D0E during onboarding to eliminate any white gaps or bars
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

  // Touch gesture state for horizontal swiping
  const touchStartXRef = useRef<number | null>(null);

  const t = (key: any) => getTranslation(key, language);

  const slides = [
    {
      type: 'image',
      imageSrc: '/onboarding-group.jpg',
      title: t('welcomeTitle1') || 'Split Bills Effortlessly',
      desc: t('welcomeDesc1') || 'Equal split, custom amounts, or scan receipts with friends in seconds.'
    },
    {
      type: 'icon',
      icon: (
        <Users
          className="w-20 h-20 sm:w-24 sm:h-24 text-[#00E599] stroke-[2] drop-shadow-[0_0_16px_rgba(0,229,153,0.8)]"
        />
      ),
      title: t('welcomeTitle2') || 'Share the Moment',
      desc: t('welcomeDesc2') || 'Keep group expenses clear. LUMO tracks who paid and who owes.'
    },
    {
      type: 'icon',
      icon: (
        <ShieldCheck
          className="w-20 h-20 sm:w-24 sm:h-24 text-[#00E599] stroke-[2] drop-shadow-[0_0_16px_rgba(0,229,153,0.8)]"
        />
      ),
      title: t('welcomeTitle3') || 'Pay Directly & Securely',
      desc: t('welcomeDesc3') || 'Money goes directly to merchants via Lipa Namba and mobile money.'
    }
  ];

  const handleNextSlide = () => {
    if (carouselIndex < slides.length - 1) {
      setCarouselIndex((prev) => prev + 1);
    } else {
      setStep('language');
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    touchStartXRef.current = null;
    if (diff > 45 && carouselIndex < slides.length - 1) {
      setCarouselIndex((prev) => prev + 1);
    } else if (diff < -45 && carouselIndex > 0) {
      setCarouselIndex((prev) => prev - 1);
    }
  };

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      setError('Please enter a valid phone number');
      return;
    }
    setError('');
    setStep('otp');
  };

  const handleOtpChange = (index: number, val: string) => {
    if (val.length > 1) val = val.slice(-1);
    const newOtp = [...otp];
    newOtp[index] = val;
    setOtp(newOtp);

    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVerifyOtp = () => {
    setStep('name');
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    setError('');
    setStep('pin');
  };

  const handlePinDigit = (digit: string) => {
    if (pinStep === 'create') {
      const emptyIdx = pin.findIndex((d) => d === '');
      if (emptyIdx !== -1) {
        const newPin = [...pin];
        newPin[emptyIdx] = digit;
        setPin(newPin);
        if (emptyIdx === 3) {
          setTimeout(() => {
            setPinStep('confirm');
          }, 250);
        }
      }
    } else {
      const emptyIdx = confirmPin.findIndex((d) => d === '');
      if (emptyIdx !== -1) {
        const newConfirm = [...confirmPin];
        newConfirm[emptyIdx] = digit;
        setConfirmPin(newConfirm);
        if (emptyIdx === 3) {
          const pinStr = pin.join('');
          const confirmStr = [...confirmPin.slice(0, 3), digit].join('');
          if (pinStr === confirmStr) {
            setError('');
            setTimeout(() => {
              setStep('biometric');
            }, 250);
          } else {
            setError('PINs do not match. Try again.');
            setConfirmPin(['', '', '', '']);
            setPin(['', '', '', '']);
            setPinStep('create');
          }
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === 'create') {
      const lastIdx = pin.map((d, i) => (d !== '' ? i : -1)).filter((i) => i !== -1).pop();
      if (lastIdx !== undefined) {
        const newPin = [...pin];
        newPin[lastIdx] = '';
        setPin(newPin);
      }
    } else {
      const lastIdx = confirmPin.map((d, i) => (d !== '' ? i : -1)).filter((i) => i !== -1).pop();
      if (lastIdx !== undefined) {
        const newConfirm = [...confirmPin];
        newConfirm[lastIdx] = '';
        setConfirmPin(newConfirm);
      }
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('lumo_authenticated', 'true');
    localStorage.setItem('lumo_user_name', name || 'User');
    localStorage.setItem('lumo_user_phone', phone || '0700000000');
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#060D0E] text-slate-100 flex flex-col justify-between items-center select-none font-sans"
      style={{ backgroundColor: '#060D0E' }}
    >
      {/* Corner-only subtle luxury emerald wave ribbons - Strictly outside the content area */}
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

        {/* Top-left extreme corner ribbons only (never passes through logo or image) */}
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

        {/* Bottom-right extreme corner ribbons only */}
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

      {/* Main Container - Centered and full-height without white borders or gaps */}
      <div
        className="w-full max-w-md sm:max-w-lg mx-auto min-h-full flex-1 flex flex-col justify-between relative z-10 px-6 pt-7 pb-8 sm:pt-9 sm:pb-10"
        style={{ minHeight: '100dvh' }}
      >
        {/* Step 1: Carousel Slides */}
        {step === 'carousel' && (
          <div
            className="flex-1 flex flex-col justify-between"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header: LUMO Split Brand + Skip Button */}
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

              <button
                onClick={() => setStep('language')}
                className="text-sm font-bold text-[#00E599] hover:text-[#52ffc2] active:scale-95 transition-all tracking-wide px-2 py-1"
              >
                Skip
              </button>
            </div>

            {/* Slide Center Graphic & Copy */}
            <div className="my-auto flex flex-col items-center text-center px-1 py-4">
              {slides[carouselIndex].type === 'image' ? (
                /* Slide 1: Clean, natural group photo without circular halos or rings */
                <div className="w-full max-w-[330px] sm:max-w-[350px] aspect-[4/3] rounded-2xl overflow-hidden shadow-2xl mb-7 mx-auto">
                  <img
                    src={slides[carouselIndex].imageSrc}
                    alt="Group of friends splitting a restaurant bill"
                    className="w-full h-full object-cover object-center"
                  />
                </div>
              ) : (
                /* Slides 2 & 3: Glowing rounded neon card */
                <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-[32px] bg-gradient-to-b from-[#09221D] to-[#041210] border-2 border-[#00E599] shadow-[0_0_40px_rgba(0,229,153,0.35)] flex items-center justify-center mb-7 mx-auto relative transition-all duration-300">
                  <div className="absolute inset-0 rounded-[30px] bg-[#00E599]/[0.05] pointer-events-none" />
                  {slides[carouselIndex].icon}
                </div>
              )}

              {/* Title & Description */}
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2.5 tracking-tight leading-snug">
                {slides[carouselIndex].title}
              </h2>
              <p className="text-slate-300 text-sm sm:text-base font-normal max-w-xs sm:max-w-sm mx-auto leading-relaxed">
                {slides[carouselIndex].desc}
              </p>
            </div>

            {/* Bottom Controls: Elongated Active Dot + Emerald Gradient Pill Button */}
            <div className="space-y-6 pb-2">
              {/* Pagination Dots */}
              <div className="flex justify-center items-center gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCarouselIndex(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      carouselIndex === idx
                        ? 'w-8 bg-[#00E599] shadow-[0_0_12px_#00E599]'
                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                ))}
              </div>

              {/* Action Button */}
              <button
                onClick={handleNextSlide}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_28px_rgba(0,229,153,0.38)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{carouselIndex === slides.length - 1 ? t('getStarted') : t('continue')}</span>
                <ChevronRight className="w-5 h-5 stroke-[2.8]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Language Selection */}
        {step === 'language' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="pt-1">
              <button
                onClick={() => setStep('carousel')}
                className="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/60 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="my-auto space-y-6 text-center">
              <div className="w-16 h-16 bg-[#0B2520] border border-[#00E599]/40 rounded-2xl flex items-center justify-center mx-auto text-[#00E599] shadow-[0_0_20px_rgba(0,229,153,0.3)]">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{t('selectLanguage')}</h2>

              <div className="space-y-3.5 pt-3 max-w-xs mx-auto">
                <button
                  onClick={() => onLanguageChange('en')}
                  className={`w-full p-4 rounded-2xl border-2 font-bold flex items-center justify-between transition-all ${
                    language === 'en'
                      ? 'border-[#00E599] bg-[#0A2620] text-white shadow-[0_0_20px_rgba(0,229,153,0.25)]'
                      : 'border-slate-800 bg-[#0C1518] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">English</span>
                  {language === 'en' && <Check className="w-5 h-5 text-[#00E599]" />}
                </button>

                <button
                  onClick={() => onLanguageChange('sw')}
                  className={`w-full p-4 rounded-2xl border-2 font-bold flex items-center justify-between transition-all ${
                    language === 'sw'
                      ? 'border-[#00E599] bg-[#0A2620] text-white shadow-[0_0_20px_rgba(0,229,153,0.25)]'
                      : 'border-slate-800 bg-[#0C1518] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="text-base">Kiswahili</span>
                  {language === 'sw' && <Check className="w-5 h-5 text-[#00E599]" />}
                </button>
              </div>
            </div>

            <div className="pb-2">
              <button
                onClick={() => setStep('phone')}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_25px_rgba(0,229,153,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t('continue')}</span>
                <ChevronRight className="w-5 h-5 stroke-[2.8]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Phone Number Input */}
        {step === 'phone' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="pt-1">
              <button
                onClick={() => setStep('language')}
                className="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/60 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSendOtp} className="my-auto space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{t('enterPhone')}</h2>
                <p className="text-slate-400 text-sm">We will send you a 6-digit verification code via SMS.</p>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-[#00E599] text-base">
                  +255
                </div>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="712 345 678"
                  className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none font-bold text-lg text-white shadow-inner"
                  autoFocus
                />
              </div>

              {error && <p className="text-rose-400 text-xs font-semibold">{error}</p>}
            </form>

            <div className="pb-2">
              <button
                onClick={handleSendOtp}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_25px_rgba(0,229,153,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t('sendCode')}</span>
                <ChevronRight className="w-5 h-5 stroke-[2.8]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: OTP Verification */}
        {step === 'otp' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="pt-1">
              <button
                onClick={() => setStep('phone')}
                className="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/60 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="my-auto space-y-6 text-center">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{t('enterOtp')}</h2>
                <p className="text-slate-400 text-sm">
                  {t('otpSentTo')} +255 {phone || '712 345 678'}
                </p>
              </div>

              <div className="flex justify-center space-x-2 pt-2">
                {otp.map((digit, idx) => (
                  <input
                    key={idx}
                    id={`otp-input-${idx}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    className="w-12 h-14 text-center text-xl font-extrabold rounded-xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none text-white shadow-inner"
                  />
                ))}
              </div>
            </div>

            <div className="pb-2">
              <button
                onClick={handleVerifyOtp}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_25px_rgba(0,229,153,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t('verifyCode')}</span>
                <ChevronRight className="w-5 h-5 stroke-[2.8]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Name Input */}
        {step === 'name' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="pt-1">
              <button
                onClick={() => setStep('otp')}
                className="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/60 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveName} className="my-auto space-y-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">{t('enterName')}</h2>
                <p className="text-slate-400 text-sm">Your friends will see this name on split requests.</p>
              </div>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Given Mhema"
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-800 bg-[#0C1518] focus:border-[#00E599] focus:outline-none font-bold text-lg text-white shadow-inner"
                autoFocus
              />

              {error && <p className="text-rose-400 text-xs font-semibold">{error}</p>}
            </form>

            <div className="pb-2">
              <button
                onClick={handleSaveName}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_25px_rgba(0,229,153,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{t('continue')}</span>
                <ChevronRight className="w-5 h-5 stroke-[2.8]" />
              </button>
            </div>
          </div>
        )}

        {/* Step 6: 4-Digit Security PIN */}
        {step === 'pin' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="pt-1">
              <button
                onClick={() => setStep('name')}
                className="p-2.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800/60 transition-colors"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
            </div>

            <div className="my-auto text-center space-y-6">
              <div className="w-14 h-14 bg-[#0B2520] border border-[#00E599]/40 rounded-2xl flex items-center justify-center mx-auto text-[#00E599] shadow-[0_0_20px_rgba(0,229,153,0.3)]">
                <Lock className="w-7 h-7" />
              </div>

              <div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-1">
                  {pinStep === 'create' ? t('createPin') : t('confirmPin')}
                </h2>
                <p className="text-slate-400 text-xs">Used to authorize quick actions and transfers</p>
              </div>

              {/* PIN Dots */}
              <div className="flex justify-center space-x-4 py-3">
                {[0, 1, 2, 3].map((idx) => {
                  const currentArr = pinStep === 'create' ? pin : confirmPin;
                  const filled = currentArr[idx] !== '';
                  return (
                    <div
                      key={idx}
                      className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                        filled
                          ? 'bg-[#00E599] border-[#00E599] scale-110 shadow-[0_0_12px_#00E599]'
                          : 'border-slate-700 bg-transparent'
                      }`}
                    />
                  );
                })}
              </div>

              {error && <p className="text-rose-400 text-xs font-semibold">{error}</p>}

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-3.5 max-w-xs mx-auto pt-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
                  if (key === '') return <div key="blank" />;
                  if (key === 'del') {
                    return (
                      <button
                        key="del"
                        onClick={handlePinDelete}
                        className="h-14 sm:h-16 rounded-2xl bg-[#0F1B1F] hover:bg-[#15272D] active:scale-95 font-bold text-slate-300 flex items-center justify-center text-sm border border-slate-800/80 transition-all"
                      >
                        Delete
                      </button>
                    );
                  }
                  return (
                    <button
                      key={key}
                      onClick={() => handlePinDigit(key)}
                      className="h-14 sm:h-16 rounded-2xl bg-[#0A1719] border border-slate-800 hover:border-[#00E599]/50 hover:bg-[#0D2222] active:scale-95 font-black text-xl text-white shadow-sm transition-all"
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 7: Biometric Setup */}
        {step === 'biometric' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="pt-1" />

            <div className="my-auto text-center space-y-6">
              <div className="w-20 h-20 bg-[#0B2520] border-2 border-[#00E599]/60 rounded-full flex items-center justify-center mx-auto text-[#00E599] shadow-[0_0_30px_rgba(0,229,153,0.4)] animate-pulse">
                <Fingerprint className="w-12 h-12" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl sm:text-3xl font-extrabold text-white">{t('enableBiometrics')}</h2>
                <p className="text-slate-400 text-sm max-w-xs mx-auto">{t('biometricsDesc')}</p>
              </div>

              <div className="p-4 bg-[#0A2620] rounded-2xl border border-[#00E599]/30 text-[#00E599] text-xs font-semibold max-w-xs mx-auto flex items-center space-x-2">
                <Check className="w-4 h-4 text-[#00E599] flex-shrink-0" />
                <span>Biometric verification ready on this device</span>
              </div>
            </div>

            <div className="space-y-3 pb-2">
              <button
                onClick={finishOnboarding}
                className="w-full py-4 px-6 rounded-full bg-gradient-to-r from-[#00E599] to-[#00C782] text-[#05110E] font-extrabold text-base shadow-[0_0_25px_rgba(0,229,153,0.35)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Enable & Finish Setup</span>
                <ChevronRight className="w-5 h-5 stroke-[2.8]" />
              </button>
              <button
                onClick={finishOnboarding}
                className="w-full py-3 text-slate-400 hover:text-white text-sm font-semibold transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
