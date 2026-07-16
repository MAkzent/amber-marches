# Amber Marches

An original 2.5D exploration vertical slice built with Svelte 5, Threlte and Three.js. Inspired by [Unicorn Overlords](https://www.unicornoverlords.com/) — this is a separate project that borrows the spirit of cinematic fantasy tactics and borderland adventure, not an official or affiliated title.

The first chronicle is **Sunmere Vale**: an authored low-poly valley with a four-hero Minifantasy party, five persistent discoveries, a fixed cinematic camera, contextual UI and an opt-in soundscape.

## Run

```sh
npm install
npm run dev
```

Use WASD or the arrow keys to move, Shift to run, E/Enter/Space to interact, the mouse wheel to zoom, or click the ground to set a destination.

## Verify

```sh
npm run check
npm test
npm run test:e2e
npm run build
```

The Playwright suite captures opening, village, shrine, watchtower/dusk and narrow-screen states in `test-results/`.

## Deploy (Fly.io)

```sh
npm run build
fly deploy
```

## Assets

Environment assets are curated from CC0 KayKit and Kenney packs. The music is CC0. Minifantasy True Heroes sprites are commercially licensed and may not be redistributed as standalone assets. Full provenance and terms are recorded in `public/assets/ASSET-LICENSES.md`.
