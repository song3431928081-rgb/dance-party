// ===== SLIME LAB — Ooze Forever! =====
// Incremental + Genetics + Explosions. Pure canvas.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
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

// ===== GENETICS — 7 slime tiers =====
// Each tier has hue + rarity + value
const TIERS = [
  { id:'basic',   hue:130, label:'🟢 Basic',   rarity:0,   score:1 },
  { id:'cool',    hue:200, label:'🔵 Cool',    rarity:0.3, score:3 },
  { id:'hot',     hue:350, label:'🔴 Hot',     rarity:0.15, score:10 },
  { id:'rainbow', hue:-1,  label:'🌈 Rainbow',  rarity:0.03, score:50 },
  { id:'gold',    hue:50,  label:'🟡 Gold',    rarity:0.008, score:200 },
  { id:'void',    hue:280, label:'🟣 Void',    rarity:0.002, score:1000 },
  { id:'blackhole', hue:0, label:'⚫ BlackHole', rarity:0.0003, score:10000 },
];

// Crossbreed rules — child tier probabilities when parent A + parent B
// Higher parents = higher chance for better offspring
function crossbreed(aTier, bTier) {
  const maxTier = Math.max(aTier, bTier);
  const roll = Math.random();
  if (roll < 0.0005) return Math.min(TIERS.length - 1, maxTier + 3);
  if (roll < 0.01) return Math.min(TIERS.length - 1, maxTier + 2);
  if (roll < 0.05) return Math.min(TIERS.length - 1, maxTier + 1);
  if (roll < 0.15) return maxTier;
  if (roll < 0.5) return Math.max(0, maxTier - 1);
  return Math.max(0, maxTier - 2);
}

// ===== SLIMES =====
const slimes = [];
const MAX_SLIMES = 500;
let geneScore = 0;
let milestones = new Set();
const MILESTONES = [10, 50, 100, 250, 500];

// Particle system for breeding / popping
const particles = [];

function randomHueForTier(tierIdx) {
  const t = TIERS[tierIdx];
  if (t.id === 'rainbow') return Math.random() * 360;
  if (t.id === 'blackhole') return 0;
  if (t.hue === -1) return Math.random() * 360;
  return t.hue + (Math.random() - 0.5) * 20;
}

function createSlime(x, y, opts = {}) {
  if (slimes.length >= MAX_SLIMES) return;
  const tier = opts.tier ?? 0;
  const hue = opts.hue ?? randomHueForTier(tier);
  const r = opts.radius ?? (18 + tier * 4 + Math.random() * 10);
  slimes.push({
    x, y,
    vx: opts.vx ?? (Math.random() - 0.5) * 60,
    vy: opts.vy ?? -30 - Math.random() * 40,
    radius: r,
    targetRadius: r,
    tier, hue,
    wobblePhase: Math.random() * Math.PI * 2,
    wobbleSpeed: 2 + Math.random() * 3,
    breedCooldown: 2 + Math.random() * 3, // seconds until breeding attempt
    life: 0,
    // Black holes are special — they attract others
    isBlackhole: tier >= 6,
  });
}

function spawnSlimeAtTap(x, y) {
  createSlime(x, y);
  geneScore += 1;
  playPlop();
  spawnMilestoneCheck();
}

function spawnMilestoneCheck() {
  const n = slimes.length;
  for (const m of MILESTONES) {
    if (n >= m && !milestones.has(m)) {
      milestones.add(m);
      showMilestone(`${m} SLIMES!`);
      // Bonus rare slime
      createSlime(W/2 + (Math.random()-0.5)*200, H/2, { tier: Math.min(4, Math.floor(m / 25)) });
    }
  }
}

function showMilestone(text) {
  const el = document.getElementById('milestone');
  el.textContent = text;
  el.classList.remove('hidden');
  // Re-trigger animation by resetting
  el.style.animation = 'none';
  el.offsetHeight;
  el.style.animation = '';
  setTimeout(() => el.classList.add('hidden'), 1400);
}

