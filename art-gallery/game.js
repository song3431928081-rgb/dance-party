// ===== MUSEUM STUDIO — Magic Brush =====
// 8 algorithmic brushes that follow YOUR finger.

const canvas = document.getElementById('art-canvas');
const bgCanvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
const bgCtx = bgCanvas.getContext('2d');
let W, H, DPR;
function resize() {
  DPR = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  for (const c of [canvas, bgCanvas]) {
    c.width = W * DPR; c.height = H * DPR;
    c.style.width = W + 'px'; c.style.height = H + 'px';
    c.getContext('2d').setTransform(DPR, 0, 0, DPR, 0, 0);
  }
}
window.addEventListener('resize', () => { resize(); });
resize();

// ===== AMBIENT BACKGROUND — floating light orbs =====
const orbs = [];
const NUM_ORBS = 14;
let grainPattern = null;
function initGrain() {
  const g = document.createElement('canvas');
  g.width = 256; g.height = 256;
  const gx = g.getContext('2d');
  const img = gx.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = img.data[i+1] = img.data[i+2] = v;
    img.data[i+3] = 10;
  }
  gx.putImageData(img, 0, 0);
  grainPattern = bgCtx.createPattern(g, 'repeat');
}
function initOrbs() {
  orbs.length = 0;
  const pal = PALETTES[paletteIdx].colors;
  for (let i = 0; i < NUM_ORBS; i++) {
    orbs.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 60 + Math.random() * 220,
      vx: (Math.random() - 0.5) * 12,
      vy: (Math.random() - 0.5) * 12,
      color: pal[Math.floor(Math.random() * pal.length)],
      phase: Math.random() * Math.PI * 2,
    });
  }
}
function drawBg(t) {
  bgCtx.fillStyle = '#0d0d10';
  bgCtx.fillRect(0, 0, W, H);
  // Base gradient
  const pal = PALETTES[paletteIdx].colors;
  const grd = bgCtx.createRadialGradient(W*0.5, H*0.4, 0, W*0.5, H*0.5, Math.max(W,H));
  grd.addColorStop(0, pal[2] + '12');
  grd.addColorStop(1, '#0d0d10');
  bgCtx.fillStyle = grd;
  bgCtx.fillRect(0, 0, W, H);
  // Floating orbs
  for (const o of orbs) {
    o.x += o.vx * 0.016;
    o.y += o.vy * 0.016;
    if (o.x < -o.r) o.x = W + o.r;
    if (o.x > W + o.r) o.x = -o.r;
    if (o.y < -o.r) o.y = H + o.r;
    if (o.y > H + o.r) o.y = -o.r;
    const pulse = 0.8 + Math.sin(t * 0.0006 + o.phase) * 0.2;
    const r = o.r * pulse;
    const g = bgCtx.createRadialGradient(o.x, o.y, 0, o.x, o.y, r);
    g.addColorStop(0, o.color + '28');
    g.addColorStop(0.5, o.color + '10');
    g.addColorStop(1, o.color + '00');
    bgCtx.fillStyle = g;
    bgCtx.beginPath();
    bgCtx.arc(o.x, o.y, r, 0, Math.PI * 2);
    bgCtx.fill();
  }
  // Grain overlay (cheap pattern)
  if (grainPattern) {
    bgCtx.save();
    bgCtx.globalAlpha = 0.5;
    bgCtx.fillStyle = grainPattern;
    bgCtx.fillRect(0, 0, W, H);
    bgCtx.restore();
  }
}
let bgStarted = false;
function bgLoop(t) {
  if (!bgStarted) return;
  drawBg(t);
  requestAnimationFrame(bgLoop);
}

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

// ===== AMBIENT MUSIC — pre-rendered lo-fi pad =====
let audioCtx = null, musicNode = null, musicGain = null;
let musicOn = true;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = musicOn ? 0.18 : 0;
  musicGain.connect(audioCtx.destination);
}

