// ===== RANDOM MUSEUM — Generative Art Gallery =====
// 8 algorithmic styles. Pure canvas. Every tap = unique masterpiece.

const canvas = document.getElementById('art-canvas');
const fxCanvas = document.getElementById('fx-canvas');
const ctx = canvas.getContext('2d');
const fxCtx = fxCanvas.getContext('2d');

let W, H, DPR;
function resize() {
  DPR = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  for (const c of [canvas, fxCanvas]) {
    c.width = W * DPR; c.height = H * DPR;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
  }
}
window.addEventListener('resize', () => { resize(); });
resize();

// ===== COLOR PALETTES =====
const PALETTES = [
  // Monet garden
  ['#ff6b9d','#feca57','#48dbfb','#1dd1a1','#5f27cd'],
  // Sunset
  ['#ff6b6b','#ffa502','#ff6348','#ee5a24','#ff9ff3'],
  // Ocean
  ['#0abde3','#54a0ff','#5f27cd','#00d2d3','#c56cf0'],
  // Forest
  ['#27ae60','#2ecc71','#f1c40f','#e67e22','#1abc9c'],
  // Noir
  ['#2c3e50','#34495e','#7f8c8d','#ecf0f1','#1abc9c'],
  // Pastel
  ['#ffeaa7','#fab1a0','#74b9ff','#a29bfe','#fd79a8'],
  // Cyberpunk
  ['#ff2d95','#00e5ff','#a28bff','#ffd93d','#ff4d00'],
  // Earth
  ['#c0392b','#8e44ad','#d35400','#2c3e50','#f39c12'],
];

function hexToRgb(hex) {
  const h = hex.replace('#','');
  return {
    r: parseInt(h.slice(0,2),16),
    g: parseInt(h.slice(2,4),16),
    b: parseInt(h.slice(4,6),16),
  };
}
function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');
}
function mix(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return rgbToHex(a.r + (b.r-a.r)*t, a.g + (b.g-a.g)*t, a.b + (b.b-a.b)*t);
}

// ===== SIMPLE PERLIN NOISE =====
const NOISE_TABLE = new Float32Array(256);
for (let i = 0; i < 256; i++) NOISE_TABLE[i] = Math.random() * Math.PI * 2;
function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const a = NOISE_TABLE[(ix + iy * 7) & 255];
  const b = NOISE_TABLE[(ix + 1 + iy * 7) & 255];
  const c = NOISE_TABLE[(ix + (iy + 1) * 7) & 255];
  const d = NOISE_TABLE[(ix + 1 + (iy + 1) * 7) & 255];
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  return ((Math.cos(a) * (1 - ux) + Math.cos(b) * ux) * (1 - uy) +
          (Math.cos(c) * (1 - ux) + Math.cos(d) * ux) * uy) * 0.5;
}

// ===== STYLE DEFINITIONS =====
const STYLES = [
  { id:'flow',      name:'Flow Field',     emoji:'🌊' },
  { id:'voronoi',   name:'Cells',          emoji:'🧬' },
  { id:'cosmic',    name:'Cosmic Cloud',   emoji:'🌌' },
  { id:'fractal',   name:'Fractal',        emoji:'🌳' },
  { id:'tunnel',    name:'Tunnel',         emoji:'🌀' },
  { id:'particles', name:'Star Web',       emoji:'✨' },
  { id:'circles',   name:'Circles',        emoji:'⭕' },
  { id:'drip',      name:'Pixel Drip',     emoji:'💧' },
];

// ===== TITLE GENERATOR =====
const ADJECTIVES = ['Melancholic','Ephemeral','Chaotic','Serene','Vibrant','Haunting','Ecstatic','Minimal','Baroque','Organic','Translucent','Prismatic','Tactile','Ethereal','Primordial','Futuristic','Nostalgic','Reverent'];
const NOUNS = ['Silence','Chaos','Dawn','Memory','Lust','Horizon','Echo','Gravity','Solitude','Eternity','Whisper','Collision','Vertigo','Innocence','Rebellion','Embrace','Oblivion','Resonance'];
const ARTIST_WORDS = ['study','composition','fragment','meditation','excerpt','vignette','impression','no.','sketch','variation','opus','plate'];

