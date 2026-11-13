import type { AudioMetrics, AudioPlaybackStatus, Track } from '../types/visualizer';

const SUPPORTED_EXTENSIONS = new Set([
  'mp3',
  'wav',
  'ogg',
  'oga',
  'm4a',
  'aac',
  'flac',
  'webm',
  'opus',
]);

export function validateAudioFile(file: File): { valid: boolean; reason?: string } {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const hasAudioMime = file.type.startsWith('audio/') || file.type === 'video/webm';

  if (!hasAudioMime && !SUPPORTED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      reason: `Unsupported file format "${file.name}". Please upload MP3, WAV, OGG, M4A, FLAC, AAC, or WebM audio.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      reason: `File "${file.name}" is empty (0 bytes).`,
    };
  }

  // Test browser codec compatibility when mime is available
  if (file.type) {
    const probe = document.createElement('audio');
    const canPlay = probe.canPlayType(file.type);
    if (canPlay === '' && !SUPPORTED_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        reason: `This browser cannot decode "${file.type}". Try MP3, WAV, or OGG.`,
      };
    }
  }

  return { valid: true };
}

export interface AudioEngineCallbacks {
  onStateChange: (status: AudioPlaybackStatus, error?: string | null) => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onEnded: () => void;
}

/**
 * Single-instance Web Audio API + HTMLAudioElement playback & analysis engine.
 * Ensures only one AudioContext and one MediaElementAudioSourceNode are created.
 */
export class AudioEngine {
  private audioEl: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  private freqData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
  private timeData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));
  private prevFreqBins = new Float32Array(64);

  private spectrumOut = new Float32Array(64);
  private waveformOut = new Float32Array(128);

  private smoothedBass = 0;
  private smoothedMids = 0;
  private smoothedHighs = 0;
  private smoothedOverall = 0;
  private transientPulse = 0;
  private lastBeatTimeMs = 0;
  private fluxAverage = 0;
  private adaptivePeak = 0.35;
  private shortEnergyAvg = 0;
  private longEnergyAvg = 0;
  private smoothedTension = 0;
  private releasePulse = 0;
  private lastReleaseTimeMs = 0;

  private callbacks: AudioEngineCallbacks;
  private currentTrackId: string | null = null;
  private currentFallbackUrl: string | null = null;
  private triedFallback = false;
  private status: AudioPlaybackStatus = 'NO AUDIO SOURCE';
  private volume = 0.85;
  private muted = false;
  private playbackRate = 1.0;

  constructor(callbacks: AudioEngineCallbacks) {
    this.callbacks = callbacks;
    this.audioEl = new Audio();
    this.audioEl.preload = 'metadata';
    this.audioEl.crossOrigin = 'anonymous';
    this.audioEl.volume = this.volume;
    this.audioEl.muted = this.muted;
    this.bindAudioEvents();
  }

  private bindAudioEvents() {
    this.audioEl.addEventListener('loadstart', () => {
      if (this.audioEl.src) {
        this.setStatus('LOADING', null);
      }
    });

    this.audioEl.addEventListener('canplay', () => {
      if (this.audioEl.paused && this.status === 'LOADING') {
        this.setStatus('READY', null);
      }
      this.callbacks.onTimeUpdate(
        this.audioEl.currentTime || 0,
        Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
      );
    });

    this.audioEl.addEventListener('loadedmetadata', () => {
      this.callbacks.onTimeUpdate(
        this.audioEl.currentTime || 0,
        Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
      );
    });

    this.audioEl.addEventListener('playing', () => {
      this.setStatus('PLAYING', null);
    });

    this.audioEl.addEventListener('pause', () => {
      if (!this.audioEl.ended && this.audioEl.src) {
        this.setStatus('PAUSED', null);
      }
    });

    this.audioEl.addEventListener('timeupdate', () => {
      this.callbacks.onTimeUpdate(
        this.audioEl.currentTime || 0,
        Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
      );
    });

    this.audioEl.addEventListener('ended', () => {
      this.setStatus('PAUSED', null);
      this.callbacks.onEnded();
    });

    this.audioEl.addEventListener('error', () => {
      if (this.currentFallbackUrl && !this.triedFallback) {
        this.triedFallback = true;
        const wasPlaying = this.status === 'PLAYING';
        this.audioEl.crossOrigin = 'anonymous';
        this.setStatus('LOADING', null);
        this.audioEl.src = this.currentFallbackUrl;
        this.audioEl.playbackRate = this.playbackRate;
        this.audioEl.load();
        if (wasPlaying) {
          void this.audioEl.play().catch(() => {});
        }
        return;
      }

      const code = this.audioEl.error?.code;
      let msg = 'Unable to load or decode this audio source.';
      if (code === MediaError.MEDIA_ERR_DECODE) {
        msg = 'Audio decoding failed. The file may be corrupted or use an unsupported codec.';
      } else if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        msg = 'Audio format not supported or blocked by CORS policy on the remote server.';
      } else if (code === MediaError.MEDIA_ERR_NETWORK) {
        msg = 'Network error while fetching the audio stream.';
      }
      this.setStatus('ERROR', msg);
    });
  }

  private setStatus(status: AudioPlaybackStatus, error: string | null) {
    this.status = status;
    this.callbacks.onStateChange(status, error);
  }

  private ensureAudioContext(): boolean {
    if (typeof window === 'undefined') return false;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.78;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -12;

      this.freqData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.timeData = new Uint8Array(new ArrayBuffer(this.analyser.fftSize));

      this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
      this.sourceNode.connect(this.audioCtx.destination);
      this.sourceNode.connect(this.analyser);
    }

    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {
        // Ignore until user gesture
      });
    }

    return true;
  }

  public loadTrack(track: Track | null): void {
    this.audioEl.pause();
    this.audioEl.currentTime = 0;

    if (!track || track.availability !== 'playable' || !track.sourceUrl) {
      this.currentTrackId = track?.id ?? null;
      this.currentFallbackUrl = null;
      this.triedFallback = false;
      this.audioEl.removeAttribute('src');
      this.audioEl.load();
      this.callbacks.onTimeUpdate(0, 0);
      this.setStatus('NO AUDIO SOURCE', null);
      return;
    }

    const canPlayPrimary =
      !track.mimeType || this.audioEl.canPlayType(track.mimeType) !== '';
    const resolvedUrl =
      !canPlayPrimary && track.fallbackSourceUrl
        ? track.fallbackSourceUrl
        : track.sourceUrl;

    const isSameSource =
      this.currentTrackId === track.id && this.audioEl.src === resolvedUrl;
    this.currentTrackId = track.id;
    this.currentFallbackUrl =
      resolvedUrl === track.sourceUrl ? (track.fallbackSourceUrl ?? null) : null;
    this.triedFallback = resolvedUrl !== track.sourceUrl;

    if (!isSameSource) {
      // Local blob URLs don't need CORS attribute; remote URLs need anonymous CORS for Web Audio analyser
      if (track.sourceKind === 'local-file') {
        this.audioEl.removeAttribute('crossorigin');
      } else {
        this.audioEl.crossOrigin = 'anonymous';
      }
      this.setStatus('LOADING', null);
      this.audioEl.src = resolvedUrl;
      this.audioEl.playbackRate = this.playbackRate;
      this.audioEl.load();
    }
  }

  public async play(): Promise<boolean> {
    if (!this.audioEl.src) {
      this.setStatus('NO AUDIO SOURCE', 'Attach a local audio file or valid stream URL first.');
      return false;
    }

    this.ensureAudioContext();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        // Handled by play() below
      }
    }

    try {
      this.audioEl.playbackRate = this.playbackRate;
      await this.audioEl.play();
      this.setStatus('PLAYING', null);
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Playback blocked or failed. Click play again to start audio.';
      this.setStatus('ERROR', msg);
      return false;
    }
  }

  public pause(): void {
    this.audioEl.pause();
    if (this.audioEl.src) {
      this.setStatus('PAUSED', null);
    }
  }

  public seek(seconds: number): void {
    if (!this.audioEl.src || !Number.isFinite(this.audioEl.duration)) return;
    const clamped = Math.max(0, Math.min(seconds, this.audioEl.duration));
    this.audioEl.currentTime = clamped;
    this.callbacks.onTimeUpdate(clamped, this.audioEl.duration);
  }

  public seekBy(deltaSeconds: number): number {
    if (!this.audioEl.src) return 0;
    const duration = Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0;
    const target = Math.max(0, Math.min((this.audioEl.currentTime || 0) + deltaSeconds, duration));
    this.audioEl.currentTime = target;
    this.callbacks.onTimeUpdate(target, duration);
    return target;
  }

  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    this.audioEl.volume = this.volume;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.audioEl.muted = muted;
  }

  public setPlaybackRate(rate: number): void {
    this.playbackRate = Math.max(0.5, Math.min(2.0, rate));
    this.audioEl.playbackRate = this.playbackRate;
    if ('preservesPitch' in this.audioEl) {
      this.audioEl.preservesPitch = true;
    }
  }

  public getCurrentTime(): number {
    return this.audioEl.currentTime || 0;
  }

  public getDuration(): number {
    return Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0;
  }

  /**
   * Computes real-time frequency energies, waveform samples, and beat/transient estimation.
   * When paused or silent, smoothly decays values toward zero without inventing fake beats.
   */
  public sampleMetrics(sensitivity: number, out: AudioMetrics): AudioMetrics {
    const isPlaying = this.status === 'PLAYING' && !this.audioEl.paused;

    if (!isPlaying || !this.analyser || !this.audioCtx) {
      // Smooth decay to idle
      this.smoothedBass *= 0.88;
      this.smoothedMids *= 0.88;
      this.smoothedHighs *= 0.88;
      this.smoothedOverall *= 0.88;
      this.transientPulse *= 0.84;
      this.smoothedTension *= 0.86;
      this.releasePulse *= 0.82;
      this.shortEnergyAvg *= 0.88;
      this.longEnergyAvg *= 0.96;
      this.adaptivePeak += (0.35 - this.adaptivePeak) * 0.04;

      for (let i = 0; i < 64; i++) {
        this.spectrumOut[i] *= 0.88;
      }
      for (let i = 0; i < 128; i++) {
        this.waveformOut[i] *= 0.85;
      }

      out.bass = this.smoothedBass;
      out.mids = this.smoothedMids;
      out.highs = this.smoothedHighs;
      out.overall = this.smoothedOverall;
      out.transient = this.transientPulse;
      out.tension = this.smoothedTension;
      out.release = this.releasePulse;
      out.isBeat = false;
      out.waveform = this.waveformOut;
      out.spectrum = this.spectrumOut;
      out.isActiveSignal = false;
      return out;
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const sampleRate = this.audioCtx.sampleRate || 44100;
    const binCount = this.analyser.frequencyBinCount; // 1024
    const nyquist = sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    const bassEndBin = Math.max(2, Math.floor(170 / hzPerBin));
    const midsEndBin = Math.max(bassEndBin + 2, Math.floor(2400 / hzPerBin));
    const highsEndBin = Math.min(binCount - 1, Math.floor(14000 / hzPerBin));

    let bassSum = 0;
    let bassCount = 0;
    let midsSum = 0;
    let midsCount = 0;
    let highsSum = 0;
    let highsCount = 0;

    for (let i = 1; i < highsEndBin; i++) {
      const v = this.freqData[i] / 255;
      if (i <= bassEndBin) {
        bassSum += v;
        bassCount++;
      } else if (i <= midsEndBin) {
        midsSum += v;
        midsCount++;
      } else {
        highsSum += v;
        highsCount++;
      }
    }

    const gain = Math.max(0.25, sensitivity);
    const unscaledBass = (bassSum / Math.max(1, bassCount)) * 1.08;
    const unscaledMids = (midsSum / Math.max(1, midsCount)) * 1.2;
    const unscaledHighs = (highsSum / Math.max(1, highsCount)) * 1.4;
    const unscaledOverall = unscaledBass * 0.45 + unscaledMids * 0.35 + unscaledHighs * 0.2;

    // Balanced adaptive peak tracker keeps quieter pieces lively without clipping loud tracks
    if (unscaledOverall > 0.015) {
      if (unscaledOverall > this.adaptivePeak) {
        this.adaptivePeak += (unscaledOverall - this.adaptivePeak) * 0.18;
      } else {
        this.adaptivePeak = Math.max(0.19, this.adaptivePeak * 0.9965);
      }
    }
    const autoGain =
      unscaledOverall > 0.015
        ? Math.min(2.05, Math.max(0.95, 0.7 / Math.max(0.19, this.adaptivePeak)))
        : 1.0;
    const effectiveGain = gain * autoGain;

    const rawBass = Math.min(1, unscaledBass * effectiveGain);
    const rawMids = Math.min(1, unscaledMids * effectiveGain);
    const rawHighs = Math.min(1, unscaledHighs * effectiveGain);
    const rawOverall = Math.min(1, rawBass * 0.45 + rawMids * 0.35 + rawHighs * 0.2);

    this.smoothedBass += (rawBass - this.smoothedBass) * 0.29;
    this.smoothedMids += (rawMids - this.smoothedMids) * 0.27;
    this.smoothedHighs += (rawHighs - this.smoothedHighs) * 0.3;
    this.smoothedOverall += (rawOverall - this.smoothedOverall) * 0.28;

    // Logarithmically spaced 64 spectrum bands + spectral flux transient detection
    let flux = 0;
    for (let b = 0; b < 64; b++) {
      const t0 = b / 64;
      const t1 = (b + 1) / 64;
      const startBin = Math.max(1, Math.floor(Math.pow(t0, 1.85) * highsEndBin));
      const endBin = Math.max(startBin + 1, Math.floor(Math.pow(t1, 1.85) * highsEndBin));

      let sum = 0;
      for (let k = startBin; k < endBin; k++) {
        sum += this.freqData[k] / 255;
      }
      const bandVal = Math.min(1, (sum / (endBin - startBin)) * effectiveGain);
      this.spectrumOut[b] += (bandVal - this.spectrumOut[b]) * 0.35;

      const weight = b < 24 ? 1.5 : 0.72;
      const diff = bandVal - this.prevFreqBins[b];
      if (diff > 0) flux += diff * weight;
      this.prevFreqBins[b] = bandVal;
    }

    // Balanced flux hysteresis for crisp musical beats without jitter
    const normFlux = flux / 23;
    this.fluxAverage = this.fluxAverage * 0.9 + normFlux * 0.1;
    const now = performance.now();
    const hasAudibleSignal = this.smoothedOverall > 0.038;
    const threshold = Math.max(0.062, this.fluxAverage * 1.48 + 0.026);
    const isBeat =
      hasAudibleSignal && normFlux > threshold && now - this.lastBeatTimeMs > 180;

    if (isBeat) {
      this.lastBeatTimeMs = now;
      this.transientPulse = Math.min(1, Math.max(this.transientPulse, normFlux * 3.1));
    } else {
      this.transientPulse *= 0.88;
    }

    // Musical tension & release detection balanced for clear crescendo swelling & drop bursts
    this.shortEnergyAvg += (this.smoothedOverall - this.shortEnergyAvg) * 0.11;
    this.longEnergyAvg += (this.smoothedOverall - this.longEnergyAvg) * 0.008;

    const crescendoDelta = Math.max(0, this.shortEnergyAvg - this.longEnergyAvg);
    const highPresence = Math.max(0, this.smoothedHighs * 0.62 + this.smoothedMids * 0.38 - 0.21);
    const targetTension = hasAudibleSignal
      ? Math.min(1, crescendoDelta * 3.2 + highPresence * 0.55 + this.fluxAverage * 1.5)
      : 0;

    if (targetTension > this.smoothedTension) {
      this.smoothedTension += (targetTension - this.smoothedTension) * 0.08;
    } else {
      this.smoothedTension += (targetTension - this.smoothedTension) * 0.035;
    }

    const bassJump = rawBass - this.smoothedBass;
    const isClimaxDrop =
      hasAudibleSignal &&
      now - this.lastReleaseTimeMs > 620 &&
      ((isBeat && (this.smoothedTension > 0.34 || rawBass > 0.68)) ||
        (bassJump > 0.21 && this.smoothedTension > 0.28));

    if (isClimaxDrop) {
      this.lastReleaseTimeMs = now;
      this.releasePulse = Math.min(1, Math.max(this.releasePulse, 0.48 + this.smoothedTension * 0.44));
    } else {
      this.releasePulse *= 0.92;
    }

    // Downsample time-domain waveform cleanly into 128 samples (-1..1)
    const step = Math.floor(this.timeData.length / 128);
    const waveGain = Math.min(2.4, effectiveGain);
    for (let i = 0; i < 128; i++) {
      const sample = (this.timeData[i * step] - 128) / 128;
      this.waveformOut[i] = Math.max(-1, Math.min(1, sample * waveGain));
    }

    out.bass = this.smoothedBass;
    out.mids = this.smoothedMids;
    out.highs = this.smoothedHighs;
    out.overall = this.smoothedOverall;
    out.transient = this.transientPulse;
    out.tension = this.smoothedTension;
    out.release = this.releasePulse;
    out.isBeat = isBeat;
    out.waveform = this.waveformOut;
    out.spectrum = this.spectrumOut;
    out.isActiveSignal = hasAudibleSignal;
    return out;
  }

  public dispose(): void {
    this.audioEl.pause();
    this.audioEl.removeAttribute('src');
    this.audioEl.load();
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // ignore
      }
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      void this.audioCtx.close().catch(() => {});
    }
  }
}
