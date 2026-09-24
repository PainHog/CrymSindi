// -----------------------------------------------------------------------------
// FIRST-RUN ONBOARDING STRIP (map)
// -----------------------------------------------------------------------------
// A prominent, dismissible guide under the HUD that walks a new player through
// send -> wait -> collect. Auto-hides once they've banked a job (see
// firstRunStep) or when they tap Skip (remembered in localStorage).
// -----------------------------------------------------------------------------

import { useState } from 'react';
import { useGame, useNow } from '../../store/GameContext';
import { Icon } from '../icons';
import { firstRunStep, ONBOARD_COPY } from './onboarding';

const KEY = 'heist-crew-idle/seenMapIntro';

export function NfOnboard() {
  const { game } = useGame();
  const now = useNow();
  const [skipped, setSkipped] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });

  const step = skipped ? null : firstRunStep(game, now);
  if (!step) return null;
  const copy = ONBOARD_COPY[step];

  const skip = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage blocked — it just won't be remembered across reloads */
    }
    setSkipped(true);
  };

  return (
    <div className="nf-onboard" role="note">
      <span className="nf-onboard-step">{copy.n}<small>/3</small></span>
      <span className="nf-onboard-ic">
        <Icon name="mask" size={15} />
      </span>
      <div className="nf-onboard-txt">
        <b>{copy.title}</b>
        <span> · {copy.body}</span>
      </div>
      <button className="nf-onboard-skip" onClick={skip}>
        Skip
      </button>
    </div>
  );
}
