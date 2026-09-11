import { HEISTS_BY_ID } from '../../data/heists';
import { contractHeistDef, heistStatusAt } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { useRewardedAd } from '../hooks';
import { crewLabel, formatCountdown, pct } from '../format';
import { HeistIcon, Icon } from '../icons';

export function ActiveHeists() {
  const { game, actions } = useGame();
  const now = useNow();
  const { watching, watch } = useRewardedAd();

  const skip = async (id: string) => {
    if (await watch('skip_cooldown')) actions.skipCooldown(id);
  };

  const readyCount = game.activeHeists.filter((a) => now >= a.endsAt).length;

  return (
    <section className="panel">
      <div className="panel-title row">
        <h2>
          <Icon name="target" size={17} /> On the job
        </h2>
        {readyCount >= 2 && (
          <button className="btn small primary" onClick={actions.collectAll}>
            Collect all ({readyCount})
          </button>
        )}
      </div>

      {game.activeHeists.length === 0 ? (
        <p className="empty">No crews are out right now. Send one on a job.</p>
      ) : (
        <div className="active-list">
          {game.activeHeists.map((active) => {
            const heist =
              active.contractLevel != null
                ? contractHeistDef(active.contractLevel)
                : HEISTS_BY_ID[active.heistId];
            const crewIdx = game.crews.findIndex((c) => c.id === active.crewId);
            const status = heistStatusAt(active.endsAt, now);
            const ready = status === 'ready';
            const total = active.endsAt - active.startedAt;
            const elapsed = Math.min(total, Math.max(0, now - active.startedAt));
            const progress = total > 0 ? elapsed / total : 1;

            return (
              <div className={`active-card ${ready ? 'ready' : ''}`} key={active.id}>
                <div className="active-head">
                  <span className="active-icon">
                    <HeistIcon id={active.heistId} size={19} />
                  </span>
                  <div className="active-title">
                    <span className="active-name">{heist?.name ?? 'Unknown job'}</span>
                    <span className="active-crew">
                      <Icon name="crew" size={12} /> {crewLabel(crewIdx)}
                    </span>
                  </div>
                  {ready ? (
                    <span className="stamp-badge stamp-ready">Ready</span>
                  ) : (
                    <span className="countdown">{formatCountdown(active.endsAt - now)}</span>
                  )}
                </div>

                <div className="progress-track">
                  <div
                    className={`progress-fill ${ready ? 'done' : 'running'}`}
                    style={{ width: `${pct(progress)}` }}
                  />
                </div>

                {ready ? (
                  <button className="btn primary block" onClick={() => actions.collect(active.id)}>
                    Collect the take
                  </button>
                ) : (
                  <div className="active-foot">
                    <p className="active-note">
                      <Icon name="crew" size={12} /> Crew locked until you collect.
                    </p>
                    <button
                      className="btn tiny ghost skip-btn"
                      disabled={watching}
                      title="Watch a short ad to finish this job now"
                      onClick={() => skip(active.id)}
                    >
                      {watching ? 'Ad…' : 'Skip · ad'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
