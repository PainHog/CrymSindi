import { useEffect, useRef } from 'react';
import { CONFIG } from '../../data/config';
import { GEAR_BY_ID, gearForRole } from '../../data/gear';
import type { GearDef } from '../../data/gear';
import { ROLES_BY_ID } from '../../data/roles';
import { skillUpgradeCost } from '../../engine';
import type { BeatQuality, HeistReport, Member, MemberBeat, Recommendation } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCash, pct } from '../format';
import { Avatar, HeistIcon, Icon } from '../icons';

const QUALITY_LABEL: Record<BeatQuality, string> = {
  flawless: 'Flawless',
  clean: 'Clean',
  shaky: 'Shaky',
  botched: 'Botched',
};

const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

export function ReportModal() {
  const { report, actions } = useGame();
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!report) return;
    returnFocusRef.current = document.activeElement;
    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        actions.dismissReport();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!nodes || nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocusRef.current instanceof HTMLElement) returnFocusRef.current.focus();
    };
  }, [report, actions]);

  if (!report) return null;
  return (
    <div className="modal-backdrop" onClick={actions.dismissReport}>
      <div
        className={`report${report.perfect ? ' flawless' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Debrief: ${report.heistName}`}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <Header report={report} onClose={actions.dismissReport} />
        <Summary report={report} />

        <p className={`turning-point ${report.success ? 'good' : 'bad'}`}>
          <Icon name={report.success ? 'target' : 'heat'} size={14} /> {report.turningPoint}
        </p>

        <section className="report-section">
          <h3 className="report-h">Play-by-play</h3>
          <div className="beat-list">
            {report.members.map((m) => (
              <Beat key={m.memberId} beat={m} />
            ))}
          </div>
        </section>

        {report.factors.length > 0 && (
          <section className="report-section">
            <h3 className="report-h">What drove it</h3>
            <ul className="factor-list">
              {report.factors.map((f, i) => (
                <li key={i} className={f.positive ? 'good' : 'bad'}>
                  <span className="factor-mark">{f.positive ? '▲' : '▼'}</span>
                  <span>
                    <strong>{f.label}.</strong> {f.note}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {report.recommendations.length > 0 && (
          <section className="report-section">
            <h3 className="report-h">Where to invest</h3>
            <ul className="rec-list">
              {report.recommendations.map((r, i) => (
                <li key={i}>
                  <span className="rec-kind">{r.kind}</span>
                  <span className="rec-text">{r.text}</span>
                  <RecAction rec={r} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="report-actions">
          <button
            className="btn"
            onClick={() => {
              actions.launch(report.heistId, report.crewId);
              actions.dismissReport();
            }}
          >
            <Icon name="target" size={13} /> Run it again
          </button>
          <button className="btn primary" onClick={actions.dismissReport}>
            Close debrief
          </button>
        </div>
      </div>
    </div>
  );
}

function Header({ report, onClose }: { report: HeistReport; onClose: () => void }) {
  const stampClass = report.perfect ? 'stamp-ready' : report.success ? 'stamp-idle' : 'stamp-locked';
  const stampText = report.perfect ? 'Flawless' : report.success ? 'Success' : 'Blown';
  return (
    <div className="report-head">
      <span className="report-ico" data-tier={report.success ? undefined : 'fail'}>
        <HeistIcon id={report.heistId} size={22} />
      </span>
      <div className="report-title">
        <span className="report-name">{report.heistName}</span>
        <span className="report-crew">{crewLabel(report.crewLabelIndex)}</span>
      </div>
      <span className={`stamp-badge ${stampClass}`}>{stampText}</span>
      <button className="report-close" aria-label="Close debrief" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

function Summary({ report }: { report: HeistReport }) {
  const takeClass = report.success ? 'cash' : report.payout > 0 ? 'salvage' : 'muted';
  return (
    <div className="report-summary">
      <div className="sum-cell">
        <span className="sum-label">Take</span>
        <span className={`sum-value ${takeClass}`}>
          {report.payout > 0 ? formatCash(report.payout) : 'No take'}
        </span>
        {report.perfectBonus > 0 && (
          <span className="sum-sub">incl. +{formatCash(report.perfectBonus)} bonus</span>
        )}
        {!report.success && report.payout > 0 && (
          <span className="sum-sub">salvage — grabbed what they could</span>
        )}
      </div>

      <div className="sum-cell wide">
        <span className="sum-label">
          Crew performance · {report.passCount}/{report.crewSize} passed ({pct(report.quality)})
        </span>
        <div className="quality-track">
          <div
            className={`quality-fill ${report.perfect ? 'perfect' : report.success ? 'ok' : 'fail'}`}
            style={{ width: pct(report.quality) }}
          />
          <div
            className="quality-threshold"
            title={`Needed ${report.requiredPasses} of ${report.crewSize}`}
            style={{ left: `${(report.requiredPasses / Math.max(1, report.crewSize)) * 100}%` }}
          />
        </div>
        <span className="sum-sub">
          needed {report.requiredPasses} clean · difficulty {report.difficulty} · heat{' '}
          {Math.round(report.heatAtResolve)}
        </span>
      </div>
    </div>
  );
}

function Beat({ beat }: { beat: MemberBeat }) {
  const role = ROLES_BY_ID[beat.role];
  const gear = beat.gearIds.map((g) => GEAR_BY_ID[g]?.name ?? g);
  return (
    <div className={`beat ${beat.passed ? 'pass' : 'fail'}`} data-role={beat.role}>
      <Avatar role={beat.role} name={beat.name} size={40} />
      <div className="beat-body">
        <div className="beat-top">
          <span className="beat-name">{beat.name}</span>
          <span className="beat-role">{role?.name ?? beat.role}</span>
          <span className={`beat-q q-${beat.quality}`}>{QUALITY_LABEL[beat.quality]}</span>
        </div>
        <p className="beat-detail">{beat.detail}</p>
        <span className="beat-stats">
          skill {beat.effectiveSkill} · {pct(beat.chance)} chance
          {gear.length > 0 && ` · ${gear.join(', ')}`}
        </span>
      </div>
    </div>
  );
}

/** Cheapest unowned gear a member's role is allowed to buy. */
function bestGearFor(member: Member): GearDef | undefined {
  const buyable = gearForRole(member.role).filter((g) => !member.gearIds.includes(g.id));
  return buyable.slice().sort((a, b) => a.cost - b.cost)[0];
}

/** One-click action for a member-targeted recommendation (train / gear). */
function RecAction({ rec }: { rec: Recommendation }) {
  const { game, actions } = useGame();
  if (!rec.memberId) return null;
  const member = game.members.find((m) => m.id === rec.memberId);
  if (!member) return null;

  if (rec.kind === 'skill') {
    const maxed = member.skill >= CONFIG.maxMemberSkill;
    const cost = skillUpgradeCost(member);
    return (
      <button
        className="btn tiny rec-btn"
        disabled={maxed || game.cash < cost}
        onClick={() => actions.upgradeSkill(member.id)}
      >
        {maxed ? 'Maxed' : `Train · ${formatCash(cost, 'ceil')}`}
      </button>
    );
  }
  if (rec.kind === 'gear') {
    const gear = bestGearFor(member);
    if (!gear) return null;
    return (
      <button
        className="btn tiny rec-btn"
        disabled={game.cash < gear.cost}
        onClick={() => actions.buyGear(member.id, gear.id)}
      >
        +{gear.name} · {formatCash(gear.cost, 'ceil')}
      </button>
    );
  }
  return null;
}
