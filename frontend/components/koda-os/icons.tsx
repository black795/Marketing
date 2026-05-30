// Tim Koda OS - Icon library (lucide-style, stroke 1.6)
import React from 'react';

export type IconProps = {
  size?: number;
  className?: string;
  stroke?: number;
  fill?: string;
};

export type IconComponent = (props?: IconProps) => React.ReactElement;

const I =
  (paths: React.ReactNode): IconComponent =>
  ({ size = 16, className = '', stroke = 1.6, fill = 'none' }: IconProps = {}) =>
    (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {paths}
      </svg>
    );

export const Icon = {
  Sparkles: I(
    <>
      <path d="M12 3v4M12 17v4M5 12H1M23 12h-4M18.5 5.5L16 8M8 16l-2.5 2.5M18.5 18.5L16 16M8 8L5.5 5.5" />
    </>,
  ),
  Wand: I(
    <>
      <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5" />
    </>,
  ),
  Layers: I(
    <>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </>,
  ),
  Image: I(
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </>,
  ),
  Film: I(
    <>
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
    </>,
  ),
  Type: I(
    <>
      <path d="M4 7V4h16v3M9 20h6M12 4v16" />
    </>,
  ),
  Clock: I(
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>,
  ),
  Download: I(
    <>
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </>,
  ),
  Settings: I(
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </>,
  ),
  Mask: I(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 010 18" />
    </>,
  ),
  Plus: I(<path d="M12 5v14M5 12h14" />),
  Minus: I(<path d="M5 12h14" />),
  Check: I(<polyline points="20 6 9 17 4 12" />),
  X: I(<path d="M18 6L6 18M6 6l12 12" />),
  Arrow: I(<path d="M5 12h14M13 5l7 7-7 7" />),
  ArrowL: I(<path d="M19 12H5M11 19l-7-7 7-7" />),
  ArrowUp: I(<path d="M12 19V5M5 12l7-7 7 7" />),
  Play: I(<polygon points="6 4 20 12 6 20 6 4" />),
  Pause: I(
    <>
      <rect x="6" y="4" width="4" height="16" />
      <rect x="14" y="4" width="4" height="16" />
    </>,
  ),
  Refresh: I(
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </>,
  ),
  Mic: I(
    <>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3" />
    </>,
  ),
  Upload: I(<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />),
  Trash: I(
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a2 2 0 012-2h2a2 2 0 012 2v2" />
    </>,
  ),
  Copy: I(
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </>,
  ),
  Edit: I(<path d="M12 20h9M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />),
  Eye: I(
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  ),
  Grip: I(
    <>
      <circle cx="9" cy="6" r="1.4" fill="currentColor" />
      <circle cx="15" cy="6" r="1.4" fill="currentColor" />
      <circle cx="9" cy="12" r="1.4" fill="currentColor" />
      <circle cx="15" cy="12" r="1.4" fill="currentColor" />
      <circle cx="9" cy="18" r="1.4" fill="currentColor" />
      <circle cx="15" cy="18" r="1.4" fill="currentColor" />
    </>,
  ),
  More: I(
    <>
      <circle cx="5" cy="12" r="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      <circle cx="19" cy="12" r="1.4" fill="currentColor" />
    </>,
  ),
  Search: I(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </>,
  ),
  ChevR: I(<polyline points="9 18 15 12 9 6" />),
  ChevL: I(<polyline points="15 18 9 12 15 6" />),
  ChevD: I(<polyline points="6 9 12 15 18 9" />),
  Lock: I(
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </>,
  ),
  Key: I(
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2" />
    </>,
  ),
  Flame: I(<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" />),
  Mood: I(
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>,
  ),
  Zap: I(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  Send: I(<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />),
  Save: I(
    <>
      <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </>,
  ),
  Star: I(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  Heart: I(<path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />),
  Cmd: I(<path d="M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z" />),
  At: I(
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94" />
    </>,
  ),
};
