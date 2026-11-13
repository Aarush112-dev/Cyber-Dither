export type GenreCategory =
  | 'All Songs'
  | 'Playable'
  | 'Public Domain'
  | 'Uploaded'
  | 'Electronic'
  | 'Pop'
  | 'Hip-Hop'
  | 'Indie'
  | 'Rock'
  | 'Ambient'
  | 'Classical'
  | 'Trending';

export type AudioSourceKind = 'none' | 'local-file' | 'direct-url' | 'public-domain';

export type AudioAvailability = 'playable' | 'source_required' | 'error';

export type AudioPlaybackStatus =
  | 'READY'
  | 'LOADING'
  | 'PLAYING'
  | 'PAUSED'
  | 'NO AUDIO SOURCE'
  | 'ERROR';

export interface ExternalListenLinks {
  spotify: string;
  appleMusic: string;
  youtubeMusic: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: Exclude<
    GenreCategory,
    'All Songs' | 'Playable' | 'Public Domain' | 'Uploaded' | 'Trending'
  >;
  trending?: boolean;
  year?: number;
  /** Reference metadata duration in seconds (null if unknown). Player always uses actual decoded audio duration during playback. */
  catalogDurationSec: number | null;
  sourceKind: AudioSourceKind;
  availability: AudioAvailability;
  sourceUrl: string | null;
  fileName?: string;
  mimeType?: string;
  fallbackSourceUrl?: string;
  fallbackMimeType?: string;
  errorMessage?: string;
  isUserUploaded?: boolean;
  isPublicDomain?: boolean;
  scoreId?: string;
  externalLinks?: ExternalListenLinks;
  artSeed: number;
}

export type VisualizerModeId =
  | 'reactive-sphere'
  | 'grid-bars'
  | 'neon-tunnel'
  | 'floating-cloud'
  | 'digital-waveform'
  | 'cybernetic-core';

export interface VisualizerModeMeta {
  id: VisualizerModeId;
  label: string;
  shortLabel: string;
  description: string;
}

export type ColorPresetId =
  | 'cyberpunk'
  | 'cyan-magenta'
  | 'ultraviolet'
  | 'electric-blue'
  | 'monochrome-phosphor'
  | 'custom';

export interface ColorTheme {
  id: ColorPresetId;
  name: string;
  primary: string;
  secondary: string;
  tertiary: string;
  background: string;
  grid: string;
}

export type QualityPreset = 'low' | 'medium' | 'high' | 'ultra';

export interface VisualizerSettings {
  mode: VisualizerModeId;
  colorPreset: ColorPresetId;
  customPrimary: string;
  customSecondary: string;
  quality: QualityPreset;

  // Camera
  cinematicCamera: boolean;
  cameraOrbitSpeed: number; // 0.0 - 2.0
  cameraDistance: number; // 4.5 - 18.0

  // Bayer 8x8 Dither & Post-processing
  ditherIntensity: number; // 0.0 - 1.0
  colorLevels: number; // 2 - 32
  pixelScale: number; // 1 - 8
  bloomIntensity: number; // 0.0 - 2.5
  glitchIntensity: number; // 0.0 - 1.0

  // Particles & Audio reactivity
  particleDensity: number; // 0.2 - 1.0
  particleSize: number; // 0.5 - 2.5
  particleSpeed: number; // 0.2 - 3.0
  sensitivity: number; // 0.3 - 2.5

  // Visual FX Preview Mode (strictly visual time multiplier, independent of audio playbackRate)
  visualFxPreviewEnabled: boolean;
  visualFxSpeedMultiplier: number; // 1.0, 2.0, 3.0
}

export interface AudioMetrics {
  bass: number; // 0 - 1
  mids: number; // 0 - 1
  highs: number; // 0 - 1
  overall: number; // 0 - 1
  transient: number; // 0 - 1 smoothed pulse
  tension: number; // 0 - 1 musical buildup / crescendo tension
  release: number; // 0 - 1 climax / drop impact impulse
  isBeat: boolean;
  waveform: Float32Array; // -1 to 1, length 128
  spectrum: Float32Array; // 0 to 1, length 64
  isActiveSignal: boolean;
}
