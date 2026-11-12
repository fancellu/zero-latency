// ===================== Shadow Puppet Theatre: "Zero Latency: Anatomy of Local-First Sync" =====================
// Pipeline per frame (from the reference): lamp light on the cloth -> coloured gels (multiply) -> silhouettes (each
// puppet on its own scratch layer, holes punched with destination-out, laid on the shadow layer, blurred if held away
// from the screen) -> rods -> cloth weave, light diffusion, grain, vignette.
const INK = 'rgb(20,8,4)';
const FF = '"IM Fell English"';
const NF = '"Libre Baskerville"';
const TAU = Math.PI * 2;
const NZ = H.makeNoise(4242);
const sm = H.smooth, cl = H.clamp, lerp = H.lerp, EO = H.ease.out, EIO = H.ease.inOut;
const GEL = { teal: 'rgb(92,206,170)', red: 'rgb(238,84,56)', amber: 'rgb(255,204,96)', green: 'rgb(124,222,120)', blue: 'rgb(110,178,236)', gold: 'rgb(255,214,96)', pale: 'rgb(255,240,206)' };
const LAY = {};
function lay(name, w, h) {
  let c = LAY[name];
  if (!c) c = LAY[name] = H.layer(w, h);
  const x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.filter = 'none';
  x.clearRect(0, 0, c.width, c.height);
  return c;
}

