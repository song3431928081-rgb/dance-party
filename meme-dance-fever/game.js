// ===== ABSTRACT SHAKER — Meme Dance Fever =====
// Pure canvas rhythm + ragdoll dance game. Procedural everything.

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let W, H, CX, CY;
function resize() {
  const dpr = Math.min(window.devicePixelRatio, 2);
  W = window.innerWidth; H = window.innerHeight;
  CX = W/2; CY = H/2;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize); resize();

// ===== AUDIO =====
let audioCtx = null, masterGain = null, musicNode = null, musicStartT = 0;
let muted = false;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = muted ? 0 : 0.5;
  masterGain.connect(audioCtx.destination);
}

// Pre-render a 32-bar 128 BPM loop
async function renderBGM(bpm) {
  const BPM = bpm;
  const BEAT = 60 / BPM;
  const dur = BEAT * 32;
  const sr = audioCtx.sampleRate;
  const off = new OfflineAudioContext(2, sr * dur, sr);
  const out = off.createGain(); out.gain.value = 0.85; out.connect(off.destination);

  // Kick on every beat
  for (let b = 0; b < 32; b++) {
    const t = b * BEAT;
    const o = off.createOscillator();
    const g = off.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + 0.2);
  }
  // Hi-hat on off-beats
  for (let b = 0; b < 64; b++) {
    if (b % 2 === 0) continue;
    const t = b * BEAT / 2;
    const len = sr * 0.05;
    const buf = off.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/len, 3);
    const src = off.createBufferSource(); src.buffer = buf;
    const g = off.createGain(); g.gain.value = 0.12;
    const hp = off.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    src.connect(hp); hp.connect(g); g.connect(out);
    src.start(t);
  }
  // Bassline — A minor pentatonic riff
  const bassNotes = [55, 55, 73.42, 82.41, 73.42, 65.41, 55, 49];
  for (let b = 0; b < 32; b++) {
    const t = b * BEAT;
    const note = bassNotes[b % bassNotes.length];
    const o = off.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = note;
    const g = off.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + BEAT * 0.8);
    const lp = off.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
    o.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o.stop(t + BEAT);
  }
  // Suona-like lead on every 4 beats (square wave + vibrato)
  const leadNotes = [440, 523.25, 587.33, 659.25, 587.33, 523.25, 440, 392];
  for (let b = 0; b < 32; b += 1) {
    if (b % 4 !== 0) continue;
    const t = b * BEAT;
    const note = leadNotes[(b/4) % leadNotes.length];
    const o = off.createOscillator();
    o.type = 'square';
    o.frequency.value = note;
    const vib = off.createOscillator();
    vib.frequency.value = 5;
    const vg = off.createGain(); vg.gain.value = 8;
    vib.connect(vg); vg.connect(o.frequency);
    const g = off.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + BEAT * 3.5);
    o.connect(g); g.connect(out);
    o.start(t); vib.start(t);
    o.stop(t + BEAT*4); vib.stop(t + BEAT*4);
  }
  const buffer = await off.startRendering();
  musicNode = audioCtx.createBufferSource();
  musicNode.buffer = buffer;
  musicNode.loop = true;
  musicNode.connect(masterGain);
  musicNode.start();
  musicStartT = audioCtx.currentTime;
}

// SFX
function sfx(type) {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  if (type === 'perfect') {
    const o = audioCtx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.08);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.15);
  } else if (type === 'good') {
    const o = audioCtx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(523, t);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.16);
  } else if (type === 'miss') {
    // Dog bark + spring
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.3);
  } else if (type === 'combo') {
    const o = audioCtx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1200, t);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.06);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.12);
  } else if (type === 'boss') {
    const o = audioCtx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g); g.connect(masterGain);
    o.start(t); o.stop(t + 0.7);
  }
}

// ===== CHARACTER PARTS =====
const HEADS = ['dog','frog','eggplant','tv','toilet','bean'];
const LIMB_TYPES = ['spring','noodle','chicken','slipper','propeller','cable'];
const BODY_TYPES = ['jelly','noodle','sausage'];
const SKINS = [
  { name:'toxic',  hue:130 },
  { name:'barbie', hue:320 },
  { name:'glitch', hue:280 },
  { name:'tomato', hue:8   },
];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

