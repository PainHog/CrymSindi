import { HEISTS_BY_ID } from '../../data/heists';
import { heistStatusAt } from '../../engine';
import { useGame } from '../../store/GameContext';
import { crewLabel, formatCountdown, pct } from '../format';

export function ActiveHeists() {
  const { game, now, actions } = useGame();

  if (game.activeHeists.length === 0) {
    return (
      <section className="panel">
        <h2 className="panel-title">In progress</h2>
        <p className="empty">No crews are out right now. Send one on a job.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel-title">In progress</h2>
      <div className="active-list">
        {game.activeHeists.map((active) => {
          const heist = HEISTS_BY_ID[active.heistId];
          const crewIdx = game.crews.findIndex((c) => c.id === active.crewId);
          const status = heistStatusAt(active.endsAt, now);
          const total = active.endsAt - active.startedAt;
          const elapsed = Math.min(total, Math.max(0, now - active.startedAt));
          const progress = total > 0 ? elapsed / total : 1;
          const remaining = active.endsAt - now;

          return (
            <div className={`active-card ${status === 'ready' ? 'ready' : ''}`} key={active.id}>
              <div className="active-head">
                <div>
                  <span className="active-name">{heist?.name ?? 'Unknown job'}</span>
                  <span className="active-crew">{crewLabel(crewIdx)}</span>
                </div>
                {status === 'ready' ? (
                  <span className="badge ready-badge">Ready to collect</span>
                ) : (
                  <span className="countdown">{formatCountdown(remaining)}</span>
                )}
              </div>

              <div className="progress-track">
                <div
                  className={`progress-fill ${status === 'ready' ? 'done' : ''}`}
                  style={{ width: `${pct(progress)}` }}
                />
              </div>

              {status === 'ready' ? (
                <button className="btn primary block" onClick={() => actions.collect(active.id)}>
                  Collect
                </button>
              ) : (
                <p className="active-note">Crew locked until you collect.</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
