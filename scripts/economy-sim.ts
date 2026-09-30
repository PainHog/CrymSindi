// -----------------------------------------------------------------------------
// ECONOMY SIMULATION — auto-player balance harness
// -----------------------------------------------------------------------------
// Run with:  npm run sim
//
// A "sensible but not optimal" bot plays the real engine to first prestige:
// keeps every crew on the best fieldable job (ranked by expected $/sec),
// reinvests surplus into skill/crews, and stops at the prestige threshold. It's
// deterministic (seeded launches) and reports the progression curve, timer
// cadence, heat behavior, and — most usefully — which tiers actually get run.
//
// Honest limits: the bot ignores approaches, prep, featured jobs, living events,
// and rival contests, and plays game-time straight through (no offline). So it
// measures the CORE loop's pacing/economy, not the value of the optional systems.
// Use it to catch dominant strategies, dead content, and walls after any change
// to config.ts or heists.ts.
// -----------------------------------------------------------------------------

import { CONFIG } from '../src/data/config.ts';
import { HEISTS, type HeistDef } from '../src/data/heists.ts';
import {
  createInitialState,
  launchHeist,
  collectHeist,
  deriveHeat,
  isHeistUnlocked,
  healthyCrew,
  estimateSuccess,
  minMembersFor,
  upgradeSkill,
  recruitMember,
  formCrew,
  buySafehouse,
  nextCrewCost,
  nextSafehouseCost,
  skillUpgradeCost,
  recruitTierCost,
  type ActionResult,
  type Crew,
  type GameState,
} from '../src/engine/index.ts';

const HOUR = 3_600_000;
const NOW0 = 1_700_000_000_000;
const CATALOG = HEISTS.filter((h) => !h.minAscend); // exclude ascension-gated capstone
const ROLE_PRIORITY = ['hacker', 'muscle', 'driver', 'lookout'];
const fmt = (n: number) => '$' + Math.round(n).toLocaleString('en-US');
const hrs = (ms: number) => (ms / HOUR).toFixed(2) + 'h';

const memRole = (s: GameState, id: string) => s.members.find((m) => m.id === id)?.role ?? '?';

function canField(s: GameState, crew: Crew, now: number, h: HeistDef): boolean {
  if (crew.status !== 'idle' || !isHeistUnlocked(s, h)) return false;
  const hc = healthyCrew(s, crew, now);
  if (hc.memberIds.length < minMembersFor(h)) return false;
  const roles = new Set(hc.memberIds.map((id) => memRole(s, id)));
  for (const r of h.requiredRoles) if (!roles.has(r)) return false;
  return deriveHeat(s, now) < CONFIG.maxHeat;
}
function bestHeist(s: GameState, crew: Crew, now: number): HeistDef | null {
  let best: HeistDef | null = null;
  let bestRate = -1;
  for (const h of CATALOG) {
    if (!canField(s, crew, now, h)) continue;
    const rate = estimateSuccess(s, h, healthyCrew(s, crew, now), now) * h.payoutPerSec;
    if (rate > bestRate) [bestRate, best] = [rate, h];
  }
  return best;
}
function invest(s: GameState): GameState {
  for (let i = 0; i < 2000; i++) {
    const spend = s.cash * 0.85; // keep a 15% reserve
    const opts: Array<{ cost: number; run: () => ActionResult }> = [];
    for (const crew of s.crews) {
      if (crew.status !== 'idle' || crew.memberIds.length >= 5) continue;
      const roles = new Set(crew.memberIds.map((id) => memRole(s, id)));
      const role = ROLE_PRIORITY.find((r) => !roles.has(r)) ?? ROLE_PRIORITY[crew.memberIds.length % 4];
      opts.push({ cost: recruitTierCost(crew, role, 'street'), run: () => recruitMember(s, crew.id, role, 'street') });
    }
    const up = s.members.filter((m) => m.skill < CONFIG.maxMemberSkill).sort((a, b) => a.skill - b.skill)[0];
    if (up) opts.push({ cost: skillUpgradeCost(up), run: () => upgradeSkill(s, up.id) });
    const staffed = s.crews.every((c) => c.memberIds.length >= 4);
    const openSlot = s.safehouses.find((h) => h.crewIds.length < h.crewSlots);
    if (staffed && openSlot) opts.push({ cost: nextCrewCost(s), run: () => formCrew(s, openSlot.id) });
    if (staffed && s.safehouses.every((h) => h.crewIds.length >= h.crewSlots)) {
      opts.push({ cost: nextSafehouseCost(s), run: () => buySafehouse(s) });
    }
    const aff = opts.filter((o) => o.cost <= spend).sort((a, b) => a.cost - b.cost);
    if (aff.length === 0) break;
    const res = aff[0].run();
    if (!res.ok || !res.state) break;
    s = res.state;
  }
  return s;
}

