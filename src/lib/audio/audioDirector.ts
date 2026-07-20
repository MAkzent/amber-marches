import type { Unsubscriber } from 'svelte/store'
import { audioEnabled, completedDiscoveries, weatherMode, type WeatherMode } from '../world/worldState'
import { combatAudioEvent, type CombatAudioKind } from '../world/combat/runtime'

type AudioNodes = {
  context: AudioContext
  master: GainNode
  wind: AudioBufferSourceNode
  windGain: GainNode
  river: AudioBufferSourceNode
  rain: AudioBufferSourceNode
  rainFilter: BiquadFilterNode
  rainGain: GainNode
  music: HTMLAudioElement
  birdTimer: ReturnType<typeof setInterval>
}

function weatherAmbienceGain(weather: WeatherMode) {
  if (weather === 'sunshower') return 0.075
  if (weather === 'snow') return 0.042
  return 0.0001
}

function applyWeatherAmbience(nodes: AudioNodes, weather: WeatherMode, now: number) {
  const filter = nodes.rainFilter
  filter.frequency.cancelScheduledValues(now)
  if (weather === 'snow') {
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(filter.frequency.value, now)
    filter.frequency.linearRampToValueAtTime(820, now + 1.2)
  } else {
    filter.type = 'highpass'
    filter.frequency.setValueAtTime(filter.frequency.value || 3100, now)
    filter.frequency.linearRampToValueAtTime(3100, now + 1.2)
  }

  nodes.rainGain.gain.cancelScheduledValues(now)
  nodes.rainGain.gain.linearRampToValueAtTime(weatherAmbienceGain(weather), now + 1.2)

  nodes.windGain.gain.cancelScheduledValues(now)
  nodes.windGain.gain.linearRampToValueAtTime(weather === 'snow' ? 0.32 : 0.24, now + 1.2)
}

function whiteNoiseBuffer(context: AudioContext, seconds: number) {
  const length = Math.floor(context.sampleRate * seconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) channel[index] = Math.random() * 2 - 1
  return buffer
}

function noiseBuffer(context: AudioContext, seconds: number) {
  const length = Math.floor(context.sampleRate * seconds)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const channel = buffer.getChannelData(0)
  let last = 0
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1
    last = last * 0.985 + white * 0.015
    channel[index] = last
  }
  return buffer
}

function chirp(context: AudioContext, output: AudioNode) {
  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const pan = context.createStereoPanner()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(1300 + Math.random() * 500, now)
  oscillator.frequency.exponentialRampToValueAtTime(2200 + Math.random() * 700, now + 0.12)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.025, now + 0.025)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22)
  pan.pan.value = Math.random() * 1.6 - 0.8
  oscillator.connect(gain).connect(pan).connect(output)
  oscillator.start(now)
  oscillator.stop(now + 0.24)
}

function combatCue(nodes: AudioNodes, kind: CombatAudioKind, hits: number) {
  const context = nodes.context
  if (context.state !== 'running') return
  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  const pan = context.createStereoPanner()

  if (kind === 'swing') {
    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(240, now)
    oscillator.frequency.exponentialRampToValueAtTime(82, now + 0.13)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.018, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
  } else {
    oscillator.type = kind === 'defeat' ? 'square' : 'triangle'
    oscillator.frequency.setValueAtTime(kind === 'defeat' ? 118 : 165, now)
    oscillator.frequency.exponentialRampToValueAtTime(
      kind === 'defeat' ? 42 : 68,
      now + (kind === 'defeat' ? 0.3 : 0.14),
    )
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(
      Math.min(0.055, 0.025 + hits * 0.007),
      now + 0.008,
    )
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + (kind === 'defeat' ? 0.34 : 0.17),
    )

    const noise = context.createBufferSource()
    const noiseGain = context.createGain()
    const filter = context.createBiquadFilter()
    noise.buffer = whiteNoiseBuffer(context, 0.16)
    filter.type = 'bandpass'
    filter.frequency.value = kind === 'defeat' ? 280 : 720
    filter.Q.value = 0.7
    noiseGain.gain.setValueAtTime(Math.min(0.04, 0.014 + hits * 0.005), now)
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14)
    noise.connect(filter).connect(noiseGain).connect(nodes.master)
    noise.start(now)
    noise.stop(now + 0.16)
  }

  pan.pan.value = (Math.random() - 0.5) * 0.32
  oscillator.connect(gain).connect(pan).connect(nodes.master)
  oscillator.start(now)
  oscillator.stop(now + (kind === 'defeat' ? 0.36 : 0.18))
}

