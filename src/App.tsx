import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine, validateAudioFile } from './audio/AudioEngine';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { Header } from './components/Header';
import { MusicLibraryPanel } from './components/MusicLibraryPanel';
import { VisualizerControlsPanel } from './components/VisualizerControlsPanel';
import { WebGLFallback } from './components/WebGLFallback';
import { CURATED_CATALOG } from './data/catalog';
import { DEFAULT_SETTINGS, VISUALIZER_MODES } from './data/themes';
import { VisualizerScene } from './three/VisualizerScene';
import type {
  AudioMetrics,
  AudioPlaybackStatus,
  GenreCategory,
  QualityPreset,
  Track,
  VisualizerSettings,
} from './types/visualizer';

const SETTINGS_STORAGE_KEY = 'cyber-dither-prefs-v6';

function loadSavedSettings(): VisualizerSettings {
  try {
    const raw = sessionStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<VisualizerSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      // Always start with visual FX preview off unless explicitly enabled in current view
      visualFxPreviewEnabled: false,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export default function App() {
  const [settings, setSettings] = useState<VisualizerSettings>(() => loadSavedSettings());
  const [tracks, setTracks] = useState<Track[]>(() => CURATED_CATALOG);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(
    CURATED_CATALOG[0]?.id ?? null,
  );
  const [queueIds, setQueueIds] = useState<string[]>([]);

  const [audioStatus, setAudioStatus] = useState<AudioPlaybackStatus>('NO AUDIO SOURCE');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [seekIntervalSec, setSeekIntervalSec] = useState(10);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(1.0);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState<GenreCategory>('All Songs');

  // Panels default open on wide desktop, closed on compact viewports so 3D center shines
  const [libraryOpen, setLibraryOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  const [controlsOpen, setControlsOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1180 : false,
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglError, setWebglError] = useState<string | null>(null);

  const appShellRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VisualizerScene | null>(null);
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const quickAttachRef = useRef<HTMLInputElement>(null);

  // Real-time Header meter bar DOM refs (updated directly from render loop without React re-renders)
  const bassMeterRef = useRef<HTMLDivElement>(null);
  const midsMeterRef = useRef<HTMLDivElement>(null);
  const highsMeterRef = useRef<HTMLDivElement>(null);

  // Blob URL registry for clean disposal
  const blobUrlsRef = useRef<Set<string>>(new Set());

  const currentTrack = useMemo(
    () => tracks.find((t) => t.id === currentTrackId) ?? null,
    [tracks, currentTrackId],
  );

  const activeModeMeta = useMemo(
    () => VISUALIZER_MODES.find((m) => m.id === settings.mode) ?? VISUALIZER_MODES[0],
    [settings.mode],
  );

  // Refs for callbacks accessed inside AudioEngine event handlers
  const handleTrackEndedRef = useRef<() => void>(() => {});

  // Initialize single AudioEngine instance
  useEffect(() => {
    const engine = new AudioEngine({
      onStateChange: (status, err) => {
        setAudioStatus(status);
        setAudioError(err ?? null);
      },
      onTimeUpdate: (cur, dur) => {
        setCurrentTime(cur);
        setDuration(dur);
      },
      onEnded: () => {
        handleTrackEndedRef.current();
      },
    });
    audioEngineRef.current = engine;

    // Pre-load the initial playable public-domain track in READY state (no autoplay until user clicks Play)
    const initialTrack = CURATED_CATALOG[0] ?? null;
    if (initialTrack && initialTrack.availability === 'playable') {
      engine.loadTrack(initialTrack);
    }

    const blobRegistry = blobUrlsRef.current;
    return () => {
      engine.dispose();
      audioEngineRef.current = null;
      blobRegistry.forEach((url) => URL.revokeObjectURL(url));
      blobRegistry.clear();
    };
  }, []);

  // Initialize Three.js VisualizerScene once in dedicated mount ref
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const sampleAudio = (sensitivity: number, out: AudioMetrics): AudioMetrics => {
      const engine = audioEngineRef.current;
      const metrics = engine
        ? engine.sampleMetrics(sensitivity, out)
        : out;

      // Update slim header frequency meters smoothly
      if (bassMeterRef.current) {
        bassMeterRef.current.style.height = `${Math.max(8, Math.min(100, Math.round(metrics.bass * 100)))}%`;
      }
      if (midsMeterRef.current) {
        midsMeterRef.current.style.height = `${Math.max(8, Math.min(100, Math.round(metrics.mids * 100)))}%`;
      }
      if (highsMeterRef.current) {
        highsMeterRef.current.style.height = `${Math.max(8, Math.min(100, Math.round(metrics.highs * 100)))}%`;
      }
      return metrics;
    };

    const scene = new VisualizerScene(container, settings, sampleAudio, {
      onContextLost: () => {
        setWebglError('WebGL rendering context was lost. Restoring...');
      },
      onContextRestored: () => {
        setWebglError(null);
      },
      onInitError: (msg) => {
        setWebglError(msg);
      },
    });

    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // Mount once; settings updates flow via sceneRef.current.updateSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync settings to Three.js scene and session preferences
  useEffect(() => {
    sceneRef.current?.updateSettings(settings);
    try {
      sessionStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore storage quota
    }
  }, [settings]);

  // Trigger resize on panel collapse/expand so 3D canvas expands smoothly into freed space
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      sceneRef.current?.handleResize();
    });
    return () => cancelAnimationFrame(id);
  }, [libraryOpen, controlsOpen]);

  // Fullscreen listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      sceneRef.current?.handleResize();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const updateSettings = useCallback((patch: Partial<VisualizerSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectTrack = useCallback(
    (track: Track, autoPlay = false) => {
      setCurrentTrackId(track.id);
      setAudioError(null);
      setCurrentTime(0);
      setDuration(0);

      const engine = audioEngineRef.current;
      if (!engine) return;

      engine.loadTrack(track);
      if (autoPlay && track.availability === 'playable') {
        void engine.play();
      }
    },
    [],
  );

  const handleTogglePlay = useCallback(() => {
    const engine = audioEngineRef.current;
    if (!engine || !currentTrack || currentTrack.availability !== 'playable') return;
    if (audioStatus === 'PLAYING') {
      engine.pause();
    } else {
      void engine.play();
    }
  }, [audioStatus, currentTrack]);

  const playableTracks = useMemo(
    () => tracks.filter((t) => t.availability === 'playable'),
    [tracks],
  );

  const navigateTrack = useCallback(
    (direction: 1 | -1) => {
      // Prefer queue if populated
      if (direction === 1 && queueIds.length > 0) {
        const nextId = queueIds[0];
        const nextTrack = tracks.find((t) => t.id === nextId);
        setQueueIds((prev) => prev.slice(1));
        if (nextTrack) {
          handleSelectTrack(nextTrack, nextTrack.availability === 'playable');
          return;
        }
      }

      const pool = playableTracks.length > 0 ? playableTracks : tracks;
      if (pool.length === 0) return;

      if (shuffle && pool.length > 1) {
        const candidates = pool.filter((t) => t.id !== currentTrackId);
        const pick = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
        handleSelectTrack(pick, pick.availability === 'playable');
        return;
      }

      const idx = pool.findIndex((t) => t.id === currentTrackId);
      const nextIdx =
        idx === -1 ? 0 : (idx + direction + pool.length) % pool.length;
      const target = pool[nextIdx];
      if (target) {
        handleSelectTrack(target, target.availability === 'playable');
      }
    },
    [currentTrackId, handleSelectTrack, playableTracks, queueIds, shuffle, tracks],
  );

  useEffect(() => {
    handleTrackEndedRef.current = () => {
      if (repeatMode === 'one' && currentTrack?.availability === 'playable') {
        audioEngineRef.current?.seek(0);
        void audioEngineRef.current?.play();
        return;
      }
      if (repeatMode === 'all' || queueIds.length > 0 || playableTracks.length > 1) {
        navigateTrack(1);
      }
    };
  }, [currentTrack, navigateTrack, playableTracks.length, queueIds.length, repeatMode]);

  const handleUploadFiles = useCallback(
    (fileList: FileList | File[], attachToTrackId?: string) => {
      setUploadError(null);
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const createdTracks: Track[] = [];
      for (const file of files) {
        const check = validateAudioFile(file);
        if (!check.valid) {
          setUploadError(check.reason ?? 'Unsupported audio file.');
          continue;
        }

        const blobUrl = URL.createObjectURL(file);
        blobUrlsRef.current.add(blobUrl);

        if (attachToTrackId) {
          let updatedTrack: Track | null = null;
          setTracks((prev) =>
            prev.map((t) => {
              if (t.id !== attachToTrackId) return t;
              updatedTrack = {
                ...t,
                sourceKind: 'local-file',
                availability: 'playable',
                sourceUrl: blobUrl,
                fileName: file.name,
                mimeType: file.type,
                errorMessage: undefined,
              };
              return updatedTrack;
            }),
          );
          if (updatedTrack) {
            handleSelectTrack(updatedTrack, true);
          }
          return;
        }

        const baseName = file.name.replace(/\.[^/.]+$/, '');
        const parts = baseName.split(' - ');
        const artist = parts.length > 1 ? parts[0].trim() : 'Local Upload';
        const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : baseName;

        const newTrack: Track = {
          id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title,
          artist,
          album: 'Local Session Audio',
          genre: 'Electronic',
          catalogDurationSec: null,
          sourceKind: 'local-file',
          availability: 'playable',
          sourceUrl: blobUrl,
          fileName: file.name,
          mimeType: file.type,
          isUserUploaded: true,
          artSeed: Math.floor(Math.random() * 900) + 200,
        };
        createdTracks.push(newTrack);
      }

      if (createdTracks.length > 0) {
        setTracks((prev) => [...createdTracks, ...prev]);
        // Auto-select & play the first newly uploaded track
        handleSelectTrack(createdTracks[0], true);
      }
    },
    [handleSelectTrack],
  );

  const handleAttachDirectUrl = useCallback(
    async (trackId: string | null, url: string, customTitle?: string) => {
      setUploadError(null);
      let parsed: URL;
      try {
        parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          setUploadError('Only http:// or https:// audio URLs are supported.');
          return;
        }
      } catch {
        setUploadError('Please enter a valid audio URL.');
        return;
      }

      const host = parsed.hostname.toLowerCase();
      const isYouTube =
        host === 'youtu.be' ||
        host.endsWith('youtube.com') ||
        host.endsWith('youtube-nocookie.com');

      if (isYouTube) {
        let detectedTitle: string | null = null;
        try {
          const oeRes = await fetch(
            `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
          );
          if (oeRes.ok) {
            const oe = (await oeRes.json()) as { title?: string };
            detectedTitle = oe.title ?? null;
          }
        } catch {
          // ignore oEmbed network failure
        }

        const searchText = (detectedTitle || customTitle || '').toLowerCase();
        const matchingPd = tracks.find(
          (t) =>
            t.availability === 'playable' &&
            t.isPublicDomain &&
            (searchText.includes('moonlight')
              ? searchText.includes('presto') ||
                searchText.includes('3rd') ||
                searchText.includes('iii')
                ? t.id === 'pd-moonlight-sonata-presto'
                : t.id === 'pd-moonlight-sonata-adagio'
              : searchText.includes('clair de lune')
              ? t.id.includes('clair-de-lune')
              : searchText.includes('spring') || searchText.includes('vivaldi')
              ? t.id.includes('spring')
              : searchText.includes('nocturne')
              ? t.id.includes('nocturne')
              : searchText.includes('figaro')
              ? t.id.includes('figaro')
              : searchText.includes('magic flute')
              ? t.id.includes('magic-flute')
              : searchText.includes('goldberg')
              ? t.id.includes('goldberg')
              : searchText.includes('vltava') || searchText.includes('moldau')
              ? t.id.includes('vltava')
              : false),
        );

        if (matchingPd) {
          handleSelectTrack(matchingPd, true);
          setUploadError(
            `YouTube links cannot stream raw audio directly into Web Audio API (browser CORS & YouTube stream restrictions). Loaded our unmodified studio Public Domain recording of "${matchingPd.title}" instead—or upload a local MP3/WAV/OGG file.`,
          );
        } else {
          setUploadError(
            `${detectedTitle ? `Detected YouTube video "${detectedTitle}". ` : ''}YouTube watch links cannot be decoded directly by browser Web Audio API (CORS & HTML page restrictions). Please upload a local MP3/WAV/OGG/FLAC file or provide a direct CORS-enabled audio URL.`,
          );
        }
        return;
      }

      if (trackId) {
        let updated: Track | null = null;
        setTracks((prev) =>
          prev.map((t) => {
            if (t.id !== trackId) return t;
            updated = {
              ...t,
              sourceKind: 'direct-url',
              availability: 'playable',
              sourceUrl: url,
              errorMessage: undefined,
            };
            return updated;
          }),
        );
        if (updated) {
          handleSelectTrack(updated, true);
        }
      } else {
        const fileName = url.split('/').pop()?.split('?')[0] || 'Audio Stream';
        const newTrack: Track = {
          id: `url-${Date.now()}`,
          title: customTitle || decodeURIComponent(fileName.replace(/\.[^/.]+$/, '')),
          artist: 'Direct Stream URL',
          album: parsed.hostname,
          genre: 'Electronic',
          catalogDurationSec: null,
          sourceKind: 'direct-url',
          availability: 'playable',
          sourceUrl: url,
          isUserUploaded: true,
          artSeed: Math.floor(Math.random() * 900) + 500,
        };
        setTracks((prev) => [newTrack, ...prev]);
        handleSelectTrack(newTrack, true);
      }
    },
    [handleSelectTrack, tracks],
  );

  const handleAddToQueue = useCallback((trackId: string) => {
    setQueueIds((prev) => (prev.includes(trackId) ? prev : [...prev, trackId]));
  }, []);

  const handleRemoveFromQueue = useCallback((trackId: string) => {
    setQueueIds((prev) => prev.filter((id) => id !== trackId));
  }, []);

  const handleCycleQuality = useCallback(() => {
    const order: QualityPreset[] = ['low', 'medium', 'high', 'ultra'];
    const next = order[(order.indexOf(settings.quality) + 1) % order.length];
    updateSettings({ quality: next });
  }, [settings.quality, updateSettings]);

  const handleToggleFullscreen = useCallback(() => {
    const el = appShellRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    } else {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  const handleToggleLibrary = useCallback(() => {
    setLibraryOpen((prev) => {
      const next = !prev;
      if (next) sceneRef.current?.triggerLibraryPulse();
      return next;
    });
  }, []);

  return (
    <div
      ref={appShellRef}
      className="flex h-screen w-screen flex-col overflow-hidden bg-[#05050B] text-[#F0F1FF]"
    >
      {/* Hidden input for quick-attaching local audio to current track from player bar */}
      <input
        ref={quickAttachRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleUploadFiles(e.target.files, currentTrack?.id);
            e.target.value = '';
          }
        }}
      />

      {/* Top Navigation Bar */}
      <Header
        activeMode={activeModeMeta}
        audioStatus={audioStatus}
        meterRefs={{
          bassRef: bassMeterRef,
          midsRef: midsMeterRef,
          highsRef: highsMeterRef,
        }}
        libraryOpen={libraryOpen}
        controlsOpen={controlsOpen}
        isFullscreen={isFullscreen}
        quality={settings.quality}
        onToggleLibrary={handleToggleLibrary}
        onToggleControls={() => setControlsOpen((p) => !p)}
        onCycleQuality={handleCycleQuality}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Main Three-Column Workspace (Left Library | Central 3D Stage | Right Visualiser Controls) */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <MusicLibraryPanel
          open={libraryOpen}
          tracks={tracks}
          queueIds={queueIds}
          currentTrack={currentTrack}
          audioStatus={audioStatus}
          searchQuery={searchQuery}
          activeGenre={activeGenre}
          uploadError={uploadError}
          onClose={() => setLibraryOpen(false)}
          onSearchChange={setSearchQuery}
          onGenreChange={setActiveGenre}
          onSelectTrack={handleSelectTrack}
          onUploadFiles={handleUploadFiles}
          onAttachDirectUrl={handleAttachDirectUrl}
          onAddToQueue={handleAddToQueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onClearUploadError={() => setUploadError(null)}
        />

        {/* Central 3D WebGL Stage */}
        <main className="relative min-w-0 flex-1 overflow-hidden bg-[#05050B]">
          {webglError ? (
            <WebGLFallback errorMessage={webglError} />
          ) : (
            <div
              ref={canvasContainerRef}
              className="h-full w-full cursor-grab active:cursor-grabbing"
              aria-label="Interactive 3D Music Visualiser Stage"
            />
          )}

          {/* Subtle non-intrusive mode + FX preview indicator at top-left of viewport */}
          {!webglError && (
            <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap items-center gap-2 text-[11px] text-[#8C91AE]">
              <span className="font-mono-tech text-[#F0F1FF]/85">
                {activeModeMeta.label}
              </span>
              {settings.visualFxPreviewEnabled && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tech text-[#FF3B9D]">
                    Visual FX Preview {settings.visualFxSpeedMultiplier}x (Audio at {audioPlaybackRate}x)
                  </span>
                </>
              )}
            </div>
          )}

          {/* Subtle camera hint at bottom-right of 3D stage */}
          {!webglError && (
            <div className="pointer-events-none absolute bottom-2.5 right-3 hidden sm:block text-[10px] text-[#8C91AE]/75">
              Drag to orbit · Scroll to zoom
            </div>
          )}
        </main>

        <VisualizerControlsPanel
          open={controlsOpen}
          settings={settings}
          onClose={() => setControlsOpen(false)}
          onUpdateSettings={updateSettings}
          onResetCamera={() => sceneRef.current?.resetCamera()}
        />
      </div>

      {/* Bottom Transport & Preview Player Bar */}
      <AudioPlayerBar
        currentTrack={currentTrack}
        status={audioStatus}
        errorMessage={audioError}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        muted={muted}
        shuffle={shuffle}
        repeatMode={repeatMode}
        seekIntervalSec={seekIntervalSec}
        audioPlaybackRate={audioPlaybackRate}
        visualFxPreviewEnabled={settings.visualFxPreviewEnabled}
        visualFxSpeedMultiplier={settings.visualFxSpeedMultiplier}
        onTogglePlay={handleTogglePlay}
        onPrev={() => navigateTrack(-1)}
        onNext={() => navigateTrack(1)}
        onSeek={(sec) => audioEngineRef.current?.seek(sec)}
        onSeekBy={(delta) => audioEngineRef.current?.seekBy(delta)}
        onChangeSeekInterval={setSeekIntervalSec}
        onVolumeChange={(v) => {
          setVolume(v);
          setMuted(v === 0);
          audioEngineRef.current?.setVolume(v);
          audioEngineRef.current?.setMuted(v === 0);
        }}
        onToggleMute={() => {
          const next = !muted;
          setMuted(next);
          audioEngineRef.current?.setMuted(next);
        }}
        onToggleShuffle={() => setShuffle((s) => !s)}
        onCycleRepeat={() =>
          setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
        }
        onChangeAudioPlaybackRate={(rate) => {
          setAudioPlaybackRate(rate);
          audioEngineRef.current?.setPlaybackRate(rate);
        }}
        onToggleVisualFxPreview={() =>
          updateSettings({ visualFxPreviewEnabled: !settings.visualFxPreviewEnabled })
        }
        onChangeVisualFxSpeed={(mult) =>
          updateSettings({ visualFxSpeedMultiplier: mult })
        }
        onAttachAudioClick={() => quickAttachRef.current?.click()}
      />
    </div>
  );
}
