import { BASE_TIPS, useCoachTip } from '../coachTips';
import { Icon } from '../icons';

/** One-at-a-time contextual hints for Heat and prestige, in the classic panel
 *  layout. Logic + tip data live in ../coachTips (shared with the map skin). */
export function CoachTips() {
  const { tip, dismiss } = useCoachTip(BASE_TIPS);
  if (!tip) return null;

  return (
    <div className="coach-tip" role="status" aria-live="polite">
      <span className="coach-tip-icon">
        <Icon name={tip.icon} size={18} />
      </span>
      <div className="coach-tip-body">
        <strong className="coach-tip-title">{tip.title}</strong>
        <span className="coach-tip-text">{tip.body}</span>
      </div>
      <button className="btn small" onClick={dismiss} aria-label={`Dismiss tip: ${tip.title}`}>
        Got it
      </button>
    </div>
  );
}
