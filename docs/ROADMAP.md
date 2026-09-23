# Nightfall Syndicate — Roadmap & Project Log

Living record of where the project is, what's shipped, what's planned, and every
idea / request / audit finding worth keeping. Update this in the same commit as
the work it describes. Newest status at the top.

- **Repo:** `painhog/crymsindi` · React 18 + Vite 5 + TypeScript, 100% client-side.
- **Default branch:** `main`. Active dev branch: `claude/lucid-maxwell-muaota`.
- **Checks:** `npm test` (Vitest), `npm run build` (`tsc -b && vite build`). No CI configured yet.

---

## Current status (2026-09-23)

- **Full game shipped and merged to `main`** (PR #1): core loop, heat, traits &
  synergies, gear, skill training, offline/welcome-back, daily reward, prestige →
  Notoriety perk tree, and the ported prototype mechanics (approaches, prep,
  injuries, featured jobs). Noir map-first UI is the default; classic panel
  layout kept at `?classic=1`.
- **In flight:** Living-Map Events — **Phases 1–3 DONE** (engine core + wiring +
  map UI); Phase 4 (balance & polish) pending.
- **Tests:** 140 passing. Build clean.

---

## Feature: Living-Map Events

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
- [ ] **Phase 4 — Balance & polish.** Monte-Carlo probe vs. economy (event ×
      approach stacking), tune effect ranges, reduced-motion for the ticker,
      after-action debrief event line (needs eventId plumbed onto HeistReport).

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
1. **Living-map events** — chosen; in flight (above).
2. **Second prestige / ascension layer** — a higher meta-currency beyond Notoriety
   to keep the long game rewarding past the first prestige. High retention for
   committed players; lower novelty.
3. **Automation depth** — make sure crews progress toward running themselves so
   mid-game isn't clicky. Believed handled (Fixer perk + automation ladder);
   re-verify against code before ruling out.
4. **Content longevity** — more heists / tiers / a capstone "boss" job for late game.
5. **Crew identity & attachment** — names/faces/backstory progression, rarer
   specialist recruits, to deepen attachment and retention.

### Audit findings already actioned (shipped)
The earlier "what is the audience craving" audit drove the port of the prototype
depth mechanics — **mission approaches, prep, crew injuries, featured jobs** — all
now in the engine and surfaced on the map. Plus the balance pass (Loud speed
softened), the noir after-action debrief, and map coach tips.

---

## Decisions log

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
