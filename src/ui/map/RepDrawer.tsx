// -----------------------------------------------------------------------------
// REPUTATION DRAWER — native noir prestige / perk tree
// -----------------------------------------------------------------------------
// Replaces the classic AscensionPanel inside the map's slide-over. Shows the
// Notoriety balance, the "go legit" (prestige) action with its real gain preview
// and eligibility gate, and the perk tree — all driven by the real engine.
// -----------------------------------------------------------------------------

import { CONFIG } from '../../data/config';
import { MILESTONES } from '../../data/milestones';
import { PERKS, perkCost } from '../../data/perks';
import { LEGEND_PERKS, legendPerkCost } from '../../data/legendPerks';
import {
  canAscend,
  canPrestige,
  isMilestoneEarned,
  legendGainFor,
  legendPerkLevel,
  notorietyGainFor,
  perkLevel,
} from '../../engine';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';
import { Icon } from '../icons';

export function RepDrawer() {
  const { game, actions } = useGame();
  const gain = notorietyGainFor(game.lifetimeCash);
  const eligible = canPrestige(game);
  const progress = Math.min(100, (game.lifetimeCash / CONFIG.prestigeThreshold) * 100);

  // Ascension (second layer) surfaces once the player has any stake in it.
  const showAscension = game.notoriety > 0 || game.legend > 0 || game.ascendCount > 0;
  const legendGain = legendGainFor(game.notoriety);
  const canAsc = canAscend(game);
  const ascProgress = Math.min(100, (game.notoriety / CONFIG.ascendThreshold) * 100);
  const showLegendTree = game.legend > 0 || game.ascendCount > 0;

  return (
    <div className="nf-mp">
      <div className="nf-mp-head">
        <div className="nf-mp-eyebrow">
          <span className="nf-dos-dot" /> Reputation · run {game.prestigeCount + 1}
        </div>
        <div className="nf-mp-title" style={{ color: 'var(--nf-amber)' }}>
          {game.notoriety} <span style={{ fontSize: 14, color: 'var(--nf-ink-dim)' }}>Notoriety</span>
        </div>
        <div className="nf-mp-sub">Spend it on permanent perks. Every run starts stronger.</div>
      </div>

      <div className="nf-mp-body">
        <div className="nf-legit">
          {eligible ? (
            <>
              <div className="nf-legit-k">
                Cash this run: <b>{formatCash(game.lifetimeCash)}</b>
              </div>
              <button className="nf-wide-btn go" onClick={() => actions.prestige()}>
                Go Legit → +{gain} Notoriety
              </button>
              <div className="nf-legit-note">
                Retire this run for keeps: reset cash &amp; crews, keep Notoriety and perks.
              </div>
            </>
          ) : (
            <>
              <div className="nf-legit-k">
                Go legit at <b>{formatCash(CONFIG.prestigeThreshold)}</b> lifetime cash
              </div>
              <div className="nf-legit-track">
                <div className="nf-legit-bar" style={{ width: progress + '%' }} />
              </div>
              <div className="nf-legit-note">
                {formatCash(game.lifetimeCash)} / {formatCash(CONFIG.prestigeThreshold)} — worth +{gain} now
              </div>
            </>
          )}
        </div>

        <div className="nf-mp-sect">Perks</div>
        <div className="nf-perklist">
          {PERKS.map((p) => {
            const lvl = perkLevel(game, p.id);
            const maxed = lvl >= p.maxLevel;
            const cost = perkCost(p, lvl + 1);
            const afford = game.notoriety >= cost;
            return (
              <div key={p.id} className="nf-perk">
                <div className="nf-perk-main">
                  <div className="nf-perk-name">
                    {p.name}
                    <span className="nf-perk-lvl">
                      {lvl}/{p.maxLevel}
                    </span>
                  </div>
                  <div className="nf-perk-d">{p.description}</div>
                </div>
                {maxed ? (
                  <span className="nf-perk-buy maxed">MAX</span>
                ) : (
                  <button
                    className={'nf-perk-buy' + (afford ? '' : ' off')}
                    disabled={!afford}
                    onClick={() => actions.buyPerk(p.id)}
                  >
                    {cost} <Icon name="crown" size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {showAscension && (
          <>
            <div className="nf-mp-sect" style={{ color: 'var(--nf-magenta)' }}>
              Ascension · <b style={{ color: 'var(--nf-ink)' }}>{game.legend}</b> Legend
            </div>
            <div className="nf-legit nf-legend">
              {canAsc ? (
                <>
                  <div className="nf-legit-k">
                    Notoriety: <b>{game.notoriety}</b>
                  </div>
                  <button className="nf-wide-btn ascend" onClick={() => actions.ascend()}>
                    Become a Legend → +{legendGain} Legend
                  </button>
                  <div className="nf-legit-note">
                    Burn your Notoriety &amp; perk tree for permanent <b>Legend</b>. Your run,
                    Notoriety and perks reset — Legend and its perks are forever.
                  </div>
                </>
              ) : (
                <>
                  <div className="nf-legit-k">
                    Ascend at <b>{CONFIG.ascendThreshold}</b> Notoriety
                  </div>
                  <div className="nf-legit-track">
                    <div className="nf-legit-bar legend" style={{ width: ascProgress + '%' }} />
                  </div>
                  <div className="nf-legit-note">
                    {game.notoriety} / {CONFIG.ascendThreshold} Notoriety — worth +{legendGain} now
                  </div>
                </>
              )}
            </div>

            {showLegendTree && (
              <div className="nf-perklist">
                {LEGEND_PERKS.map((p) => {
                  const lvl = legendPerkLevel(game, p.id);
                  const maxed = lvl >= p.maxLevel;
                  const cost = legendPerkCost(p, lvl + 1);
                  const afford = game.legend >= cost;
                  return (
                    <div key={p.id} className="nf-perk legend">
                      <div className="nf-perk-main">
                        <div className="nf-perk-name">
                          {p.name}
                          <span className="nf-perk-lvl">
                            {lvl}/{p.maxLevel}
                          </span>
                        </div>
                        <div className="nf-perk-d">{p.description}</div>
                      </div>
                      {maxed ? (
                        <span className="nf-perk-buy maxed">MAX</span>
                      ) : (
                        <button
                          className={'nf-perk-buy legend' + (afford ? '' : ' off')}
                          disabled={!afford}
                          onClick={() => actions.buyLegendPerk(p.id)}
                        >
                          {cost} ◆
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <div className="nf-mp-sect">
          Career milestones · {MILESTONES.filter((m) => isMilestoneEarned(game, m.id)).length}/{MILESTONES.length}
        </div>
        <div className="nf-mslist">
          {MILESTONES.map((m) => {
            const done = isMilestoneEarned(game, m.id);
            const reward = m.reward?.notoriety
              ? `+${m.reward.notoriety} Notoriety`
              : m.reward?.cash
                ? formatCash(m.reward.cash)
                : '';
            return (
              <div key={m.id} className={'nf-ms' + (done ? ' done' : '')}>
                <span className="nf-ms-check">{done ? '✓' : '○'}</span>
                <div className="nf-ms-main">
                  <div className="nf-ms-name">{m.name}</div>
                  <div className="nf-ms-d">{m.description}</div>
                </div>
                <span className="nf-ms-reward">{reward}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
