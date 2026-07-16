<script lang="ts">
  import { onMount } from 'svelte'
  import WorldCanvas from './lib/world/WorldCanvas.svelte'
  import WorldHud from './lib/ui/WorldHud.svelte'
  import CrtMonitor from './lib/ui/CrtMonitor.svelte'
  import { createAudioDirector } from './lib/audio/audioDirector'
  import { reducedMotion } from './lib/world/worldState'

  onMount(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncMotion = () => reducedMotion.set(media.matches)
    syncMotion()
    media.addEventListener('change', syncMotion)
    const destroyAudio = createAudioDirector()
    return () => {
      media.removeEventListener('change', syncMotion)
      destroyAudio()
    }
  })
</script>

<main class="game-shell">
  <CrtMonitor>
    <WorldCanvas />
    <WorldHud />
  </CrtMonitor>
</main>