// ---------- small drawing helpers (reference) ----------
function cut(p, fn) { p.save(); p.globalCompositeOperation = 'destination-out'; p.fillStyle = '#000'; p.strokeStyle = '#000'; fn(); p.restore(); }
function dot(c, x, y, r) { c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); c.fill(); }
function tear(c, x, y, len, w, a) {
  c.save(); c.translate(x, y); c.rotate(a);
  c.beginPath(); c.moveTo(0, -w / 2); c.quadraticCurveTo(len * 0.55, -w * 0.45, len, 0); c.quadraticCurveTo(len * 0.55, w * 0.45, 0, w / 2);
  c.arc(0, 0, w / 2, Math.PI / 2, Math.PI * 1.5); c.fill(); c.restore();
}
function pin(p, x, y, r) { r = r || 8; cut(p, () => dot(p, x, y, r)); p.fillStyle = INK; dot(p, x, y, r * 0.55); }
function gearPath(c, r, n, depth, rot) {
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + i * TAU / n, s = TAU / n;
    [[a0, r - depth], [a0 + s * 0.12, r], [a0 + s * 0.42, r], [a0 + s * 0.54, r - depth]].forEach(([a, rr], k) => {
      const X = Math.cos(a) * rr, Y = Math.sin(a) * rr;
      if (i === 0 && k === 0) c.moveTo(X, Y); else c.lineTo(X, Y);
    });
  }
  c.closePath();
}
const both = (cs, fn) => cs.forEach(fn);
const wpt = (p, x, y) => { const q = p.getTransform().transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
const bz = (P, u) => { const v = 1 - u; return [v * v * v * P[0][0] + 3 * v * v * u * P[1][0] + 3 * v * u * u * P[2][0] + u * u * u * P[3][0], v * v * v * P[0][1] + 3 * v * v * u * P[1][1] + 3 * v * u * u * P[2][1] + u * u * u * P[3][1]]; };
const bzA = (P, u) => { const a = bz(P, Math.max(0, u - 0.01)), b = bz(P, Math.min(1, u + 0.01)); return Math.atan2(b[1] - a[1], b[0] - a[0]); };
const swing = (t, t0, amp, k, w) => (t > t0 ? amp * Math.exp(-(t - t0) * k) * Math.sin((t - t0) * w) : 0);
const hop = (u, n, h) => Math.abs(Math.sin(u * Math.PI * n)) * h * (1 - u);

// ---------- frame lifecycle (reference) ----------
function begin(W, Hh) { return { W, Hh, S: lay('S', W, Hh), G: lay('G', W, Hh), rods: [] }; }
function pup(st, o, fn) {
  const P = lay('P', st.W, st.Hh), p = P.getContext('2d'), g = st.G.getContext('2d');
  p.fillStyle = INK; p.strokeStyle = INK;
  g.save(); fn(p, g, st.rods); g.restore();
  const s = st.S.getContext('2d');
  s.save(); s.globalAlpha = o.alpha == null ? 1 : o.alpha; if (o.blur) s.filter = `blur(${o.blur}px)`; s.drawImage(P, 0, 0); s.restore();
}
const STOPS = [[0, [255, 232, 168]], [0.16, [255, 200, 104]], [0.42, [238, 132, 46]], [0.68, [168, 60, 20]], [0.88, [84, 24, 9]], [1, [38, 10, 4]]];
function lamp(ctx, W, Hh, t, b, flare) {
  const f = 1 + 0.045 * NZ.n2(t * 6.1, 0.3) + 0.025 * NZ.n2(t * 17.3, 2.2);
  const B = Math.max(0, b * f);
  const cx = 640 + NZ.n2(t * 0.9, 5) * 12, cy = 320 + NZ.n2(7, t * 0.8) * 9;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, Hh);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 860 + (flare || 0) * 200);
  STOPS.forEach(([o, c]) => g.addColorStop(o, H.rgba(c.map((v) => Math.min(255, v * B + (255 - v) * (flare || 0) * 0.7)), 1)));
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, Hh);
}
function weave(W, Hh) {
  if (LAY._weave) return LAY._weave;
  const c = H.layer(W, Hh), x = c.getContext('2d'), img = x.createImageData(W, Hh), d = img.data, r = H.rng(77);
  const row = Float32Array.from({ length: Hh }, () => 0.6 + r() * 0.8), col = Float32Array.from({ length: W }, () => 0.6 + r() * 0.8);
  for (let y = 0; y < Hh; y++) for (let X = 0; X < W; X++) {
    const i = (y * W + X) * 4;
    const th = (y % 3 === 0 ? 1 : y % 3 === 1 ? 0.35 : 0) * row[y] * (0.7 + 0.3 * Math.sin(X * 0.05 + row[y] * 9));
    const tv = (X % 3 === 0 ? 1 : X % 3 === 1 ? 0.3 : 0) * col[X] * (0.7 + 0.3 * Math.sin(y * 0.043 + col[X] * 7));
    const v = 255 * (1 - 0.075 * th - 0.06 * tv);
    d[i] = v; d[i + 1] = v * 0.985; d[i + 2] = v * 0.97; d[i + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const f = H.layer(160, 90), fx = f.getContext('2d'), fi = fx.createImageData(160, 90);
  for (let y = 0; y < 90; y++) for (let X = 0; X < 160; X++) {
    const v = 255 * (1 - 0.07 * (0.5 + 0.5 * NZ.fbm2(X * 0.05, y * 0.012, 3)) - 0.03 * (0.5 + 0.5 * NZ.n2(X * 0.4, y * 0.2)));
    const i = (y * 160 + X) * 4; fi.data[i] = fi.data[i + 1] = fi.data[i + 2] = v; fi.data[i + 3] = 255;
  }
  fx.putImageData(fi, 0, 0);
  x.globalCompositeOperation = 'multiply'; x.imageSmoothingEnabled = true; x.drawImage(f, 0, 0, W, Hh);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(200,190,180,1)'; x.fillRect(214, 0, 2, Hh); x.fillStyle = 'rgba(232,226,220,1)'; x.fillRect(211, 0, 7, Hh);
  LAY._weave = c; return c;
}
function grainTile(k) {
  const key = '_grain' + k;
  if (LAY[key]) return LAY[key];
  const c = H.layer(256, 256), x = c.getContext('2d'), img = x.createImageData(256, 256), r = H.rng(900 + k);
  for (let i = 0; i < img.data.length; i += 4) { const w = r() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = w; img.data[i + 3] = r() * 26; }
  x.putImageData(img, 0, 0); LAY[key] = c; return c;
}
function end(ctx, st, t) {
  const { W, Hh } = st;
  if (st.rods.length) {
    const R = lay('R', W, Hh), r = R.getContext('2d');
    r.strokeStyle = INK; r.fillStyle = INK; r.lineCap = 'round';
    st.rods.forEach(([x, y, w, a]) => { r.globalAlpha = a == null ? 1 : a; r.lineWidth = w || 3.2; r.beginPath(); r.moveTo(x, y); r.lineTo(x + (x - 640) * 0.14 + 18, Hh + 40); r.stroke(); dot(r, x, y, (w || 3.2) * 1.2); });
    r.globalAlpha = 1;
    const s = st.S.getContext('2d'); s.save(); s.filter = 'blur(1.3px)'; s.globalAlpha = 0.9; s.drawImage(R, 0, 0); s.restore();
  }
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(st.G, 0, 0); ctx.restore();
  ctx.save(); ctx.filter = 'blur(0.7px)'; ctx.globalAlpha = 0.97; ctx.drawImage(st.S, 0, 0); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(weave(W, Hh), 0, 0); ctx.restore();
  const hl = lay('half', W / 4, Hh / 4), hx = hl.getContext('2d');
  hx.filter = 'blur(5px)'; hx.drawImage(ctx.canvas, 0, 0, W / 4, Hh / 4);
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.13; ctx.drawImage(hl, 0, 0, W, Hh); ctx.restore();
  const fr = Math.floor(t * 12), gt = grainTile(fr % 3), gr = H.rng(fr + 5);
  ctx.save(); ctx.fillStyle = ctx.createPattern(gt, 'repeat'); ctx.translate(-gr() * 256, -gr() * 256); ctx.fillRect(0, 0, W + 256, Hh + 256); ctx.restore();
  H.vignette(ctx, W, Hh, 0.38, '20,5,2');
}

// ---------- stage furniture (reference, cached) ----------
function valance(W) {
  if (LAY._val) return LAY._val;
  const c = H.layer(W, 80), p = c.getContext('2d');
  p.fillStyle = INK; p.fillRect(0, 0, W, 14);
  for (let x = -16; x < W + 32; x += 32) { p.beginPath(); p.arc(x + 16, 13, 16, 0, Math.PI); p.fill(); }
  for (let x = 32; x < W; x += 64) { p.fillRect(x - 1, 20, 2, 22); tear(p, x, 40, 18, 9, Math.PI / 2); dot(p, x, 40, 5); }
  cut(p, () => { for (let x = 8; x < W; x += 12) dot(p, x, 6, 1.8); for (let x = -16; x < W + 32; x += 32) { dot(p, x + 16, 20, 3.2); tear(p, x + 10, 17, 7, 3.4, 2.4); tear(p, x + 22, 17, 7, 3.4, 0.74); } });
  LAY._val = c; return c;
}
function ground(W) {
  if (LAY._gnd) return LAY._gnd;
  const c = H.layer(W, 110), p = c.getContext('2d'), r = H.rng(31);
  p.fillStyle = INK; p.strokeStyle = INK; p.fillRect(0, 96, W, 14);
  for (let x = -10; x < W + 10; x += 5 + r() * 6) {
    const h = 14 + r() * 34 * (0.6 + 0.4 * Math.sin(x * 0.013) ** 2), lean = (r() - 0.5) * 22, w = 2 + r() * 2.5;
    p.beginPath(); p.moveTo(x - w, 100); p.quadraticCurveTo(x + lean * 0.3, 100 - h * 0.6, x + lean, 100 - h); p.quadraticCurveTo(x + lean * 0.3 + w * 0.6, 100 - h * 0.55, x + w, 100); p.fill();
  }
  p.lineCap = 'round';
  for (let x = 60; x < W; x += 150 + r() * 90) {
    const dir = r() < 0.5 ? -1 : 1, h = 40 + r() * 26;
    p.lineWidth = 3; p.beginPath(); p.moveTo(x, 100); p.quadraticCurveTo(x + dir * 6, 100 - h * 0.6, x + dir * 2, 100 - h);
    for (let a = 0; a < 5.5; a += 0.3) { const rr = 10 * (1 - a / 6.2); p.lineTo(x + dir * (2 + 10 - Math.cos(a) * rr), 100 - h - Math.sin(a) * rr * dir * dir); }
    p.stroke();
    for (let k = 1; k < 4; k++) tear(p, x + dir * 3, 100 - h * k / 4.2, 14, 6, dir > 0 ? -0.5 : Math.PI + 0.5);
  }
  for (let x = 140; x < W; x += 260 + r() * 120) {
    const h = 50 + r() * 20; p.lineWidth = 2; p.beginPath(); p.moveTo(x, 100); p.quadraticCurveTo(x + 8, 100 - h / 2, x + 3, 100 - h); p.stroke();
    for (let k = 0; k < 6; k++) tear(p, x + 3, 100 - h, 11, 6, k * TAU / 6);
    cut(p, () => dot(p, x + 3, 100 - h, 2.4));
  }
  LAY._gnd = c; return c;
}
function fernShape(p) {
  p.fillStyle = INK; p.strokeStyle = INK; p.lineWidth = 10; p.lineCap = 'round';
  p.beginPath(); p.moveTo(0, 0); p.quadraticCurveTo(40, -200, 10, -360); p.stroke();
  for (let k = 1; k < 13; k++) { const q = k / 13, y = -q * 340, x = 40 * Math.sin(q * 2.4) - 4; tear(p, x, y, 110 * (1 - q * 0.6), 34 * (1 - q * 0.5), 0.2 - q * 0.3); tear(p, x, y, 90 * (1 - q * 0.6), 30 * (1 - q * 0.5), Math.PI - 0.4 + q * 0.2); }
}
const FERN_OX = 170, FERN_OY = 440;
function nearFern(st, t, side, a) {
  if (a <= 0.004) return;
  if (!LAY._fern) {
    const c = H.layer(380, 520), x = c.getContext('2d');
    const raw = H.layer(380, 520), rx = raw.getContext('2d'); rx.translate(FERN_OX, FERN_OY); fernShape(rx);
    x.filter = 'blur(7px)'; x.drawImage(raw, 0, 0); LAY._fern = c;
  }
  const s = st.S.getContext('2d');
  s.save(); s.globalAlpha = a;
  if (side > 0) { s.translate(st.W, 0); s.scale(-1, 1); }
  s.translate(-30, 770); s.rotate(0.5 + Math.sin(t * 0.8) * 0.03); s.scale(1.08, 1.08);
  s.drawImage(LAY._fern, -FERN_OX, -FERN_OY);
  s.restore();
}
function stage(st) {
  const s = st.S.getContext('2d');
  s.drawImage(valance(st.W), 0, 0);
  s.drawImage(ground(st.W), 0, st.Hh - 110);
}

// ---------- reference puppets kept: the hand, tags, badges, plaques, vines, title cards, curtains ----------
// the teacher's articulated hand, pointing left. o: x,y (wrist pin) s rot
function hand(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s); });
  p.fillStyle = INK; p.strokeStyle = INK;
  p.beginPath(); p.moveTo(16, -26); p.lineTo(240, -40); p.lineTo(240, 40); p.lineTo(16, 26); p.closePath(); p.fill();
  for (let y = -30; y <= 30; y += 10) dot(p, 14, y, 7);
  cut(p, () => {
    for (let y = -24; y <= 24; y += 12) dot(p, 28, y, 3);
    for (let x = 56; x < 230; x += 26) { p.lineWidth = 2.4; p.beginPath(); p.moveTo(x, -22 - (x - 56) * 0.06); p.quadraticCurveTo(x + 10, 0, x + 2, 22 + (x - 56) * 0.06); p.stroke(); }
    dot(p, 0, 0, 9);
  });
  p.fillStyle = INK; dot(p, 0, 0, 5);
  p.save(); p.rotate(o.rot || 0);
  p.beginPath(); p.ellipse(-32, 0, 34, 25, 0, 0, TAU); p.fill();
  p.beginPath(); p.roundRect(-122, -14, 92, 15, 7.5); p.fill();
  [[-60, 7], [-58, 17], [-52, 26]].forEach(([x, y]) => { p.beginPath(); p.ellipse(x, y, 15, 6.5, 0.1, 0, TAU); p.fill(); });
  p.beginPath(); p.ellipse(-52, -21, 22, 7, -0.45, 0, TAU); p.fill();
  cut(p, () => {
    p.lineWidth = 2; p.beginPath(); p.moveTo(-72, 12); p.lineTo(-46, 12); p.moveTo(-70, 22); p.lineTo(-44, 22); p.stroke();
    p.beginPath(); p.arc(-110, -6.5, 4, -1.2, 1.2); p.stroke();
    p.beginPath(); p.moveTo(-80, -2); p.lineTo(-74, -2); p.stroke();
  });
  p.restore();
  if (rods) rods.push([...wpt(p, 200, 0), 3.4]);
  both([p, g], (c) => c.restore());
}
// the same hand mirrored so it reaches in from the left; o.x,o.y is the wrist pin
function handR(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(-1, 1); });
  hand(p, g, { x: 0, y: 0, s: o.s, rot: o.rot || 0 }, rods);
  both([p, g], (c) => c.restore());
}
// a hand that slides in from the left, pokes the fingertip at (tx,ty) on each tap time, and slides away
function tapper(st, t, tx, ty, s, tIn, taps, tOut) {
  const inU = EO(sm(tIn, tIn + 0.25, t)), outU = EIO(sm(tOut, tOut + 0.35, t));
  if (inU <= 0 || outU >= 1) return;
  const tap = taps.reduce((m, k) => Math.max(m, Math.sin(Math.PI * sm(k - 0.06, k + 0.08, t))), 0);
  const wx = lerp(-300, tx - 122 * s, inU) + tap * 16 - outU * 560, wy = ty + 6 * s + (1 - inU) * 70 + outU * 60;
  pup(st, { blur: 1.1 }, (p, g, rods) => handR(p, g, { x: wx, y: wy, s, rot: 0.1 * tap }, rods));
}
function tag(p, g, o) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); });
  p.fillStyle = INK; p.strokeStyle = INK; p.lineWidth = 2;
  const sl = o.string == null ? 30 : o.string;
  p.beginPath(); p.moveTo(0, 0); p.lineTo(0, sl); p.stroke(); dot(p, 0, 0, 4);
  both([p, g], (c) => { c.translate(0, sl + o.h / 2); c.scale(o.flip == null ? 1 : o.flip, 1); });
  const w = o.w, h = o.h;
  p.beginPath(); p.roundRect(-w / 2, -h / 2, w, h, 12); p.fill();
  for (let x = -w / 2 + 10; x <= w / 2 - 10; x += 14) { dot(p, x, -h / 2, 4.5); dot(p, x, h / 2, 4.5); }
  cut(p, () => {
    p.lineWidth = 2.4; p.beginPath(); p.roundRect(-w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 7); p.stroke();
    p.font = `italic 400 ${o.size}px ${FF}`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText(o.text, o.tx || 0, 3);
  });
  if (o.badge && o.badgeS > 0.01) badge(p, g, { x: w / 2 - 38, y: 0, s: o.badgeS, ok: o.badge === 'v' });
  both([p, g], (c) => c.restore());
}
function badge(p, g, o) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s); });
  p.fillStyle = INK; dot(p, 0, 0, 40);
  for (let k = 0; k < 12; k++) dot(p, Math.cos(k * TAU / 12) * 40, Math.sin(k * TAU / 12) * 40, 7);
  cut(p, () => dot(p, 0, 0, 31));
  g.fillStyle = o.ok ? 'rgb(110,220,120)' : 'rgb(240,60,46)'; dot(g, 0, 0, 33);
  p.strokeStyle = INK; p.lineCap = 'round'; p.lineWidth = 11; p.beginPath();
  if (o.ok) { p.moveTo(-16, 1); p.lineTo(-4, 14); p.lineTo(18, -14); } else { p.moveTo(-14, -14); p.lineTo(14, 14); p.moveTo(14, -14); p.lineTo(-14, 14); }
  p.stroke();
  both([p, g], (c) => c.restore());
}
function plaque(p, o) {
  p.save(); p.translate(o.x, o.y); p.rotate(o.rot || 0);
  p.font = `italic 400 ${o.size}px ${FF}`;
  const tw = p.measureText(o.text).width, w = tw + o.size * 1.1, h = o.size * 1.5;
  p.fillStyle = INK; p.strokeStyle = INK;
  if (o.hang) { p.lineWidth = 2; p.beginPath(); p.moveTo(0, -h / 2); p.lineTo(0, -h / 2 - o.hang); p.stroke(); }
  p.beginPath(); p.roundRect(-w / 2, -h / 2, w, h, h * 0.28); p.fill();
  dot(p, -w / 2 - 4, 0, h * 0.24); dot(p, w / 2 + 4, 0, h * 0.24);
  cut(p, () => {
    p.lineWidth = 2; p.beginPath(); p.roundRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, h * 0.2); p.stroke();
    dot(p, -w / 2 - 4, 0, h * 0.09); dot(p, w / 2 + 4, 0, h * 0.09);
    p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText(o.text, 0, 2);
  });
  p.restore();
}
// growing vine-arrow cut from one strip of hide: P = cubic bezier, prog 0..1
function vine(p, P, prog, w) {
  if (prog <= 0.001) return;
  w = w || 7; p.fillStyle = INK; p.strokeStyle = INK; p.lineCap = 'round'; p.lineJoin = 'round';
  const N = 60, n = Math.max(2, Math.ceil(N * prog));
  p.lineWidth = w; p.beginPath();
  for (let i = 0; i <= n; i++) { const q = bz(P, Math.min(prog, i / N)); if (i === 0) p.moveTo(q[0], q[1]); else p.lineTo(q[0], q[1]); }
  p.stroke();
  const s0 = bz(P, 0), a0 = bzA(P, 0);
  p.lineWidth = 3.5; p.beginPath();
  for (let a = 0; a < 5.2; a += 0.25) { const r = 16 * (1 - a / 6), aa = a0 + Math.PI + a; p.lineTo(s0[0] + Math.cos(a0 + Math.PI) * 4 + Math.cos(aa) * r - Math.cos(a0 + Math.PI) * 16, s0[1] + Math.sin(a0 + Math.PI) * 4 + Math.sin(aa) * r - Math.sin(a0 + Math.PI) * 16); }
  p.stroke();
  [0.18, 0.34, 0.5, 0.66, 0.8].forEach((u, i) => {
    if (u > prog - 0.06) return;
    const q = bz(P, u), a = bzA(P, u) + (i % 2 ? 1 : -1) * 0.9, gr = Math.min(1, (prog - u) / 0.12);
    tear(p, q[0], q[1], 26 * gr, 11 * gr, a);
    cut(p, () => { p.lineWidth = 1.4; p.beginPath(); p.moveTo(q[0] + Math.cos(a) * 5, q[1] + Math.sin(a) * 5); p.lineTo(q[0] + Math.cos(a) * 20 * gr, q[1] + Math.sin(a) * 20 * gr); p.stroke(); });
  });
  const e = bz(P, prog), ea = bzA(P, prog);
  p.save(); p.translate(e[0], e[1]); p.rotate(ea);
  p.beginPath(); p.moveTo(30, 0); p.quadraticCurveTo(8, -6, -4, -19); p.quadraticCurveTo(2, -6, -6, 0); p.quadraticCurveTo(2, 6, -4, 19); p.quadraticCurveTo(8, 6, 30, 0); p.fill();
  cut(p, () => dot(p, 6, 0, 3.2));
  p.restore();
}
// a vine snipped through at u0: the gap (0..1) opens a hole and the cut ends fray and droop
function vineCut(p, P, u0, gap) {
  vine(p, P, 1, 7);
  if (gap <= 0.001) return;
  const q = bz(P, u0), a = bzA(P, u0), half = 30 * gap;
  cut(p, () => { p.save(); p.translate(q[0], q[1]); p.rotate(a); p.fillRect(-half, -30, half * 2, 60); p.restore(); });
  p.fillStyle = INK;
  for (const sd of [-1, 1]) {
    const ex = q[0] + Math.cos(a) * half * sd, ey = q[1] + Math.sin(a) * half * sd;
    tear(p, ex - Math.cos(a) * sd * 3, ey, 20 * gap, 6, Math.PI / 2 + sd * 0.6);
    tear(p, ex - Math.cos(a) * sd * 5, ey, 14 * gap, 5, Math.PI / 2 - sd * 0.2);
  }
}
// hanging intertitle card with cut-out lettering; each line can fade (L.a) by cutting at partial strength
function titleCard(p, g, o) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y - o.h / 2 * o.s); c.rotate(o.rot || 0); c.scale(o.s, o.s); c.translate(0, o.h / 2); });
  const w = o.w, h = o.h;
  p.fillStyle = INK; p.strokeStyle = INK; p.lineWidth = 2.4;
  p.beginPath(); p.moveTo(-w * 0.32, -h / 2); p.lineTo(-w * 0.32, -h / 2 - 900); p.moveTo(w * 0.32, -h / 2); p.lineTo(w * 0.32, -h / 2 - 900); p.stroke();
  p.beginPath(); p.roundRect(-w / 2, -h / 2, w, h, 14); p.fill();
  for (let x = -w / 2 + 12; x <= w / 2 - 12; x += 16) { dot(p, x, -h / 2, 6); dot(p, x, h / 2, 6); }
  for (const sx of [-1, 1]) { p.beginPath(); p.arc(sx * w / 2, 0, h * 0.22, -Math.PI / 2, Math.PI / 2, sx < 0); p.fill(); }
  cut(p, () => {
    p.lineWidth = 3; p.beginPath(); p.roundRect(-w / 2 + 14, -h / 2 + 14, w - 28, h - 28, 8); p.stroke();
    for (let x = -w / 2 + 34; x <= w / 2 - 34; x += 11) { dot(p, x, -h / 2 + 24, 1.8); dot(p, x, h / 2 - 24, 1.8); }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = sx * (w / 2 - 34), cy = sy * (h / 2 - 34);
      dot(p, cx, cy, 4);
      [0, 1, 2].forEach((k) => tear(p, cx, cy, 14, 6, Math.atan2(-sy, -sx) + (k - 1) * 0.7 + Math.PI));
    }
    for (const sx of [-1, 1]) { dot(p, sx * (w / 2 + h * 0.1), 0, h * 0.07); }
    o.lines.forEach((L) => {
      if (L.a != null && L.a <= 0.003) return;
      p.save(); p.globalAlpha = L.a == null ? 1 : L.a;
      p.font = `${L.italic ? 'italic ' : ''}400 ${L.size}px ${FF}`; p.textAlign = 'center'; p.textBaseline = 'alphabetic';
      if (L.arrow) {
        const tw = p.measureText(L.text).width, aw = L.size * 1.2, gap = L.size * 0.3, x0 = -(tw + aw + gap) / 2, ay = L.y - L.size * 0.3;
        p.fillText(L.text, x0 + aw + gap + tw / 2, L.y);
        p.fillRect(x0, ay - 3.5, aw - 16, 7);
        p.beginPath(); p.moveTo(x0 + aw, ay); p.lineTo(x0 + aw - 24, ay - 15); p.lineTo(x0 + aw - 24, ay + 15); p.closePath(); p.fill();
        dot(p, x0, ay, 7);
      } else p.fillText(L.text, 0, L.y);
      p.restore();
    });
  });
  both([p, g], (c) => c.restore());
}
function curtains(p, W, Hh, cover, t) {
  const e = cover * (W / 2 + 40);
  for (const sd of [-1, 1]) {
    const wave = (y) => Math.sin(y * 0.018 + t * 2 + sd) * 10 + Math.sin(y * 0.05) * 4;
    const inner = (y) => (sd < 0 ? e - 40 + wave(y) : W - e + 40 + wave(y));
    const outer = sd < 0 ? -60 : W + 60;
    p.fillStyle = INK; p.beginPath(); p.moveTo(outer, -10);
    for (let y = -10; y <= Hh + 10; y += 20) p.lineTo(inner(y), y);
    p.lineTo(outer, Hh + 10); p.closePath(); p.fill();
    for (let y = 30; y < Hh; y += 24) { tear(p, inner(y), y, 18, 9, sd < 0 ? 0 : Math.PI); }
    cut(p, () => {
      for (let k = 1; k < 9; k++) {
        const x = sd < 0 ? inner(0) - k * 70 : inner(0) + k * 70;
        for (let y = 50; y < Hh - 20; y += 22) { const xx = x + wave(y) * 0.6 + Math.sin(y * 0.03 + k) * 6; p.save(); p.translate(xx, y); p.rotate(Math.PI / 4); p.fillRect(-3.4, -3.4, 6.8, 6.8); p.restore(); }
      }
      for (let y = 40; y < Hh - 20; y += 18) dot(p, inner(y) - sd * 18, y, 3);
    });
  }
}
function star(p, x, y, r) { p.beginPath(); for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.42 : r, a = i * TAU / 10 - Math.PI / 2; p.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } p.fill(); }

