import { describe, it, expect } from 'vitest';
import { CONFIG } from '../data/config';
import type { RoleId } from '../data/roles';
import { createInitialState, resolveOffline } from './state';
import { prestige } from './economy';
import { awardMilestones } from './milestones';
import { launchHeist, collectHeist } from './heists';
import {
  CONTRACT_ID,
  contractHeistDef,
  contractUnlocked,
  maxUnlockedTier,
  notorietyGainFor,
  notorietyMult,
  notorietySkillBonus,
} from './selectors';
import type { GameState, Member } from './types';

const T0 = 1_000_000_000_000;

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)];
};

function makeState(specs: { role: RoleId; skill: number }[], patch: Partial<GameState> = {}): GameState {
  const base = createInitialState(T0);
  const members: Member[] = specs.map((s, i) => ({
    id: `m${i + 1}`,
    name: `M${i + 1}`,
    role: s.role,
    skill: s.skill,
    gearIds: [],
  }));
  return {
    ...base,
    members,
    crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }],
    ...patch,
  };
}

describe('notoriety', () => {
  it('gain scales with sqrt of lifetime cash', () => {
    expect(notorietyGainFor(0)).toBe(0);
    // floor(sqrt(200000 / 2500)) = floor(sqrt(80)) = 8
    expect(notorietyGainFor(200000)).toBe(8);
  });
  it('multiplier and skill bonus scale with perk levels', () => {
    const s = { ...createInitialState(T0), perks: { reputation: 10, connections: 10 } };
    expect(notorietyMult(s)).toBeCloseTo(1 + 0.05 * 10, 5); // Reputation
    expect(notorietySkillBonus(s)).toBeCloseTo(0.5 * 10, 5); // Connections
  });
});

describe('prestige', () => {
  it('is refused below the threshold', () => {
    const s = { ...createInitialState(T0), lifetimeCash: CONFIG.prestigeThreshold - 1 };
    expect(prestige(s, T0).ok).toBe(false);
  });

  it('resets the run but keeps career, notoriety, contract and milestones', () => {
    const s: GameState = {
      ...createInitialState(T0),
      cash: 50000,
      lifetimeCash: 1600000, // past the tier-5 unlock + prestige threshold
      careerCash: 1800000,
      contractLevel: 4,
      notoriety: 3,
      milestonesEarned: ['first_score'],
      stats: { heistsCompleted: 20, heistsSucceeded: 18, flawless: 4, biggestScore: 400000 },
    };
    const res = prestige(s, T0);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const n = res.state;
    expect(n.cash).toBe(CONFIG.startingCash); // fresh operation
    expect(n.lifetimeCash).toBe(0);
    expect(n.notoriety).toBe(3 + notorietyGainFor(1600000)); // gain from a 1.6M run
    expect(n.prestigeCount).toBe(1);
    expect(n.careerCash).toBe(1800000); // preserved
    expect(n.contractLevel).toBe(4); // preserved
    expect(n.milestonesEarned).toContain('first_score');
    expect(n.stats.heistsCompleted).toBe(20);
    expect(n.crews[0].memberIds).toHaveLength(3); // fresh starter crew
  });

  it('perks raise every member power and the take', () => {
    const s = makeState(
      [
        { role: 'hacker', skill: 5 },
        { role: 'muscle', skill: 5 },
        { role: 'driver', skill: 5 },
      ],
      { perks: { reputation: 10, connections: 3 } },
    );
    const report = resolveWithNotoriety(s);
    // Base 5 + Connections lvl 3 (+1.5) + Tight Unit synergy (3 distinct roles, +1) = 7.5.
    expect(report.members[0].effectiveSkill).toBeCloseTo(5 + 1.5 + 1, 5);
    // Reputation lvl 10 = notorietyMult 1.5x on the take.
    expect(report.payout).toBeGreaterThan(0);
  });
});

function resolveWithNotoriety(s: GameState) {
  const launched = launchHeist(s, 'smash_grab', 'c1', T0);
  if (!launched.ok) throw new Error('launch failed');
  const endsAt = launched.state.activeHeists[0].endsAt;
  const collected = collectHeist(launched.state, launched.state.activeHeists[0].id, endsAt, seq(0));
  if (!collected.ok || !collected.report) throw new Error('collect failed');
  return collected.report;
}

