// === Color Palette: Clocktower Ember ===
// Gothic clocktower at midnight - warm amber glow against deep dark
const palette = {
  name: 'clocktower',
  bg: '#08060a',              // deep midnight with slight purple
  ring: [185, 120, 55],       // aged bronze rings
  tick: [200, 140, 65],       // warm bronze ticks
  handBase: '#3a2008',
  handMid: '#c07828',
  handTip: '#eca040',
  highlight: [255, 210, 150],
  accent: [220, 145, 45],     // warm amber glow
  accentGlow: [210, 130, 35],
  gold: [225, 190, 100],      // antique gold
  center: [195, 110, 35],
  countdown: [235, 160, 55],
};

// Helper: rgb array to css string
function rgb(arr, alpha = 1) {
  return `rgba(${arr[0]}, ${arr[1]}, ${arr[2]}, ${alpha})`;
}

// === State ===
const state = {
  playerCount: 7,
  secPerPlayer: 3,
  totalTime: 21,
  phase: 'idle',
  startTime: 0,
  pausedAt: 0,
  pausedTotal: 0,
  countdownStart: 0,
  countdownValue: 3,
  progress: 0,
  particles: [],
  animFrame: null,
};

// Easing
const EASE_ZONE = 0.06;
function easeProgress(t) {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  if (t < EASE_ZONE) {
    const n = t / EASE_ZONE;
    return EASE_ZONE * (n * n) * 0.5;
  }
  if (t > 1 - EASE_ZONE) {
    const n = (1 - t) / EASE_ZONE;
    return 1 - EASE_ZONE * (n * n) * 0.5;
  }
  const linearStart = EASE_ZONE * 0.5;
  const linearEnd = 1 - EASE_ZONE * 0.5;
  const linearRange = linearEnd - linearStart;
  const tRange = 1 - 2 * EASE_ZONE;
  return linearStart + ((t - EASE_ZONE) / tRange) * linearRange;
}

// === DOM ===
const $ = (id) => document.getElementById(id);
const setupScreen = $('setup-screen');
const timerScreen = $('timer-screen');
const canvas = $('timer-canvas');
const ctx = canvas.getContext('2d');
const overlay = $('timer-overlay');
const overlayText = $('overlay-text');

const playerInput = $('player-count');
const secInput = $('seconds-per-player');
const totalTimeEl = $('total-time');
const startBtn = $('start-btn');

// === Setup Screen Logic ===
function updateTotal() {
  state.playerCount = Math.max(2, Math.min(20, parseInt(playerInput.value) || 2));
  state.secPerPlayer = Math.max(0.5, Math.min(30, parseFloat(secInput.value) || 0.5));
  state.totalTime = state.playerCount * state.secPerPlayer;
  totalTimeEl.textContent = state.totalTime.toFixed(1);
}

playerInput.addEventListener('input', updateTotal);
secInput.addEventListener('input', updateTotal);

$('player-minus').addEventListener('click', () => {
  playerInput.value = Math.max(2, (parseInt(playerInput.value) || 2) - 1);
  updateTotal();
});
$('player-plus').addEventListener('click', () => {
  playerInput.value = Math.min(20, (parseInt(playerInput.value) || 2) + 1);
  updateTotal();
});
$('sec-minus').addEventListener('click', () => {
  secInput.value = Math.max(0.5, (parseFloat(secInput.value) || 0.5) - 0.5).toFixed(1);
  updateTotal();
});
$('sec-plus').addEventListener('click', () => {
  secInput.value = Math.min(30, (parseFloat(secInput.value) || 0.5) + 0.5).toFixed(1);
  updateTotal();
});

// === Start ===
startBtn.addEventListener('click', () => {
  updateTotal();
  switchToTimer();
});

function switchToTimer() {
  setupScreen.classList.remove('active');
  timerScreen.classList.add('active');
  resizeCanvas();
  enterWaiting();
}

