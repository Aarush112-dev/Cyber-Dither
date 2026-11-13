import React from 'react';
import {
  FastForward,
  Pause,
  Play,
  Repeat,
  Rewind,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { AudioPlaybackStatus, Track } from '../types/visualizer';

interface AudioPlayerBarProps {
  currentTrack: Track | null;
  status: AudioPlaybackStatus;
  errorMessage: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  seekIntervalSec: number;
  audioPlaybackRate: number;
  visualFxPreviewEnabled: boolean;
  visualFxSpeedMultiplier: number;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (timeSec: number) => void;
  onSeekBy: (deltaSec: number) => void;
  onChangeSeekInterval: (sec: number) => void;
  onVolumeChange: (val: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onChangeAudioPlaybackRate: (rate: number) => void;
  onToggleVisualFxPreview: () => void;
  onChangeVisualFxSpeed: (mult: number) => void;
  onAttachAudioClick: () => void;
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${mins}:${rem.toString().padStart(2, '0')}`;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  status,
  errorMessage,
  currentTime,
  duration,
  volume,
  muted,
  shuffle,
  repeatMode,
  seekIntervalSec,
  audioPlaybackRate,
  visualFxPreviewEnabled,
  visualFxSpeedMultiplier,
  onTogglePlay,
  onPrev,
  onNext,
  onSeek,
  onSeekBy,
  onChangeSeekInterval,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onChangeAudioPlaybackRate,
  onToggleVisualFxPreview,
  onChangeVisualFxSpeed,
  onAttachAudioClick,
}) => {
  const isPlaying = status === 'PLAYING';
  const isPlayable = currentTrack?.availability === 'playable';
  const progressPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div className="relative z-20 border-t border-white/10 bg-[#0B0B14]/94 px-3 py-2.5 sm:px-5">
      {/* Error or Source Required inline banner */}
      {errorMessage && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded border border-[#FF3B9D]/40 bg-[#FF3B9D]/10 px-2.5 py-1 text-xs text-[#F0F1FF]">
          <span className="truncate">{errorMessage}</span>
        </div>
      )}

      {/* Seekable Progress Bar */}
      <div className="mb-2 flex items-center gap-2.5">
        <span className="font-mono-tech w-10 text-right text-[11px] text-[#8C91AE]">
          {isPlayable ? formatTime(currentTime) : '--:--'}
        </span>

        <div className="relative flex-1 flex items-center h-4 group">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.1}
            value={isPlayable && duration > 0 ? currentTime : 0}
            disabled={!isPlayable || duration <= 0}
            onChange={(e) => onSeek(Number(e.target.value))}
            aria-label="Seek playback position"
            className="cyber-range w-full disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: isPlayable
                ? `linear-gradient(to right, #51F5FF 0%, #FF3B9D ${progressPct}%, rgba(140,145,174,0.22) ${progressPct}%)`
                : undefined,
            }}
          />
        </div>

        <span className="font-mono-tech w-10 text-[11px] text-[#8C91AE]">
          {isPlayable && duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      </div>

      {/* Main Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Track Info */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5 basis-44">
          {currentTrack ? (
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-[#F0F1FF]">
                  {currentTrack.title}
                </p>
              </div>
              <p className="truncate text-xs text-[#8C91AE]">
                {currentTrack.artist}
                <span aria-hidden="true"> · </span>
                <span className={isPlayable ? 'text-[#16D9D2]' : 'text-[#FF3B9D]'}>
                  {isPlayable
                    ? currentTrack.sourceKind === 'public-domain'
                      ? 'Public Domain · Ready'
                      : currentTrack.sourceKind === 'local-file'
                      ? currentTrack.fileName || 'Local Audio'
                      : 'Stream URL'
                    : 'No Audio Source'}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-xs text-[#8C91AE]">
              Select a track or upload local MP3/WAV/OGG audio to begin.
            </p>
          )}
        </div>

        {/* Center: Transport + Fast Forward */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleShuffle}
            className={`rounded p-1.5 transition-colors cursor-pointer ${
              shuffle
                ? 'text-[#51F5FF] bg-[#51F5FF]/10'
                : 'text-[#8C91AE] hover:text-[#F0F1FF]'
            }`}
            title={`Shuffle: ${shuffle ? 'On' : 'Off'}`}
            aria-label="Toggle shuffle"
          >
            <Shuffle className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onPrev}
            className="rounded p-1.5 text-[#8C91AE] hover:text-[#F0F1FF] transition-colors cursor-pointer"
            title="Previous track"
            aria-label="Previous track"
          >
            <SkipBack className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => onSeekBy(-seekIntervalSec)}
            disabled={!isPlayable}
            className="hidden sm:flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-mono-tech text-[#8C91AE] hover:text-[#51F5FF] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={`Rewind ${seekIntervalSec}s`}
            aria-label={`Rewind ${seekIntervalSec} seconds`}
          >
            <Rewind className="h-3.5 w-3.5" />
            <span>-{seekIntervalSec}s</span>
          </button>

          {isPlayable ? (
            <button
              type="button"
              onClick={onTogglePlay}
              className="flex h-9 w-9 items-center justify-center rounded border border-[#51F5FF]/60 bg-[#51F5FF]/15 text-[#51F5FF] hover:bg-[#51F5FF]/25 transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAttachAudioClick}
              className="rounded border border-[#FF3B9D]/50 bg-[#FF3B9D]/12 px-2.5 py-1.5 text-xs font-medium text-[#FF3B9D] hover:bg-[#FF3B9D]/20 transition-colors whitespace-nowrap cursor-pointer"
              title="Upload or attach a local audio file for playback"
            >
              Attach Audio
            </button>
          )}

          <button
            type="button"
            onClick={() => onSeekBy(seekIntervalSec)}
            disabled={!isPlayable}
            className="flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-mono-tech text-[#8C91AE] hover:text-[#51F5FF] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title={`Fast forward ${seekIntervalSec}s`}
            aria-label={`Fast forward ${seekIntervalSec} seconds`}
          >
            <span>+{seekIntervalSec}s</span>
            <FastForward className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={onNext}
            className="rounded p-1.5 text-[#8C91AE] hover:text-[#F0F1FF] transition-colors cursor-pointer"
            title="Next track"
            aria-label="Next track"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onCycleRepeat}
            className={`relative rounded p-1.5 transition-colors cursor-pointer ${
              repeatMode !== 'off'
                ? 'text-[#51F5FF] bg-[#51F5FF]/10'
                : 'text-[#8C91AE] hover:text-[#F0F1FF]'
            }`}
            title={`Repeat: ${repeatMode}`}
            aria-label="Cycle repeat mode"
          >
            <Repeat className="h-3.5 w-3.5" />
            {repeatMode === 'one' && (
              <span className="font-mono-tech absolute -top-0.5 -right-0.5 text-[9px] text-[#51F5FF]">
                1
              </span>
            )}
          </button>
        </div>

        {/* Right: Fast-Forward Step, Audio Speed vs Visual FX Preview, & Volume */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Configurable Seek Interval */}
          <div className="hidden lg:flex items-center gap-1 border border-white/10 rounded px-1.5 py-1 bg-[#11111D]">
            <span className="text-[10px] text-[#8C91AE]">Skip</span>
            <select
              value={seekIntervalSec}
              onChange={(e) => onChangeSeekInterval(Number(e.target.value))}
              aria-label="Fast-forward skip interval"
              className="bg-transparent font-mono-tech text-[11px] text-[#F0F1FF] outline-none cursor-pointer"
            >
              <option value={5} className="bg-[#11111D]">5s</option>
              <option value={10} className="bg-[#11111D]">10s</option>
              <option value={15} className="bg-[#11111D]">15s</option>
              <option value={30} className="bg-[#11111D]">30s</option>
            </select>
          </div>

          {/* Audio Playback Rate (real audio speed) */}
          <div
            className="hidden md:flex items-center gap-1 border border-white/10 rounded px-1.5 py-1 bg-[#11111D]"
            title="Real audio playback speed (changes audio pitch/tempo via playbackRate)"
          >
            <span className="text-[10px] text-[#8C91AE]">Audio</span>
            <select
              value={audioPlaybackRate}
              onChange={(e) => onChangeAudioPlaybackRate(Number(e.target.value))}
              aria-label="Audio playback rate"
              className="bg-transparent font-mono-tech text-[11px] text-[#F0F1FF] outline-none cursor-pointer"
            >
              <option value={0.75} className="bg-[#11111D]">0.75x</option>
              <option value={1} className="bg-[#11111D]">1.0x</option>
              <option value={1.25} className="bg-[#11111D]">1.25x</option>
              <option value={1.5} className="bg-[#11111D]">1.5x</option>
              <option value={2} className="bg-[#11111D]">2.0x</option>
            </select>
          </div>

          {/* Visual FX Preview Mode (strictly accelerates visual shader/particle time, NOT audio) */}
          <div
            className={`flex items-center gap-1 rounded border px-1.5 py-1 transition-colors ${
              visualFxPreviewEnabled
                ? 'border-[#FF3B9D]/60 bg-[#FF3B9D]/14'
                : 'border-white/10 bg-[#11111D]'
            }`}
            title="Visual FX Preview accelerates 3D particle/shader motion only—audio plays at its own speed"
          >
            <button
              type="button"
              onClick={onToggleVisualFxPreview}
              aria-pressed={visualFxPreviewEnabled}
              className={`flex items-center gap-1 text-[11px] font-medium whitespace-nowrap cursor-pointer ${
                visualFxPreviewEnabled ? 'text-[#FF3B9D]' : 'text-[#8C91AE] hover:text-[#F0F1FF]'
              }`}
            >
              <Zap className="h-3 w-3" />
              <span>FX Preview</span>
            </button>
            {visualFxPreviewEnabled && (
              <select
                value={visualFxSpeedMultiplier}
                onChange={(e) => onChangeVisualFxSpeed(Number(e.target.value))}
                aria-label="Visual FX preview speed multiplier"
                className="bg-transparent font-mono-tech text-[11px] text-[#FF3B9D] outline-none cursor-pointer"
              >
                <option value={1.5} className="bg-[#11111D]">1.5x</option>
                <option value={2} className="bg-[#11111D]">2.0x</option>
                <option value={3} className="bg-[#11111D]">3.0x</option>
              </select>
            )}
          </div>

          {/* Volume & Mute */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleMute}
              className="rounded p-1 text-[#8C91AE] hover:text-[#F0F1FF] transition-colors cursor-pointer"
              title={muted ? 'Unmute' : 'Mute'}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-[#FF3B9D]" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
              aria-label="Volume"
              className="cyber-range hidden sm:block w-16 md:w-20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
