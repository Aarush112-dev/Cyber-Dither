import * as THREE from 'three';

/**
 * Canonical 8x8 Bayer ordered-dithering threshold matrix (values 0..63).
 */
export const BAYER_8X8_MATRIX = new Uint8Array([
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]);

export function createBayer8x8Texture(): THREE.DataTexture {
  const data = new Uint8Array(64 * 4);
  for (let i = 0; i < 64; i++) {
    const val = Math.round((BAYER_8X8_MATRIX[i] / 64) * 255);
    data[i * 4] = val;
    data[i * 4 + 1] = val;
    data[i * 4 + 2] = val;
    data[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, 8, 8, THREE.RGBAFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export const BayerDitherShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tBayer: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uTime: { value: 0 },
    uDitherIntensity: { value: 0.35 },
    uColorLevels: { value: 16.0 },
    uPixelScale: { value: 1.0 },
    uGlitchIntensity: { value: 0.16 },
    uAudioEnergy: { value: 0.0 },
    uTransient: { value: 0.0 },
    uTension: { value: 0.0 },
    uRelease: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tBayer;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uDitherIntensity;
    uniform float uColorLevels;
    uniform float uPixelScale;
    uniform float uGlitchIntensity;
    uniform float uAudioEnergy;
    uniform float uTransient;
    uniform float uTension;
    uniform float uRelease;

    varying vec2 vUv;

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    void main() {
      vec2 res = max(uResolution, vec2(1.0));
      float scale = max(1.0, floor(uPixelScale + 0.5));

      vec2 fragCoord = vUv * res;
      vec2 cellCoord = floor(fragCoord / scale);
      // Preserve full native sharpness at scale=1; only quantize UVs into retro blocks when pixelScale > 1
      vec2 snappedUv = ((cellCoord + 0.5) * scale) / res;
      float blockBlend = step(1.5, scale) * smoothstep(0.0, 0.2, uDitherIntensity);
      vec2 sampleUv = mix(vUv, snappedUv, blockBlend);

      // Balanced glitch slices during pronounced peaks, high tension, or climax drops
      float glitchGate = step(0.86 - uTension * 0.13, fract(sin(floor(uTime * 11.0) * 19.73) * 43758.5453));
      float bandHash = hash12(vec2(floor(sampleUv.y * (44.0 + uTension * 20.0)), floor(uTime * (16.0 + uTension * 8.0))));
      float glitchAmt = uGlitchIntensity * (uTransient * 0.52 + uTension * 0.38 + uRelease * 0.92 + glitchGate * 0.2);
      float isGlitchSlice = step(0.09, glitchAmt) * step(0.91 - uRelease * 0.08, bandHash);
      if (isGlitchSlice > 0.5) {
        sampleUv.x += (bandHash - 0.94) * 0.048 * glitchAmt;
      }

      // Crisp native color sample; clean chromatic split on glitch slices or climax drops
      vec3 color = texture2D(tDiffuse, clamp(sampleUv, 0.0, 1.0)).rgb;
      float caStrength = uGlitchIntensity * (uRelease * 0.0052 + isGlitchSlice * 0.0045);
      if (caStrength > 0.0004) {
        vec2 dir = sampleUv - vec2(0.5);
        float r = texture2D(tDiffuse, clamp(sampleUv + dir * caStrength, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(sampleUv - dir * caStrength, 0.001, 0.999)).b;
        color.r = r;
        color.b = b;
      }

      // Compute luminance to preserve deep-black void while applying crisp 8x8 Bayer ordered dithering
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      float ditherMask = smoothstep(0.01, 0.06, luma);

      if (uDitherIntensity > 0.001) {
        vec2 bayerUv = (cellCoord + 0.5) / 8.0;
        float bayer = texture2D(tBayer, bayerUv).r;

        float audioDrive = 1.0 + uAudioEnergy * 0.16 + uTransient * 0.2 + uTension * 0.24 + uRelease * 0.28;
        float levels = max(2.0, floor(uColorLevels + 0.5));
        float spread = (1.0 / levels) * (0.42 + 0.75 * uDitherIntensity) * audioDrive;

        vec3 ditheredInput = clamp(color + (bayer - 0.5) * spread, 0.0, 1.0);
        vec3 quantized = floor(ditheredInput * (levels - 1.0) + 0.5) / (levels - 1.0);

        color = mix(color, quantized, uDitherIntensity * ditherMask);

        // Clean pixel-aligned subtle scanline (zero moire interference)
        float scan = 1.0 - (0.03 * uDitherIntensity * mod(floor(fragCoord.y), 2.0));
        color *= scan;
      }

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};
