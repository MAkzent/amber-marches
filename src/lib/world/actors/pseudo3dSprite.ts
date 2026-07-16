import {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  PlaneGeometry,
  RGBADepthPacking,
  Vector2,
  type Camera,
  type ColorRepresentation,
  type Texture,
} from 'three'

export type Pseudo3DSprite = {
  /** World-anchored root — plant this on the walk surface; never offset Y by hand elsewhere. */
  root: Group
  /** Yaw-only billboard card (visual + outline). */
  body: Group
  mesh: Mesh
  outline: Mesh
  material: MeshBasicMaterial
  outlineMaterial: MeshBasicMaterial
  depthMaterial: MeshDepthMaterial
  radius: number
  height: number
  width: number
  bodyBaseY: number
  plant: (x: number, z: number, surfaceY: number) => void
  setBob: (amount: number) => void
  faceCamera: (camera: Camera) => void
  setMap: (map: Texture) => void
}

/**
 * Foot-weighted depth bias so a vertical card does not z-fight the pitched terrain
 * at the soles, while the head still depth-sorts against buildings.
 */
function applyFootDepthBias(shader: { vertexShader: string }) {
  shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vSpriteUv;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
        vSpriteUv = uv;`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        float foot = 1.0 - vSpriteUv.y;
        gl_Position.z -= foot * foot * 0.005 * gl_Position.w;`,
      )
}

function attachFootDepthBias(material: MeshBasicMaterial | MeshDepthMaterial) {
  material.onBeforeCompile = (shader) => {
    applyFootDepthBias(shader)
  }
  material.customProgramCacheKey = () => 'pseudo3d-foot-bias'
}

/**
 * Pixel-aware form lighting for flat sprite art. It preserves authored bright
 * pixels, rolls shadows toward the world palette, and bevels the alpha
 * silhouette from the upper-left so corners remain crisp rather than reading
 * as a uniformly dark card.
 */
function attachSpriteGrade(material: MeshBasicMaterial, texelSize: Vector2) {
  material.onBeforeCompile = (shader) => {
    applyFootDepthBias(shader)
    shader.uniforms.spriteTexelSize = { value: texelSize }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 spriteTexelSize;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          float spriteAlpha = texture2D(map, vMapUv).a;
          float alphaLeft = texture2D(map, vMapUv - vec2(spriteTexelSize.x, 0.0)).a;
          float alphaRight = texture2D(map, vMapUv + vec2(spriteTexelSize.x, 0.0)).a;
          float alphaUp = texture2D(map, vMapUv + vec2(0.0, spriteTexelSize.y)).a;
          float alphaDown = texture2D(map, vMapUv - vec2(0.0, spriteTexelSize.y)).a;

          float lightEdge = max(
            max(spriteAlpha - alphaLeft, spriteAlpha - alphaUp),
            0.0
          );
          float shadeEdge = max(
            max(spriteAlpha - alphaRight, spriteAlpha - alphaDown),
            0.0
          );

          float spriteLuma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
          vec3 graded = mix(vec3(spriteLuma), diffuseColor.rgb, 0.97);
          graded = max(vec3(0.0), (graded - 0.44) * 1.05 + 0.44);

          float shadow = 1.0 - smoothstep(0.08, 0.42, spriteLuma);
          float highlight = smoothstep(0.42, 0.92, spriteLuma);
          graded = mix(graded, graded * vec3(0.82, 0.91, 1.02), shadow * 0.08);
          graded *= 0.99 + highlight * 0.07;
          graded += vec3(0.11, 0.065, 0.018) * highlight * highlight;

          graded += vec3(0.16, 0.11, 0.045) * lightEdge;
          graded *= 1.0 - shadeEdge * 0.16;
          diffuseColor.rgb = max(graded, vec3(0.0));
        #endif`,
      )
  }
  material.customProgramCacheKey = () => 'pseudo3d-form-grade-v1'
}

/**
 * Expands the source alpha by one sprite texel on the four cardinals only.
 * Skipping diagonals keeps stair-step corners crisp without the heavy corner
 * blobs a full Moore neighborhood produces on large billboards.
 */
function attachPixelOutline(material: MeshBasicMaterial, texelSize: Vector2) {
  material.onBeforeCompile = (shader) => {
    applyFootDepthBias(shader)
    shader.uniforms.spriteTexelSize = { value: texelSize }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 spriteTexelSize;`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        #ifdef USE_MAP
          vec2 px = spriteTexelSize;
          float outlineAlpha = texture2D(map, vMapUv).a;
          outlineAlpha = max(outlineAlpha, texture2D(map, vMapUv + vec2(px.x, 0.0)).a);
          outlineAlpha = max(outlineAlpha, texture2D(map, vMapUv - vec2(px.x, 0.0)).a);
          outlineAlpha = max(outlineAlpha, texture2D(map, vMapUv + vec2(0.0, px.y)).a);
          outlineAlpha = max(outlineAlpha, texture2D(map, vMapUv - vec2(0.0, px.y)).a);
          diffuseColor.rgb = diffuse;
          diffuseColor.a = outlineAlpha * opacity;
        #endif`,
      )
  }
  material.customProgramCacheKey = () => 'pseudo3d-pixel-outline-v2'
}

