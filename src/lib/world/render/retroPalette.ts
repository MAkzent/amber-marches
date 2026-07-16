import {
  DataTexture,
  NearestFilter,
  RedFormat,
  UnsignedByteType,
} from 'three'

const gradientData = new Uint8Array([58, 112, 176, 228, 255])

export const gbaToonGradient = new DataTexture(
  gradientData,
  gradientData.length,
  1,
  RedFormat,
  UnsignedByteType,
)

gbaToonGradient.minFilter = NearestFilter
gbaToonGradient.magFilter = NearestFilter
gbaToonGradient.generateMipmaps = false
gbaToonGradient.needsUpdate = true
