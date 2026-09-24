// -----------------------------------------------------------------------------
// MAP VIEW — the map-first shell
// -----------------------------------------------------------------------------
// The interactive front-end: a live noir city where every marked building is a
// heist. Click a pin to open its dossier (real odds via estimateSuccess), pick a
// crew, launch, and collect. Crew/roster and Reputation management reuse the
// existing panels inside a slide-over drawer. All game logic stays in the engine.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { APPROACHES, approachFor, type ApproachId } from '../../data/approaches';
import { CONFIG } from '../../data/config';
import { HEISTS, type HeistDef } from '../../data/heists';
import {
  canClaimDaily,
  contractHeistDef,
  contractUnlocked,
  crewPower,
  dailyReward,
  deriveHeat,
  estimateSuccess,
  eventForHeist,
  eventNow,
  featuredBonusFor,
  featuredNow,
  healthyCrew,
  heistStatusAt,
  isHeistUnlocked,
  launchBlockReason,
  msUntilNextEvent,
  msUntilNextRotation,
  msUntilNextRival,
  prepCostFor,
  rivalContestFor,
  rivalContestsHeist,
  rivalNow,
  rivalryLevel,
  rivalWinCount,
  rivalSpoilsWithStanding,
  type ActiveEvent,
  type Crew,
  type GameState,
  type RivalContest,
} from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { crewLabel, formatCash, formatCountdown, formatDuration, pct } from '../format';
import { useCountUp } from '../hooks';
import { HeistIcon, Icon, RoleIcon } from '../icons';
import { isMuted, toggleMuted } from '../sfx';
import { CityCanvas } from './CityCanvas';
import { CrewDrawer } from './CrewDrawer';
import { NfCoach } from './NfCoach';
import { NfJuice } from './NfJuice';
import { NfOnboard } from './NfOnboard';
import { NoirReport } from './NoirReport';
import { RepDrawer } from './RepDrawer';
import { SettingsDrawer } from './SettingsDrawer';
import { UpgradesDrawer } from './UpgradesDrawer';
import { DISTRICTS, HQ, SLOTS, tierRisk } from './mapSlots';
import './map.css';

function oddColor(ch: number): string {
  return ch >= 0.7 ? 'var(--nf-lime)' : ch >= 0.45 ? 'var(--nf-amber)' : 'var(--nf-magenta)';
}
const RISK_LABEL = { lo: 'Low risk', med: 'Moderate', hi: 'High risk' } as const;
const RISK_CLASS = { lo: 'risk-lo', med: 'risk-med', hi: 'risk-hi' } as const;

/** The unlocked heists that make up the current board, in a stable order. */
function boardHeists(game: GameState): HeistDef[] {
  const list = HEISTS.filter((h) => isHeistUnlocked(game, h));
  if (contractUnlocked(game)) list.push(contractHeistDef(game.contractLevel));
  return list;
}

type PinStatus = 'open' | 'active' | 'ready';

function pinStatus(game: GameState, heistId: string, now: number): PinStatus {
  const mine = game.activeHeists.filter((a) => a.heistId === heistId);
  if (mine.length === 0) return 'open';
  if (mine.some((a) => heistStatusAt(a.endsAt, now) === 'ready')) return 'ready';
  return 'active';
}

