import type {
  ColorPresetId,
  ColorTheme,
  QualityPreset,
  VisualizerModeMeta,
  VisualizerSettings,
} from '../types/visualizer';

export const VISUALIZER_MODES: VisualizerModeMeta[] = [
  {
    id: 'reactive-sphere',
    label: 'Reactive Sphere',
    shortLabel: 'Sphere',
    description: 'Harmonic wireframe lattice with orbital rings and radial transient ripples.',
  },
  {
    id: 'grid-bars',
    label: '3D Grid Bars',
    shortLabel: 'Grid Bars',
    description: '576-column architectural frequency matrix rising across a wide digital stage.',
  },
  {
    id: 'neon-tunnel',
    label: 'Neon Tunnel',
    shortLabel: 'Tunnel',
    description: 'Deep 75-unit megastructure tunnel with undulating portals and warp surge.',
  },
  {
    id: 'floating-cloud',
    label: 'Floating Cloud',
    shortLabel: 'Cloud',
    description: 'Expansive galactic particle vortex with dynamic constellation filaments.',
  },
  {
    id: 'digital-waveform',
    label: 'Digital Waveform',
    shortLabel: 'Waveform',
    description: 'Wide 3D signal mountain range derived directly from live audio samples.',
  },
  {
    id: 'cybernetic-core',
    label: 'Cybernetic Core',
    shortLabel: 'Core',
    description: 'Multi-axis megastructure reactor with 64 turbine blades and triple wave rings.',
  },
];

export const COLOR_THEMES: Record<Exclude<ColorPresetId, 'custom'>, ColorTheme> = {
  cyberpunk: {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    primary: '#51F5FF',
    secondary: '#FF3B9D',
    tertiary: '#712EFF',
    background: '#05050B',
    grid: '#16D9D2',
  },
  'cyan-magenta': {
    id: 'cyan-magenta',
    name: 'Cyan & Magenta',
    primary: '#16D9D2',
    secondary: '#FF3B9D',
    tertiary: '#426BFF',
    background: '#05050B',
    grid: '#51F5FF',
  },
  ultraviolet: {
    id: 'ultraviolet',
    name: 'Ultraviolet',
    primary: '#A855F7',
    secondary: '#FF3B9D',
    tertiary: '#426BFF',
    background: '#06040E',
    grid: '#712EFF',
  },
  'electric-blue': {
    id: 'electric-blue',
    name: 'Electric Blue',
    primary: '#426BFF',
    secondary: '#51F5FF',
    tertiary: '#16D9D2',
    background: '#040711',
    grid: '#426BFF',
  },
  'monochrome-phosphor': {
    id: 'monochrome-phosphor',
    name: 'Monochrome Phosphor',
    primary: '#51F5FF',
    secondary: '#9AF9FF',
    tertiary: '#16D9D2',
    background: '#04080A',
    grid: '#16D9D2',
  },
};

export interface QualityConfig {
  label: string;
  pixelRatioCap: number;
  maxParticles: number;
  bloomEnabled: boolean;
  sphereSubdivisions: number;
  cloudCount: number;
}

export const QUALITY_CONFIGS: Record<QualityPreset, QualityConfig> = {
  low: {
    label: 'Low',
    pixelRatioCap: 1.0,
    maxParticles: 320,
    bloomEnabled: false,
    sphereSubdivisions: 3,
    cloudCount: 700,
  },
  medium: {
    label: 'Medium',
    pixelRatioCap: 1.5,
    maxParticles: 650,
    bloomEnabled: true,
    sphereSubdivisions: 4,
    cloudCount: 1400,
  },
  high: {
    label: 'High',
    pixelRatioCap: 2.0,
    maxParticles: 1100,
    bloomEnabled: true,
    sphereSubdivisions: 4,
    cloudCount: 2200,
  },
  ultra: {
    label: 'Ultra',
    pixelRatioCap: 2.5,
    maxParticles: 1600,
    bloomEnabled: true,
    sphereSubdivisions: 5,
    cloudCount: 3000,
  },
};

export const DEFAULT_SETTINGS: VisualizerSettings = {
  mode: 'reactive-sphere',
  colorPreset: 'cyberpunk',
  customPrimary: '#51F5FF',
  customSecondary: '#FF3B9D',
  quality: 'high',
  cinematicCamera: true,
  cameraOrbitSpeed: 0.42,
  cameraDistance: 12.2,
  ditherIntensity: 0.35,
  colorLevels: 16,
  pixelScale: 1,
  bloomIntensity: 0.32,
  glitchIntensity: 0.14,
  particleDensity: 0.85,
  particleSize: 1.0,
  particleSpeed: 1.0,
  sensitivity: 1.1,
  visualFxPreviewEnabled: false,
  visualFxSpeedMultiplier: 2.0,
};

export function resolveColorTheme(settings: VisualizerSettings): ColorTheme {
  if (settings.colorPreset === 'custom') {
    return {
      id: 'custom',
      name: 'Custom Accent',
      primary: settings.customPrimary,
      secondary: settings.customSecondary,
      tertiary: '#712EFF',
      background: '#05050B',
      grid: settings.customPrimary,
    };
  }
  return COLOR_THEMES[settings.colorPreset];
}
