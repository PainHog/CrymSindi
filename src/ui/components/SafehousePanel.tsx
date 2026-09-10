import { CONFIG } from '../../data/config';
import { GEAR, gearAllowedForRole } from '../../data/gear';
import { HEISTS_BY_ID } from '../../data/heists';
import { ROLES, ROLES_BY_ID } from '../../data/roles';
import { SAFEHOUSE_TIERS_BY_ID, safehouseTierIndex, SAFEHOUSE_TIERS } from '../../data/safehouses';
import {
  activeHeistForCrew,
  contractHeistDef,
  crewPower,
  getMember,
  memberEffectiveSkill,
  nextCrewCost,
  nextSafehouseCost,
  recruitCost,
  safehouseUpgradeCost,
  skillUpgradeCost,
} from '../../engine';
import type { Crew, Member, Safehouse } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { crewLabel, formatCash, formatCountdown } from '../format';
import { Avatar, Icon, RoleIcon } from '../icons';

export function SafehousePanel() {
  const { game, actions } = useGame();
  const buyCost = nextSafehouseCost(game);

  return (
    <section className="panel">
      <div className="panel-title row">
        <h2>
          <Icon name="safehouse" size={17} /> Safehouses &amp; crews
        </h2>
        <button className="btn small" disabled={game.cash < buyCost} onClick={actions.buySafehouse}>
          + Safehouse · {formatCash(buyCost)}
        </button>
      </div>

      <div className="safehouse-list">
        {game.safehouses.map((safehouse, sIdx) => (
          <SafehouseCard key={safehouse.id} safehouse={safehouse} order={sIdx} />
        ))}
      </div>
    </section>
  );
}

