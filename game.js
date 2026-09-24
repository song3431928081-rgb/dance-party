// ===== DANCE PARTY — Tap to Spawn Dancers! =====
// Infinite spawn meme dancer game. No goals. Just vibes.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ----- Character types (pure canvas drawing — NO IMAGES) -----
const CHAR_TYPES = ['broccoli', 'mushroom', 'potato', 'chili'];

// ----- Canvas sizing -----
let W, H;
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ===== Audio Engine =====
let audioCtx = null, musicGain = null, isPlaying = false, muted = false;
let musicStartTime = 0;
const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const LOOP = BAR * 4;

// Super catchy lo-fi disco loop
const melody = [
  [0,'C5',0.5],[0.5,'G5',0.5],[1,'A5',0.5],[1.5,'G5',0.5],
  [2,'F5',0.5],[2.5,'A5',0.5],[3,'G5',0.5],[3.5,'E5',0.5],
];
const bass = [
  [0,'C3',1],[1.5,'C3',1],[2,'G3',1],[3.5,'C3',1],
];
const noteFreq = {
  'C3':130.81,'G3':196.00,
  'C5':523.25,'D5':587.33,'E5':659.25,'F5':698.46,'G5':783.99,'A5':880.00,'B5':987.77,
};

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = muted ? 0 : 0.45;
  musicGain.connect(audioCtx.destination);
}

function playTone(freq, time, dur, type, vol) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(vol, time + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, time + dur);
  osc.connect(g); g.connect(musicGain);
  osc.start(time); osc.stop(time + dur);
}

function playKick(time) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.frequency.setValueAtTime(120, time);
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
  g.gain.setValueAtTime(0.5, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
  osc.connect(g); g.connect(musicGain);
  osc.start(time); osc.stop(time + 0.2);
}
function playHat(time) {
  const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.04, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.1, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
  src.connect(g); g.connect(musicGain);
  src.start(time);
}

let nextLoopTime = 0;
function scheduleMusic() {
  if (!isPlaying) return;
  const now = audioCtx.currentTime;
  while (nextLoopTime < now + 1.5) {
    const ls = nextLoopTime;
    for (const [off, note, dur] of melody) {
      playTone(noteFreq[note], ls + off * BEAT, dur * BEAT * 0.9, 'triangle', 0.12);
    }
    for (const [off, note, dur] of bass) {
      playTone(noteFreq[note], ls + off * BEAT, dur * BEAT * 0.8, 'sawtooth', 0.18);
    }
    for (let b = 0; b < 4; b++) {
      const bt = ls + b * BEAT;
      playKick(bt);
      playHat(bt + BEAT * 0.5);
    }
    nextLoopTime += LOOP;
  }
  setTimeout(scheduleMusic, 200);
}

function startMusic() {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  isPlaying = true;
  nextLoopTime = audioCtx.currentTime + 0.1;
  scheduleMusic();
}

function getBeatProgress() {
  if (!audioCtx || !isPlaying) return 0;
  return ((audioCtx.currentTime - musicStartTime) % BAR) / BAR;
}

function sfxPop() {
  if (!audioCtx || muted) return;
  const t = audioCtx.currentTime;
  const f = 400 + Math.random() * 400;
  playTone(f, t, 0.08, 'sine', 0.1);
}

// ===== Dancers =====
const dancers = [];
const MAX_DANCERS = 250;

function randomType() {
  return CHAR_TYPES[Math.floor(Math.random() * CHAR_TYPES.length)];
}

function createDancer(x, y) {
  if (dancers.length >= MAX_DANCERS) return;
  const baseSize = 110 + Math.random() * 50; // 110-160px — BIGGER!
  dancers.push({
    type: randomType(),
    x, y,
    vx: (Math.random() - 0.5) * 60,
    vy: (Math.random() - 0.5) * 60,
    radius: baseSize * 0.4,
    baseSize,
    rotation: Math.random() * Math.PI * 2,
    danceOffset: Math.random() * Math.PI * 2,
    danceSpeed: 6 + Math.random() * 6,
    zIndex: 0, // for depth sorting
    scaleX: 0,  // spawn-in animation
    scaleY: 0,
    spawnT: 0,
  });
  sfxPop();
}

