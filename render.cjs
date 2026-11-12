// Render the player page to MP4, frame by frame, in headless Chrome (Puppeteer) + ffmpeg.
//
//   node render.cjs [page.html] [out.mp4] [--fps 30]
//
// Picture: for each frame i, window.seek(i / fps) draws the frame, the canvas is read back as PNG and piped
// into ffmpeg (libx264). Sound: SOUND.renderOffline(window.scoreSound, DURATION, 48000) renders the effects
// mix in an OfflineAudioContext, which is written as raw float32 and muxed in as AAC.
// Set CHROME=/path/to/chrome to use a specific browser instead of Puppeteer's bundled one.
const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const args = process.argv.slice(2);
const fpsAt = args.indexOf('--fps');
const FPS = fpsAt >= 0 ? Number(args.splice(fpsAt, 2)[1]) : 30;
const SRC = path.resolve(args[0] || 'dist/zero-latency.html');
const OUT = path.resolve(args[1] || 'dist/zero-latency.mp4');

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zl-render-'));
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME || undefined,
    args: ['--no-sandbox', '--allow-file-access-from-files', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto('file://' + SRC);
  await page.waitForFunction(() => window.__ready, { timeout: 60000 });   // fonts loaded, first frame drawn
  const D = await page.evaluate(() => window.DURATION);

  // ---- sound
  const audio = await page.evaluate(async (D) => {
    const o = await SOUND.renderOffline(window.scoreSound, D, 48000, { voiceover: false });
    const u8 = new Uint8Array(o.inter.buffer); let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { b64: btoa(s), peak: o.peak };
  }, D);
  const pcm = path.join(tmp, 'fx.f32');
  fs.writeFileSync(pcm, Buffer.from(audio.b64, 'base64'));
  console.log(`audio rendered, peak ${audio.peak.toFixed(3)}`);

  // ---- picture -> ffmpeg
  const ff = spawn('ffmpeg', ['-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-f', 'f32le', '-ar', '48000', '-ac', '2', '-i', pcm,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', OUT], { stdio: ['pipe', 'inherit', 'inherit'] });
  const N = Math.round(D * FPS);
  for (let i = 0; i < N; i++) {
    const url = await page.evaluate((t) => { seek(t); return document.getElementById('c').toDataURL('image/png'); }, i / FPS);
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 30 === 0) process.stdout.write(`\rframe ${i}/${N}`);
  }
  ff.stdin.end();
  const code = await new Promise((r) => ff.on('close', r));
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (code !== 0) { console.error('\nffmpeg failed'); process.exit(1); }
  console.log(`\rwrote ${OUT} (${N} frames at ${FPS} fps)`);
})();