function switchToSetup() {
  stopTimer();
  timerScreen.classList.remove('active');
  setupScreen.classList.add('active');
}

// === Canvas Resize ===
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', () => {
  if (timerScreen.classList.contains('active')) {
    resizeCanvas();
    if (state.phase === 'waiting') drawStatic();
    if (state.phase === 'paused') draw();
    if (state.phase === 'finished') drawFinished();
  }
});

// === Timer Phases ===

function enterWaiting() {
  state.phase = 'waiting';
  state.progress = 0;
  state.pausedTotal = 0;
  state.particles = [];
  overlay.classList.add('hidden');
  drawStatic();
}

function enterCountdown() {
  state.phase = 'countdown';
  state.countdownStart = performance.now();
  state.countdownValue = 3;
  overlay.classList.add('hidden');
  animateCountdown();
}

function enterRunning() {
  state.phase = 'running';
  state.progress = 0;
  state.pausedTotal = 0;
  state.startTime = performance.now();
  overlay.classList.add('hidden');
  requestWakeLock();
  animate();
}

function stopTimer() {
  state.phase = 'idle';
  if (state.animFrame) {
    cancelAnimationFrame(state.animFrame);
    state.animFrame = null;
  }
}

// === Tap Handler ===
function handleTap() {
  switch (state.phase) {
    case 'waiting':
      enterCountdown();
      break;
    case 'countdown':
      break;
    case 'running':
      state.phase = 'paused';
      state.pausedAt = performance.now();
      if (state.animFrame) {
        cancelAnimationFrame(state.animFrame);
        state.animFrame = null;
      }
      overlayText.textContent = 'PAUSED';
      overlay.classList.remove('hidden');
      break;
    case 'paused':
      state.pausedTotal += performance.now() - state.pausedAt;
      state.phase = 'running';
      overlay.classList.add('hidden');
      animate();
      break;
    case 'finished':
      switchToSetup();
      break;
  }
}

timerScreen.addEventListener('click', handleTap);

// === Layout ===
function getLayout() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  // Much bigger circle: 46% of the smaller dimension
  const radius = Math.min(w, h) * 0.46;
  return { w, h, cx, cy, radius };
}

// === Countdown Animation ===
function animateCountdown() {
  if (state.phase !== 'countdown') return;

  const elapsed = (performance.now() - state.countdownStart) / 1000;
  const remaining = 3 - elapsed;

  if (remaining <= 0) {
    enterRunning();
    return;
  }

  state.countdownValue = Math.ceil(remaining);
  drawCountdown(elapsed);
  state.animFrame = requestAnimationFrame(animateCountdown);
}

