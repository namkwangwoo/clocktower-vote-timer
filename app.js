// === State ===
const state = {
  playerCount: 7,
  secPerPlayer: 3,
  totalTime: 21,
  // Timer phases: 'idle' | 'waiting' | 'countdown' | 'running' | 'paused' | 'finished'
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

// Easing: soft ease-in-out
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
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  // Draw clock face with blur effect
  const startAngle = -Math.PI / 2;

  // Save, draw clock elements, then apply blur overlay
  drawClockFace(cx, cy, radius);
  drawHand(cx, cy, radius, startAngle);
  drawCenterOrnament(cx, cy);

  // Blur overlay: semi-transparent dark layer to soften the background
  ctx.fillStyle = 'rgba(10, 10, 10, 0.55)';
  ctx.fillRect(0, 0, w, h);

  // Countdown number - bold, large, centered
  const secFraction = elapsed % 1;

  // Smooth fade: in -> hold -> out
  let alpha;
  if (secFraction < 0.12) {
    alpha = secFraction / 0.12;
  } else if (secFraction < 0.65) {
    alpha = 1;
  } else {
    alpha = 1 - (secFraction - 0.65) / 0.35;
  }
  alpha = Math.max(0, Math.min(1, alpha)) * 0.75;

  // Gentle breathe
  const breathe = 0.96 + Math.sin(secFraction * Math.PI) * 0.04;
  const fontSize = Math.round(Math.min(w, h) * 0.3 * breathe);

  ctx.save();
  ctx.font = `600 ${fontSize}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(220, 90, 70, ${alpha})`;
  ctx.shadowColor = `rgba(200, 60, 40, ${alpha * 0.5})`;
  ctx.shadowBlur = 50;
  ctx.fillText(state.countdownValue.toString(), cx, cy);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawStatic() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const startAngle = -Math.PI / 2;
  drawClockFace(cx, cy, radius);
  drawHand(cx, cy, radius, startAngle);
  drawCenterOrnament(cx, cy);

  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Tap to start', cx, cy + radius + 40);

  ctx.font = '300 13px -apple-system, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fillText(`${state.playerCount} players · ${state.totalTime.toFixed(1)}s`, cx, cy + radius + 62);
}

function drawFinished() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;

  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, w, h);

  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + Math.PI * 2;

  drawClockFace(cx, cy, radius);
  drawProgressArc(cx, cy, radius, startAngle, endAngle);
  drawParticles();
  drawHand(cx, cy, radius, startAngle);
  drawCenterOrnament(cx, cy);

  const timeY = cy + radius + 40;
  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Tap to return', cx, timeY);
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
// Spawn along the hand's length (not just at tip)
function spawnParticle() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;
  const angle = -Math.PI / 2 + state.progress * Math.PI * 2;

  // Random position along 30%-95% of hand length
  const handFraction = 0.3 + Math.random() * 0.65;
  const dist = radius * 0.95 * handFraction;
  const spreadAngle = angle + (Math.random() - 0.5) * 0.04; // slight angular spread

  const px = cx + Math.cos(spreadAngle) * dist;
  const py = cy + Math.sin(spreadAngle) * dist;

  // Drift perpendicular to hand direction (outward slightly)
  const perpAngle = angle + Math.PI / 2;
  const drift = (Math.random() - 0.5) * 0.6;

  state.particles.push({
    x: px + (Math.random() - 0.5) * 4,
    y: py + (Math.random() - 0.5) * 4,
    vx: Math.cos(perpAngle) * drift + (Math.random() - 0.5) * 0.2,
    vy: Math.sin(perpAngle) * drift + (Math.random() - 0.5) * 0.2,
    life: 1,
    decay: 0.015 + Math.random() * 0.025,
    size: 0.5 + Math.random() * 1.5, // slightly smaller for subtlety
  });

  // Cleanup
  if (state.particles.length > 120) {
    state.particles = state.particles.filter((p) => p.life > 0.1);
  }
}

