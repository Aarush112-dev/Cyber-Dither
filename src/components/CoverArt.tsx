import React from 'react';
import type { Track } from '../types/visualizer';

interface CoverArtProps {
  track: Track;
  size?: 'sm' | 'md';
  isPlaying?: boolean;
}

const GENRE_PALETTES: Record<string, [string, string]> = {
  Electronic: ['#51F5FF', '#712EFF'],
  Pop: ['#FF3B9D', '#51F5FF'],
  'Hip-Hop': ['#FF3B9D', '#426BFF'],
  Indie: ['#16D9D2', '#FF3B9D'],
  Rock: ['#426BFF', '#FF3B9D'],
  Ambient: ['#16D9D2', '#712EFF'],
  Classical: ['#51F5FF', '#16D9D2'],
};

export const CoverArt: React.FC<CoverArtProps> = ({
  track,
  size = 'sm',
  isPlaying = false,
}) => {
  const [c1, c2] = GENRE_PALETTES[track.genre] ?? ['#51F5FF', '#FF3B9D'];
  const dim = size === 'sm' ? 'w-10 h-10' : 'w-12 h-12';
  const seed = track.artSeed;
  const ringR = 11 + (seed % 5);
  const rot = (seed * 37) % 180;

  return (
    <div
      className={`${dim} relative shrink-0 overflow-hidden rounded border border-white/15 bg-[#080812]`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 48 48" className="w-full h-full">
        <defs>
          <linearGradient id={`grad-${track.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={c1} stopOpacity="0.28" />
            <stop offset="100%" stopColor={c2} stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" fill="#070710" />
        <rect width="48" height="48" fill={`url(#grad-${track.id})`} />
        {/* Subtle dither grid dots */}
        <pattern id={`dots-${track.id}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="1.2" height="1.2" fill={c1} fillOpacity="0.22" />
        </pattern>
        <rect width="48" height="48" fill={`url(#dots-${track.id})`} />
        <g transform={`rotate(${rot} 24 24)`}>
          <circle
            cx="24"
            cy="24"
            r={ringR}
            fill="none"
            stroke={c1}
            strokeWidth="1.2"
            strokeOpacity="0.85"
            strokeDasharray={seed % 2 === 0 ? '4 2' : undefined}
          />
          <polygon
            points="24,10 36,31 12,31"
            fill="none"
            stroke={c2}
            strokeWidth="1.1"
            strokeOpacity="0.85"
          />
        </g>
        <circle cx="24" cy="24" r="3" fill={isPlaying ? '#51F5FF' : c2} fillOpacity="0.9" />
      </svg>
    </div>
  );
};
