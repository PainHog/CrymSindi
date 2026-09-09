import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { clearSave, createInitialState, loadGame, saveGame } from './state';
import { launchHeist } from './heists';

const T0 = 1_000_000_000_000;
const SEC = 1000;

/** Minimal in-memory localStorage so the node test env can exercise the
 *  persistence path (saveGame/loadGame read the `localStorage` global). */
class MemStorage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
}

const g = globalThis as unknown as { localStorage?: Storage };

beforeEach(() => {
  g.localStorage = new MemStorage() as unknown as Storage;
});
afterEach(() => {
  delete g.localStorage;
});

describe('save / load round-trip', () => {
  it('persists and restores core state', () => {
    const state = createInitialState(T0);
    const rich = { ...state, cash: 4242, lifetimeCash: 999, nextId: 7 };
    saveGame(rich, T0);

    const loaded = loadGame(T0);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.cash).toBe(4242);
    expect(loaded!.state.lifetimeCash).toBe(999);
    expect(loaded!.state.nextId).toBe(7);
    expect(loaded!.state.members).toHaveLength(state.members.length);
  });

  it('restores an in-progress heist and reports it ready after its end time', () => {
    const launched = launchHeist(createInitialState(T0), 'smash_grab', 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;

    const endsAt = launched.state.activeHeists[0].endsAt;
    saveGame(launched.state, T0);

    const loaded = loadGame(endsAt + 30 * SEC);
    expect(loaded).not.toBeNull();
    expect(loaded!.state.activeHeists).toHaveLength(1);
    expect(loaded!.readyCount).toBe(1);
  });

  it('settles heat forward across an away period on load', () => {
    const hot = { ...createInitialState(T0), heat: 100, heatUpdatedAt: T0 };
    saveGame(hot, T0);
    const loaded = loadGame(T0 + 10 * SEC);
    expect(loaded!.state.heat).toBeCloseTo(100 - CONFIG.heatCoolPerSec * 10, 5);
  });

  it('clearSave removes the save', () => {
    saveGame(createInitialState(T0), T0);
    expect(loadGame(T0)).not.toBeNull();
    clearSave();
    expect(loadGame(T0)).toBeNull();
  });
});

describe('load rejects bad saves (falls back to a fresh game)', () => {
  const write = (value: string) => g.localStorage!.setItem(CONFIG.saveKey, value);

  it('returns null when nothing is stored', () => {
    expect(loadGame(T0)).toBeNull();
  });

  it('returns null for non-JSON garbage', () => {
    write('{not valid json');
    expect(loadGame(T0)).toBeNull();
  });

  it('returns null for a version-matched but structurally broken save', () => {
    // valid JSON, correct version, but `crews` (and other arrays) are missing
    write(JSON.stringify({ version: CONFIG.version, cash: 100 }));
    expect(loadGame(T0)).toBeNull();
  });

  it('returns null for an incompatible version', () => {
    const state = createInitialState(T0);
    write(JSON.stringify({ ...state, version: CONFIG.version + 999 }));
    expect(loadGame(T0)).toBeNull();
  });
});
