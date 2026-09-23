import { UPGRADES } from '../../data/upgrades';
import type { UpgradeEffect } from '../../data/upgrades';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';
import { Icon } from '../icons';
import type { IconName } from '../icons';

function effectIcon(effect: UpgradeEffect): IconName {
  if (effect.payoutMult && effect.payoutMult > 1) return 'cash';
  if (effect.heatCoolRateMult && effect.heatCoolRateMult > 1) return 'clock';
  if (effect.heatGainMult && effect.heatGainMult < 1) return 'heat';
  return 'vault';
}

export function UpgradePanel() {
  const { game, actions } = useGame();

  return (
    <section className="panel">
      <h2 className="panel-title">
        <span className="panel-ico">
          <Icon name="vault" size={17} />
        </span>
        Operation upgrades
      </h2>
      <div className="upgrade-list">
        {UPGRADES.map((up) => {
          const owned = game.purchasedUpgradeIds.includes(up.id);
          return (
            <div className={`upgrade-card ${owned ? 'owned' : ''}`} key={up.id}>
              <span className="upgrade-ico">
                <Icon name={effectIcon(up.effect)} size={18} />
              </span>
              <div className="upgrade-info">
                <span className="upgrade-name">{up.name}</span>
                <span className="upgrade-desc">{up.description}</span>
              </div>
              {owned ? (
                <span className="stamp-badge stamp-idle">Owned</span>
              ) : (
                <button
                  className="btn small"
                  disabled={game.cash < up.cost}
                  onClick={() => actions.buyUpgrade(up.id)}
                >
                  {formatCash(up.cost, 'ceil')}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
