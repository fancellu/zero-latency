# Zero Latency: Anatomy of Local-First Sync

A 15-second explainer in a shadow-puppet theatre style. It is drawn entirely on a 1280×720 canvas, with no images or audio files: the puppets are paths with punched holes, the light, cloth and grain are computed, and the sound is synthesized with Web Audio. Every frame is a pure function of time `t`, so the same `t` always gives the same picture.

## Layout

```
src/
  harness.js            H helper library: seeded RNG, noise, easing, colour, canvas layers, vignette
  sound.js              SOUND kit: synthesized effects, beds, live playback and offline rendering
  scene.js              the style and the story: lamp, cloth weave, gels, puppets, explainer(ctx, W, H, t), DURATION, T timing table
  score.js              scoreSound(k): the sound design, scheduled from the same T table as the picture
  player.tpl.html       player page (canvas + controls); build.cjs inlines the four scripts into it
  storyboard.tpl.html   storyboard page (eight key frames + notes)
  index.tpl.html        index page linking the player and the storyboard, each with a key-frame preview
build.cjs               inlines src/ into self-contained pages in dist/
render.cjs              headless Chrome (Puppeteer) + ffmpeg -> MP4
dist/                   build output (git-ignored): built pages and the rendered MP4
```

## Build the pages

```
npm run build
```

This writes `dist/index.html` (links to the other two), `dist/zero-latency.html` (the player) and `dist/storyboard.html`. All are single self-contained files. They load IM Fell English and Libre Baskerville from Google Fonts. Open `dist/index.html` in a browser.

## Render the video

You need Node 18+ and ffmpeg on your PATH.

```
npm install
npm run render
```

`render.cjs` opens the player page in headless Chrome through Puppeteer. It renders the sound first with `SOUND.renderOffline(scoreSound, DURATION, 48000)` in an OfflineAudioContext. Then, for each frame, it calls `window.seek(i / 30)`, reads the canvas back as PNG and pipes it into ffmpeg (libx264, CRF 17), and finally muxes the audio as AAC. A 15-second render takes about a minute and a half.

If the render machine can't reach Google Fonts, use `npm run render:local` instead. It builds a copy of the player that loads the same fonts from the `@fontsource` npm packages.

To use your own Chrome rather than the one Puppeteer downloads, set `CHROME=/path/to/chrome`. Pass `--fps 60` to `render.cjs` for a different frame rate.

## Editing

- **Timings** live in the `T` table near the bottom of `scene.js`. `score.js` reads the same values, so moving a beat moves its sounds with it.
- **Text** is set where each scene draws it: `header`, `sceneCloud`, `sceneLocal`, `sceneMerge` and `sceneEnd` in `scene.js`.
- **Puppets** are `phone`, `server`, `drum`, `note`, `outbox`, `scissors` and `mergeMill`. The rest (the lamp, cloth weave, grain, plaques, vines, tags, title cards, curtains and hand) comes from the style reference.

The player page exposes `window.seek(t)`, `window.DURATION` and `window.scoreSound` for frame-by-frame rendering.

## How the frames were checked

During development, `render.cjs`-style Puppeteer scripts rendered chosen times to PNG. ffmpeg's `hstack`/`xstack` filters tiled those PNGs into contact sheets for review.
