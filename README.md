# Nightfall Syndicate

A noir-neon, **map-first idle heist-crew management game**. You run a criminal operation from a
live city map: buy **safehouses** that house **crews**, staff crews with **members** (specialists),
and send crews on **heists** that resolve over real time for Cash. Reinvest to grow a one-crew
hustle into a syndicate, then prestige and ascend into the long game.

It is deliberately **not** fully automated (until you earn the Fixer). You return, **check in**,
**collect** a finished job (which frees the crew), then **assign and launch** the next one — that
return-to-launch step is the core habit.

Runs **100% client-side**. All state lives in memory and is saved to `localStorage` (and can be
exported to a portable backup code — see the in-game **Settings** panel). No server, no accounts,
no external services.

> **UI:** the noir **map** is the default. Append **`?classic=1`** for the original panel layout.
> The full, up-to-date project log lives in [`docs/ROADMAP.md`](docs/ROADMAP.md).

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

```bash
npm run build:single   # a single self-contained dist-single/index.html (JS+CSS+fonts inlined)
```

The single-file build is one HTML file you can open directly in any browser (no server) or email
around.

### GitHub Pages

A workflow at `.github/workflows/deploy.yml` builds `dist/` and deploys it to GitHub Pages on every
push to `main`. It **auto-enables Pages** on the first run (via `configure-pages` with
`enablement: true`), so it should just work — the live URL appears in the workflow's deploy step.
If your org restricts Pages and that step fails, enable it once by hand (**Settings → Pages →
Build and deployment → Source: GitHub Actions**) and re-run the workflow.

## Test

```bash
npm test         # run the unit tests once (Vitest)
npm run test:watch
```

The tests cover the core systems: the **per-member resolution + payout math**, the
**timestamp-based offline/idle + heat-cooldown math** (including the offline cap and the
Fixer), **save/load** validation, the **economy**, and the **meta-progression**
(prestige/notoriety/milestones/contract).

## Dev / test mode

Append **`?dev=1`** to the URL (e.g. `http://localhost:5173/?dev=1`) to show a hidden
dev panel (bottom-left) for testing without waiting or grinding:

- **+$10k / +$1M** — add cash (also raises lifetime/career, so tiers unlock)
- **+5 Notor.** — add Notoriety
- **Finish jobs** — mark all in-progress heists ready to collect now
- **+1h / +6h / +12h** — fast-forward: simulates having been away that long (long heists
  finish, heat cools, and the Fixer auto-runs), so you can test the 12-hour job and the
  whole progression in seconds
- **Reset** — clear the save

The panel only **renders** when `?dev=1` is present. Be aware the panel code and
the `dev` store actions it calls are still in the shipped bundle — any player can
enable it by appending `?dev=1` to the URL — so it's a testing convenience, not a
cheat-proof boundary. Before a public launch, gate it out at build time (e.g.
behind `import.meta.env.DEV`) so it's stripped from production bundles entirely.

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
  absences). A job is resolved against the Heat it was **launched** under — not the cooled-down
  Heat at collect — so committing a big score (or a burst of parallel crews) while hot genuinely
  costs you, while a patient, cooled-down launch runs clean. At max Heat you can't launch until it
  cools.
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
| Gear / tools (role-locked, three-tier lines) and their skill bonuses | `src/data/gear.ts`    |
| Heists — roles required, duration, payoutPerSec, Heat, difficulty, tier | `src/data/heists.ts` |
| Global upgrades (Heat/payout multipliers, the Fixer) and their costs | `src/data/upgrades.ts` |
| Milestones/achievements (name, description, reward)  | `src/data/milestones.ts`  |
| Notoriety perks (the prestige tree) — effects live in `config.ts` | `src/data/perks.ts`  |
| Member traits (flat skill modifiers, assigned at recruit) | `src/data/traits.ts`     |
| Crew synergies (composition bonuses)         | `src/data/synergies.ts`       |
| Recruited-member name pool (first × last grid) | `src/data/names.ts`         |

The **simulation/economy logic** is separate from the UI, in `src/engine/`:

