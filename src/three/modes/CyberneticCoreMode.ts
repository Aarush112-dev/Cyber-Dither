import * as THREE from 'three';
import type { AudioMetrics, ColorTheme } from '../../types/visualizer';
import type { VisualizerModeInstance } from './ReactiveSphereMode';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

/**
 * Mode F: CYBERNETIC CORE
 * Colossal multi-tier architectural reactor:
 * - Sculpted inner octahedral energy core
 * - 3 counter-rotating gimbal cages spanning up to radius 4.2
 * - 64 sweeping mechanical iris turbine blades orbiting at radius 4.9+
 * - 3 perpendicular radial waveform rings spanning out to radius 5.8
 */
export class CyberneticCoreMode implements VisualizerModeInstance {
  public group = new THREE.Group();

  private innerCore: THREE.Mesh;
  private innerCoreMat: THREE.MeshStandardMaterial;
  private innerCoreEdge: THREE.LineSegments;
  private innerCoreEdgeMat: THREE.LineBasicMaterial;

  private cage1: THREE.LineSegments;
  private cage1Mat: THREE.LineBasicMaterial;

  private cage2: THREE.LineSegments;
  private cage2Mat: THREE.LineBasicMaterial;

  private cage3: THREE.LineSegments;
  private cage3Mat: THREE.LineBasicMaterial;

  private readonly bladeCount = 64;
  private bladesMesh: THREE.InstancedMesh;
  private bladesMat: THREE.MeshStandardMaterial;

  private radialWaveLine: THREE.LineLoop;
  private radialWaveMat: THREE.LineBasicMaterial;
  private polarWaveLine: THREE.LineLoop;
  private polarWaveMat: THREE.LineBasicMaterial;
  private crossWaveLine: THREE.LineLoop;
  private crossWaveMat: THREE.LineBasicMaterial;
  private readonly wavePoints = 128;

  private cPrimary = new THREE.Color('#51F5FF');
  private cSecondary = new THREE.Color('#FF3B9D');
  private cTertiary = new THREE.Color('#712EFF');

