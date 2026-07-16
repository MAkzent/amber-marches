import { Color, ShaderMaterial, Vector4 } from 'three'
import { MAX_WATER_DISTURBANCES, type WaterDisturbance } from './riverDisturbance'
import { RIVER_PALETTE } from './riverConfig'
import { RIVER_OUTPUT_CHUNK } from './riverShaderChunks'

/**
 * Stylized translucent Silverrun water — shallow shelves go clear with visible
 * surface waves; deep channel keeps a shining anime cyan film. Caustics use one
 * low-freq voronoi with world-ish isotropic flow UVs so ribbon stretch stays soft.
 * No reflections.
 */
export type RiverWaterMaterial = ShaderMaterial & {
  userData: {
    syncDisturbances: (disturbances: readonly WaterDisturbance[], reducedMotion: boolean) => void
  }
}

const EMPTY_DISTURBANCE = new Vector4(0, 0, 0, 99)

export function createRiverWaterMaterial(): RiverWaterMaterial {
  const disturbanceUniforms = Array.from(
    { length: MAX_WATER_DISTURBANCES },
    () => ({ value: EMPTY_DISTURBANCE.clone() }),
  )

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: true,
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uFoam: { value: new Color(RIVER_PALETTE.foam) },
      uHighlight: { value: new Color('#eefbff') },
      uDeepAccent: { value: new Color('#0a6a92') },
      uDisturb0: disturbanceUniforms[0],
      uDisturb1: disturbanceUniforms[1],
      uDisturb2: disturbanceUniforms[2],
      uDisturb3: disturbanceUniforms[3],
      uDisturb4: disturbanceUniforms[4],
      uDisturb5: disturbanceUniforms[5],
    },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute vec2 aFlow;
      attribute float aFord;
      attribute float aDepth;

      varying vec3 vColor;
      varying vec2 vFlow;
      varying float vFord;
      varying float vDepth;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

      uniform float uTime;
      uniform float uMotion;

      float waveHeight(vec2 xz, float t) {
        float w1 = sin(xz.x * 1.35 + xz.y * 0.55 + t * 0.35);
        float w2 = sin(xz.x * -0.72 + xz.y * 1.85 + t * 0.45);
        float w3 = sin((xz.x + xz.y) * 2.4 - t * 0.55);
        // Slightly stronger lift on shallow shelves so waves read over the bed.
        float amp = mix(0.038, 0.022, aDepth);
        return (w1 * 0.55 + w2 * 0.32 + w3 * 0.18) * amp * uMotion;
      }

      void main() {
        vColor = color;
        vFlow = aFlow;
        vFord = aFord;
        vDepth = aDepth;

        vec3 transformed = position;
        transformed.y += waveHeight(position.xz, uTime);

        vec4 world = modelMatrix * vec4(transformed, 1.0);
        vWorldPos = world.xyz;
        vViewDir = normalize(cameraPosition - world.xyz);

        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying vec2 vFlow;
      varying float vFord;
      varying float vDepth;
      varying vec3 vWorldPos;
      varying vec3 vViewDir;

      uniform float uTime;
      uniform float uMotion;
      uniform vec3 uFoam;
      uniform vec3 uHighlight;
      uniform vec3 uDeepAccent;
      uniform vec4 uDisturb0;
      uniform vec4 uDisturb1;
      uniform vec4 uDisturb2;
      uniform vec4 uDisturb3;
      uniform vec4 uDisturb4;
      uniform vec4 uDisturb5;

      float rippleField(vec4 d, vec2 xz) {
        if (d.z < 0.04 || d.w > 2.35) return 0.0;
        float dist = length(xz - d.xy);
        float radius = 0.28 + d.w * (1.15 + d.z * 0.55);
        float ring = abs(dist - radius);
        float band = 1.0 - smoothstep(0.0, 0.18 + d.z * 0.06, ring);
        float fade = (1.0 - smoothstep(0.0, 2.2, d.w)) * d.z;
        float inner = exp(-dist * dist * (2.4 + d.z)) * fade * 0.55;
        return band * fade + inner;
      }

      vec2 hash22(vec2 p) {
        p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
        return fract(sin(p) * 43758.5453);
      }

      // Soft F2-F1 cell edges. Low frequency + thick bands survive ribbon UV stretch.
      float voronoiEdge(vec2 uv, float wobble) {
        vec2 i = floor(uv);
        vec2 f = fract(uv);
        float d1 = 8.0;
        float d2 = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y));
            vec2 o = hash22(i + g);
            // Mild cell drift — large wobble shears into thin zigzags on bends.
            o = 0.5 + 0.28 * sin(wobble + 6.28318 * o);
            vec2 r = g + o - f;
            float d = dot(r, r);
            if (d < d1) {
              d2 = d1;
              d1 = d;
            } else if (d < d2) {
              d2 = d;
            }
          }
        }
        return sqrt(max(d2, 0.0)) - sqrt(max(d1, 0.0));
      }

      void main() {
        vec2 xz = vWorldPos.xz;
        float t = uTime * uMotion;
        float shallow = 1.0 - vDepth;

        // Analytic mini-wave slopes.
        float eps = 0.12;
        float hL = sin((xz.x - eps) * 1.35 + xz.y * 0.55 + t * 0.35) * 0.55
          + sin((xz.x - eps) * -0.72 + xz.y * 1.85 + t * 0.45) * 0.32;
        float hR = sin((xz.x + eps) * 1.35 + xz.y * 0.55 + t * 0.35) * 0.55
          + sin((xz.x + eps) * -0.72 + xz.y * 1.85 + t * 0.45) * 0.32;
        float hD = sin(xz.x * 1.35 + (xz.y - eps) * 0.55 + t * 0.35) * 0.55
          + sin(xz.x * -0.72 + (xz.y - eps) * 1.85 + t * 0.45) * 0.32;
        float hU = sin(xz.x * 1.35 + (xz.y + eps) * 0.55 + t * 0.35) * 0.55
          + sin(xz.x * -0.72 + (xz.y + eps) * 1.85 + t * 0.45) * 0.32;
        vec3 waveN = normalize(vec3((hL - hR) * uMotion, 1.45, (hD - hU) * uMotion));

        float across = vFlow.x;
        // aFlow.y = flowDistance * 0.085. Keep across/along isotropic so cells
        // stay round under ribbon stretch — denser for finer anime caustic detail.
        float drift = vFlow.y * 8.8 - t * 0.055;
        float sway = sin(drift * 1.1 + t * 0.22) * 0.04;
        vec2 cauUv = vec2((across - 0.5) * 5.1 + sway, drift);
        float edge = voronoiEdge(cauUv, t * 0.32);
        // Thin soft bands — more cells, quieter ink.
        float web = 1.0 - smoothstep(0.015, 0.08, edge);
        float streak = sin(drift * 3.4 + across * 2.4) * 0.5 + 0.5;
        streak = smoothstep(0.74, 0.96, streak) * 0.1;
        float centerMask = 1.0 - smoothstep(0.72, 0.98, abs(across * 2.0 - 1.0));
        float lines = max(web * 0.8, streak) * centerMask;

        float fresnel = pow(1.0 - max(0.0, dot(waveN, normalize(vViewDir))), 2.0);
        float crest = pow(max(0.0, waveN.x * 0.45 + waveN.z * 0.35 + 0.5), 2.4);
        float crestLine = smoothstep(0.55, 0.92, crest) * lines * 0.14;

        float ripples =
          rippleField(uDisturb0, xz) +
          rippleField(uDisturb1, xz) +
          rippleField(uDisturb2, xz) +
          rippleField(uDisturb3, xz) +
          rippleField(uDisturb4, xz) +
          rippleField(uDisturb5, xz);
        ripples = min(1.4, ripples);

        float bank = smoothstep(0.86, 0.985, abs(across * 2.0 - 1.0));
        float foam = bank * 0.65 * (0.5 + vFord * 0.5);
        foam += ripples * 0.35;
        foam = clamp(foam, 0.0, 1.0);

        // Quiet cyan caustic web — denser lines, softer color lift.
        vec3 cauTint = mix(uDeepAccent, uHighlight, 0.44);
        vec3 col = vColor;
        // Extra bank→center darkening so the film gradient lifts the caustics.
        col = mix(col, uDeepAccent, vDepth * 0.28 * (1.0 - vFord));
        col = mix(col, cauTint, lines * 0.092 + crestLine * 0.058 + fresnel * 0.1);
        col = mix(col, uFoam, foam * 0.5);
        col += uHighlight * (fresnel * 0.16 + crestLine * 0.081 + lines * 0.029);
        col += uFoam * ripples * 0.14;
        col = mix(col, uHighlight, clamp(ripples * 0.18 + crest * 0.06, 0.0, 0.28));

        float bodyAlpha = mix(0.16, 0.44, vDepth);
        bodyAlpha = mix(bodyAlpha, 0.09, vFord * shallow);
        float lineAlpha = lines * mix(0.041, 0.092, shallow) + crestLine * 0.046 + foam * 0.5;
        float alpha = clamp(bodyAlpha + lineAlpha + ripples * 0.12 + fresnel * 0.06, 0.06, 0.82);

        gl_FragColor = vec4(col, alpha);
        ${RIVER_OUTPUT_CHUNK}
      }
    `,
  }) as RiverWaterMaterial

  material.userData.syncDisturbances = (disturbances, reducedMotion) => {
    material.uniforms.uMotion.value = reducedMotion ? 0 : 1
    for (let index = 0; index < MAX_WATER_DISTURBANCES; index += 1) {
      const target = disturbanceUniforms[index].value as Vector4
      const d = disturbances[index]
      if (!d || reducedMotion) {
        target.set(0, 0, 0, 99)
        continue
      }
      target.set(d.x, d.z, d.strength, d.age)
    }
  }

  return material
}
