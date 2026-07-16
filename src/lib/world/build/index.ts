export {
  BRIDGE_SPANS,
  SILVERRUN_SPAN,
  type BridgeSpan,
  anySpanCrossingStrip,
  anySpanWaterShadow,
  findSpanAt,
  halfLengthToBanks,
  onSpanCrossingStrip,
  onSpanDeck,
  projectOntoSpan,
  snapBridgeToRiver,
  spanAbutments,
  spanDeckBlend,
  spanPerp,
  spanWaterShadowFactor,
  spanYawFromAxis,
} from './crossings'

export {
  type RoadDraft,
  type RoadWaypoint,
  buildSnappedRoadNetwork,
  nearestAbutment,
  snapRoadAcrossSpan,
  snapRoadJoinSpan,
} from './snap'
