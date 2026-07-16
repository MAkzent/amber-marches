<script lang="ts">
  /**
   * Silverrun root: translucent water shader (clear shallow + surface waves),
   * pooled splash/wake FX, projected bridge shadow, and the stone bridge.
   */
  import RiverSurface from './RiverSurface.svelte'
  import RiverFoamFx from './RiverFoamFx.svelte'
  import SilverrunBridge from './SilverrunBridge.svelte'
</script>

<RiverSurface />
<RiverFoamFx />
<SilverrunBridge />
