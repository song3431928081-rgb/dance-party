// ===== WOBBLE SLAP — Tap to Slap! =====
// Pure canvas + physics. No images. Just goofy slaps.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// ----- Sizing -----
let W, H;
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ===== AUDIO — synth slap sounds =====
let audioCtx = null, masterGain = null, muted = false;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
}
function slapSound(strength = 1) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  // Noise burst — the slap itself
  const dur = 0.12;
  const len = audioCtx.sampleRate * dur;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    // White noise decaying fast
    d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.6 * strength, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 400;
  src.connect(hp); hp.connect(g); g.connect(masterGain);
  src.start(t);
  // Low thump — the body impact
  const o = audioCtx.createOscillator();
  const og = audioCtx.createGain();
  o.frequency.setValueAtTime(300, t);
  o.frequency.exponentialRampToValueAtTime(80, t + 0.1);
  og.gain.setValueAtTime(0.4 * strength, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  o.connect(og); og.connect(masterGain);
  o.start(t); o.stop(t + 0.18);
}
function wobbleSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(200 + Math.random() * 200, t);
  o.frequency.linearRampToValueAtTime(120 + Math.random() * 100, t + 0.2);
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + 0.3);
}

// ===== WOBBLERS — 4 jelly types, pure canvas =====
const WOBBLE_TYPES = ['pudding', 'donut', 'jelly', 'marshmallow'];

