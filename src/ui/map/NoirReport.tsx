// -----------------------------------------------------------------------------
// AFTER-ACTION DEBRIEF (noir)
// -----------------------------------------------------------------------------
// The map-first after-action. Same engine data + logic as the classic
// ReportModal (relaunch gate, rewarded double-take, one-click rec actions),
// reskinned into the .nf-* noir dossier language so it belongs on the map
// instead of the classic modal floating over the city. Mounted inside .nfmap
// by MapView so the scoped theme reaches it.
// -----------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { CONFIG } from '../../data/config';
import { EVENTS_BY_ID } from '../../data/events';
import { GEAR_BY_ID, gearForRole } from '../../data/gear';
import type { GearDef } from '../../data/gear';
import { ROLES_BY_ID } from '../../data/roles';
import {
  estimateSuccess,
  getCrew,
  heistDefFor,
  launchBlockReason,
  skillUpgradeCost,
} from '../../engine';
import type { BeatQuality, HeistReport, Member, MemberBeat, Recommendation } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCash, pct } from '../format';
import { useHeatSnapshot, useRewardedAd } from '../hooks';
import { Avatar, HeistIcon, Icon, RoleIcon } from '../icons';

const QUALITY_LABEL: Record<BeatQuality, string> = {
  flawless: 'Flawless',
  clean: 'Clean',
  shaky: 'Shaky',
  botched: 'Botched',
};

const FOCUSABLE = 'button, [href], input, [tabindex]:not([tabindex="-1"])';

// Gate only — a closed debrief mounts nothing (and never subscribes to the Heat
// tick), so it isn't re-rendering 4x/sec just to early-return.
export function NoirReport() {
  const { report } = useGame();
  if (!report) return null;
  return <NoirReportBody report={report} />;
}

type Tone = 'flawless' | 'success' | 'blown';
function toneFor(report: HeistReport): Tone {
  return report.perfect ? 'flawless' : report.success ? 'success' : 'blown';
}
const TONE_ACCENT: Record<Tone, string> = {
  flawless: 'var(--nf-amber)',
  success: 'var(--nf-lime)',
  blown: 'var(--nf-magenta)',
};
const STAMP_TEXT: Record<Tone, string> = { flawless: 'Flawless', success: 'Success', blown: 'Blown' };

