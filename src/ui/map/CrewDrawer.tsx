// -----------------------------------------------------------------------------
// CREW DRAWER — native noir roster/safehouse management
// -----------------------------------------------------------------------------
// Replaces the classic SafehousePanel inside the map's slide-over. Renders the
// real Safehouse -> Crew -> Member hierarchy and drives the real engine actions
// (form crew, recruit, buy gear, train skill, buy/upgrade safehouse). No game
// logic here — costs and power all come from the engine selectors.
// -----------------------------------------------------------------------------

import { CONFIG } from '../../data/config';
import { gearForRole, GEAR_BY_ID } from '../../data/gear';
import { ROLES } from '../../data/roles';
import { SAFEHOUSE_TIERS_BY_ID, safehouseTierIndex, SAFEHOUSE_TIERS } from '../../data/safehouses';
import { TRAITS_BY_ID } from '../../data/traits';
import {
  crewPower,
  getMember,
  memberEffectiveSkill,
  nextCrewCost,
  nextSafehouseCost,
  recruitCost,
  safehouseUpgradeCost,
  skillUpgradeCost,
  type Crew,
  type Member,
  type Safehouse,
} from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCash } from '../format';
import { Icon, RoleIcon } from '../icons';

export function CrewDrawer() {
  const { game, actions } = useGame();
  const newSafeCost = nextSafehouseCost(game);
  return (
    <div className="nf-mp">
      <div className="nf-mp-head">
        <div className="nf-mp-eyebrow">
          <span className="nf-dos-dot" /> Safehouse
        </div>
        <div className="nf-mp-title">Your Operation</div>
        <div className="nf-mp-sub">
          {game.crews.length} crew{game.crews.length === 1 ? '' : 's'} · {game.members.length} on the payroll ·{' '}
          {formatCash(game.cash)} on hand
        </div>
      </div>
      <div className="nf-mp-body">
        {game.safehouses.map((sh) => (
          <SafehouseBlock key={sh.id} safehouse={sh} />
        ))}
        <button className="nf-wide-btn" disabled={game.cash < newSafeCost} onClick={() => actions.buySafehouse()}>
          Buy new safehouse · {formatCash(newSafeCost)}
        </button>
      </div>
    </div>
  );
}

function SafehouseBlock({ safehouse }: { safehouse: Safehouse }) {
  const { game, actions } = useGame();
  const tier = SAFEHOUSE_TIERS_BY_ID[safehouse.tierId];
  const idx = safehouseTierIndex(safehouse.tierId);
  const maxed = idx >= SAFEHOUSE_TIERS.length - 1;
  const upCost = safehouseUpgradeCost(safehouse);
  const slotsUsed = safehouse.crewIds.length;
  const slotsFree = (tier?.crewSlots ?? 0) - slotsUsed;
  const crewCost = nextCrewCost(game);
  const crews = safehouse.crewIds
    .map((id) => game.crews.find((c) => c.id === id))
    .filter((c): c is Crew => Boolean(c));

  return (
    <section className="nf-sh">
      <div className="nf-sh-top">
        <span className="nf-sh-ic">
          <Icon name="safehouse" size={16} />
        </span>
        <div className="nf-sh-id">
          <div className="nf-sh-name">{tier?.name ?? safehouse.tierId}</div>
          <div className="nf-sh-meta">
            {slotsUsed}/{tier?.crewSlots ?? 0} crew slots
          </div>
        </div>
        {!maxed && (
          <button className="nf-sm-btn" disabled={game.cash < upCost} onClick={() => actions.upgradeSafehouse(safehouse.id)}>
            Upgrade · {formatCash(upCost)}
          </button>
        )}
      </div>

      {crews.map((crew) => (
        <CrewBlock key={crew.id} crew={crew} />
      ))}

      {slotsFree > 0 && (
        <button className="nf-wide-btn ghost" disabled={game.cash < crewCost} onClick={() => actions.formCrew(safehouse.id)}>
          + Form a crew · {formatCash(crewCost)}
        </button>
      )}
    </section>
  );
}