function randomTitle() {
  const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const b = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const c = ARTIST_WORDS[Math.floor(Math.random() * ARTIST_WORDS.length)];
  const lower = Math.random() < 0.3;
  let t = `${a} ${b}`;
  if (lower) t = t.toLowerCase();
  const suffix = Math.random();
  if (suffix < 0.4) t += ` — a ${c}`;
  else if (suffix < 0.7) t += `, ${c}`;
  return t;
}

// ===== ART GENERATION ENGINE =====
let currentStyleIdx = 0;
let history = []; // stack of { style, palette, seed, title }
let future = [];
let artNumber = Math.floor(Math.random() * 9999);

function randomConfig() {
  return {
    style: currentStyleIdx,
    palette: PALETTES[Math.floor(Math.random() * PALETTES.length)],
    seed: Math.random() * 1000,
    title: randomTitle(),
  };
}

function generateNext() {
  if (history.length) future.push(history[history.length - 1]);
  const cfg = randomConfig();
  history.push(cfg);
  artNumber = (artNumber + 1) % 10000;
  renderWithTransition(cfg);
}

function renderPrev() {
  if (history.length <= 1) return;
  future.push(history.pop());
  const cfg = history[history.length - 1];
  artNumber = (artNumber + 9999) % 10000;
  renderWithTransition(cfg);
}

function renderNext() {
  if (!future.length) return;
  history.push(future.pop());
  const cfg = history[history.length - 1];
  artNumber = (artNumber + 1) % 10000;
  renderWithTransition(cfg);
}

function renderWithTransition(cfg) {
  updateTitle(cfg.title);
  canvas.parentElement.classList.add('fade-out');
  setTimeout(() => {
    draw(cfg);
    canvas.parentElement.classList.remove('fade-out');
  }, 250);
}

function updateTitle(title) {
  const el = document.getElementById('art-title');
  const num = document.getElementById('art-number');
  el.textContent = title;
  num.textContent = String(artNumber).padStart(4, '0');
  // Re-trigger fade animation
  const overlay = document.getElementById('title-overlay');
  overlay.classList.add('fading');
  setTimeout(() => {
    overlay.classList.remove('fading');
    overlay.style.animation = 'none';
    overlay.offsetHeight;
    overlay.style.animation = '';
  }, 200);
}

// ===== 8 DRAWING FUNCTIONS =====
function draw(cfg) {
  const style = STYLES[cfg.style];
  const palette = cfg.palette;
  const seed = cfg.seed;
  ctx.fillStyle = '#0f0f12';
  ctx.fillRect(0, 0, W, H);

  // Create deterministic PRNG from seed
  let s = seed;
  function rng() { s = (s * 9301 + 49297) % 233280; return s / 233280; }

  // Switch on style
  switch (style.id) {
    case 'flow':      drawFlowField(palette, rng); break;
    case 'voronoi':   drawVoronoi(palette, rng); break;
    case 'cosmic':    drawCosmicCloud(palette, rng); break;
    case 'fractal':   drawFractal(palette, rng); break;
    case 'tunnel':    drawTunnel(palette, rng); break;
    case 'particles': drawParticleWeb(palette, rng); break;
    case 'circles':   drawCirclePacking(palette, rng); break;
    case 'drip':      drawPixelDrip(palette, rng); break;
  }
}

