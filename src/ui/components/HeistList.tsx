import { useMemo } from 'react';
import { CONFIG } from '../../data/config';
import { HEISTS } from '../../data/heists';
import type { HeistDef } from '../../data/heists';
import { ROLES_BY_ID } from '../../data/roles';
import {
  contractHeistDef,
  contractUnlocked,
  crewHasRoles,
  estimateSuccess,
  isHeistUnlocked,
  minMembersFor,
  missingRoles,
} from '../../engine';
import type { Crew, GameState } from '../../engine';
import { useGame } from '../../store/GameContext';
import { useHeatSnapshot } from '../hooks';
import { crewLabel, formatCash, formatDuration, pct } from '../format';
import { HeistIcon, Icon, RoleIcon } from '../icons';

function roleNames(ids: string[]): string {
  return ids.map((r) => ROLES_BY_ID[r]?.name ?? r).join(', ');
}

export function HeistList() {
  const { game, actions } = useGame();
  // Bucketed Heat: re-renders the board only when the rounded value / maxed flag
  // changes (~every 12s as Heat cools), not on every 250ms tick.
  const { roundedHeat, heatMaxed } = useHeatSnapshot(game);

  const idleCrews = game.crews
    .map((c, i) => ({ crew: c, index: i }))
    .filter(({ crew }) => crew.status === 'idle');

  const sorted = [...HEISTS].sort((a, b) => a.tier - b.tier || a.difficulty - b.difficulty);
  const contract = contractUnlocked(game) ? contractHeistDef(game.contractLevel) : null;

  // Success estimates run a Poisson-binomial DP per heist x crew; recompute only
  // when the game or the (rounded) heat changes, not on every 250ms tick.
  const estimates = useMemo(() => {
    const map: Record<string, number> = {};
    const defs = contract ? [...HEISTS, contract] : HEISTS;
    const now = Date.now(); // sampled at recompute time; heat is bucketed below
    for (const heist of defs) {
      for (const crew of game.crews) {
        map[`${heist.id}:${crew.id}`] = estimateSuccess(game, heist, crew, now);
      }
    }
    return map;
    // Recompute on game change or when bucketed heat shifts, not every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, roundedHeat]);

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-ico">
          <Icon name="mask" size={17} />
        </span>
        The board
      </h2>
      <div className="heist-list">
        {contract && (
          <UnlockedHeist
            key="contract"
            heist={contract}
            idleCrews={idleCrews}
            heatMaxed={heatMaxed}
            estimates={estimates}
            game={game}
            onSend={actions.launch}
            onSendAll={actions.sendAllIdle}
          />
        )}
        {sorted.map((heist) =>
          isHeistUnlocked(game, heist) ? (
            <UnlockedHeist
              key={heist.id}
              heist={heist}
              idleCrews={idleCrews}
              heatMaxed={heatMaxed}
              estimates={estimates}
              game={game}
              onSend={actions.launch}
              onSendAll={actions.sendAllIdle}
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
        {formatCash(lifetimeCash, 'floor')})
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
  estimates,
  game,
  onSend,
  onSendAll,
}: {
  heist: HeistDef;
  idleCrews: { crew: Crew; index: number }[];
  heatMaxed: boolean;
  estimates: Record<string, number>;
  game: GameState;
  onSend: (heistId: string, crewId: string) => void;
  onSendAll: (heistId: string) => void;
}) {
  const minMembers = minMembersFor(heist);
  const base = heist.payoutPerSec * heist.durationSec;
  const payLow = formatCash(base * CONFIG.payoutFloorFrac);
  const payHigh = formatCash(base * CONFIG.perfectBonusMult);
  // Idle crews that could actually run this job (size + roles) — gates the
  // "send all" bulk button so it only shows when it saves real clicks.
  const eligibleIdle = idleCrews.filter(
    ({ crew }) => crew.memberIds.length >= minMembers && crewHasRoles(game, crew, heist),
  ).length;

  return (
    <div className="heist-card" data-tier={heist.tier}>
      <div className="heist-head">
        <span className="heist-icon-wrap">
          <HeistIcon id={heist.id} size={20} />
        </span>
        <span className="heist-name">{heist.name}</span>
        <span className="stamp-badge stamp-tier">
          {heist.tier >= 6 ? 'Contract' : `Tier ${heist.tier}`}
        </span>
      </div>
      <p className="heist-desc">{heist.description}</p>

      <div className="heist-meta">
        <Meta label="Take" value={`${payLow}–${payHigh}`} cash />
        <Meta label="Time" value={formatDuration(heist.durationSec)} />
        <Meta label="Crew" value={`${minMembers}+`} />
        <Meta label="Heat" value={`+${heist.heatCost}`} />
        <Meta label="Difficulty" value={String(heist.difficulty)} />
        <span className="meta-item">
          <span className="meta-label">Needs</span>
          <NeedsRoles roles={heist.requiredRoles} />
        </span>
      </div>

      <div className="send-row">
        {idleCrews.length === 0 && <span className="hint">All crews are busy or none exist.</span>}
        {eligibleIdle >= 2 && (
          <button
            className="btn small send-all"
            disabled={heatMaxed}
            title={`Launch this job with all ${eligibleIdle} idle crews that can run it`}
            onClick={() => onSendAll(heist.id)}
          >
            <Icon name="target" size={12} /> Send all idle ({eligibleIdle})
          </button>
        )}
        {idleCrews.map(({ crew, index }) => {
          if (crew.memberIds.length < minMembers) {
            return (
              <button
                key={crew.id}
                className="btn small"
                disabled
                title={`This job needs at least ${minMembers} members`}
              >
                {crewLabel(index)} · needs {minMembers} ({crew.memberIds.length})
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
          const chance = estimates[`${heist.id}:${crew.id}`] ?? 0;
          return (
            <button
              key={crew.id}
              className="btn small primary"
              disabled={heatMaxed}
              title={heatMaxed ? 'Heat is maxed - wait for it to cool' : `Estimated success ${pct(chance)}`}
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
