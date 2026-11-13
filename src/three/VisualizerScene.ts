import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { QUALITY_CONFIGS, resolveColorTheme } from '../data/themes';
import type { AudioMetrics, VisualizerModeId, VisualizerSettings } from '../types/visualizer';
import { BackgroundEnvironment } from './BackgroundEnvironment';
import { BayerDitherShader, createBayer8x8Texture } from './BayerDitherShader';
import { CyberneticCoreMode } from './modes/CyberneticCoreMode';
import { DigitalWaveformMode } from './modes/DigitalWaveformMode';
import { FloatingCloudMode } from './modes/FloatingCloudMode';
import { GridBarsMode } from './modes/GridBarsMode';
import { NeonTunnelMode } from './modes/NeonTunnelMode';
import { ReactiveSphereMode, type VisualizerModeInstance } from './modes/ReactiveSphereMode';

const _targetVec = new THREE.Vector3(0, 0, 0);

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export interface VisualizerSceneCallbacks {
  onContextLost?: () => void;
  onContextRestored?: () => void;
  onInitError?: (message: string) => void;
}

/**
 * Self-contained Three.js scene controller with:
 * - Software WebGL guard + afterDraw pacing
 * - EffectComposer (RenderPass -> UnrealBloomPass -> BayerDitherPass -> OutputPass)
 * - Cinematic Camera + OrbitControls with smooth yielding & reset
 * - Smooth visual transitions between all 6 visualiser modes
 */
export class VisualizerScene {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private composer!: EffectComposer;
  private bloomPass!: UnrealBloomPass;
  private ditherPass!: ShaderPass;
  private bayerTex!: THREE.DataTexture;

  private isSoftwareGl = false;
  private frameId = 0;
  private lastTimeMs = 0;
  private visualElapsed = 0;
  private disposed = false;

  private background!: BackgroundEnvironment;
  private modes!: Record<VisualizerModeId, VisualizerModeInstance>;
  private activeModeId: VisualizerModeId;
  private modeTransitionProgress = 1;
  private libraryOpenImpulse = 0;

  private settings: VisualizerSettings;
  private sampleAudio: (sensitivity: number, out: AudioMetrics) => AudioMetrics;
  private callbacks: VisualizerSceneCallbacks;

  private audioMetrics: AudioMetrics = {
    bass: 0,
    mids: 0,
    highs: 0,
    overall: 0,
    transient: 0,
    tension: 0,
    release: 0,
    isBeat: false,
    waveform: new Float32Array(128),
    spectrum: new Float32Array(64),
    isActiveSignal: false,
  };

  private userInteracting = false;
  private manualOverrideTimer = 0;
  private orbitAngle = 0;
  private resizeObserver: ResizeObserver | null = null;
  private currentQualityMaxParticles = 1100;

  constructor(
    container: HTMLElement,
    initialSettings: VisualizerSettings,
    sampleAudio: (sensitivity: number, out: AudioMetrics) => AudioMetrics,
    callbacks: VisualizerSceneCallbacks = {},
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.activeModeId = initialSettings.mode;
    this.sampleAudio = sampleAudio;
    this.callbacks = callbacks;

    this.init();
  }

  private init() {
    try {
      const width = Math.max(1, this.container.clientWidth);
      const height = Math.max(1, this.container.clientHeight);

      this.isSoftwareGl = detectSoftwareWebGL();
      const qCfg = QUALITY_CONFIGS[this.settings.quality];
      this.currentQualityMaxParticles = qCfg.maxParticles;

      this.renderer = new THREE.WebGLRenderer({
        antialias: !this.isSoftwareGl,
        powerPreference: 'high-performance',
      });
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.08;
      this.renderer.setPixelRatio(
        this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, qCfg.pixelRatioCap),
      );
      this.renderer.setSize(width, height);
      this.renderer.domElement.style.display = 'block';
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';

      this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

      this.container.appendChild(this.renderer.domElement);

      this.scene = new THREE.Scene();
      const theme = resolveColorTheme(this.settings);
      this.scene.background = new THREE.Color(theme.background);
      this.scene.fog = new THREE.FogExp2(theme.background, 0.0085);

      this.camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 180);
      this.camera.position.set(0, 2.2, this.settings.cameraDistance);

      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = !this.isSoftwareGl;
      this.controls.dampingFactor = 0.055;
      this.controls.enablePan = false;
      this.controls.minDistance = 5.0;
      this.controls.maxDistance = 28.0;
      this.controls.target.copy(_targetVec);

      this.controls.addEventListener('start', () => {
        this.userInteracting = true;
        this.manualOverrideTimer = 3.5;
      });
      this.controls.addEventListener('end', () => {
        this.userInteracting = false;
      });

      // Background & 6 visualiser modes
      this.background = new BackgroundEnvironment(1600);
      this.scene.add(this.background.group);

