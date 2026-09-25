import React from 'react';

interface TorahLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'hero';
}

export const TorahLogo: React.FC<TorahLogoProps> = ({
  className = '',
  size = 'md',
}) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-20 h-20',
    hero: 'w-28 h-28',
  };

  return (
    <div className={`relative shrink-0 select-none ${sizeMap[size]} ${className}`}>
      <svg
        viewBox="0 0 512 512"
        className="w-full h-full drop-shadow-md overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="toraBgGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#1e3567" />
            <stop offset="65%" stopColor="#0e1b38" />
            <stop offset="100%" stopColor="#070d1e" />
          </radialGradient>

          <linearGradient id="toraGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff2b2" />
            <stop offset="28%" stopColor="#e5be53" />
            <stop offset="70%" stopColor="#c59623" />
            <stop offset="100%" stopColor="#8a610f" />
          </linearGradient>

          <radialGradient id="toraGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f7d468" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#c59623" stopOpacity="0" />
          </radialGradient>

          <filter id="toraShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#000000" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Shield Frame */}
        <rect
          x="16"
          y="16"
          width="480"
          height="480"
          rx="100"
          fill="url(#toraBgGrad)"
          stroke="url(#toraGoldGrad)"
          strokeWidth="12"
          filter="url(#toraShadow)"
        />

        {/* Inner Dotted Filigree Ring */}
        <rect
          x="36"
          y="36"
          width="440"
          height="440"
          rx="84"
          fill="none"
          stroke="url(#toraGoldGrad)"
          strokeWidth="2.5"
          strokeDasharray="8 6"
          opacity="0.8"
        />

        {/* Golden Central Aura */}
        <circle cx="256" cy="256" r="180" fill="url(#toraGlow)" />

        {/* Golden Crown (כתר תורה) */}
        <g filter="url(#toraShadow)">
          <path
            d="M 180 180 Q 256 166 332 180 L 324 196 Q 256 182 188 196 Z"
            fill="url(#toraGoldGrad)"
          />
          <circle cx="210" cy="188" r="4" fill="#ffffff" />
          <circle cx="256" cy="184" r="5.5" fill="#e11d48" />
          <circle cx="302" cy="188" r="4" fill="#ffffff" />

          <path
            d="M 180 180 L 170 135 L 210 160 L 256 110 L 302 160 L 342 135 L 332 180 Q 256 166 180 180 Z"
            fill="url(#toraGoldGrad)"
            stroke="#664609"
            strokeWidth="2"
          />
          <circle cx="170" cy="132" r="7" fill="url(#toraGoldGrad)" />
          <circle cx="210" cy="157" r="6" fill="url(#toraGoldGrad)" />
          <circle cx="256" cy="107" r="9" fill="#ffffff" stroke="url(#toraGoldGrad)" strokeWidth="2.5" />
          <circle cx="302" cy="157" r="6" fill="url(#toraGoldGrad)" />
          <circle cx="342" cy="132" r="7" fill="url(#toraGoldGrad)" />
        </g>

        {/* Open Torah Book / Sefer (ספר פתוח מהודר) */}
        <g filter="url(#toraShadow)">
          <path d="M 256 235 L 256 365" stroke="#78500c" strokeWidth="6" />

          {/* Left Book Page */}
          <path
            d="M 256 235 C 215 220 165 220 120 230 C 114 231 110 236 110 242 L 110 355 C 110 361 115 366 121 365 C 165 352 215 352 256 368 Z"
            fill="#ffffff"
            stroke="url(#toraGoldGrad)"
            strokeWidth="5"
          />
          <line x1="140" y1="260" x2="235" y2="252" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="140" y1="280" x2="235" y2="272" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="140" y1="300" x2="235" y2="292" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="140" y1="320" x2="235" y2="312" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="155" y1="340" x2="220" y2="332" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />

          {/* Right Book Page */}
          <path
            d="M 256 235 C 297 220 347 220 392 230 C 398 231 402 236 402 242 L 402 355 C 402 361 397 366 391 365 C 347 352 297 352 256 368 Z"
            fill="#ffffff"
            stroke="url(#toraGoldGrad)"
            strokeWidth="5"
          />
          <line x1="277" y1="252" x2="372" y2="260" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="277" y1="272" x2="372" y2="280" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="277" y1="292" x2="372" y2="300" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="277" y1="312" x2="372" y2="320" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="292" y1="332" x2="357" y2="340" stroke="#94a3b8" strokeWidth="3.5" strokeLinecap="round" />

          {/* Golden Ribbon Bookmark */}
          <path d="M 254 235 L 254 395 L 256 385 L 258 395 L 258 235 Z" fill="url(#toraGoldGrad)" />
        </g>

        {/* Bottom Inscription "תורה דיליה" */}
        <g filter="url(#toraShadow)">
          <rect
            x="110"
            y="398"
            width="292"
            height="52"
            rx="14"
            fill="#0f1d38"
            stroke="url(#toraGoldGrad)"
            strokeWidth="3.5"
          />
          <text
            x="256"
            y="434"
            fontFamily="'David', 'FrankRuehl', 'Times New Roman', serif"
            fontWeight="900"
            fontSize="28"
            fill="url(#toraGoldGrad)"
            textAnchor="middle"
            letterSpacing="2"
          >
            תורה דיליה
          </text>
        </g>

        {/* Shining Stars */}
        <path
          d="M 120 160 L 124 172 L 136 176 L 124 180 L 120 192 L 116 180 L 104 176 L 116 172 Z"
          fill="url(#toraGoldGrad)"
          opacity="0.9"
        />
        <path
          d="M 392 160 L 396 172 L 408 176 L 396 180 L 392 192 L 388 180 L 376 176 L 388 172 Z"
          fill="url(#toraGoldGrad)"
          opacity="0.9"
        />
      </svg>
    </div>
  );
};
