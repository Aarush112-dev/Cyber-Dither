import * as THREE from 'three';
import type { AudioMetrics, ColorTheme } from '../../types/visualizer';
import type { VisualizerModeInstance } from './ReactiveSphereMode';

interface TunnelFrame {
  mesh: THREE.LineLoop;
  innerMesh: THREE.LineLoop;
  mat: THREE.LineBasicMaterial;
  innerMat: THREE.LineBasicMaterial;
  zOffset: number;
  baseRotation: number;
}

/**
 * Mode C: NEON TUNNEL
 * Vast 72-unit architectural megastructure tunnel with undulating sinusoidal path,
 * alternating octagonal & hexagonal portals, and high-speed bass warp surge.
 */
export class NeonTunnelMode implements VisualizerModeInstance {
  public group = new THREE.Group();

  private readonly frameCount = 40;
  private readonly tunnelLength = 72;
  private frames: TunnelFrame[] = [];
  private innerRails: THREE.LineSegments;
  private railsMat: THREE.LineBasicMaterial;
  private outerRails: THREE.LineSegments;
  private outerRailsMat: THREE.LineBasicMaterial;

  private cPrimary = new THREE.Color('#51F5FF');
  private cSecondary = new THREE.Color('#FF3B9D');
  private cTertiary = new THREE.Color('#712EFF');
  private tempColor = new THREE.Color();

