// ===== MUSEUM STUDIO — Magic Brush =====
// 8 algorithmic brushes that follow YOUR finger.

const canvas = document.getElementById('art-canvas');
const ctx = canvas.getContext('2d');
let W, H, DPR;
function resize() {
  DPR = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', () => { resize(); });
resize();

// ===== PALETTES =====
const PALETTES = [
  { name:'Muse',    colors:['#ff6b9d','#feca57','#48dbfb','#1dd1a1','#5f27cd'] },
  { name:'Sunset',  colors:['#ff6b6b','#ffa502','#ff6348','#ee5a24','#ff9ff3'] },
  { name:'Ocean',   colors:['#0abde3','#54a0ff','#5f27cd','#00d2d3','#c56cf0'] },
  { name:'Forest',  colors:['#27ae60','#2ecc71','#f1c40f','#e67e22','#1abc9c'] },
  { name:'Noir',    colors:['#2c3e50','#34495e','#7f8c8d','#ecf0f1','#1abc9c'] },
  { name:'Pastel',  colors:['#ffeaa7','#fab1a0','#74b9ff','#a29bfe','#fd79a8'] },
  { name:'Cyber',   colors:['#ff2d95','#00e5ff','#a28bff','#ffd93d','#ff4d00'] },
  { name:'Earth',   colors:['#c0392b','#8e44ad','#d35400','#2c3e50','#f39c12'] },
];
let paletteIdx = 0;

// ===== BRUSHES =====
const BRUSHES = [
  { id:'flow',    name:'Flow',     emoji:'🌊' },
  { id:'nebula',  name:'Nebula',   emoji:'🌌' },
  { id:'branch',  name:'Branch',   emoji:'🌳' },
  { id:'spiral',  name:'Spiral',   emoji:'🌀' },
  { id:'web',     name:'Web',      emoji:'✨' },
  { id:'bubble',  name:'Bubble',   emoji:'⭕' },
  { id:'drip',    name:'Drip',     emoji:'💧' },
  { id:'calligraphy', name:'Ink',  emoji:'🖋️' },
];
let brushIdx = 0;
let size = 30;

// ===== UNDO STACK =====
let history = [];
const MAX_HISTORY = 30;
function snapshot() {
  if (history.length >= MAX_HISTORY) history.shift();
  try { history.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); } catch(e) {}
}
function undo() {
  if (!history.length) return;
  const img = history.pop();
  ctx.putImageData(img, 0, 0);
}

// ===== BUILD UI =====
const brushList = document.getElementById('brush-list');
BRUSHES.forEach((b, i) => {
  const btn = document.createElement('div');
  btn.className = 'brush-btn' + (i === 0 ? ' active' : '');
  btn.textContent = b.emoji;
  btn.title = b.name;
  btn.addEventListener('click', () => {
    brushIdx = i;
    brushList.querySelectorAll('.brush-btn').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  });
  brushList.appendChild(btn);
});

const colorList = document.getElementById('color-list');
PALETTES.forEach((p, i) => {
  const btn = document.createElement('div');
  btn.className = 'palette-btn' + (i === 0 ? ' active' : '');
  btn.title = p.name;
  btn.style.background = `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[2]}, ${p.colors[4]})`;
  btn.addEventListener('click', () => {
    paletteIdx = i;
    colorList.querySelectorAll('.palette-btn').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  });
  colorList.appendChild(btn);
});

const sizeSlider = document.getElementById('size-slider');
sizeSlider.addEventListener('input', () => size = parseInt(sizeSlider.value));

// ===== DRAWING STATE =====
let drawing = false;
let lastX = 0, lastY = 0;
let distSinceSample = 0;
let branchSeed = 0;

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  snapshot();
  drawing = true;
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
  distSinceSample = 0;
  branchSeed = Math.random() * 1000;
  brushDot(lastX, lastY, 0, 0);
});

canvas.addEventListener('pointermove', e => {
  if (!drawing) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = x - lastX, dy = y - lastY;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const speed = dist; // speed of movement
  brushStroke(lastX, lastY, x, y, dx, dy, speed);
  lastX = x; lastY = y;
  distSinceSample += dist;
});

canvas.addEventListener('pointerup', e => {
  drawing = false;
});
canvas.addEventListener('pointerleave', () => drawing = false);

// ===== BRUSH STROKE ENGINE =====
function brushStroke(x1, y1, x2, y2, dx, dy, speed) {
  const brush = BRUSHES[brushIdx];
  const pal = PALETTES[paletteIdx].colors;
  const step = Math.max(1, size * 0.15);
  const segs = Math.max(1, Math.floor(Math.sqrt(dx*dx + dy*dy) / step));
  for (let s = 0; s < segs; s++) {
    const t = s / segs;
    const px = x1 + dx * t;
    const py = y1 + dy * t;
    brushDot(px, py, dx, dy, speed);
  }
}