  constructor() {
    // 1. Solid obsidian sculpted core with crisp neon EdgesGeometry wireframe
    const coreGeo = new THREE.OctahedronGeometry(1.38, 2);
    this.innerCoreMat = new THREE.MeshStandardMaterial({
      color: 0x090c1a,
      roughness: 0.22,
      metalness: 0.88,
      emissive: this.cTertiary,
      emissiveIntensity: 0.22,
    });
    this.innerCore = new THREE.Mesh(coreGeo, this.innerCoreMat);
    const coreEdgeGeo = new THREE.EdgesGeometry(coreGeo);
    this.innerCoreEdgeMat = new THREE.LineBasicMaterial({
      color: this.cPrimary,
      transparent: true,
      opacity: 0.85,
    });
    this.innerCoreEdge = new THREE.LineSegments(coreEdgeGeo, this.innerCoreEdgeMat);
    this.innerCore.add(this.innerCoreEdge);
    this.group.add(this.innerCore);

    // 2. Three crisp counter-rotating gimbal cages (EdgesGeometry removes interior diagonal clutter)
    const c1Geo = new THREE.DodecahedronGeometry(2.38, 0);
    this.cage1Mat = new THREE.LineBasicMaterial({
      color: this.cSecondary,
      transparent: true,
      opacity: 0.62,
    });
    this.cage1 = new THREE.LineSegments(new THREE.EdgesGeometry(c1Geo), this.cage1Mat);
    c1Geo.dispose();
    this.group.add(this.cage1);

    const c2Geo = new THREE.IcosahedronGeometry(3.28, 1);
    this.cage2Mat = new THREE.LineBasicMaterial({
      color: this.cTertiary,
      transparent: true,
      opacity: 0.48,
    });
    this.cage2 = new THREE.LineSegments(new THREE.EdgesGeometry(c2Geo), this.cage2Mat);
    c2Geo.dispose();
    this.group.add(this.cage2);

    const c3Geo = new THREE.OctahedronGeometry(4.18, 0);
    this.cage3Mat = new THREE.LineBasicMaterial({
      color: this.cPrimary,
      transparent: true,
      opacity: 0.36,
    });
    this.cage3 = new THREE.LineSegments(new THREE.EdgesGeometry(c3Geo), this.cage3Mat);
    c3Geo.dispose();
    this.group.add(this.cage3);

    // 3. 64 Instanced turbine iris blades
    const bladeGeo = new THREE.BoxGeometry(0.11, 1.4, 0.32);
    this.bladesMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.8,
      emissive: new THREE.Color(0x0c1022),
      emissiveIntensity: 0.5,
    });
    this.bladesMesh = new THREE.InstancedMesh(bladeGeo, this.bladesMat, this.bladeCount);
    this.bladesMesh.frustumCulled = false;
    this.group.add(this.bladesMesh);

    // 4. Three orthogonal reactive radial waveform loops
    const makeWaveGeo = (radius: number) => {
      const verts = new Float32Array(this.wavePoints * 3);
      for (let i = 0; i < this.wavePoints; i++) {
        const a = (i / this.wavePoints) * Math.PI * 2;
        verts[i * 3] = Math.cos(a) * radius;
        verts[i * 3 + 1] = 0;
        verts[i * 3 + 2] = Math.sin(a) * radius;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
      return g;
    };

    this.radialWaveMat = new THREE.LineBasicMaterial({
      color: this.cPrimary,
      transparent: true,
      opacity: 0.68,
    });
    this.radialWaveLine = new THREE.LineLoop(makeWaveGeo(5.3), this.radialWaveMat);
    this.group.add(this.radialWaveLine);

    this.polarWaveMat = new THREE.LineBasicMaterial({
      color: this.cSecondary,
      transparent: true,
      opacity: 0.52,
    });
    this.polarWaveLine = new THREE.LineLoop(makeWaveGeo(5.6), this.polarWaveMat);
    this.polarWaveLine.rotation.x = Math.PI * 0.42;
    this.group.add(this.polarWaveLine);

    this.crossWaveMat = new THREE.LineBasicMaterial({
      color: this.cTertiary,
      transparent: true,
      opacity: 0.45,
    });
    this.crossWaveLine = new THREE.LineLoop(makeWaveGeo(5.9), this.crossWaveMat);
    this.crossWaveLine.rotation.z = Math.PI * 0.42;
    this.group.add(this.crossWaveLine);
  }

  public setTheme(theme: ColorTheme) {
    this.cPrimary.set(theme.primary);
    this.cSecondary.set(theme.secondary);
    this.cTertiary.set(theme.tertiary);

    this.innerCoreMat.emissive.copy(this.cTertiary);
    this.innerCoreEdgeMat.color.copy(this.cPrimary);
    this.cage1Mat.color.copy(this.cSecondary);
    this.cage2Mat.color.copy(this.cTertiary);
    this.cage3Mat.color.copy(this.cPrimary);
    this.radialWaveMat.color.copy(this.cPrimary);
    this.polarWaveMat.color.copy(this.cSecondary);
    this.crossWaveMat.color.copy(this.cTertiary);
  }

  public update(elapsed: number, delta: number, audio: AudioMetrics) {
    const coreScale = 0.96 - audio.tension * 0.12 + audio.bass * 0.5 + audio.release * 0.48;
    this.innerCore.scale.setScalar(coreScale);
    this.innerCore.rotation.y += delta * (0.46 + audio.bass * 1.05 + audio.tension * 1.85);
    this.innerCore.rotation.x += delta * (0.32 + audio.tension * 1.1);
    this.innerCoreMat.emissiveIntensity = 0.22 + audio.bass * 0.35 + audio.tension * 0.27 + audio.release * 0.38;
    this.innerCoreEdgeMat.opacity = 0.72 + audio.tension * 0.17 + audio.release * 0.19;

    this.cage1.rotation.x -= delta * (0.29 + audio.mids * 0.8 + audio.tension * 1.45);
    this.cage1.rotation.z += delta * (0.24 + audio.tension * 0.95);
    this.cage1.scale.setScalar(1.0 - audio.tension * 0.09 + audio.mids * 0.19 + audio.release * 0.28);
    this.cage1Mat.opacity = 0.4 + audio.mids * 0.27 + audio.tension * 0.15;

    this.cage2.rotation.y -= delta * (0.19 + audio.highs * 0.68 + audio.tension * 1.2);
    this.cage2.rotation.x += delta * (0.14 + audio.tension * 0.78);
    this.cage2.scale.setScalar(1.0 - audio.tension * 0.075 + audio.bass * 0.16 + audio.release * 0.3);
    this.cage2Mat.opacity = 0.3 + audio.highs * 0.29 + audio.tension * 0.16;

    this.cage3.rotation.z -= delta * (0.14 + audio.bass * 0.48 + audio.tension * 1.08);
    this.cage3.rotation.y += delta * (0.1 + audio.tension * 0.72);
    this.cage3.scale.setScalar(1.0 - audio.tension * 0.1 + audio.bass * 0.2 + audio.release * 0.34);
    this.cage3Mat.opacity = 0.22 + audio.tension * 0.19 + audio.release * 0.22;

    this.bladesMat.emissiveIntensity = 0.35 + audio.overall * 0.36 + audio.release * 0.31;
    const orbitRadius =
      4.75 - audio.tension * 0.78 + audio.bass * 0.65 + audio.release * 1.18;
    for (let i = 0; i < this.bladeCount; i++) {
      const angle =
        (i / this.bladeCount) * Math.PI * 2 + elapsed * (0.29 + audio.tension * 0.78);
      const spec = audio.spectrum[Math.floor((i / this.bladeCount) * 64)] || 0;

      _dummy.position.set(
        Math.cos(angle) * orbitRadius,
        Math.sin(elapsed * (1.4 + audio.tension * 1.15) + i * 0.35) * (0.38 + audio.release * 0.4),
        Math.sin(angle) * orbitRadius,
      );
      _dummy.rotation.set(
        0,
        -angle,
        Math.PI * 0.16 - audio.tension * 0.4 + spec * 0.78 + audio.release * 0.78,
      );
      _dummy.scale.set(1.0, 0.68 + spec * 1.95 + audio.release * 0.8, 1.0);
      _dummy.updateMatrix();
      this.bladesMesh.setMatrixAt(i, _dummy.matrix);

      _color.copy(this.cPrimary).lerp(this.cSecondary, spec);
      this.bladesMesh.setColorAt(i, _color);
    }
    this.bladesMesh.instanceMatrix.needsUpdate = true;
    if (this.bladesMesh.instanceColor) this.bladesMesh.instanceColor.needsUpdate = true;

    const eqPos = this.radialWaveLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const polPos = this.polarWaveLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    const crsPos = this.crossWaveLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < this.wavePoints; i++) {
      const a = (i / this.wavePoints) * Math.PI * 2;
      const sample = audio.isActiveSignal
        ? audio.waveform[i % 128] * (1.25 + audio.release * 0.8)
        : Math.sin(a * 6 + elapsed * 2.2) * 0.18;
      const rEq = 5.3 - audio.tension * 0.54 + sample + audio.bass * 0.45 + audio.release * 0.86;
      eqPos.setXYZ(i, Math.cos(a) * rEq, sample * 0.65, Math.sin(a) * rEq);

      const rPol = 5.6 - audio.tension * 0.54 + sample * 0.9 + audio.mids * 0.42 + audio.release * 0.86;
      polPos.setXYZ(i, Math.cos(a) * rPol, -sample * 0.56, Math.sin(a) * rPol);

      const rCrs = 5.9 - audio.tension * 0.54 + sample * 0.8 + audio.highs * 0.38 + audio.release * 0.86;
      crsPos.setXYZ(i, Math.cos(a) * rCrs, sample * 0.45, Math.sin(a) * rCrs);
    }
    eqPos.needsUpdate = true;
    polPos.needsUpdate = true;
    crsPos.needsUpdate = true;
    this.radialWaveLine.rotation.x = Math.sin(elapsed * (0.36 + audio.tension * 0.52)) * 0.31;
    this.radialWaveLine.rotation.z = Math.cos(elapsed * 0.28) * 0.23;
    this.polarWaveLine.rotation.y += delta * (0.22 + audio.highs * 0.42 + audio.tension * 0.85);
    this.crossWaveLine.rotation.x -= delta * (0.18 + audio.mids * 0.38 + audio.tension * 0.72);
  }

  public dispose() {
    this.innerCore.geometry.dispose();
    this.innerCoreMat.dispose();
    this.innerCoreEdge.geometry.dispose();
    this.innerCoreEdgeMat.dispose();
    this.cage1.geometry.dispose();
    this.cage1Mat.dispose();
    this.cage2.geometry.dispose();
    this.cage2Mat.dispose();
    this.cage3.geometry.dispose();
    this.cage3Mat.dispose();
    this.bladesMesh.geometry.dispose();
    this.bladesMat.dispose();
    this.radialWaveLine.geometry.dispose();
    this.radialWaveMat.dispose();
    this.polarWaveLine.geometry.dispose();
    this.polarWaveMat.dispose();
    this.crossWaveLine.geometry.dispose();
    this.crossWaveMat.dispose();
  }
}
