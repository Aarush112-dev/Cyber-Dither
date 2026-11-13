import * as THREE from 'three';
import type { AudioMetrics, ColorTheme } from '../../types/visualizer';

export interface VisualizerModeInstance {
  group: THREE.Group;
  setTheme(theme: ColorTheme): void;
  update(elapsed: number, delta: number, audio: AudioMetrics): void;
  dispose(): void;
}

interface PulseWave {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  age: number;
  active: boolean;
}

function buildBarycentricSphere(radius: number, subdivisions: number): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(radius, subdivisions);
  const geo = base.toNonIndexed();
  base.dispose();

  const count = geo.attributes.position.count;
  const bary = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 3) {
    bary[i * 3] = 1;
    bary[i * 3 + 1] = 0;
    bary[i * 3 + 2] = 0;

    bary[(i + 1) * 3] = 0;
    bary[(i + 1) * 3 + 1] = 1;
    bary[(i + 1) * 3 + 2] = 0;

    bary[(i + 2) * 3] = 0;
    bary[(i + 2) * 3 + 1] = 0;
    bary[(i + 2) * 3 + 2] = 1;
  }
  geo.setAttribute('aBarycentric', new THREE.BufferAttribute(bary, 3));
  return geo;
}

/**
 * Mode A: REACTIVE SPHERE (Razor-Sharp Kinetic Sculpture)
 * - Solid dark obsidian core occluded properly so backfaces never clutter the silhouette
 * - Sub-pixel anti-aliased fwidth() barycentric neon lattice etched cleanly on every facet
 * - Crisp wide-staggered metallic gyroscope rings + edge-outlined satellite octahedra
 * - Expanding 3D beat & release shockwave rings outward into wide space
 */
export class ReactiveSphereMode implements VisualizerModeInstance {
  public group = new THREE.Group();

  private outerWireShader: THREE.ShaderMaterial;
  private outerWireMesh: THREE.Mesh;

  private innerLatticeEdges: THREE.EdgesGeometry;
  private innerLatticeMat: THREE.LineBasicMaterial;
  private innerLatticeMesh: THREE.LineSegments;

  private ringsGroup = new THREE.Group();
  private rings: THREE.Mesh[] = [];
  private ringMats: THREE.MeshStandardMaterial[] = [];

  private satellites: THREE.Group[] = [];
  private satCoreGeo: THREE.OctahedronGeometry;
  private satCoreMat: THREE.MeshStandardMaterial;
  private satEdgeGeo: THREE.EdgesGeometry;
  private satEdgeMat: THREE.LineBasicMaterial;

  private pulseWaves: PulseWave[] = [];
  private pulseCooldown = 0;

