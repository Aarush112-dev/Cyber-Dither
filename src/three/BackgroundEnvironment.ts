import * as THREE from 'three';
import type { AudioMetrics, ColorTheme, VisualizerSettings } from '../types/visualizer';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

interface ParticleData {
  radius: number;
  theta: number;
  phi: number;
  speed: number;
  size: number;
  hueMix: number;
  bobPhase: number;
}

interface ShockwaveRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  active: boolean;
}

/**
 * Architectural deep-space digital coliseum:
 * - 16 towering neon edge-outlined cathedral monoliths encircling the stage
 * - Giant counter-precessing horizon orbital rings framing the arena
 * - Wide beat-triggered floor shockwave rings expanding across 32 units
 * - Instanced orbiting geometric debris & deep-field starlight
 * - Controlled high-contrast atmospheric lighting (deep voids, sharp neon edges)
 */
export class BackgroundEnvironment {
  public group = new THREE.Group();

  private debrisMesh: THREE.InstancedMesh;
  private starPoints: THREE.Points;
  private starMaterial: THREE.PointsMaterial;
  private debrisMaterial: THREE.MeshBasicMaterial;
  private gridHelper: THREE.GridHelper;
  private subGridHelper: THREE.GridHelper;

  private monoliths: THREE.LineSegments[] = [];
  private monolithMat: THREE.LineBasicMaterial;
  private horizonRings: THREE.LineLoop[] = [];
  private horizonRingMats: THREE.LineBasicMaterial[] = [];

  private shockwaves: ShockwaveRing[] = [];
  private shockwaveCooldown = 0;

  private maxDebris: number;
  private debrisData: ParticleData[] = [];

  private keyLight: THREE.PointLight;
  private rimLight: THREE.PointLight;
  private coreLight: THREE.PointLight;
  private dirLight: THREE.DirectionalLight;
  private fillLight: THREE.HemisphereLight;

  private cPrimary = new THREE.Color('#51F5FF');
  private cSecondary = new THREE.Color('#FF3B9D');
  private cTertiary = new THREE.Color('#712EFF');
  private cGrid = new THREE.Color('#16D9D2');

