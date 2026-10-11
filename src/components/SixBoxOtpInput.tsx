import React, { useRef, useEffect } from 'react';

export interface SixBoxOtpInputProps {
  value: string;
  onChange: (val: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export function SixBoxOtpInput({ value, onChange, onComplete, disabled = false }: SixBoxOtpInputProps) {
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
                ? 'border-[#00E599] bg-[#0A2620] text-[#00E599] shadow-[0_0_16px_rgba(0,229,153,0.3)]'
                : 'border-slate-800 bg-[#0C1518] text-white focus:border-[#00E599] focus:bg-[#06241D]/50'
            }`}
          />
        );
      })}
    </div>
  );
}
