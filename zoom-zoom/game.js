// ===== ZOOM ZOOM — Dodge Forever! =====
// 3D pseudo-perspective neon tunnel. Pure canvas.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W, H, CX, CY;

function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  CX = W / 2; CY = H / 2;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ===== AUDIO — synth thump beat =====
let audioCtx = null, musicGain = null, muted = false;
let audioStartT = 0;
const BPM = 140;
const BEAT = 60 / BPM;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = muted ? 0 : 0.5;
  musicGain.connect(audioCtx.destination);
}

function playThump(time, vol = 0.3) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.frequency.setValueAtTime(80, time);
  o.frequency.exponentialRampToValueAtTime(30, time + 0.15);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
  o.connect(g); g.connect(musicGain);
  o.start(time); o.stop(time + 0.25);
}

function playZap(time, vol = 0.15) {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'square';
  o.frequency.setValueAtTime(2000, time);
  o.frequency.exponentialRampToValueAtTime(200, time + 0.08);
  g.gain.setValueAtTime(vol, time);
  g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
  o.connect(g); g.connect(musicGain);
  o.start(time); o.stop(time + 0.12);
}

function playCrash() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  // Big sub bass drop
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(200, t);
  o.frequency.exponentialRampToValueAtTime(20, t + 0.5);
  g.gain.setValueAtTime(0.8, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  const f = audioCtx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 300;
  o.connect(f); f.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + 0.6);
  // White noise burst
  const len = audioCtx.sampleRate * 0.3;
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.6, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 500;
  src.connect(hp); hp.connect(ng); ng.connect(musicGain);
  src.start(t);
}

// ===== TUNNEL CONSTANTS =====
const FOCAL = 280;           // perspective focal length
const RING_COUNT = 28;       // visible rings at once
const RING_SPACING = 6;      // depth between rings
const MAX_DEPTH = RING_COUNT * RING_SPACING;
const HEX_R = Math.max(W, H) * 0.55; // hex radius at depth=0

// 6 hex sectors grouped into 3 lanes (2 sectors each)
// sectors: 0+1 = left, 2+3 = mid, 4+5 = right
const LANE_SECTORS = [
  [0, 1],   // left
  [2, 3],   // mid
  [4, 5],   // right
];
const NUM_SECTORS = 6;
const NUM_LANES = 3;

// ===== GAME STATE =====
let state = 'START'; // START, PLAYING, CRASH
let tunnelOffset = 0;
let speed = 1.0;
let speedTarget = 1.0;
let lane = 1;       // 0=left 1=mid 2=right
let laneTarget = 1;
let score = 0;
let best = parseInt(localStorage.getItem('zz-best') || '0');
let obstacles = []; // { depth, lanes:[bool,bool,bool] }
let nextObstacleDepth = 80;
let crashT = 0;
let screenFlash = 0;
let shards = [];   // crash shard particles

function project(wx, wy, depth) {
  const scale = FOCAL / (FOCAL + depth);
  return {
    x: CX + wx * scale,
    y: CY + wy * scale,
    r: HEX_R * scale,
    scale
  };
}

// 6 hex vertices in world coords for a ring at given depth & rotation
function hexVertices(depth, rotation) {
  const p = project(0, 0, depth);
  const verts = [];
  for (let i = 0; i < NUM_SECTORS; i++) {
    const a = i * Math.PI / 3 + rotation;
    verts.push({
      x: p.x + Math.cos(a) * p.r,
      y: p.y + Math.sin(a) * p.r,
      wx: Math.cos(a) * HEX_R,
      wy: Math.sin(a) * HEX_R,
      scale: p.scale
    });
  }
  return verts;
}

