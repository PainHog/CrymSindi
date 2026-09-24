// -----------------------------------------------------------------------------
// BATCH CREW ACTIONS (quality-of-life)
// -----------------------------------------------------------------------------
// Convenience actions that fold a repetitive series of single actions into one:
//  - sendAllIdle: launch a heist with every idle crew that can run it
//  - gearUpCrew:  buy the cheapest affordable unowned gear across a crew
//  - fillCrew:    recruit toward crew-max, covering missing roles first
// Each is pure and composes the existing single-step engine functions by
// threading state, so the economy/heat/validation rules can't be bypassed.
// -----------------------------------------------------------------------------

import { CONFIG } from '../data/config';
import type { Config } from '../data/config';
import type { ApproachId } from '../data/approaches';
import { gearForRole } from '../data/gear';
import { ROLES } from '../data/roles';
import type { RoleId } from '../data/roles';
import { buyGear, recruitMember } from './economy';
import { launchHeist } from './heists';
import { getCrew, getMember, recruitCost } from './selectors';
import type { ActionResult, GameState } from './types';

/** Launch `heistId` with every idle crew that can run it right now. Crews that
 *  can't (missing roles, too few members, heat maxed) are skipped. Heat rises as
 *  each launches, so later crews in the burst commit under higher heat — the
 *  intended parallel-burst cost (see the launch-heat model). */
export function sendAllIdle(
  state: GameState,
  heistId: string,
  now: number,
  config: Config = CONFIG,
  approachId?: ApproachId,
  prep = false,
): ActionResult {
  let s = state;
  let launched = 0;
  for (const crew of state.crews) {
    if (crew.status !== 'idle') continue;
    const res = launchHeist(s, heistId, crew.id, now, undefined, config, approachId, prep);
    if (res.ok) {
      s = res.state;
      launched += 1;
    }
  }
  if (launched === 0) {
    return { ok: false, error: 'No idle crew can run that job right now.' };
  }
  return { ok: true, state: s, message: `Sent ${launched} crew${launched > 1 ? 's' : ''} on the job.` };
}

/** Greedily buy the cheapest affordable unowned, role-appropriate gear across the
 *  crew, one piece at a time, until nothing more is affordable. */
export function gearUpCrew(state: GameState, crewId: string): ActionResult {
  const crew = getCrew(state, crewId);
  if (!crew) return { ok: false, error: 'Unknown crew.' };
  if (crew.status !== 'idle') return { ok: false, error: 'Cannot gear up a crew on a job.' };

  let s = state;
  let bought = 0;
  for (;;) {
    let best: { memberId: string; gearId: string; cost: number } | null = null;
    for (const memberId of crew.memberIds) {
      const m = getMember(s, memberId);
      if (!m) continue;
      for (const g of gearForRole(m.role)) {
        if (m.gearIds.includes(g.id) || g.cost > s.cash) continue;
        if (!best || g.cost < best.cost) best = { memberId, gearId: g.id, cost: g.cost };
      }
    }
    if (!best) break;
    const res = buyGear(s, best.memberId, best.gearId);
    if (!res.ok) break; // shouldn't happen (we pre-checked), but stay safe
    s = res.state;
    bought += 1;
  }
  if (bought === 0) {
    return { ok: false, error: 'Nothing to gear up — all owned, or not enough cash.' };
  }
  return { ok: true, state: s, message: `Geared up ${bought} piece${bought > 1 ? 's' : ''}.` };
}

/** The next role to recruit into a crew: prefer the cheapest AFFORDABLE role the
 *  crew is missing (coverage + full-deck synergy first), else the cheapest
 *  affordable role for redundancy, else null when nothing is affordable. */
function nextRoleToRecruit(state: GameState, crewId: string, config: Config): RoleId | null {
  const crew = getCrew(state, crewId);
  if (!crew) return null;
  const present = new Set(crew.memberIds.map((id) => getMember(state, id)?.role));
  const affordable = ROLES.map((r) => ({
    id: r.id,
    cost: recruitCost(crew, r.id, config),
    missing: !present.has(r.id),
  })).filter((x) => x.cost <= state.cash);
  if (affordable.length === 0) return null;
  const missing = affordable.filter((x) => x.missing);
  const pool = missing.length > 0 ? missing : affordable;
  pool.sort((a, b) => a.cost - b.cost);
  return pool[0].id;
}

/** Recruit toward crew-max, covering any missing roles first (cheapest affordable
 *  each step), stopping when the crew is full or the next recruit is unaffordable. */
export function fillCrew(state: GameState, crewId: string, config: Config = CONFIG): ActionResult {
  const crew0 = getCrew(state, crewId);
  if (!crew0) return { ok: false, error: 'Unknown crew.' };
  if (crew0.status !== 'idle') return { ok: false, error: 'Cannot recruit into a crew on a job.' };

  let s = state;
  let recruited = 0;
  for (;;) {
    const crew = getCrew(s, crewId);
    if (!crew || crew.memberIds.length >= crew.maxMembers) break;
    const role = nextRoleToRecruit(s, crewId, config);
    if (!role) break; // can't afford another recruit
    const res = recruitMember(s, crewId, role, 'street', config);
    if (!res.ok) break;
    s = res.state;
    recruited += 1;
  }
  if (recruited === 0) {
    return { ok: false, error: 'Crew is full, or you can\'t afford another recruit.' };
  }
  return { ok: true, state: s, message: `Recruited ${recruited} member${recruited > 1 ? 's' : ''}.` };
}
