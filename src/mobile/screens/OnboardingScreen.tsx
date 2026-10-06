import React, { useState } from 'react';
import { ChevronRight, ArrowLeft, ShieldCheck, Fingerprint, Sparkles, Receipt, Users, Lock, Check } from 'lucide-react';
import Logo from '@/components/Logo';
import { getTranslation, type Language } from '@/lib/i18n';

interface OnboardingScreenProps {
  onComplete: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

type OnboardingStep = 'splash' | 'carousel' | 'language' | 'phone' | 'otp' | 'name' | 'pin' | 'biometric';

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete, language, onLanguageChange }) => {
  const [step, setStep] = useState<OnboardingStep>('carousel');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [name, setName] = useState('');
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [error, setError] = useState('');

  const t = (key: any) => getTranslation(key, language);

  const slides = [
    {
      icon: <Receipt className="w-16 h-16 text-indigo-600 mb-4" />,
      title: t('welcomeTitle1'),
      desc: t('welcomeDesc1'),
      bgGradient: 'from-indigo-50 to-blue-50',
    },
    {
      icon: <Users className="w-16 h-16 text-blue-600 mb-4" />,
      title: t('welcomeTitle2'),
      desc: t('welcomeDesc2'),
      bgGradient: 'from-blue-50 to-cyan-50',
    },
    {
      icon: <ShieldCheck className="w-16 h-16 text-emerald-600 mb-4" />,
      title: t('welcomeTitle3'),
      desc: t('welcomeDesc3'),
      bgGradient: 'from-emerald-50 to-indigo-50',
    },
  ];

  const handleNextSlide = () => {
    if (carouselIndex < slides.length - 1) {
      setCarouselIndex((prev) => prev + 1);
    } else {
      setStep('language');
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

    // Auto-advance input focus
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
          setTimeout(() => setPinStep('confirm'), 200);
        }
      }
    } else {
      const emptyIdx = confirmPin.findIndex((d) => d === '');
      if (emptyIdx !== -1) {
        const newConfirm = [...confirmPin];
        newConfirm[emptyIdx] = digit;
        setConfirmPin(newConfirm);
        if (emptyIdx === 3) {
          if (newConfirm.join('') === pin.join('')) {
            setTimeout(() => setStep('biometric'), 200);
          } else {
            setError('PINs do not match. Please try again.');
            setConfirmPin(['', '', '', '']);
          }
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === 'create') {
      const lastIdx = pin.map((d) => d !== '').lastIndexOf(true);
      if (lastIdx !== -1) {
        const newPin = [...pin];
        newPin[lastIdx] = '';
        setPin(newPin);
      }
    } else {
      const lastIdx = confirmPin.map((d) => d !== '').lastIndexOf(true);
      if (lastIdx !== -1) {
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
    <div className="min-h-dvh bg-slate-50 flex flex-col justify-between pt-safe pb-safe no-tap-highlight">
      {/* Step 1: Carousel */}
      {step === 'carousel' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          {/* Top Logo */}
          <div className="flex items-center justify-between pt-4">
            <Logo />
            <button
              onClick={() => setStep('language')}
              className="text-sm font-semibold text-indigo-600 hover:text-indigo-800"
            >
              Skip
            </button>
          </div>

          {/* Slide Content */}
          <div className="my-auto flex flex-col items-center text-center px-2">
            <div className={`p-8 rounded-3xl bg-gradient-to-b ${slides[carouselIndex].bgGradient} shadow-inner mb-6 transition-all duration-300`}>
              {slides[carouselIndex].icon}
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mb-3 leading-snug">
              {slides[carouselIndex].title}
            </h2>
            <p className="text-slate-600 text-sm max-w-xs leading-relaxed">
              {slides[carouselIndex].desc}
            </p>
          </div>

          {/* Bottom controls & Dots */}
          <div className="space-y-6 pb-6">
            <div className="flex justify-center space-x-2">
              {slides.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    carouselIndex === idx ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNextSlide}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 transition-all"
            >
              <span>{carouselIndex === slides.length - 1 ? t('getStarted') : t('continue')}</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Language Choice */}
      {step === 'language' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          <div className="pt-4">
            <button onClick={() => setStep('carousel')} className="p-2 text-slate-600 rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <div className="my-auto space-y-6 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Sparkles className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">{t('selectLanguage')}</h2>

            <div className="space-y-4 pt-4 max-w-xs mx-auto">
              <button
                onClick={() => onLanguageChange('en')}
                className={`w-full p-4 rounded-2xl border-2 font-bold flex items-center justify-between transition-all ${
                  language === 'en'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span>English</span>
                {language === 'en' && <Check className="w-5 h-5 text-indigo-600" />}
              </button>

              <button
                onClick={() => onLanguageChange('sw')}
                className={`w-full p-4 rounded-2xl border-2 font-bold flex items-center justify-between transition-all ${
                  language === 'sw'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900'
                    : 'border-slate-200 bg-white text-slate-700'
                }`}
              >
                <span>Kiswahili</span>
                {language === 'sw' && <Check className="w-5 h-5 text-indigo-600" />}
              </button>
            </div>
          </div>

          <button
            onClick={() => setStep('phone')}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('continue')}
          </button>
        </div>
      )}

      {/* Step 3: Phone Number Input */}
      {step === 'phone' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          <div className="pt-4">
            <button onClick={() => setStep('language')} className="p-2 text-slate-600 rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSendOtp} className="my-auto space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{t('enterPhone')}</h2>
              <p className="text-slate-500 text-sm">We will send you a 6-digit verification code via SMS.</p>
            </div>

            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-base">
                +255
              </div>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="712 345 678"
                className="w-full pl-16 pr-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none font-bold text-lg text-slate-900"
                autoFocus
              />
            </div>

            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
          </form>

          <button
            onClick={handleSendOtp}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('sendCode')}
          </button>
        </div>
      )}

      {/* Step 4: OTP Verification */}
      {step === 'otp' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          <div className="pt-4">
            <button onClick={() => setStep('phone')} className="p-2 text-slate-600 rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <div className="my-auto space-y-6 text-center">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{t('enterOtp')}</h2>
              <p className="text-slate-500 text-sm">{t('otpSentTo')} +255 {phone || '712 345 678'}</p>
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
                  className="w-12 h-14 text-center text-xl font-extrabold rounded-xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none bg-white text-slate-900"
                />
              ))}
            </div>
          </div>

          <button
            onClick={handleVerifyOtp}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('verifyCode')}
          </button>
        </div>
      )}

      {/* Step 5: Name Input */}
      {step === 'name' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          <div className="pt-4">
            <button onClick={() => setStep('otp')} className="p-2 text-slate-600 rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleSaveName} className="my-auto space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{t('enterName')}</h2>
              <p className="text-slate-500 text-sm">Your friends will see this name on split requests.</p>
            </div>

            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Given Mhema"
              className="w-full px-4 py-4 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:outline-none font-bold text-lg text-slate-900"
              autoFocus
            />

            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}
          </form>

          <button
            onClick={handleSaveName}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            {t('continue')}
          </button>
        </div>
      )}

      {/* Step 6: 4-Digit PIN */}
      {step === 'pin' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          <div className="pt-4">
            <button onClick={() => setStep('name')} className="p-2 text-slate-600 rounded-full hover:bg-slate-100">
              <ArrowLeft className="w-6 h-6" />
            </button>
          </div>

          <div className="my-auto text-center space-y-6">
            <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto text-indigo-600">
              <Lock className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-1">
                {pinStep === 'create' ? t('createPin') : t('confirmPin')}
              </h2>
              <p className="text-slate-500 text-xs">Used to authorize quick actions and transfers</p>
            </div>

            {/* PIN Dots */}
            <div className="flex justify-center space-x-4 py-4">
              {[0, 1, 2, 3].map((idx) => {
                const currentArr = pinStep === 'create' ? pin : confirmPin;
                const filled = currentArr[idx] !== '';
                return (
                  <div
                    key={idx}
                    className={`w-5 h-5 rounded-full border-2 transition-all ${
                      filled ? 'bg-indigo-600 border-indigo-600 scale-110' : 'border-slate-300'
                    }`}
                  />
                );
              })}
            </div>

            {error && <p className="text-rose-600 text-xs font-semibold">{error}</p>}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto pt-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map((key) => {
                if (key === '') return <div key="blank" />;
                if (key === 'del') {
                  return (
                    <button
                      key="del"
                      onClick={handlePinDelete}
                      className="h-16 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 font-bold text-slate-700 flex items-center justify-center text-sm"
                    >
                      Delete
                    </button>
                  );
                }
                return (
                  <button
                    key={key}
                    onClick={() => handlePinDigit(key)}
                    className="h-16 rounded-2xl bg-white border border-slate-200 hover:bg-indigo-50 active:scale-95 font-extrabold text-xl text-slate-900 shadow-sm"
                  >
                    {key}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Step 7: Biometrics */}
      {step === 'biometric' && (
        <div className="flex-1 flex flex-col justify-between px-6 py-8">
          <div className="pt-4" />

          <div className="my-auto text-center space-y-6">
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600 animate-pulse">
              <Fingerprint className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold text-slate-900">{t('enableBiometrics')}</h2>
              <p className="text-slate-500 text-sm max-w-xs mx-auto">{t('biometricsDesc')}</p>
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-800 text-xs font-semibold max-w-xs mx-auto flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Biometric verification active on this device</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={finishOnboarding}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg transition-all"
            >
              Enable & Finish Setup
            </button>
            <button
              onClick={finishOnboarding}
              className="w-full py-3 text-slate-500 hover:text-slate-700 text-sm font-semibold"
            >
              Maybe Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