function createNodes() {
  const context = new AudioContext()
  const master = context.createGain()
  const compressor = context.createDynamicsCompressor()
  master.gain.value = 0.0001
  master.connect(compressor).connect(context.destination)

  const wind = context.createBufferSource()
  wind.buffer = noiseBuffer(context, 5)
  wind.loop = true
  const windFilter = context.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 760
  const windGain = context.createGain()
  windGain.gain.value = 0.24
  wind.connect(windFilter).connect(windGain).connect(master)
  wind.start()

  const river = context.createBufferSource()
  river.buffer = noiseBuffer(context, 3)
  river.loop = true
  const riverFilter = context.createBiquadFilter()
  riverFilter.type = 'bandpass'
  riverFilter.frequency.value = 1650
  riverFilter.Q.value = 0.35
  const riverGain = context.createGain()
  riverGain.gain.value = 0.095
  river.connect(riverFilter).connect(riverGain).connect(master)
  river.start()

  const rain = context.createBufferSource()
  rain.buffer = whiteNoiseBuffer(context, 2)
  rain.loop = true
  const rainFilter = context.createBiquadFilter()
  rainFilter.type = 'highpass'
  rainFilter.frequency.value = 3100
  const rainGain = context.createGain()
  rainGain.gain.value = 0.075
  rain.connect(rainFilter).connect(rainGain).connect(master)
  rain.start()

  const music = new Audio('/assets/audio/old-tower-inn.mp3')
  music.loop = true
  music.preload = 'auto'
  const musicSource = context.createMediaElementSource(music)
  const musicGain = context.createGain()
  musicGain.gain.value = 0.22
  musicSource.connect(musicGain).connect(master)

  const birdTimer = setInterval(() => {
    if (context.state === 'running' && Math.random() > 0.28) chirp(context, master)
  }, 2600)

  return { context, master, wind, windGain, river, rain, rainFilter, rainGain, music, birdTimer }
}

export function createAudioDirector() {
  let nodes: AudioNodes | null = null
  let unsubscribeAudio: Unsubscriber | undefined
  let unsubscribeDiscoveries: Unsubscriber | undefined
  let unsubscribeWeather: Unsubscriber | undefined
  let unsubscribeCombat: Unsubscriber | undefined
  let currentWeather: WeatherMode = 'sunshower'
  let lastCombatAudioSerial = 0

  unsubscribeAudio = audioEnabled.subscribe(async (enabled) => {
    if (enabled && !nodes) {
      nodes = createNodes()
      applyWeatherAmbience(nodes, currentWeather, nodes.context.currentTime)
    }
    if (!nodes) return
    if (enabled) {
      await nodes.context.resume()
      await nodes.music.play().catch(() => undefined)
    }
    const now = nodes.context.currentTime
    nodes.master.gain.cancelScheduledValues(now)
    nodes.master.gain.setValueAtTime(Math.max(nodes.master.gain.value, 0.0001), now)
    nodes.master.gain.exponentialRampToValueAtTime(enabled ? 0.7 : 0.0001, now + 0.7)
    if (!enabled) setTimeout(() => nodes?.context.suspend(), 760)
  })

  unsubscribeDiscoveries = completedDiscoveries.subscribe((completed) => {
    if (!nodes || nodes.context.state !== 'running' || completed.size === 0) return
    const context = nodes.context
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(392, now)
    oscillator.frequency.setValueAtTime(523.25, now + 0.16)
    oscillator.frequency.setValueAtTime(659.25, now + 0.32)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85)
    oscillator.connect(gain).connect(nodes.master)
    oscillator.start(now)
    oscillator.stop(now + 0.9)
  })

  unsubscribeWeather = weatherMode.subscribe((weather) => {
    currentWeather = weather
    if (!nodes) return
    applyWeatherAmbience(nodes, weather, nodes.context.currentTime)
  })

  unsubscribeCombat = combatAudioEvent.subscribe((event) => {
    if (event.serial === 0 || event.serial === lastCombatAudioSerial) return
    lastCombatAudioSerial = event.serial
    if (nodes) combatCue(nodes, event.kind, event.hits)
  })

  return () => {
    unsubscribeAudio?.()
    unsubscribeDiscoveries?.()
    unsubscribeWeather?.()
    unsubscribeCombat?.()
    if (!nodes) return
    clearInterval(nodes.birdTimer)
    nodes.wind.stop()
    nodes.river.stop()
    nodes.rain.stop()
    nodes.music.pause()
    nodes.music.src = ''
    nodes.context.close()
    nodes = null
  }
}