// ===== RENDER =====
function render(t) {
  // Black background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, W, H);

  if (state === 'CRASH') {
    // Draw tunnel frozen + shards + flash
    drawTunnelFrozen(t);
    drawCrashShards();
    if (screenFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${screenFlash})`;
      ctx.fillRect(0, 0, W, H);
    }
    return;
  }

  // Moving tunnel
  drawTunnel(t);

  // Player ship — a small triangle at center, tilted by lane
  drawShip();

  // Obstacles (rendered on top of tunnel walls)
  drawObstacles();

  // Vignette
  const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // ===== KALEIDO FILTER =====
  if (FILTERS[filterIdx] === 'KALEIDO') {
    const N = 6;
    const maxR = Math.max(W, H);
    const temp = document.createElement('canvas');
    temp.width = canvas.width; temp.height = canvas.height;
    const tctx = temp.getContext('2d');
    tctx.drawImage(canvas, 0, 0);
    ctx.save();
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);
    const sa = (Math.PI * 2) / N;
    for (let i = 0; i < N; i++) {
      ctx.save();
      ctx.translate(CX, CY);
      ctx.rotate(i * sa + filterAnimPhase * 0.3);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, maxR, -sa / 2, sa / 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(temp, -CX, -CY);
      ctx.restore();
    }
    ctx.restore();
  }
}

function drawTunnel(t) {
  const rotSpeed = 0.3 + speed * 0.1;
  const rotation = (t / 1000) * rotSpeed;

  // Collect all ring depth values that are visible
  const depths = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const d = (i * RING_SPACING - (tunnelOffset % RING_SPACING) + MAX_DEPTH) % MAX_DEPTH;
    depths.push(d);
  }
  depths.sort((a, b) => b - a); // far → near

  // 1. Draw tunnel inner background (dark to light gradient through rings)
  // 2. Draw ring hexagon outlines
  for (let i = 0; i < depths.length; i++) {
    const depth = depths[i];
    const ringIdx = Math.floor((tunnelOffset + depth) / RING_SPACING);
    const verts = hexVertices(depth, rotation + ringIdx * 0.02);
    const scale = FOCAL / (FOCAL + depth);
    const brightness = Math.max(0, 1 - depth / MAX_DEPTH);
    const hue = (t / 20 + depth * 2) % 360;

    // Fill hex ring face (subtle gradient)
    if (depth < MAX_DEPTH - RING_SPACING * 2) {
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y);
      for (let v = 1; v < verts.length; v++) ctx.lineTo(verts[v].x, verts[v].y);
      ctx.closePath();
      ctx.fillStyle = `hsl(${hue}, 70%, ${10 + brightness * 8}%)`;
      ctx.fill();
    }

    // Hex ring outline
    const alpha = Math.max(0.05, brightness * 0.7);
    ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
    ctx.lineWidth = 1 + brightness * 1.5;
    ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha * 0.6})`;
    ctx.shadowBlur = brightness * 12;
    ctx.beginPath();
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let v = 1; v < verts.length; v++) ctx.lineTo(verts[v].x, verts[v].y);
    ctx.closePath();
    ctx.stroke();

    // Lane dividers (3 lines from center to sector boundaries at 2, 4 o'clock-ish)
    // Dividers between sectors 1-2, 3-4, 5-0
    for (let d = 0; d < NUM_LANES; d++) {
      const v1 = verts[(d * 2 + 1) % NUM_SECTORS];
      const v2 = verts[(d * 2 + 2) % NUM_SECTORS];
      // Midpoint angle
      const midA1 = (d * 2 + 1) * Math.PI / 3 + rotation + ringIdx * 0.02;
      const midA2 = (d * 2 + 2) * Math.PI / 3 + rotation + ringIdx * 0.02;
      // Actually just draw a line from center to hex edge at the midpoint angle
      const p1 = project(Math.cos(midA1) * HEX_R, Math.sin(midA1) * HEX_R, depth);
      const p2 = project(Math.cos(midA2) * HEX_R, Math.sin(midA2) * HEX_R, depth);
      // No, simpler: draw line from center to each sector boundary vertex
      const boundaryA = ((d * 2 + 2) % NUM_SECTORS) * Math.PI / 3 + rotation + ringIdx * 0.02;
      const pb = project(Math.cos(boundaryA) * HEX_R, Math.sin(boundaryA) * HEX_R, depth);
      ctx.beginPath();
      ctx.moveTo(CX, CY);
      ctx.lineTo(pb.x, pb.y);
      ctx.strokeStyle = `hsla(${hue}, 80%, 50%, ${alpha * 0.5})`;
      ctx.lineWidth = 0.5 + brightness * 0.5;
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;

  // 3. Draw connecting lines between consecutive rings (depth lines)
  // Pick 2 rings and draw lines through same hex vertex indices
  const ringA = depths.filter(d => d < MAX_DEPTH - RING_SPACING * 2).slice(0, 1);
  const ringB = depths.filter(d => d < MAX_DEPTH - RING_SPACING * 2).slice(1, 2);
  if (ringA.length && ringB.length) {
    const vertsA = hexVertices(ringA[0], rotation);
    const vertsB = hexVertices(ringB[0], rotation);
    ctx.strokeStyle = 'rgba(0,229,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let v = 0; v < NUM_SECTORS; v++) {
      ctx.beginPath();
      ctx.moveTo(vertsA[v].x, vertsA[v].y);
      ctx.lineTo(vertsB[v].x, vertsB[v].y);
      ctx.stroke();
    }
  }
}

function drawTunnelFrozen(t) {
  drawTunnel(t);
}

