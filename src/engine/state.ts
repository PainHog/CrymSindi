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

/** Fresh game: 1 safehouse (1 crew slot), 1 crew of 3 starting members. */
export function createInitialState(now: number, config: Config = CONFIG): GameState {
  const tier = SAFEHOUSE_TIERS[0];
  const crewId = 'c1';
  const safehouseId = 's1';
  const skill = config.startingMemberSkill;

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
        memberIds: ['m1', 'm2', 'm3'],
        maxMembers: config.crewMaxMembers,
        status: 'idle',
      },
    ],
    // A starter crew that can attempt the tier-1 jobs out of the gate.
    members: [
      { id: 'm1', name: 'Vic Marlow', role: 'driver', skill, gearIds: [] },
      { id: 'm2', name: 'Rey Okafor', role: 'hacker', skill, gearIds: [] },
      { id: 'm3', name: 'Sal Petrov', role: 'muscle', skill, gearIds: [] },
    ],
    activeHeists: [],
    purchasedUpgradeIds: [],
    lifetimeCash: 0,
    lastSaved: now,
    nextId: 4,
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
    const parsed: unknown = JSON.parse(raw);
    if (!isValidSave(parsed)) return null; // corrupt / wrong-shape save
    if (parsed.version !== config.version) return null; // incompatible version
    return resolveOffline(parsed, now, config);
  } catch {
    return null;
  }
}

/**
 * Structural guard for a parsed save. A matching `version` is not enough - a
 * truncated write or a hand-edited file can be valid JSON of the wrong shape,
 * which would crash the UI on the first `state.crews.map(...)`. We require the
 * scalar fields to be numbers and every collection to be an array before we
 * trust a save; anything else falls back to a fresh game.
 */
function isValidSave(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.version === 'number' &&
    typeof s.cash === 'number' &&
    typeof s.heat === 'number' &&
    typeof s.heatUpdatedAt === 'number' &&
    typeof s.lifetimeCash === 'number' &&
    typeof s.lastSaved === 'number' &&
    typeof s.nextId === 'number' &&
    Array.isArray(s.safehouses) &&
    Array.isArray(s.crews) &&
    Array.isArray(s.members) &&
    Array.isArray(s.activeHeists) &&
    Array.isArray(s.purchasedUpgradeIds)
  );
}

export function clearSave(config: Config = CONFIG): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(config.saveKey);
  } catch {
    // ignore
  }
}
