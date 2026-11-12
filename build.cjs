// Inline the source files into the self-contained pages in dist/.
//
//   node build.cjs               # dist/index.html, dist/zero-latency.html and dist/storyboard.html (fonts from Google Fonts)
//   node build.cjs --local-fonts # also dist/zero-latency.local.html, which loads the fonts from
//                                # node_modules/@fontsource instead (for offline or sandboxed rendering)
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src'), DIST = path.join(ROOT, 'dist');
fs.mkdirSync(DIST, { recursive: true });

const src = (name) => fs.readFileSync(path.join(SRC, name), 'utf8');

// Function replacements so `$` sequences in the sources are inserted literally.
function inline(tpl, parts) {
  for (const [key, name] of parts) {
    const body = src(name);
    tpl = tpl.replaceAll(`/*__${key}__*/`, () => body);
  }
  if (tpl.includes('/*__')) throw new Error('unfilled placeholder');
  return tpl;
}

const player = inline(src('player.tpl.html'), [['HARNESS', 'harness.js'], ['SOUND', 'sound.js'], ['SCENE', 'scene.js'], ['SCORE', 'score.js']]);
const board = inline(src('storyboard.tpl.html'), [['HARNESS', 'harness.js'], ['SCENE', 'scene.js']]);
const index = inline(src('index.tpl.html'), [['HARNESS', 'harness.js'], ['SCENE', 'scene.js']]);
fs.writeFileSync(path.join(DIST, 'zero-latency.html'), player, 'utf8');
fs.writeFileSync(path.join(DIST, 'storyboard.html'), board, 'utf8');
fs.writeFileSync(path.join(DIST, 'index.html'), index, 'utf8');
console.log('wrote dist/zero-latency.html, dist/storyboard.html, dist/index.html');

if (process.argv.includes('--local-fonts')) {
  const fsrc = pathToFileURL(path.join(ROOT, 'node_modules', '@fontsource')).href;
  const faces =
    `@font-face{font-family:'IM Fell English';src:url(${fsrc}/im-fell-english/files/im-fell-english-latin-400-normal.woff2)}` +
    `@font-face{font-family:'IM Fell English';font-style:italic;src:url(${fsrc}/im-fell-english/files/im-fell-english-latin-400-italic.woff2)}` +
    `@font-face{font-family:'Libre Baskerville';src:url(${fsrc}/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2)}`;
  const local = player.replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, () => `<style>${faces}</style>`);
  fs.writeFileSync(path.join(DIST, 'zero-latency.local.html'), local, 'utf8');
  console.log('wrote dist/zero-latency.local.html (local fonts)');
}