// ---------- new puppets for this play ----------
// a phone cut from hide: lace edge, a punched screen with a coloured gel, ink "text lines" or a spinner on the screen.
// o: x,y centre, s, rot, gel, lines (0..n, fractional = typing), pat (line lengths), spin (angle), check (0..1)
function phone(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); c.scale(o.s, o.s); });
  const w = 200, h = 370, SX = -w / 2 + 18, SY = -h / 2 + 48, SW = w - 36, SH = h - 108;
  p.fillStyle = INK; p.strokeStyle = INK;
  p.beginPath(); p.roundRect(-w / 2, -h / 2, w, h, 34); p.fill();
  for (let y = -h / 2 + 34; y <= h / 2 - 34; y += 19) { dot(p, -w / 2, y, 6.5); dot(p, w / 2, y, 6.5); }
  p.fillRect(w / 2, -92, 11, 48);
  cut(p, () => {
    p.beginPath(); p.roundRect(SX, SY, SW, SH, 12); p.fill();
    p.beginPath(); p.roundRect(-28, -h / 2 + 20, 56, 9, 4.5); p.fill();
    dot(p, 42, -h / 2 + 24, 4.2);
    p.lineWidth = 3; p.beginPath(); p.arc(0, h / 2 - 30, 14, 0, TAU); p.stroke();
    for (let x = -w / 2 + 24; x <= w / 2 - 24; x += 14) { dot(p, x, -h / 2 + 8, 2); dot(p, x, h / 2 - 8, 2); }
  });
  g.fillStyle = o.gel || GEL.teal; g.beginPath(); g.roundRect(SX - 2, SY - 2, SW + 4, SH + 4, 12); g.fill();
  p.fillStyle = INK;
  // a little header bar on the screen
  let top0 = SY + 52;
  if (o.title) { p.font = o.titleFont || `italic 400 ${o.titleSize || 42}px ${FF}`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText(o.title, 0, SY + 30); top0 = SY + 66; }
  else { p.beginPath(); p.roundRect(SX + 14, SY + 14, SW - 28, 18, 6); p.fill(); cut(p, () => dot(p, SX + 26, SY + 23, 4)); }
  const pat = o.pat || [0.85, 0.6, 0.78, 0.5, 0.7, 0.45];
  const n = o.lines || 0;
  for (let i = 0; i < Math.ceil(n - 0.001); i++) {
    const f = Math.min(1, n - i), y = top0 + i * 30, len = pat[i % pat.length] * (SW - 32) * f;
    if (len > 2) { p.beginPath(); p.roundRect(SX + 16, y, len, 11, 5.5); p.fill(); }
  }
  if (o.spin != null) {
    for (let k = 0; k < 8; k++) { const a = o.spin + k * TAU / 8; dot(p, Math.cos(a) * 38, 40 + Math.sin(a) * 38, 3 + 6 * (k / 7)); }
  }
  if (o.check > 0.01) {
    p.save(); p.translate(SX + SW - 34, SY + SH - 34); p.scale(o.check, o.check);
    dot(p, 0, 0, 24); cut(p, () => { p.lineWidth = 6; p.lineCap = 'round'; p.beginPath(); p.moveTo(-10, 0); p.lineTo(-3, 8); p.lineTo(11, -8); p.stroke(); });
    p.restore();
  }
  if (rods && !o.noRods) rods.push([...wpt(p, 0, h / 2 - 4), 3.4]);
  both([p, g], (c) => c.restore());
}
// the server: a rack of four cut-work units with gelled status lights, a lace cloud crest on top. o: x,y = base centre
function server(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s); });
  const w = 190, uh = 74, n = 4, top = -n * uh - 22;
  p.fillStyle = INK; p.strokeStyle = INK;
  p.fillRect(-w / 2 + 12, -16, 28, 16); p.fillRect(w / 2 - 40, -16, 28, 16);
  p.beginPath(); p.roundRect(-w / 2, top, w, n * uh + 8, 12); p.fill();
  // cloud crest
  const cy = top - 64;
  p.fillRect(-10, cy + 30, 20, top - cy - 28);
  [[-62, 12, 32], [-24, -12, 44], [26, -8, 40], [66, 12, 30], [0, 18, 40]].forEach(([x, y, r]) => dot(p, x, cy + y, r));
  cut(p, () => {
    for (let i = 0; i < n; i++) {
      const y0 = top + 10 + i * uh;
      p.lineWidth = 2.6; p.beginPath(); p.roundRect(-w / 2 + 12, y0, w - 24, uh - 14, 7); p.stroke();
      for (let x = -w / 2 + 30; x < 22; x += 13) { p.beginPath(); p.roundRect(x, y0 + 14, 5, uh - 42, 2.5); p.fill(); }
      dot(p, w / 2 - 54, y0 + uh / 2 - 7, 8); dot(p, w / 2 - 30, y0 + uh / 2 - 7, 8);
    }
    // lace in the cloud
    for (let k = 0; k < 11; k++) { const a = Math.PI + k / 10 * Math.PI; dot(p, Math.cos(a) * 58, cy + 10 + Math.sin(a) * 24, 3); }
    dot(p, -24, cy - 14, 10); dot(p, 26, cy - 10, 8);
  });
  // status lights
  for (let i = 0; i < n; i++) {
    const y0 = top + 10 + i * uh, flash = o.flash || 0, blink = (Math.floor((o.t || 0) * 5 + i * 1.7) % 3) ? 1 : 0;
    g.fillStyle = flash > 0.05 ? H.rgba(H.mix([255, 204, 96], [130, 230, 120], flash), 1) : GEL.green; dot(g, w / 2 - 54, y0 + uh / 2 - 7, 10);
    g.fillStyle = blink ? GEL.amber : 'rgb(190,110,60)'; dot(g, w / 2 - 30, y0 + uh / 2 - 7, 10);
  }
  g.fillStyle = GEL.blue; dot(g, -24, cy - 14, 11); dot(g, 26, cy - 10, 9);
  if (rods && !o.noRods) rods.push([...wpt(p, 0, -2), 3.6]);
  both([p, g], (c) => c.restore());
}
// the local store: a database drum with banded staves, a slot on top and a row of punched record-lights. o: x,y centre
function drum(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s); });
  const rx = 118, ry = 34, h = 250, T = -h / 2, B = h / 2;
  p.fillStyle = INK; p.strokeStyle = INK;
  p.beginPath(); p.ellipse(0, T, rx, ry, 0, 0, TAU); p.fill();
  p.fillRect(-rx, T, rx * 2, h);
  p.beginPath(); p.ellipse(0, B, rx, ry, 0, 0, TAU); p.fill();
  for (let k = 0; k < 18; k++) { const a = k / 17 * Math.PI; dot(p, Math.cos(a) * rx, B + Math.sin(a) * ry, 6); }
  const recY = T + 128, n = 6;
  cut(p, () => {
    p.lineWidth = 3; p.beginPath(); p.ellipse(0, T, rx - 14, ry - 9, 0, 0, TAU); p.stroke();
    p.beginPath(); p.roundRect(-46, T - 6, 92, 12, 6); p.fill();
    p.lineWidth = 5;
    for (const y of [T + 78, T + 174]) { p.beginPath(); p.ellipse(0, y, rx - 4, ry, 0, 0.12, Math.PI - 0.12); p.stroke(); }
    for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * 30; p.beginPath(); p.roundRect(x - 9, recY - 14, 18, 28, 4); p.fill(); }
    if (o.label !== false) { p.font = `italic 400 40px ${FF}`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText('Local store', 0, B - 12); }
    else for (let k = 0; k < 14; k++) { const a = k / 13 * Math.PI; dot(p, Math.cos(a) * (rx - 26), T + 210 + Math.sin(a) * (ry - 12), 2.2); }
  });
  const items = o.items || 0;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 30, on = cl(items - i);
    g.fillStyle = on > 0.01 ? H.rgba(H.mix([150, 60, 30], [255, 214, 110], on), 1) : 'rgb(120,52,26)';
    g.fillRect(x - 11, recY - 16, 22, 32);
  }
  if (o.glow > 0.01) { g.fillStyle = H.rgba([255, 230, 150], o.glow); g.fillRect(-48, T - 8, 96, 16); }
  if (rods && !o.noRods) rods.push([...wpt(p, 0, B + ry - 4), 3.6]);
  both([p, g], (c) => c.restore());
}
// a small paper note (a change / an operation). o: x,y,s,rot, text, size, w,h, gel
function note(p, g, o) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.rotate(o.rot || 0); c.scale(o.s, o.s); });
  p.fillStyle = INK; p.strokeStyle = INK;
  let w = o.w || 96, h = o.h || 78;
  if (o.text) { p.font = `italic 400 ${o.size || 34}px ${FF}`; w = Math.max(w, p.measureText(o.text).width + 56); h = (o.size || 34) * 1.9; }
  const f = 20;
  p.beginPath(); p.moveTo(-w / 2, -h / 2); p.lineTo(w / 2 - f, -h / 2); p.lineTo(w / 2, -h / 2 + f); p.lineTo(w / 2, h / 2); p.lineTo(-w / 2, h / 2); p.closePath(); p.fill();
  for (let x = -w / 2 + 9; x <= w / 2 - 9; x += 12) dot(p, x, h / 2, 3.4);
  cut(p, () => {
    p.lineWidth = 2; p.beginPath(); p.moveTo(w / 2 - f, -h / 2 + 3); p.lineTo(w / 2 - f, -h / 2 + f); p.lineTo(w / 2 - 3, -h / 2 + f); p.stroke();
    if (o.text) { p.font = `italic 400 ${o.size || 34}px ${FF}`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText(o.text, -4, 2); }
    else { for (let i = 0; i < 3; i++) { p.beginPath(); p.roundRect(-w / 2 + 14, -h / 2 + 18 + i * 17, (i === 2 ? 0.5 : 0.8) * (w - 40), 7, 3.5); p.fill(); } }
  });
  g.fillStyle = o.gel || GEL.amber; g.fillRect(-w / 2, -h / 2, w, h);
  both([p, g], (c) => c.restore());
}
// the outbox: a little lattice tray with "Outbox" cut in its front; queued notes stand in it
function outbox(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s); });
  const w = 190, h = 74;
  // queued notes standing in the tray (behind the front)
  for (let i = 0; i < Math.ceil(o.queue || 0); i++) {
    const f = cl((o.queue || 0) - i);
    note(p, g, { x: -44 + i * 40, y: -h / 2 - 16 + (1 - f) * 40, s: 0.62, rot: (i - 1) * 0.12 });
  }
  p.fillStyle = INK;
  p.beginPath(); p.moveTo(-w / 2 - 10, -h / 2); p.lineTo(w / 2 + 10, -h / 2); p.lineTo(w / 2, h / 2); p.lineTo(-w / 2, h / 2); p.closePath(); p.fill();
  for (let x = -w / 2; x <= w / 2; x += 15) dot(p, x, -h / 2, 5);
  p.fillRect(-w / 2 + 10, h / 2, 12, 16); p.fillRect(w / 2 - 22, h / 2, 12, 16);
  cut(p, () => {
    p.lineWidth = 2.2; p.beginPath(); p.roundRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20, 6); p.stroke();
    p.font = `italic 400 36px ${FF}`; p.textAlign = 'center'; p.textBaseline = 'middle'; p.fillText('Outbox', 0, 3);
  });
  if (rods && !o.noRods) rods.push([...wpt(p, 0, h / 2 + 14), 3.2]);
  both([p, g], (c) => c.restore());
}
// scissors: two pinned blades. o: x,y pivot, s, rot (direction blades point), open (half-angle)
function scissors(p, o, rods) {
  p.save(); p.translate(o.x, o.y); p.rotate(o.rot || 0); p.scale(o.s, o.s);
  p.fillStyle = INK;
  for (const sd of [-1, 1]) {
    p.save(); p.rotate(sd * (o.open || 0));
    p.beginPath(); p.moveTo(-6, -sd * 9); p.quadraticCurveTo(70, -sd * 15, 160, -sd * 1); p.quadraticCurveTo(80, sd * 5, -6, sd * 4); p.closePath(); p.fill();
    p.fillRect(-78, -sd * 2 - 5, 76, 10);
    dot(p, -98, -sd * 6, 25);
    cut(p, () => { dot(p, -98, -sd * 6, 15); p.lineWidth = 1.6; p.beginPath(); p.moveTo(20, -sd * 3); p.lineTo(130, -sd * 2); p.stroke(); });
    p.restore();
  }
  pin(p, 0, 0, 9);
  if (rods) rods.push([...wpt(p, -98, 14), 3.2]);
  p.restore();
}
// the merge machine: three meshing cut-work gears on a lace plate, gelled windows between the spokes. o: x,y, rot, gel
function mergeMill(p, g, o, rods) {
  both([p, g], (c) => { c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s); });
  p.fillStyle = INK;
  // the plate the gears are pinned to
  p.beginPath(); p.roundRect(-150, -36, 300, 120, 24); p.fill();
  for (let x = -138; x <= 138; x += 14) dot(p, x, 84, 5);
  cut(p, () => { for (let x = -120; x <= 120; x += 20) dot(p, x, 62, 3); });
  const G = [[0, 0, 74, 14, 1], [-112, -24, 46, 9, -74 / 46], [110, -22, 44, 9, -74 / 44]];
  G.forEach(([gx, gy, r, n, ratio]) => {
    const rot = (o.rot || 0) * ratio + (ratio < 0 ? 0.18 : 0);
    both([p, g], (c) => { c.save(); c.translate(gx, gy); });
    p.fillStyle = INK; gearPath(p, r, n, r * 0.2, rot); p.fill();
    cut(p, () => { for (let k = 0; k < 5; k++) { const a = rot + k * TAU / 5; p.beginPath(); p.arc(0, 0, r * 0.66, a + 0.2, a + TAU / 5 - 0.2); p.arc(0, 0, r * 0.3, a + TAU / 5 - 0.35, a + 0.35, true); p.closePath(); p.fill(); } });
    g.fillStyle = o.gel || GEL.gold; dot(g, 0, 0, r * 0.7);
    pin(p, 0, 0, Math.max(5, r * 0.15));
    both([p, g], (c) => c.restore());
  });
  if (o.sparks > 0) {
    const sz = 16 * Math.sin(Math.PI * cl(o.sparks));
    if (sz > 1) for (let k = 0; k < 9; k++) {
      const a = k / 9 * TAU + 0.3, d = 110 + o.sparks * 70;
      p.save(); p.translate(Math.cos(a) * d * 1.2, Math.sin(a) * d * 0.8 - 10); p.rotate(o.sparks * 2);
      p.fillStyle = INK; p.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? sz * 0.38 : sz; p.lineTo(Math.cos(i * TAU / 8) * rr, Math.sin(i * TAU / 8) * rr); } p.fill();
      p.restore();
    }
  }
  if (rods && !o.noRods) rods.push([...wpt(p, -150, 70), 3.6]);
  both([p, g], (c) => c.restore());
}
// a counter board on two strings: big lining figures with a label plaque underneath. o: x,y, text, size, label, pop, rot
function counterBoard(p, o) {
  p.save(); p.translate(o.x, o.y); p.rotate(o.rot || 0);
  p.fillStyle = INK; p.strokeStyle = INK; p.lineWidth = 2;
  const hw = o.hw || 250;
  p.beginPath(); p.moveTo(-hw, 34); p.lineTo(-hw, -700); p.moveTo(hw, 34); p.lineTo(hw, -700); p.stroke();
  p.fillRect(-hw - 6, 22, hw * 2 + 12, 7); dot(p, -hw - 6, 25, 8); dot(p, hw + 6, 25, 8);
  if (o.text) {
    p.save(); p.font = `400 ${o.size}px ${NF}`; const cw = p.measureText(o.text).width, fit = Math.min(1, (hw * 2 - 50) / cw), k = (o.pop || 1) * fit;
    p.translate(0, -12); p.scale(k, k); p.textAlign = 'center'; p.textBaseline = 'alphabetic'; p.fillText(o.text, 0, 0); p.restore();
  }
  p.restore();
  if (o.label) plaque(p, { x: o.x + Math.sin(o.rot || 0) * -40, y: o.y + 64, text: o.label, size: 34, rot: o.rot || 0 });
}

