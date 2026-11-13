import * as THREE from 'three';
import type { AudioMetrics, ColorTheme } from '../../types/visualizer';
import type { VisualizerModeInstance } from './ReactiveSphereMode';

/**
 * Mode D: FLOATING CLOUD
 * Vast 7.8-radius 4-arm galactic spiral vortex with crisp distinct particles,
 * tall vertical billows, and 360 dynamic harmonic constellation filaments.
 */
function createCrispParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const cx = size / 2;
    const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.42, 'rgba(255,255,255,0.92)');
    grad.addColorStop(0.68, 'rgba(255,255,255,0.2)');
    grad.addColorStop(1.0, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class FloatingCloudMode implements VisualizerModeInstance {
  public group = new THREE.Group();

  private readonly maxPoints: number;
  private baseCoords: Float32Array;
  private currentCoords: Float32Array;
  private colorArray: Float32Array;

  private particleTex: THREE.CanvasTexture;
  private pointsGeo: THREE.BufferGeometry;
  private pointsMat: THREE.PointsMaterial;
  private points: THREE.Points;

  private readonly linkCount = 360;
  private linkPositions: Float32Array;
  private linksGeo: THREE.BufferGeometry;
  private linksMat: THREE.LineBasicMaterial;
  private links: THREE.LineSegments;

  private cPrimary = new THREE.Color('#51F5FF');
  private cSecondary = new THREE.Color('#FF3B9D');
  private cTertiary = new THREE.Color('#712EFF');
  private tempColor = new THREE.Color();

  constructor(count = 2200) {
    this.maxPoints = count;
    this.baseCoords = new Float32Array(count * 3);
    this.currentCoords = new Float32Array(count * 3);
    this.colorArray = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const arm = i % 4;
      const t = Math.random();
      const radius = 0.6 + Math.pow(t, 0.7) * 7.4;
      const angle = t * Math.PI * 5.2 + (arm * Math.PI * 2) / 4 + (Math.random() - 0.5) * 0.95;
      const elevation = (Math.random() - 0.5) * (4.8 - t * 2.2);

      const x = Math.cos(angle) * radius;
      const y = elevation;
      const z = Math.sin(angle) * radius;

      this.baseCoords[i * 3] = x;
      this.baseCoords[i * 3 + 1] = y;
      this.baseCoords[i * 3 + 2] = z;

      this.currentCoords[i * 3] = x;
      this.currentCoords[i * 3 + 1] = y;
      this.currentCoords[i * 3 + 2] = z;

      this.tempColor.copy(this.cPrimary).lerp(this.cSecondary, t);
      this.colorArray[i * 3] = this.tempColor.r;
      this.colorArray[i * 3 + 1] = this.tempColor.g;
      this.colorArray[i * 3 + 2] = this.tempColor.b;
    }

    this.particleTex = createCrispParticleTexture();
    this.pointsGeo = new THREE.BufferGeometry();
    this.pointsGeo.setAttribute('position', new THREE.BufferAttribute(this.currentCoords, 3));
    this.pointsGeo.setAttribute('color', new THREE.BufferAttribute(this.colorArray, 3));

    this.pointsMat = new THREE.PointsMaterial({
      size: 0.16,
      map: this.particleTex,
      alphaTest: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(this.pointsGeo, this.pointsMat);
    this.group.add(this.points);

    this.linkPositions = new Float32Array(this.linkCount * 2 * 3);
    this.linksGeo = new THREE.BufferGeometry();
    this.linksGeo.setAttribute('position', new THREE.BufferAttribute(this.linkPositions, 3));
    this.linksMat = new THREE.LineBasicMaterial({
      color: this.cPrimary,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });
    this.links = new THREE.LineSegments(this.linksGeo, this.linksMat);
    this.group.add(this.links);
  }

  public setTheme(theme: ColorTheme) {
    this.cPrimary.set(theme.primary);
    this.cSecondary.set(theme.secondary);
    this.cTertiary.set(theme.tertiary);
    this.linksMat.color.copy(this.cPrimary);

    const colAttr = this.pointsGeo.getAttribute('color') as THREE.BufferAttribute;
    for (let i = 0; i < this.maxPoints; i++) {
      const t = (i % 100) / 100;
      this.tempColor.copy(this.cPrimary).lerp(this.cSecondary, t);
      if (i % 5 === 0) this.tempColor.lerp(this.cTertiary, 0.55);
      colAttr.setXYZ(i, this.tempColor.r, this.tempColor.g, this.tempColor.b);
    }
    colAttr.needsUpdate = true;
  }

  public update(elapsed: number, delta: number, audio: AudioMetrics) {
    const posAttr = this.pointsGeo.getAttribute('position') as THREE.BufferAttribute;
    const expand =
      1.0 - audio.tension * 0.21 + audio.bass * 0.42 + audio.transient * 0.24 + audio.release * 0.64;
    const swirl = 0.6 + audio.mids * 1.4 + audio.tension * 2.1;
    const jitter = audio.highs * 0.3 + audio.tension * 0.26;

    for (let i = 0; i < this.maxPoints; i++) {
      const bx = this.baseCoords[i * 3];
      const by = this.baseCoords[i * 3 + 1];
      const bz = this.baseCoords[i * 3 + 2];

      const phase = i * 0.037 + elapsed * swirl;
      const spec = audio.spectrum[i % 64] || 0;

      const x = bx * expand + Math.sin(phase) * (0.22 + spec * 0.5 + audio.release * 0.34);
      const y =
        by * (1.0 + audio.mids * 0.38 + audio.release * 0.48) +
        Math.cos(phase * 0.85 + bx) * (0.25 + jitter);
      const z = bz * expand + Math.cos(phase * 0.7) * (0.22 + spec * 0.5 + audio.release * 0.34);

      this.currentCoords[i * 3] = x;
      this.currentCoords[i * 3 + 1] = y;
      this.currentCoords[i * 3 + 2] = z;
    }
    posAttr.needsUpdate = true;

    const stride = Math.max(1, Math.floor(this.maxPoints / (this.linkCount * 2)));
    for (let l = 0; l < this.linkCount; l++) {
      const a = (l * stride * 2) % this.maxPoints;
      const b = (a + 9) % this.maxPoints;
      this.linkPositions[l * 6] = this.currentCoords[a * 3];
      this.linkPositions[l * 6 + 1] = this.currentCoords[a * 3 + 1];
      this.linkPositions[l * 6 + 2] = this.currentCoords[a * 3 + 2];

      this.linkPositions[l * 6 + 3] = this.currentCoords[b * 3];
      this.linkPositions[l * 6 + 4] = this.currentCoords[b * 3 + 1];
      this.linkPositions[l * 6 + 5] = this.currentCoords[b * 3 + 2];
    }
    const linkAttr = this.linksGeo.getAttribute('position') as THREE.BufferAttribute;
    linkAttr.needsUpdate = true;

    this.pointsMat.size = 0.14 + audio.highs * 0.052 + audio.release * 0.062;
    this.linksMat.opacity = 0.17 + audio.mids * 0.19 + audio.tension * 0.14 + audio.release * 0.17;
    this.group.rotation.y += delta * (0.16 + audio.mids * 0.35 + audio.tension * 0.75);
    this.group.rotation.z = Math.sin(elapsed * 0.24) * (0.09 + audio.tension * 0.12);
  }

  public dispose() {
    this.particleTex.dispose();
    this.pointsGeo.dispose();
    this.pointsMat.dispose();
    this.linksGeo.dispose();
    this.linksMat.dispose();
  }
}
