# CYBER DITHER — 3D Audio-Reactive Music Visualiser

CYBER DITHER is a browser-based 3D music visualiser built with **React**, **TypeScript**, **Vite**, **Three.js**, and the **Web Audio API**. It combines real-time FFT and time-domain audio analysis with a custom **8×8 Bayer ordered-dithering post-processing shader** and six distinct WebGL visualiser modes.

## Key Features

- **Six Real-Time 3D Visualiser Modes**
  - **Reactive Sphere**: Deformed geodesic wireframe shader with spherical harmonics, inner Fresnel core, orbital rings, and radial transient ripples.
  - **3D Grid Bars**: 256 instanced frequency-mapped vertical bars rising from a digital floor.
  - **Neon Tunnel**: Depth-streaming octagonal frames driven by bass velocity and high-frequency shimmer.
  - **Floating Cloud**: Volumetric 3D particle nebula with harmonic constellation lines.
  - **Digital Waveform**: Stacked time-domain signal ribbons derived directly from `AnalyserNode` waveform samples.
  - **Cybernetic Core**: Multi-axis counter-rotating gimbal cages, pulsing core, radial turbine blades, and equatorial waveform.
- **True 8×8 Bayer Ordered Dithering**: Custom GLSL post-processing shader pass (`BayerDitherShader`) with adjustable dither intensity, colour quantisation levels (2–32), pixel scale (1–8 px), subtle CRT scanlines, and transient RGB chromatic aberration.
- **Curated Music Library & Local Audio Upload**:
  - Searchable, genre-filterable popular song catalogue with truthful audio availability states (`Source Needed` vs `Local File` / `Stream Ready`).
  - Client-side audio upload (`MP3`, `WAV`, `OGG`, `M4A`, `FLAC`, `AAC`, `WebM`) decoded directly in the browser—no local files are uploaded to any server.
  - Permitted direct stream URL support and external listening links.
- **Player & Dual Speed Controls**:
  - Play/pause, seekable progress bar, configurable fast-forward/rewind (`5s / 10s / 15s / 30s`), volume, mute, shuffle, repeat, and queue management.
  - **Audio Speed (`playbackRate`)** adjusts actual audio playback speed (`0.75×–2.0×`).
  - **Visual FX Preview** accelerates 3D particle and shader motion (`1.5×–3.0×`) independently without altering audio playback speed.

## Project Structure

```text
├── .github/workflows/
│   └── ci-deploy.yml          # CI lint/typecheck/build + optional GitHub Pages deploy
├── src/
│   ├── audio/
│   │   └── AudioEngine.ts     # Single AudioContext + AnalyserNode + transient detector
│   ├── components/
│   │   ├── AudioPlayerBar.tsx # Transport, progress seek, fast-forward, FX preview, volume
│   │   ├── CoverArt.tsx       # Deterministic procedural SVG track artwork
│   │   ├── Header.tsx         # Top navigation bar + live Bass/Mid/High meters
│   │   ├── MusicLibraryPanel.tsx
│   │   ├── VisualizerControlsPanel.tsx
│   │   └── WebGLFallback.tsx
│   ├── data/
│   │   ├── catalog.ts         # Deduplicated popular song metadata catalogue
│   │   └── themes.ts          # Visualiser modes, colour themes, quality presets
│   ├── three/
│   │   ├── modes/             # 6 modular Three.js visualiser mode implementations
│   │   ├── BackgroundEnvironment.ts
│   │   ├── BayerDitherShader.ts
│   │   └── VisualizerScene.ts # Renderer, EffectComposer, camera, quality management
│   ├── types/
│   │   └── visualizer.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
└── vite.config.ts
```

## Local Development

Prerequisites: Node.js 20+ and npm.

```bash
# 1. Install dependencies
npm install

# 2. Start the local Vite development server (port 3000)
npm run dev

# 3. Run TypeScript type checks
npm run lint

# 4. Build for production
npm run build

# 5. Preview the production build locally
npm run preview
```

The application runs completely locally without requiring GitHub credentials or external API keys.

## GitHub Actions & GitHub Pages Deployment

The included workflow at `.github/workflows/ci-deploy.yml` runs on pushes and pull requests to `main`:

1. Installs dependencies via `npm ci`.
2. Runs `npm run lint` (`tsc --noEmit`).
3. Builds the Vite bundle via `npm run build` and fails the workflow if linting or building fails.

### Enabling Optional GitHub Pages Deployment

To deploy the production `dist/` output to GitHub Pages:

1. Push this repository to GitHub with `main` as the default branch.
2. In your GitHub repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Go to **Settings → Secrets and variables → Actions → Variables** and create a repository variable:
   - Name: `ENABLE_PAGES`
   - Value: `true`
4. Push to `main` (or trigger the workflow via **Actions → Run workflow**).

When `ENABLE_PAGES` is `true`, the workflow automatically sets `VITE_BASE_PATH=/<repository-name>/` so `vite.config.ts` resolves all assets cleanly under your GitHub Pages subpath. Note that deployment is only operational once your repository permissions, Pages source, and `ENABLE_PAGES` variable are configured and the workflow completes successfully.
