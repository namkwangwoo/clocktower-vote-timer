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

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

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

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

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

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

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

  if (Math.random() < 0.4) {
    spawnParticle();
  }

  draw();

  if (linearProgress >= 1) {
    state.progress = 1;
    state.phase = 'finished';
    drawFinished();
    overlayText.textContent = 'DONE';
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

  const handFraction = 0.3 + Math.random() * 0.65;
  const dist = radius * 0.95 * handFraction;
  const spreadAngle = angle + (Math.random() - 0.5) * 0.04;

  const px = cx + Math.cos(spreadAngle) * dist;
  const py = cy + Math.sin(spreadAngle) * dist;

  const perpAngle = angle + Math.PI / 2;
  const drift = (Math.random() - 0.5) * 0.6;

  state.particles.push({
    x: px + (Math.random() - 0.5) * 4,
    y: py + (Math.random() - 0.5) * 4,
    vx: Math.cos(perpAngle) * drift + (Math.random() - 0.5) * 0.2,
    vy: Math.sin(perpAngle) * drift + (Math.random() - 0.5) * 0.2,
    life: 1,
    decay: 0.015 + Math.random() * 0.025,
    size: 0.5 + Math.random() * 1.5,
  });

  if (state.particles.length > 120) {
    state.particles = state.particles.filter((p) => p.life > 0.1);
  }
}

// === Drawing ===
function draw() {
  const { w, h, cx, cy, radius } = getLayout();

  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, w, h);

  const startAngle = -Math.PI / 2;
  const currentAngle = startAngle + state.progress * Math.PI * 2;

  drawClockFace(cx, cy, radius);
  drawProgressArc(cx, cy, radius, startAngle, currentAngle);
  drawParticles();
  drawHand(cx, cy, radius, currentAngle);
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
  if (arcSpan <= 0) return;
  const arcProgress = Math.min(1, arcSpan / (Math.PI * 2));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius - 3, startAngle, currentAngle, false);
  ctx.closePath();

  const grad = ctx.createConicGradient(startAngle, cx, cy);
  const a = palette.accent;
  grad.addColorStop(0, rgb(a, 0.28));
  grad.addColorStop(arcProgress * 0.5, rgb(a, 0.2));
  grad.addColorStop(Math.min(arcProgress, 0.999), rgb(a, 0.12));
  grad.addColorStop(Math.min(arcProgress + 0.001, 1), 'transparent');
  if (arcProgress + 0.001 < 1) grad.addColorStop(1, 'transparent');

  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Leading glow
  const glowX = cx + Math.cos(currentAngle) * radius * 0.6;
  const glowY = cy + Math.sin(currentAngle) * radius * 0.6;
  const glowGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, radius * 0.4);
  glowGrad.addColorStop(0, rgb(palette.accentGlow, 0.1));
  glowGrad.addColorStop(1, 'transparent');

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, radius, currentAngle - 0.3, currentAngle + 0.05, false);
  ctx.closePath();
  ctx.fillStyle = glowGrad;
  ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    p.x += p.vx;
    p.y += p.vy - 0.15; // slight upward drift like embers rising
    p.life -= p.decay;
    if (p.life <= 0) continue;

    const a = p.life * 0.35;
    // Warm ember color shift: bright yellow-orange when fresh, dim red as fading
    const r = Math.round(255 - (1 - p.life) * 60);
    const g = Math.round(180 * p.life + 40);
    const b = Math.round(30 * p.life);

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
    ctx.fill();
  }
}

// === Clock Hand ===
function drawHand(cx, cy, radius, angle) {
  const len = radius * 0.95;
  const tail = radius * 0.18;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2);

  ctx.shadowColor = rgb(palette.accentGlow, 0.5);
  ctx.shadowBlur = 20;

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

  // Tip
  ctx.beginPath();
  ctx.moveTo(0, -len - 6);
  ctx.quadraticCurveTo(-3, -len + 2, -1.5, -len + 1);
  ctx.lineTo(0, -len);
  ctx.lineTo(1.5, -len + 1);
  ctx.quadraticCurveTo(3, -len + 2, 0, -len - 6);
  ctx.closePath();
  ctx.fillStyle = palette.handTip;
  ctx.fill();

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
