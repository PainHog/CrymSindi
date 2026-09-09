// -----------------------------------------------------------------------------
// HEAT MUTATION HELPERS
// -----------------------------------------------------------------------------
// Heat is stored as a value + timestamp and cools continuously (see deriveHeat).
// To change heat correctly we first "settle" it to the current time (bake in the
// cooldown so far), then adjust. All returns are new state objects (pure).
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { clamp, deriveHeat } from './selectors';
import type { GameState } from './types';

/** Bake accumulated cooldown into `heat` and reset the clock to `now`. */
export function settleHeat(state: GameState, now: number, config: Config = CONFIG): GameState {
  return {
    ...state,
    heat: deriveHeat(state, now, config),
    heatUpdatedAt: now,
  };
}

/** Settle to `now`, then add `amount` heat (clamped to [0, maxHeat]). */
export function addHeat(
  state: GameState,
  amount: number,
  now: number,
  config: Config = CONFIG,
): GameState {
  const settled = settleHeat(state, now, config);
  return {
    ...settled,
    heat: clamp(settled.heat + amount, 0, config.maxHeat),
  };
}