function SafehouseCard({ safehouse, order }: { safehouse: Safehouse; order: number }) {
  const { game, actions } = useGame();
  const tier = SAFEHOUSE_TIERS_BY_ID[safehouse.tierId];
  const tierIdx = safehouseTierIndex(safehouse.tierId);
  const hasUpgrade = tierIdx < SAFEHOUSE_TIERS.length - 1;
  const upgradeCost = safehouseUpgradeCost(safehouse);
  const openSlots = safehouse.crewSlots - safehouse.crewIds.length;

  const crews = safehouse.crewIds
    .map((id) => game.crews.find((c) => c.id === id))
    .filter((c): c is Crew => Boolean(c))
    .map((c) => ({ crew: c, index: game.crews.findIndex((x) => x.id === c.id) }));

  const formCost = nextCrewCost(game);

  return (
    <div className="safehouse-card">
      <div className="safehouse-head">
        <div className="safehouse-id">
          <span className="safehouse-ico">
            <Icon name="safehouse" size={18} />
          </span>
          <div>
            <span className="safehouse-name">
              #{order + 1} · {tier?.name ?? 'Safehouse'}
            </span>
            <span className="safehouse-slots">
              {safehouse.crewIds.length}/{safehouse.crewSlots} crew slots
            </span>
          </div>
        </div>
        {hasUpgrade ? (
          <button
            className="btn small"
            disabled={game.cash < upgradeCost}
            onClick={() => actions.upgradeSafehouse(safehouse.id)}
            title="More crew slots = more concurrent heists"
          >
            Expand · {formatCash(upgradeCost)}
          </button>
        ) : (
          <span className="stamp-badge stamp-tier">Max capacity</span>
        )}
      </div>

      <div className="crew-grid">
        {crews.map(({ crew, index }) => (
          <CrewCard key={crew.id} crew={crew} index={index} />
        ))}

        {Array.from({ length: openSlots }).map((_, i) => (
          <div className="crew-card empty-slot" key={`slot-${i}`}>
            <span className="empty-slot-label">
              <Icon name="crew" size={15} /> Empty crew slot
            </span>
            <button
              className="btn small"
              disabled={game.cash < formCost}
              onClick={() => actions.formCrew(safehouse.id)}
            >
              Form crew · {formatCash(formCost)}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrewCard({ crew, index }: { crew: Crew; index: number }) {
  const { game, actions } = useGame();
  const onHeist = crew.status === 'onHeist';
  const active = activeHeistForCrew(game, crew.id);
  const heist = active
    ? active.contractLevel != null
      ? contractHeistDef(active.contractLevel)
      : HEISTS_BY_ID[active.heistId]
    : undefined;
  const openSeats = crew.maxMembers - crew.memberIds.length;
  const power = crewPower(game, crew);

  return (
    <div className={`crew-card ${onHeist ? 'locked' : ''}`}>
      <div className="crew-head">
        <span className="crew-name">
          <span className="crew-ico">
            <Icon name="crew" size={15} />
          </span>
          {crewLabel(index)}
        </span>
        <span className="crew-head-right">
          {crew.memberIds.length > 0 && (
            <span className="crew-power" title="Total crew power (member skill + gear + notoriety)">
              ⚡ {Math.round(power)}
            </span>
          )}
          <span className="crew-size">
            {crew.memberIds.length}/{crew.maxMembers}
          </span>
          {onHeist ? (
            <span className="stamp-badge stamp-locked">Locked</span>
          ) : (
            <span className="stamp-badge stamp-idle">Idle</span>
          )}
        </span>
      </div>

      {onHeist && heist && active && (
        <CrewJobStatus heistName={heist.name} activeId={active.id} endsAt={active.endsAt} />
      )}

      <div className="member-list">
        {crew.memberIds.length === 0 && <p className="hint">No members yet — recruit below.</p>}
        {crew.memberIds.map((id) => {
          const m = getMember(game, id);
          return m ? <MemberRow key={id} member={m} locked={onHeist} /> : null;
        })}
      </div>

      {!onHeist && crew.memberIds.length < CONFIG.minCrewForHeist && (
        <p className="hint warn crew-min-hint">
          Need {CONFIG.minCrewForHeist}+ members to run a heist.
        </p>
      )}

      {!onHeist && openSeats > 0 && (
        <div className="recruit-row">
          <span className="recruit-label">Recruit ({openSeats} open)</span>
          <div className="recruit-buttons">
            {ROLES.map((role) => {
              const cost = recruitCost(crew, role.id);
              return (
                <button
                  key={role.id}
                  className="btn tiny"
                  data-role={role.id}
                  disabled={game.cash < cost}
                  title={role.description}
                  onClick={() => actions.recruit(crew.id, role.id)}
                >
                  <span className="role-ico">
                    <RoleIcon role={role.id} size={13} />
                  </span>
                  {role.name} · {formatCash(cost)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CrewJobStatus({
  heistName,
  activeId,
  endsAt,
}: {
  heistName: string;
  activeId: string;
  endsAt: number;
}) {
  const { actions } = useGame();
  const now = useNow();
  const ready = now >= endsAt;
  return (
    <>
      <div className={`crew-tape ${ready ? 'ready' : ''}`}>
        {ready ? 'Ready to collect' : 'On the job — do not disturb'}
      </div>
      <p className="active-note" style={{ marginBottom: ready ? 8 : 0 }}>
        <Icon name="clock" size={13} /> {heistName} ·{' '}
        {ready ? (
          <strong style={{ color: 'var(--brass)' }}>done</strong>
        ) : (
          formatCountdown(endsAt - now)
        )}
      </p>
      {ready && (
        <button className="btn small primary block" onClick={() => actions.collect(activeId)}>
          Collect the take
        </button>
      )}
    </>
  );
}

function MemberRow({ member, locked }: { member: Member; locked: boolean }) {
  const { game, actions } = useGame();
  const role = ROLES_BY_ID[member.role];
  const effective = memberEffectiveSkill(member);
  const gearBonus = effective - member.skill;
  const skillCost = skillUpgradeCost(member);
  const maxed = member.skill >= CONFIG.maxMemberSkill;
  const unowned = GEAR.filter(
    (g) => gearAllowedForRole(g, member.role) && !member.gearIds.includes(g.id),
  );

  return (
    <div className={`member-row ${locked ? 'dim' : ''}`} data-role={member.role}>
      <Avatar role={member.role} name={member.name} size={44} />

      <div className="member-info">
        <div className="member-main">
          <span className="member-name">{member.name}</span>
          <span className="member-role">{role?.name ?? member.role}</span>
          <span className="member-skill">
            skill {effective}
            {gearBonus > 0 && (
              <span className="skill-bonus">
                {' '}
                ({member.skill}+{gearBonus})
              </span>
            )}
          </span>
        </div>

        {member.gearIds.length > 0 && (
          <div className="gear-chips">
            {member.gearIds.map((gid) => (
              <span className="chip" key={gid}>
                {GEAR.find((g) => g.id === gid)?.name ?? gid}
              </span>
            ))}
          </div>
        )}

        {!locked && (
          <div className="member-actions">
            <button
              className="btn tiny"
              disabled={maxed || game.cash < skillCost}
              onClick={() => actions.upgradeSkill(member.id)}
            >
              {maxed ? 'Skill maxed' : `Train · ${formatCash(skillCost)}`}
            </button>
            {unowned.map((g) => (
              <button
                key={g.id}
                className="btn tiny ghost"
                disabled={game.cash < g.cost}
                title={
                  g.description +
                  (g.role ? ` (${ROLES_BY_ID[g.role]?.name} only)` : ' (any role)')
                }
                onClick={() => actions.buyGear(member.id, g.id)}
              >
                +{g.name} · {formatCash(g.cost)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