let character;
function genCharacter() {
  return {
    head: pick(HEADS),
    body: pick(BODY_TYPES),
    limbs: [pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES), pick(LIMB_TYPES)],
    skin: pick(SKINS),
    headSize: rand(50, 90),
    bodyLen: rand(80, 140),
    // Animation state
    headPhase: Math.random() * Math.PI * 2,
    bodyPhase: Math.random() * Math.PI * 2,
    eyePhase: [Math.random()*Math.PI*2, Math.random()*Math.PI*2],
    limbPhase: [0, Math.PI, Math.PI/2, -Math.PI/2],
    // Mutation toggles
    bigHead: false,
    longNeck: false,
    eyesOut: false,
    spiralLimb: false,
    invertColor: false,
    ghostTrail: false,
    // Current action
    action: 'idle',
    actionT: 0,
  };
}

// ===== DANCE MOVES =====
const MOVES = [
  'idle','electro_shake','social_rock','ke_mu_san','flower_hands',
  'head_throw','hip_twist','twitch','reverse','moonwalk','crab','robot','breakdance'
];

// ===== GAME STATE =====
let state = 'START';
let score = 0, combo = 0, maxCombo = 0, chaos = 0;
let bpm = 132;
let beat = 0; // current beat index
let beatT = 0; // time since last beat
const BEAT_INTERVAL = 60 / bpm;
let songTime = 0;
let songDuration = 45; // seconds
let notes = []; // upcoming QTE notes
let noteId = 0;
let nextSpawnBeat = 4;
let bossActive = false;
let bossAppearAt = 25; // seconds
let replayFrames = []; // capture for replay
let replayCapturing = false;

// ===== QTE NOTE TYPES =====
const NOTE_TYPES = ['tap','hold','spam','swipe_left','swipe_right','swipe_up','swipe_down'];

function spawnNote() {
  const type = pick(NOTE_TYPES);
  // Place note near top, falling down to hit zone
  const lane = type.startsWith('swipe') ? (type === 'swipe_left' ? 0.2 : type === 'swipe_right' ? 0.8 : type === 'swipe_up' ? 0.5 : 0.5) : rand(0.2, 0.8);
  notes.push({
    id: noteId++,
    type,
    x: W * lane,
    y: -60,
    hitY: H * 0.78,
    speed: (H * 0.85) / (BEAT_INTERVAL * 4), // 4 beats travel
    spawnedAt: songTime,
    hitWindow: BEAT_INTERVAL * 1.2,
    state: 'falling', // falling, hit, missed
    holdProgress: 0,
    holdNeeded: 0.8,
    spamCount: 0,
    spamNeeded: 5 + Math.floor(Math.random() * 4),
    swipeStart: null,
    active: false,
  });
}

// ===== INPUT =====
let activeNote = null;
function onTap(x, y) {
  if (state !== 'PLAYING') return;
  // Find nearest falling note in hit zone
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    const dy = Math.abs(n.y - n.hitY);
    if (dy < 80) {
      if (n.type === 'tap') {
        hitNote(n, dy);
        return;
      }
      if (n.type === 'spam') {
        n.spamCount++;
        spawnPopup(x, y, n.spamCount + '!', '#39ff14');
        if (n.spamCount >= n.spamNeeded) hitNote(n, 10);
        return;
      }
      if (n.type === 'hold') {
        n.active = true;
        return;
      }
      if (n.type.startsWith('swipe')) {
        n.swipeStart = { x, y, t: performance.now() };
        n.active = true;
        return;
      }
    }
  }
}
function onDrag(x, y) {
  if (state !== 'PLAYING') return;
  for (const n of notes) {
    if (n.state !== 'falling' || !n.active) continue;
    if (n.type === 'hold') {
      n.holdProgress += 0.02;
      if (n.holdProgress >= n.holdNeeded) hitNote(n, 10);
    }
    if (n.swipeStart) {
      const dx = x - n.swipeStart.x;
      const dy = y - n.swipeStart.y;
      const d = Math.sqrt(dx*dx + dy*dy);
      if (d > 50) {
        const angle = Math.atan2(dy, dx);
        let dir;
        if (Math.abs(dx) > Math.abs(dy)) dir = dx > 0 ? 'swipe_right' : 'swipe_left';
        else dir = dy > 0 ? 'swipe_down' : 'swipe_up';
        if (dir === n.type) hitNote(n, 10);
        else { n.state = 'missed'; missNote(n); }
      }
    }
  }
}
function onRelease() {
  for (const n of notes) {
    if (n.state === 'falling' && n.active) {
      n.active = false;
      n.swipeStart = null;
      if (n.type === 'hold' && n.holdProgress < n.holdNeeded) {
        n.state = 'missed'; missNote(n);
      }
    }
  }
}