  constructor() {
    const outerSides = 8;
    const outerPoints: THREE.Vector3[] = [];
    for (let i = 0; i < outerSides; i++) {
      const a = (i / outerSides) * Math.PI * 2 + Math.PI / outerSides;
      outerPoints.push(new THREE.Vector3(Math.cos(a) * 5.2, Math.sin(a) * 5.2, 0));
    }
    const outerFrameGeo = new THREE.BufferGeometry().setFromPoints(outerPoints);

    const innerSides = 6;
    const innerPoints: THREE.Vector3[] = [];
    for (let i = 0; i < innerSides; i++) {
      const a = (i / innerSides) * Math.PI * 2;
      innerPoints.push(new THREE.Vector3(Math.cos(a) * 3.3, Math.sin(a) * 3.3, 0));
    }
    const innerFrameGeo = new THREE.BufferGeometry().setFromPoints(innerPoints);

    for (let i = 0; i < this.frameCount; i++) {
      const mat = new THREE.LineBasicMaterial({
        color: this.cPrimary,
        transparent: true,
        opacity: 0.72,
      });
      const innerMat = new THREE.LineBasicMaterial({
        color: this.cSecondary,
        transparent: true,
        opacity: 0.48,
      });
      const loop = new THREE.LineLoop(outerFrameGeo, mat);
      const innerLoop = new THREE.LineLoop(innerFrameGeo, innerMat);

      const zOffset = (i / this.frameCount) * this.tunnelLength;
      const z = -this.tunnelLength + zOffset + 10;
      loop.position.z = z;
      innerLoop.position.z = z;
      loop.rotation.z = i * 0.1;
      innerLoop.rotation.z = -i * 0.14;

      this.group.add(loop);
      this.group.add(innerLoop);
      this.frames.push({
        mesh: loop,
        innerMesh: innerLoop,
        mat,
        innerMat,
        zOffset,
        baseRotation: i * 0.1,
      });
    }

    const railVerts: number[] = [];
    for (let i = 0; i < outerSides; i++) {
      const a = (i / outerSides) * Math.PI * 2 + Math.PI / outerSides;
      const x = Math.cos(a) * 5.5;
      const y = Math.sin(a) * 5.5;
      railVerts.push(x, y, -this.tunnelLength + 10, x, y, 10);
    }
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railVerts, 3));
    this.railsMat = new THREE.LineBasicMaterial({
      color: this.cTertiary,
      transparent: true,
      opacity: 0.35,
    });
    this.innerRails = new THREE.LineSegments(railGeo, this.railsMat);
    this.group.add(this.innerRails);

    const outerRailVerts: number[] = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * 7.8;
      const y = Math.sin(a) * 7.8;
      outerRailVerts.push(x, y, -this.tunnelLength + 10, x, y, 10);
    }
    const outerRailGeo = new THREE.BufferGeometry();
    outerRailGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerRailVerts, 3));
    this.outerRailsMat = new THREE.LineBasicMaterial({
      color: this.cPrimary,
      transparent: true,
      opacity: 0.16,
    });
    this.outerRails = new THREE.LineSegments(outerRailGeo, this.outerRailsMat);
    this.group.add(this.outerRails);
  }

  public setTheme(theme: ColorTheme) {
    this.cPrimary.set(theme.primary);
    this.cSecondary.set(theme.secondary);
    this.cTertiary.set(theme.tertiary);
    this.railsMat.color.copy(this.cTertiary);
    this.outerRailsMat.color.copy(this.cPrimary);
  }

  public update(elapsed: number, delta: number, audio: AudioMetrics) {
    const travelSpeed =
      4.8 + audio.bass * 12.0 + audio.transient * 6.5 + audio.tension * 11.5 + audio.release * 9.5;

    for (let i = 0; i < this.frames.length; i++) {
      const f = this.frames[i];
      f.zOffset = (f.zOffset + delta * travelSpeed) % this.tunnelLength;
      const z = -this.tunnelLength + f.zOffset + 10;
      const depthNorm = f.zOffset / this.tunnelLength;

      const curveAmp = 1.0 + audio.tension * 0.8;
      const curveX =
        Math.sin(elapsed * (0.62 + audio.tension * 0.55) + depthNorm * Math.PI * 2.0) *
        (1.05 + audio.mids * 1.05) *
        curveAmp *
        (1.0 - depthNorm);
      const curveY =
        Math.cos(elapsed * (0.5 + audio.tension * 0.48) + depthNorm * Math.PI * 1.6) *
        (0.8 + audio.bass * 0.85) *
        curveAmp *
        (1.0 - depthNorm);

      f.mesh.position.set(curveX, curveY, z);
      f.innerMesh.position.set(curveX, curveY, z);

      const specIdx = Math.min(63, Math.floor((1 - depthNorm) * 48));
      const specVal = audio.spectrum[specIdx] || 0;

      const outerScale =
        1.0 - audio.tension * 0.1 + audio.bass * 0.32 + specVal * 0.26 + audio.release * 0.4;
      const innerScale =
        1.0 - audio.tension * 0.13 + audio.mids * 0.34 + audio.highs * 0.22 + audio.release * 0.46;
      f.mesh.scale.setScalar(outerScale);
      f.innerMesh.scale.setScalar(innerScale);

      const twist =
        Math.sin(elapsed * 0.62 + depthNorm * (3.9 + audio.tension * 3.1)) *
        (0.4 + audio.mids * 0.55 + audio.tension * 1.0);
      f.mesh.rotation.z = f.baseRotation + twist;
      f.innerMesh.rotation.z = -f.baseRotation * 1.4 - twist * 1.25;

      this.tempColor.copy(this.cPrimary).lerp(this.cSecondary, (i % 4) / 3);
      if (audio.highs > 0.32 && i % 3 === 0) {
        this.tempColor.lerp(this.cTertiary, audio.highs * 0.6);
      }
      f.mat.color.copy(this.tempColor);
      f.innerMat.color.copy(this.cSecondary).lerp(this.cTertiary, depthNorm);

      const edgeFade = Math.sin(depthNorm * Math.PI);
      f.mat.opacity = Math.max(
        0.06,
        edgeFade * (0.5 + specVal * 0.33 + audio.tension * 0.16 + audio.release * 0.2),
      );
      f.innerMat.opacity = Math.max(
        0.04,
        edgeFade * (0.34 + audio.mids * 0.3 + audio.tension * 0.16 + audio.release * 0.2),
      );
    }

    this.innerRails.rotation.z = Math.sin(elapsed * (0.32 + audio.tension * 0.4)) * 0.34;
    this.outerRails.rotation.z = -Math.cos(elapsed * 0.22) * 0.22;
    this.railsMat.opacity = 0.22 + audio.bass * 0.26 + audio.release * 0.22;
    this.outerRailsMat.opacity = 0.1 + audio.highs * 0.18 + audio.tension * 0.14;
  }

  public dispose() {
    if (this.frames.length > 0) {
      this.frames[0].mesh.geometry.dispose();
      this.frames[0].innerMesh.geometry.dispose();
    }
    this.frames.forEach((f) => {
      f.mat.dispose();
      f.innerMat.dispose();
    });
    this.innerRails.geometry.dispose();
    this.railsMat.dispose();
    this.outerRails.geometry.dispose();
    this.outerRailsMat.dispose();
  }
}