  constructor(maxDebris = 1600) {
    this.maxDebris = maxDebris;

    // 1. High-contrast sculpted lighting rig (sharp facet shading, zero whitewash)
    this.fillLight = new THREE.HemisphereLight(0x51f5ff, 0x05050b, 0.55);
    this.group.add(this.fillLight);

    this.dirLight = new THREE.DirectionalLight(0xdbeafe, 1.35);
    this.dirLight.position.set(12, 18, 14);
    this.group.add(this.dirLight);

    this.keyLight = new THREE.PointLight(0x51f5ff, 2.2, 65, 1.4);
    this.keyLight.position.set(9, 7, 9);
    this.group.add(this.keyLight);

    this.rimLight = new THREE.PointLight(0xff3b9d, 2.0, 65, 1.4);
    this.rimLight.position.set(-9, -4, -8);
    this.group.add(this.rimLight);

    this.coreLight = new THREE.PointLight(0x712eff, 1.4, 45, 1.5);
    this.coreLight.position.set(0, 0, 0);
    this.group.add(this.coreLight);

    // 2. Wide spatial floor grids
    this.gridHelper = new THREE.GridHelper(110, 64, 0x51f5ff, 0x162038);
    this.gridHelper.position.y = -5.4;
    const gridMat = this.gridHelper.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.16;
    this.group.add(this.gridHelper);

    this.subGridHelper = new THREE.GridHelper(110, 22, 0xff3b9d, 0x1a1030);
    this.subGridHelper.position.y = -5.44;
    const subGridMat = this.subGridHelper.material as THREE.Material;
    subGridMat.transparent = true;
    subGridMat.opacity = 0.09;
    this.group.add(this.subGridHelper);

    // 3. 16 Towering edge-outlined monolith spires around the perimeter
    const baseBox = new THREE.BoxGeometry(1.15, 20.0, 1.15);
    const edgesGeo = new THREE.EdgesGeometry(baseBox);
    baseBox.dispose();

    this.monolithMat = new THREE.LineBasicMaterial({
      color: 0x712eff,
      transparent: true,
      opacity: 0.34,
    });
    const monolithCount = 16;
    for (let i = 0; i < monolithCount; i++) {
      const a = (i / monolithCount) * Math.PI * 2;
      const dist = 23 + (i % 2) * 5.5;
      const m = new THREE.LineSegments(edgesGeo, this.monolithMat);
      m.position.set(Math.cos(a) * dist, 1.2, Math.sin(a) * dist);
      m.rotation.y = -a;
      this.monoliths.push(m);
      this.group.add(m);
    }

    // 4. Two colossal tilted horizon ring arcs encircling the entire stage
    const ringRadii = [19.5, 25.0];
    for (let rIdx = 0; rIdx < ringRadii.length; rIdx++) {
      const pts: THREE.Vector3[] = [];
      const segs = 96;
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * ringRadii[rIdx], 0, Math.sin(a) * ringRadii[rIdx]));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: rIdx === 0 ? 0x51f5ff : 0xff3b9d,
        transparent: true,
        opacity: 0.22,
      });
      const loop = new THREE.LineLoop(geo, mat);
      loop.rotation.x = rIdx === 0 ? 0.14 : -0.18;
      loop.rotation.z = rIdx === 0 ? -0.08 : 0.11;
      this.horizonRings.push(loop);
      this.horizonRingMats.push(mat);
      this.group.add(loop);
    }

    // 5. Pool of 4 crisp expanding floor shockwave rings
    const ringGeo = new THREE.RingGeometry(0.975, 1.0, 84);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x51f5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.y = -5.36;
      mesh.visible = false;
      this.group.add(mesh);
      this.shockwaves.push({ mesh, mat, age: 0, active: false });
    }

    // 6. Instanced geometric debris fragments (octahedra)
    const debrisGeo = new THREE.OctahedronGeometry(0.068, 0);
    this.debrisMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.68,
    });

    this.debrisMesh = new THREE.InstancedMesh(debrisGeo, this.debrisMaterial, this.maxDebris);
    this.debrisMesh.frustumCulled = false;

    for (let i = 0; i < this.maxDebris; i++) {
      const r = 6.5 + Math.pow(Math.random(), 0.72) * 24.0;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.debrisData.push({
        radius: r,
        theta,
        phi,
        speed: (0.06 + Math.random() * 0.22) * (Math.random() > 0.5 ? 1 : -1),
        size: 0.55 + Math.random() * 1.55,
        hueMix: Math.random(),
        bobPhase: Math.random() * Math.PI * 2,
      });

      _color.copy(this.cPrimary).lerp(this.cSecondary, this.debrisData[i].hueMix);
      this.debrisMesh.setColorAt(i, _color);
    }
    if (this.debrisMesh.instanceColor) {
      this.debrisMesh.instanceColor.needsUpdate = true;
    }
    this.group.add(this.debrisMesh);

    // 7. Deep starfield dust
    const starCount = 1300;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 24 + Math.random() * 48;
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(p) * Math.cos(t);
      starPositions[i * 3 + 1] = r * Math.cos(p);
      starPositions[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    this.starMaterial = new THREE.PointsMaterial({
      color: 0x8f97ba,
      size: 0.09,
      transparent: true,
      opacity: 0.55,
      sizeAttenuation: true,
      depthWrite: false,
    });
    this.starPoints = new THREE.Points(starGeo, this.starMaterial);
    this.group.add(this.starPoints);
  }

  public setTheme(theme: ColorTheme) {
    this.cPrimary.set(theme.primary);
    this.cSecondary.set(theme.secondary);
    this.cTertiary.set(theme.tertiary);
    this.cGrid.set(theme.grid);

    this.keyLight.color.copy(this.cPrimary);
    this.rimLight.color.copy(this.cSecondary);
    this.coreLight.color.copy(this.cTertiary);
    this.fillLight.color.copy(this.cPrimary);
    this.monolithMat.color.copy(this.cTertiary);
    if (this.horizonRingMats[0]) this.horizonRingMats[0].color.copy(this.cPrimary);
    if (this.horizonRingMats[1]) this.horizonRingMats[1].color.copy(this.cSecondary);

    for (let i = 0; i < this.maxDebris; i++) {
      const mix = this.debrisData[i].hueMix;
      _color.copy(this.cPrimary).lerp(this.cSecondary, mix);
      if (mix > 0.72) {
        _color.lerp(this.cTertiary, 0.35);
      }
      this.debrisMesh.setColorAt(i, _color);
    }
    if (this.debrisMesh.instanceColor) {
      this.debrisMesh.instanceColor.needsUpdate = true;
    }
  }

  private spawnShockwave(useSecondary: boolean) {
    const slot = this.shockwaves.find((s) => !s.active) ?? this.shockwaves[0];
    slot.active = true;
    slot.age = 0;
    slot.mesh.visible = true;
    slot.mesh.scale.setScalar(1.5);
    slot.mat.color.copy(useSecondary ? this.cSecondary : this.cPrimary);
    slot.mat.opacity = 0.48;
  }

  public update(
    elapsed: number,
    delta: number,
    audio: AudioMetrics,
    settings: VisualizerSettings,
    qualityMaxParticles: number,
    libraryOpenImpulse: number,
  ) {
    const activeCount = Math.min(
      this.maxDebris,
      Math.max(60, Math.floor(qualityMaxParticles * settings.particleDensity)),
    );
    this.debrisMesh.count = activeCount;

    const speedMult =
      settings.particleSpeed *
      (settings.visualFxPreviewEnabled ? settings.visualFxSpeedMultiplier : 1.0);
    const bassExpand =
      1.0 -
      audio.tension * 0.12 +
      audio.bass * 0.21 +
      audio.transient * 0.13 +
      audio.release * 0.31 +
      libraryOpenImpulse * 0.1;
    const sizeScale =
      settings.particleSize * (1.0 + audio.highs * 0.31 + audio.transient * 0.2 + audio.release * 0.26);

    for (let i = 0; i < activeCount; i++) {
      const d = this.debrisData[i];
      d.theta += delta * d.speed * speedMult * (1.0 + audio.mids * 1.1 + audio.tension * 1.55);
      const r = d.radius * bassExpand + Math.sin(elapsed * 1.1 + d.bobPhase) * 0.24;

      const sinPhi = Math.sin(d.phi);
      _dummy.position.set(
        r * sinPhi * Math.cos(d.theta),
        r * Math.cos(d.phi) + Math.sin(elapsed * 0.8 + d.bobPhase) * 0.32,
        r * sinPhi * Math.sin(d.theta),
      );
      _dummy.rotation.set(
        elapsed * (0.62 + audio.tension * 0.85) + d.bobPhase,
        elapsed * (0.8 + audio.tension * 0.95) + d.theta,
        d.phi,
      );
      const s =
        d.size *
        sizeScale *
        (1.0 + (i % 4 === 0 ? audio.transient * 0.52 + audio.release * 0.45 : 0));
      _dummy.scale.setScalar(s);
      _dummy.updateMatrix();
      this.debrisMesh.setMatrixAt(i, _dummy.matrix);
    }
    this.debrisMesh.instanceMatrix.needsUpdate = true;

    this.starPoints.rotation.y += delta * (0.02 + audio.tension * 0.06) * speedMult;

    // Monoliths lean noticeably inward during buildups and rise cleanly on release
    this.monolithMat.opacity =
      0.23 + audio.bass * 0.19 + audio.tension * 0.17 + audio.release * 0.2;
    for (let i = 0; i < this.monoliths.length; i++) {
      const m = this.monoliths[i];
      const spec = audio.spectrum[(i * 4) % 64] || 0;
      const sy = 0.68 + spec * 1.15 + audio.bass * 0.38 + audio.tension * 0.48 + audio.release * 0.62;
      m.scale.set(
        1 + audio.transient * 0.13 + audio.release * 0.24,
        sy,
        1 + audio.transient * 0.13 + audio.release * 0.24,
      );
      m.rotation.z = audio.tension * 0.1 - audio.release * 0.13;
    }

    // Horizon rings accelerate smoothly during tension and pulse outward on release
    this.horizonRings.forEach((ring, idx) => {
      const dir = idx === 0 ? 1 : -1;
      ring.rotation.y += delta * dir * (0.07 + audio.mids * 0.23 + audio.tension * 0.62);
      ring.rotation.z += delta * dir * audio.tension * 0.15;
      ring.scale.setScalar(
        1.0 - audio.tension * 0.075 + audio.bass * 0.09 + audio.release * 0.18,
      );
      this.horizonRingMats[idx].opacity =
        0.16 + audio.highs * 0.17 + audio.tension * 0.14 + audio.release * 0.19;
    });

    // Crisp floor shockwave rings on beats & climax drops
    this.shockwaveCooldown = Math.max(0, this.shockwaveCooldown - delta);
    if ((audio.isBeat || audio.release > 0.55) && this.shockwaveCooldown <= 0) {
      this.spawnShockwave(audio.release > 0.45 ? true : Math.random() > 0.55);
      this.shockwaveCooldown = audio.release > 0.55 ? 0.24 : 0.34;
    }

    for (const sw of this.shockwaves) {
      if (!sw.active) continue;
      sw.age += delta;
      const life = 1.55;
      if (sw.age >= life) {
        sw.active = false;
        sw.mesh.visible = false;
      } else {
        const p = sw.age / life;
        sw.mesh.scale.setScalar(1.5 + p * 28.0);
        sw.mat.opacity = (1 - p) * (1 - p) * 0.4;
      }
    }

    // Crisp dark-mode spatial floor grid
    const gridMat = this.gridHelper.material as THREE.LineBasicMaterial;
    const subMat = this.subGridHelper.material as THREE.LineBasicMaterial;
    const isGridMode = settings.mode === 'grid-bars' || settings.mode === 'neon-tunnel';
    gridMat.opacity =
      (isGridMode ? 0.08 : 0.13) + audio.bass * 0.13 + audio.tension * 0.09 + audio.release * 0.12;
    subMat.opacity = (isGridMode ? 0.04 : 0.075) + audio.highs * 0.1 + audio.tension * 0.075;
    gridMat.color.copy(this.cGrid);
    subMat.color.copy(this.cSecondary);

    // Balanced lighting modulation
    this.keyLight.intensity = 1.85 + audio.bass * 1.65 + audio.release * 1.25;
    this.rimLight.intensity = 1.65 + audio.mids * 1.5 + audio.tension * 1.05;
    this.coreLight.intensity = 1.15 + audio.overall * 1.35 + audio.release * 1.2;
  }

  public dispose() {
    this.debrisMesh.geometry.dispose();
    this.debrisMaterial.dispose();
    this.starPoints.geometry.dispose();
    this.starMaterial.dispose();
    this.gridHelper.geometry.dispose();
    (this.gridHelper.material as THREE.Material).dispose();
    this.subGridHelper.geometry.dispose();
    (this.subGridHelper.material as THREE.Material).dispose();
    if (this.monoliths[0]) this.monoliths[0].geometry.dispose();
    this.monolithMat.dispose();
    this.horizonRings.forEach((r) => r.geometry.dispose());
    this.horizonRingMats.forEach((m) => m.dispose());
    if (this.shockwaves[0]) this.shockwaves[0].mesh.geometry.dispose();
    this.shockwaves.forEach((s) => s.mat.dispose());
  }
}
