// ===================== sound design: struck bronze, wooden rods, hide and paper, a lamp hum =====================
// Times come from the same T table and paths as the picture, so every sound lands on its frame.
function scoreSound(k) {
  const D = DURATION;
  // first time (1 ms scan) at which f(t) reaches or passes v
  const when = (f, v, a, b) => { for (let t = a; t <= b; t += 0.001) if (f(t) >= v) return t; return b; };
  // gamelan-ish struck bronze: fundamental + a slightly detuned twin (the beat) + soft upper partials, under 2.5 kHz
  const gam = (t, n, g = 1, pan = 0, minor = false) => {
    const f = k.hz(n);
    k.tone(t, { f, dur: 1.9, gain: 0.13 * g, a: 0.002, pan, verb: 0.3, minor });
    k.tone(t, { f: f * 1.007, dur: 1.6, gain: 0.07 * g, a: 0.002, pan, verb: 0.3, minor });
    k.tone(t, { f: f * 2.01, dur: 0.55, gain: 0.04 * g, a: 0.002, pan, minor });
    if (f * 2.95 < 2500) k.tone(t, { f: f * 2.95, dur: 0.22, gain: 0.018 * g, a: 0.002, pan, minor });
    k.noise(t, { dur: 0.02, filter: 'bandpass', f: Math.min(2200, f * 1.6), q: 2, gain: 0.08 * g, pan, minor });
  };
  // the low gong for "0 ms"
  const gong = (t, g = 1) => {
    k.play('thud', t, { f: 90, gain: 0.7 * g });
    k.tone(t, { f: [[0, 98], [3.6, 95]], dur: 3.6, gain: 0.36 * g, a: 0.012, verb: 0.45 });
    k.tone(t, { f: [[0, 99.2], [3.2, 96]], dur: 3.2, gain: 0.16 * g, a: 0.02 });
    k.tone(t, { f: 202, dur: 2.2, gain: 0.1 * g, a: 0.01, verb: 0.4 });
    k.tone(t, { f: 277, dur: 1.4, gain: 0.05 * g, a: 0.01 });
    k.noise(t, { dur: 0.3, color: 'brown', filter: 'lowpass', f: 450, gain: 0.3 * g });
  };
  const tap = (t, f = 640, g = 0.55, pan = 0, minor = true) => { k.play('tock', t, { f, gain: g, pan, minor }); k.noise(t, { dur: 0.014, filter: 'bandpass', f: 1700, q: 2.5, gain: 0.32 * g, a: 0.001, pan, minor }); };
  const hide = (t, dur, g = 0.5, pan = 0, minor = true) => k.play('paper', t, { dur, gain: g, pan, minor });
  const slide = (t, dur, g = 0.12, pan = 0, minor = true) => k.noise(t, { dur, color: 'brown', filter: 'lowpass', f: [[0, 260], [dur * 0.5, 520], [dur, 240]], gain: g, a: dur * 0.4, pan, minor });
  const flap = (t, g = 0.25, pan = 0, minor = true) => k.noise(t, { dur: 0.11, color: 'pink', filter: 'lowpass', f: [[0, 900], [0.11, 300]], gain: g, a: 0.03, pan, minor });
  const brush = (t, dur, g = 0.8, pan = 0) => k.play('stroke', t, { material: 'brush', dur, gain: g, pan, minor: true });
  const clack = (t, pan = 0, g = 0.7) => { tap(t, 360, g, pan); k.play('paper', t, { dur: 0.06, gain: 0.25, pan, minor: true }); };
  const knockTap = (t, pan) => { k.play('thud', t, { f: 170, gain: 0.4, pan }); tap(t, 300, 0.8, pan, false); };
  // a pair of shears closing: two bright metallic clicks over a short rasp
  const snip = (t, pan = 0) => {
    k.noise(t - 0.06, { dur: 0.07, filter: 'bandpass', f: [[0, 2600], [0.07, 4200]], q: 2, gain: 0.12, a: 0.04, pan });
    [0, 0.028].forEach((d, i) => { k.noise(t + d, { dur: 0.03, filter: 'bandpass', f: 3600 - i * 700, q: 7, gain: 0.5, a: 0.001, pan }); k.tone(t + d, { f: 2350 - i * 400, dur: 0.12, gain: 0.05, a: 0.001, pan }); });
  };
  const hopsOf = (f, t0, t1) => [0.5, 1].map((v) => when(f, v, t0, t1));

  // ---- beds: the lamp's hum and the room
  k.bed('hum', 0.2, D, { gain: 0.5 });
  k.bed('room', 0, D, { gain: 0.7 });
  // the lamp catches: a soft whump, then a few sputters
  k.noise(0.04, { dur: 0.45, color: 'brown', filter: 'lowpass', f: [[0, 200], [0.12, 700], [0.45, 180]], gain: 0.4, a: 0.05 });
  [0.18, 0.31, 0.47].forEach((t, i) => k.noise(t, { dur: 0.012, filter: 'bandpass', f: 1300 + i * 300, q: 1.5, gain: 0.12, minor: true }));
  [2.05, 5.9, 7.05, 11.35, 14.05].forEach((t, i) => k.noise(t, { dur: 0.01, filter: 'bandpass', f: 1500 + i * 120, q: 1.4, gain: 0.07, minor: true }));

  // ---- HOOK: the title card drops on its strings (lands ~0.62) and rings a bronze note
  hide(0.22, 0.32, 0.7);
  tap(0.62, 520, 0.7, 0, false);
  gam(0.64, 'D4', 1.0);
  // hoisted to the corner
  slide(T.hoist, 0.55, 0.14, -0.4);
  tap(T.hoist + 0.53, 700, 0.45, -0.6);

  // ---- CLOUD-FIRST
  const phoneIn = (t) => EO(sm(T.cloudIn, T.cloudIn + 0.5, t));
  hide(T.cloudIn, 0.4, 0.5, -0.6);
  hopsOf(phoneIn, T.cloudIn, T.cloudIn + 0.5).forEach((t, i) => tap(t, 420 - i * 40, 0.5 + i * 0.15, -0.5));
  slide(T.cloudIn + 0.12, 0.46, 0.14, 0.6); tap(T.cloudIn + 0.56, 380, 0.6, 0.6);       // server rises on its rod
  tap(2.44, 820, 0.45, 0);                                                              // Cloud-first plaque
  hide(2.5, 0.25, 0.35); tap(2.76, 760, 0.45);                                          // counter board drops
  tap(2.69, 880, 0.35, 0.6);                                                            // Server plaque
  hide(2.3, 0.25, 0.5, -0.8);                                                           // the hand comes in
  knockTap(T.tap1, -0.45);
  brush(T.reqA, T.reqB - T.reqA, 0.75, 0.1);                                           // request vine grows
  tap(T.reqB + 0.04, 600, 0.4, 0.6);                                                    // the request reaches the server
  brush(T.resA, T.resB - T.resA, 0.75, 0.1);                                           // response vine grows back
  // the wait counts up: wooden ticks, at most ~11 a second
  { let last = -1, prev = waitMs(T.reqA); for (let t = T.reqA + 0.01; t < T.waitEnd - 0.03; t += 0.002) { const v = waitMs(t); if (v !== prev && t - last >= 0.09) { tap(t, 1150, 0.3, 0); last = t; } prev = v; } }
  // the reply finally lands: a dull, low bronze (slow)
  tap(T.waitEnd, 420, 0.7, -0.4, false); gam(T.waitEnd + 0.01, 'A2', 0.9, -0.2); gam(T.waitEnd + 0.01, 'D3', 0.5, -0.2);
  hide(3.0, 0.3, 0.4, -0.8);                                                           // hand slides away

  // ---- SCENE CHANGE: the lamp is turned down and up
  k.noise(T.dipA, { dur: T.dipB - T.dipA, color: 'brown', filter: 'lowpass', f: [[0, 600], [0.25, 140], [0.5, 600]], gain: 0.35, a: 0.05, hold: 0.3 });

  // ---- LOCAL-FIRST: one tap, straight into the store, "0 ms"
  brush(T.wrVine, 0.32, 0.6, -0.3);
  hide(4.55, 0.28, 0.4, 0.5); tap(4.84, 760, 0.45, 0.5);                                // board drops
  hide(4.62, 0.25, 0.5, -0.8);                                                          // hand in
  tap(4.66, 820, 0.45, -0.1);                                                           // Local-first plaque
  knockTap(T.tap2, -0.6);
  clack(T.tap2 + 0.11, -0.2, 0.9);                                                      // the note drops into the store
  gong(T.zero, 1.1);                                                                    // 0 ms: the biggest hit
  gam(T.zero + 0.02, 'D5', 0.7, 0.4);
  [0.14, 0.24, 0.34].forEach((d, i) => gam(T.zero + d, ['A5', 'D6', 'F5'][i], 0.22, [-0.5, 0.5, 0.2][i], true));   // lace stars
  hide(5.3, 0.3, 0.4, -0.8);                                                           // hand away

  // ---- BACKGROUND SYNC
  slide(T.boardUp, 0.35, 0.13, 0.5);                                                    // the board is hoisted
  slide(T.boardUp + 0.1, 0.32, 0.12, 0.3); tap(T.boardUp + 0.42, 520, 0.5, 0.3);        // outbox rises
  slide(T.serverIn, 0.4, 0.13, 0.7); tap(T.serverIn + 0.38, 380, 0.55, 0.7);            // server rises
  brush(T.obVine, 0.25, 0.5, 0.2);
  clack(T.obVine + 0.24, 0.3, 0.6);                                                     // a copy into the outbox
  brush(T.syVine, 0.42, 0.7, 0.5);
  tap(6.8, 820, 0.45, 0.4);                                                             // Sync later plaque
  hide(T.syncA, 0.4, 0.25, 0.5);
  tap(T.syncA + 0.42, 600, 0.55, 0.7); gam(T.syncA + 0.43, 'A4', 0.5, 0.7, true);      // reaches the server

  // ---- OFFLINE
  slide(7.85, 0.3, 0.1, 0.4);                                                           // Sync later pulled up
  hide(7.75, 0.24, 0.4, 0.4);                                                           // scissors come up
  snip(T.snip, 0.4);
  k.noise(T.snip, { dur: 0.14, filter: 'highpass', f: 1200, gain: 0.08, a: 0.06 });    // red gel slid in front of the lamp
  gam(T.snip + 0.03, 'Eb4', 0.75, 0.3); gam(T.snip + 0.03, 'E4', 0.65, 0.3); gam(T.snip + 0.03, 'A2', 0.85, 0);   // clash: wrong
  tap(T.snip + 0.26, 600, 0.55, 0.5);                                                   // Offline tag lands
  hide(8.2, 0.3, 0.35, 0.4);                                                            // scissors leave
  hide(8.22, 0.25, 0.5, -0.8);                                                          // hand in
  T.tapsOff.forEach((t, i) => { knockTap(t, -0.6); clack(t + 0.11, -0.2, 0.7); tap(t + 0.24, 980 + i * 120, 0.5, 0.3); });   // write, then queue
  hide(9.05, 0.3, 0.4, -0.8);

  // ---- BACK ONLINE
  brush(T.heal, 0.3, 0.7, 0.5);
  flap(T.online - 0.12, 0.3, 0.5);                                                      // the tag flips
  gam(T.online + 0.02, 'A4', 0.85, 0.5); gam(T.online + 0.14, 'D5', 0.85, 0.5);         // right
  [T.flushA, T.flushA + 0.16].forEach((t, i) => { tap(t + 0.42, 600 + i * 60, 0.55, 0.7); });

  // ---- SCENE CHANGE: lace curtains close and part
  for (const pan of [-0.7, 0.7]) k.noise(T.curtA + 0.01, { dur: 0.32, color: 'pink', filter: 'bandpass', f: [[0, 500], [0.2, 1500], [0.32, 700]], q: 0.7, gain: 0.25, a: 0.12, pan });
  k.play('thud', T.curtA + 0.3, { f: 110, gain: 0.3 });
  for (const pan of [-0.7, 0.7]) k.noise(T.sceneM + 0.1, { dur: 0.36, color: 'pink', filter: 'bandpass', f: [[0, 700], [0.2, 1500], [0.36, 500]], q: 0.7, gain: 0.22, a: 0.12, pan });

  // ---- MERGE
  slide(T.mergeIn - 0.15, 0.35, 0.12); tap(T.mergeIn + 0.2, 420, 0.55);                  // the mill rises
  tap(10.96, 820, 0.45);                                                                // CRDT merge plaque
  brush(T.mVineA, 0.3, 0.6, -0.5); brush(T.mVineA + 0.06, 0.3, 0.6, 0.5);
  clack(T.mCardA + 0.46, -0.2, 0.7); clack(T.mCardB + 0.46, 0.2, 0.7);                  // both edits drop into the mill
  for (let t = T.mill + 0.02; t < T.merged; t += 0.075) tap(t, 1050 + ((t * 40) % 3) * 60, 0.5, ((t * 13) % 1) - 0.5);   // gears ratchet
  gam(11.64, 'A5', 0.35, -0.3, true);                                                   // sparks
  hide(T.merged, 0.18, 0.4); tap(T.merged + 0.16, 520, 0.6);                            // merged note pushed out
  gam(T.tickM, 'A4', 0.85, 0.2); gam(T.tickM + 0.12, 'D5', 0.85, 0.2);                  // tick: merged
  [-0.7, 0.7].forEach((pan, i) => gam(T.converge + 0.08 + i * 0.05, 'F5', 0.35, pan, true));   // both screens agree

  // ---- SCENE CHANGE: the note flies at the lamp
  flap(T.fly, 0.4, 0, false); flap(T.fly + 0.13, 0.45, 0, false);
  k.noise(T.fly + 0.06, { dur: 0.7, color: 'pink', filter: 'bandpass', f: [[0, 180], [0.35, 800], [0.7, 160]], q: 0.8, gain: 0.42, a: 0.3, verb: 0.2 });
  k.play('thud', T.sceneE, { f: 70, gain: 0.35 });

  // ---- TAKEAWAY: the card drops; a resolving bronze phrase
  hide(T.take, 0.3, 0.4);
  tap(T.take + 0.32, 520, 1.0, 0, true);
  gam(T.take + 0.42, 'D4', 0.9, -0.2); gam(T.take + 0.56, 'A4', 0.85, 0); gam(T.take + 0.7, 'D5', 0.8, 0.2);
  k.tone(T.take + 0.42, { f: 'D3', dur: 2.0, gain: 0.12, a: 0.01, verb: 0.4 });
  tap(14.35, 420, 0.8, 0.5);                                                            // the phone takes a bow
}
