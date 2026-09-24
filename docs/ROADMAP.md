# Nightfall Syndicate — Roadmap & Project Log

Living record of where the project is, what's shipped, what's planned, and every
idea / request / audit finding worth keeping. Update this in the same commit as
the work it describes. Newest status at the top.

- **Repo:** `painhog/crymsindi` · React 18 + Vite 5 + TypeScript, 100% client-side.
- **Default branch:** `main`. Active dev branch: `claude/lucid-maxwell-muaota`.
- **Checks:** `npm test` (Vitest), `npm run build` (`tsc -b && vite build`). No CI configured yet.

---

## Current status (2026-09-24)

- **Merged to `main`:** the full game (PR #1), **Living-Map Events** (PR #2), and
  **Ascension / Legend + Content longevity** (PR #3). So `main` now has: core loop,
  heat, traits & synergies, gear, skill training, offline/welcome-back, daily
  reward, prestige → Notoriety, approaches/prep/injuries/featured, living-map
  events, the second prestige layer (Legend), and the extended heist catalog +
  ascension-gated capstone. Noir map-first UI default; classic at `?classic=1`.
- **In flight (dev branch):** Crew identity — **all 3 phases DONE** (veterancy
  engine + UI + specialist recruit tiers). Ready for a PR to `main`.
- **Tests:** 176 passing. Build clean.

---

## Feature: Crew identity (veterancy)

Members earn XP from every job and level up (0–10) for a small permanent
effective-skill bonus, so your long-serving crew grow into distinct, valuable
veterans — attachment, and a sharper sting when an injury benches one.

- [x] **Phase 1 — Veterancy engine.** `Member.xp` (+ clamp/legacy default);
      `memberLevel` = `min(max, floor(sqrt(xp/base)))`, `veteranBonus`,
      `veteranXpForLevel`, `xpForHeist`; XP awarded to every participant at collect
      (win or lose, scaled by difficulty + outcome); veteran bonus folded into
      `memberEffectiveSkill` (flows to odds/power everywhere). Config-driven
      (level 1 ≈ 2 early jobs, ~100+ to max at +3 skill). 7 tests. _(commit on dev)_
- [x] **Phase 2 — UI.** Crew-drawer member rows show a gold **Lv N** chip + an XP
      progress bar (green at max). Fixed a display bug the fractional veteran bonus
      exposed: PWR/OUTPUT and the debrief's per-member skill are now rounded for
      display (raw value still drives the odds). Verified headless. _(commit on dev)_
- [x] **Phase 3 — Specialist recruit tiers.** Hire at Street (base), Pro (+3 skill,
      ×2.5 cost) or Elite (+6 skill, ×6 cost) — pay more for a stronger starting
      member. `data/recruits.ts` + `recruitTierCost`/`recruitTierSkill` selectors +
      `recruitMember(tierId)` + GameContext + a tier selector in the crew drawer.
      5 tests. Verified headless. _(commit on dev)_

---

## Feature: Ascension / Legend (second prestige layer) _(shipped — merged in PR #3)_

A meta layer above Notoriety, for long-game retention past the first prestige.
**Ascend** ("become a legend") burns your Notoriety and the whole Notoriety perk
tree for permanent **Legend**, which buys a stronger **legend perk tree** that
persists across ascension. Each ascension restarts the Notoriety loop on a bigger
permanent floor.

- [x] **Phase 1 — Engine core.** `data/legendPerks.ts` catalog (Kingpin, Reputation
      Engine, Deep Pockets); config knobs (`ascendThreshold` 75, `legendDivisor` 40,
      effect magnitudes); `GameState.legend/ascendCount/legendPerks` with clamp +
      legacy-save defaults; selectors (`legendGainFor`, `canAscend`, `legendPerkLevel`,
      and effect selectors `legendPayoutMult`/`legendNotorietyMult`/`legendStartCash`);
      `ascend` + `buyLegendPerk` actions. 10 tests. Effects not yet applied to the
      economy. _(commit on dev branch)_
- [x] **Phase 2 — Effect wiring.** `legendPayoutMult` folded into the resolution
      payout mult; `legendNotorietyMult` scales prestige's Notoriety gain;
      `legendStartCash` funds the fresh run in both `prestige` and `ascend`. 5
      wiring tests (payout ratio, notoriety scaling, start cash on both resets,
      neutral with no perks). _(commit on dev branch)_
- [x] **Phase 3 — UI.** `ascend`/`buyLegendPerk` wired through GameContext. The
      Reputation drawer gained an Ascension section (magenta, vs. amber Notoriety):
      Legend balance, the ascend gate/button with gain preview, and the legend
      tree. First-ascend coach tip added. Verified headless (desktop + mobile).
      _(commit on dev branch)_
- [x] **Phase 4 — Balance & polish.** Probe confirmed a healthy cadence — first
      ascension ≈ 4 prestiges for 1 Legend (immediately buys Kingpin 1); slow
      accrual after (2 @300 Notoriety, 5 @1200); payout ceiling from meta perks
      ×4 (Reputation ×2 × Kingpin ×2) at full deep-endgame investment; whole
      legend tree costs 243 Legend (long aspirational tail). **No config tuning
      needed.** Polish: Legend surfaced in the HUD once earned. No new animations
      (ascension UI is static; existing reduced-motion covers the rest).
      _(commit on dev branch)_
      **Tuning candidate for real playtest:** the first ascension is a deliberate
      step-back (burn perks for 1 permanent Legend); if it feels bad in play, lower
      `legendDivisor` or `ascendThreshold` so the first payoff is 2 Legend.

---

## Feature: Content longevity _(shipped — merged in PR #3)_

More rungs on the climb, and content that rewards ascension. Fills out the board
(more targets for events/featured) and gives the deep meta a reason to re-play.

- [x] **Phase 1 — New heists.** Four new jobs on-curve with fresh role combos:
      Pickpocket Ring (t1, lookout), Jewel Courier (t2, driver+lookout), Penthouse
      Job (t3, hacker+muscle), Rail Yard Heist (t4, muscle+driver+lookout). Catalog
      integrity test (well-formed, unique ids, non-overlapping tier bands, board ≤
      SLOTS). Catalog now 14 heists + contract = 15 pins (SLOTS holds 16).
      _(commit on dev branch)_
- [x] **Phase 2 — Ascension-gated capstone.** The Sovereign Reserve (tier 5,
      4 roles, 180 pps / diff 46) unlocks only after ascending, via a `minAscend`
      gate on `HeistDef` + `isHeistUnlocked` (still respects the tier gate). Icons
      mapped for all new jobs (reuse existing glyphs). 4 gate tests. _(commit on dev)_
- [x] **Phase 3 — Board polish.** Capstone coach tip added; headless board check at
      full unlock confirmed all **16 pins** (15 heists + contract) lay out without
      overlap, and Legend shows in the HUD. **NOTE: SLOTS is now at capacity (16);
      any further heist needs new map slots in `mapSlots.ts`.** _(commit on dev)_

---

## Feature: Living-Map Events _(shipped — merged in PR #2)_

Time-boxed conditions on the city (a fence in town, a crackdown, a blackout) that
alter specific jobs' take / odds / heat while live. Modelled on featured jobs:
pure functions of the timestamp, no stored state, locked in at launch.

Full scope & rationale: see the "scope" discussion in session history; summary below.

- [x] **Phase 1 — Engine core.** `data/events.ts` catalog, `engine/events.ts`
      deterministic layer (`eventForWindow`/`eventNow`/`eventForHeist`/`eventEffectFor`),
      config knobs, 9 unit tests. Pure/tested, no wiring. _(commit on dev branch)_
- [x] **Phase 2 — Launch/resolve wiring.** `ActiveHeist` gains `eventId` /
      `eventRewardMult` / `eventOddsDelta`, locked in at launch; event heatMult
      applied to launch heat; odds/reward combined with approach/prep/featured at
      resolve. Featured-wins exclusivity. Offline is covered for free (the Fixer
      relaunch goes through `launchHeist`). 5 wiring tests. _(commit on dev branch)_
- [x] **Phase 3 — Map UI.** Top-of-stage event ticker with countdown, per-pin
      RISK/BONUS badge + glow (respecting featured-wins), dossier callout + event
      folded into the take/heat/odds preview, first-event coach tip. Verified
      headless (board, dossier, mobile). _(commit on dev branch)_
- [x] **Phase 4 — Balance & polish.** Monte-Carlo probe confirmed no degenerate
      stack: the strongest event opportunity (`loud + Fence 1.4` ≈ 3456 $/min)
      sits below the already-accepted `loud + Featured 1.6` (≈ 3989), and pressure
      events are real disincentives — so **no config tuning needed**. Added the
      after-action debrief event chip (`eventId` plumbed onto `HeistReport`) and
      reduced-motion for the ticker/coach/report. _(commit on dev branch)_

**v1 event catalog:** Fence in town, Grid blackout, Inside contact (opportunities);
Police crackdown, Turf war (pressure). All pure time-windowed modifiers over
existing jobs.

**Deferred to v2:** one-off special targets (spawning a non-catalog heist), rival
crew contesting a pin, reactive events keyed off the player's heat, per-district
targeting (needs a pin→district map).

---

## Idea & audit backlog

Captured for later; not committed to unless promoted into a feature above.

### "Most impactful next" candidates (from the strategy pass)
1. **Living-map events** — shipped (merged, PR #2).
2. **Second prestige / ascension layer** — shipped (merged, PR #3).
3. **Content longevity** — shipped (merged, PR #3).
4. **Crew identity & attachment** — done (veterancy + specialist recruit tiers,
   above). Remaining idea if revisited: backstory/loyalty flavor.
5. **Automation depth** — make sure crews progress toward running themselves so
   mid-game isn't clicky. Believed handled (Fixer perk + automation ladder);
   re-verify against code before ruling out.
6. **Expand map slots** — done. SLOTS now holds **24** (8 added in the empty gaps),
   so the board has headroom for future heists.

### Audit findings already actioned (shipped)
The earlier "what is the audience craving" audit drove the port of the prototype
depth mechanics — **mission approaches, prep, crew injuries, featured jobs** — all
now in the engine and surfaced on the map. Plus the balance pass (Loud speed
softened), the noir after-action debrief, and map coach tips.

---

## Decisions log

- **2026-09-24 — Ascension reset scope:** ascending resets the **Notoriety layer**
  (notoriety → 0, perk tree → {}, prestigeCount → 0) **and the contract** plus the
  run itself, like a deeper prestige. Legend, the legend perk tree, and true career
  totals (careerCash, stats, milestones, daily streak, marks) carry over. Chosen so
  ascension is a meaningful deeper reset, not just an additive bonus.
- **2026-09-24 — Ascension currency & gain:** currency is **Legend**;
  `gain = floor(sqrt(notoriety / legendDivisor))`, gated at `ascendThreshold` (75)
  Notoriety (a few prestige cycles). Legend perks ~2× a Notoriety perk's magnitude
  to justify the deeper reset. All config-driven, easy to retune in Phase 4.
- **2026-09-23 — Events targeting (v1):** target jobs by **tier / explicit id list**,
  not by district. No pin→district map needed. Districts remain display flavor.
- **2026-09-23 — Events × featured stacking (v1):** **mutually exclusive per job,
  featured wins.** A featured job does not also carry an event (avoids payout
  double-dip and keeps "one special condition per job" legible). Revisit if we
  want rare jackpot stacking with a combined-mult cap.
- **2026-09-23 — `main` base branch:** created at the initial POC commit so PR #1
  had a valid base; the dev branch is restarted from `main` for follow-up work
  (merged history is not re-stacked).

---

## Working conventions

- Engine stays pure/framework-free; UI reads via `useGame()` / engine barrel.
- New time-based systems are **deterministic from the timestamp** (like featured/
  events) so they need no save state and resolve identically offline.
- Every slice: `tsc -b` + `npm test` + `npm run build` green, map UI changes
  verified headless (desktop + mobile), then commit + push to the dev branch.
- Update this file in the same commit as the work it tracks.