function rand() { return Math.random(); }
function pickColor(i) {
  return PALETTES[paletteIdx].colors[i % PALETTES[paletteIdx].colors.length];
}

function brushDot(x, y, dx, dy, speed) {
  const brush = BRUSHES[brushIdx];
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (brush.id) {
    case 'flow':      drawFlow(x, y); break;
    case 'nebula':    drawNebula(x, y); break;
    case 'branch':    drawBranch(x, y, dx, dy); break;
    case 'spiral':    drawSpiral(x, y, dx, dy); break;
    case 'web':       drawWeb(x, y); break;
    case 'bubble':    drawBubble(x, y); break;
    case 'drip':      drawDrip(x, y); break;
    case 'calligraphy': drawCalligraphy(x, y, dx, dy, speed); break;
  }
  ctx.restore();
}

// 🌊 Flow field stroke
function drawFlow(x, y) {
  const c = pickColor(Math.floor(rand() * 5));
  const scale = 0.012;
  const steps = 8 + Math.floor(size / 4);
  ctx.strokeStyle = c;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = size * 0.18;
  ctx.shadowColor = c;
  ctx.shadowBlur = size * 0.3;
  for (let k = 0; k < 4; k++) {
    let px = x + (rand() - 0.5) * size;
    let py = y + (rand() - 0.5) * size;
    ctx.beginPath();
    ctx.moveTo(px, py);
    for (let s = 0; s < steps; s++) {
      const a = ((Math.sin(px * scale) + Math.cos(py * scale)) * Math.PI * 2);
      px += Math.cos(a) * size * 0.08;
      py += Math.sin(a) * size * 0.08;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
}

// 🌌 Nebula — soft layered circles
function drawNebula(x, y) {
  const c = pickColor(Math.floor(rand() * 5));
  const layers = 3;
  for (let l = 0; l < layers; l++) {
    const r = size * (0.5 + l * 0.3);
    const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, c + 'cc');
    grd.addColorStop(1, c + '00');
    ctx.fillStyle = grd;
    ctx.globalAlpha = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Bright center
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = '#ffffff40';
  ctx.beginPath();
  ctx.arc(x, y, size * 0.15, 0, Math.PI * 2);
  ctx.fill();
}

// 🌳 Branch — fractal branches growing in direction of drag
function drawBranch(x, y, dx, dy) {
  const ang = Math.atan2(dy, dx) - Math.PI / 2;
  branchRec(x, y, ang, size * 1.5, size * 0.18, 0, 4);
}
function branchRec(x, y, ang, len, thick, depth, maxDepth) {
  if (depth >= maxDepth || len < 2) return;
  const x2 = x + Math.cos(ang) * len;
  const y2 = y + Math.sin(ang) * len;
  const c = pickColor(depth);
  ctx.strokeStyle = c;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = thick;
  ctx.shadowColor = c;
  ctx.shadowBlur = thick * 0.6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  const spread = 0.4 + rand() * 0.3;
  branchRec(x2, y2, ang - spread, len * 0.65, thick * 0.7, depth + 1, maxDepth);
  branchRec(x2, y2, ang + spread, len * 0.65, thick * 0.7, depth + 1, maxDepth);
  if (rand() < 0.35) branchRec(x2, y2, ang, len * 0.55, thick * 0.6, depth + 1, maxDepth);
}

// 🌀 Spiral — concentric spiral at point
function drawSpiral(x, y, dx, dy) {
  const ang0 = Math.atan2(dy, dx);
  const turns = 2 + size / 20;
  const rMax = size * 1.2;
  const steps = 50;
  const c1 = pickColor(0), c2 = pickColor(2);
  ctx.lineWidth = size * 0.12;
  ctx.shadowBlur = size * 0.3;
  for (let s = 0; s < steps; s++) {
    const t = s / steps;
    const ang = ang0 + t * turns * Math.PI * 2;
    const r = rMax * t;
    const px = x + Math.cos(ang) * r;
    const py = y + Math.sin(ang) * r;
    const col = mixColor(c1, c2, t);
    ctx.strokeStyle = col;
    ctx.shadowColor = col;
    ctx.globalAlpha = 0.6;
    if (s === 0) ctx.beginPath(), ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
}
function mixColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return rgbToHex(a.r + (b.r-a.r)*t, a.g + (b.g-a.g)*t, a.b + (b.b-a.b)*t);
}
function hexToRgb(hex) {
  const h = hex.replace('#','');
  return { r:parseInt(h.slice(0,2),16), g:parseInt(h.slice(2,4),16), b:parseInt(h.slice(4,6),16) };
}
function rgbToHex(r,g,b) {
  return '#' + [r,g,b].map(x => Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,'0')).join('');
}

// ✨ Web — draw point, later samples connect
let webPoints = [];
function drawWeb(x, y) {
  webPoints.push({ x, y });
  if (webPoints.length > 40) webPoints.shift();
  const maxD = size * 4;
  // Lines to recent points
  for (let i = 0; i < webPoints.length; i++) {
    for (let j = i + 1; j < webPoints.length; j++) {
      const p1 = webPoints[i], p2 = webPoints[j];
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d < maxD) {
        const a = (1 - d / maxD) * 0.5;
        const c = pickColor(i + j);
        ctx.strokeStyle = c;
        ctx.globalAlpha = a;
        ctx.lineWidth = a * 1.5;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    }
  }
  // Dot
  const c = pickColor(webPoints.length);
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.9;
  ctx.shadowColor = c;
  ctx.shadowBlur = size * 0.4;
  ctx.beginPath();
  ctx.arc(x, y, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
}

// ⭕ Bubble — random circles
function drawBubble(x, y) {
  const n = 1 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const ox = x + (rand() - 0.5) * size;
    const oy = y + (rand() - 0.5) * size;
    const r = size * (0.2 + rand() * 0.5);
    const c = pickColor(Math.floor(rand() * 5));
    const grd = ctx.createRadialGradient(ox - r * 0.3, oy - r * 0.3, 0, ox, oy, r);
    grd.addColorStop(0, '#ffffff80');
    grd.addColorStop(0.3, c + 'cc');
    grd.addColorStop(1, c + '40');
    ctx.fillStyle = grd;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(ox, oy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// 💧 Drip — vertical pixel drip
function drawDrip(x, y) {
  const px = Math.max(3, size * 0.25);
  const c = pickColor(Math.floor(rand() * 5));
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.85;
  ctx.shadowColor = c;
  ctx.shadowBlur = px;
  const drops = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < drops; i++) {
    const ox = x + (rand() - 0.5) * size;
    const oy = y + (rand() - 0.5) * size * 0.5;
    const dLen = size * (1 + rand() * 2);
    for (let d = 0; d < dLen; d += px) {
      ctx.globalAlpha = 0.85 * (1 - d / dLen);
      ctx.fillRect(ox, oy + d, px, px);
    }
  }
}

// 🖋️ Calligraphy — tapered thick line
function drawCalligraphy(x, y, dx, dy, speed) {
  const ang = Math.atan2(dy, dx);
  const pal = PALETTES[paletteIdx].colors;
  const pressure = Math.max(0.3, 1 - speed / 100);
  const thick = size * 0.4 * pressure;
  const c = pickColor(0);
  ctx.fillStyle = c;
  ctx.globalAlpha = 0.85;
  ctx.shadowColor = c;
  ctx.shadowBlur = thick * 0.5;
  // Draw ellipse at point
  ctx.beginPath();
  ctx.ellipse(x, y, thick * 1.5, thick * 0.4, ang, 0, Math.PI * 2);
  ctx.fill();
  // Ink splatter
  if (speed < 8) {
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.arc(x + (rand()-0.5)*thick*3, y + (rand()-0.5)*thick*3, thick*0.15, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

// ===== CLEAR =====
function clearCanvas() {
  snapshot();
  ctx.fillStyle = '#121214';
  ctx.fillRect(0, 0, W, H);
  webPoints = [];
}
document.getElementById('clear-btn').addEventListener('click', clearCanvas);

// ===== UNDO =====
document.getElementById('undo-btn').addEventListener('click', undo);

// ===== SAVE PNG =====
document.getElementById('save-btn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `museum-studio-${Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Saved! 💾');
});

// ===== AUTO BACKGROUND (fill the canvas with a soft gradient) =====
document.getElementById('gallery-btn').addEventListener('click', () => {
  snapshot();
  const pal = PALETTES[paletteIdx].colors;
  const cx = rand() * W, cy = rand() * H;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W,H));
  grd.addColorStop(0, pal[4]);
  grd.addColorStop(0.5, pal[2] + '80');
  grd.addColorStop(1, '#121214');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
  // Sprinkle some ambient dots
  for (let i = 0; i < 50; i++) {
    ctx.fillStyle = pal[Math.floor(rand()*pal.length)] + '30';
    ctx.beginPath();
    ctx.arc(rand()*W, rand()*H, 1 + rand()*3, 0, Math.PI*2);
    ctx.fill();
  }
  showToast('Background added 🎨');
});

function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.getElementById('app').appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

// ===== START =====
document.getElementById('start-btn').addEventListener('click', () => {
  document.getElementById('start-overlay').classList.add('hidden');
  clearCanvas();
});

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') undo();
  else if (e.key === 's' || e.key === 'S') document.getElementById('save-btn').click();
  else if (e.key === 'c' || e.key === 'C') clearCanvas();
  else if (e.key >= '1' && e.key <= '8') {
    brushIdx = parseInt(e.key) - 1;
    brushList.querySelectorAll('.brush-btn').forEach((b,i) => b.classList.toggle('active', i === brushIdx));
  }
});

// ===== CLEAR WEB POINTS WHEN BRUSH CHANGES =====
document.querySelectorAll('.brush-btn').forEach(b => {
  b.addEventListener('click', () => { webPoints = []; });
});