| File                        | Responsibility                                                        |
| --------------------------- | -------------------------------------------------------------------- |
| `engine/types.ts`           | Core data model + the after-action report types                     |
| `engine/selectors.ts`       | Pure derived reads: crew power, costs, Heat, roles, statuses         |
| `engine/heat.ts`            | Heat settle/add helpers (timestamp-based)                            |
| `engine/resolution.ts`      | Per-member resolution (skill + gear + trait + notoriety + synergy), success estimate, the contract, and the play-by-play report |
| `engine/heists.ts`          | Launch (crew/role/size checks) + collect (+ career stats, turf seize) |
| `engine/featured.ts`        | Featured-job rotation (deterministic from the timestamp)            |
| `engine/events.ts`          | Living-map events (time-boxed modifiers, deterministic)             |
| `engine/rivals.ts`          | Rival Syndicate turf contests + persistent rivalry standing         |
| `engine/batch.ts`           | Batch dispatch ("send all idle crews")                              |
| `engine/economy.ts`         | Cash sinks + prestige/ascension + perk & legend-perk purchases      |
| `engine/monetization.ts`    | Premium currency (Marks) + rewarded-ad reward grants (no network)   |
| `engine/daily.ts`           | Daily login reward + streak                                         |
| `engine/milestones.ts`      | Milestone conditions + awarding                                     |
| `engine/format.ts`          | Number/cash formatting (K/M/B/T, affordability-safe rounding)       |
| `engine/state.ts`           | Initial state, offline resolution (incl. the Fixer), save/load       |

UI lives in `src/ui/` and only reads state + dispatches actions — it never computes economy, Heat,
or success itself, so the UI and engine can't disagree. The React ↔ engine bridge is
`src/store/GameContext.tsx` (persists on every state change and on tab close).

---

## What's in the game

**Core loop & content**
- 1 starting safehouse (buy more, expand capacity); a starting crew of 3, crews up to 8 (min 3 to run a heist).
- 4 roles, 12 gear items (a three-tier line per role), global upgrades, 6 member traits, 3 crew synergies.
- **15 heists across five tiers** (gated by lifetime earnings) on a full duration ladder — 20s quick hits up to 12-hour scores — plus an **ascension-gated capstone** (The Sovereign Reserve) and the repeatable, escalating **Syndicate Contract**.
- **Mission approaches** (Quiet / Loud / Ghost) trade reward vs. Heat vs. time vs. odds; optional **prep** ("case the job") buys an odds bump; failed jobs can **injure** a member (they recover over time or you pay to patch them up).

**Map-first UI**
- A live noir city where every marked building is a heist: click a pin → dossier (real odds) → pick a crew → launch → collect. Crew/roster and Reputation management live in slide-over drawers. A **first-run onboarding** guide walks new players through send → wait → collect.

**Living city**
- **Featured jobs** (hourly rotation, pay a bonus), **living-map events** (a fence in town, a blackout, a crackdown — time-boxed modifiers), and a **Rival Syndicate**: rival crews stake a claim on a job; beat them to it to **seize the turf** for spoils. Rivalries **persist and escalate** — beat one repeatedly and they come back harder (bigger spoils); dominate one to run them out of town. All three systems are pure, deterministic functions of the timestamp — no stored state.

**The long game**
- **Prestige** ("go legit") → permanent **Notoriety**, spent in a perk tree that persists across runs.
- **Ascension** ("become a legend") → a second meta layer: burn your Notoriety + perk tree for permanent **Legend** and a stronger legend-perk tree that survives every ascension.
- **Crew identity**: members earn XP and **level up** (a small permanent skill bonus), and you can recruit at **Street / Pro / Elite** specialist tiers.
- **Milestones**, the **Syndicate Contract**, and **The Fixer** (auto-collects + re-runs jobs while you're away).

**Retention & feel**
- **Daily reward** + streak; a **"while you were away"** summary; a live tab-title ready count.
- **Game-feel juice**: a rising **+$ payout floater** and cash count-up on collect, a prestige/ascension screen bloom, tactile button presses, pin pulses, a FLAWLESS stamp, and synthesized **Web Audio** cues with a mute toggle — everything respects `prefers-reduced-motion`.
- **Save management**: export your progress to a portable backup code and import it on any device (in-game **Settings** panel).
- **Monetization (stubbed, no network)**: a **Marks** premium currency + rewarded-ad hooks behind a swappable provider (see `src/monetization/`).

The whole thing is verified end-to-end: **200+ unit tests**, plus a documented balance pass whose reward-stack and pacing invariants are locked in `src/engine/balance.test.ts`.

## Notes

- No copyrighted or trademarked assets — visuals are plain CSS/SVG; names and theme are original.
- Clear your save from the in-game **Settings** panel (gear icon, top bar) → **Reset game**.
