import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { migrateSave, type SaveMigration } from './migrations';
import { createInitialState, exportSave, importSave } from './state';
import type { GameState } from './types';

const T = 1_700_000_000_000;

// A toy 3-version chain for exercising the walk in isolation.
const chain: Record<number, SaveMigration> = {
  1: (s) => ({ ...s, version: 2, addedInV2: true }),
  2: (s) => ({ ...s, version: 3, renamed: (s as { old?: number }).old ?? 0 }),
};

describe('migrateSave (walk logic)', () => {
  it('returns a current-version save unchanged', () => {
    const s = { version: 3, a: 1 };
    expect(migrateSave(s, 3, chain)).toBe(s);
  });

  it('walks an older save forward, applying each step in order', () => {
    const out = migrateSave({ version: 1, old: 7 }, 3, chain) as Record<string, unknown>;
    expect(out.version).toBe(3);
    expect(out.addedInV2).toBe(true);
    expect(out.renamed).toBe(7);
  });

  it('discards a save when a step in the path is missing', () => {
    expect(migrateSave({ version: 1 }, 3, { 2: chain[2] })).toBeNull(); // no 1->2
  });

  it('never downgrades a save from a newer build', () => {
    expect(migrateSave({ version: 5 }, 3, chain)).toBeNull();
  });

  it('rejects anything without a numeric version', () => {
    expect(migrateSave({}, 3, chain)).toBeNull();
    expect(migrateSave(null, 3, chain)).toBeNull();
    expect(migrateSave('nope', 3, chain)).toBeNull();
  });

  it("guards against a migration that doesn't advance the version", () => {
    expect(migrateSave({ version: 1 }, 3, { 1: (s) => ({ ...s, version: 1 }) })).toBeNull();
  });
});

describe('load/import through migration (current version passes through)', () => {
  it('a current-version save still round-trips via export/import', () => {
    const s: GameState = { ...createInitialState(T), cash: 9999, turfWins: 4 };
    const back = importSave(exportSave(s, T), T);
    expect(back?.state.cash).toBe(9999);
    expect(back?.state.turfWins).toBe(4);
  });

  it('a save from a newer/unknown version is rejected, not loaded', () => {
    const s = { ...createInitialState(T), version: CONFIG.version + 1 };
    expect(importSave(JSON.stringify(s), T)).toBeNull();
  });
});