/**
 * Pseudo-3D sprite: a small 3D actor wrapped around pixel art.
 *
 * Hierarchy:
 *   root          → sits on walkHeight (one ground contact for the whole actor)
 *     body        → yaw-faces camera (cylindrical billboard)
 *       outline
 *       mesh      → vertical card; casts alpha-cutout silhouette shadows
 *
 * Gameplay collision stays an XZ disc of `radius` centered on root — the card is
 * only a visual. That split is what stops "paper plane vs house" bugs.
 */
export function createPseudo3DSprite(options: {
  map: Texture
  height: number
  width?: number
  radius?: number
  outlineColor?: ColorRepresentation
  outlineScale?: number
  /** 0 hides the shader outline (useful when the sheet already has a baked edge). */
  outlineOpacity?: number
  renderOrder?: number
  /** Offsets transparent padding below the artwork so visible feet meet the root. */
  bodyBaseY?: number
}): Pseudo3DSprite {
  const height = options.height
  const width = options.width ?? height * 0.72
  const radius = options.radius ?? Math.max(0.45, width * 0.42)
  const outlineScale = options.outlineScale ?? 1
  const outlineOpacity = options.outlineOpacity ?? 1
  const renderOrder = options.renderOrder ?? 4
  const bodyBaseY = options.bodyBaseY ?? 0
  const texelSize = new Vector2(1 / 128, 1 / 128)

  const updateTexelSize = (map: Texture) => {
    const image = map.image as { width?: number; height?: number } | undefined
    texelSize.set(1 / (image?.width || 128), 1 / (image?.height || 128))
  }
  updateTexelSize(options.map)

  const root = new Group()
  root.userData.pseudo3dSprite = true

  const body = new Group()
  body.position.y = bodyBaseY
  root.add(body)

  const geometry = new PlaneGeometry(width, height)
  geometry.translate(0, height / 2, 0)

  const material = new MeshBasicMaterial({
    map: options.map,
    transparent: true,
    alphaTest: 0.22,
    depthTest: true,
    depthWrite: true,
    toneMapped: true,
  })
  attachSpriteGrade(material, texelSize)

  const depthMaterial = new MeshDepthMaterial({
    map: options.map,
    alphaTest: 0.22,
    depthPacking: RGBADepthPacking,
  })
  attachFootDepthBias(depthMaterial)

  const mesh = new Mesh(geometry, material)
  mesh.castShadow = true
  mesh.receiveShadow = false
  mesh.customDepthMaterial = depthMaterial
  mesh.renderOrder = renderOrder
  mesh.frustumCulled = false

  const outlineMaterial = new MeshBasicMaterial({
    map: options.map,
    color: options.outlineColor ?? '#10120f',
    transparent: true,
    opacity: outlineOpacity,
    alphaTest: 0.22,
    depthTest: true,
    depthWrite: false,
    toneMapped: true,
  })
  attachPixelOutline(outlineMaterial, texelSize)

  const outline = new Mesh(geometry, outlineMaterial)
  outline.castShadow = false
  outline.receiveShadow = false
  outline.scale.set(outlineScale, outlineScale, 1)
  outline.renderOrder = renderOrder - 1
  outline.frustumCulled = false
  outline.visible = outlineOpacity > 0.01

  body.add(outline)
  body.add(mesh)

  const plant = (x: number, z: number, surfaceY: number) => {
    root.position.set(x, surfaceY, z)
  }

  const setBob = (amount: number) => {
    body.position.y = bodyBaseY + amount
  }

  const faceCamera = (camera: Camera) => {
    // Cylindrical billboard: yaw the card only — root stays planted, no pitch/roll.
    body.rotation.y = Math.atan2(
      camera.position.x - root.position.x,
      camera.position.z - root.position.z,
    )
  }

  const setMap = (map: Texture) => {
    updateTexelSize(map)
    if (material.map === map) return
    material.map = map
    outlineMaterial.map = map
    depthMaterial.map = map
    material.needsUpdate = true
    outlineMaterial.needsUpdate = true
    depthMaterial.needsUpdate = true
  }

  return {
    root,
    body,
    mesh,
    outline,
    material,
    outlineMaterial,
    depthMaterial,
    radius,
    height,
    width,
    bodyBaseY,
    plant,
    setBob,
    faceCamera,
    setMap,
  }
}
