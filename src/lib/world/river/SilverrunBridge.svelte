<script lang="ts">
  import { T } from '@threlte/core'
  import {
    BoxGeometry,
    InstancedMesh,
    MeshBasicMaterial,
    MeshToonMaterial,
    Object3D,
  } from 'three'
  import {
    SILVERRUN_SPAN,
    spanDeckHeightAlong,
    spanYawFromAxis,
  } from '../build/crossings'
  import { gbaToonGradient } from '../render/retroPalette'
  import { RIVER_RENDER_ORDER } from './riverConfig'
  import { createBridgeArchSideGeometry, createBridgeWaterShadow } from './bridgeGeometry'
  import BridgeApproachLamps from './BridgeApproachLamps.svelte'

  const span = SILVERRUN_SPAN
  const yaw = spanYawFromAxis(span.axisX, span.axisZ)
  const unitBox = new BoxGeometry(1, 1, 1)
  const stone = new MeshToonMaterial({ color: '#858579', gradientMap: gbaToonGradient })
  const stoneDark = new MeshToonMaterial({ color: '#686d66', gradientMap: gbaToonGradient })
  const capMaterial = new MeshToonMaterial({ color: '#887d68', gradientMap: gbaToonGradient })
  const lampMaterial = new MeshBasicMaterial({ color: '#c8aa70' })
  const dummy = new Object3D()

  const archGeometry = createBridgeArchSideGeometry(span)
  const arches = new InstancedMesh(archGeometry, stoneDark, 2)
  for (const [index, z] of [-span.halfWidth - 0.13, span.halfWidth - 0.11].entries()) {
    dummy.position.set(0, 0, z)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    arches.setMatrixAt(index, dummy.matrix)
  }
  arches.instanceMatrix.needsUpdate = true
  arches.computeBoundingSphere()
  arches.castShadow = true
  arches.receiveShadow = true

  const segmentCount = 12
  const deckReach = span.halfLength + span.approachLength
  const segmentLength = (deckReach * 2) / segmentCount
  const deck = new InstancedMesh(unitBox, stone, segmentCount)
  for (let index = 0; index < segmentCount; index += 1) {
    const x0 = -deckReach + index * segmentLength
    const x1 = x0 + segmentLength
    const y0 = spanDeckHeightAlong(span, x0)
    const y1 = spanDeckHeightAlong(span, x1)
    dummy.position.set((x0 + x1) * 0.5, (y0 + y1) * 0.5 - 0.11, 0)
    dummy.rotation.set(0, 0, Math.atan2(y1 - y0, segmentLength))
    dummy.scale.set(segmentLength * 0.97, 0.24, span.halfWidth * 2 - 0.16)
    dummy.updateMatrix()
    deck.setMatrixAt(index, dummy.matrix)
  }
  deck.instanceMatrix.needsUpdate = true
  deck.computeBoundingSphere()
  deck.castShadow = true
  deck.receiveShadow = true

  const postAlong = span.halfLength * 0.93
  const postAcross = span.halfWidth + 0.05
  const postData = [
    [-postAlong, -postAcross],
    [-postAlong, postAcross],
    [postAlong, -postAcross],
    [postAlong, postAcross],
  ].map(([along, across]) => ({
    along,
    across,
    y: spanDeckHeightAlong(span, along),
  }))

  const posts = new InstancedMesh(unitBox, stoneDark, postData.length)
  const caps = new InstancedMesh(unitBox, capMaterial, postData.length)
  const lamps = new InstancedMesh(unitBox, lampMaterial, postData.length)
  for (let index = 0; index < postData.length; index += 1) {
    const post = postData[index]
    const height = 1

    dummy.position.set(post.along, post.y + height * 0.5, post.across)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(0.32, height, 0.32)
    dummy.updateMatrix()
    posts.setMatrixAt(index, dummy.matrix)

    dummy.position.set(post.along, post.y + height + 0.1, post.across)
    dummy.scale.set(0.42, 0.2, 0.42)
    dummy.updateMatrix()
    caps.setMatrixAt(index, dummy.matrix)

    dummy.position.set(post.along, post.y + height + 0.26, post.across)
    dummy.scale.set(0.12, 0.12, 0.12)
    dummy.updateMatrix()
    lamps.setMatrixAt(index, dummy.matrix)
  }
  for (const mesh of [posts, caps, lamps]) {
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }
  posts.castShadow = true
  posts.receiveShadow = true
  caps.castShadow = true

  const shadow = createBridgeWaterShadow(span)
</script>

<T.Group
  position={[span.x, 0, span.z]}
  rotation={[0, yaw, 0]}
  renderOrder={RIVER_RENDER_ORDER.bridge}
>
  <T.Mesh
    geometry={shadow.geometry}
    material={shadow.material}
    position={[0, span.waterY + 0.038, 0]}
    renderOrder={RIVER_RENDER_ORDER.bridgeShadow}
  />
  <T is={arches} />
  <T is={deck} />
  <T is={posts} />
  <T is={caps} />
  <T is={lamps} />
</T.Group>

<!-- Bank-side tōrō sit in world space so walkHeight can ground them. -->
<BridgeApproachLamps />