function NoirReportBody({ report }: { report: HeistReport }) {
  const { game, actions } = useGame();
  // Bucketed Heat drives the relaunch memo (re-eval ~every 12s as Heat cools)
  // instead of a raw useNow() that would re-run the Poisson-binomial estimate
  // 4x/sec. heatMaxed is the exact boundary the launch gate flips on.
  const { roundedHeat, heatMaxed } = useHeatSnapshot(game);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const { watching, watch, available } = useRewardedAd();
  const [doubled, setDoubled] = useState(false);
  useEffect(() => setDoubled(false), [report]);

  useEffect(() => {
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
      const list = Array.from(nodes);
      const first = list[0];
      const last = list[list.length - 1];
      const within = list.includes(document.activeElement as HTMLElement);
      if (e.shiftKey && (document.activeElement === first || !within)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !within)) {
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

  // "Run it again" must not fire-then-close on a launch that can't happen (the
  // usual culprit: the collect that just landed maxed Heat). Gate on the same
  // predicate the engine uses and surface the reason. Recomputed only on game
  // change or when Heat crosses a bucket, so the block clears live as Heat cools.
  const relaunch = useMemo(() => {
    const now = Date.now();
    const block = launchBlockReason(game, report.heistId, report.crewId, now);
    const heist = heistDefFor(report.heistId, game);
    const crew = getCrew(game, report.crewId);
    const chance = !block && heist && crew ? estimateSuccess(game, heist, crew, now) : 0;
    return { block, chance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, roundedHeat, heatMaxed, report.heistId, report.crewId]);

  const tone = toneFor(report);
  const takeClass = report.success ? 'cash' : report.payout > 0 ? 'salvage' : 'muted';

  return (
    <div className="nf-report-wrap" onClick={actions.dismissReport}>
      <div
        className={`nf-report ${tone}`}
        style={{ '--c': TONE_ACCENT[tone] } as CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={`Debrief: ${report.heistName}`}
        tabIndex={-1}
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="nf-rep-close" aria-label="Close debrief" onClick={actions.dismissReport}>
          ✕
        </button>

        {/* Head */}
        <div className="nf-rep-head">
          <span className="nf-rep-ico">
            <HeistIcon id={report.heistId} size={22} />
          </span>
          <div className="nf-rep-title">
            <div className="nf-rep-eyebrow">
              <span className="nf-rep-dot" /> Debrief · {crewLabel(report.crewLabelIndex)}
              {report.eventId && EVENTS_BY_ID[report.eventId] && (
                <span
                  className={
                    'nf-ev-tag ' +
                    (EVENTS_BY_ID[report.eventId].kind === 'pressure' ? 'pressure' : 'opp')
                  }
                >
                  {EVENTS_BY_ID[report.eventId].name}
                </span>
              )}
              {report.turfSeized && (
                <span className="nf-turf-tag">
                  Turf seized{report.rivalSpoils ? ` +${formatCash(report.rivalSpoils)}` : ''}
                </span>
              )}
            </div>
            <div className="nf-rep-name">{report.heistName}</div>
          </div>
          <span className="nf-rep-stamp">{STAMP_TEXT[tone]}</span>
        </div>

        {/* Take + performance */}
        <div className="nf-rep-summary">
          <div className="nf-rep-take">
            <span className="k">Take</span>
            <span className={`v ${takeClass}`}>
              {report.payout > 0 ? formatCash(report.payout) : 'No take'}
            </span>
            {report.perfectBonus > 0 && (
              <span className="nf-rep-sub">incl. +{formatCash(report.perfectBonus)} flawless bonus</span>
            )}
            {!report.success && report.payout > 0 && (
              <span className="nf-rep-sub">salvage — grabbed what they could</span>
            )}
          </div>

          <div className="nf-rep-perf">
            <div className="nf-rep-perf-k">
              Crew · {report.passCount}/{report.crewSize} passed ({pct(report.quality)})
            </div>
            <div className="nf-rep-qtrack">
              <div className={`nf-rep-qfill ${tone}`} style={{ width: pct(report.quality) }} />
              <div
                className="nf-rep-qthresh"
                title={`Needed ${report.requiredPasses} of ${report.crewSize}`}
                style={{ left: `${(report.requiredPasses / Math.max(1, report.crewSize)) * 100}%` }}
              />
            </div>
            <div className="nf-rep-perf-sub">
              needed {report.requiredPasses} clean · difficulty {report.difficulty} · heat{' '}
              {Math.round(report.heatAtResolve)}
            </div>
            {report.synergies.length > 0 && (
              <div className="nf-rep-syn">
                {report.synergies.map((s) => (
                  <span className="nf-chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className={`nf-rep-turn ${report.success ? 'good' : 'bad'}`}>
          <Icon name={report.success ? 'target' : 'heat'} size={13} /> {report.turningPoint}
        </p>

        {/* Play-by-play */}
        <div className="nf-sect">Play-by-play</div>
        <div className="nf-rep-beats">
          {report.members.map((m) => (
            <Beat key={m.memberId} beat={m} />
          ))}
        </div>

        {/* What drove it */}
        {report.factors.length > 0 && (
          <>
            <div className="nf-sect">What drove it</div>
            <ul className="nf-rep-factors">
              {report.factors.map((f, i) => (
                <li key={i} className={f.positive ? 'good' : 'bad'}>
                  <span className="nf-rep-mark">{f.positive ? '▲' : '▼'}</span>
                  <span>
                    <strong>{f.label}.</strong> {f.note}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Where to invest */}
        {report.recommendations.length > 0 && (
          <>
            <div className="nf-sect">Where to invest</div>
            <ul className="nf-rep-recs">
              {report.recommendations.map((r, i) => (
                <li key={i}>
                  <span className="nf-rep-reckind">{r.kind}</span>
                  <span className="nf-rep-rectext">{r.text}</span>
                  <RecAction rec={r} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Actions */}
        <div className="nf-rep-actions">
          {available && report.success && report.payout > 0 && !doubled && (
            <button
              className="nf-btn ad"
              disabled={watching}
              title="Watch a short ad to double this take"
              onClick={async () => {
                if (await watch('double_take')) {
                  actions.rewardBonusCash(report.payout);
                  setDoubled(true);
                }
              }}
            >
              {watching ? 'Ad…' : `Double the take · +${formatCash(report.payout)}`}
            </button>
          )}
          <button
            className="nf-btn ghost"
            disabled={!!relaunch.block}
            title={relaunch.block ?? `Send this crew back in · ~${pct(relaunch.chance)} success`}
            onClick={() => {
              actions.launch(report.heistId, report.crewId);
              actions.dismissReport();
            }}
          >
            <Icon name="target" size={13} /> Run it again
            {!relaunch.block && <span> · ~{pct(relaunch.chance)}</span>}
          </button>
          <button className="nf-btn go" onClick={actions.dismissReport}>
            Close debrief
          </button>
        </div>
        {relaunch.block && <p className="nf-rep-block">{relaunch.block}</p>}
      </div>
    </div>
  );
}

function Beat({ beat }: { beat: MemberBeat }) {
  const role = ROLES_BY_ID[beat.role];
  const gear = beat.gearIds.map((g) => GEAR_BY_ID[g]?.name ?? g);
  return (
    <div className={`nf-beat ${beat.passed ? 'pass' : 'fail'}`}>
      <Avatar role={beat.role} name={beat.name} size={36} />
      <div className="nf-beat-body">
        <div className="nf-beat-top">
          <span className="nf-beat-name">{beat.name}</span>
          <span className="nf-beat-role">
            <RoleIcon role={beat.role} size={10} /> {role?.name ?? beat.role}
          </span>
          {beat.trait && <span className="nf-beat-trait">{beat.trait}</span>}
          <span className={`nf-beat-q q-${beat.quality}`}>{QUALITY_LABEL[beat.quality]}</span>
        </div>
        <p className="nf-beat-detail">{beat.detail}</p>
        <span className="nf-beat-stats">
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
        className="nf-rep-recbtn"
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
        className="nf-rep-recbtn"
        disabled={game.cash < gear.cost}
        onClick={() => actions.buyGear(member.id, gear.id)}
      >
        +{gear.name} · {formatCash(gear.cost, 'ceil')}
      </button>
    );
  }
  return null;
}
