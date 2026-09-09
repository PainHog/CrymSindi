import { CONFIG } from '../../data/config';
import { HEISTS } from '../../data/heists';
import type { HeistDef } from '../../data/heists';
import { ROLES_BY_ID } from '../../data/roles';
import {
  crewHasRoles,
  deriveHeat,
  isHeistUnlocked,
  missingRoles,
  successChance,
} from '../../engine';
import type { Crew } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCash, formatDuration, pct } from '../format';

function roleNames(ids: string[]): string {
  return ids.map((r) => ROLES_BY_ID[r]?.name ?? r).join(', ');
}

export function HeistList() {
  const { game, now, actions } = useGame();
  const heatMaxed = deriveHeat(game, now) >= CONFIG.maxHeat;

  // idle crews with their roster index (for stable labels)
  const idleCrews = game.crews
    .map((c, i) => ({ crew: c, index: i }))
    .filter(({ crew }) => crew.status === 'idle');

  const sorted = [...HEISTS].sort((a, b) => a.tier - b.tier || a.difficulty - b.difficulty);

  return (
    <section className="panel">
      <h2 className="panel-title">Available heists</h2>
      <div className="heist-list">
        {sorted.map((heist) =>
          isHeistUnlocked(game, heist) ? (
            <UnlockedHeist
              key={heist.id}
              heist={heist}
              idleCrews={idleCrews}
              heatMaxed={heatMaxed}
              now={now}
              game={game}
              onSend={actions.launch}
            />
          ) : (
            <LockedHeist key={heist.id} heist={heist} lifetimeCash={game.lifetimeCash} />
          ),
        )}
      </div>
    </section>
  );
}

function LockedHeist({ heist, lifetimeCash }: { heist: HeistDef; lifetimeCash: number }) {
  const needed = CONFIG.tierUnlocks[heist.tier] ?? 0;
  return (
    <div className="heist-card locked">
      <div className="heist-head">
        <span className="heist-name">{heist.name}</span>
        <span className="badge tier">Tier {heist.tier}</span>
      </div>
      <p className="locked-note">
        Locked · unlocks at {formatCash(needed)} lifetime take (you have {formatCash(lifetimeCash)})
      </p>
    </div>
  );
}

function UnlockedHeist({
  heist,
  idleCrews,
  heatMaxed,
  now,
  game,
  onSend,
}: {
  heist: HeistDef;
  idleCrews: { crew: Crew; index: number }[];
  heatMaxed: boolean;
  now: number;
  game: ReturnType<typeof useGame>['game'];
  onSend: (heistId: string, crewId: string) => void;
}) {
  return (
    <div className="heist-card">
      <div className="heist-head">
        <span className="heist-name">{heist.name}</span>
        <span className="badge tier">Tier {heist.tier}</span>
      </div>
      <p className="heist-desc">{heist.description}</p>

      <div className="heist-meta">
        <Meta label="Payout" value={`${formatCash(heist.payoutMin)}–${formatCash(heist.payoutMax)}`} />
        <Meta label="Time" value={formatDuration(heist.durationSec)} />
        <Meta label="Heat" value={`+${heist.heatCost}`} />
        <Meta label="Difficulty" value={String(heist.difficulty)} />
        <Meta
          label="Needs"
          value={heist.requiredRoles.length ? roleNames(heist.requiredRoles) : 'anyone'}
        />
      </div>

      <div className="send-row">
        {idleCrews.length === 0 && <span className="hint">All crews are busy or none exist.</span>}
        {idleCrews.map(({ crew, index }) => {
          if (crew.memberIds.length === 0) {
            return (
              <button key={crew.id} className="btn small" disabled title="Recruit members first">
                {crewLabel(index)} · empty
              </button>
            );
          }
          if (!crewHasRoles(game, crew, heist)) {
            const missing = roleNames(missingRoles(game, crew, heist));
            return (
              <button key={crew.id} className="btn small" disabled title={`Missing: ${missing}`}>
                {crewLabel(index)} · needs {missing}
              </button>
            );
          }
          const chance = successChance(game, heist, crew, now);
          return (
            <button
              key={crew.id}
              className="btn small primary"
              disabled={heatMaxed}
              title={heatMaxed ? 'Heat is maxed - wait for it to cool' : `Success ${pct(chance)}`}
              onClick={() => onSend(heist.id, crew.id)}
            >
              Send {crewLabel(index)} · {pct(chance)}
            </button>
          );
        })}
        {heatMaxed && <span className="hint warn">Heat maxed — jobs disabled until it cools.</span>}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </span>
  );
}
