import { useGame } from '../../store/GameContext';
import { Icon } from '../icons';

export function TopBar() {
  const { actions } = useGame();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-badge">
          <Icon name="mask" size={26} />
        </span>
        <div className="brand-text">
          <h1>Heist Crew Idle</h1>
          <span className="brand-tag">Syndicate Operations</span>
        </div>
      </div>
      <div className="topbar-actions">
        <button className="btn stamp" onClick={actions.save}>
          Save
        </button>
        <button className="btn stamp danger" onClick={actions.reset}>
          Reset
        </button>
      </div>
    </header>
  );
}