// === Drawing ===
function draw() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.38;

  ctx.fillStyle = '#0a0a0a';
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
  ctx.strokeStyle = 'rgba(120, 45, 40, 0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(100, 38, 35, 0.45)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(70, 30, 28, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tick marks for each player
  for (let i = 0; i < state.playerCount; i++) {
    const angle = -Math.PI / 2 + (i / state.playerCount) * Math.PI * 2;
    const innerR = radius - 14;
    const outerR = radius + 1;

    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle) * innerR,
      cy + Math.sin(angle) * innerR
    );
    ctx.lineTo(
      cx + Math.cos(angle) * outerR,
      cy + Math.sin(angle) * outerR
    );
    ctx.strokeStyle = 'rgba(140, 55, 50, 0.75)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Soft dot
    ctx.beginPath();
    ctx.arc(
      cx + Math.cos(angle) * (outerR + 2),
      cy + Math.sin(angle) * (outerR + 2),
      1.5, 0, Math.PI * 2
    );
    ctx.fillStyle = 'rgba(150, 55, 50, 0.6)';
    ctx.fill();
  }

  // Minor ticks
  const totalMinorTicks = state.playerCount * 4;
  for (let i = 0; i < totalMinorTicks; i++) {
    if (i % 4 === 0) continue;
    const angle = -Math.PI / 2 + (i / totalMinorTicks) * Math.PI * 2;
    const innerR = radius - 5;
    const outerR = radius - 1;

    ctx.beginPath();
    ctx.moveTo(
      cx + Math.cos(angle) * innerR,
      cy + Math.sin(angle) * innerR
    );
    ctx.lineTo(
      cx + Math.cos(angle) * outerR,
      cy + Math.sin(angle) * outerR
    );
    ctx.strokeStyle = 'rgba(80, 35, 30, 0.5)';
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
  grad.addColorStop(0, 'rgba(192, 57, 43, 0.25)');
  grad.addColorStop(arcProgress * 0.5, 'rgba(211, 84, 0, 0.2)');
  grad.addColorStop(Math.min(arcProgress, 0.999), 'rgba(243, 156, 18, 0.15)');
  grad.addColorStop(Math.min(arcProgress + 0.001, 1), 'transparent');
  if (arcProgress + 0.001 < 1) {
    grad.addColorStop(1, 'transparent');
  }

  ctx.fillStyle = grad;
  ctx.fill();
  ctx.restore();

  // Leading edge glow
  const glowX = cx + Math.cos(currentAngle) * radius * 0.6;
  const glowY = cy + Math.sin(currentAngle) * radius * 0.6;
  const glowGrad = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, radius * 0.4);
  glowGrad.addColorStop(0, 'rgba(231, 76, 60, 0.08)');
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
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) continue;

    const a = p.life * 0.3; // subtler alpha
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220, 85, 60, ${a})`;
    ctx.fill();
  }
}

// === Clock Hand - smooth bezier curves ===
function drawHand(cx, cy, radius, angle) {
  const len = radius * 0.95;
  const tail = radius * 0.18;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle + Math.PI / 2);

  // --- Soft ambient glow behind hand ---
  ctx.shadowColor = 'rgba(180, 50, 40, 0.4)';
  ctx.shadowBlur = 20;

  // --- Main hand body: smooth tapered shape with bezier curves ---
  const halfBase = 4;
  const halfMid = 2.8;
  const halfNarrow = 1.2;

  ctx.beginPath();
  ctx.moveTo(-halfBase, tail);
  // Left edge: smooth taper using quadratic curves
  ctx.quadraticCurveTo(-halfBase, tail * 0.3, -halfMid, -len * 0.25);
  ctx.quadraticCurveTo(-halfMid * 0.9, -len * 0.45, -halfNarrow, -len * 0.7);
  ctx.quadraticCurveTo(-halfNarrow * 0.5, -len * 0.9, 0, -len);
  // Right edge: mirror
  ctx.quadraticCurveTo(halfNarrow * 0.5, -len * 0.9, halfNarrow, -len * 0.7);
  ctx.quadraticCurveTo(halfMid * 0.9, -len * 0.45, halfMid, -len * 0.25);
  ctx.quadraticCurveTo(halfBase, tail * 0.3, halfBase, tail);
  ctx.closePath();

  // Multi-layer gradient for depth
  const bodyGrad = ctx.createLinearGradient(0, tail, 0, -len);
  bodyGrad.addColorStop(0, '#4a1818');
  bodyGrad.addColorStop(0.15, '#6e2222');
  bodyGrad.addColorStop(0.4, '#a53030');
  bodyGrad.addColorStop(0.7, '#c84040');
  bodyGrad.addColorStop(0.9, '#dd5050');
  bodyGrad.addColorStop(1, '#e85a5a');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Subtle highlight stripe (center reflection)
  ctx.beginPath();
  ctx.moveTo(-0.8, tail * 0.5);
  ctx.quadraticCurveTo(-0.5, -len * 0.4, 0, -len * 0.95);
  ctx.quadraticCurveTo(0.5, -len * 0.4, 0.8, tail * 0.5);
  ctx.closePath();
  const highlightGrad = ctx.createLinearGradient(0, tail, 0, -len);
  highlightGrad.addColorStop(0, 'rgba(255, 180, 150, 0.0)');
  highlightGrad.addColorStop(0.3, 'rgba(255, 180, 150, 0.08)');
  highlightGrad.addColorStop(0.7, 'rgba(255, 200, 180, 0.12)');
  highlightGrad.addColorStop(1, 'rgba(255, 220, 200, 0.06)');
  ctx.fillStyle = highlightGrad;
  ctx.fill();

  // Soft gold edge (very subtle)
  ctx.strokeStyle = 'rgba(212, 170, 80, 0.12)';
  ctx.lineWidth = 0.8;
  ctx.lineJoin = 'round';
  // Re-trace the body shape for the edge
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

  // --- Decorative details: soft diamond shapes blended into the hand ---

  // Diamond 1 (lower, bigger)
  const d1y = -len * 0.33;
  const d1h = 14;
  const d1w = 4.5;
  ctx.beginPath();
  ctx.moveTo(0, d1y - d1h);
  ctx.quadraticCurveTo(d1w * 0.6, d1y - d1h * 0.3, d1w, d1y);
  ctx.quadraticCurveTo(d1w * 0.6, d1y + d1h * 0.3, 0, d1y + d1h);
  ctx.quadraticCurveTo(-d1w * 0.6, d1y + d1h * 0.3, -d1w, d1y);
  ctx.quadraticCurveTo(-d1w * 0.6, d1y - d1h * 0.3, 0, d1y - d1h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(160, 45, 35, 0.35)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 170, 80, 0.18)';
  ctx.lineWidth = 0.6;
  ctx.stroke();

  // Diamond 2 (upper, smaller)
  const d2y = -len * 0.58;
  const d2h = 9;
  const d2w = 3;
  ctx.beginPath();
  ctx.moveTo(0, d2y - d2h);
  ctx.quadraticCurveTo(d2w * 0.6, d2y - d2h * 0.3, d2w, d2y);
  ctx.quadraticCurveTo(d2w * 0.6, d2y + d2h * 0.3, 0, d2y + d2h);
  ctx.quadraticCurveTo(-d2w * 0.6, d2y + d2h * 0.3, -d2w, d2y);
  ctx.quadraticCurveTo(-d2w * 0.6, d2y - d2h * 0.3, 0, d2y - d2h);
  ctx.closePath();
  ctx.fillStyle = 'rgba(160, 45, 35, 0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 170, 80, 0.12)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // --- Tip: soft pointed end (no harsh arrow) ---
  ctx.beginPath();
  ctx.moveTo(0, -len - 6);
  ctx.quadraticCurveTo(-3, -len + 2, -1.5, -len + 1);
  ctx.lineTo(0, -len);
  ctx.lineTo(1.5, -len + 1);
  ctx.quadraticCurveTo(3, -len + 2, 0, -len - 6);
  ctx.closePath();
  ctx.fillStyle = '#e85a5a';
  ctx.fill();

  // --- Tail counterweight: smooth rounded shape ---
  ctx.beginPath();
  ctx.moveTo(-5, tail);
  ctx.quadraticCurveTo(-4, tail + 10, -1.5, tail + 14);
  ctx.quadraticCurveTo(0, tail + 15, 1.5, tail + 14);
  ctx.quadraticCurveTo(4, tail + 10, 5, tail);
  ctx.closePath();
  const tailGrad = ctx.createLinearGradient(0, tail, 0, tail + 15);
  tailGrad.addColorStop(0, '#3a1212');
  tailGrad.addColorStop(1, '#2a0e0e');
  ctx.fillStyle = tailGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 170, 80, 0.1)';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  ctx.restore();
}

function drawCenterOrnament(cx, cy) {
  // Outer ring with soft gradient
  const outerGrad = ctx.createRadialGradient(cx, cy, 8, cx, cy, 14);
  outerGrad.addColorStop(0, 'rgba(50, 30, 15, 0.9)');
  outerGrad.addColorStop(1, 'rgba(30, 15, 8, 0.6)');
  ctx.beginPath();
  ctx.arc(cx, cy, 13, 0, Math.PI * 2);
  ctx.fillStyle = outerGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(212, 170, 80, 0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Inner jewel
  const innerGrad = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, 7);
  innerGrad.addColorStop(0, '#d04535');
  innerGrad.addColorStop(0.6, '#a02a20');
  innerGrad.addColorStop(1, '#601515');
  ctx.beginPath();
  ctx.arc(cx, cy, 7, 0, Math.PI * 2);
  ctx.fillStyle = innerGrad;
  ctx.fill();

  // Specular highlight
  ctx.beginPath();
  ctx.arc(cx - 2, cy - 2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();
}

function drawTimeText(cx, cy, radius) {
  // Only show text in finished state
  if (state.phase !== 'finished') return;

  const timeY = cy + radius + 40;
  ctx.font = '300 16px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('Tap to return', cx, timeY);
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