function createRandomDancer() {
  const x = 80 + Math.random() * (W - 160);
  const y = 80 + Math.random() * (H - 160);
  createDancer(x, y);
}

function clearAll() {
  dancers.length = 0;
}

// ===== Physics =====
function updatePhysics(dt) {
  // Apply velocities
  for (const d of dancers) {
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    // Friction
    d.vx *= 0.992;
    d.vy *= 0.992;
    // Small random nudge = keeps them dancing around
    d.vx += (Math.random() - 0.5) * 4;
    d.vy += (Math.random() - 0.5) * 4;

    // Walls
    const pad = d.radius * 0.8;
    if (d.x < pad) { d.x = pad; d.vx = Math.abs(d.vx) * 0.8; }
    if (d.x > W - pad) { d.x = W - pad; d.vx = -Math.abs(d.vx) * 0.8; }
    if (d.y < pad) { d.y = pad; d.vy = Math.abs(d.vy) * 0.8; }
    if (d.y > H - pad) { d.y = H - pad; d.vy = -Math.abs(d.vy) * 0.8; }

    // Spawn animation
    if (d.spawnT < 0.3) {
      d.spawnT += dt;
      const t = Math.min(1, d.spawnT / 0.3);
      d.scaleX = d.scaleY = t * t * (3 - 2 * t); // ease out cubic
    } else {
      d.scaleX = 1; d.scaleY = 1;
    }

    // Z-index = y for depth sorting illusion
    d.zIndex = d.y;
  }

  // Circle collision — push apart
  for (let i = 0; i < dancers.length; i++) {
    for (let j = i + 1; j < dancers.length; j++) {
      const a = dancers[i], b = dancers[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const minDist = a.radius * 0.7 + b.radius * 0.7;
      if (dist < minDist && dist > 0) {
        const overlap = (minDist - dist) * 0.5;
        const nx = dx / dist, ny = dy / dist;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        // Bounce
        const dot = a.vx * nx + a.vy * ny - (b.vx * nx + b.vy * ny);
        if (dot > 0) {
          a.vx -= dot * nx * 0.5; a.vy -= dot * ny * 0.5;
          b.vx += dot * nx * 0.5; b.vy += dot * ny * 0.5;
        }
      }
    }
  }

  // Sort by y for depth
  dancers.sort((a, b) => a.zIndex - b.zIndex);
}

// ===== Canvas-drawn body parts (no images, no borders) =====

function drawLimb(ctx, type, w, h, px, py, angle, isArm) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(angle);
  const bodyColor = (type === 'potato') ? '#f5f0e8' : '#f5dc6a';
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  const r = w/2;
  // Manual rounded rect (no roundRect polyfill needed)
  ctx.beginPath();
  ctx.moveTo(-w/2 + r, 0);
  ctx.lineTo(w/2 - r, 0);
  ctx.quadraticCurveTo(w/2, 0, w/2, r);
  ctx.lineTo(w/2, h - r);
  ctx.quadraticCurveTo(w/2, h, w/2 - r, h);
  ctx.lineTo(-w/2 + r, h);
  ctx.quadraticCurveTo(-w/2, h, -w/2, h - r);
  ctx.lineTo(-w/2, r);
  ctx.quadraticCurveTo(-w/2, 0, -w/2 + r, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Hand/Foot blob at tip
  ctx.beginPath();
  ctx.arc(0, h, w * 0.6, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBody(ctx, type, size) {
  const bodyW = size * 0.45;
  const bodyH = size * 0.42;
  const cx = 0;
  const cy = size * 0.08; // center of body (lower half)
  let color = '#f5dc6a';
  if (type === 'potato') color = '#f5f0e8';
  else if (type === 'mushroom') color = '#f0f0d8';
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyW/2, bodyH/2, 0, 0, Math.PI*2);
  ctx.fill();
  ctx.stroke();
  // Navel dot
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(cx, cy + bodyH*0.15, 2, 0, Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function drawHead(ctx, type, size) {
  const hs = size * 0.48; // head scale
  ctx.save();

  if (type === 'broccoli') {
    // Green bushy blob pile (broccoli top)
    // Stem (thin stalk coming down from head to body)
    ctx.fillStyle = '#7ec44a';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    // Several overlapping green blobs
    const blobs = [
      [0, -hs*0.3, hs*0.65, hs*0.6],
      [-hs*0.35, -hs*0.15, hs*0.45, hs*0.45],
      [hs*0.35, -hs*0.15, hs*0.45, hs*0.45],
      [0, -hs*0.65, hs*0.55, hs*0.5],
      [-hs*0.18, -hs*0.75, hs*0.35, hs*0.35],
      [hs*0.18, -hs*0.75, hs*0.35, hs*0.35],
    ];
    for (const [bx, by, bw, bh] of blobs) {
      ctx.beginPath();
      ctx.ellipse(bx, by, bw, bh, 0, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.stroke();
    // Green dots on blobs for texture
    ctx.fillStyle = '#5ba33a';
    for (let i = 0; i < 25; i++) {
      const bx = (Math.random() - 0.5) * hs * 1.2;
      const by = -hs * 0.2 - Math.random() * hs * 0.7;
      ctx.beginPath();
      ctx.arc(bx, by, 1.5 + Math.random()*2, 0, Math.PI*2);
      ctx.fill();
    }
    // Face on the green blob center (on stalk region)
    // The face sits on a thin yellow-green stalk patch
    ctx.fillStyle = '#c4d89a';
    ctx.beginPath();
    ctx.ellipse(0, hs*0.05, hs*0.32, hs*0.22, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

  } else if (type === 'mushroom') {
    // Red cap + white spots
    ctx.fillStyle = '#e84141';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, -hs*0.1, hs*0.85, Math.PI, 0); // half circle cap
    ctx.fill();
    ctx.stroke();
    // White spots
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-hs*0.35, -hs*0.3, hs*0.14, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc( hs*0.3, -hs*0.25, hs*0.11, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc( hs*0.1, -hs*0.45, hs*0.09, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // Stem (face area)
    ctx.fillStyle = '#f0f0d8';
    ctx.beginPath();
    ctx.rect(-hs*0.28, -hs*0.1, hs*0.56, hs*0.55);
    ctx.fill();
    ctx.stroke();

  } else if (type === 'potato') {
    // Lumpy brown potato head
    ctx.fillStyle = '#b07948';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, hs*0.05, hs*0.8, hs*0.75, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    // Lumps / dimples
    ctx.fillStyle = '#8a5a30';
    for (let i = 0; i < 6; i++) {
      const bx = (Math.random() - 0.5) * hs * 1.2;
      const by = -hs*0.2 + Math.random() * hs * 0.5;
      ctx.beginPath();
      ctx.arc(bx, by, 2 + Math.random()*2, 0, Math.PI*2);
      ctx.fill();
    }

  } else if (type === 'chili') {
    // Red curly chili pepper head with green stem
    ctx.fillStyle = '#e62c2c';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 3;
    // Curved chili body (ellipse rotated)
    ctx.save();
    ctx.translate(0, -hs*0.1);
    ctx.rotate(-0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, hs*0.32, hs*0.95, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Green curly stem on top
    ctx.strokeStyle = '#2a7a2a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -hs*0.7);
    ctx.quadraticCurveTo(hs*0.35, -hs*1.1, hs*0.1, -hs*1.25);
    ctx.stroke();
    ctx.fillStyle = '#2a7a2a';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(hs*0.28, -hs*0.85, hs*0.15, hs*0.1, 0.6, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();
  }

  // ===== FACE (all types — slightly different per type) =====
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (type === 'potato') {
    // One BIG eye, one small eye (asymmetric)
    // Big eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-hs*0.2, -hs*0.02, hs*0.14, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-hs*0.18, -hs*0.01, hs*0.07, 0, Math.PI*2); ctx.fill();
    // Small eye
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(hs*0.28, hs*0.05, hs*0.09, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(hs*0.28, hs*0.06, hs*0.04, 0, Math.PI*2); ctx.fill();
    // Big grin with teeth
    ctx.strokeStyle = '#111';
    ctx.beginPath();
    ctx.arc(0, hs*0.28, hs*0.25, 0.2, Math.PI - 0.2);
    ctx.stroke();
    // Teeth
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.rect(-hs*0.16, hs*0.28, hs*0.06, hs*0.08); ctx.fill(); ctx.stroke();
    ctx.rect(-hs*0.05, hs*0.28, hs*0.06, hs*0.08); ctx.fill(); ctx.stroke();
    ctx.rect( hs*0.06, hs*0.28, hs*0.06, hs*0.08); ctx.fill(); ctx.stroke();
    // Missing tooth = gap on right
  } else if (type === 'chili') {
    // Bulging big eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-hs*0.2, -hs*0.12, hs*0.13, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc( hs*0.2, -hs*0.12, hs*0.13, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-hs*0.18, -hs*0.1, hs*0.06, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( hs*0.22, -hs*0.1, hs*0.06, 0, Math.PI*2); ctx.fill();
    // Evil grin with sharp teeth
    ctx.beginPath();
    ctx.arc(0, hs*0.22, hs*0.2, 0.15, Math.PI - 0.15);
    ctx.stroke();
    // Teeth triangles
    ctx.fillStyle = '#fff';
    for (let i = -2; i <= 2; i++) {
      const tx = i * hs * 0.08;
      ctx.beginPath();
      ctx.moveTo(tx - hs*0.04, hs*0.22);
      ctx.lineTo(tx, hs*0.32);
      ctx.lineTo(tx + hs*0.04, hs*0.22);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  } else {
    // Broccoli + Mushroom — googly eyes + red lips
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-hs*0.22, -hs*0.05, hs*0.14, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc( hs*0.22, -hs*0.05, hs*0.14, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(-hs*0.2, -hs*0.04, hs*0.07, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc( hs*0.24, -hs*0.04, hs*0.07, 0, Math.PI*2); ctx.fill();
    // Eyelashes (broccoli only)
    if (type === 'broccoli') {
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const lx = -hs*0.22 + i * hs*0.055;
        ctx.beginPath();
        ctx.moveTo(lx, -hs*0.18);
        ctx.lineTo(lx, -hs*0.28);
        ctx.stroke();
      }
      for (let i = -2; i <= 2; i++) {
        const lx = hs*0.22 + i * hs*0.055;
        ctx.beginPath();
        ctx.moveTo(lx, -hs*0.18);
        ctx.lineTo(lx, -hs*0.28);
        ctx.stroke();
      }
    }
    // Red lips + tongue (broccoli, mushroom)
    ctx.fillStyle = '#d12a5a';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(0, hs*0.22, hs*0.2, hs*0.09, 0, 0, Math.PI*2);
    ctx.fill(); ctx.stroke();
    // Small tongue
    ctx.fillStyle = '#ff8fbc';
    ctx.beginPath();
    ctx.ellipse(0, hs*0.3, hs*0.08, hs*0.05, 0, 0, Math.PI*2);
    ctx.fill();
  }

  ctx.restore();
}

// ===== Render =====
function render(time) {
  // Background
  ctx.fillStyle = '#f5f3ef';
  ctx.fillRect(0, 0, W, H);

  // Beat pulse (whole screen breathes with music)
  const bp = getBeatProgress();
  const beatInfluence = Math.abs(Math.sin(bp * Math.PI));
  const bgPulse = beatInfluence * 0.03;
  if (bgPulse > 0.01) {
    ctx.fillStyle = `rgba(255,45,149,${bgPulse})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Draw each dancer — PURE CANVAS, body parts animated independently
  const globalBeat = time / 1000;
  for (const d of dancers) {
    const dancePhase = globalBeat * d.danceSpeed + d.danceOffset;

    // Body-level animation
    const beatBounce = Math.abs(Math.sin(bp * Math.PI * 2 + d.danceOffset)) * 26;
    const randomHop = Math.abs(Math.sin(dancePhase)) * 14;
    const bounceY = beatBounce + randomHop;
    const sway = Math.sin(dancePhase * 0.6) * 0.55 + Math.sin(bp * Math.PI * 2) * 0.35;
    const beatSquash = 1 + Math.sin(bp * Math.PI * 2 + d.danceOffset) * 0.28;
    const microStretch = 1 + Math.sin(dancePhase * 2.5) * 0.12;
    const sx = beatSquash * microStretch;
    const sy = 1 / beatSquash * (2 - microStretch);
    const stepWiggle = Math.sin(dancePhase * 1.5) * 12;
    const spinKick = Math.sin(dancePhase * 0.4) * 0.18;
    const size = d.baseSize * d.scaleX;

    // PER-LIMB angles
    const armLSwing = Math.sin(dancePhase * 2.2) * 1.2 + Math.cos(bp * Math.PI * 2 + d.danceOffset) * 0.6;
    const armRSwing = Math.sin(dancePhase * 2.2 + Math.PI) * 1.2 + Math.cos(bp * Math.PI * 2 + d.danceOffset + Math.PI) * 0.6;
    const legLKick = Math.sin(dancePhase * 1.8) * 0.9 + Math.cos(bp * Math.PI * 2 + d.danceOffset) * 0.4;
    const legRKick = Math.sin(dancePhase * 1.8 + Math.PI) * 0.9 + Math.cos(bp * Math.PI * 2 + d.danceOffset + Math.PI) * 0.4;
    const headNod = Math.sin(dancePhase * 1.2) * 0.3 + Math.cos(bp * Math.PI * 2) * 0.15;
    const headTilt = Math.sin(dancePhase * 0.9) * 0.4;

    const px = d.x + stepWiggle * 0.3;
    const py = d.y;
    const bodyTopY = -bounceY - size * 0.38; // body pivot (shoulder line) in local y (before squash)

    // ===== SHADOW =====
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.15 * d.scaleY})`;
    ctx.beginPath();
    ctx.ellipse(px, py + d.radius * 0.6, d.radius * 1.1, d.radius * 0.3, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // ===== DRAW ALL PARTS under body transform =====
    ctx.save();
    ctx.translate(px, py - bounceY);
    ctx.rotate(sway + spinKick);
    ctx.scale(sx * d.scaleX, sy * d.scaleY);

    // ---- LEGS (drawn first, behind body) ----
    drawLimb(ctx, d.type, size * 0.42, size * 0.55, -size * 0.15, size * 0.38, legLKick);
    drawLimb(ctx, d.type, size * 0.42, size * 0.55,  size * 0.15, size * 0.38, legRKick);

    // ---- BODY ----
    drawBody(ctx, d.type, size);

    // ---- ARMS ----
    drawLimb(ctx, d.type, size * 0.28, size * 0.55, -size * 0.45, size * 0.08, armLSwing, true);
    drawLimb(ctx, d.type, size * 0.28, size * 0.55,  size * 0.45, size * 0.08, armRSwing, true);

    // ---- HEAD (with nod + tilt) ----
    ctx.save();
    ctx.translate(0, -size * 0.38); // head pivot at neck
    ctx.rotate(headTilt + headNod);
    drawHead(ctx, d.type, size);
    ctx.restore();

    ctx.restore();
  }
}

// ===== Main Loop =====
let lastTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  updatePhysics(dt);
  render(t);
  // Update HUD counter
  const el = document.getElementById('dancer-count');
  if (el) el.textContent = dancers.length;
}
requestAnimationFrame(t => { lastTime = t; loop(t); });

// ===== Input =====
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Spawn 1-3 dancers near tap
  const n = 1 + (Math.random() < 0.3 ? 1 : 0) + (Math.random() < 0.1 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const jitterX = (Math.random() - 0.5) * 100;
    const jitterY = (Math.random() - 0.5) * 100;
    createDancer(x + jitterX, y + jitterY);
  }
});

// ===== Flow =====
let state = 'START';

document.getElementById('start-btn').addEventListener('click', () => {
  state = 'PLAYING';
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('hint').classList.remove('hidden');

  initAudio();
  musicStartTime = audioCtx.currentTime + 0.1;
  startMusic();

  // Spawn a few to start
  for (let i = 0; i < 3; i++) createRandomDancer();

  setTimeout(() => {
    const h = document.getElementById('hint');
    h.style.transition = 'opacity 1s';
    h.style.opacity = '0';
    setTimeout(() => h.classList.add('hidden'), 1200);
  }, 3000);
});

document.getElementById('clear-btn').addEventListener('click', clearAll);
document.getElementById('mute-btn').addEventListener('click', () => {
  muted = !muted;
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.45;
});