function drawJelly(ctx, wob) {
  ctx.save();
  ctx.translate(wob.x, wob.y);
  ctx.rotate(wob.rotation);
  // Squish squash from velocity
  const squash = 1 + Math.abs(wob.vy) * 0.004;
  const stretch = 1 / squash;
  ctx.scale(stretch * wob.squishX, squash * wob.squishY);

  const r = wob.radius;
  let bodyColor, edgeColor, faceColor;

  if (wob.type === 'pudding') {
    bodyColor = '#ffe4b5'; edgeColor = '#d4a574'; faceColor = '#111';
  } else if (wob.type === 'donut') {
    bodyColor = '#ffb347'; edgeColor = '#cc7722'; faceColor = '#111';
  } else if (wob.type === 'jelly') {
    bodyColor = '#ff99cc'; edgeColor = '#cc3366'; faceColor = '#fff';
  } else { // marshmallow
    bodyColor = '#fff0f5'; edgeColor = '#ffb6c1'; faceColor = '#111';
  }

  // Body — round blob (2 halves for gradient feel)
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const segs = 24;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    // Soft wobble edge — sinusoidal
    const rw = r + Math.sin(a * 3 + wob.wobblePhase) * r * 0.06;
    const px = Math.cos(a) * rw;
    const py = Math.sin(a) * rw * 1.15; // slightly squashed vertical
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Doughnut hole (only donut type)
  if (wob.type === 'donut') {
    ctx.fillStyle = '#f8f4ef';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  }

  // Sparkle highlight
  ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.35, r * 0.25, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Eyes — pop out when hurt
  const hurt = wob.hurtT > 0;
  const eyeBulge = hurt ? r * 0.25 : r * 0.08;
  const eyeY = -r * 0.12;
  // Left eye
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(-r * 0.22, eyeY, r * 0.14 + eyeBulge * 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = faceColor;
  if (hurt) {
    ctx.beginPath();
    ctx.arc(-r * 0.22, eyeY + eyeBulge * 0.3, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(-r * 0.22, eyeY, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  // Right eye
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(r * 0.22, eyeY, r * 0.14 + eyeBulge * 0.3, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = faceColor;
  if (hurt) {
    ctx.beginPath();
    ctx.arc(r * 0.22, eyeY + eyeBulge * 0.3, r * 0.08, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(r * 0.22, eyeY, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // Mouth — shocked O when hurt, smirk otherwise
  ctx.strokeStyle = faceColor;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  if (hurt) {
    ctx.fillStyle = '#ff4d7c';
    ctx.beginPath();
    ctx.ellipse(0, r * 0.25, r * 0.1, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, r * 0.22, r * 0.18, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  ctx.restore();

  // Motion trail / squish shadow under body (outside rotate)
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.12 * wob.squishY})`;
  ctx.beginPath();
  ctx.ellipse(wob.x, wob.y + wob.radius * 1.05, wob.radius * 1.1, wob.radius * 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ===== Wobbler factory =====
const wobblers = [];
const GRAVITY = 900; // px/s²
const FRICTION = 0.995;
const REST = 0.55; // bounce restitution
const MAX_WOBBLERS = 80;

function createWobbler(x, y, opts = {}) {
  if (wobblers.length >= MAX_WOBBLERS) return;
  const type = opts.type || WOBBLE_TYPES[Math.floor(Math.random() * WOBBLE_TYPES.length)];
  const r = opts.radius || (28 + Math.random() * 18);
  wobblers.push({
    type, x, y,
    vx: opts.vx || (Math.random() - 0.5) * 200,
    vy: opts.vy || -200 - Math.random() * 200,
    radius: r,
    rotation: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 4,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleSpeed: 4 + Math.random() * 3,
    squishX: 1, squishY: 1,
    targetSquishX: 1, targetSquishY: 1,
    hurtT: 0,          // >0 means eyes pop out
    life: 0,
  });
}
function spawnInitial() {
  const n = 8 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const x = 80 + Math.random() * (W - 160);
    const y = H * 0.3 + Math.random() * (H * 0.4);
    createWobbler(x, y);
  }
}

// ===== Physics =====
function updatePhysics(dt) {
  for (const w of wobblers) {
    // Gravity
    w.vy += GRAVITY * dt;
    // Integrate
    w.x += w.vx * dt;
    w.y += w.vy * dt;
    // Air friction
    w.vx *= Math.pow(FRICTION, dt * 60);
    w.vy *= Math.pow(FRICTION, dt * 60);
    // Rotation
    w.rotation += w.rotSpeed * dt + w.vx * dt * 0.01;
    w.wobblePhase += w.wobbleSpeed * dt;
    // Hurt timer
    if (w.hurtT > 0) w.hurtT -= dt;
    // Squish spring — ease back to 1,1
    w.targetSquishX = 1; w.targetSquishY = 1;
    w.squishX += (w.targetSquishX - w.squishX) * Math.min(1, dt * 8);
    w.squishY += (w.targetSquishY - w.squishY) * Math.min(1, dt * 8);
    w.life += dt;

    // Walls
    const r = w.radius;
    if (w.x < r) { w.x = r; w.vx = Math.abs(w.vx) * REST; squish(w, -0.3, 0.1); }
    if (w.x > W - r) { w.x = W - r; w.vx = -Math.abs(w.vx) * REST; squish(w, 0.3, 0.1); }
    // Floor
    if (w.y > H - r) {
      w.y = H - r;
      if (Math.abs(w.vy) < 30) {
        w.vy = 0; // settle
        w.vx *= 0.92;
      } else {
        w.vy = -Math.abs(w.vy) * REST;
        squish(w, 0.0, 0.6); // big vertical squish on bounce
      }
      w.rotSpeed *= 0.9;
    }
    // Ceiling (no bouncing, just cap)
    if (w.y < r) { w.y = r; w.vy = Math.abs(w.vy) * 0.5; }
  }

  // Pair collision
  for (let i = 0; i < wobblers.length; i++) {
    for (let j = i + 1; j < wobblers.length; j++) {
      const a = wobblers[i], b = wobblers[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const distSq = dx * dx + dy * dy;
      const minD = a.radius + b.radius;
      if (distSq < minD * minD && distSq > 0) {
        const dist = Math.sqrt(distSq);
        const nx = dx / dist, ny = dy / dist;
        const overlap = (minD - dist) * 0.5;
        a.x -= nx * overlap; a.y -= ny * overlap;
        b.x += nx * overlap; b.y += ny * overlap;
        // Bounce
        const relVx = a.vx - b.vx, relVy = a.vy - b.vy;
        const dot = relVx * nx + relVy * ny;
        if (dot > 0) {
          const j = dot * REST;
          a.vx -= j * nx; a.vy -= j * ny;
          b.vx += j * nx; b.vy += j * ny;
          squish(a, -ny * 0.2, ny * 0.2);
          squish(b, ny * 0.2, -ny * 0.2);
        }
      }
    }
  }
}

function squish(w, dx, dy) {
  // dx, dy roughly direction of impact
  w.squishX = 1 + dx * 0.5;
  w.squishY = 1 + dy * 0.5;
}

// ===== RENDER =====
let slaps = []; // visual slap effects

function addSlap(x, y) {
  slaps.push({ x, y, t: 0, life: 0.35 });
}

function render() {
  // Background — subtle wobble gradient
  ctx.fillStyle = '#f8f4ef';
  ctx.fillRect(0, 0, W, H);

  // Floor line
  ctx.strokeStyle = '#e0d5cc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H - 20);
  ctx.lineTo(W, H - 20);
  ctx.stroke();

  // Wobblers — sorted by y for subtle depth
  wobblers.sort((a, b) => a.y - b.y);
  for (const w of wobblers) drawJelly(ctx, w);

  // Slap effects (draw after wobblers so they're on top)
  for (let i = slaps.length - 1; i >= 0; i--) {
    const s = slaps[i];
    s.t += 1 / 60;
    const k = Math.min(1, s.t / s.life);
    const r = 10 + k * 50;
    const alpha = 1 - k;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Hand print — pink half-circle palm
    ctx.fillStyle = '#ff6b9d';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    // Fingers — 5 small circles
    for (let f = 0; f < 5; f++) {
      const fa = -Math.PI / 2 + (f - 2) * 0.3;
      const fx = s.x + Math.cos(fa) * (r * 0.7);
      const fy = s.y + Math.sin(fa) * (r * 0.7);
      ctx.beginPath();
      ctx.arc(fx, fy, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // "SLAP!" text bursting out
    if (k < 0.6) {
      ctx.font = `bold ${18 + k * 20}px Impact`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,77,124,${alpha * 0.9})`;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = 3;
      ctx.strokeText('SLAP!', s.x, s.y - r - 8);
      ctx.fillText('SLAP!', s.x, s.y - r - 8);
    }
    ctx.restore();
    if (s.t >= s.life) slaps.splice(i, 1);
  }

  // ===== KALEIDO FILTER =====
  if (FILTERS[filterIdx] === 'KALEIDO') {
    const N = 6;
    const cx = W / 2, cy = H / 2;
    const maxR = Math.max(W, H);
    const temp = document.createElement('canvas');
    temp.width = canvas.width; temp.height = canvas.height;
    const tctx = temp.getContext('2d');
    tctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.fillStyle = '#f8f4ef';
    ctx.fillRect(0, 0, W, H);
    const sa = (Math.PI * 2) / N;
    for (let i = 0; i < N; i++) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(i * sa + filterAnimPhase * 0.4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, -sa / 2, sa / 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(temp, -cx, -cy);
      ctx.restore();
    }
    ctx.restore();
  }
}

// ===== SLAP DETECTION =====
let combo = 0, lastSlapT = 0, comboTimer = null;
const COMBO_WINDOW = 1.5; // 1.5s 内连续命中算 combo

function trySlap(x, y) {
  let hit = false;
  let hitStrength = 0;
  for (const w of wobblers) {
    const dx = w.x - x, dy = w.y - y;
    const d2 = dx * dx + dy * dy;
    const R = w.radius + 20; // slap hit radius
    if (d2 < R * R) {
      const d = Math.sqrt(d2) || 1;
      const nx = dx / d, ny = dy / d;
      // Slap force — stronger closer to center
      const strength = 800 + Math.random() * 400;
      w.vx += nx * strength;
      w.vy += ny * strength - 300; // extra upward pop
      w.hurtT = 0.5;
      squish(w, ny * 0.6, -nx * 0.4);
      hit = true;
      hitStrength = Math.max(hitStrength, strength);
    }
  }
  addSlap(x, y);
  if (hit) {
    const now = performance.now() / 1000;
    if (now - lastSlapT < COMBO_WINDOW) {
      combo++;
    } else {
      combo = 1;
    }
    lastSlapT = now;
    slapCount++;
    updateHUD();
    slapSound(Math.min(1.6, 1 + combo * 0.1));
    wobbleSound();
    updateCombo();
  } else {
    slapSound(0.5);
  }
}

let slapCount = 0;
function updateHUD() {
  const el = document.getElementById('slap-count');
  if (el) el.textContent = slapCount;
}
function updateCombo() {
  const box = document.getElementById('combo-box');
  const val = document.getElementById('combo-val');
  if (combo >= 2) {
    box.classList.remove('hidden');
    val.textContent = `x${combo}`;
    // Reset timer
    if (comboTimer) clearTimeout(comboTimer);
    comboTimer = setTimeout(() => {
      combo = 0;
      box.classList.add('hidden');
    }, COMBO_WINDOW * 1000);
  } else {
    box.classList.add('hidden');
  }
}

// ===== MAIN LOOP =====
let lastTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  updatePhysics(dt);
  render();
  stepFilter(dt);
}
requestAnimationFrame(t => { lastTime = t; loop(t); });

// ===== INPUT =====
canvas.addEventListener('pointerdown', e => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  trySlap(x, y);
});

// ===== FILTERS =====
const FILTERS = ['OFF', 'LSD', 'INVERT', 'GLOW', 'KALEIDO'];
let filterIdx = 0;
let filterAnimPhase = 0;
const FILTER_LABELS = { OFF: '🌀', LSD: '🌈', INVERT: '🔮', GLOW: '✨', KALEIDO: '🌸' };

function applyCSSFilter() {
  const el = document.getElementById('game-canvas');
  const f = FILTERS[filterIdx];
  if (f === 'OFF' || f === 'KALEIDO') {
    el.style.filter = 'none';
  } else if (f === 'LSD') {
    const h = (filterAnimPhase * 60) % 360;
    el.style.filter = `hue-rotate(${h}deg) saturate(2.2) contrast(1.4)`;
  } else if (f === 'INVERT') {
    el.style.filter = 'invert(1) hue-rotate(180deg) saturate(1.5)';
  } else if (f === 'GLOW') {
    el.style.filter = 'brightness(1.3) contrast(1.5) saturate(2) blur(0.5px)';
  }
}
function stepFilter(dt) {
  filterAnimPhase += dt * 3;
  applyCSSFilter();
}
document.getElementById('filter-btn').addEventListener('click', () => {
  filterIdx = (filterIdx + 1) % FILTERS.length;
  const f = FILTERS[filterIdx];
  const btn = document.getElementById('filter-btn');
  btn.textContent = FILTER_LABELS[f];
  btn.title = `Filter: ${f}`;
  filterAnimPhase = 0;
  applyCSSFilter();
});

// ===== HUD BUTTONS =====
document.getElementById('mute-btn').addEventListener('click', () => {
  muted = !muted;
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
});
document.getElementById('spawn-btn').addEventListener('click', () => {
  spawnInitial();
});

// ===== START =====
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('hint').classList.remove('hidden');
  initAudio();
  spawnInitial();
  // Give them a second to settle
  setTimeout(() => {
    const h = document.getElementById('hint');
    h.style.transition = 'opacity 1s';
    h.style.opacity = '0';
    setTimeout(() => h.classList.add('hidden'), 1200);
  }, 2500);
});
