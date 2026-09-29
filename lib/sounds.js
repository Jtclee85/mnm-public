let ctx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Short click for any button press
export function playClick() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.07);
  } catch {}
}

// Xylophone note helper — triangle fundamental + sine 3rd harmonic = bright bell-like attack
function xyloNote(c, freq, startTime) {
  const attack = 0.004;
  const decay = 0.45;

  [[freq, 'triangle', 0.38, decay], [freq * 3, 'sine', 0.14, 0.18]].forEach(
    ([f, type, peak, dur]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.connect(g);
      g.connect(c.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(f, startTime);
      g.gain.setValueAtTime(0, startTime);
      g.gain.linearRampToValueAtTime(peak, startTime + attack);
      g.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
      osc.start(startTime);
      osc.stop(startTime + dur + 0.01);
    }
  );
}

// 딩동댕 — three ascending xylophone notes (C5 → E5 → G5)
export function playCorrect() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => xyloNote(c, freq, now + i * 0.17));
  } catch {}
}

// Descending buzzer — sawtooth sweep with a square-wave accent
export function playWrong() {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.45);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.setValueAtTime(0.28, now + 0.38);
    gain.gain.linearRampToValueAtTime(0, now + 0.48);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch {}
}