function CrewBlock({ crew }: { crew: Crew }) {
  const { game, actions } = useGame();
  const idx = game.crews.findIndex((c) => c.id === crew.id);
  const members = crew.memberIds.map((id) => getMember(game, id)).filter((m): m is Member => Boolean(m));
  const full = crew.memberIds.length >= crew.maxMembers;

  return (
    <div className="nf-crewblock">
      <div className="nf-crewblock-top">
        <span className="nf-cb-name">{crewLabel(idx)}</span>
        <span className={'nf-cb-status ' + (crew.status === 'onHeist' ? 'busy' : 'idle')}>
          {crew.status === 'onHeist' ? 'On a job' : 'Idle'}
        </span>
        <span className="nf-cb-pw">
          {members.length}/{crew.maxMembers} · PWR {crewPower(game, crew)}
        </span>
      </div>

      {members.map((m) => (
        <MemberRow key={m.id} member={m} />
      ))}

      {!full && (
        <div className="nf-recruit">
          <div className="nf-recruit-label">Recruit a specialist</div>
          <div className="nf-role-row">
            {ROLES.map((r) => {
              const cost = recruitCost(crew, r.id);
              return (
                <button
                  key={r.id}
                  className="nf-role-btn"
                  disabled={game.cash < cost}
                  title={`${r.name} · ${formatCash(cost)}`}
                  onClick={() => actions.recruit(crew.id, r.id)}
                >
                  <RoleIcon role={r.id} size={16} />
                  <span>{r.name}</span>
                  <em>{formatCash(cost)}</em>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const { game, actions } = useGame();
  const eff = memberEffectiveSkill(member);
  const trait = member.traitId ? TRAITS_BY_ID[member.traitId] : undefined;
  const line = gearForRole(member.role);
  const owned = member.gearIds.filter((id) => GEAR_BY_ID[id]?.role === member.role).length;
  const nextGear = line.find((g) => !member.gearIds.includes(g.id));
  const trainCost = skillUpgradeCost(member);
  const maxedSkill = member.skill >= CONFIG.maxMemberSkill;

  return (
    <div className="nf-member">
      <div className="nf-member-top">
        <span className="nf-member-ic">
          <RoleIcon role={member.role} size={16} />
        </span>
        <div className="nf-member-id">
          <div className="nf-member-name">
            {member.name}
            {trait && trait.skillBonus > 0 && (
              <span className="nf-member-trait" title={trait.description}>
                {trait.name}
              </span>
            )}
          </div>
          <div className="nf-member-role">
            {member.role} · skill {member.skill}
          </div>
        </div>
        <div className="nf-member-eff">
          {eff}
          <small>OUTPUT</small>
        </div>
      </div>

      <div className="nf-gearline">
        {line.map((g) => (
          <span key={g.id} className={'nf-pip' + (member.gearIds.includes(g.id) ? ' on' : '')} title={g.name} />
        ))}
        <span className="nf-gname">
          {nextGear ? `${owned}/${line.length} gear` : `Fully equipped (${line.length}/${line.length})`}
        </span>
      </div>

      <div className="nf-member-acts">
        <button className="nf-mact tr" disabled={maxedSkill || game.cash < trainCost} onClick={() => actions.upgradeSkill(member.id)}>
          {maxedSkill ? 'Skill maxed' : `Train +1 · ${formatCash(trainCost)}`}
        </button>
        {nextGear ? (
          <button className="nf-mact gr" disabled={game.cash < nextGear.cost} onClick={() => actions.buyGear(member.id, nextGear.id)}>
            {nextGear.name} +{nextGear.skillBonus} · {formatCash(nextGear.cost)}
          </button>
        ) : (
          <button className="nf-mact gr" disabled>
            Fully equipped
          </button>
        )}
      </div>
    </div>
  );
}
