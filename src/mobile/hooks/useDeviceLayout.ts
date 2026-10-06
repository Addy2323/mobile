import { useState, useEffect } from 'react';

export function useDeviceLayout() {
  const [isMobile, setIsMobile] = useState<boolean>(() => checkIsMobile());

  function checkIsMobile(): boolean {
    if (typeof window === 'undefined') return false;

    // Check URL query override (?layout=mobile | ?layout=desktop)
    const params = new URLSearchParams(window.location.search);
    const layoutQuery = params.get('layout');
    if (layoutQuery === 'mobile') return true;
    if (layoutQuery === 'desktop') return false;

    // Check localStorage override if dev toggled
    const storedOverride = localStorage.getItem('lumo_layout_override');
    if (storedOverride === 'mobile') return true;
    if (storedOverride === 'desktop') return false;

    const width = window.innerWidth;
    const isTouchFirst = window.matchMedia('(pointer: coarse) and (hover: none)').matches;

    // Rule: width <= 1024px OR (touch-first with width <= 1366px)
    if (width <= 1024 || (isTouchFirst && width <= 1366)) {
      return true;
    }

    return false;
  }

  useEffect(() => {
    function handleResize() {
      setIsMobile(checkIsMobile());
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const toggleOverride = (mode: 'mobile' | 'desktop' | 'auto') => {
    if (mode === 'auto') {
      localStorage.removeItem('lumo_layout_override');
    } else {
      localStorage.setItem('lumo_layout_override', mode);
    }
    setIsMobile(checkIsMobile());
  };

  return { isMobile, toggleOverride };
}