// ======================= the explainer =======================
const DURATION = 15;
// bezier paths (shared with the sound score)
const P = {
  req: [[388, 262], [520, 168], [770, 168], [930, 270]],     // cloud-first: request, phone -> server
  res: [[930, 470], [770, 600], [520, 600], [400, 488]],     // cloud-first: response, server -> phone
  wr: [[312, 252], [372, 166], [470, 166], [520, 268]],      // local-first: phone -> local store
  ob: [[640, 372], [690, 332], [736, 350], [770, 404]],      // local store -> outbox
  sy: [[846, 420], [884, 272], [968, 252], [1010, 384]],     // outbox -> server (sync)
  ma: [[236, 236], [330, 150], [470, 156], [548, 266]],      // phone A -> merge
  mb: [[1044, 236], [950, 150], [810, 156], [732, 266]],     // phone B -> merge
};
const SNIP_U = 0.44;
const T = {
  hoist: 1.8, cloudIn: 1.95, tap1: 2.66, reqA: 2.7, reqB: 3.12, resA: 3.25, resB: 3.72, waitEnd: 3.75,
  dipA: 3.95, dipB: 4.45,
  wrVine: 4.5, tap2: 4.92, zero: 5.04,
  boardUp: 6.15, serverIn: 6.3, obVine: 6.55, syVine: 6.72, syncA: 7.2, syncB: 7.6,
  snip: 8.06, tapsOff: [8.46, 8.82], heal: 9.25, online: 9.6, flushA: 9.66,
  curtA: 10.15, curtB: 10.9, sceneM: 10.45,
  mergeIn: 10.6, mVineA: 10.92, mCardA: 11.02, mCardB: 11.08, mill: 11.5, merged: 12.0, tickM: 12.14, converge: 12.24,
  fly: 12.62, sceneE: 12.9, take: 13.1,
};
// how many notes wait in the outbox at time t
const queueAt = (t) => sm(T.obVine + 0.3, T.obVine + 0.45, t) - sm(T.syncA - 0.05, T.syncA + 0.05, t)
  + T.tapsOff.reduce((m, k) => m + sm(k + 0.2, k + 0.32, t), 0)
  - [0, 1].reduce((m, i) => m + sm(T.flushA + i * 0.16 - 0.04, T.flushA + i * 0.16 + 0.04, t), 0);
