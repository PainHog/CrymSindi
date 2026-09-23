import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import { createInitialState } from './state';
import { launchHeist } from './heists';
import { finishAllNow, grantMarks, rewardBonusCash, skipCooldown } from './monetization';

const T0 = 1_000_000_000_000;

describe('monetization', () => {
  it('grants marks (and rejects a non-positive grant)', () => {
    const s = createInitialState(T0);
    const r = grantMarks(s, 5);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.marks).toBe(5);
    expect(grantMarks(s, 0).ok).toBe(false);
  });

  it('rewardBonusCash counts as real income (cash + lifetime + career)', () => {
    const s = { ...createInitialState(T0), cash: 100, lifetimeCash: 100, careerCash: 100 };
    const r = rewardBonusCash(s, 250);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.cash).toBe(350);
    expect(r.state.lifetimeCash).toBe(350);
    expect(r.state.careerCash).toBe(350);
  });

  it('skipCooldown finishes one running heist and guards the rest', () => {
    const launched = launchHeist(createInitialState(T0), 'smash_grab', 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const active = launched.state.activeHeists[0];
    expect(active.endsAt).toBeGreaterThan(T0);

    const r = skipCooldown(launched.state, active.id, T0 + 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.activeHeists[0].endsAt).toBe(T0 + 1000); // now collectable

    expect(skipCooldown(r.state, active.id, T0 + 2000).ok).toBe(false); // already done
    expect(skipCooldown(launched.state, 'nope', T0).ok).toBe(false); // unknown id
  });

  it('finishAllNow spends marks and finishes running heists; guards apply', () => {
    const launched = launchHeist(createInitialState(T0), 'smash_grab', 'c1', T0);
    if (!launched.ok) return;
    expect(finishAllNow(launched.state, T0 + 1000).ok).toBe(false); // no marks

    const withMarks = { ...launched.state, marks: 2 };
    const r = finishAllNow(withMarks, T0 + 1000);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.marks).toBe(2 - CONFIG.finishAllMarksCost);
    expect(r.state.activeHeists.every((a) => a.endsAt <= T0 + 1000)).toBe(true);

    expect(finishAllNow({ ...createInitialState(T0), marks: 5 }, T0).ok).toBe(false); // none running
  });
});
