import * as THREE from 'three';
import type { AudioMetrics, ColorTheme } from '../../types/visualizer';
import type { VisualizerModeInstance } from './ReactiveSphereMode';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Mode B: 3D GRID BARS
 * 24x24 (576) architectural monolith pillars rising across an 18x18 digital stage.
 * Controlled emissive response preserves crisp dark-neon contrast while expanding
 * dynamically up to 7.5 units tall with traveling radial beat shockwave ripples.
 */
export class GridBarsMode implements VisualizerModeInstance {
  public group = new THREE.Group();

  private readonly gridDim = 24;
  private readonly count = 576;
  private readonly spacing = 0.74;
  private barsMesh: THREE.InstancedMesh;
  private barsMat: THREE.MeshStandardMaterial;
  private floorMesh: THREE.Mesh;
  private floorMat: THREE.MeshBasicMaterial;
  private frameRing: THREE.LineLoop;
  private frameRingMat: THREE.LineBasicMaterial;

  private cPrimary = new THREE.Color('#51F5FF');
  private cSecondary = new THREE.Color('#FF3B9D');
  private cTertiary = new THREE.Color('#712EFF');
  private heights = new Float32Array(576);
  private ripplePhase = 0;

  constructor() {
    const barGeo = new THREE.BoxGeometry(0.46, 1.0, 0.46);
    barGeo.translate(0, 0.5, 0);

    this.barsMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.82,
      emissive: new THREE.Color(0x0c1022),
      emissiveIntensity: 0.38,
    });

    this.barsMesh = new THREE.InstancedMesh(barGeo, this.barsMat, this.count);
    this.barsMesh.position.y = -2.8;
    this.barsMesh.frustumCulled = false;

    const offset = ((this.gridDim - 1) * this.spacing) / 2;
    for (let z = 0; z < this.gridDim; z++) {
      for (let x = 0; x < this.gridDim; x++) {
        const idx = z * this.gridDim + x;
        _dummy.position.set(x * this.spacing - offset, 0, z * this.spacing - offset);
        _dummy.scale.set(1, 0.2, 1);
        _dummy.updateMatrix();
        this.barsMesh.setMatrixAt(idx, _dummy.matrix);
        this.barsMesh.setColorAt(idx, this.cPrimary);
      }
    }
    this.barsMesh.instanceMatrix.needsUpdate = true;
    if (this.barsMesh.instanceColor) this.barsMesh.instanceColor.needsUpdate = true;
    this.group.add(this.barsMesh);

    // Wide dark reflective floor
    const floorGeo = new THREE.PlaneGeometry(21.0, 21.0);
    floorGeo.rotateX(-Math.PI / 2);
    this.floorMat = new THREE.MeshBasicMaterial({
      color: 0x060710,
      transparent: true,
      opacity: 0.88,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    this.floorMesh.position.y = -2.84;
    this.group.add(this.floorMesh);

    // Crisp perimeter neon frame
    const halfSpan = 9.4;
    const borderPts = [
      new THREE.Vector3(-halfSpan, -2.8, -halfSpan),
      new THREE.Vector3(halfSpan, -2.8, -halfSpan),
      new THREE.Vector3(halfSpan, -2.8, halfSpan),
      new THREE.Vector3(-halfSpan, -2.8, halfSpan),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    this.frameRingMat = new THREE.LineBasicMaterial({
      color: this.cPrimary,
      transparent: true,
      opacity: 0.38,
    });
    this.frameRing = new THREE.LineLoop(borderGeo, this.frameRingMat);
    this.group.add(this.frameRing);
  }

  public setTheme(theme: ColorTheme) {
    this.cPrimary.set(theme.primary);
    this.cSecondary.set(theme.secondary);
    this.cTertiary.set(theme.tertiary);
    this.frameRingMat.color.copy(this.cPrimary);
  }

  public update(elapsed: number, delta: number, audio: AudioMetrics) {
    const offset = ((this.gridDim - 1) * this.spacing) / 2;
    if (audio.isBeat || audio.release > 0.6) {
      this.ripplePhase = 0;
    } else {
      this.ripplePhase += delta * (2.4 + audio.tension * 1.6);
    }

    this.barsMat.emissiveIntensity =
      0.34 + audio.overall * 0.35 + audio.tension * 0.2 + audio.release * 0.32;
    this.frameRingMat.opacity =
      0.24 + audio.bass * 0.22 + audio.tension * 0.19 + audio.release * 0.22;

    for (let z = 0; z < this.gridDim; z++) {
      for (let x = 0; x < this.gridDim; x++) {
        const idx = z * this.gridDim + x;
        const nx = (x / (this.gridDim - 1)) * 2 - 1;
        const nz = (z / (this.gridDim - 1)) * 2 - 1;
        const radial = Math.min(1, Math.sqrt(nx * nx + nz * nz) / 1.414);

        const specIdx = Math.min(63, Math.floor(radial * 52 + (x % 4) * 3));
        const specVal = audio.spectrum[specIdx] || 0;

        const shockwave =
          audio.isActiveSignal && this.ripplePhase < 1.6
            ? Math.max(0, 1 - Math.abs(radial - this.ripplePhase * 0.85) * 4.2) *
              (0.9 + audio.bass * 1.05 + audio.release * 1.6)
            : 0;

        const tensionWall = audio.tension * radial * radial * 2.5;
        const releaseEruption = audio.release * (1.0 - radial * 0.55) * 2.7;

        const idleWave =
          0.25 +
          0.19 * Math.sin(elapsed * 1.8 + x * 0.38 + z * 0.38) +
          0.13 * Math.cos(elapsed * 1.2 - radial * 5.0);

        const targetH = audio.isActiveSignal
          ? 0.2 +
            specVal * (5.6 - radial * 1.5) +
            audio.transient * (1.0 - radial * 0.6) * 1.05 +
            tensionWall +
            releaseEruption +
            shockwave
          : idleWave;

        this.heights[idx] += (targetH - this.heights[idx]) * 0.28;
        const h = Math.max(0.16, this.heights[idx]);

        _dummy.position.set(x * this.spacing - offset, 0, z * this.spacing - offset);
        _dummy.scale.set(1, h, 1);
        _dummy.updateMatrix();
        this.barsMesh.setMatrixAt(idx, _dummy.matrix);

        const colorMix = Math.min(1, radial * 0.5 + (h / 6.5) * 0.6);
        _color.copy(this.cPrimary).lerp(this.cSecondary, colorMix);
        if (colorMix > 0.65) {
          _color.lerp(this.cTertiary, 0.36);
        }
        this.barsMesh.setColorAt(idx, _color);
      }
    }

    this.barsMesh.instanceMatrix.needsUpdate = true;
    if (this.barsMesh.instanceColor) this.barsMesh.instanceColor.needsUpdate = true;
    this.group.rotation.y = Math.sin(elapsed * (0.14 + audio.tension * 0.14)) * 0.29;
  }

  public dispose() {
    this.barsMesh.geometry.dispose();
    this.barsMat.dispose();
    this.floorMesh.geometry.dispose();
    this.floorMat.dispose();
    this.frameRing.geometry.dispose();
    this.frameRingMat.dispose();
  }
}