function hitNote(n, dy) {
  n.state = 'hit';
  let judge;
  if (dy < 30) { judge = 'PERFECT'; score += 100; sfx('perfect'); }
  else if (dy < 60) { judge = 'GOOD'; score += 50; sfx('good'); }
  else { judge = 'GOOD'; score += 30; sfx('good'); }
  combo++;
  maxCombo = Math.max(maxCombo, combo);
  chaos = Math.min(100, chaos + 3);
  if (combo % 5 === 0) sfx('combo');
  showJudgement(judge, judge === 'PERFECT' ? '#39ff14' : '#ffd93d');
  spawnPopup(n.x, n.y - 40, judge, judge === 'PERFECT' ? '#39ff14' : '#ffd93d');
  // Trigger a dance move!
  triggerMove();
}
function missNote(n) {
  combo = 0;
  chaos = Math.max(0, chaos - 5);
  sfx('miss');
  showJudgement('MISS', '#ff0040');
  spawnPopup(n.x, n.y - 40, 'MISS', '#ff0040');
  // Glitch punishment
  triggerGlitch();
}

function showJudgement(text, color) {
  const el = document.getElementById('judgement');
  el.textContent = text;
  el.style.color = color;
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}
function spawnPopup(x, y, text, color) {
  const el = document.createElement('div');
  el.className = 'popup';
  el.textContent = text;
  el.style.color = color;
  el.style.left = (x - 40) + 'px';
  el.style.top = y + 'px';
  document.getElementById('popups').appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ===== DANCE ACTIONS =====
function triggerMove() {
  const weights = MOVES.map(() => 1);
  weights[0] = 0.3; // idle less likely
  let total = weights.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for (let i = 0; i < MOVES.length; i++) {
    r -= weights[i];
    if (r <= 0) { character.action = MOVES[i]; character.actionT = 0; break; }
  }
  // Random mutation on hit
  if (Math.random() < 0.4) {
    const m = ['bigHead','longNeck','eyesOut','spiralLimb','invertColor','ghostTrail'];
    const mutation = pick(m);
    character[mutation] = !character[mutation];
    setTimeout(() => { character[mutation] = !character[mutation]; }, 1500);
  }
}
function triggerGlitch() {
  character.invertColor = true;
  character.action = 'twitch';
  character.actionT = 0;
  setTimeout(() => { character.invertColor = false; }, 800);
}

// ===== RENDER CHARACTER =====
function drawCharacter(c, t) {
  ctx.save();
  const baseX = CX, baseY = H * 0.55;
  const chaosScale = 1 + chaos / 200;
  ctx.translate(baseX, baseY);

  // Ghost trail
  if (c.ghostTrail) {
    for (let i = 3; i > 0; i--) {
      ctx.globalAlpha = 0.15;
      ctx.translate(i * 8 * Math.sin(t*0.01), 0);
      drawBody(c, t, i * 0.3);
      ctx.translate(-i * 8 * Math.sin(t*0.01), 0);
    }
    ctx.globalAlpha = 1;
  }

  drawBody(c, t, 0);
  ctx.restore();
}

function drawBody(c, t, trailOffset) {
  const chaosScale = 1 + chaos / 150;
  // Invert filter
  if (c.invertColor) ctx.filter = 'invert(1) hue-rotate(180deg) saturate(2)';

  // ===== BODY =====
  const bodyWave = Math.sin(t * 0.005 + c.bodyPhase) * 8 * chaosScale;
  const bodyLen = c.bodyLen + (c.action === 'head_throw' ? 60 : 0);
  const bodyW = 35 * chaosScale;

  ctx.strokeStyle = `hsl(${c.skin.hue}, 80%, 55%)`;
  ctx.fillStyle = `hsl(${c.skin.hue}, 80%, 50%)`;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';

  // Body as wobbly sausage
  ctx.beginPath();
  const segs = 12;
  for (let i = 0; i <= segs; i++) {
    const yy = bodyLen * (i / segs) - bodyLen/2;
    const xx = Math.sin(i * 0.8 + t * 0.006) * bodyWave * (i / segs);
    const r = bodyW * (1 - (i/segs - 0.5) * (i/segs - 0.5) * 0.6);
    if (i === 0) ctx.moveTo(xx, yy);
    else ctx.lineTo(xx, yy);
  }
  ctx.stroke();
  ctx.lineWidth = bodyW;
  ctx.stroke();

  // ===== NECK =====
  const neckLen = (c.longNeck ? 80 : 18) + Math.sin(t*0.008 + c.headPhase) * 4;
  const neckY = -bodyLen/2 - neckLen;

  // ===== LIMBS (arms + legs) =====
  for (let i = 0; i < 4; i++) {
    drawLimb(c, i, t, trailOffset);
  }

  // ===== HEAD =====
  const headR = c.headSize * (c.bigHead ? 2.2 : 1) * 0.5;
  const headY = neckY - headR + Math.sin(t*0.01 + c.headPhase) * 5;
  const headBob = (c.action === 'head_throw') ? Math.sin(t*0.03) * 30 : 0;
  ctx.save();
  ctx.translate(0, headY + headBob);
  drawHead(c, headR, t);
  ctx.restore();

  ctx.filter = 'none';
}

function drawLimb(c, idx, t, off) {
  // 0=left arm, 1=right arm, 2=left leg, 3=right leg
  const isArm = idx < 2;
  const side = idx % 2 === 0 ? -1 : 1;
  const attachX = side * 22;
  const attachY = isArm ? -c.bodyLen*0.2 : c.bodyLen*0.45;
  const len = isArm ? 55 : 60;
  const limbType = c.limbs[idx];
  const phase = c.limbPhase[idx] + t * 0.008;
  let angle;

  // Action-based poses
  switch (c.action) {
    case 'electro_shake': angle = Math.sin(phase*4) * 1.2; break;
    case 'social_rock': angle = side * Math.sin(phase*3) * 0.8; break;
    case 'flower_hands': angle = Math.sin(phase*5) * 1.5 + (isArm ? Math.PI/2 : 0); break;
    case 'breakdance': angle = isArm ? -Math.PI/2 + Math.sin(phase)*0.5 : Math.PI/2; break;
    case 'robot': angle = Math.round(Math.sin(phase*3)) * 0.8; break;
    case 'head_throw': angle = Math.sin(phase*2) * 0.6; break;
    default: angle = Math.sin(phase) * 0.4;
  }

  ctx.save();
  ctx.translate(attachX, attachY);
  ctx.rotate(angle * side);

  if (c.spiralLimb) {
    // Spiral arm
    ctx.strokeStyle = `hsl(${c.skin.hue + idx*60}, 80%, 55%)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let s = 0; s < len; s += 2) {
      const a = s * 0.3 + phase;
      const r = s * 0.5;
      const x = Math.cos(a) * r;
      const y = s;
      if (s === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  } else {
    // Spring/noodle
    ctx.strokeStyle = `hsl(${c.skin.hue + idx*40}, 80%, 55%)`;
    ctx.lineWidth = 7;
    ctx.beginPath();
    const segs = 10;
    for (let s = 0; s <= segs; s++) {
      const yy = (s/segs) * len;
      const xx = Math.sin(s * 0.8 + phase*2) * 6;
      if (s === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    }
    ctx.stroke();
  }

  // Foot/hand decoration
  const endY = len;
  if (limbType === 'slipper') {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath(); ctx.ellipse(0, endY, 12, 7, 0, 0, Math.PI*2); ctx.fill();
  } else if (limbType === 'propeller') {
    ctx.save();
    ctx.translate(0, endY);
    ctx.rotate(t * 0.05 * side);
    ctx.fillStyle = '#ffd93d';
    ctx.fillRect(-15, -2, 30, 4);
    ctx.restore();
  } else if (limbType === 'chicken') {
    ctx.fillStyle = '#f39c12';
    ctx.beginPath(); ctx.arc(0, endY, 6, 0, Math.PI*2); ctx.fill();
    for (let f = -1; f <= 1; f++) {
      ctx.fillRect(f*4 - 1, endY, 2, 8);
    }
  }
  ctx.restore();
}

function drawHead(c, r, t) {
  ctx.save();
  const hue = c.skin.hue;
  // Head shape varies by type
  switch (c.head) {
    case 'dog':
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.fillStyle = `hsl(${hue}, 60%, 40%)`;
      ctx.beginPath(); ctx.ellipse(-r*0.7, -r*0.5, r*0.3, r*0.5, -0.4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r*0.7, -r*0.5, r*0.3, r*0.5, 0.4, 0, Math.PI*2); ctx.fill();
      // Snout
      ctx.fillStyle = `hsl(${hue}, 70%, 65%)`;
      ctx.beginPath(); ctx.ellipse(0, r*0.3, r*0.5, r*0.35, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(0, r*0.2, r*0.12, 0, Math.PI*2); ctx.fill();
      break;
    case 'frog':
      ctx.fillStyle = `hsl(${130}, 70%, 50%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r, r*0.85, 0, 0, Math.PI*2); ctx.fill();
      // Eye bumps
      ctx.fillStyle = `hsl(130, 70%, 45%)`;
      ctx.beginPath(); ctx.arc(-r*0.4, -r*0.5, r*0.28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.4, -r*0.5, r*0.28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r*0.4, -r*0.5, r*0.18, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.4, -r*0.5, r*0.18, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-r*0.4, -r*0.5, r*0.08, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(r*0.4, -r*0.5, r*0.08, 0, Math.PI*2); ctx.fill();
      break;
    case 'eggplant':
      ctx.fillStyle = `hsl(280, 70%, 50%)`;
      ctx.beginPath(); ctx.ellipse(0, r*0.1, r*0.7, r*1.1, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsl(130, 60%, 40%)`;
      ctx.beginPath(); ctx.ellipse(0, -r*0.7, r*0.5, r*0.3, 0, 0, Math.PI*2); ctx.fill();
      break;
    case 'tv':
      ctx.fillStyle = `hsl(${hue}, 30%, 35%)`;
      ctx.fillRect(-r, -r*0.7, r*2, r*1.4);
      ctx.fillStyle = `hsl(${hue}, 60%, 60%)`;
      ctx.fillRect(-r*0.8, -r*0.5, r*1.6, r*1);
      // Static noise
      for (let i = 0; i < 20; i++) {
        ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.5})`;
        ctx.fillRect(-r*0.8 + Math.random()*r*1.6, -r*0.5 + Math.random()*r, 3, 3);
      }
      break;
    case 'toilet':
      ctx.fillStyle = `hsl(0, 0%, 85%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.9, r, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = `hsl(0, 0%, 70%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.6, r*0.7, 0, 0, Math.PI*2); ctx.fill();
      break;
    case 'bean':
      ctx.fillStyle = `hsl(${hue}, 70%, 60%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, r*0.8, r, 0, 0, Math.PI*2); ctx.fill();
      break;
  }

  // ===== EYES (independent floating, track beat) =====
  const eyeOffset = (c.eyesOut ? 40 : 0) + Math.sin(t*0.02 + c.eyePhase[0]) * 5;
  const eyeR = r * 0.15;
  // Beat-sync eye pop
  const eyePop = 1 + Math.abs(Math.sin(beat * Math.PI)) * 0.3;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-r*0.3, -r*0.05, eyeR*eyePop, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(r*0.3, -r*0.05, eyeR*eyePop, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-r*0.3 + eyeOffset*0.05, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(r*0.3 + eyeOffset*0.05, -r*0.05, eyeR*0.5*eyePop, 0, Math.PI*2); ctx.fill();

  // ===== MOUTH = pixel speaker =====
  const mouthY = r * 0.4;
  ctx.fillStyle = '#111';
  ctx.fillRect(-r*0.25, mouthY, r*0.5, r*0.2);
  // Speaker bars
  const bars = 5;
  for (let i = 0; i < bars; i++) {
    const h = Math.abs(Math.sin(t*0.02 + i*0.7 + beat*0.5)) * r * 0.18;
    ctx.fillStyle = `hsl(${(t*0.1 + i*40) % 360}, 100%, 60%)`;
    ctx.fillRect(-r*0.2 + i*(r*0.4/bars), mouthY + r*0.1 - h, r*0.06, h);
  }
  ctx.restore();
}

// ===== RENDER BACKGROUND =====
function drawBackground(t) {
  // Base
  const hue = (t * 0.05 + chaos * 3) % 360;
  ctx.fillStyle = `hsl(${hue}, 60%, 8%)`;
  ctx.fillRect(0, 0, W, H);

  // Grid floor (perspective)
  ctx.strokeStyle = `hsla(${(hue+60)%360}, 80%, 50%, 0.3)`;
  ctx.lineWidth = 1;
  const horizon = H * 0.6;
  for (let i = 0; i < 20; i++) {
    const y = horizon + Math.pow(i/20, 2) * (H - horizon);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = -10; i <= 10; i++) {
    const x = CX + i * W * 0.3;
    ctx.beginPath();
    ctx.moveTo(CX + i * 20, horizon);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Chaotic overlay
  if (chaos > 60) {
    ctx.fillStyle = `hsla(${(hue+180)%360}, 100%, 50%, ${(chaos-60)/300})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Danmaku bullets when chaos high
  if (chaos > 40) {
    const num = Math.floor((chaos - 40) / 5);
    for (let i = 0; i < num; i++) {
      const x = ((t * 0.1 + i * 137) % W);
      const y = ((t * 0.08 + i * 91) % H);
      ctx.fillStyle = `hsla(${(i*40 + t*0.1)%360}, 100%, 60%, 0.6)`;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2); ctx.fill();
    }
  }
}

// ===== RENDER NOTES =====
function drawNotes() {
  // Hit zone line
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.78);
  ctx.lineTo(W, H * 0.78);
  ctx.stroke();

  for (const n of notes) {
    if (n.state !== 'falling') continue;
    ctx.save();
    ctx.translate(n.x, n.y);
    const color = n.type === 'tap' ? '#39ff14' :
                  n.type === 'hold' ? '#ffd93d' :
                  n.type === 'spam' ? '#ff2d95' :
                  '#00e5ff';
    ctx.strokeStyle = color;
    ctx.fillStyle = color + '40';
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;

    if (n.type === 'tap') {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('TAP', 0, 0);
    } else if (n.type === 'hold') {
      const holdR = 25 + (n.holdProgress || 0) * 15;
      ctx.beginPath(); ctx.arc(0, 0, holdR, 0, Math.PI*2); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('HOLD', 0, 0);
    } else if (n.type === 'spam') {
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${n.spamCount}/${n.spamNeeded}`, 0, 0);
    } else {
      // Swipe arrow
      const dir = n.type.replace('swipe_', '');
      const arrow = dir === 'left' ? '←' : dir === 'right' ? '→' : dir === 'up' ? '↑' : '↓';
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Impact';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(arrow, 0, 1);
    }
    ctx.restore();
  }
}

// ===== UPDATE =====
let lastTime = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastTime) / 1000, 0.05);
  lastTime = t;
  if (state === 'PLAYING') update(dt, t);
  render(t);
}

function update(dt, t) {
  songTime += dt;
  beatT += dt;
  if (beatT >= BEAT_INTERVAL) {
    beatT -= BEAT_INTERVAL;
    beat++;
    // Spawn notes every 2-4 beats
    if (beat >= nextSpawnBeat) {
      const num = 1 + Math.floor(Math.random() * (chaos > 50 ? 2 : 1));
      for (let i = 0; i < num; i++) spawnNote();
      nextSpawnBeat = beat + 2 + Math.floor(Math.random() * 3);
    }
  }

  // Update notes
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    n.y += n.speed * dt;
    // Miss if passed hit zone
    if (n.y > n.hitY + 80) {
      n.state = 'missed';
      missNote(n);
    }
  }
  notes = notes.filter(n => n.state !== 'missed' && n.state !== 'hit' || (n.y < H + 100));
  // Cleanup
  notes = notes.filter(n => n.state === 'falling' || n.y < H + 50);

  // Update character action timer
  character.actionT += dt;
  if (character.actionT > 2 && Math.random() < 0.02) character.action = 'idle';

  // Boss spawn
  if (!bossActive && songTime > bossAppearAt) {
    bossActive = true;
    document.getElementById('boss-tag').classList.remove('hidden');
    sfx('boss');
    chaos = Math.min(100, chaos + 20);
  }

  // Game over
  if (songTime >= songDuration) {
    endGame();
  }

  // HUD
  document.getElementById('score-val').textContent = score;
  document.getElementById('combo-val').textContent = combo;
  document.getElementById('chaos-val').textContent = Math.floor(chaos) + '%';

  // Capture replay frames during chaos peaks / miss moments
  if (replayCapturing && replayFrames.length < 600) {
    replayFrames.push({
      time: songTime,
      notes: notes.map(n => ({...n})),
      char: {
        action: character.action,
        actionT: character.actionT,
        bigHead: character.bigHead,
        longNeck: character.longNeck,
        eyesOut: character.eyesOut,
        spiralLimb: character.spiralLimb,
        invertColor: character.invertColor,
        ghostTrail: character.ghostTrail,
      },
      chaos, score, combo,
    });
  }
}

function render(t) {
  ctx.save();
  // Fisheye when chaos high
  if (chaos > 50) {
    const amt = (chaos - 50) / 200;
  }
  // Screen shake
  if (chaos > 30) {
    const s = (chaos - 30) / 30;
    ctx.translate((Math.random()-0.5)*s*6, (Math.random()-0.5)*s*6);
  }
  drawBackground(t);
  drawNotes();
  drawCharacter(character, t);
  ctx.restore();

  // Vignette
  const grd = ctx.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W,H)*0.7);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);
}

// ===== INPUT HANDLERS =====
let pointerDown = false, pointerStart = null;
canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  pointerDown = true;
  pointerStart = { x, y };
  onTap(x, y);
});
canvas.addEventListener('pointermove', e => {
  if (!pointerDown) return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  onDrag(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener('pointerup', e => {
  pointerDown = false;
  pointerStart = null;
  onRelease();
});

// Keyboard
document.addEventListener('keydown', e => {
  if (state !== 'PLAYING') return;
  const key = e.key.toLowerCase();
  // Map to note types
  if (key === ' ' || key === 'enter') onTap(CX, H*0.78);
  else if (key === 'a') { simulateSwipe('swipe_left'); }
  else if (key === 'd') { simulateSwipe('swipe_right'); }
  else if (key === 'w') { simulateSwipe('swipe_up'); }
  else if (key === 's') { simulateSwipe('swipe_down'); }
});
function simulateSwipe(dir) {
  for (const n of notes) {
    if (n.state !== 'falling') continue;
    if (Math.abs(n.y - n.hitY) < 80 && n.type === dir) {
      hitNote(n, 10); return;
    }
  }
}

// ===== START =====
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

function startGame() {
  initAudio();
  if (audioCtx.state !== 'running') audioCtx.resume().catch(()=>{});
  state = 'PLAYING';
  score = 0; combo = 0; maxCombo = 0; chaos = 0;
  beat = 0; beatT = 0; songTime = 0;
  notes = []; nextSpawnBeat = 4;
  bossActive = false;
  character = genCharacter();
  replayFrames = [];
  replayCapturing = true;
  // Start BGM
  bpm = 128 + Math.floor(Math.random() * 32);
  renderBGM(bpm);
  document.getElementById('start-screen').classList.add('hidden');
  document.getElementById('over-screen').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  document.getElementById('boss-tag').classList.add('hidden');
}

// ===== END =====
function endGame() {
  state = 'OVER';
  replayCapturing = false;
  if (musicNode) { try { musicNode.stop(); } catch(e){} musicNode = null; }
  document.getElementById('final-score').textContent = score;
  document.getElementById('final-combo').textContent = maxCombo;
  const rank = score > 3000 ? 'S+' : score > 2000 ? 'S' : score > 1000 ? 'A' : score > 500 ? 'B' : score > 200 ? 'C' : 'D';
  document.getElementById('final-rank').textContent = rank;
  // Challenge code from beat pattern
  const code = genChallengeCode();
  document.getElementById('challenge-code').textContent = code;
  // Leaderboard
  renderLeaderboard(score);
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('over-screen').classList.remove('hidden');
}

function genChallengeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

function renderLeaderboard(myScore) {
  const names = ['@dancing_broccoli','@wobble_wizard','@toilet_dancer','@eggplant_king','@chaos_queen'];
  const scores = names.map(() => 500 + Math.floor(Math.random() * 3500));
  scores.push(myScore);
  names.push('YOU');
  const rows = names.map((n,i) => ({name:n, score:scores[i]})).sort((a,b) => b.score - a.score);
  const list = document.getElementById('lb-list');
  list.innerHTML = '';
  rows.slice(0, 6).forEach((r, i) => {
    const el = document.createElement('div');
    el.className = 'lb-row' + (r.name === 'YOU' ? ' me' : '');
    el.innerHTML = `<span class="rank">${i+1}.</span><span>${r.name}</span><b>${r.score}</b>`;
    list.appendChild(el);
  });
}

// ===== REPLAY =====
document.getElementById('replay-btn').addEventListener('click', () => {
  document.getElementById('replay-overlay').classList.remove('hidden');
  playReplay();
});
document.getElementById('close-replay').addEventListener('click', () => {
  document.getElementById('replay-overlay').classList.add('hidden');
});

function playReplay() {
  const rc = document.getElementById('replay-canvas');
  const rctx = rc.getContext('2d');
  rc.width = 360; rc.height = 640;
  let frameIdx = 0;
  function drawReplayFrame() {
    if (frameIdx >= replayFrames.length) {
      frameIdx = 0;
    }
    const f = replayFrames[frameIdx];
    if (!f) { frameIdx++; requestAnimationFrame(drawReplayFrame); return; }
    // Simplified replay render
    rctx.fillStyle = '#000';
    rctx.fillRect(0, 0, 360, 640);
    rctx.fillStyle = '#39ff14';
    rctx.font = 'bold 14px monospace';
    rctx.fillText(`SCORE: ${f.score}`, 10, 20);
    rctx.fillText(`COMBO: ${f.combo}`, 10, 40);
    rctx.fillText(`CHAOS: ${Math.floor(f.chaos)}%`, 10, 60);
    // Draw a stick figure
    rctx.strokeStyle = `hsl(${(frameIdx*10)%360}, 80%, 60%)`;
    rctx.lineWidth = 4;
    rctx.beginPath();
    rctx.arc(180, 200 + Math.sin(frameIdx*0.2)*10, 40, 0, Math.PI*2);
    rctx.moveTo(180, 240);
    rctx.lineTo(180, 380);
    rctx.moveTo(180, 280); rctx.lineTo(120 + Math.sin(frameIdx*0.3)*30, 320);
    rctx.moveTo(180, 280); rctx.lineTo(240 - Math.sin(frameIdx*0.3)*30, 320);
    rctx.moveTo(180, 380); rctx.lineTo(140, 480);
    rctx.moveTo(180, 380); rctx.lineTo(220, 480);
    rctx.stroke();
    rctx.fillStyle = '#ff2d95';
    rctx.font = 'bold 20px Impact';
    rctx.textAlign = 'center';
    rctx.fillText(f.char.action.replace('_',' ').toUpperCase(), 180, 550);
    frameIdx++;
    requestAnimationFrame(drawReplayFrame);
  }
  drawReplayFrame();
}

// ===== SHARE =====
document.getElementById('share-btn').addEventListener('click', () => {
  const code = document.getElementById('challenge-code').textContent;
  document.getElementById('share-code').textContent = code;
  document.getElementById('share-toast').classList.remove('hidden');
});
document.getElementById('toast-close').addEventListener('click', () => {
  document.getElementById('share-toast').classList.add('hidden');
});

requestAnimationFrame(t => { lastTime = t; loop(t); });
