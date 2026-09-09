import { useGame } from '../../store/GameContext';

const HOUR = 60 * 60 * 1000;

/** Hidden testing panel. Enable by adding ?dev=1 to the URL. Never shown to
 *  players; it only dispatches the store's dev helpers. */
export function DevPanel() {
  const { actions } = useGame();
  const enabled =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('dev');
  if (!enabled) return null;

  return (
    <div className="dev-panel" aria-label="Dev tools">
      <span className="dev-title">DEV</span>
      <button className="dev-btn" onClick={() => actions.dev('cash', 10_000)}>
        +$10k
      </button>
      <button className="dev-btn" onClick={() => actions.dev('cash', 1_000_000)}>
        +$1M
      </button>
      <button className="dev-btn" onClick={() => actions.dev('notoriety', 5)}>
        +5 Notor.
      </button>
      <button className="dev-btn" onClick={() => actions.dev('finish')}>
        Finish jobs
      </button>
      <button className="dev-btn" onClick={() => actions.dev('ff', HOUR)}>
        +1h
      </button>
      <button className="dev-btn" onClick={() => actions.dev('ff', 6 * HOUR)}>
        +6h
      </button>
      <button className="dev-btn" onClick={() => actions.dev('ff', 12 * HOUR)}>
        +12h
      </button>
      <button className="dev-btn danger" onClick={actions.reset}>
        Reset
      </button>
    </div>
  );
}
