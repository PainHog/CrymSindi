# Nightfall Syndicate — state of the game

_A noir-neon, map-first idle heist-crew manager. 100% client-side (React 18 +
Vite 5 + strict TypeScript), localStorage saves, built to distribute on itch.io._

**Status: build-complete and itch-launch-ready.** Everything on the feature
plan is shipped to `main`. The remaining items are decisions and an optional art
upgrade, not unfinished work. Not yet human-playtested (balance is validated by
an auto-player sim, not real players).

## What's in the game
- Map-first noir city with real (CC0) cars, people and police on an aligned
  street grid; animated Phaser actor layer; crew portraits.
- Deep crews: 4 roles, gear lines, 18 traits, veteran levels, injuries,
  6 team-up synergies.
- 24 heists across 6 tiers; quiet/loud/ghost approaches, casing, featured jobs.
- Living city: 20 random events, 12 rival gangs contesting turf (each with a
  taunt + an escalation/standing layer).
- Three-layer meta-progression: prestige → 5 notoriety perks; ascension →
  9 legend perks; a tier-6 "legend circuit" of ascension-gated top jobs.
  21 career milestones.
- Polish: sound, juice, first-run onboarding, coach tips.
- Plumbing: save export/import + settings, save-schema migration, dev/cheat
  panel gated out of production, accessibility pass, CI test gate on every PR.

## Launch checklist (what's actually left)
- [ ] **Playtest** with real players — the one true unknown; balance is only
      sim-validated. Highest-value next step.
- [ ] **Upload to itch.io** — `npm run build:itch` produces
      `nightfall-syndicate-itch.zip` (HTML5, index.html at zip root, relative
      paths). One-step upload.
- [ ] **Optional: bespoke map-actor art** — current actors are clean but generic
      CC0 (~7.5/10). Drop-in replacement, zero engine changes: publish art under
      the texture keys in `src/ui/scene/atlas.ts` (see its SWAP-IN SPEC —
      authored facing east, centred origin; the scene handles rotation/scale).
      Source via a trained style model (e.g. Scenario) or a commission.
- Parked (not needed for an itch launch): in-game purchases / reward ads
  (itch has native pricing; `RewardedAdProvider` is a stub), cloud saves
  (localStorage + export/import backup suffice).

## How to resume
- `npm install` then `npm run dev` to play locally.
- `npm test` (Vitest, 236 tests) and `npx tsc --noEmit` before any PR.
- `npm run build` for the production bundle; `npm run build:itch` for the
  upload zip.
- Dev balance tools: `npm run sim` (auto-player economy pass) and
  `npm run balance:probe` (per-tier success/$ by crew skill). These need
  `playwright-core` only for the browser smokes, not for the sim/probe.
- Engine (`src/engine/`) is pure and framework-free; data lives in
  `src/data/`; UI in `src/ui/`. Balance invariants are locked by
  `src/engine/balance.test.ts` and the catalog tests.
- `PORTAL.md` is the plain-language owner-facing status (kept current per
  `CLAUDE.md`).