      this.modes = {
        'reactive-sphere': new ReactiveSphereMode(qCfg.sphereSubdivisions),
        'grid-bars': new GridBarsMode(),
        'neon-tunnel': new NeonTunnelMode(),
        'floating-cloud': new FloatingCloudMode(qCfg.cloudCount),
        'digital-waveform': new DigitalWaveformMode(),
        'cybernetic-core': new CyberneticCoreMode(),
      };

      (Object.keys(this.modes) as VisualizerModeId[]).forEach((id) => {
        const mode = this.modes[id];
        mode.group.visible = id === this.activeModeId;
        mode.setTheme(theme);
        this.scene.add(mode.group);
      });
      this.background.setTheme(theme);

      // Post-processing pipeline: 4x MSAA HalfFloat HDR target -> tight Bloom -> 8x8 Bayer Dither -> Output
      const pixelRatio = this.renderer.getPixelRatio();
      const renderTarget = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(width * pixelRatio)),
        Math.max(1, Math.floor(height * pixelRatio)),
        {
          type: THREE.HalfFloatType,
          samples: this.isSoftwareGl ? 0 : 4,
        },
      );
      this.composer = new EffectComposer(this.renderer, renderTarget);
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);

      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(width, height),
        this.settings.bloomIntensity,
        0.22,
        0.78,
      );
      this.bloomPass.enabled = !this.isSoftwareGl && qCfg.bloomEnabled && this.settings.bloomIntensity > 0.02;
      this.composer.addPass(this.bloomPass);

      this.bayerTex = createBayer8x8Texture();
      this.ditherPass = new ShaderPass(BayerDitherShader);
      this.ditherPass.uniforms.tBayer.value = this.bayerTex;
      this.syncShaderUniforms(width, height);
      this.composer.addPass(this.ditherPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);

      if (!this.isSoftwareGl) {
        this.renderer.compile(this.scene, this.camera);
      }

      this.resizeObserver = new ResizeObserver(() => this.handleResize());
      this.resizeObserver.observe(this.container);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);

      this.lastTimeMs = performance.now();
      this.scheduleNextTick();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'WebGL initialization failed.';
      this.callbacks.onInitError?.(msg);
    }
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost?.();
  };

  private handleContextRestored = () => {
    this.callbacks.onContextRestored?.();
  };

  private handleVisibilityChange = () => {
    if (!document.hidden && !this.disposed) {
      this.lastTimeMs = performance.now();
    }
  };

  private syncShaderUniforms(width: number, height: number) {
    const pixelRatio = this.renderer.getPixelRatio();
    this.ditherPass.uniforms.uResolution.value.set(width * pixelRatio, height * pixelRatio);
    this.ditherPass.uniforms.uDitherIntensity.value = this.settings.ditherIntensity;
    this.ditherPass.uniforms.uColorLevels.value = this.settings.colorLevels;
    this.ditherPass.uniforms.uPixelScale.value = this.settings.pixelScale;
    this.ditherPass.uniforms.uGlitchIntensity.value = this.settings.glitchIntensity;
  }

  public updateSettings(next: VisualizerSettings) {
    const prev = this.settings;
    this.settings = { ...next };

    // Theme changes
    if (
      prev.colorPreset !== next.colorPreset ||
      prev.customPrimary !== next.customPrimary ||
      prev.customSecondary !== next.customSecondary
    ) {
      const theme = resolveColorTheme(next);
      this.scene.background = new THREE.Color(theme.background);
      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.set(theme.background);
      }
      this.background.setTheme(theme);
      (Object.values(this.modes) as VisualizerModeInstance[]).forEach((m) => m.setTheme(theme));
    }

    // Quality changes
    if (prev.quality !== next.quality) {
      const qCfg = QUALITY_CONFIGS[next.quality];
      this.currentQualityMaxParticles = qCfg.maxParticles;
      const nextRatio = this.isSoftwareGl
        ? 1
        : Math.min(window.devicePixelRatio || 1, qCfg.pixelRatioCap);
      this.renderer.setPixelRatio(nextRatio);
      this.composer.setPixelRatio(nextRatio);
      this.handleResize();
    }

    // Mode transition
    if (prev.mode !== next.mode) {
      (Object.keys(this.modes) as VisualizerModeId[]).forEach((id) => {
        this.modes[id].group.visible = id === next.mode;
      });
      this.activeModeId = next.mode;
      this.modeTransitionProgress = 0;
    }

    // Bloom & Dither uniforms
    const qCfg = QUALITY_CONFIGS[next.quality];
    this.bloomPass.strength = next.bloomIntensity;
    this.bloomPass.enabled = !this.isSoftwareGl && qCfg.bloomEnabled && next.bloomIntensity > 0.02;

    this.ditherPass.uniforms.uDitherIntensity.value = next.ditherIntensity;
    this.ditherPass.uniforms.uColorLevels.value = next.colorLevels;
    this.ditherPass.uniforms.uPixelScale.value = next.pixelScale;
    this.ditherPass.uniforms.uGlitchIntensity.value = next.glitchIntensity;
  }

  public triggerLibraryPulse() {
    this.libraryOpenImpulse = 1.0;
  }

  public resetCamera() {
    this.manualOverrideTimer = 0;
    this.orbitAngle = 0;
    this.controls.target.set(0, 0, 0);
    const dist = this.settings.cameraDistance;
    this.camera.position.set(0, 1.4, dist);
    this.controls.update();
  }

  public handleResize() {
    if (this.disposed || !this.renderer) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    this.bloomPass.resolution.set(width, height);
    this.syncShaderUniforms(width, height);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextTick() {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDelta = Math.min(0.1, Math.max(0.001, (now - this.lastTimeMs) / 1000));
    this.lastTimeMs = now;

    if (document.hidden) {
      this.scheduleNextTick();
      return;
    }

    // Visual FX Preview mode accelerates visual simulation time only (independent of audio playbackRate)
    const fxMultiplier = this.settings.visualFxPreviewEnabled
      ? this.settings.visualFxSpeedMultiplier
      : 1.0;
    const delta = rawDelta * fxMultiplier;
    this.visualElapsed += delta;

    // Sample live Web Audio metrics
    const audio = this.sampleAudio(this.settings.sensitivity, this.audioMetrics);

    // Decay UI-triggered impulses smoothly
    this.libraryOpenImpulse *= Math.exp(-rawDelta * 4.5);

    // Smooth mode entry scale transition
    if (this.modeTransitionProgress < 1) {
      this.modeTransitionProgress = Math.min(1, this.modeTransitionProgress + rawDelta * 3.8);
      const ease = 1 - Math.pow(1 - this.modeTransitionProgress, 3);
      this.modes[this.activeModeId].group.scale.setScalar(0.86 + 0.14 * ease);
    }

    // Update active mode & background
    this.modes[this.activeModeId].update(this.visualElapsed, delta, audio);
    this.background.update(
      this.visualElapsed,
      delta,
      audio,
      this.settings,
      this.currentQualityMaxParticles,
      this.libraryOpenImpulse,
    );

    // Camera choreography: smooth orbital camera that yields to manual dragging/zooming
    if (this.manualOverrideTimer > 0 && !this.userInteracting) {
      this.manualOverrideTimer = Math.max(0, this.manualOverrideTimer - rawDelta);
    }

    if (this.settings.cinematicCamera && !this.userInteracting && this.manualOverrideTimer <= 0) {
      this.orbitAngle += delta * this.settings.cameraOrbitSpeed * 0.28;
      // Keep camera steady at configured distance (never zoom in on beats) so large geometry commands the frame
      const targetDist = Math.max(5.5, this.settings.cameraDistance);

      const modePitch =
        this.activeModeId === 'grid-bars'
          ? 4.6
          : this.activeModeId === 'neon-tunnel'
          ? 0.5
          : 2.2 + Math.sin(this.visualElapsed * 0.26) * 1.15;

      const desiredX = Math.sin(this.orbitAngle) * targetDist;
      const desiredZ = Math.cos(this.orbitAngle) * targetDist;
      const desiredY = modePitch;

      const damp = 1 - Math.exp(-rawDelta * 2.6);
      this.camera.position.x += (desiredX - this.camera.position.x) * damp;
      this.camera.position.y += (desiredY - this.camera.position.y) * damp;
      this.camera.position.z += (desiredZ - this.camera.position.z) * damp;
    } else if (!this.userInteracting && this.manualOverrideTimer <= 0) {
      // Non-cinematic mode still smoothly honours distance slider when idle
      const currentDist = this.camera.position.length();
      if (Math.abs(currentDist - this.settings.cameraDistance) > 0.05) {
        const nextDist = THREE.MathUtils.damp(
          currentDist,
          this.settings.cameraDistance,
          4.0,
          rawDelta,
        );
        this.camera.position.setLength(nextDist);
      }
    }

    this.controls.update();

    // Update Bayer Dither Shader audio-reactive uniforms
    this.ditherPass.uniforms.uTime.value = this.visualElapsed;
    this.ditherPass.uniforms.uAudioEnergy.value = audio.overall;
    this.ditherPass.uniforms.uTransient.value = audio.transient;
    this.ditherPass.uniforms.uTension.value = audio.tension;
    this.ditherPass.uniforms.uRelease.value = audio.release;

    this.composer.render();
    this.scheduleNextTick();
  };

  public dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.resizeObserver?.disconnect();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.renderer) {
      this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
      this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    }

    this.controls?.dispose();
    this.background?.dispose();
    if (this.modes) {
      (Object.values(this.modes) as VisualizerModeInstance[]).forEach((m) => m.dispose());
    }
    this.bayerTex?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
    if (this.renderer?.domElement?.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
