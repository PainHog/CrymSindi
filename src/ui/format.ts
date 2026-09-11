// Small formatting/display helpers shared across UI components.

// Suffixes for abbreviated large numbers. Idle economies scale hard (the
// contract payout grows at 1.12^level and prestige stacks multipliers), so
// values reach millions/billions and beyond — abbreviate them so they never
// overflow the UI.
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Below this, show the exact value with thousands separators. */
const ABBREVIATE_AT = 100_000;

function pickDecimals(scaled: number): number {
  return scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
}

/** Abbreviate a non-negative integer to e.g. "1.24M", "600K", "2.76B". */
function abbreviate(v: number): string {
  let tier = 0;
  let s = v;
  while (s >= 1000 && tier < UNITS.length - 1) {
    s /= 1000;
    tier++;
  }
  let str = s.toFixed(pickDecimals(s));
  // A value like 999,999 scales to 999.999 and rounds to "1000" — roll it up.
  if (parseFloat(str) >= 1000 && tier < UNITS.length - 1) {
    s /= 1000;
    tier++;
    str = s.toFixed(pickDecimals(s));
  }
  if (str.includes('.')) str = str.replace(/\.?0+$/, ''); // 1.20 -> 1.2, 1.00 -> 1
  return str + UNITS[tier];
}

/** Format a raw number: exact with commas when small, abbreviated when large. */
export function formatNumber(n: number): string {
  const v = Math.round(n);
  const abs = Math.abs(v);
  const body = abs < ABBREVIATE_AT ? abs.toLocaleString('en-US') : abbreviate(abs);
  return (v < 0 ? '-' : '') + body;
}

/** Format a cash amount with a leading currency mark. */
export function formatCash(n: number): string {
  const v = Math.round(n);
  const body = formatNumber(Math.abs(v));
  return (v < 0 ? '-$' : '$') + body;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  // Show h:mm:ss for jobs an hour or longer, mm:ss otherwise.
  if (h > 0) return `${h}:${pad(m)}:${pad(rem)}`;
  return `${m}:${pad(rem)}`;
}

/** Countdown from milliseconds remaining, floored at 0. */
export function formatCountdown(msRemaining: number): string {
  return formatDuration(Math.ceil(Math.max(0, msRemaining) / 1000));
}

export function pct(fraction: number): string {
  return Math.round(fraction * 100) + '%';
}

/** Stable, readable crew label based on its position in the roster. */
export function crewLabel(index: number): string {
  return `Crew ${index + 1}`;
}
