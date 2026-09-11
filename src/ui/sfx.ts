// -----------------------------------------------------------------------------
// SOUND CUES
// -----------------------------------------------------------------------------
// Short cues synthesized with the Web Audio API — no asset files, so they stay
// inside the single-file build and carry no licensing baggage. Audio is created
// lazily on first use (browsers require a user gesture) and can be muted; the
// mute choice persists in localStorage.
// -----------------------------------------------------------------------------

export type SfxName =
  | 'launch'
  | 'success'
  | 'fail'
  | 'purchase'
  | 'ready'
  | 'prestige'
  | 'error';

const MUTE_KEY = 'heist-crew-idle/muted';

let ctx: AudioContext | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Create + resume the context. Only call this from a user gesture. */
function arm(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
    } catch {
      ctx = null;
      return;
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
}

// Arm audio on the first real user gesture, so a non-gesture cue (e.g. a
// ready-to-collect ping right after load) never spawns a suspended context or
// a "not allowed to start" console warning.
if (typeof window !== 'undefined') {
  const onGesture = () => arm();
  for (const ev of ['pointerdown', 'keydown', 'touchstart'] as const) {
    window.addEventListener(ev, onGesture, { once: true, passive: true });
  }
}

/** The context, or null if audio hasn't been armed by a gesture yet. */
function getCtx(): AudioContext | null {
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

interface ToneOpts {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  slideTo?: number;
}

function tone(c: AudioContext, o: ToneOpts): void {
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + o.dur);
  const peak = o.gain ?? 0.18;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g);
  g.connect(c.destination);
  osc.onended = () => {
    osc.disconnect();
    g.disconnect();
  };
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.03);
}

function arpeggio(c: AudioContext, freqs: number[], step: number, type: OscillatorType, gain: number): void {
  freqs.forEach((f, i) => tone(c, { freq: f, dur: step * 1.4, delay: i * step, type, gain }));
}

const CUES: Record<SfxName, (c: AudioContext) => void> = {
  launch: (c) => tone(c, { freq: 200, slideTo: 420, dur: 0.18, type: 'sawtooth', gain: 0.12 }),
  success: (c) => arpeggio(c, [523, 659, 784], 0.075, 'triangle', 0.16), // C-E-G
  fail: (c) => tone(c, { freq: 300, slideTo: 110, dur: 0.34, type: 'sawtooth', gain: 0.14 }),
  purchase: (c) => tone(c, { freq: 520, dur: 0.06, type: 'square', gain: 0.1 }),
  ready: (c) => {
    tone(c, { freq: 880, dur: 0.08, type: 'sine', gain: 0.13 });
    tone(c, { freq: 1320, dur: 0.1, delay: 0.05, type: 'sine', gain: 0.1 });
  },
  prestige: (c) => arpeggio(c, [392, 523, 659, 784], 0.1, 'triangle', 0.16), // G-C-E-G
  error: (c) => tone(c, { freq: 150, dur: 0.12, type: 'square', gain: 0.1 }),
};

/** Play a cue (no-op when muted or audio is unavailable). */
export function playSfx(name: SfxName): void {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  try {
    CUES[name]?.(c);
  } catch {
    /* ignore audio errors */
  }
}

export function isMuted(): boolean {
  return muted;
}

/** Set mute; persists the choice and warms up audio when unmuting. */
export function setMuted(next: boolean): void {
  muted = next;
  try {
    localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  } catch {
    /* storage may be blocked */
  }
  if (!next) arm(); // unmuting is a gesture — safe to create/resume here
}

export function toggleMuted(): boolean {
  setMuted(!muted);
  return muted;
}