const waitMs = (t) => Math.round(280 * cl((t - T.reqA) / (T.waitEnd - T.reqA)));

// the corner header: the opening title card, hoisted to the top-left where it stays as the running title
function header(st, t) {
  const hp = EIO(sm(T.hoist, T.hoist + 0.55, t));
  const dropY = lerp(-280, 300, EO(sm(0.15, 0.8, t)));
  pup(st, {}, (p, g) => titleCard(p, g, {
    x: lerp(640, 214, hp), y: lerp(dropY, 86, hp), w: lerp(920, 640, hp), h: lerp(270, 150, hp), s: lerp(1, 0.5, hp),
    rot: swing(t, 0.8, 0.08, 2.2, 7) + swing(t, T.hoist + 0.55, 0.05, 2.5, 8),
    lines: [{ text: 'Zero Latency', size: 96, y: lerp(4, 34, hp) }, { text: 'Anatomy of Local-First Sync', size: 48, italic: true, y: 80, a: 1 - sm(0, 0.45, hp) }],
  }));
}
function ride(P_, u) { const q = bz(P_, u); return { x: q[0], y: q[1], rot: bzA(P_, u) * 0.12 }; }

// ----- beats 1-2: hook, then cloud-first round trip -----
function sceneCloud(st, t) {
  const pin_ = EO(sm(T.cloudIn, T.cloudIn + 0.5, t));
  const waiting = t > T.tap1 && t < T.waitEnd;
  pup(st, {}, (p, g, rods) => {
    // server rises in on its rod
    server(p, g, { x: 1046, y: lerp(1180, 614, EO(sm(T.cloudIn + 0.12, T.cloudIn + 0.6, t))), s: 0.88, t, flash: Math.exp(-Math.max(0, t - T.reqB) * 6) * (t > T.reqB ? 1 : 0) }, rods);
    plaque(p, { x: 1046, y: lerp(-60, 196, EO(sm(2.45, 2.7, t))), text: 'Server', size: 34, rot: swing(t, 2.7, 0.06, 3, 9), hang: 240 });
  });
  pup(st, {}, (p, g, rods) => {
    phone(p, g, {
      x: lerp(-160, 300, pin_), y: 402 - hop(pin_, 2, 26), s: 0.9, rot: (1 - pin_) * -0.1,
      gel: waiting ? GEL.red : GEL.teal, spin: waiting ? Math.floor(t * 12) * TAU / 8 : null,
      lines: waiting ? 0 : 2 + sm(T.waitEnd, T.waitEnd + 0.2, t), check: EO(sm(T.waitEnd, T.waitEnd + 0.15, t)),
    }, rods);
  });
  pup(st, {}, (p, g) => {
    plaque(p, { x: 640, y: lerp(-60, 132, EO(sm(2.2, 2.45, t))), text: 'Cloud-first', size: 46, rot: swing(t, 2.45, 0.06, 3, 8), hang: 220 });
    vine(p, P.req, EIO(sm(T.reqA, T.reqB, t)), 7);
    vine(p, P.res, EIO(sm(T.resA, T.resB, t)), 7);
    const u1 = sm(T.reqA + 0.02, T.reqB + 0.04, t); if (u1 > 0 && u1 < 1) note(p, g, { ...ride(P.req, u1), y: bz(P.req, u1)[1] - 34, s: 0.62 });
    const u2 = sm(T.resA + 0.02, T.resB + 0.02, t); if (u2 > 0 && u2 < 1) note(p, g, { ...ride(P.res, u2), y: bz(P.res, u2)[1] - 34, s: 0.62, gel: GEL.green });
    if (t > 2.5) {
      const dy = lerp(-560, 0, EO(sm(2.5, 2.78, t))), v = waitMs(t), pop = 1 + 0.12 * (t > T.waitEnd ? Math.exp(-(t - T.waitEnd) * 8) : 0);
      counterBoard(p, { x: 640, y: 412 + dy, text: `${v} ms`, size: 96, pop, label: 'network wait', rot: swing(t, 2.78, 0.04, 2.5, 7), hw: 230 });
    }
  });
  tapper(st, t, 286, 430, 0.85, 2.3, [T.tap1], 3.0);
}

