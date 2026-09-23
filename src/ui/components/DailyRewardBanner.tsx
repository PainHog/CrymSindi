import { canClaimDaily, dailyReward, nextStreakFor } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { formatCash } from '../format';
import { Icon } from '../icons';

/** A claim-once-per-day reward banner; appears whenever a new day's reward is
 *  available (uses the clock so it shows up the moment the day rolls over). */
export function DailyRewardBanner() {
  const { game, actions } = useGame();
  const now = useNow();
  if (!canClaimDaily(game, now)) return null;

  const reward = dailyReward(game, now);
  const streak = nextStreakFor(game, now);

  return (
    <div className="daily-banner" role="note">
      <span className="daily-icon">
        <Icon name="cash" size={20} />
      </span>
      <div className="daily-text">
        <strong>Daily reward ready</strong>
        <span className="daily-sub">
          Day {streak} streak · {formatCash(reward)}
        </span>
      </div>
      <button className="btn primary daily-claim" onClick={actions.claimDaily}>
        Claim
      </button>
    </div>
  );
}
