import { useState } from 'react';
import { useGame } from '../../store/GameContext';
import { Icon } from '../icons';
import { isMuted, toggleMuted } from '../sfx';

export function TopBar() {
  const { actions } = useGame();
  const [muted, setMuted] = useState(isMuted());
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-badge">
          <Icon name="mask" size={26} />
        </span>
        <div className="brand-text">
          <h1>Nightfall Syndicate</h1>
          <span className="brand-tag">Syndicate Operations</span>
        </div>
      </div>
      <div className="topbar-actions">
        <button
          className="btn stamp"
          aria-pressed={muted}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
          title={muted ? 'Sound off' : 'Sound on'}
          onClick={() => setMuted(toggleMuted())}
        >
          {muted ? 'Sound: off' : 'Sound: on'}
        </button>
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