export function MapView() {
  const { game, actions } = useGame();
  const now = useNow();
  const [selected, setSelected] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<'safehouse' | 'reputation' | 'blackmarket' | 'settings' | null>(null);
  const [muted, setMuted] = useState(isMuted());

  const heat = deriveHeat(game, now);
  const heatPct = (heat / CONFIG.maxHeat) * 100;
  const idleCrews = game.crews.filter((c) => c.status === 'idle').length;
  const board = boardHeists(game);
  const readyCount = game.activeHeists.filter((a) => heistStatusAt(a.endsAt, now) === 'ready').length;
  const dailyReady = canClaimDaily(game, now);
  const featuredMap = new Map(featuredNow(now).map((f) => [f.heistId, f.bonusMult]));
  const liveEvent = eventNow(now);
  // A rival contest only matters on the map when it targets a job on the board.
  const liveRival = rivalNow(now);
  const rivalOnBoard = liveRival && board.some((h) => h.id === liveRival.heistId) ? liveRival : null;

  const selectedHeist = selected ? board.find((h) => h.id === selected) ?? null : null;

  return (
    <div className="nfmap">
      <header className="nf-hud">
        <div className="nf-brand">
          <Icon name="mask" size={22} className="nf-glyph" />
          <div>
            <b>Nightfall</b>
            <span>SYNDICATE</span>
          </div>
        </div>
        <div className="nf-spacer" />
        <CashStat cash={game.cash} />
        <div className="nf-stat nf-heatwrap">
          <span className="k">Heat</span>
          <div className="nf-heat-track">
            <div className={'nf-heat-fill' + (heatPct >= 70 ? ' hot' : '')} style={{ width: heatPct + '%' }} />
          </div>
        </div>
        <div className="nf-stat hide-sm">
          <span className="k">Crews</span>
          <span className="v">
            {idleCrews}/{game.crews.length}
          </span>
        </div>
        <div className="nf-stat hide-sm">
          <span className="k">Notoriety</span>
          <span className="v" style={{ color: 'var(--nf-amber)' }}>
            {game.notoriety}
          </span>
        </div>
        {(game.legend > 0 || game.ascendCount > 0) && (
          <div className="nf-stat hide-sm">
            <span className="k">Legend</span>
            <span className="v" style={{ color: 'var(--nf-magenta)' }}>
              {game.legend}
            </span>
          </div>
        )}
        {game.turfWins > 0 && (
          <div className="nf-stat hide-sm" title="Turf wars won — jobs you beat a rival crew to">
            <span className="k">Turf</span>
            <span className="v" style={{ color: 'var(--nf-crimson)' }}>
              {game.turfWins}
            </span>
          </div>
        )}
        <div className="nf-stat hide-sm">
          <span className="k">Next drop</span>
          <span className="v" style={{ color: 'var(--nf-cyan)' }}>
            {formatCountdown(msUntilNextRotation(now))}
          </span>
        </div>
        {dailyReady && (
          <button className="nf-daily-btn" title={`Daily login reward`} onClick={actions.claimDaily}>
            Daily +{formatCash(dailyReward(game, now))}
          </button>
        )}
        <button
          className={'nf-icon-btn' + (muted ? ' muted' : '')}
          title={muted ? 'Sound off — click to unmute' : 'Sound on — click to mute'}
          aria-pressed={muted}
          onClick={() => setMuted(toggleMuted())}
        >
          <Icon name={muted ? 'mute' : 'sound'} size={17} />
        </button>
        <button className="nf-icon-btn" title="Collect all ready" onClick={actions.collectAll} disabled={readyCount === 0}>
          <Icon name="cash" size={17} />
        </button>
        <button className="nf-icon-btn" title="Black market — upgrades" onClick={() => setDrawer('blackmarket')}>
          <Icon name="vault" size={17} />
        </button>
        <button className="nf-icon-btn" title="Reputation & perks" onClick={() => setDrawer('reputation')}>
          <Icon name="crown" size={17} />
        </button>
        <button className="nf-icon-btn" title="Safehouse & crews" onClick={() => setDrawer('safehouse')}>
          <Icon name="safehouse" size={17} />
        </button>
        <button className="nf-icon-btn" title="Settings — save, backup, reset" onClick={() => setDrawer('settings')}>
          <Icon name="gear" size={17} />
        </button>
      </header>

      <NfJuice />
      <NfOnboard />

      <div className="nf-stage">
        <CityCanvas />
        <div className="nf-scanline" />
        <div className="nf-grain" />
        <div className="nf-vig" />

        {liveEvent && <EventBar event={liveEvent} now={now} />}
        {rivalOnBoard && (
          <RivalBar contest={rivalOnBoard} now={now} below={!!liveEvent} level={rivalryLevel(game, rivalOnBoard.rival.id)} />
        )}

        {DISTRICTS.map(([name, x, y]) => (
          <div key={name} className="nf-district" style={{ left: x + '%', top: y + '%' }}>
            {name}
          </div>
        ))}

        <div className="nf-hq" style={{ left: HQ.x + '%', top: HQ.y + '%' }} title="Your safehouse" onClick={() => setDrawer('safehouse')}>
          <div className="nf-hl">HQ</div>
        </div>

        <div className="nf-pins">
          {board.map((h, i) => {
            const slot = SLOTS[i % SLOTS.length];
            const status = pinStatus(game, h.id, now);
            const risk = tierRisk(h.tier);
            const featured = featuredMap.get(h.id);
            // Featured wins: a featured job never also shows an event marker.
            const ev = featured ? null : eventForHeist(h.id, now);
            const evClass = ev ? (ev.def.kind === 'pressure' ? ' ev-pressure' : ' ev-opp') : '';
            // A rival contest is its own axis (a race), so it stacks with the
            // featured/event badge — its own crimson mark sits on the other corner.
            const contested = rivalContestsHeist(h.id, now);
            return (
              <button
                key={h.id}
                className={
                  'nf-pin ' + RISK_CLASS[risk] + (selected === h.id ? ' sel' : '') + (featured ? ' featured' : '') + evClass + (contested ? ' rival' : '')
                }
                data-state={status}
                style={{ left: slot[0] + '%', top: slot[1] + '%' }}
                onClick={() => setSelected(h.id)}
              >
                {contested && status === 'open' && <span className="nf-rival-badge">TURF</span>}
                {featured && status === 'open' && <span className="nf-hot">HOT</span>}
                {ev && status === 'open' && (
                  <span className={'nf-ev ' + (ev.def.kind === 'pressure' ? 'pressure' : 'opp')}>
                    {ev.def.kind === 'pressure' ? 'RISK' : 'BONUS'}
                  </span>
                )}
                <span className="nf-core">
                  <HeistIcon id={h.id} size={13} />
                </span>
                <span className="nf-tag">
                  {status === 'ready' ? (
                    <>
                      <b>READY</b> · collect
                    </>
                  ) : contested ? (
                    <>
                      {h.name} · <b className="turf">TURF</b>
                    </>
                  ) : featured ? (
                    <>
                      {h.name} · <b>+{Math.round((featured - 1) * 100)}%</b>
                    </>
                  ) : ev ? (
                    <>
                      {h.name} · <b>{ev.def.name}</b>
                    </>
                  ) : (
                    h.name
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {selectedHeist && (
          <Dossier
            key={selectedHeist.id}
            heist={selectedHeist}
            onClose={() => setSelected(null)}
            onManage={() => setDrawer('safehouse')}
          />
        )}

        {/* Contextual coaching, tucked bottom-left above the dock. */}
        <NfCoach />
      </div>

      <CrewDock onManage={() => setDrawer('safehouse')} />

      {drawer && (
        <div className="nf-drawer-wrap" onClick={() => setDrawer(null)}>
          <aside className="nf-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="nf-drawer-close" onClick={() => setDrawer(null)} aria-label="Close">
              ✕
            </button>
            <div className="nf-drawer-body">
              {drawer === 'safehouse' ? (
                <CrewDrawer />
              ) : drawer === 'reputation' ? (
                <RepDrawer />
              ) : drawer === 'blackmarket' ? (
                <UpgradesDrawer />
              ) : (
                <SettingsDrawer />
              )}
            </div>
          </aside>
        </div>
      )}

      {/* After-action debrief — rendered inside .nfmap so the noir theme reaches it. */}
      <NoirReport />
    </div>
  );
}

// ---- Dossier ----------------------------------------------------------------

function Dossier({ heist, onClose, onManage }: { heist: HeistDef; onClose: () => void; onManage: () => void }) {
  const { game, actions } = useGame();
  const now = useNow();
  const [approachId, setApproachId] = useState<ApproachId>('quiet');
  const [prepArmed, setPrepArmed] = useState(false);
  const ap = approachFor(approachId);
  const heat = deriveHeat(game, now);
  const risk = tierRisk(heist.tier);
  const featBonus = featuredBonusFor(heist.id, now);
  // Featured wins: a featured job doesn't also carry an event.
  const ev = featBonus > 1 ? null : eventForHeist(heist.id, now);
  // Rival contest is orthogonal (a race), so it can coexist with featured/event.
  const rival = rivalContestFor(heist.id, now);
  const evReward = ev?.def.effect.rewardMult ?? 1;
  const evOdds = ev?.def.effect.oddsDelta ?? 0;
  const evHeat = ev?.def.effect.heatMult ?? 1;
  const baseTake = Math.round(heist.payoutPerSec * heist.durationSec * ap.rewardMult * featBonus * evReward);
  const previewDur = Math.round(heist.durationSec * ap.timeMult);
  const previewHeat = Math.round(heist.heatCost * ap.heatMult * evHeat);
  const prepCost = prepCostFor(heist);
  const canPrep = prepArmed || game.cash >= prepCost;
  const oddsDelta = ap.oddsDelta + (prepArmed ? CONFIG.prepOddsBonus : 0) + evOdds;

  const active = game.activeHeists.filter((a) => a.heistId === heist.id);
  const idle = game.crews.filter((c) => c.status === 'idle');

  let best = 0;
  const rows = idle.map((crew) => {
    const block = launchBlockReason(game, heist.id, crew.id, now);
    const eligible = block === null;
    const odds = eligible ? estimateSuccess(game, heist, crew, now, undefined, oddsDelta) : 0;
    if (odds > best) best = odds;
    return { crew, eligible, odds, why: block };
  });
  const eligibleIdle = rows.filter((r) => r.eligible).length;

  const accent = risk === 'hi' ? 'var(--nf-magenta)' : risk === 'med' ? 'var(--nf-amber)' : 'var(--nf-cyan)';
  return (
    <aside className="nf-dossier open" style={{ '--c': accent } as CSSProperties}>
      <div className="nf-dos-head">
        <button className="nf-dos-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="nf-dos-eyebrow">
          <span className="nf-dos-dot" /> {RISK_LABEL[risk]} · tier {heist.tier}
          {featBonus > 1 && <span className="nf-hot-tag">Featured +{Math.round((featBonus - 1) * 100)}%</span>}
          {ev && (
            <span className={'nf-ev-tag ' + (ev.def.kind === 'pressure' ? 'pressure' : 'opp')}>{ev.def.name}</span>
          )}
          {rival && <span className="nf-rival-tag">Turf war</span>}
        </div>
        <div className="nf-dos-title">{heist.name}</div>
        <div className="nf-dos-sub">{heist.description}</div>
        {ev && <div className={'nf-dos-ev ' + (ev.def.kind === 'pressure' ? 'pressure' : 'opp')}>{ev.def.blurb}</div>}
        {rival &&
          (() => {
            const wins = rivalWinCount(game, rival.rival.id);
            const lvl = rivalryLevel(game, rival.rival.id);
            return (
              <div className="nf-dos-rival">
                <b>{rival.rival.name}</b>
                {wins > 0
                  ? ` is back for more — you've taken ${wins} from them (Lv ${lvl}). Take it again for `
                  : ' is moving on this. Pull it off to seize the turf — '}
                <b>+{formatCash(rivalSpoilsWithStanding(game, rival.rival.id, baseTake))} spoils</b>.
              </div>
            );
          })()}
      </div>

      <div className="nf-dos-body">
        <div className="nf-stats">
          <Stat k="Take" v={formatCash(baseTake)} c="var(--nf-lime)" />
          <Stat k="Time" v={formatDuration(previewDur)} />
          <Stat k="Difficulty" v={String(heist.difficulty)} c={oddColor(1 - heist.difficulty / 60)} />
          <Stat k="Heat cost" v={'+' + previewHeat} c="var(--nf-magenta)" />
        </div>

        {active.length === 0 && (
          <>
            <div className="nf-sect">Approach</div>
            <div className="nf-appr-row">
              {APPROACHES.map((a) => (
                <button
                  key={a.id}
                  className={'nf-appr' + (approachId === a.id ? ' on' : '')}
                  title={a.description}
                  onClick={() => setApproachId(a.id)}
                >
                  {a.name}
                </button>
              ))}
            </div>
            <div className="nf-appr-d">{ap.description}</div>
          </>
        )}

        {active.length > 0 && (
          <>
            <div className="nf-sect">In progress</div>
            {active.map((a) => {
              const ready = heistStatusAt(a.endsAt, now) === 'ready';
              const idx = game.crews.findIndex((c) => c.id === a.crewId);
              return (
                <div key={a.id} className="nf-active-row">
                  <span className="nf-active-name">{crewLabel(idx)}</span>
                  {ready ? (
                    <button className="nf-btn collect" onClick={() => actions.collect(a.id)}>
                      Collect
                    </button>
                  ) : (
                    <span className="nf-active-clock">{formatCountdown(a.endsAt - now)}</span>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div className="nf-odds-wrap">
          <div className="nf-odds-row">
            <span>Best odds</span>
            <b style={{ color: oddColor(best) }}>{idle.length ? pct(best) : '—'}</b>
          </div>
          <div className="nf-odds-track">
            <div className="nf-odds-bar" style={{ width: best * 100 + '%' }} />
          </div>
        </div>

        <div className="nf-req">
          {heist.requiredRoles.length === 0 ? (
            <span className="nf-chip">No specialist required</span>
          ) : (
            heist.requiredRoles.map((r) => (
              <span key={r} className="nf-chip">
                <RoleIcon role={r} size={11} /> {r}
              </span>
            ))
          )}
          {heat >= 60 && <span className="nf-chip warn">High heat · odds down</span>}
          {prepArmed && (
            <span className="nf-chip" style={{ borderColor: '#2f6f86', color: 'var(--nf-cyan)' }}>
              Cased · +{Math.round(CONFIG.prepOddsBonus * 100)}%
            </span>
          )}
        </div>

        {idle.length > 0 && (
          <button
            className={'nf-prep' + (prepArmed ? ' on' : '')}
            disabled={!canPrep}
            onClick={() => setPrepArmed((v) => !v)}
          >
            <span className="nf-prep-main">
              <span className="nf-prep-t">{prepArmed ? 'Cased — crew goes in prepped' : 'Case the job first'}</span>
              <span className="nf-prep-d">Study the target · +{Math.round(CONFIG.prepOddsBonus * 100)}% success</span>
            </span>
            <span className="nf-prep-c">{prepArmed ? 'ARMED' : '+ ' + formatCash(prepCost)}</span>
          </button>
        )}

        <div className="nf-sect">Assign a crew</div>
        <div className="nf-crew-pick">
          {idle.length === 0 && <div className="nf-runline">No idle crews. Manage crews below.</div>}
          {rows.map(({ crew, eligible, odds, why }) => {
            const idx = game.crews.findIndex((c) => c.id === crew.id);
            return (
              <button
                key={crew.id}
                className="nf-crew-opt"
                disabled={!eligible}
                onClick={() => actions.launch(heist.id, crew.id, approachId, prepArmed)}
              >
                <span className="nf-cw-ic">
                  <Icon name="crew" size={15} />
                </span>
                <span className="nf-cw-main">
                  <span className="nf-cw-name">{crewLabel(idx)}</span>
                  <span className="nf-cw-meta">
                    {crew.memberIds.length} crew · PWR {Math.round(crewPower(game, healthyCrew(game, crew, now)))}
                    {why ? ' · ' + why : ''}
                  </span>
                </span>
                <span className="nf-cw-odds" style={{ color: oddColor(odds) }}>
                  {eligible ? pct(odds) : '—'}
                </span>
              </button>
            );
          })}
        </div>

        {eligibleIdle >= 2 && (
          <button
            className="nf-btn ghost"
            title="Dispatch every idle, eligible crew to this job at once (uses the chosen approach)"
            onClick={() => {
              actions.sendAllIdle(heist.id, approachId, prepArmed);
              onClose();
            }}
          >
            <Icon name="crew" size={13} /> Send all idle crews · {eligibleIdle}
          </button>
        )}

        <button className="nf-btn ghost" onClick={onManage}>
          Manage crews & gear
        </button>
      </div>
    </aside>
  );
}

// The HUD cash readout: counts up toward gains and flashes when it climbs, so a
// banked take reads as money arriving rather than a number silently changing.
// Snaps down instantly on a spend (no counting backward).
function CashStat({ cash }: { cash: number }) {
  const display = useCountUp(cash, 550, true);
  const prev = useRef(cash);
  const [gain, setGain] = useState(false);
  useEffect(() => {
    if (cash > prev.current) {
      setGain(true);
      const id = window.setTimeout(() => setGain(false), 650);
      prev.current = cash;
      return () => window.clearTimeout(id);
    }
    prev.current = cash;
  }, [cash]);
  return (
    <div className="nf-stat">
      <span className="k">Cash</span>
      <span className={'v cash' + (gain ? ' gain' : '')}>{formatCash(display, 'floor')}</span>
    </div>
  );
}

function Stat({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div className="nf-stcell">
      <div className="k">{k}</div>
      <div className="v" style={{ color: c ?? 'var(--nf-ink)' }}>
        {v}
      </div>
    </div>
  );
}

// ---- Event ticker -----------------------------------------------------------

function EventBar({ event, now }: { event: ActiveEvent; now: number }) {
  const pressure = event.def.kind === 'pressure';
  return (
    <div className={'nf-eventbar ' + (pressure ? 'pressure' : 'opp')} role="status" aria-live="polite">
      <span className="nf-eb-ic">
        <Icon name={pressure ? 'heat' : 'cash'} size={14} />
      </span>
      <span className="nf-eb-txt">
        <b>{event.def.name}</b>
        <span className="nf-eb-blurb"> · {event.def.blurb}</span>
      </span>
      <span className="nf-eb-clock">{formatCountdown(msUntilNextEvent(now))}</span>
    </div>
  );
}

// ---- Rival turf-war banner --------------------------------------------------

function RivalBar({ contest, now, below, level }: { contest: RivalContest; now: number; below: boolean; level: number }) {
  const name = HEISTS.find((h) => h.id === contest.heistId)?.name ?? 'a job';
  return (
    <div className={'nf-rivalbar' + (below ? ' below' : '')} role="status" aria-live="polite">
      <span className="nf-rb-ic">
        <Icon name="crew" size={14} />
      </span>
      <span className="nf-rb-txt">
        <b>{contest.rival.name}</b>
        {level > 0 && <span className="nf-rb-lvl">Lv {level}</span>}
        <span className="nf-rb-blurb"> is moving on {name} — beat them to it</span>
      </span>
      <span className="nf-rb-clock">{formatCountdown(msUntilNextRival(now))}</span>
    </div>
  );
}

// ---- Crew dock --------------------------------------------------------------

function CrewDock({ onManage }: { onManage: () => void }) {
  const { game } = useGame();
  const now = useNow();
  return (
    <div className="nf-dock">
      {game.crews.map((crew, idx) => (
        <CrewCard key={crew.id} crew={crew} idx={idx} now={now} onManage={onManage} />
      ))}
      <button className="nf-dock-add" onClick={onManage}>
        <span className="plus">+</span>
        MANAGE
      </button>
    </div>
  );
}

function CrewCard({ crew, idx, now, onManage }: { crew: Crew; idx: number; now: number; onManage: () => void }) {
  const { game } = useGame();
  const active = game.activeHeists.find((a) => a.crewId === crew.id);
  const ready = active ? heistStatusAt(active.endsAt, now) === 'ready' : false;
  const status = crew.status === 'idle' ? 'Idle · ready' : ready ? 'Job done' : 'On a job';
  return (
    <div className={'nf-crewcard' + (crew.status === 'onHeist' ? ' busy' : '')}>
      <div className="nf-cc-top">
        <span className="nf-cc-ic">
          <Icon name="crew" size={14} />
        </span>
        <div>
          <div className="nf-cc-name">{crewLabel(idx)}</div>
          <div className="nf-cc-pw">
            {crew.memberIds.length} crew · PWR {Math.round(crewPower(game, healthyCrew(game, crew, now)))}
          </div>
        </div>
      </div>
      <div className="nf-cc-status">
        {status}
        {active && !ready ? ' · ' + formatCountdown(active.endsAt - now) : ''}
      </div>
      <button className="nf-cc-manage" onClick={onManage}>
        Manage ▸
      </button>
    </div>
  );
}