function drawFlowField(palette, rng) {
  // Many particles flow through noise field
  ctx.fillStyle = '#121218';
  ctx.fillRect(0, 0, W, H);
  const particles = 1200;
  const scale = 0.003 + rng() * 0.003;
  const noiseOff = rng() * 1000;
  ctx.lineWidth = 1.2;
  for (let i = 0; i < particles; i++) {
    let x = rng() * W, y = rng() * H;
    const len = 30 + rng() * 60;
    const color = palette[Math.floor(rng() * palette.length)];
    ctx.strokeStyle = color + '40';
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < len; s++) {
      const a = noise2D(x * scale + noiseOff, y * scale + noiseOff * 0.7) * Math.PI * 4;
      x += Math.cos(a) * 2;
      y += Math.sin(a) * 2;
      if (x < 0 || x > W || y < 0 || y > H) break;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Center glow
  const grd = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, Math.max(W,H)*0.6);
  grd.addColorStop(0, palette[0] + '20');
  grd.addColorStop(1, '#0f0f12');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

function drawVoronoi(palette, rng) {
  const pts = [];
  const n = 20 + Math.floor(rng() * 25);
  for (let i = 0; i < n; i++) {
    pts.push({ x: rng() * W, y: rng() * H, color: palette[Math.floor(rng() * palette.length)] });
  }
  // Pointillist rendering — each pixel colored by nearest point
  // Too slow for full res; instead use pixel grid of 8px cells
  const cell = Math.max(4, Math.min(10, Math.floor(Math.min(W,H)/60)));
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      let minD = Infinity, nearest = null;
      for (const p of pts) {
        const dx = p.x - x, dy = p.y - y;
        const d = dx*dx + dy*dy;
        if (d < minD) { minD = d; nearest = p; }
      }
      ctx.fillStyle = nearest.color;
      ctx.fillRect(x, y, cell, cell);
    }
  }
  // Overlay: draw cell boundaries by looking at neighbors
  ctx.strokeStyle = '#ffffff30';
  ctx.lineWidth = 1;
  for (let y = 0; y < H; y += cell) {
    for (let x = 0; x < W; x += cell) {
      const n1 = nearestOf(pts, x, y);
      const n2 = nearestOf(pts, x + cell, y);
      const n3 = nearestOf(pts, x, y + cell);
      if (n1 !== n2 || n1 !== n3) {
        ctx.strokeRect(x, y, cell, cell);
      }
    }
  }
}
function nearestOf(pts, x, y) {
  let minD = Infinity, r = null;
  for (const p of pts) {
    const dx = p.x - x, dy = p.y - y;
    const d = dx*dx + dy*dy;
    if (d < minD) { minD = d; r = p; }
  }
  return r;
}

