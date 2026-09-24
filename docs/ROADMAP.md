# Nightfall Syndicate — Roadmap & Project Log

Living record of where the project is, what's shipped, what's planned, and every
idea / request / audit finding worth keeping. Update this in the same commit as
the work it describes. Newest status at the top.

- **Repo:** `painhog/crymsindi` · React 18 + Vite 5 + TypeScript, 100% client-side.
- **Default branch:** `main`. Active dev branch: `claude/lucid-maxwell-muaota`.
- **Checks:** `npm test` (Vitest), `npm run build` (`tsc -b && vite build`). No CI configured yet.

---

## Current status (2026-09-24)

- **Merged to `main`:** the full game (PR #1), **Living-Map Events** (PR #2),
  **Ascension / Legend + Content longevity** (PR #3), **Crew identity** —
  veterancy + specialist recruit tiers (PR #4), **map-slot expansion** to 24
  (PR #5), and **automation batch-dispatch** — "Send all idle crews" on the map
  (PR #6), **first-run onboarding** — the send/wait/collect guide strip
  (PR #7), **audio & juice (game feel)** — collect-moment floater, cash
  count-up, prestige bloom, tactile buttons, mute toggle (PR #8), and **Rival
  Syndicate (turf contests)** — a competitive opponent racing you for jobs
  (PR #9). So `main` now has: core loop, heat, traits & synergies, gear, skill
  training, offline/welcome-back, daily reward, prestige → Notoriety,
  approaches/prep/injuries/featured, living-map events, the second prestige
  layer (Legend), the extended heist catalog + ascension-gated capstone, crew
  veterancy + recruit tiers, a 24-slot board, one-tap batch dispatch, a
  first-run onboarding guide, a full game-feel juice layer, and a rival crew
  contesting the board — now a persistent, escalating feud (PR #10). Noir
  map-first UI default; classic at `?classic=1`.
- **In flight (dev branch):** nothing substantive — the dev branch carries only
  this log update on top of `main`, ready for the next feature. **Save management**
  (portable export/import + a settings panel on the map) merged (PR #12).
- **Playable build:** a single-file HTML build (`npm run build:single` ->
  `dist-single/index.html`) with onboarding + juice was delivered to the user, so
  the whole game runs from one file with no server.
- **Tests:** 186 passing. Build clean.

---

## Feature: Save management (export / import + settings) _(shipped — merged in PR #12)_

The game now rewards long-term investment (rivalries, ascension, career totals),
but saves live only in `localStorage` — fragile, and there's no way to back one
up or move devices. The default map UI also has no settings surface beyond the
mute button. This adds a portable backup and a settings panel.

- [x] **Phase 1 — Export/import engine.** `exportSave(state, now)` → a
      copy-pasteable `NFS1:`-prefixed base64 blob; `importSave(text, now)` →
      validates via the existing `isValidSave`/version/`clampState` pipeline and
      resolves offline time exactly like `loadGame`, returning null (touching
      nothing) for garbage or a wrong-version save. Tolerates a raw-JSON paste and
      a bare base64 blob. GameContext actions `exportSave()`/`importSave()`. UTF-8-
      safe base64 (works in browser + tests). 6 tests. _(commit on dev)_
- [x] **Phase 2 — Settings panel UI.** A gear button in the HUD opens a
      `SettingsDrawer`: a Sound toggle + a live motion-preference note, Save now,
      **Export backup** (copies the blob to the clipboard and shows it to select),
      **Import & replace** (paste + confirm), and a Reset in a Danger section. New
      `gear` icon. Verified headless (panel renders; export produces a valid
      `NFS1:` blob + clipboard copy). _(commit on dev)_

---

## Balance & playtest pass (all systems) _(shipped — merged in PR #11)_

A whole-game balance review now that many reward systems interact (approaches,
prep, featured, events, rivals + rivalry escalation, prestige, ascension,
veterancy). Method: a Monte-Carlo `$/min` probe over the real resolver across
the reward stack + a pacing analysis. **Conclusion: healthy, no config tuning
needed.** Locked the findings behind `engine/balance.test.ts` (4 invariants).

**Findings (crew skill 14 unless noted):**
- **Reward stack** (casino_heist, vs quiet base): loud = 1.18×, loud+featured1.6
  = 1.89×, +a fresh rival contest (spoils 0.5) = 2.84×, +max rivalry (×2 spoils)
  = 3.79×. The realistic *sustained* rate is ~1.9–2.4×; the 3.79× ceiling needs a
  featured job that is *also* contested by a max-level (15-win) nemesis and won —
  a rare, earned corner, not a sustained rate. Featured & events stay mutually
  exclusive per job, and rival spoils are separate cash (never compound the
  payout-mult chain). Not degenerate.
- **Crew-strength gating works:** at skill 14 low/mid tiers are competitive
  (cargo_port ~1407/min) and the capstone is underwater; at skill 20 data_center
  pulls ahead (3406); at skill 26 **sovereign_reserve dominates at ~8889/min**
  (~82% of its raw rate) — the capstone is a genuine earned payoff. (It also
  needs a full 5-member crew: `minMembersFor` = requiredPasses+1.)
- **Pacing:** tier gates $2k → $30k → $180k → $1.2M sit under the $1.5M prestige
  threshold; prestige at $1.5M = +24 Notoriety (more if you push: +34 at $3M);
  first ascension ≈ 4 prestige cycles (75 Notoriety). Single-crew, no-offline
  time to first prestige ≈ 15 h — a conservative bound; multiple crews + the
  Fixer's offline auto-play make it much faster in practice (idle-appropriate).
- **No bug:** `estimateSuccess` returning 0% for the capstone in the probe was an
  under-sized (4-member) probe crew tripping the `minMembers` gate, not a defect —
  real play blocks launching understaffed and shows true odds.

---

## Feature: Rivalry deepening (persistent nemeses) _(shipped — merged in PR #10)_

Makes the rival crews *persistent*, not random. Each named rival now remembers
how many times you've beaten them; the more you win, the harder they come back
and the bigger the spoils — and beating one enough times runs them out of town
for a one-time payoff. Turns the one-shot contests into an ongoing feud.

Architecture note: contest *selection* stays deterministic/stateless (which
rival + job each window). Only the *reward magnitude* reads the stored standing,
so the clean pure-function design is preserved.

- [x] **Phase 1 — Standing + escalation engine.** `GameState.rivalWins`
      (per-rival win counts) + `rivalsDominated` (career totals, back-compat
      defaults + carried across prestige/ascension). Selectors in `engine/rivals.ts`:
      `rivalWinCount`, `rivalryLevel` (one level per `rivalWinsPerLevel` wins),
      `rivalStakeMult` (+`rivalEscalationStep` per level, capped at
      `rivalEscalationMax`), `rivalSpoilsWithStanding`, `isRivalDominated`.
      `collectHeist` now pays escalated spoils (by pre-win standing), increments
      the per-rival win, and fires a one-time domination bonus
      (`rivalDominateTakeMult` × the clinching take) the win that reaches
      `rivalDominateAt`. Report gains `rivalryLevel`/`rivalDominated`/
      `dominationBonus`. 5 tests. _(commit on dev)_
- [x] **Phase 2 — UI.** The dossier callout now reads the standing ("<Rival> is
      back for more — you've taken N from them (Lv L)") with the escalated spoils
      preview; the turf-war banner shows a `Lv L` chip; the Reputation drawer gained
      a **Rivalries rap sheet** (each rival: tag, turf-taken count, rivalry level,
      a gold `RUN OUT` badge when dominated); the debrief gained a gold domination
      chip. Verified headless. _(commit on dev)_
- [x] **Phase 3 — Balance, verify, ship.** Balance reasoned: escalation caps at
      ×2 spoils but needs 15 wins vs one rival (a long, aspirational grind);
      domination pays 5× the clinching take but only once per rival (5 one-time
      bonuses across the whole game). All cash — no meta-economy perturbation.
      **No tuning needed.** Verified headless (dossier standing callout, banner
      level chip, rap sheet with a dominated crew); single-file build rebuilt +
      re-delivered. _(dev)_

---

## Feature: Rival Syndicate (turf contests) _(shipped — merged in PR #9)_

A competitive opponent on the map — a new gameplay axis, not just more content.
A rival crew periodically stakes a claim on one specific job (a deterministic
time window, same architecture as featured jobs and living-map events). Complete
that job successfully before the window closes to **seize the turf**: cash spoils
(a fraction of the take) + a turf-win tally on your record. Miss it and the rival
takes it — no penalty; it's an opt-in challenge (right for an idle game).

Reward is cash (in-economy, no meta-economy perturbation), framed as spoils, and
kept OUT of the payout-multiplier chain (added separately at collect), so there's
no double-dip with featured/event bonuses if a contest lands on a flagged job.

- [x] **Phase 1 — Engine core.** `data/rivals.ts` (rival crew flavor) +
      `engine/rivals.ts` deterministic layer (`rivalForWindow`/`rivalNow`/
      `rivalContestFor`/`rivalContestsHeist`/`msUntilNextRival`/`rivalSpoilsFor`)
      on its own window/seed (distinct from featured & events). Config knobs
      (`rivalWindowSec` 1800, `rivalChance` 0.5, `rivalSpoilsFrac` 0.5). 8 tests.
      Pure/tested, no wiring. _(commit on dev)_
- [x] **Phase 2 — Launch/collect wiring.** `rivalId` snapshotted onto the
      `ActiveHeist` at launch; at collect, a successful contested job sets
      `report.turfSeized`/`rivalSpoils`, adds the spoils cash (outside the payout
      multiplier chain), and increments `GameState.turfWins`. Back-compat: optional
      fields, `turfWins` defaulted in `createInitialState`/`clampState` and carried
      across prestige + ascension. Offline & batch dispatch route through
      `launchHeist`/`collectHeist`, so they're covered for free. 5 wiring tests.
      _(commit on dev)_
- [x] **Phase 3 — Map UI.** Crimson `--nf-crimson` accent throughout. The
      contested pin gets a crimson core + a `TURF` badge (opposite corner from the
      featured/event badge, so a job can show both). A turf-war banner (`RivalBar`)
      with the rival's name + a race countdown, stacked under the event ticker
      (compact on mobile). Dossier: a `Turf war` eyebrow tag + a callout with the
      spoils preview. A conditional `Turf` HUD stat (turf-win record). A `RIVAL_TIP`
      coach tip (fires after 2 jobs). A `Turf seized` debrief chip. Verified headless
      (desktop + mobile). _(commit on dev)_
- [x] **Phase 4 — Balance, verify, build.** Balance reasoned (no probe needed):
      spoils are +50% of the take, gated behind *winning* a contested job during
      its window — the same magnitude band as featured (+25–60%) and events
      (fence +40%), but with a success + timeliness requirement. Cash reward, kept
      out of the multiplier chain, so no runaway stacking even if a contest lands
      on a featured/event job. **No config tuning needed.** Verified headless
      (board banner-stacking, contested pin, dossier callout) on desktop + mobile;
      single-file build rebuilt + re-delivered. _(dev)_

---

## Feature: Audio & juice (game feel) _(shipped — merged in PR #8)_

Deep systems, thin moment-to-moment feedback. Idle games retain on the dopamine
hit of collecting — numbers popping, a satisfying cue, the "one more job" pull.
This layer makes the loop *feel* good the first time and the thousandth.

**Already shipped (found in the codebase):** a WebAudio cue engine (`ui/sfx.ts`)
+ an invisible `SoundFx` consumer, mounted globally in `App.tsx`, so synthesized
cues (launch / success / fail / purchase / ready-ping / prestige / error) already
play on the noir map. The classic `ResourceBar` also already had a cash count-up
+ coin burst. The gap was the **noir map** (default UI) had no visual collect
juice and no mute control.

- [x] **Phase 1 — Collect moment.** `ui/map/juice.ts` — pure
      `floaterFromEvent(event)` maps the one-shot GameEvent to a floating payout
      (money moments only; skips a zero-take bust). `ui/map/NfJuice.tsx` spawns a
      rising, fading "+$X" floater near the HUD on each collect (lime for a clean
      take, magenta for a failed-but-paid job, a "clean" flourish when flawless);
      capped + self-removing. The HUD cash readout now counts up toward gains and
      flashes when it climbs (`CashStat`, reusing `useCountUp`). Added a **mute
      toggle** to the noir HUD (new `sound`/`mute` icons) — audio played on the
      map with no off switch there. All `prefers-reduced-motion`-guarded (count-up
      snaps, floater shows without travel). 5 tests. Verified headless (desktop +
      mobile). _(commit on dev)_
- [x] **Phase 2 — Audio.** Largely pre-existing (see above). Mute toggle added in
      Phase 1 and confirmed firing on the map. No new code needed. _(dev)_
- [x] **Phase 3 — Juice the rest.** Tactile press (`:active` scale) on the primary
      action controls (crew-assign, collect, HUD icons, approach/prep, daily). A
      **prestige/ascend screen bloom** (`.nf-prestige-flash`, triggered off the
      `prestige` GameEvent in `NfJuice`) punctuates the big reset. Ready pins were
      already pulsing (`nf-bob`). All reduced-motion guarded (bloom + presses
      dropped). Verified headless. **Deferred:** veterancy level-up flash (levels
      change slowly; needs level-diff tracking — low payoff for now). _(commit on dev)_
- [x] **Phase 4 — Polish & delivery.** Perf reviewed: the count-up uses rAF only
      during its ~550ms animation, the floater layer renders nothing when idle,
      and nothing new runs on the 250ms tick — no regression. Single-file build
      rebuilt and re-delivered to the user. _(dev)_

---

## Feature: First-run onboarding

A brand-new player lands on a busy map with no idea what to do first. This adds a
prominent, dismissible guide strip under the HUD that walks them through the core
loop — **send a crew → wait for the job → bank the take** — then gets out of the
way for good.

- [x] **Onboarding strip.** `ui/map/onboarding.ts` — a pure `firstRunStep(game,
      now)` state machine: `send` (nothing running) → `wait` (a job in flight) →
      `collect` (a job ready) → `null` once `stats.heistsCompleted > 0` (persists,
      so it never nags a returning player). `ui/map/NfOnboard.tsx` renders a
      cyan-accented `.nf-onboard` strip (step `N/3`, mask icon, title + body, Skip)
      mounted between the HUD and the map stage; Skip is remembered in
      localStorage (`heist-crew-idle/seenMapIntro`). Mobile: icon hidden, text
      wraps. 4 tests. Verified headless (desktop + mobile). _(commit on dev)_

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
5. **Automation depth** — re-verified. Offline is solid (the Fixer auto-collects +
   relaunches while away) and the HUD has one-tap Collect-all. Found + closed a
   map gap: `sendAllIdle` (batch dispatch) existed in the engine but wasn't on the
   map, so re-dispatching mid-game was per-crew. Added a "Send all idle crews"
   button to the Dossier (respects the chosen approach/prep). Done.
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