  constructor(subdivisions = 4) {
    // 1. Sculpted barycentric harmonic sphere (opaque dark body + razor-sharp neon edges)
    const outerGeo = buildBarycentricSphere(2.4, Math.min(subdivisions, 4));
    this.outerWireShader = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMids: { value: 0 },
        uHighs: { value: 0 },
        uTransient: { value: 0 },
        uTension: { value: 0 },
        uRelease: { value: 0 },
        uPrimary: { value: new THREE.Color('#51F5FF') },
        uSecondary: { value: new THREE.Color('#FF3B9D') },
        uTertiary: { value: new THREE.Color('#712EFF') },
      },
      vertexShader: /* glsl */ `
        attribute vec3 aBarycentric;

        uniform float uTime;
        uniform float uBass;
        uniform float uMids;
        uniform float uHighs;
        uniform float uTransient;
        uniform float uTension;
        uniform float uRelease;

        varying vec3 vBary;
        varying vec3 vNormalDir;
        varying vec3 vViewPos;
        varying float vDisplacement;

        void main() {
          vBary = aBarycentric;
          vec3 dir = normalize(position);

          float freqScale = 3.7 + uTension * 3.6;
          float w1 = sin(dir.x * freqScale + uTime * (1.4 + uTension * 1.4)) * cos(dir.y * (3.5 + uTension * 2.7) - uTime * 1.2) * sin(dir.z * freqScale + uTime * 1.05);
          float w2 = sin(dir.y * (8.5 + uTension * 4.8) + uTime * 3.4) * cos(dir.x * 7.8 + uTime * 2.5);
          float ripple = sin(length(dir.xy) * 12.5 - uTime * 8.0) * (uTransient * 0.72 + uRelease * 0.65);

          float baseIdle = 0.08 * w1;
          float bassPush = (0.65 * uBass + 0.38 * uTransient + 0.52 * uRelease) * (0.45 + 0.55 * w1);
          float midWave = (0.32 * uMids + 0.32 * uTension) * w1;
          float highVib = (0.11 * uHighs + 0.19 * uTension) * w2;

          float disp = baseIdle + bassPush + midWave + highVib + ripple * 0.25;
          vec3 displaced = position + dir * disp;

          vDisplacement = disp;
          vNormalDir = normalize(normalMatrix * dir);
          vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
          vViewPos = -mvPos.xyz;

          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uPrimary;
        uniform vec3 uSecondary;
        uniform vec3 uTertiary;
        uniform float uTransient;
        uniform float uHighs;
        uniform float uTension;
        uniform float uRelease;

        varying vec3 vBary;
        varying vec3 vNormalDir;
        varying vec3 vViewPos;
        varying float vDisplacement;

        void main() {
          // Sub-pixel anti-aliased wireframe lattice using screen-space derivatives
          vec3 d = fwidth(vBary);
          vec3 a3 = smoothstep(vec3(0.0), d * 1.45, vBary);
          float edge = 1.0 - min(min(a3.x, a3.y), a3.z);

          vec3 viewDir = normalize(vViewPos);
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, normalize(vNormalDir))), 2.6);

          float mixFactor = clamp(vDisplacement * 1.45 + 0.42, 0.0, 1.0);
          vec3 wireCol = mix(uPrimary, uSecondary, mixFactor);
          wireCol = mix(wireCol, uTertiary, clamp(fresnel * 0.45, 0.0, 0.5));
          wireCol *= 1.0 + uTransient * 0.35 + uRelease * 0.45 + uHighs * 0.2;

          // Deep obsidian interior surface with crisp rim highlight prevents backface mud
          vec3 bodyCol = vec3(0.025, 0.028, 0.06) + uTertiary * fresnel * (0.28 + uTension * 0.25);
          vec3 finalCol = mix(bodyCol, wireCol, edge);
          gl_FragColor = vec4(finalCol, 1.0);
        }
      `,
    });

    this.outerWireMesh = new THREE.Mesh(outerGeo, this.outerWireShader);
    this.group.add(this.outerWireMesh);

    // 2. Outer crisp faceted polyhedron cage surrounding the core
    const cageGeo = new THREE.IcosahedronGeometry(3.05, 1);
    this.innerLatticeEdges = new THREE.EdgesGeometry(cageGeo);
    cageGeo.dispose();
    this.innerLatticeMat = new THREE.LineBasicMaterial({
      color: 0xff3b9d,
      transparent: true,
      opacity: 0.48,
    });
    this.innerLatticeMesh = new THREE.LineSegments(this.innerLatticeEdges, this.innerLatticeMat);
    this.group.add(this.innerLatticeMesh);

    // 3. Three wide-staggered crisp metallic orbital gyroscope rings
    const ringConfigs = [
      { radius: 3.6, tube: 0.032, rx: Math.PI * 0.36, ry: 0.22, color: 0x51f5ff },
      { radius: 4.5, tube: 0.026, rx: -Math.PI * 0.28, ry: -0.45, color: 0xff3b9d },
      { radius: 5.5, tube: 0.022, rx: Math.PI * 0.48, ry: 0.9, color: 0x712eff },
    ];
    for (const cfg of ringConfigs) {
      const geo = new THREE.TorusGeometry(cfg.radius, cfg.tube, 16, 160);
      const mat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        emissive: new THREE.Color(cfg.color),
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.85,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.set(cfg.rx, cfg.ry, 0);
      this.rings.push(mesh);
      this.ringMats.push(mat);
      this.ringsGroup.add(mesh);
    }
    this.group.add(this.ringsGroup);

    // 4. 12 Crisp solid obsidian + edge-lit satellite octahedra
    this.satCoreGeo = new THREE.OctahedronGeometry(0.18, 0);
    this.satCoreMat = new THREE.MeshStandardMaterial({
      color: 0x0b0e1f,
      roughness: 0.25,
      metalness: 0.85,
    });
    this.satEdgeGeo = new THREE.EdgesGeometry(this.satCoreGeo);
    this.satEdgeMat = new THREE.LineBasicMaterial({
      color: 0x51f5ff,
    });
    for (let i = 0; i < 12; i++) {
      const node = new THREE.Group();
      node.add(new THREE.Mesh(this.satCoreGeo, this.satCoreMat));
      node.add(new THREE.LineSegments(this.satEdgeGeo, this.satEdgeMat));
      this.satellites.push(node);
      this.group.add(node);
    }

    // 5. Expanding 3D shockwave pulse rings launched outward on beats & climax drops
    const waveGeo = new THREE.TorusGeometry(2.6, 0.024, 12, 128);
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0x51f5ff,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(waveGeo, mat);
      mesh.visible = false;
      this.group.add(mesh);
      this.pulseWaves.push({ mesh, mat, age: 0, active: false });
    }
  }

  public setTheme(theme: ColorTheme) {
    this.outerWireShader.uniforms.uPrimary.value.set(theme.primary);
    this.outerWireShader.uniforms.uSecondary.value.set(theme.secondary);
    this.outerWireShader.uniforms.uTertiary.value.set(theme.tertiary);

    this.innerLatticeMat.color.set(theme.secondary);
    this.satEdgeMat.color.set(theme.primary);

    if (this.ringMats[0]) {
      this.ringMats[0].color.set(theme.primary);
      this.ringMats[0].emissive.set(theme.primary);
    }
    if (this.ringMats[1]) {
      this.ringMats[1].color.set(theme.secondary);
      this.ringMats[1].emissive.set(theme.secondary);
    }
    if (this.ringMats[2]) {
      this.ringMats[2].color.set(theme.tertiary);
      this.ringMats[2].emissive.set(theme.tertiary);
    }

    this.pulseWaves.forEach((pw, i) => {
      pw.mat.color.set(i % 2 === 0 ? theme.primary : theme.secondary);
    });
  }

  public update(elapsed: number, delta: number, audio: AudioMetrics) {
    const u = this.outerWireShader.uniforms;
    u.uTime.value = elapsed;
    u.uBass.value = audio.bass;
    u.uMids.value = audio.mids;
    u.uHighs.value = audio.highs;
    u.uTransient.value = audio.transient;
    u.uTension.value = audio.tension;
    u.uRelease.value = audio.release;

    const sphereScale =
      1.0 - audio.tension * 0.09 + audio.bass * 0.19 + audio.transient * 0.11 + audio.release * 0.24;
    this.outerWireMesh.scale.setScalar(sphereScale);
    this.outerWireMesh.rotation.y += delta * (0.21 + audio.mids * 0.48 + audio.tension * 0.95);
    this.outerWireMesh.rotation.x += delta * (0.085 + audio.tension * 0.35);

    this.innerLatticeMesh.scale.setScalar(
      1.0 - audio.tension * 0.06 + audio.mids * 0.16 + audio.release * 0.24,
    );
    this.innerLatticeMesh.rotation.y -= delta * (0.27 + audio.highs * 0.58 + audio.tension * 1.1);
    this.innerLatticeMesh.rotation.z += delta * (0.15 + audio.tension * 0.5);
    this.innerLatticeMat.opacity = 0.35 + audio.mids * 0.24 + audio.tension * 0.2 + audio.release * 0.18;

    this.rings.forEach((ring, idx) => {
      const dir = idx % 2 === 0 ? 1 : -1;
      ring.rotation.z += delta * dir * (0.19 + idx * 0.065 + audio.mids * 0.56 + audio.tension * 1.45);
      ring.rotation.x += delta * dir * (0.05 + audio.tension * 0.48);
      const ringScale =
        1.0 - audio.tension * 0.1 + audio.bass * (0.11 + idx * 0.04) + audio.release * (0.23 + idx * 0.06);
      ring.scale.setScalar(ringScale);
      this.ringMats[idx].emissiveIntensity =
        0.46 + audio.highs * 0.28 + audio.tension * 0.24 + audio.release * 0.34;
    });

    for (let i = 0; i < this.satellites.length; i++) {
      const s = this.satellites[i];
      const orbitR =
        4.3 + (i % 3) * 0.85 - audio.tension * 0.62 + audio.bass * 0.48 + audio.release * 1.08;
      const a =
        (i / this.satellites.length) * Math.PI * 2 +
        elapsed * (0.29 + (i % 3) * 0.1 + audio.tension * 0.95);
      const tilt = Math.sin(elapsed * (0.52 + audio.tension * 0.8) + i * 0.8) * (1.32 + audio.release * 0.65);
      s.position.set(Math.cos(a) * orbitR, tilt, Math.sin(a) * orbitR);
      s.rotation.y += delta * (1.15 + audio.tension * 2.2);
      s.rotation.x += delta * (0.75 + audio.tension * 1.6);
      const spec = audio.spectrum[(i * 5) % 64] || 0;
      s.scale.setScalar(0.85 + spec * 0.95 + audio.transient * 0.4 + audio.release * 0.54);
    }

    this.pulseCooldown = Math.max(0, this.pulseCooldown - delta);
    if ((audio.isBeat || audio.release > 0.55) && this.pulseCooldown <= 0) {
      const spawnRing = (tilt: number) => {
        const slot = this.pulseWaves.find((p) => !p.active) ?? this.pulseWaves[0];
        slot.active = true;
        slot.age = 0;
        slot.mesh.visible = true;
        slot.mesh.rotation.set(
          (Math.random() - 0.5) * 1.35 + tilt,
          (Math.random() - 0.5) * 1.35,
          0,
        );
        slot.mesh.scale.setScalar(1.0);
        slot.mat.opacity = 0.62;
      };
      spawnRing(0);
      this.pulseCooldown = 0.32;
    }

    for (const pw of this.pulseWaves) {
      if (!pw.active) continue;
      pw.age += delta;
      const life = 1.1;
      if (pw.age >= life) {
        pw.active = false;
        pw.mesh.visible = false;
      } else {
        const t = pw.age / life;
        pw.mesh.scale.setScalar(1.0 + t * 2.8);
        pw.mat.opacity = (1 - t) * (1 - t) * 0.68;
      }
    }
  }

  public dispose() {
    this.outerWireMesh.geometry.dispose();
    this.outerWireShader.dispose();
    this.innerLatticeEdges.dispose();
    this.innerLatticeMat.dispose();
    this.rings.forEach((r) => r.geometry.dispose());
    this.ringMats.forEach((m) => m.dispose());
    this.satCoreGeo.dispose();
    this.satCoreMat.dispose();
    this.satEdgeGeo.dispose();
    this.satEdgeMat.dispose();
    if (this.pulseWaves[0]) this.pulseWaves[0].mesh.geometry.dispose();
    this.pulseWaves.forEach((p) => p.mat.dispose());
  }
}
