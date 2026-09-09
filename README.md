# Heist Crew Idle

An **active** idle heist-crew management game — a first playable proof of concept.

You run a criminal operation: buy **safehouses** that house **crews**, staff crews with
**members** (specialists), and send crews on **heists** that resolve over real time for Cash.
Reinvest Cash to grow a one-crew hustle into a syndicate.

It is deliberately **not** fully automated. Heists do not auto-repeat. You return, **check in**,
**collect** a finished job (which frees the crew), then **assign and launch** the next one. An
uncollected finished heist keeps its crew locked, so progress stalls until you come back — that
return-to-launch step is the core habit.

Runs 100% client-side. All state lives in memory and is saved to `localStorage`. No server, no
accounts, no external services.

---

## Run it

```bash
npm install
npm run dev      # start the dev server (prints a localhost URL)
```

## Build for static hosting

```bash
npm run build    # type-checks, then outputs a static site to dist/
npm run preview  # locally serve the built dist/ to sanity-check it
```

`dist/` is a plain static bundle with **relative asset paths** (`vite.config.ts` sets
`base: './'`), so you can drop it straight onto itch.io, GitHub Pages, or any subfolder of your own
site with zero server logic. For itch.io: zip the **contents** of `dist/` (with `index.html` at the
top level) and upload as an HTML project.

## Test

```bash
npm test         # run the unit tests once (Vitest)
npm run test:watch
```

The tests cover the two things most worth locking down: the **heist resolution math**
(success chance, payout, roll-at-collect success/failure) and the **timestamp-based
offline/idle + heat-cooldown math** (including the offline cap).

---

## How the game works (mechanics worth knowing)

- **Timestamps are the source of truth.** A launched heist stores `startedAt` / `endsAt`. It is
  never advanced by a tick loop. On load (and on tab focus) elapsed real time is computed and a
  heist that finished while you were away is simply **"ready to collect."** The on-screen countdown
  is a display-only clock and never affects earnings or completion.
- **Per-member resolution at collect.** Success is resolved when you collect, not when you launch.
  Each member rolls once against the job's difficulty (their chance scales off skill + gear, minus
  current Heat). The heist succeeds if every required role has a member who passed AND enough
  members pass overall (`requiredPasses` grows with difficulty — that's why higher tiers need
  bigger crews). Collecting always frees the crew.
- **After-action report (play-by-play).** Every collect produces a debrief: what each member did
  and how it went (flawless / clean / shaky / botched), the factors that drove the outcome, and
  concrete recommendations for where to invest (train the weak link, gear them, cover a thin role,
  cool the Heat, push for the perfect bonus).
- **Crews: 3 to 8 members.** A heist needs at least 3 members; crews hold up to 8. Bigger crews
  cover more roles and give redundancy against failed rolls, which higher tiers demand.
- **Time-based income, scaled by performance.** The base take = `payoutPerSec * duration`, then
  scaled by how many members passed (a barely-successful run pays a floor fraction, a stronger run
  pays more). A flawless run — everyone passed — pays a bonus on top.
- **Crew locking.** An assigned crew is locked for the whole heist and stays locked after it
  finishes until you collect. Locked crews show as unavailable.
- **Heat** rises when you launch a job and cools continuously over real time (capped for very long
  absences). High Heat lowers every member's odds; at max Heat you can't launch until it cools.
- **Parallelism = more crews.** Because a heist locks a whole crew, running several at once means
  owning several crews, which needs safehouse capacity. That's the scaling fantasy.

---

## Where to edit content (data-driven map)

All game **content and tuning** lives in `src/data/` — add or rebalance content by editing data,
not by touching systems.

| You want to change...                        | Edit this file                |
| -------------------------------------------- | ----------------------------- |
| Costs, crew min/max, resolution + payout constants, Heat math, offline cap, unlock thresholds | `src/data/config.ts` |
| Roles (Hacker, Muscle, Driver, Lookout, …), recruit cost, base skill | `src/data/roles.ts` |
| Safehouse tiers + crew-slot capacity / upgrade costs | `src/data/safehouses.ts` |
| Gear / tools and their skill bonuses         | `src/data/gear.ts`            |
| Heists — roles required, duration, payoutPerSec, Heat, difficulty, tier | `src/data/heists.ts` |
| Global upgrades (Heat/payout multipliers) and their costs | `src/data/upgrades.ts` |
| Recruited-member name pool                   | `src/data/names.ts`           |

The **simulation/economy logic** is separate from the UI, in `src/engine/`:

| File                        | Responsibility                                                        |
| --------------------------- | -------------------------------------------------------------------- |
| `engine/types.ts`           | Core data model + the after-action report types                     |
| `engine/selectors.ts`       | Pure derived reads: crew power, costs, Heat, roles, statuses         |
| `engine/heat.ts`            | Heat settle/add helpers (timestamp-based)                            |
| `engine/resolution.ts`      | Per-member resolution, success estimate, and the play-by-play report |
| `engine/heists.ts`          | Launch (crew/role/size checks) + collect                            |
| `engine/economy.ts`         | Cash sinks: buy/upgrade/recruit/gear/skill/upgrades                  |
| `engine/state.ts`           | Initial state, offline resolution, save/load (localStorage)          |

UI lives in `src/ui/` and only reads state + dispatches actions — it never computes economy, Heat,
or success itself, so the UI and engine can't disagree. The React ↔ engine bridge is
`src/store/GameContext.tsx` (also handles autosave and save-on-close).

---

## Content in this proof of concept

- 1 starting safehouse (room to buy a 2nd and to expand capacity); a starting crew of 3, crews of
  up to 8 members (min 3 to run a heist)
- 4 roles, 5 gear items, 4 global upgrades
- Ten heists across five tiers, gated by lifetime earnings, spanning a full
  duration ladder for both quick check-ins and long idle sessions:
  - Tier 1 (always on): 20s / 45s / 90s
  - Tier 2 ($3k): 5 min / 10 min
  - Tier 3 ($20k): 15 min / 30 min
  - Tier 4 ($120k): 1 hour / 5 hours
  - Tier 5 ($600k): 12 hours
- Resources: Cash and Heat (heat builds as you run crews and cools over real time)

It's intentionally shallow but complete end to end — enough to feel the
safehouse → crew → member → heist loop. Expand it by editing the data files above.

## Notes

- No copyrighted or trademarked assets — visuals are plain CSS; names/theme are original.
- Use the **Reset game** button (top right) to clear your save while testing.
