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
import { deriveHeat, hasFixer } from './selectors';
import { collectHeist, launchHeist } from './heists';
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
    notoriety: 0,
    prestigeCount: 0,
    careerCash: 0,
    contractLevel: 0,
    stats: { heistsCompleted: 0, heistsSucceeded: 0, flawless: 0, biggestScore: 0 },
    milestonesEarned: [],
    dailyClaimDay: -1,
    dailyStreak: 0,
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
  /** Heists the Fixer auto-collected while away (0 without the Fixer). */
  autoCollected: number;
  /** Cash the Fixer brought in while away. */
  autoEarned: number;
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
  let s = state;
  let autoCollected = 0;
  let autoEarned = 0;

  // The Fixer works the crews while you are away: auto-collect each finished
  // heist and relaunch the same job, chronologically, up to the offline cap.
  // Without the Fixer, finished heists just wait to be collected by hand.
  if (hasFixer(s)) {
    const horizon = Math.min(now, s.lastSaved + config.offlineCapSec * 1000);
    let guard = 0;
    const MAX_CYCLES = 1000;
    while (guard++ < MAX_CYCLES) {
      const next = s.activeHeists
        .filter((a) => a.endsAt <= horizon)
        .sort((a, b) => a.endsAt - b.endsAt)[0];
      if (!next) break;
      const t = next.endsAt;
      const collected = collectHeist(s, next.id, t, undefined, config);
      if (!collected.ok) break;
      s = collected.state;
      autoCollected += 1;
      autoEarned += collected.report?.payout ?? 0;
      // Relaunch the same job for that crew (deterministic seed per cycle).
      const seed = ((next.seed ?? t) ^ (guard * 0x9e3779b1)) >>> 0;
      const relaunched = launchHeist(s, next.heistId, next.crewId, t, seed, config);
      if (relaunched.ok) s = relaunched.state;
      // If relaunch failed (e.g. heat maxed), the crew is now idle; keep going
      // with any other finished heists, then stop.
    }
  }

  const settledHeat = deriveHeat(s, now, config);
  const readyCount = s.activeHeists.filter((a) => now >= a.endsAt).length;

  return {
    state: { ...s, heat: settledHeat, heatUpdatedAt: now, lastSaved: now },
    readyCount,
    awayMs,
    autoCollected,
    autoEarned,
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

export interface SaveResult {
  /** The settled state (heat baked to `now`) whether or not the write succeeded. */
  state: GameState;
  /** True only if the state was actually written to storage. */
  ok: boolean;
}

/** Serialize + persist. Heat is settled to `now` so the saved value is current.
 *  Reports whether the write actually happened so callers don't claim "Saved."
 *  when storage is full/blocked. */
export function saveGame(state: GameState, now: number, config: Config = CONFIG): SaveResult {
  const settled: GameState = {
    ...state,
    heat: deriveHeat(state, now, config),
    heatUpdatedAt: now,
    lastSaved: now,
  };
  if (!hasLocalStorage()) return { state: settled, ok: false };
  try {
    localStorage.setItem(config.saveKey, JSON.stringify(settled));
    return { state: settled, ok: true };
  } catch {
    // Storage full or blocked; game continues in memory but nothing was written.
    return { state: settled, ok: false };
  }
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
    return resolveOffline(clampState(parsed, config), now, config);
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
const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function isValidSave(value: unknown): value is GameState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  const scalarsOk =
    isFiniteNum(s.version) &&
    isFiniteNum(s.cash) &&
    isFiniteNum(s.heat) &&
    isFiniteNum(s.heatUpdatedAt) &&
    isFiniteNum(s.lifetimeCash) &&
    isFiniteNum(s.lastSaved) &&
    isFiniteNum(s.nextId) &&
    isFiniteNum(s.notoriety) &&
    isFiniteNum(s.prestigeCount) &&
    isFiniteNum(s.careerCash) &&
    isFiniteNum(s.contractLevel) &&
    Array.isArray(s.milestonesEarned) &&
    !!s.stats &&
    typeof s.stats === 'object';
  if (!scalarsOk) return false;
  if (
    !Array.isArray(s.safehouses) ||
    !Array.isArray(s.crews) ||
    !Array.isArray(s.members) ||
    !Array.isArray(s.activeHeists) ||
    !Array.isArray(s.purchasedUpgradeIds)
  ) {
    return false;
  }
  // Element-shape checks: a deep-malformed save (e.g. crews:[null]) would pass a
  // shallow Array.isArray check and then crash the UI on crew.memberIds.map(...).
  const crewsOk = (s.crews as unknown[]).every(
    (c) =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as { id?: unknown }).id === 'string' &&
      Array.isArray((c as { memberIds?: unknown }).memberIds) &&
      typeof (c as { status?: unknown }).status === 'string',
  );
  const membersOk = (s.members as unknown[]).every(
    (m) =>
      !!m &&
      typeof m === 'object' &&
      typeof (m as { id?: unknown }).id === 'string' &&
      typeof (m as { role?: unknown }).role === 'string' &&
      isFiniteNum((m as { skill?: unknown }).skill),
  );
  const safehousesOk = (s.safehouses as unknown[]).every(
    (h) =>
      !!h &&
      typeof h === 'object' &&
      typeof (h as { id?: unknown }).id === 'string' &&
      Array.isArray((h as { crewIds?: unknown }).crewIds),
  );
  const activeOk = (s.activeHeists as unknown[]).every(
    (a) =>
      !!a &&
      typeof a === 'object' &&
      typeof (a as { id?: unknown }).id === 'string' &&
      typeof (a as { heistId?: unknown }).heistId === 'string' &&
      typeof (a as { crewId?: unknown }).crewId === 'string' &&
      isFiniteNum((a as { startedAt?: unknown }).startedAt) &&
      isFiniteNum((a as { endsAt?: unknown }).endsAt),
  );
  return crewsOk && membersOk && safehousesOk && activeOk;
}

/** Clamp a loaded save into legal ranges so an edited/legacy value can't produce
 *  an absurd UI state (skill past the cap, negative or infinite cash, etc.). */
function clampState(state: GameState, config: Config = CONFIG): GameState {
  return {
    ...state,
    cash: Math.max(0, state.cash),
    lifetimeCash: Math.max(0, state.lifetimeCash),
    careerCash: Math.max(0, state.careerCash),
    notoriety: Math.max(0, state.notoriety),
    prestigeCount: Math.max(0, Math.floor(state.prestigeCount)),
    contractLevel: Math.max(0, Math.floor(state.contractLevel)),
    // Default the daily-reward fields so a legacy save (written before they
    // existed) or an edited one loads cleanly.
    dailyClaimDay: isFiniteNum(state.dailyClaimDay) ? Math.floor(state.dailyClaimDay) : -1,
    dailyStreak: isFiniteNum(state.dailyStreak) ? Math.max(0, Math.floor(state.dailyStreak)) : 0,
    heat: Math.min(config.maxHeat, Math.max(0, state.heat)),
    members: state.members.map((m) => ({
      ...m,
      skill: Math.min(config.maxMemberSkill, Math.max(0, m.skill)),
    })),
  };
}

export function clearSave(config: Config = CONFIG): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(config.saveKey);
  } catch {
    // ignore
  }
}
