import React, { useState } from 'react';
import {
  Camera,
  ChevronDown,
  ChevronRight,
  Cpu,
  Palette,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { COLOR_THEMES, QUALITY_CONFIGS, VISUALIZER_MODES } from '../data/themes';
import type {
  ColorPresetId,
  QualityPreset,
  VisualizerModeId,
  VisualizerSettings,
} from '../types/visualizer';

interface VisualizerControlsPanelProps {
  open: boolean;
  settings: VisualizerSettings;
  onClose: () => void;
  onUpdateSettings: (patch: Partial<VisualizerSettings>) => void;
  onResetCamera: () => void;
}

interface SliderRowProps {
  label: string;
  valueDisplay: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  valueDisplay,
  value,
  min,
  max,
  step,
  onChange,
}) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[#8C91AE]">{label}</span>
      <span className="font-mono-tech text-[#F0F1FF]">{valueDisplay}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label={label}
      className="cyber-range"
    />
  </div>
);

export const VisualizerControlsPanel: React.FC<VisualizerControlsPanelProps> = ({
  open,
  settings,
  onClose,
  onUpdateSettings,
  onResetCamera,
}) => {
  const [expanded, setExpanded] = useState({
    mode: true,
    camera: true,
    rendering: true,
    colour: true,
  });

  if (!open) return null;

  const toggleGroup = (key: keyof typeof expanded) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <aside
      aria-label="Visualiser Controls"
      className="fixed inset-y-12 right-0 z-30 flex w-[min(300px,86vw)] flex-col border-l border-white/10 bg-[#0B0B14]/94 lg:static lg:inset-auto lg:z-10 lg:w-72 lg:shrink-0"
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <div>
          <h2 className="font-display text-xs font-semibold uppercase tracking-[0.12em] text-[#F0F1FF]">
            Visualiser Controls
          </h2>
          <p className="text-[11px] text-[#8C91AE]">WebGL + 8×8 Bayer Shader</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-[#8C91AE] hover:text-[#F0F1FF] lg:hidden cursor-pointer"
          aria-label="Close controls panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="cyber-scroll flex-1 overflow-y-auto divide-y divide-white/10">
        {/* 1. VISUALISER MODE */}
        <section className="p-3">
          <button
            type="button"
            onClick={() => toggleGroup('mode')}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-[#F0F1FF]">
              <Sparkles className="h-3.5 w-3.5 text-[#51F5FF]" />
              <span>Visualiser Mode</span>
            </span>
            {expanded.mode ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#8C91AE]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#8C91AE]" />
            )}
          </button>

          {expanded.mode && (
            <div className="mt-2.5 grid grid-cols-2 gap-1.5">
              {VISUALIZER_MODES.map((m) => {
                const active = settings.mode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateSettings({ mode: m.id as VisualizerModeId })}
                    className={`rounded border px-2 py-2 text-left text-[11px] font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-[#51F5FF]/70 bg-[#51F5FF]/14 text-[#51F5FF]'
                        : 'border-white/10 bg-[#11111D]/80 text-[#8C91AE] hover:border-white/25 hover:text-[#F0F1FF]'
                    }`}
                    title={m.description}
                  >
                    <span className="block truncate">{m.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* 2. CAMERA */}
        <section className="p-3">
          <button
            type="button"
            onClick={() => toggleGroup('camera')}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-[#F0F1FF]">
              <Camera className="h-3.5 w-3.5 text-[#16D9D2]" />
              <span>Camera</span>
            </span>
            {expanded.camera ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#8C91AE]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#8C91AE]" />
            )}
          </button>

          {expanded.camera && (
            <div className="mt-2.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ cinematicCamera: !settings.cinematicCamera })
                  }
                  aria-pressed={settings.cinematicCamera}
                  className={`flex-1 rounded border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    settings.cinematicCamera
                      ? 'border-[#51F5FF]/60 bg-[#51F5FF]/14 text-[#51F5FF]'
                      : 'border-white/10 bg-[#11111D] text-[#8C91AE] hover:text-[#F0F1FF]'
                  }`}
                >
                  Cinematic Orbit: {settings.cinematicCamera ? 'On' : 'Off'}
                </button>
                <button
                  type="button"
                  onClick={onResetCamera}
                  className="flex items-center gap-1 rounded border border-white/10 bg-[#11111D] px-2.5 py-1.5 text-xs text-[#8C91AE] hover:border-white/25 hover:text-[#F0F1FF] transition-colors cursor-pointer"
                  title="Reset camera framing"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>

              <SliderRow
                label="Orbit Speed"
                valueDisplay={`${settings.cameraOrbitSpeed.toFixed(2)}x`}
                value={settings.cameraOrbitSpeed}
                min={0}
                max={2}
                step={0.05}
                onChange={(v) => onUpdateSettings({ cameraOrbitSpeed: v })}
              />

              <SliderRow
                label="Camera Distance"
                valueDisplay={settings.cameraDistance.toFixed(1)}
                value={settings.cameraDistance}
                min={4.5}
                max={18}
                step={0.1}
                onChange={(v) => onUpdateSettings({ cameraDistance: v })}
              />
            </div>
          )}
        </section>

        {/* 3. RENDERING & BAYER 8x8 DITHER */}
        <section className="p-3">
          <button
            type="button"
            onClick={() => toggleGroup('rendering')}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-[#F0F1FF]">
              <Cpu className="h-3.5 w-3.5 text-[#FF3B9D]" />
              <span>Dither & Rendering</span>
            </span>
            {expanded.rendering ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#8C91AE]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#8C91AE]" />
            )}
          </button>

          {expanded.rendering && (
            <div className="mt-2.5 space-y-2.5">
              {/* Quality Preset Selector */}
              <div className="space-y-1">
                <span className="text-[11px] text-[#8C91AE]">Quality Preset</span>
                <div className="grid grid-cols-4 gap-1">
                  {(Object.keys(QUALITY_CONFIGS) as QualityPreset[]).map((q) => {
                    const active = settings.quality === q;
                    return (
                      <button
                        key={q}
                        type="button"
                        onClick={() => onUpdateSettings({ quality: q })}
                        className={`rounded border py-1 text-[11px] font-medium capitalize transition-colors cursor-pointer ${
                          active
                            ? 'border-[#51F5FF]/60 bg-[#51F5FF]/14 text-[#51F5FF]'
                            : 'border-white/10 bg-[#11111D] text-[#8C91AE] hover:text-[#F0F1FF]'
                        }`}
                      >
                        {q}
                      </button>
                    );
                  })}
                </div>
              </div>

              <SliderRow
                label="Bayer 8×8 Dither Intensity"
                valueDisplay={`${Math.round(settings.ditherIntensity * 100)}%`}
                value={settings.ditherIntensity}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateSettings({ ditherIntensity: v })}
              />

              <SliderRow
                label="Color Quantization Levels"
                valueDisplay={`${settings.colorLevels}`}
                value={settings.colorLevels}
                min={2}
                max={32}
                step={1}
                onChange={(v) => onUpdateSettings({ colorLevels: v })}
              />

              <SliderRow
                label="Dither Pixel Scale"
                valueDisplay={`${settings.pixelScale}px`}
                value={settings.pixelScale}
                min={1}
                max={8}
                step={1}
                onChange={(v) => onUpdateSettings({ pixelScale: v })}
              />

              <SliderRow
                label="Bloom Intensity"
                valueDisplay={settings.bloomIntensity.toFixed(2)}
                value={settings.bloomIntensity}
                min={0}
                max={2.2}
                step={0.05}
                onChange={(v) => onUpdateSettings({ bloomIntensity: v })}
              />

              <SliderRow
                label="Glitch & Chromatic Pulse"
                valueDisplay={`${Math.round(settings.glitchIntensity * 100)}%`}
                value={settings.glitchIntensity}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => onUpdateSettings({ glitchIntensity: v })}
              />

              <SliderRow
                label="Particle Density"
                valueDisplay={`${Math.round(settings.particleDensity * 100)}%`}
                value={settings.particleDensity}
                min={0.2}
                max={1}
                step={0.05}
                onChange={(v) => onUpdateSettings({ particleDensity: v })}
              />

              <SliderRow
                label="Particle Size"
                valueDisplay={`${settings.particleSize.toFixed(2)}x`}
                value={settings.particleSize}
                min={0.5}
                max={2.5}
                step={0.05}
                onChange={(v) => onUpdateSettings({ particleSize: v })}
              />

              <SliderRow
                label="Particle Speed"
                valueDisplay={`${settings.particleSpeed.toFixed(2)}x`}
                value={settings.particleSpeed}
                min={0.2}
                max={3.0}
                step={0.05}
                onChange={(v) => onUpdateSettings({ particleSpeed: v })}
              />

              <SliderRow
                label="Audio Sensitivity"
                valueDisplay={`${settings.sensitivity.toFixed(2)}x`}
                value={settings.sensitivity}
                min={0.3}
                max={2.5}
                step={0.05}
                onChange={(v) => onUpdateSettings({ sensitivity: v })}
              />
            </div>
          )}
        </section>

        {/* 4. COLOUR THEME */}
        <section className="p-3">
          <button
            type="button"
            onClick={() => toggleGroup('colour')}
            className="flex w-full items-center justify-between text-left cursor-pointer"
          >
            <span className="flex items-center gap-1.5 font-display text-[11px] font-semibold uppercase tracking-wider text-[#F0F1FF]">
              <Palette className="h-3.5 w-3.5 text-[#712EFF]" />
              <span>Colour Theme</span>
            </span>
            {expanded.colour ? (
              <ChevronDown className="h-3.5 w-3.5 text-[#8C91AE]" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-[#8C91AE]" />
            )}
          </button>

          {expanded.colour && (
            <div className="mt-2.5 space-y-2">
              <div className="grid grid-cols-1 gap-1.5">
                {(Object.values(COLOR_THEMES)).map((preset) => {
                  const active = settings.colorPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({ colorPreset: preset.id as ColorPresetId })
                      }
                      className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                        active
                          ? 'border-[#51F5FF]/65 bg-[#51F5FF]/12 text-[#F0F1FF]'
                          : 'border-white/10 bg-[#11111D]/80 text-[#8C91AE] hover:text-[#F0F1FF]'
                      }`}
                    >
                      <span>{preset.name}</span>
                      <span className="flex items-center gap-1" aria-hidden="true">
                        <span
                          className="h-2.5 w-2.5 rounded-xs"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="h-2.5 w-2.5 rounded-xs"
                          style={{ backgroundColor: preset.secondary }}
                        />
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => onUpdateSettings({ colorPreset: 'custom' })}
                  className={`flex items-center justify-between rounded border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                    settings.colorPreset === 'custom'
                      ? 'border-[#51F5FF]/65 bg-[#51F5FF]/12 text-[#F0F1FF]'
                      : 'border-white/10 bg-[#11111D]/80 text-[#8C91AE] hover:text-[#F0F1FF]'
                  }`}
                >
                  <span>Custom Accent</span>
                  <span className="flex items-center gap-1" aria-hidden="true">
                    <span
                      className="h-2.5 w-2.5 rounded-xs"
                      style={{ backgroundColor: settings.customPrimary }}
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-xs"
                      style={{ backgroundColor: settings.customSecondary }}
                    />
                  </span>
                </button>
              </div>

              {settings.colorPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-[#11111D] p-2">
                  <label className="flex items-center justify-between gap-1.5 text-[11px] text-[#8C91AE]">
                    <span>Primary</span>
                    <input
                      type="color"
                      value={settings.customPrimary}
                      onChange={(e) => onUpdateSettings({ customPrimary: e.target.value })}
                      className="h-6 w-8 cursor-pointer rounded border border-white/15 bg-transparent"
                    />
                  </label>
                  <label className="flex items-center justify-between gap-1.5 text-[11px] text-[#8C91AE]">
                    <span>Secondary</span>
                    <input
                      type="color"
                      value={settings.customSecondary}
                      onChange={(e) => onUpdateSettings({ customSecondary: e.target.value })}
                      className="h-6 w-8 cursor-pointer rounded border border-white/15 bg-transparent"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
