<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    Color,
    DoubleSide,
    Mesh,
    ShaderMaterial,
    Vector2,
  } from 'three'
  import { BOARD_RADIUS, WORLD_HEX_SIZE, hexBattleDriver } from '../../battle'
  import { battleHud, ENCOUNTER_ORIGIN } from './battleBridge'
  import { dusk } from '../worldState'
  import {
    HEX_BOARD_GLSL,
    createDrapedPlaneGeometry,
  } from './hexBoardShader'
  import { BATTLE_MARKER } from './battleMarker'

  /**
   * Soft veil over the world outside the hex board — clear over the grid,
   * then fades into a dark atmospheric wash so the field reads as one stage.
   * Mask follows hex distance (not a circle) so the stage silhouette matches the board.
   */
  const FADE_LIFT = 0.07

  function fadeMetrics(radius: number, hexSize: number) {
    const inner = radius + BATTLE_MARKER.outsideClearOffset
    const outer = inner + BATTLE_MARKER.outsideFadeSpan
    return {
      inner,
      outer,
      span: hexSize * Math.sqrt(3) * (2 * outer + 1) + 8,
    }
  }

  /** Keep the wash warm/light — a near-black veil was crushing the horizon. */
  const dayVeil = new Color('#4a4030')
  const duskVeil = new Color('#3a3040')

  const defaultMetrics = fadeMetrics(BOARD_RADIUS, WORLD_HEX_SIZE)
  let geometry = createDrapedPlaneGeometry(defaultMetrics.span, ENCOUNTER_ORIGIN, FADE_LIFT, 0.75)

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    uniforms: {
      uCenter: { value: new Vector2(ENCOUNTER_ORIGIN.x, ENCOUNTER_ORIGIN.z) },
      uYaw: { value: 0 },
      uHexSize: { value: WORLD_HEX_SIZE },
      uInner: { value: defaultMetrics.inner },
      uOuter: { value: defaultMetrics.outer },
      uPeakOpacity: { value: BATTLE_MARKER.outsideOpacity },
      uOpacity: { value: 0 },
      uColor: { value: dayVeil.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorldPos;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorldPos = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec2 uCenter;
      uniform float uYaw;
      uniform float uHexSize;
      uniform float uInner;
      uniform float uOuter;
      uniform float uPeakOpacity;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vWorldPos;

      ${HEX_BOARD_GLSL}

      void main() {
        vec2 local = worldToLocalXZ(vWorldPos.xz, uCenter, uYaw);
        vec2 axial = localToAxial(local, uHexSize);
        float d = hexDistanceAxial(axial);
        // Soft hexagonal hole over the board; gentle wash beyond.
        float ring = smoothstep(uInner, uOuter, d);
        float alpha = ring * uPeakOpacity * uOpacity;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  })

  const mesh = new Mesh(geometry, material)
  mesh.renderOrder = 2
  mesh.frustumCulled = false
  mesh.position.set(ENCOUNTER_ORIGIN.x, 0, ENCOUNTER_ORIGIN.z)

  let opacity = 0
  let drapedKey = ''

  function redrape(
    origin: { x: number; z: number },
    radius: number,
    hexSize: number,
  ) {
    const key = `${origin.x},${origin.z}:${radius}:${hexSize}`
    if (key === drapedKey) return
    drapedKey = key
    const metrics = fadeMetrics(radius, hexSize)
    const next = createDrapedPlaneGeometry(metrics.span, origin, FADE_LIFT, 0.75)
    geometry.dispose()
    geometry = next
    mesh.geometry = next
    mesh.position.set(origin.x, 0, origin.z)
    material.uniforms.uInner.value = metrics.inner
    material.uniforms.uOuter.value = metrics.outer
  }

  useTask(() => {
    // Follow the shared stage settle so the wash eases in with the march.
    opacity = $battleHud.stageBlend
    material.uniforms.uOpacity.value = opacity
    material.uniforms.uColor.value.copy($dusk ? duskVeil : dayVeil)

    if (opacity < 0.01) {
      mesh.visible = false
      return
    }
    mesh.visible = true
    const active = hexBattleDriver.isActive()
    const origin = active ? hexBattleDriver.getOrigin() : ENCOUNTER_ORIGIN
    const radius = active ? hexBattleDriver.getBoardRadius() : BOARD_RADIUS
    const hexSize = active ? hexBattleDriver.getHexSize() : WORLD_HEX_SIZE
    material.uniforms.uCenter.value.set(origin.x, origin.z)
    material.uniforms.uYaw.value = active ? (hexBattleDriver.getOrigin().yaw ?? 0) : 0
    material.uniforms.uHexSize.value = hexSize
    redrape(origin, radius, hexSize)
  })
</script>

<T is={mesh} />