// ---- run --------------------------------------------------------------------
let s = createInitialState(NOW0);
let t = NOW0;
let seed = 1;
const CAP_MS = 60 * 24 * HOUR;
const STEP_CAP = 500_000;
const gates: Array<[string, number]> = [
  ['tier2 ($2k)', 2000],
  ['tier3 ($30k)', 30000],
  ['tier4 ($180k)', 180000],
  ['tier5 ($1.2M)', 1_200_000],
  ['prestige', CONFIG.prestigeThreshold],
];
const milestones: Record<string, number> = {};
const heistCount: Record<string, number> = {};
const cadence: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
const heatAtLaunch: number[] = [];
let launches = 0, collects = 0, successes = 0, fails = 0, injuries = 0, lastCollectT = NOW0, steps = 0, done = false;

const recordGates = () => {
  for (const [name, thr] of gates) if (milestones[name] === undefined && s.lifetimeCash >= thr) milestones[name] = t - NOW0;
};

while (t - NOW0 < CAP_MS && steps < STEP_CAP && !done) {
  steps++;
  let again = true;
  while (again) {
    again = false;
    for (const a of [...s.activeHeists]) {
      if (a.endsAt > t) continue;
      const before = s.members.filter((m) => m.downUntil && m.downUntil > t).length;
      const res = collectHeist(s, a.id, t);
      if (res.ok && res.state) {
        s = res.state;
        collects++;
        again = true;
        const rep = (res as ActionResult & { report?: { success: boolean; heistId: string } }).report;
        if (rep) {
          rep.success ? successes++ : fails++;
          const tier = HEISTS.find((h) => h.id === rep.heistId)?.tier ?? 1;
          cadence[tier]?.push(t - lastCollectT);
          lastCollectT = t;
        }
        if (s.members.filter((m) => m.downUntil && m.downUntil > t).length > before) injuries++;
      }
    }
  }
  recordGates();
  s = invest(s);
  recordGates();
  if (milestones['prestige'] !== undefined) { done = true; break; }
  for (const crew of s.crews) {
    if (crew.status !== 'idle') continue;
    const h = bestHeist(s, crew, t);
    if (!h) continue;
    heatAtLaunch.push(deriveHeat(s, t));
    const res = launchHeist(s, h.id, crew.id, t, seed++, CONFIG);
    if (res.ok && res.state) { s = res.state; launches++; heistCount[h.id] = (heistCount[h.id] ?? 0) + 1; }
  }
  const next = s.activeHeists.reduce((m, a) => Math.min(m, a.endsAt), Infinity);
  t = next === Infinity ? t + 60_000 : Math.max(next, t + 1);
}

// ---- report -----------------------------------------------------------------
const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
console.log('=== NIGHTFALL SYNDICATE — auto-player economy pass ===');
console.log(`prestige threshold ${fmt(CONFIG.prestigeThreshold)}, steps used ${steps}\n`);
console.log('--- time to milestones (in-game elapsed) ---');
for (const [name] of gates) console.log(`  ${name.padEnd(16)} ${milestones[name] !== undefined ? hrs(milestones[name]) : 'NOT REACHED'}`);
console.log(`\n--- totals ---`);
console.log(`  launches ${launches}, collects ${collects}, success ${collects ? Math.round((successes / collects) * 100) : 0}%, injuries ${injuries}`);
console.log(`  final cash ${fmt(s.cash)}, lifetime ${fmt(s.lifetimeCash)}, crews ${s.crews.length}, members ${s.members.length}`);
console.log(`  heat at launch: avg ${avg(heatAtLaunch).toFixed(0)}, max ${Math.max(0, ...heatAtLaunch).toFixed(0)} (cap ${CONFIG.maxHeat})`);
console.log(`\n--- action cadence (avg min between collects, by job tier) ---`);
for (const tier of [1, 2, 3, 4, 5]) if (cadence[tier].length) console.log(`  tier ${tier}: every ${(avg(cadence[tier]) / 60000).toFixed(1)} min (${cadence[tier].length})`);
console.log(`\n--- heist usage (jobs the bot actually ran) ---`);
Object.entries(heistCount).sort((a, b) => b[1] - a[1]).forEach(([id, n]) => console.log(`  ${id.padEnd(18)} ${n}`));