function drawCosmicCloud(palette, rng) {
  ctx.fillStyle = '#05050a';
  ctx.fillRect(0, 0, W, H);
  // Big soft circles layered
  const circles = 800 + Math.floor(rng() * 400);
  for (let i = 0; i < circles; i++) {
    const x = rng() * W;
    const y = rng() * H;
    const r = 50 + rng() * 300;
    const c = palette[Math.floor(rng() * palette.length)];
    const alpha = 0.02 + rng() * 0.06;
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, c + Math.floor(alpha * 255).toString(16).padStart(2,'0'));
    grd.addColorStop(1, c + '00');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);
  }
  // Stars
  for (let i = 0; i < 300; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + rng() * 0.7) + ')';
    ctx.beginPath();
    ctx.arc(rng() * W, rng() * H, rng() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFractal(palette, rng) {
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = 'round';
  function branch(x1, y1, angle, depth, maxDepth, thick) {
    if (depth > maxDepth) {
      // Draw leaf
      ctx.fillStyle = palette[Math.floor(rng() * palette.length)];
      ctx.beginPath();
      ctx.arc(x1, y1, 2 + rng() * 3, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const len = (H * 0.3) * Math.pow(0.7, depth);
    const x2 = x1 + Math.cos(angle - Math.PI / 2) * len;
    const y2 = y1 + Math.sin(angle - Math.PI / 2) * len;
    ctx.lineWidth = thick;
    ctx.strokeStyle = palette[depth % palette.length] + 'cc';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const spread = 0.4 + rng() * 0.3;
    branch(x2, y2, angle - spread, depth + 1, maxDepth, thick * 0.7);
    branch(x2, y2, angle + spread, depth + 1, maxDepth, thick * 0.7);
    if (rng() < 0.3) branch(x2, y2, angle, depth + 1, maxDepth, thick * 0.7);
  }
  const maxDepth = 7 + Math.floor(rng() * 3);
  branch(W/2, H * 0.9, 0, 0, maxDepth, 12);
}

function drawTunnel(palette, rng) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const CX = W/2, CY = H/2;
  const layers = 60;
  const maxR = Math.max(W, H);
  const rot = rng() * Math.PI * 2;
  for (let i = layers; i >= 0; i--) {
    const t = i / layers;
    const r = maxR * t;
    const c = palette[i % palette.length];
    const alpha = Math.pow(t, 2);
    ctx.strokeStyle = c;
    ctx.globalAlpha = alpha * 0.9;
    ctx.lineWidth = 1 + (1 - t) * 3;
    ctx.beginPath();
    const sides = 6 + Math.floor(rng() * 0); // keep hex
    const offset = rot * (1 - t) + i * 0.05;
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2 + offset;
      const x = CX + Math.cos(a) * r;
      const y = CY + Math.sin(a) * r;
      if (j === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Center glow
  const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, maxR * 0.4);
  grd.addColorStop(0, '#ffffffcc');
  grd.addColorStop(1, '#ffffff00');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

function drawParticleWeb(palette, rng) {
  ctx.fillStyle = '#0d0d14';
  ctx.fillRect(0, 0, W, H);
  const particles = 150;
  const pts = [];
  for (let i = 0; i < particles; i++) {
    pts.push({ x: rng() * W, y: rng() * H, c: palette[Math.floor(rng() * palette.length)] });
  }
  // Lines between close particles
  const maxD = Math.min(W, H) * 0.18;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      const dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < maxD) {
        const a = 1 - d / maxD;
        ctx.strokeStyle = pts[i].c;
        ctx.globalAlpha = a * 0.5;
        ctx.lineWidth = a * 1.5;
        ctx.beginPath();
        ctx.moveTo(pts[i].x, pts[i].y);
        ctx.lineTo(pts[j].x, pts[j].y);
        ctx.stroke();
      }
    }
  }
  ctx.globalAlpha = 1;
  // Dots
  for (const p of pts) {
    ctx.fillStyle = p.c;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + rng() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCirclePacking(palette, rng) {
  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, W, H);
  const placed = [];
  const maxAttempts = 5000;
  for (let a = 0; a < maxAttempts; a++) {
    const r = 8 + rng() * (Math.min(W,H) * 0.25);
    const x = r + rng() * (W - 2 * r);
    const y = r + rng() * (H - 2 * r);
    let ok = true;
    for (const p of placed) {
      const dx = p.x - x, dy = p.y - y;
      const minD = p.r + r + 1;
      if (dx*dx + dy*dy < minD*minD) { ok = false; break; }
    }
    if (ok) {
      placed.push({ x, y, r, c: palette[Math.floor(rng() * palette.length)] });
      const hueShift = rng();
      const fill = mix(palette[0], palette[Math.floor(rng()*palette.length)], hueShift);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      // Gradient fill
      const grd = ctx.createRadialGradient(x - r*0.3, y - r*0.3, 0, x, y, r);
      grd.addColorStop(0, '#ffffff40');
      grd.addColorStop(0.3, fill);
      grd.addColorStop(1, palette[Math.floor(rng()*palette.length)]);
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.strokeStyle = '#ffffff20';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    if (placed.length > 800) break;
  }
}

function drawPixelDrip(palette, rng) {
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(0, 0, W, H);
  // Pixel grid that drips downward
  const px = 6;
  const cols = Math.floor(W / px);
  const rows = Math.floor(H / px);
  const grid = [];
  // Seed random cells
  for (let c = 0; c < cols; c++) {
    grid[c] = [];
    for (let r = 0; r < rows; r++) {
      grid[c][r] = null;
    }
  }
  // Rainfall
  const drops = Math.floor(cols * 0.3);
  for (let d = 0; d < drops; d++) {
    const c = Math.floor(rng() * cols);
    const r = 0;
    grid[c][r] = palette[Math.floor(rng() * palette.length)];
  }
  // Let them drip — simulate by painting grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[c][r]) {
        // Paint this pixel
        ctx.fillStyle = grid[c][r];
        ctx.fillRect(c * px, r * px, px, px);
        // Drip down
        if (r + 1 < rows && rng() < 0.97) {
          grid[c][r+1] = grid[c][r];
          grid[c][r] = null;
        } else {
          // Drip diagonally or stop
          const dir = rng();
          if (dir < 0.4 && c > 0 && r + 1 < rows) grid[c-1][r+1] = grid[c][r];
          else if (dir < 0.8 && c < cols-1 && r + 1 < rows) grid[c+1][r+1] = grid[c][r];
        }
      }
    }
  }
  // Add more seed layers deeper
  for (let layer = 1; layer < 8; layer++) {
    for (let d = 0; d < drops / 8; d++) {
      const c = Math.floor(rng() * cols);
      const r = Math.floor(rng() * rows * 0.7);
      grid[c][r] = palette[Math.floor(rng() * palette.length)];
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[c][r] && rng() < 0.7) {
          ctx.fillStyle = grid[c][r];
          ctx.fillRect(c * px, r * px, px, px);
          if (r + 1 < rows && rng() < 0.95) grid[c][r+1] = grid[c][r];
        }
      }
    }
  }
  // Noise overlay
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = 'rgba(255,255,255,' + (0.02 + rng()*0.04) + ')';
    ctx.fillRect(rng() * W, rng() * H, 2, 2);
  }
}