describe('milestones', () => {
  it('awards a met milestone once and applies its reward', () => {
    const s = { ...createInitialState(T0), stats: { heistsCompleted: 1, heistsSucceeded: 1, flawless: 0, biggestScore: 0 } };
    const first = awardMilestones(s);
    expect(first.earned.map((m) => m.id)).toContain('first_score');
    expect(first.state.cash).toBe(CONFIG.startingCash + 250); // reward applied
    // second pass awards nothing new
    const second = awardMilestones(first.state);
    expect(second.earned).toHaveLength(0);
  });
});

describe('endgame contract', () => {
  it('escalates difficulty and payout with level', () => {
    const l0 = contractHeistDef(0);
    const l5 = contractHeistDef(5);
    expect(l5.difficulty).toBeGreaterThan(l0.difficulty);
    expect(l5.payoutPerSec).toBeGreaterThan(l0.payoutPerSec);
    expect(l0.id).toBe(CONTRACT_ID);
  });

  it('unlocks with tier 5 and clearing it advances the level', () => {
    // lifetimeCash past the tier-5 gate unlocks the contract
    const s = makeState(
      [
        { role: 'hacker', skill: 15 },
        { role: 'muscle', skill: 15 },
        { role: 'driver', skill: 15 },
        { role: 'lookout', skill: 15 },
        { role: 'hacker', skill: 15 },
        { role: 'muscle', skill: 15 }, // contract needs requiredPasses(5) + 1 slack = 6
      ],
      { lifetimeCash: CONFIG.tierUnlocks[5], contractLevel: 0 },
    );
    expect(maxUnlockedTier(s)).toBe(5);
    expect(contractUnlocked(s)).toBe(true);

    const launched = launchHeist(s, CONTRACT_ID, 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    expect(launched.state.activeHeists[0].contractLevel).toBe(0);

    const endsAt = launched.state.activeHeists[0].endsAt;
    const collected = collectHeist(launched.state, launched.state.activeHeists[0].id, endsAt, seq(0));
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    expect(collected.report!.success).toBe(true);
    expect(collected.state.contractLevel).toBe(1); // advanced
  });

  it('stays unlocked after prestige resets the run (persistent career signals)', () => {
    const fresh = createInitialState(T0);
    // A post-prestige operation that reached tier 5 but never launched the
    // contract: run-local lifetimeCash reset to 0 (regular tiers re-lock) and
    // contractLevel still 0, so ONLY the persistent careerCash clause can keep
    // the contract open. (Guards the commit's headline mechanism in isolation:
    // remove the careerCash clause and this assertion fails.)
    const postPrestige: GameState = {
      ...fresh,
      lifetimeCash: 0,
      careerCash: CONFIG.tierUnlocks[5],
      contractLevel: 0,
    };
    expect(maxUnlockedTier(postPrestige)).toBe(1); // regular tiers re-locked
    expect(contractUnlocked(postPrestige)).toBe(true); // careerCash keeps it open

    // A cleared level keeps it available even with careerCash below the
    // threshold (survives a later upward threshold change) — isolates clause 3.
    expect(contractUnlocked({ ...fresh, careerCash: 0, contractLevel: 2 })).toBe(true);

    // A brand-new operation that has never reached tier 5 has no contract.
    expect(contractUnlocked(fresh)).toBe(false);
  });
});

describe('launch-time heat', () => {
  const crew = [
    { role: 'hacker' as RoleId, skill: 15 },
    { role: 'muscle' as RoleId, skill: 15 },
    { role: 'driver' as RoleId, skill: 15 },
  ];

  it('resolves against the heat the job was launched under, not the cooled collect-time heat', () => {
    const hot: GameState = {
      ...makeState(crew, { lifetimeCash: CONFIG.tierUnlocks[2] }), // unlock the tier-2 job
      heat: 80,
      heatUpdatedAt: T0,
    };
    const launched = launchHeist(hot, 'bank_vault', 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const active = launched.state.activeHeists[0];
    expect(active.heatAtLaunch).toBeCloseTo(80, 0); // captured at commit (before this job's cost)

    // Collect long after it finished, when live heat has fully cooled to 0.
    const wayLater = active.endsAt + 6 * 60 * 60 * 1000;
    const collected = collectHeist(launched.state, active.id, wayLater, seq(0));
    expect(collected.ok).toBe(true);
    if (!collected.ok) return;
    // The debrief reflects the launch heat (~80), not the ~0 live heat.
    expect(collected.report!.heatAtResolve).toBeCloseTo(80, 0);
  });

  it('a cooled-down launch (heat ~0) carries no heat penalty', () => {
    const launched = launchHeist(makeState(crew, { lifetimeCash: CONFIG.tierUnlocks[2] }), 'bank_vault', 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    expect(launched.state.activeHeists[0].heatAtLaunch).toBeCloseTo(0, 5);
  });

  it('a hot launch actually lowers realized passes vs an identical cool launch', () => {
    // eff 16 (skill 15 + tight-unit synergy) vs bank_vault difficulty 12:
    //   heat 0  -> chance clamps to 0.97, so a 0.8 roll PASSES
    //   heat 90 -> chance ~0.665, so the same 0.8 roll FAILS
    // Same crew, same heist, same collect rolls; only the launch heat differs.
    const base = makeState(crew, { lifetimeCash: CONFIG.tierUnlocks[2] });

    const cool = launchHeist(base, 'bank_vault', 'c1', T0);
    if (!cool.ok) throw new Error('cool launch failed');
    const coolRep = collectHeist(cool.state, cool.state.activeHeists[0].id, cool.state.activeHeists[0].endsAt, seq(0.8, 0.8, 0.8));

    const hot = launchHeist({ ...base, heat: 90, heatUpdatedAt: T0 }, 'bank_vault', 'c1', T0);
    if (!hot.ok) throw new Error('hot launch failed');
    const hotRep = collectHeist(hot.state, hot.state.activeHeists[0].id, hot.state.activeHeists[0].endsAt, seq(0.8, 0.8, 0.8));

    if (!coolRep.report || !hotRep.report) throw new Error('missing report');
    expect(coolRep.report.passCount).toBe(3); // all pass when cool
    expect(hotRep.report.passCount).toBe(0); // all fail when launched hot
    expect(hotRep.report.passCount).toBeLessThan(coolRep.report.passCount);
  });
});

describe('the Fixer (offline auto-collect)', () => {
  const crew = [
    { role: 'driver' as RoleId, skill: 8 },
    { role: 'muscle' as RoleId, skill: 8 },
    { role: 'hacker' as RoleId, skill: 8 },
  ];

  it('auto-collects and relaunches finished jobs while away', () => {
    const s = makeState(crew, { purchasedUpgradeIds: ['the_fixer'] });
    const launched = launchHeist(s, 'smash_grab', 'c1', T0); // 20s job
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;

    const saved = { ...launched.state, lastSaved: T0 };
    const summary = resolveOffline(saved, T0 + 200 * 1000); // ~10 cycles of 20s
    expect(summary.autoCollected).toBeGreaterThan(1);
    expect(summary.autoEarned).toBeGreaterThan(0);
    // nothing is left sitting "ready to collect" - the Fixer handled it (any
    // remaining heist is either back in progress or the chain stopped on heat)
    expect(summary.readyCount).toBe(0);
    expect(summary.state.activeHeists.length).toBeLessThanOrEqual(1);
  });

  it('does nothing without the Fixer (finished job waits to collect)', () => {
    const s = makeState(crew);
    const launched = launchHeist(s, 'smash_grab', 'c1', T0);
    expect(launched.ok).toBe(true);
    if (!launched.ok) return;
    const summary = resolveOffline({ ...launched.state, lastSaved: T0 }, T0 + 200 * 1000);
    expect(summary.autoCollected).toBe(0);
    expect(summary.readyCount).toBe(1);
  });
});
