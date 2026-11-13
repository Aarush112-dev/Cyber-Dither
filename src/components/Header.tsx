import React from 'react';
import {
  Library,
  Maximize2,
  Minimize2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import type {
  AudioPlaybackStatus,
  QualityPreset,
  VisualizerModeMeta,
} from '../types/visualizer';

interface HeaderProps {
  activeMode: VisualizerModeMeta;
  audioStatus: AudioPlaybackStatus;
  meterRefs: {
    bassRef: React.RefObject<HTMLDivElement | null>;
    midsRef: React.RefObject<HTMLDivElement | null>;
    highsRef: React.RefObject<HTMLDivElement | null>;
  };
  libraryOpen: boolean;
  controlsOpen: boolean;
  isFullscreen: boolean;
  quality: QualityPreset;
  onToggleLibrary: () => void;
  onToggleControls: () => void;
  onCycleQuality: () => void;
  onToggleFullscreen: () => void;
}

const STATUS_STYLES: Record<AudioPlaybackStatus, { text: string; tone: string }> = {
  PLAYING: { text: 'Live Audio', tone: 'text-[#51F5FF]' },
  PAUSED: { text: 'Paused', tone: 'text-[#8C91AE]' },
  READY: { text: 'Ready', tone: 'text-[#16D9D2]' },
  LOADING: { text: 'Loading', tone: 'text-[#51F5FF]' },
  'NO AUDIO SOURCE': { text: 'Idle · No Audio', tone: 'text-[#8C91AE]' },
  ERROR: { text: 'Audio Error', tone: 'text-[#FF3B9D]' },
};

export const Header: React.FC<HeaderProps> = ({
  activeMode,
  audioStatus,
  meterRefs,
  libraryOpen,
  controlsOpen,
  isFullscreen,
  quality,
  onToggleLibrary,
  onToggleControls,
  onCycleQuality,
  onToggleFullscreen,
}) => {
  const statusInfo = STATUS_STYLES[audioStatus];

  return (
    <header className="relative z-20 flex h-12 shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#0B0B14]/92 px-3 sm:px-5">
      {/* Zone 1: Brand Wordmark + Reactive Glyph */}
      <div className="flex items-center gap-2.5 shrink-0">
        <svg
          width="22"
          height="18"
          viewBox="0 0 22 18"
          className="shrink-0"
          aria-hidden="true"
        >
          <rect x="1" y="7" width="2" height="4" fill="#51F5FF" />
          <rect x="5" y="3" width="2" height="12" fill="#16D9D2" />
          <rect x="9" y="1" width="2" height="16" fill="#51F5FF" />
          <rect x="13" y="4" width="2" height="10" fill="#712EFF" />
          <rect x="17" y="6" width="2" height="6" fill="#FF3B9D" />
        </svg>
        <span className="font-display text-base sm:text-lg font-bold tracking-[0.14em] whitespace-nowrap select-none">
          <span className="text-[#F0F1FF]">CYBER </span>
          <span className="bg-gradient-to-r from-[#51F5FF] to-[#FF3B9D] bg-clip-text text-transparent">
            DITHER
          </span>
        </span>
      </div>

      {/* Zone 2: Environment Mode + Real Audio Reactivity State & Live L/M/H Bars */}
      <div className="hidden md:flex items-center gap-5 text-xs">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[#8C91AE]">Mode</span>
          <span className="font-medium text-[#F0F1FF]">{activeMode.label}</span>
        </div>

        <span className="text-white/15" aria-hidden="true">
          |
        </span>

        <div className="flex items-center gap-2.5 whitespace-nowrap">
          <span className={`font-mono-tech text-[11px] uppercase tracking-wider ${statusInfo.tone}`}>
            {statusInfo.text}
          </span>

          {/* Real-time Bass / Mids / Highs meter bars updated via refs at 60fps */}
          <div
            className="flex items-end gap-1 h-3.5 px-1.5 py-0.5 border border-white/10 rounded bg-[#05050B]"
            title="Real-time frequency band energy: Bass / Mids / Highs"
            aria-label="Real-time frequency meter"
          >
            <div className="w-1 h-full bg-white/10 rounded-xs overflow-hidden flex items-end">
              <div
                ref={meterRefs.bassRef}
                className="w-full bg-[#51F5FF] transition-none"
                style={{ height: '12%' }}
              />
            </div>
            <div className="w-1 h-full bg-white/10 rounded-xs overflow-hidden flex items-end">
              <div
                ref={meterRefs.midsRef}
                className="w-full bg-[#712EFF] transition-none"
                style={{ height: '12%' }}
              />
            </div>
            <div
              className="w-1 h-full bg-white/10 rounded-xs overflow-hidden flex items-end"
            >
              <div
                ref={meterRefs.highsRef}
                className="w-full bg-[#FF3B9D] transition-none"
                style={{ height: '12%' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Zone 3: Panel & Viewport Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleLibrary}
          aria-pressed={libraryOpen}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
            libraryOpen
              ? 'border-[#51F5FF]/60 bg-[#51F5FF]/12 text-[#51F5FF]'
              : 'border-white/10 bg-[#11111D] text-[#8C91AE] hover:text-[#F0F1FF] hover:border-white/25'
          }`}
          title="Toggle Music Library panel"
        >
          <Library className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Library</span>
        </button>

        <button
          type="button"
          onClick={onToggleControls}
          aria-pressed={controlsOpen}
          className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
            controlsOpen
              ? 'border-[#FF3B9D]/60 bg-[#FF3B9D]/12 text-[#FF3B9D]'
              : 'border-white/10 bg-[#11111D] text-[#8C91AE] hover:text-[#F0F1FF] hover:border-white/25'
          }`}
          title="Toggle Visualiser Controls panel"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Visualiser</span>
        </button>

        <button
          type="button"
          onClick={onCycleQuality}
          className="hidden sm:flex items-center gap-1.5 rounded border border-white/10 bg-[#11111D] px-2.5 py-1.5 text-xs font-mono-tech text-[#8C91AE] hover:text-[#F0F1FF] hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Cycle rendering quality preset (Low / Medium / High / Ultra)"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#16D9D2]" />
          <span className="capitalize">{quality}</span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex items-center justify-center rounded border border-white/10 bg-[#11111D] p-1.5 text-[#8C91AE] hover:text-[#51F5FF] hover:border-[#51F5FF]/40 transition-colors shrink-0 cursor-pointer"
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
