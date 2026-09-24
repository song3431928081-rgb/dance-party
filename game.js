// ===== DANCE PARTY — Tap to Spawn Dancers! =====
// Infinite spawn meme dancer game. No goals. Just vibes.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ----- Images -----
const IMG = {};
const CHAR_TYPES = ['broccoli', 'mushroom', 'potato', 'chili'];
CHAR_TYPES.forEach(name => {
  const img = new Image();
  img.src = `assets/${name}.jpg`;
  IMG[name] = img;
});

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
  const baseSize = 60 + Math.random() * 30; // 60-90px
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

// ===== Render =====
function render(time) {
  // Background
  ctx.fillStyle = '#f5f3ef';
  ctx.fillRect(0, 0, W, H);

  // Subtle grid dots
  ctx.fillStyle = 'rgba(0,0,0,0.04)';
  const gs = 40;
  for (let x = gs; x < W; x += gs) {
    for (let y = gs; y < H; y += gs) {
      ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill();
    }
  }

  // Beat pulse (whole screen breathes with music)
  const bp = getBeatProgress();
  const beatInfluence = Math.abs(Math.sin(bp * Math.PI));
  const bgPulse = beatInfluence * 0.03;
  if (bgPulse > 0.01) {
    ctx.fillStyle = `rgba(255,45,149,${bgPulse})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Draw each dancer
  const globalBeat = time / 1000;
  for (const d of dancers) {
    // Beat-driven dance animation
    const dancePhase = globalBeat * d.danceSpeed + d.danceOffset;

    // Hop bounce — every beat
    const beatBounce = Math.abs(Math.sin(bp * Math.PI * 2 + d.danceOffset)) * 12;
    const randomHop = Math.abs(Math.sin(dancePhase)) * 6;
    const bounceY = beatBounce + randomHop;

    // Sway / tilt
    const sway = Math.sin(dancePhase * 0.6) * 0.25 + Math.sin(bp * Math.PI * 2) * 0.15;

    // Squash & stretch — strongest on beats
    const beatSquash = 1 + Math.sin(bp * Math.PI * 2 + d.danceOffset) * 0.12;
    const microStretch = 1 + Math.sin(dancePhase * 2) * 0.05;
    const sx = beatSquash * microStretch;
    const sy = 1 / beatSquash * (2 - microStretch); // preserves volume

    // Step animation (leg lift impression via y-offset wiggle)
    const stepWiggle = Math.sin(dancePhase * 1.5) * 4;

    // Arm wave (rotation of shadow + extra tilt illusion)
    const armTilt = Math.sin(dancePhase * 2) * 0.1;

    const size = d.baseSize * d.scaleX;

    ctx.save();
    ctx.translate(d.x + stepWiggle * 0.3, d.y - bounceY);
    ctx.rotate(sway + armTilt);
    ctx.scale(sx, sy);

    // Ground shadow
    ctx.restore();

    // Shadow on ground
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.12 * d.scaleY})`;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y + d.radius * 0.5, d.radius * 0.9, d.radius * 0.25, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    // Draw dancer
    ctx.save();
    ctx.translate(d.x + stepWiggle * 0.3, d.y - bounceY);
    ctx.rotate(sway + armTilt);
    ctx.scale(sx * d.scaleX, sy * d.scaleY);

    if (IMG[d.type] && IMG[d.type].complete) {
      ctx.drawImage(IMG[d.type], -size/2, -size/2, size, size);
    }
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
