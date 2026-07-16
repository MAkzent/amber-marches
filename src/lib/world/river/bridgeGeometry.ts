import { ExtrudeGeometry, Path, PlaneGeometry, Shape, ShaderMaterial } from 'three'
import { type BridgeSpan, spanDeckHeightAlong } from '../build/crossings'

export function createBridgeArchSideGeometry(span: BridgeSpan) {
  const baseY = span.waterY - 0.58
  const parapetHeight = 0.68
  const shape = new Shape()
  shape.moveTo(-span.halfLength, baseY)
  shape.lineTo(-span.halfLength, spanDeckHeightAlong(span, -span.halfLength) + parapetHeight)
  const topSegments = 20
  for (let index = 1; index <= topSegments; index += 1) {
    const along = -span.halfLength + (index / topSegments) * span.halfLength * 2
    shape.lineTo(along, spanDeckHeightAlong(span, along) + parapetHeight)
  }
  shape.lineTo(span.halfLength, baseY)
  shape.closePath()

  const openingHalf = span.halfLength * 0.76
  const opening = new Path()
  opening.moveTo(-openingHalf, baseY - 0.12)
  opening.lineTo(-openingHalf, span.waterY - 0.16)
  opening.bezierCurveTo(
    -openingHalf * 0.72,
    span.deckY - 0.08,
    -openingHalf * 0.28,
    span.deckY + span.crown - 0.2,
    0,
    span.deckY + span.crown - 0.18,
  )
  opening.bezierCurveTo(
    openingHalf * 0.28,
    span.deckY + span.crown - 0.2,
    openingHalf * 0.72,
    span.deckY - 0.08,
    openingHalf,
    span.waterY - 0.16,
  )
  opening.lineTo(openingHalf, baseY - 0.12)
  opening.closePath()
  shape.holes.push(opening)

  const geometry = new ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSize: 0.035,
    bevelThickness: 0.035,
    bevelSegments: 1,
    curveSegments: 10,
  })
  geometry.computeVertexNormals()
  return geometry
}

export function createBridgeWaterShadow(span: BridgeSpan) {
  const geometry = new PlaneGeometry(
    (span.halfLength + 0.35) * 2,
    (span.halfWidth + 0.55) * 2,
    1,
    1,
  )
  geometry.rotateX(-Math.PI / 2)
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: {},
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        vec2 p = abs(vUv * 2.0 - 1.0);
        float box = 1.0 - smoothstep(0.48, 1.0, max(p.x, p.y));
        float archBreak = 0.78 + 0.22 * smoothstep(0.0, 0.8, p.x);
        gl_FragColor = vec4(0.055, 0.085, 0.1, box * archBreak * 0.42);
      }
    `,
  })
  return { geometry, material }
}
