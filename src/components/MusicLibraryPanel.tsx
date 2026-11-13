import React, { useRef, useState } from 'react';
import {
  ExternalLink,
  Link2,
  ListMusic,
  Pause,
  Play,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type {
  AudioPlaybackStatus,
  GenreCategory,
  Track,
} from '../types/visualizer';
import { formatTime } from './AudioPlayerBar';
import { CoverArt } from './CoverArt';

interface MusicLibraryPanelProps {
  open: boolean;
  tracks: Track[];
  queueIds: string[];
  currentTrack: Track | null;
  audioStatus: AudioPlaybackStatus;
  searchQuery: string;
  activeGenre: GenreCategory;
  uploadError: string | null;
  onClose: () => void;
  onSearchChange: (q: string) => void;
  onGenreChange: (g: GenreCategory) => void;
  onSelectTrack: (track: Track, autoPlay?: boolean) => void;
  onUploadFiles: (files: FileList | File[], attachToTrackId?: string) => void;
  onAttachDirectUrl: (trackId: string | null, url: string, title?: string, artist?: string) => void;
  onAddToQueue: (trackId: string) => void;
  onRemoveFromQueue: (trackId: string) => void;
  onClearUploadError: () => void;
}

const GENRES: GenreCategory[] = [
  'All Songs',
  'Playable',
  'Public Domain',
  'Uploaded',
  'Trending',
  'Classical',
  'Electronic',
  'Ambient',
  'Pop',
  'Hip-Hop',
  'Indie',
  'Rock',
];

export const MusicLibraryPanel: React.FC<MusicLibraryPanelProps> = ({
  open,
  tracks,
  queueIds,
  currentTrack,
  audioStatus,
  searchQuery,
  activeGenre,
  uploadError,
  onClose,
  onSearchChange,
  onGenreChange,
  onSelectTrack,
  onUploadFiles,
  onAttachDirectUrl,
  onAddToQueue,
  onRemoveFromQueue,
  onClearUploadError,
}) => {
  const [bottomTab, setBottomTab] = useState<'current' | 'queue'>('current');
  const [dragActive, setDragActive] = useState(false);
  const [urlFormTargetId, setUrlFormTargetId] = useState<string | null | undefined>(undefined);
  const [urlInput, setUrlInput] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [attachTargetId, setAttachTargetId] = useState<string | null>(null);

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);

  const filteredTracks = tracks.filter((t) => {
    const matchesGenre =
      activeGenre === 'All Songs'
        ? true
        : activeGenre === 'Playable'
        ? t.availability === 'playable'
        : activeGenre === 'Public Domain'
        ? Boolean(t.isPublicDomain)
        : activeGenre === 'Uploaded'
        ? Boolean(t.isUserUploaded || t.sourceKind === 'local-file' || t.sourceKind === 'direct-url')
        : activeGenre === 'Trending'
        ? Boolean(t.trending)
        : t.genre === activeGenre;

    if (!matchesGenre) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q)
    );
  });

  const queuedTracks = queueIds
    .map((id) => tracks.find((t) => t.id === id))
    .filter((t): t is Track => Boolean(t));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    onAttachDirectUrl(
      urlFormTargetId ?? null,
      trimmed,
      urlTitle.trim() || undefined,
    );
    setUrlInput('');
    setUrlTitle('');
    setUrlFormTargetId(undefined);
  };

  if (!open) return null;

  return (
    <aside
      aria-label="Music Library"
      className="fixed inset-y-12 left-0 z-30 flex w-[min(320px,88vw)] flex-col border-r border-white/10 bg-[#0B0B14]/94 lg:static lg:inset-auto lg:z-10 lg:w-80 lg:shrink-0"
    >
      {/* Hidden file inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onUploadFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />
      <input
        ref={attachInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.webm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0 && attachTargetId) {
            onUploadFiles(e.target.files, attachTargetId);
            e.target.value = '';
            setAttachTargetId(null);
          }
        }}
      />

      {/* Section Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <div>
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#F0F1FF]">
            Music Library
          </h2>
          <p className="text-[11px] text-[#8C91AE]">
            {tracks.filter((t) => t.availability === 'playable').length} playable
            <span aria-hidden="true"> · </span>
            {tracks.length} total
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#8C91AE] hover:text-[#F0F1FF] lg:hidden cursor-pointer"
          aria-label="Close library panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Upload Your Own Track & Direct URL Actions */}
      <div className="border-b border-white/10 p-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          className={`rounded border border-dashed p-2.5 transition-colors ${
            dragActive
              ? 'border-[#51F5FF] bg-[#51F5FF]/10'
              : 'border-white/15 bg-[#11111D]/70'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded border border-[#51F5FF]/45 bg-[#51F5FF]/12 px-2.5 py-1.5 text-xs font-medium text-[#51F5FF] hover:bg-[#51F5FF]/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload Audio</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setUrlFormTargetId(urlFormTargetId === undefined ? null : undefined)
              }
              className="flex items-center gap-1 rounded border border-white/12 bg-[#0B0B14] px-2.5 py-1.5 text-xs text-[#8C91AE] hover:text-[#F0F1FF] hover:border-white/25 transition-colors cursor-pointer whitespace-nowrap"
              title="Add a permitted direct audio URL (CORS-enabled MP3/WAV/OGG)"
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>URL</span>
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#8C91AE]">
            Drop MP3, WAV, OGG, M4A, or FLAC here. Decoded locally in-browser—never uploaded to a server.
          </p>
        </div>

        {uploadError && (
          <div className="mt-2 flex items-start justify-between gap-2 rounded border border-[#FF3B9D]/45 bg-[#FF3B9D]/10 px-2.5 py-1.5 text-[11px] text-[#F0F1FF]">
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={onClearUploadError}
              className="text-[#8C91AE] hover:text-[#F0F1FF] cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {urlFormTargetId !== undefined && (
          <form onSubmit={handleSubmitUrl} className="mt-2 space-y-1.5 rounded border border-white/12 bg-[#11111D] p-2">
            {urlFormTargetId === null && (
              <input
                type="text"
                value={urlTitle}
                onChange={(e) => setUrlTitle(e.target.value)}
                placeholder="Track title (optional)"
                className="w-full rounded border border-white/10 bg-[#05050B] px-2 py-1 text-xs text-[#F0F1FF] placeholder-[#8C91AE]/60 outline-none focus:border-[#51F5FF]"
              />
            )}
            <div className="flex gap-1.5">
              <input
                type="url"
                required
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Direct .mp3/.wav/.ogg URL (or YouTube lookup)"
                className="min-w-0 flex-1 rounded border border-white/10 bg-[#05050B] px-2 py-1 text-xs text-[#F0F1FF] placeholder-[#8C91AE]/60 outline-none focus:border-[#51F5FF]"
              />
              <button
                type="submit"
                className="rounded border border-[#51F5FF]/50 bg-[#51F5FF]/15 px-2.5 py-1 text-xs font-medium text-[#51F5FF] hover:bg-[#51F5FF]/25 cursor-pointer"
              >
                Load
              </button>
            </div>
          </form>
        )}

        {/* Search Field */}
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8C91AE]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search songs or artists..."
            aria-label="Search songs or artists"
            className="w-full rounded border border-white/10 bg-[#11111D] py-1.5 pl-8 pr-7 text-xs text-[#F0F1FF] placeholder-[#8C91AE]/70 outline-none focus:border-[#51F5FF]/70"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8C91AE] hover:text-[#F0F1FF] cursor-pointer"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Genre Filter Tabs */}
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1 cyber-scroll">
          {GENRES.map((genre) => {
            const active = activeGenre === genre;
            return (
              <button
                key={genre}
                type="button"
                onClick={() => onGenreChange(genre)}
                className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                  active
                    ? 'border-[#51F5FF]/55 bg-[#51F5FF]/14 text-[#51F5FF]'
                    : 'border-transparent bg-[#11111D]/80 text-[#8C91AE] hover:text-[#F0F1FF]'
                }`}
              >
                {genre}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Song List */}
      <div className="cyber-scroll flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filteredTracks.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-xs font-medium text-[#F0F1FF]">No matching tracks</p>
            <p className="mt-1 text-[11px] text-[#8C91AE]">
              {activeGenre === 'Uploaded'
                ? 'Upload a local MP3, WAV, or OGG file above to build your playable session library.'
                : 'Try clearing the search query or switching genre filters.'}
            </p>
          </div>
        ) : (
          filteredTracks.map((track) => {
            const isSelected = currentTrack?.id === track.id;
            const isPlaying = isSelected && audioStatus === 'PLAYING';
            const isPlayable = track.availability === 'playable';

            return (
              <div
                key={track.id}
                onClick={() => onSelectTrack(track, isPlayable)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectTrack(track, isPlayable);
                  }
                }}
                className={`group flex items-center gap-2.5 rounded border px-2 py-2 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#51F5FF]/50 bg-[#51F5FF]/10'
                    : 'border-transparent hover:border-white/12 hover:bg-[#11111D]/80'
                }`}
              >
                <div className="relative">
                  <CoverArt track={track} isPlaying={isPlaying} />
                  <span
                    className={`absolute inset-0 flex items-center justify-center rounded bg-black/55 transition-opacity ${
                      isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isPlaying ? (
                      <Pause className="h-3.5 w-3.5 text-[#51F5FF]" />
                    ) : isPlayable ? (
                      <Play className="h-3.5 w-3.5 text-[#51F5FF]" />
                    ) : (
                      <Upload className="h-3.5 w-3.5 text-[#FF3B9D]" />
                    )}
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5">
                    <p
                      className={`truncate text-xs font-semibold ${
                        isSelected ? 'text-[#51F5FF]' : 'text-[#F0F1FF]'
                      }`}
                    >
                      {track.title}
                    </p>
                    {track.catalogDurationSec !== null && (
                      <span className="font-mono-tech shrink-0 text-[10px] text-[#8C91AE]">
                        {formatTime(track.catalogDurationSec)}
                      </span>
                    )}
                  </div>

                  <p className="truncate text-[11px] text-[#8C91AE]">
                    {track.artist}
                  </p>

                  {/* Zero-Pill static metadata */}
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#8C91AE]">
                    <span>{track.genre}</span>
                    <span aria-hidden="true">·</span>
                    <span className={isPlayable ? 'text-[#16D9D2]' : 'text-[#8C91AE]'}>
                      {isPlayable
                        ? track.sourceKind === 'public-domain'
                          ? 'Public Domain · Playable'
                          : track.sourceKind === 'local-file'
                          ? 'Local File'
                          : 'Stream Ready'
                        : 'Source Needed'}
                    </span>
                  </div>
                </div>

                {/* Quick Row Actions */}
                <div
                  className="flex items-center gap-1 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  {!isPlayable && (
                    <button
                      type="button"
                      onClick={() => {
                        setAttachTargetId(track.id);
                        attachInputRef.current?.click();
                      }}
                      className="rounded border border-white/10 bg-[#0B0B14] p-1 text-[#8C91AE] hover:border-[#51F5FF]/50 hover:text-[#51F5FF] transition-colors cursor-pointer"
                      title={`Attach local audio file to "${track.title}"`}
                      aria-label={`Attach local audio file to ${track.title}`}
                    >
                      <Upload className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onAddToQueue(track.id)}
                    className="rounded border border-white/10 bg-[#0B0B14] p-1 text-[#8C91AE] hover:border-[#FF3B9D]/50 hover:text-[#FF3B9D] transition-colors cursor-pointer"
                    title={`Add "${track.title}" to queue`}
                    aria-label={`Add ${track.title} to queue`}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Section: Current Track & Queue */}
      <div className="border-t border-white/10 bg-[#080810] p-3">
        <div className="mb-2 flex items-center gap-1 border-b border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setBottomTab('current')}
            className={`rounded px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              bottomTab === 'current'
                ? 'bg-[#51F5FF]/14 text-[#51F5FF]'
                : 'text-[#8C91AE] hover:text-[#F0F1FF]'
            }`}
          >
            Current Track
          </button>
          <button
            type="button"
            onClick={() => setBottomTab('queue')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              bottomTab === 'queue'
                ? 'bg-[#51F5FF]/14 text-[#51F5FF]'
                : 'text-[#8C91AE] hover:text-[#F0F1FF]'
            }`}
          >
            <ListMusic className="h-3 w-3" />
            <span>Queue ({queuedTracks.length})</span>
          </button>
        </div>

        {bottomTab === 'current' ? (
          currentTrack ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <CoverArt
                  track={currentTrack}
                  size="md"
                  isPlaying={audioStatus === 'PLAYING'}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-[#F0F1FF]">
                    {currentTrack.title}
                  </p>
                  <p className="truncate text-[11px] text-[#8C91AE]">
                    {currentTrack.artist}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-[#8C91AE]">
                    {currentTrack.album}
                    {currentTrack.year ? ` · ${currentTrack.year}` : ''}
                  </p>
                </div>
              </div>

              {currentTrack.availability !== 'playable' ? (
                <div className="rounded border border-white/10 bg-[#11111D] p-2 text-[11px] text-[#8C91AE]">
                  <p className="text-[#F0F1FF] font-medium">
                    Audio source required for playback
                  </p>
                  <p className="mt-0.5 text-[10px]">
                    Attach a local MP3/WAV/OGG file or open on an external service:
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAttachTargetId(currentTrack.id);
                        attachInputRef.current?.click();
                      }}
                      className="rounded border border-[#51F5FF]/50 bg-[#51F5FF]/12 px-2 py-1 text-[11px] font-medium text-[#51F5FF] hover:bg-[#51F5FF]/20 cursor-pointer"
                    >
                      Attach File
                    </button>
                    <button
                      type="button"
                      onClick={() => setUrlFormTargetId(currentTrack.id)}
                      className="rounded border border-white/12 bg-[#0B0B14] px-2 py-1 text-[11px] text-[#8C91AE] hover:text-[#F0F1FF] cursor-pointer"
                    >
                      Link URL
                    </button>
                    {currentTrack.externalLinks && (
                      <a
                        href={currentTrack.externalLinks.spotify}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded border border-white/12 bg-[#0B0B14] px-2 py-1 text-[11px] text-[#8C91AE] hover:text-[#16D9D2]"
                      >
                        <span>Spotify</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-[11px] text-[#16D9D2]">
                  <span className="truncate">
                    {currentTrack.sourceKind === 'public-domain'
                      ? 'Public Domain Recording · Ready'
                      : `Source: ${currentTrack.fileName || currentTrack.sourceUrl}`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-[#8C91AE]">
              No track selected. Choose any song above or upload an audio file.
            </p>
          )
        ) : (
          <div className="cyber-scroll max-h-36 space-y-1 overflow-y-auto">
            {queuedTracks.length === 0 ? (
              <p className="py-2 text-[11px] text-[#8C91AE]">
                Queue is empty. Click + on any track to queue it.
              </p>
            ) : (
              queuedTracks.map((qt, idx) => (
                <div
                  key={qt.id}
                  className="flex items-center justify-between gap-2 rounded border border-white/5 bg-[#11111D]/60 px-2 py-1 text-[11px]"
                >
                  <button
                    type="button"
                    onClick={() => onSelectTrack(qt, qt.availability === 'playable')}
                    className="min-w-0 flex-1 text-left truncate text-[#F0F1FF] hover:text-[#51F5FF] cursor-pointer"
                  >
                    <span className="font-mono-tech mr-1.5 text-[10px] text-[#8C91AE]">
                      {idx + 1}.
                    </span>
                    {qt.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveFromQueue(qt.id)}
                    className="text-[#8C91AE] hover:text-[#FF3B9D] cursor-pointer"
                    aria-label={`Remove ${qt.title} from queue`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
