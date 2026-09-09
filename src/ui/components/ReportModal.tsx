import { ROLES_BY_ID } from '../../data/roles';
import { GEAR_BY_ID } from '../../data/gear';
import type { BeatQuality, HeistReport, MemberBeat } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCash, pct } from '../format';
import { Avatar, HeistIcon, Icon } from '../icons';

const QUALITY_LABEL: Record<BeatQuality, string> = {
  flawless: 'Flawless',
  clean: 'Clean',
  shaky: 'Shaky',
  botched: 'Botched',
};

export function ReportModal() {
  const { report, actions } = useGame();
  if (!report) return null;
  return (
    <div className="modal-backdrop" onClick={actions.dismissReport}>
      <div
        className="report"
        role="dialog"
        aria-modal="true"
        aria-label="Heist report"
        onClick={(e) => e.stopPropagation()}
      >
        <Header report={report} onClose={actions.dismissReport} />
        <Summary report={report} />

        <p className={`turning-point ${report.success ? 'good' : 'bad'}`}>
          <Icon name={report.success ? 'target' : 'heat'} size={14} /> {report.turningPoint}
        </p>

        <section className="report-section">
          <h4 className="report-h">Play-by-play</h4>
          <div className="beat-list">
            {report.members.map((m) => (
              <Beat key={m.memberId} beat={m} />
            ))}
          </div>
        </section>

        {report.factors.length > 0 && (
          <section className="report-section">
            <h4 className="report-h">What drove it</h4>
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
            <h4 className="report-h">Where to invest</h4>
            <ul className="rec-list">
              {report.recommendations.map((r, i) => (
                <li key={i}>
                  <span className="rec-kind">{r.kind}</span>
                  {r.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        <button className="btn primary block" onClick={actions.dismissReport}>
          Close debrief
        </button>
      </div>
    </div>
  );
}

function Header({ report, onClose }: { report: HeistReport; onClose: () => void }) {
  const stampClass = report.perfect
    ? 'stamp-ready'
    : report.success
      ? 'stamp-idle'
      : 'stamp-locked';
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
      <button className="report-close" aria-label="Close" onClick={onClose}>
        ✕
      </button>
    </div>
  );
}

function Summary({ report }: { report: HeistReport }) {
  return (
    <div className="report-summary">
      <div className="sum-cell">
        <span className="sum-label">Take</span>
        <span className={`sum-value ${report.success ? 'cash' : 'muted'}`}>
          {report.success ? formatCash(report.payout) : 'No take'}
        </span>
        {report.perfectBonus > 0 && (
          <span className="sum-sub">incl. +{formatCash(report.perfectBonus)} bonus</span>
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
