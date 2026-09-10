import { useState } from 'react';
import { Icon } from '../icons';

const KEY = 'heist-crew-idle/seenIntro';

/** One-time "how to play" banner for a brand-new player. Dismissal is stored in
 *  localStorage (separate from the save) so it never reappears. */
export function OnboardingBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return true; // storage blocked -> don't nag
    }
  });
  if (dismissed) return null;

  const close = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="onboarding" role="note">
      <div className="onboarding-body">
        <span className="onboarding-title">
          <Icon name="mask" size={15} /> New here? The loop:
        </span>
        <ol className="onboarding-steps">
          <li>
            <strong>Send</strong> a crew on a job from <em>The board</em> (crews need 3+ members).
          </li>
          <li>
            <strong>Come back</strong> when the timer’s up — the crew stays locked until you collect.
          </li>
          <li>
            <strong>Collect</strong> the take, read the debrief for where to invest, then reinvest
            and relaunch.
          </li>
        </ol>
      </div>
      <button className="btn small primary" onClick={close}>
        Got it
      </button>
    </div>
  );
}
