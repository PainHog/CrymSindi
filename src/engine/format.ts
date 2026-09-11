// -----------------------------------------------------------------------------
// NUMBER FORMATTING (pure; used by both the engine's message strings and the UI)
// -----------------------------------------------------------------------------
// Idle economies scale hard (contract payout grows 1.12^level, prestige stacks
// multipliers), so values reach millions -> trillions -> beyond. Show exact,
// comma-grouped values while they are small, and abbreviate above a threshold
// (600K, 1.24M, 2.76B, ...) so they never overflow the UI.
//
// `mode` controls rounding so an abbreviated figure never lies about
// affordability: use 'floor' for a balance you HAVE (never overstate it) and
// 'ceil' for a COST (never understate it). 'round' (default) is for neutral
// figures like payouts and estimates.
// -----------------------------------------------------------------------------

export type RoundMode = 'round' | 'floor' | 'ceil';

const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];

/** Below this, show the exact value with thousands separators. */
const ABBREVIATE_AT = 100_000;

/** Above this (past the last unit) fall back to scientific notation. */
const SCIENTIFIC_AT = Math.pow(1000, UNITS.length);

function applyMode(x: number, mode: RoundMode): number {
  return mode === 'floor' ? Math.floor(x) : mode === 'ceil' ? Math.ceil(x) : Math.round(x);
}

function roundTo(x: number, decimals: number, mode: RoundMode): number {
  const f = Math.pow(10, decimals);
  // toPrecision(12) strips binary-float dust (1.11 * 100 === 111.00000000000001)
  // that would otherwise make floor/ceil jump a whole ULP in the last decimal.
  return applyMode(Number((x * f).toPrecision(12)), mode) / f;
}

function pickDecimals(scaled: number): number {
  return scaled < 10 ? 2 : scaled < 100 ? 1 : 0;
}

/** Abbreviate a non-negative value to e.g. "1.24M", "600K", "2.76B". */
function abbreviate(v: number, mode: RoundMode): string {
  let tier = 0;
  let s = v;
  while (s >= 1000 && tier < UNITS.length - 1) {
    s /= 1000;
    tier++;
  }
  let decimals = pickDecimals(s);
  let scaled = roundTo(s, decimals, mode);
  // A value like 999,999 scales to 999.999 and can round to "1000" — roll it up.
  if (scaled >= 1000 && tier < UNITS.length - 1) {
    tier++;
    s = scaled / 1000;
    decimals = pickDecimals(s);
    scaled = roundTo(s, decimals, mode);
  }
  // Past the last unit it still rounds to 1000 — fall back to scientific rather
  // than printing "1000Dc".
  if (scaled >= 1000) return v.toExponential(2);
  let str = scaled.toFixed(decimals);
  if (str.includes('.')) str = str.replace(/\.?0+$/, ''); // 1.20 -> 1.2, 1.00 -> 1
  return str + UNITS[tier];
}

/** Format a raw number: exact with commas when small, abbreviated when large. */
export function formatNumber(n: number, mode: RoundMode = 'round'): string {
  if (!Number.isFinite(n)) return '0';
  const neg = n < 0;
  const abs = Math.abs(n);
  // Rounding applies to the magnitude, so on a negative the direction flips:
  // flooring a balance (never overstate) rounds its magnitude UP.
  const m: RoundMode = neg && mode !== 'round' ? (mode === 'floor' ? 'ceil' : 'floor') : mode;
  const sign = neg ? '-' : '';
  if (abs < ABBREVIATE_AT) return sign + applyMode(abs, m).toLocaleString('en-US');
  if (abs >= SCIENTIFIC_AT) return sign + abs.toExponential(2);
  return sign + abbreviate(abs, m);
}

/** Format a cash amount with a leading currency mark. */
export function formatCash(n: number, mode: RoundMode = 'round'): string {
  if (!Number.isFinite(n)) return '$0';
  const s = formatNumber(n, mode);
  return s.startsWith('-') ? '-$' + s.slice(1) : '$' + s;
}
