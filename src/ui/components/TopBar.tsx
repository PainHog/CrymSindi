import { useGame } from '../../store/GameContext';

export function TopBar() {
  const { actions } = useGame();
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">◈</span>
        <h1>Heist Crew Idle</h1>
      </div>
      <div className="topbar-actions">
        <button className="btn ghost" onClick={actions.save}>
          Save
        </button>
        <button className="btn danger ghost" onClick={actions.reset}>
          Reset game
        </button>
      </div>
    </header>
  );
}
