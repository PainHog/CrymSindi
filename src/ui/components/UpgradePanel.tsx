import { UPGRADES } from '../../data/upgrades';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';

export function UpgradePanel() {
  const { game, actions } = useGame();

  return (
    <section className="panel">
      <h2 className="panel-title">Operation upgrades</h2>
      <div className="upgrade-list">
        {UPGRADES.map((up) => {
          const owned = game.purchasedUpgradeIds.includes(up.id);
          return (
            <div className={`upgrade-card ${owned ? 'owned' : ''}`} key={up.id}>
              <div className="upgrade-info">
                <span className="upgrade-name">{up.name}</span>
                <span className="upgrade-desc">{up.description}</span>
              </div>
              {owned ? (
                <span className="badge idle-badge">Owned</span>
              ) : (
                <button
                  className="btn small"
                  disabled={game.cash < up.cost}
                  onClick={() => actions.buyUpgrade(up.id)}
                >
                  {formatCash(up.cost)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