// ===== UI: STYLE BAR =====
const styleBar = document.getElementById('style-bar');
STYLES.forEach((s, i) => {
  const chip = document.createElement('div');
  chip.className = 'style-chip' + (i === currentStyleIdx ? ' active' : '');
  chip.textContent = s.emoji + ' ' + s.name;
  chip.addEventListener('click', () => {
    currentStyleIdx = i;
    styleBar.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    generateNext();
  });
  styleBar.appendChild(chip);
});

// ===== TOOLBAR =====
document.getElementById('regen-btn').addEventListener('click', () => {
  generateNext();
});
document.getElementById('prev-btn').addEventListener('click', () => renderPrev());
document.getElementById('next-btn').addEventListener('click', () => renderNext());

// ===== SAVE =====
document.getElementById('save-btn').addEventListener('click', () => {
  // Hide toolbar, render clean shot, save
  const tb = document.getElementById('toolbar');
  const sb = document.getElementById('style-bar');
  const ov = document.getElementById('title-overlay');
  tb.classList.add('hidden-bar');
  sb.classList.add('hidden-bar');
  ov.classList.add('hidden');
  setTimeout(() => {
    const link = document.createElement('a');
    link.download = `random-museum-${String(artNumber).padStart(4,'0')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    // Show toast
    showToast('Saved! 💾');
    setTimeout(() => {
      tb.classList.remove('hidden-bar');
      sb.classList.remove('hidden-bar');
      ov.classList.remove('hidden');
    }, 300);
  }, 350);
});

function showToast(msg) {
  // Remove existing
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ===== AUTO GALLERY (long press or button) =====
let autoMode = false;
let autoTimer = null;
function toggleAuto() {
  autoMode = !autoMode;
  const btn = document.getElementById('gallery-btn');
  btn.classList.toggle('active', autoMode);
  if (autoMode) {
    autoTimer = setInterval(generateNext, 3000);
    showToast('🖼️ Auto gallery...');
  } else {
    clearInterval(autoTimer);
    autoTimer = null;
  }
}
document.getElementById('gallery-btn').addEventListener('click', toggleAuto);

// Long-press detection
let pressTimer = null;
let startedAt = 0;
canvas.addEventListener('pointerdown', e => {
  startedAt = Date.now();
  pressTimer = setTimeout(() => {
    if (Date.now() - startedAt >= 500) {
      // Long press = next art
      generateNext();
    }
  }, 500);
});
canvas.addEventListener('pointerup', e => {
  clearTimeout(pressTimer);
  if (Date.now() - startedAt < 250) {
    // Quick tap = next art
    generateNext();
  }
});
canvas.addEventListener('pointerleave', () => clearTimeout(pressTimer));

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight' || e.key === ' ') generateNext();
  else if (e.key === 'ArrowLeft') renderPrev();
  else if (e.key === 's' || e.key === 'S') document.getElementById('save-btn').click();
  else if (e.key === 'a' || e.key === 'A') toggleAuto();
  else if (e.key >= '1' && e.key <= '8') {
    currentStyleIdx = parseInt(e.key) - 1;
    styleBar.querySelectorAll('.style-chip').forEach((c,i) => c.classList.toggle('active', i === currentStyleIdx));
    generateNext();
  }
});

// ===== START =====
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-overlay').classList.add('hidden');
  history = [];
  future = [];
  generateNext();
});