// ===== AUDIO =====
let audioCtx = null, masterGain = null, muted = false;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
}
function playPlop() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(400 + Math.random() * 400, t);
  o.frequency.exponentialRampToValueAtTime(100, t + 0.15);
  g.gain.setValueAtTime(0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
  o.connect(g); g.connect(masterGain);
  o.start(t); o.stop(t + 0.22);
}
function playBreed() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  // Two tones rising together = "OOZE"
  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o1.type = 'triangle'; o2.type = 'triangle';
  o1.frequency.setValueAtTime(300, t);
  o1.frequency.linearRampToValueAtTime(600, t + 0.25);
  o2.frequency.setValueAtTime(500, t);
  o2.frequency.linearRampToValueAtTime(900, t + 0.25);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.2, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  o1.connect(g); o2.connect(g); g.connect(masterGain);
  o1.start(t); o2.start(t); o1.stop(t + 0.3); o2.stop(t + 0.3);
}
function playPop() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const len = audioCtx.sampleRate * 0.2;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  src.connect(g); g.connect(masterGain);
  src.start(t);
}

// ===== UPDATE =====
function update(dt) {
  if (state !== 'PLAYING') return;

  // Global gravity + viscosity
  for (const s of slimes) {
    s.vy += 300 * dt;        // gravity
    s.vx *= Math.pow(0.98, dt * 60);
    s.vy *= Math.pow(0.98, dt * 60);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.wobblePhase += s.wobbleSpeed * dt;
    s.life += dt;
    s.breedCooldown -= dt;

    // Wall bounce (squishy)
    const r = s.radius;
    if (s.x < r) { s.x = r; s.vx = Math.abs(s.vx) * 0.7; }
    if (s.x > W - r) { s.x = W - r; s.vx = -Math.abs(s.vx) * 0.7; }
    // Floor squish bounce
    if (s.y > H - r) {
      s.y = H - r;
      if (Math.abs(s.vy) < 50) s.vy = 0;
      else s.vy = -Math.abs(s.vy) * 0.5;
    }
    if (s.y < r) { s.y = r; s.vy = Math.abs(s.vy) * 0.5; }
  }

  // Pair interactions
  for (let i = 0; i < slimes.length; i++) {
    for (let j = i + 1; j < slimes.length; j++) {
      const a = slimes[i], b = slimes[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const minD = a.radius + b.radius;

      // Black hole pulls everything
      if (a.isBlackhole || b.isBlackhole) {
        const d = Math.sqrt(d2) || 1;
        const pull = a.isBlackhole ? 4000 / (d * d) : 4000 / (d * d);
        const nx = dx / d, ny = dy / d;
        if (a.isBlackhole) { a.vx -= nx * pull; a.vy -= ny * pull; }
        if (b.isBlackhole) { b.vx += nx * pull; b.vy += ny * pull; }
      }

      if (d2 < minD * minD && d2 > 0) {
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d;
        const overlap = (minD - d) * 0.5;
        a.x -= nx * overlap * 0.5; a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5; b.y += ny * overlap * 0.5;

        // Elastic bounce
        const relVx = a.vx - b.vx, relVy = a.vy - b.vy;
        const dot = relVx * nx + relVy * ny;
        if (dot > 0) {
          const j = dot * 0.6;
          a.vx -= j * nx; a.vy -= j * ny;
          b.vx += j * nx; b.vy += j * ny;
        }

        // Crossbreed! If both ready and close
        if (a.breedCooldown <= 0 && b.breedCooldown <= 0) {
          const childTier = crossbreed(a.tier, b.tier);
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2;
          createSlime(cx, cy, {
            tier: childTier,
            hue: randomHueForTier(childTier),
            vx: (Math.random() - 0.5) * 100,
            vy: -80 - Math.random() * 60,
          });
          geneScore += TIERS[childTier].score;
          a.breedCooldown = 3 + Math.random() * 4;
          b.breedCooldown = 3 + Math.random() * 4;
          playBreed();
          // Spawn sparkle particles
          for (let p = 0; p < 12; p++) {
            particles.push({
              x: cx, y: cy,
              vx: (Math.random() - 0.5) * 300,
              vy: (Math.random() - 0.5) * 300,
              life: 0.6, maxLife: 0.6,
              hue: [a.hue, b.hue][Math.floor(Math.random() * 2)],
              size: 2 + Math.random() * 4,
              tier: childTier,
            });
          }
          spawnMilestoneCheck();
        }
      }
    }
  }

  // Random spontaneous oozing (slimes breed by themselves occasionally)
  if (Math.random() < 0.01 && slimes.length > 5 && slimes.length < MAX_SLIMES) {
    const s = slimes[Math.floor(Math.random() * slimes.length)];
    s.breedCooldown = 0;
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Auto-cull oldest slime when MAX reached (prevents freeze)
  if (slimes.length > MAX_SLIMES - 10) {
    slimes.sort((a, b) => a.life - b.life);
    slimes.length = MAX_SLIMES - 20;
  }

  // HUD
  const el = document.getElementById('slime-count');
  if (el) el.textContent = slimes.length;
  const gl = document.getElementById('gene-count');
  if (gl) gl.textContent = geneScore;
}

// ===== RENDER =====
function render(t) {
  // Background — soft vignette
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, W, H);

  // Sort slimes by tier (higher tier drawn last = glow on top)
  slimes.sort((a, b) => a.tier - b.tier);

  for (const s of slimes) drawSlime(s, t);
  for (const p of particles) drawParticle(p);

  // ===== KALEIDO =====
  if (FILTERS[filterIdx] === 'KALEIDO') {
    const N = 6;
    const maxR = Math.max(W, H);
    const temp = document.createElement('canvas');
    temp.width = canvas.width; temp.height = canvas.height;
    const tctx = temp.getContext('2d');
    tctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);
    const sa = (Math.PI * 2) / N;
    for (let i = 0; i < N; i++) {
      ctx.save();
      ctx.translate(W / 2, H / 2);
      ctx.rotate(i * sa + filterAnimPhase * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, -sa / 2, sa / 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(temp, -W / 2, -H / 2);
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawSlime(s, t) {
  ctx.save();
  ctx.translate(s.x, s.y);
  // Wobble deformation
  const wobbleX = 1 + Math.sin(s.wobblePhase) * 0.08;
  const wobbleY = 1 + Math.cos(s.wobblePhase * 1.3) * 0.08;
  ctx.scale(wobbleX, wobbleY);

  const r = s.radius;

  // Tier-specific glow
  const hue = s.hue;
  const tierLevel = s.tier;
  const glowIntensity = 10 + tierLevel * 15;
  const saturation = 70 + tierLevel * 5;

  ctx.shadowColor = `hsl(${hue}, ${saturation}%, 55%)`;
  ctx.shadowBlur = glowIntensity;

  // Body — 8-segment wobbly blob
  ctx.fillStyle = `hsl(${hue}, ${saturation}%, 55%)`;
  ctx.strokeStyle = `hsl(${hue}, ${saturation}%, 30%)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  const segs = 16;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const rw = r + Math.sin(a * 3 + s.wobblePhase) * r * 0.08;
    const px = Math.cos(a) * rw;
    const py = Math.sin(a) * rw * 1.2;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rainbow slime — rainbow stripes
  if (TIERS[s.tier].id === 'rainbow') {
    ctx.save();
    ctx.beginPath();
    const segs2 = 16;
    for (let i = 0; i <= segs2; i++) {
      const a = (i / segs2) * Math.PI * 2;
      const rw = r + Math.sin(a * 3 + s.wobblePhase) * r * 0.08;
      const px = Math.cos(a) * rw;
      const py = Math.sin(a) * rw * 1.2;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.clip();
    const hueShift = (t / 20 + s.wobblePhase * 2) % 360;
    for (let h = 0; h < 6; h++) {
      ctx.fillStyle = `hsl(${(h * 60 + hueShift) % 360}, 80%, 50%)`;
      ctx.fillRect(-r, -r + h * (r / 3), r * 2, r / 3);
    }
    ctx.restore();
  }

  // Black hole — dark vortex
  if (TIERS[s.tier].id === 'blackhole') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.shadowBlur = 40;
    ctx.fill();
    // Accretion ring
    ctx.strokeStyle = `hsl(${(t / 50) % 360}, 100%, 60%)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.4, (t / 500) % Math.PI, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // Gold sparkle
  if (TIERS[s.tier].id === 'gold') {
    ctx.fillStyle = 'rgba(255,255,200,0.8)';
    for (let sp = 0; sp < 4; sp++) {
      const a = s.wobblePhase * 2 + sp * Math.PI / 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.3, -r * 0.4, r * 0.25, r * 0.15, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // Cute face
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.08, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(r * 0.22, -r * 0.08, r * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Tiny smile
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, r * 0.18, r * 0.15, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

function drawParticle(p) {
  const a = p.life / p.maxLife;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = `hsl(${p.hue}, 100%, 60%)`;
  ctx.shadowBlur = 10;
  ctx.fillStyle = `hsl(${p.hue}, 100%, 70%)`;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ===== MAIN LOOP =====
let lastTime = 0, state = 'START';
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  update(dt);
  render(t);
  stepFilter(dt);
}
requestAnimationFrame(t => { lastTime = t; loop(t); });

// ===== INPUT =====
canvas.addEventListener('pointerdown', e => {
  if (state !== 'PLAYING') return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  // Spawn 1-3 slimes
  const n = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < n; i++) {
    const jx = x + (Math.random() - 0.5) * 60;
    const jy = y + (Math.random() - 0.5) * 60;
    spawnSlimeAtTap(jx, jy);
  }
});

// ===== POP ALL =====
document.getElementById('pop-btn').addEventListener('click', () => {
  if (state !== 'PLAYING') return;
  // Catastrophe! — every slime gets an explosion
  playPop();
  for (const s of slimes) {
    for (let p = 0; p < 8; p++) {
      particles.push({
        x: s.x, y: s.y,
        vx: (Math.random() - 0.5) * 400,
        vy: (Math.random() - 0.5) * 400 - 100,
        life: 0.8, maxLife: 0.8,
        hue: s.hue, size: 3 + Math.random() * 5,
        tier: s.tier,
      });
    }
  }
  slimes.length = 0;
  document.getElementById('slime-count').textContent = 0;
});

// ===== FILTERS =====
const FILTERS = ['OFF', 'LSD', 'INVERT', 'GLOW', 'KALEIDO'];
let filterIdx = 0, filterAnimPhase = 0;
const FILTER_LABELS = { OFF: '🌀', LSD: '🌈', INVERT: '🔮', GLOW: '✨', KALEIDO: '🌸' };
function applyCSSFilter() {
  const el = document.getElementById('game-canvas');
  const f = FILTERS[filterIdx];
  if (f === 'OFF' || f === 'KALEIDO') el.style.filter = 'none';
  else if (f === 'LSD') el.style.filter = `hue-rotate(${(filterAnimPhase * 80) % 360}deg) saturate(3) contrast(1.2)`;
  else if (f === 'INVERT') el.style.filter = 'invert(1) hue-rotate(180deg) saturate(2)';
  else if (f === 'GLOW') el.style.filter = 'brightness(1.5) contrast(1.6) saturate(3) blur(0.5px)';
}
function stepFilter(dt) { filterAnimPhase += dt * 4; applyCSSFilter(); }
document.getElementById('filter-btn').addEventListener('click', () => {
  filterIdx = (filterIdx + 1) % FILTERS.length;
  const f = FILTERS[filterIdx];
  const btn = document.getElementById('filter-btn');
  btn.textContent = FILTER_LABELS[f];
  btn.title = `Filter: ${f}`;
  filterAnimPhase = 0;
  applyCSSFilter();
});

// ===== MUTE =====
document.getElementById('mute-btn').addEventListener('click', () => {
  muted = !muted;
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (masterGain) masterGain.gain.value = muted ? 0 : 0.5;
});

// ===== START =====
let best = parseInt(localStorage.getItem('slime-best') || '0');
document.getElementById('best-on-start').textContent = `ALL-TIME BEST: ${best} slimes`;
document.getElementById('start-btn').addEventListener('click', () => {
  initAudio();
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  state = 'PLAYING';
  slimes.length = 0;
  particles.length = 0;
  geneScore = 0;
  milestones.clear();
  for (let i = 0; i < 4; i++) spawnSlimeAtTap(W / 2 + (Math.random() - 0.5) * 100, H * 0.4 + Math.random() * 50);
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
});