// ----- beats 3-6: local-first write, background sync, offline, reconnect -----
function sceneLocal(st, t) {
  const tapsAll = [T.tap2, ...T.tapsOff];
  const lines = 2 + tapsAll.reduce((m, k) => m + sm(k + 0.02, k + 0.14, t), 0);
  const items = 3 + tapsAll.reduce((m, k) => m + sm(k + 0.1, k + 0.16, t), 0);
  const offline = t > T.snip && t < T.online + 0.15;
  const glow = tapsAll.reduce((m, k) => Math.max(m, t > k + 0.1 ? Math.exp(-(t - k - 0.1) * 7) : 0), 0);
  const serverY = lerp(1180, 614, EO(sm(T.serverIn, T.serverIn + 0.4, t)));
  const arrive = [T.syncB, T.flushA + 0.42, T.flushA + 0.58];
  const flash = arrive.reduce((m, k) => Math.max(m, t > k ? Math.exp(-(t - k) * 5) : 0), 0);
  pup(st, {}, (p, g, rods) => {
    if (t > T.serverIn) server(p, g, { x: 1104, y: serverY, s: 0.8, t, flash }, rods);
    drum(p, g, { x: 520, y: 432, s: 0.86, items, glow }, rods);
    if (t > T.boardUp) outbox(p, g, { x: 814, y: lerp(820, 470, EO(sm(T.boardUp + 0.1, T.boardUp + 0.42, t))), s: 0.86, queue: queueAt(t) }, rods);
    phone(p, g, { x: 228, y: 392, s: 0.84, gel: GEL.teal, lines, pat: [0.85, 0.6, 0.78, 0.5, 0.7, 0.45], title: t > T.snip + 0.3 && t < T.online + 0.3 ? '0 ms' : null, titleFont: `400 44px ${NF}` }, rods);
  });
  pup(st, {}, (p, g) => {
    plaque(p, { x: 520, y: lerp(-60, 128, EO(sm(4.42, 4.66, t))), text: 'Local-first', size: 46, rot: swing(t, 4.66, 0.06, 3, 8), hang: 220 });
    vine(p, P.wr, EIO(sm(T.wrVine, T.wrVine + 0.32, t)), 6);
    // notes written on the phone drop straight into the store
    tapsAll.forEach((k) => { const u = sm(k + 0.0, k + 0.11, t); if (u > 0 && u < 1) note(p, g, { ...ride(P.wr, u), y: bz(P.wr, u)[1] - 30, s: 0.56 }); });
    // ... and a copy of each goes to the outbox
    if (t > T.boardUp) vine(p, P.ob, EIO(sm(T.obVine, T.obVine + 0.25, t)), 5);
    [T.obVine + 0.12, T.tapsOff[0] + 0.12, T.tapsOff[1] + 0.12].forEach((k) => { const u = sm(k, k + 0.12, t); if (u > 0 && u < 1) note(p, g, { ...ride(P.ob, u), y: bz(P.ob, u)[1] - 26, s: 0.5 }); });
    // the sync vine: grows, is snipped, heals
    if (t > T.syVine) {
      if (t < T.snip) vine(p, P.sy, EIO(sm(T.syVine, T.syVine + 0.42, t)), 7);
      else vineCut(p, P.sy, SNIP_U, EO(sm(T.snip, T.snip + 0.12, t)) * (1 - EIO(sm(T.heal, T.heal + 0.3, t))));
    }
    // notes riding the sync vine to the server
    const rides = [T.syncA, T.flushA, T.flushA + 0.16];
    rides.forEach((k) => { const u = sm(k, k + 0.42, t); if (u > 0 && u < 1) note(p, g, { ...ride(P.sy, u), y: bz(P.sy, u)[1] - 30, s: 0.6, gel: GEL.green }); });
    // "Sync later" hangs until the line is cut
    if (t > 6.5 && t < 8.3) plaque(p, { x: 904, y: lerp(-60, 136, EO(sm(6.55, 6.8, t))) - 300 * EIO(sm(7.85, 8.15, t)), text: 'Sync later', size: 46, rot: swing(t, 6.8, 0.06, 3, 8), hang: 220 });
    // Offline / Online tag
    if (t > T.snip + 0.02) {
      const drop = EO(sm(T.snip + 0.04, T.snip + 0.26, t)), flipU = sm(T.online - 0.12, T.online + 0.12, t), on = flipU > 0.5;
      tag(p, g, {
        x: 930, y: lerp(-180, 40, drop), rot: swing(t, T.snip + 0.26, 0.1, 2.5, 8) + swing(t, T.online + 0.12, 0.06, 3, 9), flip: Math.max(0.04, Math.abs(Math.cos(flipU * Math.PI))),
        w: 280, h: 84, text: on ? 'Online' : 'Offline', size: 48, tx: -30, string: 34,
        badge: on ? 'v' : 'x', badgeS: on ? EO(sm(T.online + 0.1, T.online + 0.25, t)) * 0.9 : EO(sm(T.snip + 0.2, T.snip + 0.34, t)) * 0.9,
      });
    }
  });
  // the "0 ms" board
  if (t > 4.55 && t < T.boardUp + 0.4) pup(st, {}, (p) => {
    const dy = lerp(-560, 0, EO(sm(4.55, 4.85, t))) - 700 * EIO(sm(T.boardUp, T.boardUp + 0.35, t));
    const stamp = sm(T.zero - 0.06, T.zero, t), pop = t < T.zero ? lerp(1.4, 1, stamp) : 1 + 0.1 * Math.exp(-(t - T.zero) * 7);
    counterBoard(p, { x: 960, y: 412 + dy, text: t > T.zero - 0.06 ? '0 ms' : '', size: 170, pop, label: 'network wait', rot: swing(t, 4.85, 0.04, 2.5, 7) + swing(t, T.zero, 0.03, 3, 10), hw: 240 });
    const bu = sm(T.zero, T.zero + 0.7, t);
    if (bu > 0 && bu < 1) for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU + 0.2, r = 14 * Math.sin(Math.PI * bu) * (k % 2 ? 0.7 : 1), x = 960 + Math.cos(a) * (250 + 90 * bu), y = 350 + Math.sin(a) * (130 + 60 * bu);
      p.fillStyle = INK; star(p, x, y, r); cut(p, () => dot(p, x, y, r * 0.25));
    }
  });
  // scissors come up on their rod, snip, and leave
  if (t > 7.75 && t < 8.7) {
    const q = bz(P.sy, SNIP_U), inU = EO(sm(7.75, 7.98, t)), outU = EIO(sm(8.2, 8.55, t));
    const open = 0.42 * (1 - sm(7.98, T.snip, t)) + 0.3 * sm(T.snip + 0.05, 8.25, t);
    pup(st, { blur: 0.8 }, (p, g, rods) => scissors(p, { x: q[0] - 40 + outU * 60, y: q[1] + 70 + (1 - inU) * 340 + outU * 420, s: 0.8, rot: -1.15, open }, rods));
  }
  // the hand taps the phone: once for the first write, twice while offline
  tapper(st, t, 214, 432, 0.82, 4.62, [T.tap2], 5.3);
  tapper(st, t, 214, 432, 0.82, 8.22, T.tapsOff, 9.05);
}