// Render a 20s ambient loop: detuned sine pads + slow filter sweep + soft arp
async function renderMusic() {
  const dur = 24;
  const sampleRate = audioCtx.sampleRate;
  const off = new OfflineAudioContext(2, sampleRate * dur, sampleRate);
  const out = off.createGain();
  out.gain.value = 0.9;
  out.connect(off.destination);

  // Low-pass filter that slowly sweeps
  const lp = off.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1200;
  lp.Q.value = 0.8;
  const lpLfo = off.createOscillator();
  lpLfo.frequency.value = 0.08;
  const lpLfoGain = off.createGain();
  lpLfoGain.gain.value = 700;
  lpLfo.connect(lpLfoGain);
  lpLfoGain.connect(lp.frequency);
  lp.connect(out);
  lpLfo.start();

  // Pad — 5 detuned sine waves in a rich chord (D minor 9)
  const chord = [73.42, 110, 164.81, 220, 293.66]; // D2, A2, E3, A3, D4
  chord.forEach((freq, i) => {
    const osc = off.createOscillator();
    osc.type = i === 0 ? 'sine' : (i % 2 ? 'triangle' : 'sine');
    osc.frequency.value = freq * (1 + (i - 2) * 0.003);
    const g = off.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, 0);
    g.gain.linearRampToValueAtTime(0.12 / chord.length, 2 + i * 0.4);
    g.gain.linearRampToValueAtTime(0.08 / chord.length, dur);
    // Slow tremolo
    const trem = off.createOscillator();
    trem.frequency.value = 0.15 + i * 0.04;
    const tremG = off.createGain();
    tremG.gain.value = 0.05 / chord.length;
    trem.connect(tremG);
    tremG.connect(g.gain);
    osc.connect(g);
    g.connect(lp);
    osc.start(0);
    trem.start(0);
    osc.stop(dur);
    trem.stop(dur);
  });

  // Soft arpeggio every 2s
  const arpNotes = [220, 277.18, 329.63, 440, 554.37]; // A3, C#4, E4, A4, C#5
  for (let step = 0; step < dur / 2; step++) {
    const t = step * 2 + 0.5;
    const note = arpNotes[step % arpNotes.length];
    const o = off.createOscillator();
    o.type = 'sine';
    o.frequency.value = note;
    const g = off.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.04, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    o.connect(g);
    g.connect(lp);
    o.start(t);
    o.stop(t + 2);
  }

  // Sub bass
  const sub = off.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = 36.71; // D1
  const subG = off.createGain();
  subG.gain.setValueAtTime(0, 0);
  subG.gain.linearRampToValueAtTime(0.15, 3);
  subG.gain.linearRampToValueAtTime(0.1, dur);
  sub.connect(subG);
  subG.connect(out);
  sub.start(0);
  sub.stop(dur);

  // Very soft pink-ish noise bed (filtered)
  const noiseLen = sampleRate * dur;
  const noiseBuf = off.createBuffer(1, noiseLen, sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * 0.15;
  const noise = off.createBufferSource();
  noise.buffer = noiseBuf;
  const nf = off.createBiquadFilter();
  nf.type = 'bandpass';
  nf.frequency.value = 400;
  nf.Q.value = 0.5;
  const ng = off.createGain();
  ng.gain.value = 0.03;
  noise.connect(nf); nf.connect(ng); ng.connect(out);
  noise.start(0);
  noise.stop(dur);

  const buffer = await off.startRendering();
  musicNode = audioCtx.createBufferSource();
  musicNode.buffer = buffer;
  musicNode.loop = true;
  musicNode.connect(musicGain);
  musicNode.start();
}

async function startMusic() {
  if (!audioCtx) initAudio();
  if (audioCtx.state !== 'running') await audioCtx.resume().catch(()=>{});
  if (!musicNode) {
    try { await renderMusic(); }
    catch (e) { console.warn('music render failed', e); }
  }
  if (musicNode) musicNode.start();
}
function stopMusic() {
  if (musicNode) { try { musicNode.stop(); } catch(e){} musicNode = null; }
}
function toggleMusic() {
  musicOn = !musicOn;
  const btn = document.getElementById('music-btn');
  btn.classList.toggle('off', !musicOn);
  btn.textContent = musicOn ? '🎵' : '🔇';
  if (musicGain) musicGain.gain.value = musicOn ? 0.18 : 0;
  if (musicOn && audioCtx && !musicNode) startMusic();
}
document.getElementById('music-btn').addEventListener('click', toggleMusic);

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
    if (bgStarted) initOrbs(); // update ambient bg colors
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
  ctx.clearRect(0, 0, W, H);
  webPoints = [];
}
document.getElementById('clear-btn').addEventListener('click', clearCanvas);

// ===== UNDO =====
document.getElementById('undo-btn').addEventListener('click', undo);

// ===== SAVE PNG =====
document.getElementById('save-btn').addEventListener('click', () => {
  // Composite background + art into one PNG
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(bgCanvas, 0, 0);
  tctx.drawImage(canvas, 0, 0);
  const link = document.createElement('a');
  link.download = `museum-studio-${Date.now()}.png`;
  link.href = tmp.toDataURL('image/png');
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
  // Init ambient background
  if (!grainPattern) initGrain();
  initOrbs();
  bgStarted = true;
  requestAnimationFrame(bgLoop);
  clearCanvas();
  // Start ambient music
  initAudio();
  startMusic();
});

// ===== KEYBOARD =====
document.addEventListener('keydown', e => {
  if (e.key === 'z' || e.key === 'Z') undo();
  else if (e.key === 's' || e.key === 'S') document.getElementById('save-btn').click();
  else if (e.key === 'c' || e.key === 'C') clearCanvas();
  else if (e.key === 'm' || e.key === 'M') toggleMusic();
  else if (e.key >= '1' && e.key <= '8') {
    brushIdx = parseInt(e.key) - 1;
    brushList.querySelectorAll('.brush-btn').forEach((b,i) => b.classList.toggle('active', i === brushIdx));
  }
});

// ===== CLEAR WEB POINTS WHEN BRUSH CHANGES =====
document.querySelectorAll('.brush-btn').forEach(b => {
  b.addEventListener('click', () => { webPoints = []; });
});
