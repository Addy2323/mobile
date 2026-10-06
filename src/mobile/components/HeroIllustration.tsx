import React from 'react';

export const HeroIllustration: React.FC = () => {
  return (
    <div className="relative w-36 h-28 pointer-events-none flex items-center justify-center">
      <svg
        viewBox="0 0 160 130"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-xl"
      >
        <defs>
          {/* Drop Shadows */}
          <filter id="receipt-shadow-navy" x="65" y="25" width="85" height="95" filterUnits="userSpaceOnUse">
            <feDropShadow dx="3" dy="8" stdDeviation="6" floodColor="#0B1B40" floodOpacity="0.5" />
          </filter>
          <filter id="avatar-shadow-blue" x="5" y="5" width="120" height="70" filterUnits="userSpaceOnUse">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#3B6FF5" floodOpacity="0.3" />
          </filter>

          {/* Navy & Pale Blue Gradients */}
          <linearGradient id="avatar1-blue" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EAF0FF" />
            <stop offset="1" stopColor="#BFDBFE" />
          </linearGradient>
          <linearGradient id="avatar2-blue" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#3B6FF5" />
            <stop offset="1" stopColor="#12285C" />
          </linearGradient>
          <linearGradient id="avatar3-blue" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#60A5FA" />
            <stop offset="1" stopColor="#2563EB" />
          </linearGradient>
        </defs>

        {/* Radiating Accent Lines (top-right background in pale blue) */}
        <g stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" opacity="0.65">
          <line x1="125" y1="18" x2="132" y2="10" />
          <line x1="140" y1="24" x2="148" y2="20" />
          <line x1="145" y1="36" x2="154" y2="36" />
          <line x1="108" y1="12" x2="110" y2="4" />
        </g>

        {/* Group Avatars Silhouette (3 overlapping circles in navy/blue) */}
        <g filter="url(#avatar-shadow-blue)">
          {/* Avatar 1 (Left) */}
          <circle cx="45" cy="30" r="16" fill="url(#avatar1-blue)" stroke="#0B1B40" strokeWidth="3" />
          <path d="M36 33C36 29 40 26 45 26C50 26 54 29 54 33" stroke="#0B1B40" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="45" cy="23" r="4" fill="#0B1B40" />

          {/* Avatar 2 (Center Raised) */}
          <circle cx="70" cy="22" r="18" fill="url(#avatar2-blue)" stroke="#FFFFFF" strokeWidth="3.5" />
          <path d="M60 25C60 20 64 17 70 17C76 17 80 20 80 25" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="70" cy="15" r="4.5" fill="#FFFFFF" />

          {/* Avatar 3 (Right) */}
          <circle cx="95" cy="30" r="16" fill="url(#avatar3-blue)" stroke="#0B1B40" strokeWidth="3" />
          <path d="M86 33C86 29 90 26 95 26C100 26 104 29 104 33" stroke="#0B1B40" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          <circle cx="95" cy="23" r="4" fill="#0B1B40" />
        </g>

        {/* Floating 3D White Receipt Card with Tilted Shadow */}
        <g filter="url(#receipt-shadow-navy)" transform="rotate(-6 110 70)">
          {/* Paper card background */}
          <rect x="80" y="42" width="56" height="66" rx="10" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="1.5" />
          
          {/* Receipt Lines (≡) */}
          <rect x="88" y="52" width="18" height="3" rx="1.5" fill="#12285C" />
          <rect x="88" y="60" width="24" height="3" rx="1.5" fill="#94A3B8" />
          <rect x="88" y="68" width="14" height="3" rx="1.5" fill="#94A3B8" />

          {/* Bold Currency Symbol ($ / TZS) */}
          <text x="116" y="66" fontFamily="sans-serif" fontWeight="900" fontSize="16" fill="#12285C">$</text>

          {/* Receipt bottom dash decoration */}
          <line x1="88" y1="82" x2="128" y2="82" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="3 3" />
          
          {/* Total Pill in Navy */}
          <rect x="88" y="88" width="40" height="12" rx="6" fill="#12285C" />
          <text x="96" y="97" fontFamily="sans-serif" fontWeight="800" fontSize="8" fill="#FFFFFF">PAY</text>
        </g>
      </svg>
    </div>
  );
};
