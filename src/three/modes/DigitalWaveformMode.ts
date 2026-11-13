import * as THREE from 'three';
import type { AudioMetrics, ColorTheme } from '../../types/visualizer';
import type { VisualizerModeInstance } from './ReactiveSphereMode';

/**
 * Mode E: DIGITAL WAVEFORM
 * Monumental 18x14 3D waveform mountain range (22 waterfall ribbons + terrain grid)
 * driven directly by live AnalyserNode time-domain audio samples.
 */
export class DigitalWaveformMode implements VisualizerModeInstance {
  public group = new THREE.Group();

  private readonly ribbonCount = 22;
  private readonly sampleCount = 128;
  private ribbons: THREE.Line[] = [];
  private ribbonMats: THREE.LineBasicMaterial[] = [];
  private history: Float32Array[] = [];

  private surfaceGeo: THREE.PlaneGeometry;
  private surfaceMat: THREE.MeshBasicMaterial;
  private surfaceMesh: THREE.Mesh;

  private cPrimary = new THREE.Color('#51F5FF');
  private cSecondary = new THREE.Color('#FF3B9D');
  private cTertiary = new THREE.Color('#712EFF');
  private tempColor = new THREE.Color();
  private pushTimer = 0;

  constructor() {
    const width = 18.0;
    const depth = 14.0;

    for (let r = 0; r < this.ribbonCount; r++) {
      const buf = new Float32Array(this.sampleCount);
      this.history.push(buf);

      const verts = new Float32Array(this.sampleCount * 3);
      const z = (r / (this.ribbonCount - 1) - 0.5) * depth;
      for (let i = 0; i < this.sampleCount; i++) {
        const x = (i / (this.sampleCount - 1) - 0.5) * width;
        verts[i * 3] = x;
        verts[i * 3 + 1] = 0;
        verts[i * 3 + 2] = z;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      const mat = new THREE.LineBasicMaterial({
        color: this.cPrimary,
        transparent: true,
        opacity: 0.92 - (r / this.ribbonCount) * 0.58,
      });
      const line = new THREE.Line(geo, mat);
      this.ribbons.push(line);
      this.ribbonMats.push(mat);
      this.group.add(line);
    }

    this.surfaceGeo = new THREE.PlaneGeometry(width, depth, this.sampleCount - 1, this.ribbonCount - 1);
    this.surfaceGeo.rotateX(-Math.PI / 2);
    this.surfaceMat = new THREE.MeshBasicMaterial({
      color: this.cTertiary,
      wireframe: true,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    });
    this.surfaceMesh = new THREE.Mesh(this.surfaceGeo, this.surfaceMat);
    this.surfaceMesh.position.y = -0.02;
    this.group.add(this.surfaceMesh);
  }

  public setTheme(theme: ColorTheme) {
    this.cPrimary.set(theme.primary);
    this.cSecondary.set(theme.secondary);
    this.cTertiary.set(theme.tertiary);
    this.surfaceMat.color.copy(this.cTertiary);
  }

  public update(elapsed: number, delta: number, audio: AudioMetrics) {
    this.pushTimer += delta * (1.0 + audio.tension * 0.65);
    if (this.pushTimer >= 0.03) {
      this.pushTimer = 0;
      for (let r = this.ribbonCount - 1; r > 0; r--) {
        this.history[r].set(this.history[r - 1]);
      }
    }

    const front = this.history[0];
    const ampScale = 3.7 + audio.bass * 2.0 + audio.transient * 1.0 + audio.release * 1.9;
    for (let i = 0; i < this.sampleCount; i++) {
      if (audio.isActiveSignal) {
        const tensionRipple =
          audio.tension * Math.sin(i * 0.4 + elapsed * 10.5) * 0.34;
        front[i] = audio.waveform[i] * ampScale + tensionRipple;
      } else {
        const xNorm = i / (this.sampleCount - 1);
        front[i] =
          Math.sin(xNorm * Math.PI * 4 + elapsed * 2.0) *
          0.35 *
          Math.sin(xNorm * Math.PI);
      }
    }

    const surfPos = this.surfaceGeo.getAttribute('position') as THREE.BufferAttribute;

    for (let r = 0; r < this.ribbonCount; r++) {
      const pos = this.ribbons[r].geometry.getAttribute('position') as THREE.BufferAttribute;
      const samples = this.history[r];
      const depthT = r / (this.ribbonCount - 1);

      this.tempColor.copy(this.cPrimary).lerp(this.cSecondary, depthT);
      this.ribbonMats[r].color.copy(this.tempColor);
      this.ribbonMats[r].opacity =
        (1.0 - depthT * 0.68) * (0.71 + audio.overall * 0.19 + audio.release * 0.16);

      for (let i = 0; i < this.sampleCount; i++) {
        const y = samples[i] + Math.sin(elapsed * 1.15 + r * 0.4) * 0.065;
        pos.setY(i, y);

        const surfIdx = r * this.sampleCount + i;
        if (surfIdx < surfPos.count) {
          surfPos.setY(surfIdx, y);
        }
      }
      pos.needsUpdate = true;
    }

    surfPos.needsUpdate = true;
    this.surfaceMat.opacity = 0.14 + audio.mids * 0.16 + audio.tension * 0.12 + audio.release * 0.13;
    this.group.rotation.y = Math.sin(elapsed * (0.2 + audio.tension * 0.15)) * 0.31;
    this.group.rotation.x = audio.tension * 0.1 - audio.release * 0.09;
  }

  public dispose() {
    this.ribbons.forEach((r) => r.geometry.dispose());
    this.ribbonMats.forEach((m) => m.dispose());
    this.surfaceGeo.dispose();
    this.surfaceMat.dispose();
  }
}
