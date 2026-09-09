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
import type { Crew, GameState } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCash, formatDuration, pct } from '../format';
import { HeistIcon, Icon, RoleIcon } from '../icons';

function roleNames(ids: string[]): string {
  return ids.map((r) => ROLES_BY_ID[r]?.name ?? r).join(', ');
}

export function HeistList() {
  const { game, now, actions } = useGame();
  const heatMaxed = deriveHeat(game, now) >= CONFIG.maxHeat;

  const idleCrews = game.crews
    .map((c, i) => ({ crew: c, index: i }))
    .filter(({ crew }) => crew.status === 'idle');

  const sorted = [...HEISTS].sort((a, b) => a.tier - b.tier || a.difficulty - b.difficulty);

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-ico">
          <Icon name="mask" size={17} />
        </span>
        The board
      </h2>
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
    <div className="heist-card locked" data-tier={heist.tier}>
      <div className="heist-head">
        <span className="heist-icon-wrap redacted">
          <HeistIcon id={heist.id} size={20} />
        </span>
        <span className="heist-name">{heist.name}</span>
        <span className="stamp-badge stamp-locked">Classified</span>
      </div>
      <p className="locked-note">
        <Icon name="vault" size={13} /> Unlocks at {formatCash(needed)} lifetime take (you have{' '}
        {formatCash(lifetimeCash)})
      </p>
    </div>
  );
}

function NeedsRoles({ roles }: { roles: string[] }) {
  if (roles.length === 0) return <span className="needs-anyone">anyone</span>;
  return (
    <span className="needs-roles">
      {roles.map((r) => (
        <span className="role-ico" data-role={r} key={r} title={ROLES_BY_ID[r]?.name ?? r}>
          <RoleIcon role={r} size={15} />
        </span>
      ))}
    </span>
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
  game: GameState;
  onSend: (heistId: string, crewId: string) => void;
}) {
  return (
    <div className="heist-card" data-tier={heist.tier}>
      <div className="heist-head">
        <span className="heist-icon-wrap">
          <HeistIcon id={heist.id} size={20} />
        </span>
        <span className="heist-name">{heist.name}</span>
        <span className="stamp-badge stamp-tier">Tier {heist.tier}</span>
      </div>
      <p className="heist-desc">{heist.description}</p>

      <div className="heist-meta">
        <Meta
          label="Payout"
          value={`${formatCash(heist.payoutMin)}–${formatCash(heist.payoutMax)}`}
          cash
        />
        <Meta label="Time" value={formatDuration(heist.durationSec)} />
        <Meta label="Heat" value={`+${heist.heatCost}`} />
        <Meta label="Difficulty" value={String(heist.difficulty)} />
        <span className="meta-item">
          <span className="meta-label">Needs</span>
          <NeedsRoles roles={heist.requiredRoles} />
        </span>
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

function Meta({ label, value, cash }: { label: string; value: string; cash?: boolean }) {
  return (
    <span className="meta-item">
      <span className="meta-label">{label}</span>
      <span className={`meta-value ${cash ? 'cash' : ''}`}>{value}</span>
    </span>
  );
}
