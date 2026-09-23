// -----------------------------------------------------------------------------
// COACH TIPS (noir map)
// -----------------------------------------------------------------------------
// The map skin of the contextual coaching. Same trigger/seen logic and tip data
// as the classic CoachTips (shared in ../coachTips), rendered as a dismissible
// noir card above the crew dock. Adds map-only tips (injuries, featured jobs).
// -----------------------------------------------------------------------------

import { MAP_TIPS, useCoachTip } from '../coachTips';
import { Icon } from '../icons';

export function NfCoach() {
  const { tip, dismiss } = useCoachTip(MAP_TIPS);
  if (!tip) return null;

  return (
    <div className="nf-coach" role="status" aria-live="polite">
      <span className="nf-coach-ic">
        <Icon name={tip.icon} size={16} />
      </span>
      <div className="nf-coach-body">
        <div className="nf-coach-title">{tip.title}</div>
        <p className="nf-coach-text">{tip.body}</p>
      </div>
      <button className="nf-coach-x" onClick={dismiss} aria-label={`Dismiss tip: ${tip.title}`}>
        Got it
      </button>
    </div>
  );
}