function drawObstacles() {
  for (const o of obstacles) {
    if (o.depth > MAX_DEPTH - RING_SPACING || o.depth < 1.5) continue;
    const ringIdx = Math.floor((tunnelOffset + o.depth) / RING_SPACING);
    const rotSpeed = 0.3 + speed * 0.1;
    const rotation = (performance.now() / 1000) * rotSpeed;
    const verts = hexVertices(o.depth, rotation + ringIdx * 0.02);
    const brightness = 1 - o.depth / MAX_DEPTH;

    // Draw obstacle occupying specific lanes
    for (let ln = 0; ln < NUM_LANES; ln++) {
      if (!o.lanes[ln]) continue;
      const sectors = LANE_SECTORS[ln];
      // Draw filled polygon for each sector
      for (const s of sectors) {
        const v1 = verts[s];
        const v2 = verts[(s + 1) % NUM_SECTORS];
        ctx.beginPath();
        ctx.moveTo(CX, CY);
        ctx.lineTo(v1.x, v1.y);
        ctx.lineTo(v2.x, v2.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(255,45,149,${brightness * 0.85})`;
        ctx.shadowColor = `rgba(255,45,149,${brightness})`;
        ctx.shadowBlur = brightness * 20;
        ctx.fill();
        ctx.strokeStyle = `rgba(255,255,255,${brightness * 0.8})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    ctx.shadowBlur = 0;
  }
}

function drawShip() {
  const laneOffset = (lane - 1) * HEX_R * 0.35;
  // In hex coords: left lane center is ~ (-0.5, -0.866), mid is (0,0), right is (0.5, -0.866)
  // Simplified: just horizontal offset at center
  const targetX = CX + (laneTarget - 1) * 60;
  const targetY = CY + HEX_R * 0.05;
  // Ease
  const cx = CX + (laneTarget - 1) * 60; // just snap to target for responsiveness

  ctx.save();
  ctx.translate(cx, targetY);

  // Trail line going deep into tunnel
  const trailLen = HEX_R * 2.5;
  const grd = ctx.createLinearGradient(0, 0, 0, -trailLen);
  grd.addColorStop(0, 'rgba(0,229,255,0.8)');
  grd.addColorStop(1, 'rgba(0,229,255,0)');
  ctx.strokeStyle = grd;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -trailLen);
  ctx.stroke();

  // Glow
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 25;

  // Ship body — triangle pointing "into" tunnel (up)
  ctx.fillStyle = '#00e5ff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -20);
  ctx.lineTo(16, 12);
  ctx.lineTo(-16, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner glow triangle
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(8, 5);
  ctx.lineTo(-8, 5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawCrashShards() {
  for (const s of shards) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.fillStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 10;
    ctx.fillRect(-s.size / 2, -s.size / 2, s.size, s.size);
    ctx.restore();
  }
}

// ===== UPDATE =====
function update(dt) {
  if (state === 'PLAYING') {
    // Advance tunnel
    tunnelOffset += speed * 20 * dt;
    // Speed ramps up slowly
    speedTarget = Math.min(8, 1.0 + score / 150);
    speed += (speedTarget - speed) * Math.min(1, dt * 0.5);
    // Score accumulates (faster at higher speed)
    score += speed * 10 * dt;

    // Obstacles advance too
    for (const o of obstacles) o.depth -= speed * 20 * dt;

    // Spawn new obstacles
    while (nextObstacleDepth - tunnelOffset < MAX_DEPTH - RING_SPACING * 3) {
      spawnObstacleAt(nextObstacleDepth);
      nextObstacleDepth += 6 + Math.random() * 3;
    }
    // Reset counter when it drifts too far ahead
    if (nextObstacleDepth - tunnelOffset > MAX_DEPTH * 2) {
      nextObstacleDepth = tunnelOffset + MAX_DEPTH - RING_SPACING;
    }

    // Collision check: find obstacle at depth ≈ 1.5
    for (const o of obstacles) {
      if (o.depth < 2.5 && o.depth > 0.5 && !o.checked) {
        o.checked = true;
        if (o.lanes[lane]) {
          crash();
          return;
        }
      }
    }

    // Remove passed obstacles
    obstacles = obstacles.filter(o => o.depth > -1);

    // Audio beat
    if (audioCtx && audioCtx.state === 'running') {
      const elapsed = audioCtx.currentTime - audioStartT;
      const expectedBeats = Math.floor(elapsed / BEAT);
      if (expectedBeats > lastBeatIndex) {
        lastBeatIndex = expectedBeats;
        const bt = audioStartT + expectedBeats * BEAT;
        playThump(bt, 0.25 + speed * 0.02);
        if (expectedBeats % 2 === 0) playZap(bt, 0.08);
      }
    }

    // HUD
    const sv = document.getElementById('score-val');
    if (sv) sv.textContent = Math.floor(score);
    const sp = document.getElementById('speed-val');
    if (sp) sp.textContent = speed.toFixed(1);
  }

  // Crash state
  if (state === 'CRASH') {
    crashT += dt;
    screenFlash = Math.max(0, screenFlash - dt * 3);
    for (const s of shards) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 400 * dt;
      s.rot += s.vrot * dt;
      s.vx *= Math.pow(0.98, dt * 60);
    }
    shards = shards.filter(s => s.y < H + 50 && crashT < 3);
  }
}

function spawnObstacleAt(depth) {
  // Create obstacle at given depth. Avoid blocking all 3 lanes.
  const lanes = [false, false, false];
  const pattern = Math.random();
  if (pattern < 0.4) {
    // Block 1 lane
    lanes[Math.floor(Math.random() * 3)] = true;
  } else if (pattern < 0.85) {
    // Block 2 lanes (always leave 1 open — otherwise unfair)
    const open = Math.floor(Math.random() * 3);
    for (let i = 0; i < 3; i++) if (i !== open) lanes[i] = true;
  } else {
    // Gap pattern — 2 consecutive open, 1 blocked
    lanes[Math.floor(Math.random() * 3)] = true;
  }
  obstacles.push({ depth, lanes, checked: false });
}

function crash() {
  state = 'CRASH';
  playCrash();
  screenFlash = 1;
  crashT = 0;
  // Best
  if (score > best) {
    best = Math.floor(score);
    localStorage.setItem('zz-best', best);
  }
  // Spawn shards
  for (let i = 0; i < 40; i++) {
    shards.push({
      x: CX, y: CY,
      vx: (Math.random() - 0.5) * 600,
      vy: (Math.random() - 0.5) * 600 - 200,
      size: 5 + Math.random() * 15,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() - 0.5) * 10,
      color: ['#ff2d95', '#00e5ff', '#ffd93d', '#fff'][Math.floor(Math.random() * 4)],
    });
  }
  setTimeout(() => {
    document.getElementById('final-score').textContent = `SCORE: ${Math.floor(score)}`;
    document.getElementById('best-on-over').textContent = `BEST: ${best}`;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('over-screen').classList.remove('hidden');
  }, 800);
}

// ===== MAIN LOOP =====
let lastTime = 0;
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
let pointerStartX = null;
canvas.addEventListener('pointerdown', e => {
  if (state !== 'PLAYING') return;
  pointerStartX = e.clientX;
  const rect = canvas.getBoundingClientRect();
  const relX = e.clientX - rect.left;
  // Quick tap left/right half = immediate lane switch
  if (relX < W * 0.35) { laneTarget = Math.max(0, laneTarget - 1); lane = laneTarget; }
  else if (relX > W * 0.65) { laneTarget = Math.min(2, laneTarget + 1); lane = laneTarget; }
});
canvas.addEventListener('pointerup', e => {
  if (state !== 'PLAYING' || pointerStartX === null) return;
  const dx = e.clientX - pointerStartX;
  if (Math.abs(dx) > 30) {
    if (dx < 0) laneTarget = Math.max(0, laneTarget - 1);
    else laneTarget = Math.min(2, laneTarget + 1);
    lane = laneTarget;
  }
  pointerStartX = null;
});

// ===== FILTERS =====
const FILTERS = ['OFF', 'LSD', 'INVERT', 'GLOW', 'KALEIDO'];
let filterIdx = 0;
let filterAnimPhase = 0;
const FILTER_LABELS = { OFF: '🌀', LSD: '🌈', INVERT: '🔮', GLOW: '✨', KALEIDO: '🌸' };
function applyCSSFilter() {
  const el = document.getElementById('game-canvas');
  const f = FILTERS[filterIdx];
  if (f === 'OFF' || f === 'KALEIDO') el.style.filter = 'none';
  else if (f === 'LSD') el.style.filter = `hue-rotate(${(filterAnimPhase * 80) % 360}deg) saturate(2.5) contrast(1.3)`;
  else if (f === 'INVERT') el.style.filter = 'invert(1) hue-rotate(180deg) saturate(2)';
  else if (f === 'GLOW') el.style.filter = 'brightness(1.4) contrast(1.6) saturate(2.5) blur(0.5px)';
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

// ===== HUD BUTTONS =====
document.getElementById('mute-btn').addEventListener('click', () => {
  muted = !muted;
  document.getElementById('mute-btn').textContent = muted ? '🔇' : '🔊';
  if (musicGain) musicGain.gain.value = muted ? 0 : 0.5;
});

// ===== START =====
let lastBeatIndex = -1;
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);
document.getElementById('best-on-start').textContent = `BEST: ${best}`;

function startGame() {
  initAudio();
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  state = 'PLAYING';
  tunnelOffset = 0;
  speed = 1.0; speedTarget = 1.0;
  lane = 1; laneTarget = 1;
  score = 0;
  obstacles = [];
  nextObstacleDepth = 20;
  shards = [];
  crashT = 0; screenFlash = 0;
  audioStartT = audioCtx.currentTime;
  lastBeatIndex = -1;
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
}
