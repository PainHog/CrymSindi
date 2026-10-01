// -----------------------------------------------------------------------------
// BALANCE PROBE — per-tier expected value by crew skill
// -----------------------------------------------------------------------------
// Run with:  npm run balance:probe
//
// Prints each top job's success chance and expected $/sec for a full 5-member
// crew at several skill levels. The design goal is that expected $/sec CLIMBS
// with tier once you're skilled for it (so climbing pays), while early game
// stays gated and the ascension capstone stays hard. Uses the base estimate —
// approaches, prep, perks, gear and veterancy stack ON TOP in real play.
// -----------------------------------------------------------------------------

import { CONFIG } from '../src/data/config.ts';
import { HEISTS_BY_ID } from '../src/data/heists.ts';
import { createInitialState, estimateSuccess, type GameState, type Member } from '../src/engine/index.ts';

const NOW = 1_700_000_000_000;
const JOBS = ['penthouse_job', 'cargo_port', 'subway_vault', 'armored_convoy', 'rail_yard', 'data_center', 'gold_depository', 'central_bank', 'diamond_exchange', 'sovereign_reserve'];

function crewAt(skill: number): GameState {
  const base = createInitialState(NOW);
  const roles = ['hacker', 'muscle', 'driver', 'lookout', 'hacker'];
  const members: Member[] = roles.map((role, i) => ({ id: `m${i + 1}`, name: `M${i}`, role, skill, gearIds: [] }));
  return { ...base, cash: 9e6, lifetimeCash: 9e6, heat: 0, heatUpdatedAt: NOW, members, crews: [{ ...base.crews[0], memberIds: members.map((m) => m.id), maxMembers: 8 }] };
}

for (const skill of [5, 8, 12, 15]) {
  const s = crewAt(skill);
  const crew = s.crews[0];
  console.log(`\n=== full 5-crew, skill ${skill} (max ${CONFIG.maxMemberSkill}) — sorted by expected $/s ===`);
  JOBS.map((id) => {
    const h = HEISTS_BY_ID[id];
    const p = estimateSuccess(s, h, crew, NOW);
    return { id, tier: h.tier, p, rate: p * h.payoutPerSec };
  })
    .sort((a, b) => b.rate - a.rate)
    .forEach((r) => console.log(`  T${r.tier} ${r.id.padEnd(18)} ${(r.p * 100).toFixed(0).padStart(3)}% success   ${r.rate.toFixed(1).padStart(6)} exp $/s`));
}
