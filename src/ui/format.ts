// Small formatting/display helpers shared across UI components.

export function formatCash(n: number): string {
  return '$' + Math.round(n).toLocaleString('en-US');
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