// ----- beat 7: two devices, one merge -----
function sceneMerge(st, t) {
  const inU = EO(sm(T.mergeIn - 0.15, T.mergeIn + 0.2, t));
  const conv = sm(T.converge, T.converge + 0.2, t);
  const millRot = EIO(sm(T.mill, T.merged + 0.05, t)) * 3.4;
  pup(st, {}, (p, g, rods) => {
    phone(p, g, { x: 176, y: 392, s: 0.78, gel: conv > 0.5 ? GEL.green : GEL.teal, lines: conv > 0.5 ? 4 : 3, pat: conv > 0.5 ? [0.85, 0.5, 0.78, 0.62] : [0.85, 0.5, 0.78], check: EO(sm(T.converge + 0.05, T.converge + 0.2, t)), title: 'Phone A', titleSize: 44 }, rods);
    phone(p, g, { x: 1104, y: 392, s: 0.78, gel: conv > 0.5 ? GEL.green : GEL.blue, lines: conv > 0.5 ? 4 : 3, pat: conv > 0.5 ? [0.85, 0.5, 0.78, 0.62] : [0.85, 0.62, 0.5], check: EO(sm(T.converge + 0.05, T.converge + 0.2, t)), title: 'Phone B', titleSize: 44 }, rods);
    mergeMill(p, g, { x: 640, y: lerp(820, 356, inU), s: 0.9, rot: millRot, sparks: sm(11.62, 12.15, t) * (t < 12.15 ? 1 : 0), gel: t > T.mill && t < T.merged + 0.15 ? GEL.gold : 'rgb(236,150,70)' }, rods);
  });
  pup(st, {}, (p, g) => {
    plaque(p, { x: 640, y: lerp(-60, 132, EO(sm(10.72, 10.96, t))), text: 'CRDT merge', size: 46, rot: swing(t, 10.96, 0.06, 3, 8), hang: 220 });
    vine(p, P.ma, EIO(sm(T.mVineA, T.mVineA + 0.3, t)), 6);
    vine(p, P.mb, EIO(sm(T.mVineA + 0.06, T.mVineA + 0.36, t)), 6);
    const ua = sm(T.mCardA, T.mCardA + 0.46, t), ub = sm(T.mCardB, T.mCardB + 0.46, t);
    if (t < T.mill + 0.05) {
      note(p, g, { ...ride(P.ma, ua), y: bz(P.ma, ua)[1] - 40, s: 0.9, text: 'title', size: 34, gel: GEL.teal, rot: 0 });
      note(p, g, { ...ride(P.mb, ub), y: bz(P.mb, ub)[1] - 40, s: 0.9, text: 'due date', size: 34, gel: GEL.blue, rot: 0 });
    }
    // the merged note is pushed out of the bottom of the machine
    if (t > T.merged - 0.02 && t < T.fly) {
      const r = EO(sm(T.merged - 0.02, T.merged + 0.16, t));
      note(p, g, { x: 640, y: lerp(470, 534, r), s: lerp(0.5, 1, r), text: 'title + due date', size: 34, gel: GEL.green, rot: swing(t, T.merged + 0.16, 0.05, 3, 10) });
      if (t > T.tickM) badge(p, g, { x: 818, y: 534, s: EO(sm(T.tickM, T.tickM + 0.14, t)) * 0.8, ok: true });
    }
  });
}
// the merged note flies at the lamp; its shadow swells to fill the screen
function flyOver(st, t) {
  const q = sm(T.fly, T.fly + 0.6, t), s = lerp(1, 7.5, Math.pow(q, 1.2));
  const x = lerp(640, 640, q), y = lerp(534, 320, EIO(sm(0, 0.5, q))) - 260 * sm(0.55, 1, q);
  pup(st, { blur: 1 + 26 * q, alpha: 1 - 0.1 * q }, (p, g) => note(p, g, { x, y, s, text: 'title + due date', size: 34, gel: GEL.green, rot: q * 0.3 }));
  const cover = sm(0.25, 0.42, q) * (1 - sm(0.52, 0.74, q));
  if (cover > 0) { const s2 = st.S.getContext('2d'); s2.save(); s2.globalAlpha = cover * 0.94; s2.fillStyle = INK; s2.fillRect(0, 0, st.W, st.Hh); s2.restore(); }
}
// ----- beat 8: takeaway -----
function sceneEnd(st, t) {
  pup(st, {}, (p, g) => titleCard(p, g, {
    x: 640, y: lerp(-220, 340, EO(sm(T.take, T.take + 0.32, t))), w: 900, h: 280, s: 1, rot: swing(t, T.take + 0.32, 0.05, 2.2, 6),
    lines: [{ text: 'Write locally,', size: 82, y: -12 }, { text: 'sync later', size: 82, y: 86, italic: true, arrow: true }],
  }));
  const bow = Math.sin(Math.PI * sm(14.1, 14.6, t));
  pup(st, {}, (p, g, rods) => {
    phone(p, g, { x: 930, y: 590 - bow * 14, s: 0.38, rot: -bow * 0.12, gel: GEL.green, lines: 4, pat: [0.85, 0.5, 0.78, 0.62] }, rods);
    drum(p, g, { x: 1046, y: 612, s: 0.32, items: 6, label: false }, rods);
    server(p, g, { x: 1170, y: 660, s: 0.38, t, flash: 0 }, rods);
  });
}

