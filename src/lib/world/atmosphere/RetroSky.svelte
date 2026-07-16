<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import { BackSide, Color, Mesh, ShaderMaterial, SphereGeometry } from 'three'
  import { dusk, reducedMotion } from '../worldState'

  const geometry = new SphereGeometry(260, 32, 20)
  const uniforms = {
    uTime: { value: 0 },
    uDusk: { value: 0 },
    uTopDay: { value: new Color('#315f73') },
    uHorizonDay: { value: new Color('#aa9d70') },
    uTopDusk: { value: new Color('#5d526a') },
    uHorizonDusk: { value: new Color('#efa26e') },
  }

  const material = new ShaderMaterial({
    uniforms,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    toneMapped: false,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vDirection;
      uniform float uTime;
      uniform float uDusk;
      uniform vec3 uTopDay;
      uniform vec3 uHorizonDay;
      uniform vec3 uTopDusk;
      uniform vec3 uHorizonDusk;

      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int i = 0; i < 4; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + 13.17;
          amplitude *= 0.48;
        }
        return value;
      }

      float bayer4(vec2 pixel) {
        vec2 p = mod(floor(pixel), 4.0);
        float index = p.x + p.y * 4.0;
        if (index < 0.5) return 0.0 / 16.0;
        if (index < 1.5) return 8.0 / 16.0;
        if (index < 2.5) return 2.0 / 16.0;
        if (index < 3.5) return 10.0 / 16.0;
        if (index < 4.5) return 12.0 / 16.0;
        if (index < 5.5) return 4.0 / 16.0;
        if (index < 6.5) return 14.0 / 16.0;
        if (index < 7.5) return 6.0 / 16.0;
        if (index < 8.5) return 3.0 / 16.0;
        if (index < 9.5) return 11.0 / 16.0;
        if (index < 10.5) return 1.0 / 16.0;
        if (index < 11.5) return 9.0 / 16.0;
        if (index < 12.5) return 15.0 / 16.0;
        if (index < 13.5) return 7.0 / 16.0;
        if (index < 14.5) return 13.0 / 16.0;
        return 5.0 / 16.0;
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y * 0.72 + 0.28, 0.0, 1.0);
        vec3 top = mix(uTopDay, uTopDusk, uDusk);
        vec3 horizon = mix(uHorizonDay, uHorizonDusk, uDusk);
        vec3 color = mix(horizon, top, smoothstep(0.02, 0.82, height));

        vec2 cloudUv = direction.xz / max(0.16, direction.y + 0.36);
        cloudUv = cloudUv * 1.5 + vec2(uTime * 0.006, uTime * 0.0025);
        float cloudField = fbm(cloudUv);
        float cloudBand = smoothstep(-0.02, 0.16, direction.y) * (1.0 - smoothstep(0.44, 0.68, direction.y));
        float clouds = smoothstep(0.56, 0.73, cloudField) * cloudBand;
        vec3 cloudLight = mix(vec3(0.58, 0.55, 0.39), vec3(0.68, 0.45, 0.42), uDusk);
        color = mix(color, cloudLight, clouds * 0.42);

        vec3 sunDirection = normalize(vec3(-0.55, 0.48, -0.42));
        float sun = step(0.994, dot(direction, sunDirection));
        float sunHalo = pow(max(dot(direction, sunDirection), 0.0), 54.0);
        color += vec3(1.0, 0.67, 0.32) * sunHalo * (0.22 + uDusk * 0.28);
        color = mix(color, vec3(1.0, 0.89, 0.57), sun);

        float stars = step(0.997, hash(floor(gl_FragCoord.xy * 0.5))) * smoothstep(0.12, 0.72, direction.y) * uDusk;
        color += vec3(1.0, 0.86, 0.58) * stars * 0.7;

        float dither = bayer4(gl_FragCoord.xy) - 0.5;
        color = clamp(color + vec3(dither * 0.008), 0.0, 1.0);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  })

  const sky = new Mesh(geometry, material)
  sky.renderOrder = -100
  sky.frustumCulled = false

  $effect(() => {
    uniforms.uDusk.value = $dusk ? 1 : 0
  })

  useTask((delta) => {
    if (!$reducedMotion) uniforms.uTime.value += delta
  })
</script>

<T is={sky} />
