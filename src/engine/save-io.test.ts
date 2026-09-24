import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { createInitialState, exportSave, importSave } from './state';
import type { GameState } from './types';

const T = 1_700_000_000_000;

function richState(): GameState {
  return {
    ...createInitialState(T),
    cash: 42_000,
    lifetimeCash: 500_000,
    notoriety: 30,
    prestigeCount: 2,
    careerCash: 2_000_000,
    turfWins: 7,
    rivalWins: { ivory_court: 4, meridian: 6 },
    rivalsDominated: ['meridian'],
  };
}

describe('save export/import', () => {
  it('round-trips a save through the portable blob', () => {
    const s = richState();
    const blob = exportSave(s, T);
    expect(blob.startsWith('NFS1:')).toBe(true);
    const back = importSave(blob, T);
    expect(back).not.toBeNull();
    const r = back!.state;
    expect(r.cash).toBe(s.cash);
    expect(r.lifetimeCash).toBe(s.lifetimeCash);
    expect(r.notoriety).toBe(s.notoriety);
    expect(r.prestigeCount).toBe(s.prestigeCount);
    expect(r.turfWins).toBe(7);
    expect(r.rivalWins.ivory_court).toBe(4);
    expect(r.rivalsDominated).toContain('meridian');
    expect(r.members.length).toBe(s.members.length);
  });

  it('accepts a raw JSON paste too (no prefix / not base64)', () => {
    const s = richState();
    const back = importSave(JSON.stringify(s), T);
    expect(back?.state.turfWins).toBe(7);
  });

  it('rejects garbage without touching the running game', () => {
    expect(importSave('not a save', T)).toBeNull();
    expect(importSave('', T)).toBeNull();
    expect(importSave('NFS1:@@@notbase64@@@', T)).toBeNull();
    expect(importSave('{"version": 1}', T)).toBeNull(); // valid JSON, wrong shape
  });

  it('rejects an incompatible save version', () => {
    const s = { ...richState(), version: CONFIG.version + 1 };
    expect(importSave(JSON.stringify(s), T)).toBeNull();
  });

  it('resolves offline time on import (a job finished while the blob sat)', () => {
    // Export with a job mid-flight, import an hour later → the Fixer/ready logic
    // runs, exactly like a normal load.
    const base = createInitialState(T);
    const s: GameState = {
      ...base,
      activeHeists: [
        { id: 'h1', heistId: 'smash_grab', crewId: base.crews[0].id, startedAt: T, endsAt: T + 20_000, seed: 1 },
      ],
      crews: base.crews.map((c) => ({ ...c, status: 'onHeist' as const })),
    };
    const blob = exportSave(s, T);
    const back = importSave(blob, T + 3_600_000); // an hour later
    expect(back).not.toBeNull();
    // The job's window is long past; it's either auto-collected or sitting ready.
    expect(back!.autoCollected + back!.readyCount).toBeGreaterThanOrEqual(1);
  });
});
