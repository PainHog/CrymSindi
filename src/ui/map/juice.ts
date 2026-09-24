// -----------------------------------------------------------------------------
// COLLECT-MOMENT JUICE (map)
// -----------------------------------------------------------------------------
// Pure mapping from a one-shot GameEvent to a floating payout descriptor, so the
// "what/whether to float" decision is testable in isolation and NfJuice stays a
// thin renderer. We float only real money moments (a collect with a take) — a
// busted-with-nothing job is already told by the fail cue + debrief, so a "+$0"
// floater would be noise.
// -----------------------------------------------------------------------------

import type { GameEvent } from '../../store/GameContext';

export interface Floater {
  /** Cash amount to show, always > 0. */
  payout: number;
  /** Green for a clean take, magenta when the job failed but still paid out. */
  tone: 'good' | 'bad';
  /** A flawless job earns an extra flourish. */
  flawless: boolean;
}

/** The floater to spawn for an event, or null when nothing should float. */
export function floaterFromEvent(event: GameEvent | null): Floater | null {
  if (!event || event.kind !== 'collect' || event.payout <= 0) return null;
  return { payout: event.payout, tone: event.success ? 'good' : 'bad', flawless: event.flawless };
}