function explainerFrame(ctx, W, Hh, t) {
  const st = begin(W, Hh);
  let b = sm(0, 0.55, t) * (1 - 0.35 * Math.max(0, NZ.n2(t * 23, 3.3)) * (1 - sm(0.35, 0.7, t)));
  b *= 1 - 0.93 * Math.sin(Math.PI * cl((t - T.dipA) / (T.dipB - T.dipA)));   // the lamp is turned down and up again
  const flare = t > T.zero ? Math.exp(-(t - T.zero) * 3) * 0.32 : 0;           // "0 ms": the flame flares
  lamp(ctx, W, Hh, t, b + flare * 0.3, flare);
  // a red gel slides in front of the lamp when the line is cut
  const red = sm(T.snip, T.snip + 0.08, t) * (1 - sm(T.snip + 0.4, T.snip + 0.7, t));
  if (red > 0) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(255,70,50,${red * 0.72})`; ctx.fillRect(0, 0, W, Hh); ctx.restore(); }
  const mid = (T.dipA + T.dipB) / 2;
  if (t < mid) sceneCloud(st, t); else if (t < T.sceneM) sceneLocal(st, t); else if (t < T.sceneE) sceneMerge(st, t); else sceneEnd(st, t);
  header(st, t);
  if (t > T.fly && t < T.fly + 0.62) flyOver(st, t);
  stage(st);
  // the soft near-lamp fern: the opening and the close
  if (t < 2.4) nearFern(st, t, -1, 0.82 * sm(0.3, 0.9, t) * (1 - sm(1.8, 2.4, t)));
  else if (t > T.sceneE) nearFern(st, t, -1, 0.7 * sm(T.sceneE, T.sceneE + 0.3, t));
  // lace curtains close and part again
  const cover = EIO(sm(T.curtA, T.curtA + 0.3, t)) * (1 - EIO(sm(T.sceneM + 0.1, T.curtB, t)));
  if (cover > 0.001) pup(st, {}, (p) => curtains(p, W, Hh, cover, t));
  end(ctx, st, t);
}
function explainer(ctx, W, H_, t) { explainerFrame(ctx, W, H_, t); }
const FONT_SPECS = ['400 96px "IM Fell English"', 'italic 400 48px "IM Fell English"', '400 170px "Libre Baskerville"'];
