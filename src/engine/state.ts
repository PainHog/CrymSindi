// -----------------------------------------------------------------------------
// STATE LIFECYCLE: initial state, offline resolution, save / load
// -----------------------------------------------------------------------------
// Idle/offline progress is timestamp-based, never tick-accumulated:
//  - On load we settle heat forward by the elapsed real time (capped).
//  - In-progress heists are NOT auto-completed; a heist whose endsAt has passed
//    is simply "ready to collect" - that status is derived from timestamps.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import { SAFEHOUSE_TIERS } from '../data/safehouses';
import { deriveHeat } from './selectors';
import type { GameState } from './types';

/** Fresh game: 1 safehouse (1 crew slot), 1 crew, 1 recruited member. */
export function createInitialState(now: number, config: Config = CONFIG): GameState {
  const tier = SAFEHOUSE_TIERS[0];
  const memberId = 'm1';
  const crewId = 'c1';
  const safehouseId = 's1';

  return {
    version: config.version,
    cash: config.startingCash,
    heat: config.startingHeat,
    heatUpdatedAt: now,
    safehouses: [
      { id: safehouseId, tierId: tier.id, crewSlots: tier.crewSlots, crewIds: [crewId] },
    ],
    crews: [
      {
        id: crewId,
        safehouseId,
        memberIds: [memberId],
        maxMembers: config.crewMaxMembers,
        status: 'idle',
      },
    ],
    members: [
      { id: memberId, name: 'Vic Marlow', role: 'driver', skill: config.startingMemberSkill, gearIds: [] },
    ],
    activeHeists: [],
    purchasedUpgradeIds: [],
    lifetimeCash: 0,
    lastSaved: now,
    nextId: 2,
  };
}

export interface OfflineSummary {
  state: GameState;
  /** Heists that finished (or were already finished) and await collection. */
  readyCount: number;
  /** Ms of real time that elapsed since the last save. */
  awayMs: number;
}

/**
 * Resolve idle time on (re)load or on regaining focus. Settles heat forward,
 * stamps lastSaved, and reports how many heists are ready to collect. Active
 * heists are left in place - their ready/in-progress status is always derived
 * from their timestamps, so nothing needs to be mutated for them here.
 */
export function resolveOffline(
  state: GameState,
  now: number,
  config: Config = CONFIG,
): OfflineSummary {
  const awayMs = Math.max(0, now - state.lastSaved);
  const settledHeat = deriveHeat(state, now, config);
  const readyCount = state.activeHeists.filter((a) => now >= a.endsAt).length;

  return {
    state: { ...state, heat: settledHeat, heatUpdatedAt: now, lastSaved: now },
    readyCount,
    awayMs,
  };
}

// ---- Persistence (localStorage) --------------------------------------------

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Serialize + persist. Heat is settled to `now` so the saved value is current. */
export function saveGame(state: GameState, now: number, config: Config = CONFIG): GameState {
  const settled: GameState = {
    ...state,
    heat: deriveHeat(state, now, config),
    heatUpdatedAt: now,
    lastSaved: now,
  };
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(config.saveKey, JSON.stringify(settled));
    } catch {
      // Storage full or blocked; ignore - game continues in memory.
    }
  }
  return settled;
}

/**
 * Load + resolve offline time. Returns null if there is no valid save (or the
 * save version is incompatible), signaling the caller to start a fresh game.
 */
export function loadGame(now: number, config: Config = CONFIG): OfflineSummary | null {
  if (!hasLocalStorage()) return null;
  let raw: string | null;
  try {
    raw = localStorage.getItem(config.saveKey);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== config.version) return null; // incompatible save
    return resolveOffline(parsed, now, config);
  } catch {
    return null;
  }
}

export function clearSave(config: Config = CONFIG): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(config.saveKey);
  } catch {
    // ignore
  }
}
