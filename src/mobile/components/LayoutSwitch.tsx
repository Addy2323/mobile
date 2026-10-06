import React, { useState } from 'react';
import { useDeviceLayout } from '../hooks/useDeviceLayout';
import { Monitor, Smartphone } from 'lucide-react';

interface LayoutSwitchProps {
  children?: React.ReactNode;
  desktopView?: React.ReactNode;
  mobileView: React.ReactNode;
}

export const LayoutSwitch: React.FC<LayoutSwitchProps> = ({ children, desktopView, mobileView }) => {
  const { isMobile, toggleOverride } = useDeviceLayout();

  // Hide the debug badge unless the URL explicitly contains ?layout= parameter
  const hasLayoutParam = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('layout');
  const [showDevToggle, setShowDevToggle] = useState(hasLayoutParam);

  const desktopContent = children || desktopView;

  return (
    <div className="relative min-h-screen">
      {/* Dev Mode Switcher Button (fixed bottom right corner) - hidden unless ?layout= in URL */}
      {showDevToggle && (
        <div className="fixed bottom-3 right-3 z-50 flex items-center bg-slate-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs shadow-xl border border-slate-700 space-x-2 no-tap-highlight opacity-60 hover:opacity-100 transition-opacity">
          <span className="font-semibold text-slate-300">Layout:</span>
          <button
            onClick={() => toggleOverride(isMobile ? 'desktop' : 'mobile')}
            className="flex items-center space-x-1 font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            {isMobile ? (
              <>
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile</span>
              </>
            ) : (
              <>
                <Monitor className="w-3.5 h-3.5" />
                <span>Desktop</span>
              </>
            )}
          </button>
          <button
            onClick={() => setShowDevToggle(false)}
            className="text-slate-500 hover:text-slate-300 ml-1 text-xs"
            title="Dismiss dev indicator"
          >
            ×
          </button>
        </div>
      )}

      {/* Render selected layout */}
      {isMobile ? mobileView : desktopContent}
    </div>
  );
};
