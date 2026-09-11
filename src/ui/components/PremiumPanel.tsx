import { CONFIG } from '../../data/config';
import { useGame, useNow } from '../../store/GameContext';
import { useRewardedAd } from '../hooks';
import { Icon } from '../icons';

/**
 * "The Vault" — the premium-currency (Marks) surface. Monetization is plumbed
 * but not wired to a store yet: the IAP button is a labelled placeholder, and
 * "free Marks" uses the stubbed rewarded-ad provider. All swaps happen behind
 * src/monetization at launch.
 */
export function PremiumPanel() {
  const { game, actions } = useGame();
  const now = useNow();
  const { watching, watch, available } = useRewardedAd();

  const running = game.activeHeists.some((a) => now < a.endsAt);
  const canFinishAll = running && game.marks >= CONFIG.finishAllMarksCost;

  const freeMarks = async () => {
    if (await watch('free_marks')) actions.grantMarks(CONFIG.marksPerAdReward);
  };

  return (
    <section className="panel">
      <div className="panel-title row">
        <h2>
          <Icon name="jewelry" size={16} /> The Vault
        </h2>
        <span className="marks-count">
          <Icon name="jewelry" size={13} /> {game.marks} Marks
        </span>
      </div>
      <p className="vault-sub">Premium currency — the store opens at launch.</p>
      <div className="vault-actions">
        <button className="btn small" disabled={watching || !available} onClick={freeMarks}>
          {watching ? 'Ad…' : `Free Marks · watch (+${CONFIG.marksPerAdReward})`}
        </button>
        <button
          className="btn small primary"
          disabled={!canFinishAll}
          title={
            running
              ? `Spend ${CONFIG.finishAllMarksCost} Marks to finish every running job now`
              : 'No jobs are running'
          }
          onClick={actions.finishAll}
        >
          Finish all jobs · {CONFIG.finishAllMarksCost}
          <Icon name="jewelry" size={12} />
        </button>
        <button className="btn small ghost" disabled title="In-app purchase — enabled at launch">
          Buy Marks · at launch
        </button>
      </div>
    </section>
  );
}
