import { HEISTS_BY_ID } from '../../data/heists';
import { heistStatusAt } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCountdown, pct } from '../format';
import { HeistIcon, Icon } from '../icons';

export function ActiveHeists() {
  const { game, now, actions } = useGame();

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-ico">
          <Icon name="target" size={17} />
        </span>
        On the job
      </h2>

      {game.activeHeists.length === 0 ? (
        <p className="empty">No crews are out right now. Send one on a job.</p>
      ) : (
        <div className="active-list">
          {game.activeHeists.map((active) => {
            const heist = HEISTS_BY_ID[active.heistId];
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
                  <p className="active-note">
                    <Icon name="crew" size={12} /> Crew locked until you collect.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