function drawCountdown(elapsed) {
  const { w, h, cx, cy, radius } = getLayout();

  drawBackground(w, h);

  const startAngle = -Math.PI / 2;
  drawClockFace(cx, cy, radius);
  drawHand(cx, cy, radius, startAngle);
  drawCenterOrnament(cx, cy);

  // Blur overlay
  ctx.fillStyle = `rgba(10, 10, 10, 0.55)`;
  ctx.fillRect(0, 0, w, h);

  // Countdown number
  const secFraction = elapsed % 1;

  let alpha;
  if (secFraction < 0.12) {
    alpha = secFraction / 0.12;
  } else if (secFraction < 0.65) {
    alpha = 1;
  } else {
    alpha = 1 - (secFraction - 0.65) / 0.35;
  }
  alpha = Math.max(0, Math.min(1, alpha)) * 0.75;

  const breathe = 0.96 + Math.sin(secFraction * Math.PI) * 0.04;
  const fontSize = Math.round(Math.min(w, h) * 0.3 * breathe);

  ctx.save();
  ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgb(palette.countdown, alpha);
  ctx.shadowColor = rgb(palette.countdown, alpha * 0.5);
  ctx.shadowBlur = 50;
  ctx.fillText(state.countdownValue.toString(), cx, cy);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawStatic() {
  const { w, h, cx, cy, radius } = getLayout();

  drawBackground(w, h);

  const startAngle = -Math.PI / 2;
  drawClockFace(cx, cy, radius);
  drawHand(cx, cy, radius, startAngle);
  drawCenterOrnament(cx, cy);

  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Tap to start', cx, cy + radius + 30);

  ctx.font = '300 13px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText(`${state.playerCount} players · ${state.totalTime.toFixed(1)}s`, cx, cy + radius + 50);
}

function drawFinished() {
  const { w, h, cx, cy, radius } = getLayout();

  drawBackground(w, h);

  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2;

  drawClockFace(cx, cy, radius);
  drawProgressArc(cx, cy, radius, startAngle, endAngle);
  drawParticles();
  drawHand(cx, cy, radius, startAngle);
  drawCenterOrnament(cx, cy);

  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Tap to return', cx, cy + radius + 30);
}

// === Main Animation ===
function animate() {
  if (state.phase !== 'running') return;

  const now = performance.now();
  const elapsed = (now - state.startTime - state.pausedTotal) / 1000;
  const linearProgress = Math.min(1, elapsed / state.totalTime);
  state.progress = easeProgress(linearProgress);

  // Spawn multiple particles per frame for density
  const spawnCount = 1 + Math.floor(Math.random() * 3); // 1-3 per frame
  for (let i = 0; i < spawnCount; i++) {
    spawnParticle();
  }

  draw();

  if (linearProgress >= 1) {
    state.progress = 1;
    state.phase = 'finished';
    drawFinished();
    overlayText.textContent = '';
    setTimeout(() => {
      overlay.classList.remove('hidden');
    }, 500);
    return;
  }

  state.animFrame = requestAnimationFrame(animate);
}

// === Particles ===
function spawnParticle() {
  const { cx, cy, radius } = getLayout();
  const angle = -Math.PI / 2 + state.progress * Math.PI * 2;

  // Spawn along 20%-100% of hand
  const handFraction = 0.2 + Math.random() * 0.8;
  const dist = radius * 0.95 * handFraction;
  const spreadAngle = angle + (Math.random() - 0.5) * 0.06;

  const px = cx + Math.cos(spreadAngle) * dist;
  const py = cy + Math.sin(spreadAngle) * dist;

  const perpAngle = angle + Math.PI / 2;
  const drift = (Math.random() - 0.5) * 0.8;

  // Varied types: tiny sparks, medium embers, rare large cinders
  const roll = Math.random();
  let size, decay, alpha;
  if (roll < 0.5) {
    // Tiny sparks (most common)
    size = 0.3 + Math.random() * 0.7;
    decay = 0.025 + Math.random() * 0.04;
    alpha = 0.5;
  } else if (roll < 0.85) {
    // Medium embers
    size = 0.8 + Math.random() * 1.5;
    decay = 0.012 + Math.random() * 0.02;
    alpha = 0.45;
  } else {
    // Large cinders (rare, slow, long-lived)
    size = 1.8 + Math.random() * 2.5;
    decay = 0.006 + Math.random() * 0.01;
    alpha = 0.3;
  }

  // Color variety: gold, orange, warm white
  const colorRoll = Math.random();
  let color;
  if (colorRoll < 0.4) {
    color = [255, 200, 80];   // bright gold
  } else if (colorRoll < 0.7) {
    color = [255, 150, 50];   // orange
  } else if (colorRoll < 0.9) {
    color = [255, 120, 40];   // deep orange
  } else {
    color = [255, 230, 180];  // warm white (hot spark)
  }

  state.particles.push({
    x: px + (Math.random() - 0.5) * 6,
    y: py + (Math.random() - 0.5) * 6,
    vx: Math.cos(perpAngle) * drift * 0.3 + (Math.random() - 0.5) * 0.1,
    vy: Math.sin(perpAngle) * drift * 0.3 + (Math.random() - 0.5) * 0.1,
    life: 1,
    decay, size, alpha, color,
  });

  if (state.particles.length > 150) {
    state.particles = state.particles.filter((p) => p.life > 0.05);
  }
}

// === Background atmosphere ===

// Layer 1: Slow floating dust (large, very faint, background depth)
const dustFar = [];
for (let i = 0; i < 20; i++) {
  dustFar.push({
    x: Math.random(), y: Math.random(),
    size: 2 + Math.random() * 4,
    speed: 0.00003 + Math.random() * 0.00008,
    drift: (Math.random() - 0.5) * 0.00008,
    alpha: 0.015 + Math.random() * 0.02,
    phase: Math.random() * Math.PI * 2,
  });
}

// Layer 2: Mid dust (medium, warm tones)
const dustMid = [];
for (let i = 0; i < 35; i++) {
  dustMid.push({
    x: Math.random(), y: Math.random(),
    size: 0.8 + Math.random() * 1.8,
    speed: 0.0001 + Math.random() * 0.00025,
    drift: (Math.random() - 0.5) * 0.00015,
    alpha: 0.03 + Math.random() * 0.05,
    phase: Math.random() * Math.PI * 2,
  });
}

// Layer 3: Close sparks (tiny, bright, fast)
const dustNear = [];
for (let i = 0; i < 15; i++) {
  dustNear.push({
    x: Math.random(), y: Math.random(),
    size: 0.3 + Math.random() * 0.8,
    speed: 0.0002 + Math.random() * 0.0005,
    drift: (Math.random() - 0.5) * 0.0003,
    alpha: 0.08 + Math.random() * 0.12,
    phase: Math.random() * Math.PI * 2,
  });
}

function updateDust(mote) {
  const now = performance.now() * 0.001;
  mote.y -= mote.speed;
  mote.x += mote.drift + Math.sin(now * 0.7 + mote.phase) * 0.00008;
  if (mote.y < -0.03) { mote.y = 1.03; mote.x = Math.random(); }
  if (mote.x < -0.03) mote.x = 1.03;
  if (mote.x > 1.03) mote.x = -0.03;
}

function drawBackground(w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const now = performance.now() * 0.001;

  // Base
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  // Main warm glow from center (torch/hearth)
  const glowR = Math.max(w, h) * 0.7;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  glow.addColorStop(0, 'rgba(65, 40, 15, 0.4)');
  glow.addColorStop(0.2, 'rgba(50, 30, 12, 0.25)');
  glow.addColorStop(0.45, 'rgba(35, 20, 8, 0.12)');
  glow.addColorStop(0.7, 'rgba(15, 8, 4, 0.05)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Breathing secondary glow (slowly wanders)
  const spot2x = cx + Math.sin(now * 0.12) * 50;
  const spot2y = cy - 30 + Math.cos(now * 0.08) * 40;
  const breathe = 0.08 + Math.sin(now * 0.3) * 0.03;
  const glow2 = ctx.createRadialGradient(spot2x, spot2y, 0, spot2x, spot2y, glowR * 0.5);
  glow2.addColorStop(0, `rgba(70, 40, 15, ${breathe})`);
  glow2.addColorStop(1, 'transparent');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, w, h);

  // Third glow (lower, like reflected firelight)
  const spot3x = cx + Math.cos(now * 0.1) * 40;
  const spot3y = cy + glowR * 0.3 + Math.sin(now * 0.15) * 20;
  const glow3 = ctx.createRadialGradient(spot3x, spot3y, 0, spot3x, spot3y, glowR * 0.35);
  glow3.addColorStop(0, 'rgba(50, 25, 10, 0.06)');
  glow3.addColorStop(1, 'transparent');
  ctx.fillStyle = glow3;
  ctx.fillRect(0, 0, w, h);

  // Layer 1: Far dust (big, blurry, slow)
  for (const d of dustFar) {
    updateDust(d);
    const px = d.x * w;
    const py = d.y * h;
    const flicker = 0.6 + Math.sin(now * 0.5 + d.phase) * 0.4;

    const g = ctx.createRadialGradient(px, py, 0, px, py, d.size);
    g.addColorStop(0, `rgba(180, 130, 70, ${d.alpha * flicker})`);
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(px - d.size, py - d.size, d.size * 2, d.size * 2);
  }

  // Layer 2: Mid dust
  for (const d of dustMid) {
    updateDust(d);
    const px = d.x * w;
    const py = d.y * h;
    const flicker = 0.7 + Math.sin(now * 1.5 + d.phase) * 0.3;

    ctx.beginPath();
    ctx.arc(px, py, d.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(210, 155, 85, ${d.alpha * flicker})`;
    ctx.fill();
  }

  // Layer 3: Near sparks (tiny, bright)
  for (const d of dustNear) {
    updateDust(d);
    const px = d.x * w;
    const py = d.y * h;
    const flicker = 0.5 + Math.sin(now * 3 + d.phase) * 0.5;

    ctx.beginPath();
    ctx.arc(px, py, d.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(240, 190, 100, ${d.alpha * flicker})`;
    ctx.fill();
  }

  // Vignette
  const vig = ctx.createRadialGradient(cx, cy, glowR * 0.35, cx, cy, glowR);
  vig.addColorStop(0, 'transparent');
  vig.addColorStop(0.6, 'rgba(0, 0, 0, 0.12)');
  vig.addColorStop(0.85, 'rgba(0, 0, 0, 0.35)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

// === Drawing ===
function draw() {
  const { w, h, cx, cy, radius } = getLayout();

  drawBackground(w, h);

  const startAngle = -Math.PI / 2;
  const currentAngle = startAngle + state.progress * Math.PI * 2;

  drawClockFace(cx, cy, radius);
  drawProgressArc(cx, cy, radius, startAngle, currentAngle);
  drawParticles();          // particles behind hand
  drawHand(cx, cy, radius, currentAngle);  // hand on top
  drawCenterOrnament(cx, cy);
  drawTimeText(cx, cy, radius);
}

function drawClockFace(cx, cy, radius) {
  // Outer rings
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
  ctx.strokeStyle = rgb(palette.ring, 0.6);
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = rgb(palette.ring, 0.35);
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
  ctx.strokeStyle = rgb(palette.ring, 0.25);
  ctx.lineWidth = 1;
  ctx.stroke();

  // Player ticks
  for (let i = 0; i < state.playerCount; i++) {
    const angle = -Math.PI / 2 + (i / state.playerCount) * Math.PI * 2;
    const innerR = radius - 14;
    const outerR = radius + 1;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerR, cy + Math.sin(angle) * innerR);
    ctx.lineTo(cx + Math.cos(angle) * outerR, cy + Math.sin(angle) * outerR);
    ctx.strokeStyle = rgb(palette.tick, 0.7);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx + Math.cos(angle) * (outerR + 2), cy + Math.sin(angle) * (outerR + 2), 1.5, 0, Math.PI * 2);
    ctx.fillStyle = rgb(palette.tick, 0.5);
    ctx.fill();
  }

  // Minor ticks
  const totalMinorTicks = state.playerCount * 4;
  for (let i = 0; i < totalMinorTicks; i++) {
    if (i % 4 === 0) continue;
    const angle = -Math.PI / 2 + (i / totalMinorTicks) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * (radius - 5), cy + Math.sin(angle) * (radius - 5));
    ctx.lineTo(cx + Math.cos(angle) * (radius - 1), cy + Math.sin(angle) * (radius - 1));
    ctx.strokeStyle = rgb(palette.tick, 0.3);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawProgressArc(cx, cy, radius, startAngle, currentAngle) {
  const arcSpan = currentAngle - startAngle;
  if (arcSpan <= 0.01) return;

  // Glowing arc stroke along the outer ring (not a filled wedge)
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, currentAngle, false);
  ctx.strokeStyle = rgb(palette.highlight, 0.7);
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Softer wider glow behind it
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, currentAngle, false);
  ctx.strokeStyle = rgb(palette.accent, 0.25);
  ctx.lineWidth = 14;
  ctx.stroke();

  ctx.lineCap = 'butt';
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy - (0.05 + p.size * 0.02); // gentle upward drift
    p.vx *= 0.99; // drag slows horizontal movement
    p.life -= p.decay;
    if (p.life <= 0) continue;

    const c = p.color;
    // Fade: color dims as life decreases
    const fade = p.life;
    const r = Math.round(c[0] * (0.4 + fade * 0.6));
    const g = Math.round(c[1] * fade * 0.8);
    const b = Math.round(c[2] * fade * 0.5);
    const a = p.alpha * fade;

    const sz = p.size * (0.3 + fade * 0.7);

    // Core
    ctx.beginPath();
    ctx.arc(p.x, p.y, sz, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    ctx.fill();

    // Glow halo for medium+ particles
    if (p.size > 0.7 && fade > 0.2) {
      const glowSize = sz * 3;
      const gg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowSize);
      gg.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a * 0.25})`);
      gg.addColorStop(1, 'transparent');
      ctx.fillStyle = gg;
      ctx.fillRect(p.x - glowSize, p.y - glowSize, glowSize * 2, glowSize * 2);
    }
  }
}

// === Clock Hand ===
function drawHand(cx, cy, radius, angle) {
  const len = radius * 0.95;
  const tail = radius * 0.18;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2);

  // No shadow - causes visible fill artifact on large hands

  const halfBase = 4;
  const halfMid = 2.8;
  const halfNarrow = 1.2;

  // Body shape
  ctx.beginPath();
  ctx.moveTo(-halfBase, tail);
  ctx.quadraticCurveTo(-halfBase, tail * 0.3, -halfMid, -len * 0.25);
  ctx.quadraticCurveTo(-halfMid * 0.9, -len * 0.45, -halfNarrow, -len * 0.7);
  ctx.quadraticCurveTo(-halfNarrow * 0.5, -len * 0.9, 0, -len);
  ctx.quadraticCurveTo(halfNarrow * 0.5, -len * 0.9, halfNarrow, -len * 0.7);
  ctx.quadraticCurveTo(halfMid * 0.9, -len * 0.45, halfMid, -len * 0.25);
  ctx.quadraticCurveTo(halfBase, tail * 0.3, halfBase, tail);
  ctx.closePath();

  const bodyGrad = ctx.createLinearGradient(0, tail, 0, -len);
  bodyGrad.addColorStop(0, palette.handBase);
  bodyGrad.addColorStop(0.2, palette.handMid);
  bodyGrad.addColorStop(0.6, palette.handMid);
  bodyGrad.addColorStop(0.85, palette.handTip);
  bodyGrad.addColorStop(1, palette.handTip);
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Highlight stripe
  ctx.beginPath();
  ctx.moveTo(-0.8, tail * 0.5);
  ctx.quadraticCurveTo(-0.5, -len * 0.4, 0, -len * 0.95);
  ctx.quadraticCurveTo(0.5, -len * 0.4, 0.8, tail * 0.5);
  ctx.closePath();
  const hl = palette.highlight;
  const hlGrad = ctx.createLinearGradient(0, tail, 0, -len);
  hlGrad.addColorStop(0, rgb(hl, 0));
  hlGrad.addColorStop(0.3, rgb(hl, 0.1));
  hlGrad.addColorStop(0.7, rgb(hl, 0.15));
  hlGrad.addColorStop(1, rgb(hl, 0.06));
  ctx.fillStyle = hlGrad;
  ctx.fill();

  // Soft gold edge
  ctx.strokeStyle = rgb(palette.gold, 0.15);
  ctx.lineWidth = 0.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-halfBase, tail);
  ctx.quadraticCurveTo(-halfBase, tail * 0.3, -halfMid, -len * 0.25);
  ctx.quadraticCurveTo(-halfMid * 0.9, -len * 0.45, -halfNarrow, -len * 0.7);
  ctx.quadraticCurveTo(-halfNarrow * 0.5, -len * 0.9, 0, -len);
  ctx.quadraticCurveTo(halfNarrow * 0.5, -len * 0.9, halfNarrow, -len * 0.7);
  ctx.quadraticCurveTo(halfMid * 0.9, -len * 0.45, halfMid, -len * 0.25);
  ctx.quadraticCurveTo(halfBase, tail * 0.3, halfBase, tail);
  ctx.closePath();
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Diamond 1
  const d1y = -len * 0.33;
  ctx.beginPath();
  ctx.moveTo(0, d1y - 14);
  ctx.quadraticCurveTo(2.7, d1y - 4, 4.5, d1y);
  ctx.quadraticCurveTo(2.7, d1y + 4, 0, d1y + 14);
  ctx.quadraticCurveTo(-2.7, d1y + 4, -4.5, d1y);
  ctx.quadraticCurveTo(-2.7, d1y - 4, 0, d1y - 14);
  ctx.closePath();
  ctx.fillStyle = rgb(palette.accent, 0.25);
  ctx.fill();
  ctx.strokeStyle = rgb(palette.gold, 0.2);
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Diamond 2
  const d2y = -len * 0.58;
  ctx.beginPath();
  ctx.moveTo(0, d2y - 9);
  ctx.quadraticCurveTo(1.8, d2y - 3, 3, d2y);
  ctx.quadraticCurveTo(1.8, d2y + 3, 0, d2y + 9);
  ctx.quadraticCurveTo(-1.8, d2y + 3, -3, d2y);
  ctx.quadraticCurveTo(-1.8, d2y - 3, 0, d2y - 9);
  ctx.closePath();
  ctx.fillStyle = rgb(palette.accent, 0.18);
  ctx.fill();
  ctx.strokeStyle = rgb(palette.gold, 0.14);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Tip - no separate arrow, the body bezier already tapers to a point at -len

  // Tail
  ctx.beginPath();
  ctx.moveTo(-5, tail);
  ctx.quadraticCurveTo(-4, tail + 10, -1.5, tail + 14);
  ctx.quadraticCurveTo(0, tail + 15, 1.5, tail + 14);
  ctx.quadraticCurveTo(4, tail + 10, 5, tail);
  ctx.closePath();
  const tailGrad = ctx.createLinearGradient(0, tail, 0, tail + 15);
  tailGrad.addColorStop(0, palette.handBase);
  tailGrad.addColorStop(1, palette.bg);
  ctx.fillStyle = tailGrad;
  ctx.fill();
  ctx.strokeStyle = rgb(palette.gold, 0.1);
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore();
}

function drawCenterOrnament(cx, cy) {
  const outerGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 14);
  outerGrad.addColorStop(0, rgb(palette.center, 0.3));
  outerGrad.addColorStop(1, rgb(palette.center, 0.1));
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fillStyle = outerGrad;
  ctx.fill();
  ctx.strokeStyle = rgb(palette.gold, 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const innerGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 7);
  innerGrad.addColorStop(0, rgb(palette.center, 0.9));
  innerGrad.addColorStop(1, rgb(palette.center, 0.4));
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
}

function drawTimeText(cx, cy, radius) {
  if (state.phase !== 'finished') return;

  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Tap to return', cx, cy + radius + 30);
}

// === Init ===
updateTotal();

document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      await navigator.wakeLock.request('screen');
    }
  } catch (e) {}
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
