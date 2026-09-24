import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { RoleId } from '../data/roles';
import { createInitialState } from './state';
import { launchHeist, collectHeist } from './heists';
import { isManhuntAt, manhuntActive } from './selectors';
import type { GameState, Member } from './types';

const NOW = 5_000_000_000;

/** A big, role-complete, all-tiers-unlocked crew at a chosen live Heat. `heat` is
 *  the stored value and heatUpdatedAt is pinned to NOW so it reads back verbatim. */
function crewAtHeat(heat: number): GameState {
  const base = createInitialState(0);
  const roles: RoleId[] = ['hacker', 'muscle', 'driver', 'lookout', 'hacker', 'muscle'];
  const members: Member[] = roles.map((role, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    role,
    skill: 12,
    gearIds: [],
  }));
  return {
    ...base,
    cash: 5_000_000,
    lifetimeCash: 5_000_000,
    heat,
    heatUpdatedAt: NOW,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
  };
}

describe('manhunt — pure threshold', () => {
  it('isManhuntAt is off below the threshold and on at/above it', () => {
    expect(isManhuntAt(CONFIG.manhuntThreshold - 1)).toBe(false);
    expect(isManhuntAt(CONFIG.manhuntThreshold)).toBe(true);
    expect(isManhuntAt(CONFIG.maxHeat)).toBe(true);
    expect(isManhuntAt(0)).toBe(false);
  });

  it('manhuntActive reads live (cooled) Heat, not the stored value', () => {
    const hot = crewAtHeat(90);
    expect(manhuntActive(hot, NOW)).toBe(true);
    // Same stored 90, but ~200s elapsed cools it below the threshold → off.
    expect(manhuntActive(hot, NOW + 200_000)).toBe(false);

    const cool = crewAtHeat(10);
    expect(manhuntActive(cool, NOW)).toBe(false);
  });
});

describe('manhunt — launch/collect wiring', () => {
  it('snapshots manhunt onto the active heist when launched hot', () => {
    const s = crewAtHeat(90);
    const r = launchHeist(s, 'smash_grab', s.crews[0].id, NOW, 7, CONFIG, 'quiet');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.activeHeists[0].manhunt).toBe(true);
  });

  it('does not flag a run launched below the threshold (backward compatible)', () => {
    const s = crewAtHeat(10);
    const r = launchHeist(s, 'smash_grab', s.crews[0].id, NOW, 7, CONFIG, 'quiet');
    if (!r.ok) return;
    expect(r.state.activeHeists[0].manhunt).toBeUndefined();
    const a = r.state.activeHeists[0];
    const c = collectHeist(r.state, a.id, a.endsAt, undefined, CONFIG);
    if (!c.ok) return;
    expect(c.report!.manhunt).toBeFalsy();
    expect(c.report!.factors.some((f) => f.label === 'Manhunt')).toBe(false);
  });

  it('locks in the extra odds penalty at launch, shaving each member equally', () => {
    const s = crewAtHeat(90);
    const r = launchHeist(s, 'smash_grab', s.crews[0].id, NOW, 7, CONFIG, 'quiet');
    if (!r.ok) return;
    const a = r.state.activeHeists[0];
    expect(a.manhunt).toBe(true);

    // Collect with the penalty...
    const withMH = collectHeist(r.state, a.id, a.endsAt, undefined, CONFIG).report!;
    expect(withMH.manhunt).toBe(true);
    expect(withMH.factors.some((f) => f.label === 'Manhunt')).toBe(true);

    // ...vs. the identical run with the flag stripped (same seed => same rolls,
    // same launch heat; only the manhunt odds penalty differs).
    const stripped: GameState = {
      ...r.state,
      activeHeists: [{ ...a, manhunt: undefined }],
    };
    const noMH = collectHeist(stripped, a.id, a.endsAt, undefined, CONFIG).report!;

    expect(withMH.members.length).toBe(noMH.members.length);
    for (let i = 0; i < withMH.members.length; i++) {
      const w = withMH.members[i].chance;
      const n = noMH.members[i].chance;
      // The manhunt run is never better, and where neither is clamped the gap is
      // exactly the configured penalty.
      expect(w).toBeLessThanOrEqual(n + 1e-9);
      const clamped = w === CONFIG.memberChanceMin || n === CONFIG.memberChanceMax;
      if (!clamped) {
        expect(Math.abs(n - w - CONFIG.manhuntOddsPenalty)).toBeLessThan(1e-9);
      }
    }
  });
});
