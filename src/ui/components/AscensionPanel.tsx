import { PERKS, perkCost } from '../../data/perks';
import { useGame } from '../../store/GameContext';
import { Icon } from '../icons';

/**
 * The Notoriety perk tree — where the prestige currency is actually spent.
 * Hidden until the player has earned Notoriety or owns a perk, so it doesn't
 * clutter a first run.
 */
export function AscensionPanel() {
  const { game, actions } = useGame();
  const perks = game.perks ?? {};
  const owns = Object.values(perks).some((n) => n > 0);
  if (game.notoriety <= 0 && !owns) return null;

  return (
    <section className="panel">
      <div className="panel-title row">
        <h2>
          <Icon name="crown" size={16} /> Notoriety
        </h2>
        <span className="marks-count">
          <Icon name="crown" size={13} /> {game.notoriety} to spend
        </span>
      </div>
      <p className="vault-sub">Permanent perks — they persist through every future prestige.</p>
      <ul className="perk-list">
        {PERKS.map((perk) => {
          const level = perks[perk.id] ?? 0;
          const maxed = level >= perk.maxLevel;
          const cost = maxed ? 0 : perkCost(perk, level + 1);
          const afford = game.notoriety >= cost;
          return (
            <li className="perk-row" key={perk.id}>
              <div className="perk-info">
                <span className="perk-name">
                  {perk.name} <span className="perk-level">Lv {level}/{perk.maxLevel}</span>
                </span>
                <span className="perk-desc">{perk.description}</span>
              </div>
              <button
                className="btn small perk-buy"
                disabled={maxed || !afford}
                aria-label={
                  maxed
                    ? `${perk.name} maxed`
                    : `Buy ${perk.name} level ${level + 1} for ${cost} Notoriety`
                }
                onClick={() => actions.buyPerk(perk.id)}
              >
                {maxed ? (
                  'Maxed'
                ) : (
                  <>
                    {cost} <Icon name="crown" size={12} />
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
