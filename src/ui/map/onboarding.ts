// -----------------------------------------------------------------------------
// FIRST-RUN ONBOARDING (map)
// -----------------------------------------------------------------------------
// A tiny state machine that walks a brand-new player through the core loop on
// the map: send a crew, wait for the job, collect. Pure function of the game
// state so it's testable and drives the NfOnboard strip. It ends for good once
// the player has collected their first job (stats.heistsCompleted > 0, which
// persists), so it never nags a returning player.
// -----------------------------------------------------------------------------

import { heistStatusAt, type GameState } from '../../engine';

export type OnboardStep = 'send' | 'wait' | 'collect';

/** The current first-run step, or null once the player has learned the loop. */
export function firstRunStep(game: GameState, now: number): OnboardStep | null {
  if (game.stats.heistsCompleted > 0) return null; // already banked a job
  if (game.activeHeists.some((a) => heistStatusAt(a.endsAt, now) === 'ready')) return 'collect';
  if (game.activeHeists.length > 0) return 'wait';
  return 'send';
}

export const ONBOARD_COPY: Record<OnboardStep, { n: number; title: string; body: string }> = {
  send: {
    n: 1,
    title: 'Pull your first job',
    body: 'Tap a glowing pin on the map, pick a crew, and hit launch.',
  },
  wait: {
    n: 2,
    title: 'The job is running',
    body: "It plays out in real time — come back when the timer's up. You can leave it running.",
  },
  collect: {
    n: 3,
    title: 'Bank the take',
    body: 'Tap the READY pin (or Collect all, top right) to collect and read the debrief.',
  },
};
