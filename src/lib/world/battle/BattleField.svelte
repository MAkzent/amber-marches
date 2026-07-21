<script lang="ts">
  import { T, useTask } from '@threlte/core'
  import {
    Color,
    BufferGeometry,
    DataTexture,
    DoubleSide,
    Mesh,
    ShaderMaterial,
    Vector2,
  } from 'three'
  import { BOARD_RADIUS, WORLD_HEX_SIZE, hexBattleDriver } from '../../battle'
  import { battleHud } from './battleBridge'
  import { placementHighlight } from './placementHighlight'
  import { RIVER_OUTPUT_CHUNK } from '../river/riverShaderChunks'
  import {
    HEX_BOARD_GLSL,
    createCellKindTexture,
    createTerrainHexPatchGeometry,
    packCellKindData,
  } from './hexBoardShader'
  import { BATTLE_MARKER } from './battleMarker'

  const FILL_LIFT = 0.045
  const FILL_RENDER_ORDER = 1

  /** Formation colors sit above a quiet persistent arena skin. */
  const HERO_DEPLOY_OP = 0.42
  const ENEMY_DEPLOY_OP = 0.32
  const HIGHLIGHT_OP = 0.7

  /** Sentinel when no drag-highlight cell is active. */
  const NO_HIGHLIGHT = new Vector2(-999, -999)

  let atlas: DataTexture | null = null
  let geometry: BufferGeometry | null = null

  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uOrigin: { value: new Vector2(0, 0) },
      uYaw: { value: 0 },
      uHexSize: { value: WORLD_HEX_SIZE },
      uBoardRadius: { value: BOARD_RADIUS },
      uAtlasRadius: { value: BOARD_RADIUS },
      uCellAtlas: { value: null as DataTexture | null },
      uHighlightQR: { value: NO_HIGHLIGHT.clone() },
      uHighlightValid: { value: 1 },
      uStageBlend: { value: 0 },
      uFightFade: { value: 0 },
      uPlainColor: { value: new Color(BATTLE_MARKER.plainColor) },
      uRingColor: { value: new Color(BATTLE_MARKER.ringColor) },
      uHeroColor: { value: new Color('#5a9ef0') },
      uEnemyColor: { value: new Color('#d87868') },
      uHighlightColor: { value: new Color('#ffe08a') },
      uInvalidColor: { value: new Color('#c86f72') },
      uPlainOp: { value: BATTLE_MARKER.plainOpacity },
      uRingOp: { value: BATTLE_MARKER.ringOpacity },
      uCombatRetain: { value: BATTLE_MARKER.combatRetain },
      uHeroOp: { value: HERO_DEPLOY_OP },
      uEnemyOp: { value: ENEMY_DEPLOY_OP },
      uHighlightOp: { value: HIGHLIGHT_OP },
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
      uniform vec2 uOrigin;
      uniform float uYaw;
      uniform float uHexSize;
      uniform float uBoardRadius;
      uniform int uAtlasRadius;
      uniform sampler2D uCellAtlas;
      uniform vec2 uHighlightQR;
      uniform float uHighlightValid;
      uniform float uStageBlend;
      uniform float uFightFade;
      uniform vec3 uPlainColor;
      uniform vec3 uRingColor;
      uniform vec3 uHeroColor;
      uniform vec3 uEnemyColor;
      uniform vec3 uHighlightColor;
      uniform vec3 uInvalidColor;
      uniform float uPlainOp;
      uniform float uRingOp;
      uniform float uCombatRetain;
      uniform float uHeroOp;
      uniform float uEnemyOp;
      uniform float uHighlightOp;
      varying vec3 vWorldPos;

      ${HEX_BOARD_GLSL}

      vec2 axialToLocal(vec2 qr, float hexSize) {
        return vec2(
          hexSize * HEX_SQRT3 * (qr.x + qr.y * 0.5),
          hexSize * 1.5 * qr.y
        );
      }

      // Pointy-top hex SDF (negative inside). cornerR = centre-to-vertex.
      float sdPointyHex(vec2 p, float cornerR) {
        float ca = 0.866025404;
        float sa = 0.5;
        // Rotate +30° into flat-top frame, then Inigo hex with apothem.
        vec2 q = vec2(ca * p.x - sa * p.y, sa * p.x + ca * p.y);
        vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
        float r = cornerR * ca;
        q = abs(q);
        q -= 2.0 * min(dot(k.xy, q), 0.0) * k.xy;
        q -= vec2(clamp(q.x, -k.z * r, k.z * r), r);
        return length(q) * sign(q.y);
      }

      void main() {
        if (uStageBlend < 0.004) discard;

        vec2 local = worldToLocalXZ(vWorldPos.xz, uOrigin, uYaw);
        vec2 axial = localToAxial(local, uHexSize);
        ivec2 cell = hexRound(axial);

        float boardDist = hexDistanceAxial(vec2(float(cell.x), float(cell.y)));
        if (boardDist > uBoardRadius + 0.01) discard;

        bool highlighted =
          abs(float(cell.x) - uHighlightQR.x) < 0.5 &&
          abs(float(cell.y) - uHighlightQR.y) < 0.5;

        int kind = sampleCellKind(uCellAtlas, cell, uAtlasRadius);
        if (kind == 0 && !highlighted) discard;

        float continuousBoardDist = hexDistanceAxial(axial);
        float outerRing = smoothstep(
          uBoardRadius - 0.08,
          uBoardRadius + 0.42,
          continuousBoardDist
        );
        vec3 markerColor = mix(uPlainColor, uRingColor, outerRing);
        float markerOp = kind > 0 ? uPlainOp + outerRing * uRingOp : 0.0;

        vec3 actionColor = uInvalidColor;
        float actionOp = 0.0;
        if (kind == 2) {
          actionColor = uHeroColor;
          actionOp = uHeroOp;
        } else if (kind == 3) {
          actionColor = uEnemyColor;
          actionOp = uEnemyOp;
        }

        if (highlighted) {
          actionColor = mix(uInvalidColor, uHighlightColor, uHighlightValid);
          actionOp = uHighlightOp;
        }

        vec2 center = axialToLocal(vec2(float(cell.x), float(cell.y)), uHexSize);
        // Slight inset so neighbouring fills don’t double-stack at shared edges.
        float sd = sdPointyHex(local - center, uHexSize * 0.96);
        // Soft AA — no hard stroke; edges blend instead of stair-stepping.
        float fw = max(fwidth(sd), 0.002);
        float fillMask = 1.0 - smoothstep(-fw * 0.5, fw * 2.0, sd);

        float markerFade = mix(1.0, uCombatRetain, uFightFade);
        float markerAlpha = markerOp * fillMask * uStageBlend * markerFade;
        float actionAlpha = actionOp * fillMask * uStageBlend * (1.0 - uFightFade);
        if (highlighted) {
          actionAlpha = max(
            actionAlpha,
            uHighlightOp * fillMask * max(uStageBlend, 0.35)
          );
        }

        float alpha = max(markerAlpha, actionAlpha);
        if (alpha < 0.004) discard;
        vec3 color = actionAlpha > markerAlpha ? actionColor : markerColor;
        gl_FragColor = vec4(color, alpha);
        ${RIVER_OUTPUT_CHUNK}
      }
    `,
  })

  const mesh = new Mesh(new BufferGeometry(), material)
  mesh.renderOrder = FILL_RENDER_ORDER
  mesh.frustumCulled = false
  mesh.visible = false

  function disposeAtlases() {
    if (atlas) {
      atlas.dispose()
      atlas = null
    }
    material.uniforms.uCellAtlas.value = null
  }

  function rebuildBoard() {
    disposeAtlases()
    if (!hexBattleDriver.isActive()) {
      mesh.visible = false
      return
    }

    const origin = hexBattleDriver.getOrigin()
    const hexSize = hexBattleDriver.getHexSize()
    const radius = hexBattleDriver.getBoardRadius()
    const blocked = hexBattleDriver.getBlockedCells()

    const data = packCellKindData(radius, {
      heroDeploy: hexBattleDriver.getHeroDeployCells(),
      enemyDeploy: hexBattleDriver.getEnemyDeployCells(),
      blocked,
    })
    atlas = createCellKindTexture(data, radius)
    material.uniforms.uCellAtlas.value = atlas
    material.uniforms.uAtlasRadius.value = radius
    material.uniforms.uBoardRadius.value = radius
    material.uniforms.uHexSize.value = hexSize
    material.uniforms.uYaw.value = origin.yaw ?? 0
    material.uniforms.uOrigin.value.set(origin.x, origin.z)

    if (geometry) geometry.dispose()
    else mesh.geometry.dispose()
    geometry = createTerrainHexPatchGeometry(origin, hexSize, radius, FILL_LIFT)
    mesh.geometry = geometry
    mesh.position.set(origin.x, 0, origin.z)
  }

  let wasActive = false
  let fightFade = 0
  useTask((delta) => {
    const active = hexBattleDriver.isActive() && $battleHud.phase !== 'idle'
    if (active && !wasActive) rebuildBoard()
    if (!active && wasActive) {
      disposeAtlases()
      mesh.visible = false
    }
    wasActive = active

    const blend = $battleHud.stageBlend
    material.uniforms.uStageBlend.value = blend
    const actionTilesHidden = $battleHud.fighting || $battleHud.over
    if ($battleHud.over) fightFade = 1
    else {
      const fightTarget = actionTilesHidden ? 1 : 0
      fightFade += (fightTarget - fightFade) * (1 - Math.pow(0.025, delta))
    }
    material.uniforms.uFightFade.value = fightFade
    mesh.visible = active && blend > 0.004

    if (!active) return

    const origin = hexBattleDriver.getOrigin()
    material.uniforms.uOrigin.value.set(origin.x, origin.z)
    material.uniforms.uYaw.value = origin.yaw ?? 0
    mesh.position.set(origin.x, 0, origin.z)

    const hl = $placementHighlight
    if (hl) {
      material.uniforms.uHighlightQR.value.set(hl.q, hl.r)
      material.uniforms.uHighlightValid.value = hl.valid ? 1 : 0
    } else {
      material.uniforms.uHighlightQR.value.copy(NO_HIGHLIGHT)
      material.uniforms.uHighlightValid.value = 1
    }
  })
</script>

<T is={mesh} />
