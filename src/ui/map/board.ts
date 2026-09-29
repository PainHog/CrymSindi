// -----------------------------------------------------------------------------
// MAP BOARD — heist → pin-slot mapping
// -----------------------------------------------------------------------------
// The board is the unlocked heists (plus the contract) in a stable order; pin i
// sits on SLOTS[i % SLOTS.length]. Shared so both the map (which plants the
// pins) and the scene layer (which plays vignettes AT a pin) agree on where a
// given heist lives. Pure/derived — no state.
// -----------------------------------------------------------------------------

import { HEISTS, type HeistDef } from '../../data/heists';
import { contractHeistDef, contractUnlocked, isHeistUnlocked, type GameState } from '../../engine';
import { SLOTS } from './mapSlots';

/** The unlocked heists that make up the current board, in a stable order. */
export function boardHeists(game: GameState): HeistDef[] {
  const list = HEISTS.filter((h) => isHeistUnlocked(game, h));
  if (contractUnlocked(game)) list.push(contractHeistDef(game.contractLevel));
  return list;
}

/** Normalized (0..1) stage position of a heist's pin, or null if it's not on
 *  the current board (e.g. a bulk/reward collect with no single location). */
export function slotForHeist(game: GameState, heistId: string): { nx: number; ny: number } | null {
  const board = boardHeists(game);
  const i = board.findIndex((h) => h.id === heistId);
  if (i < 0) return null;
  const slot = SLOTS[i % SLOTS.length];
  return { nx: slot[0] / 100, ny: slot[1] / 100 };
}
