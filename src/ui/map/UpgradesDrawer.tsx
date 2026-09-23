// -----------------------------------------------------------------------------
// UPGRADES DRAWER — the "Black Market" (global one-time upgrades)
// -----------------------------------------------------------------------------
// Surfaces the engine's global cash-sink upgrades in the map: heat reducers,
// payout boosters, and the Fixer (offline auto-collect/relaunch). Effects stack
// multiplicatively in the engine; this is just the storefront over buyUpgrade.
// -----------------------------------------------------------------------------

import { UPGRADES } from '../../data/upgrades';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';

export function UpgradesDrawer() {
  const { game, actions } = useGame();
  return (
    <div className="nf-mp">
      <div className="nf-mp-head">
        <div className="nf-mp-eyebrow">
          <span className="nf-dos-dot" /> Black Market
        </div>
        <div className="nf-mp-title">Upgrades</div>
        <div className="nf-mp-sub">Permanent operation upgrades. Their effects stack.</div>
      </div>
      <div className="nf-mp-body">
        {UPGRADES.map((u) => {
          const owned = game.purchasedUpgradeIds.includes(u.id);
          const afford = game.cash >= u.cost;
          return (
            <div key={u.id} className={'nf-perk' + (owned ? ' owned' : '')}>
              <div className="nf-perk-main">
                <div className="nf-perk-name">
                  {u.name}
                  {u.effect.autoCollect && <span className="nf-member-trait">Automation</span>}
                </div>
                <div className="nf-perk-d">{u.description}</div>
              </div>
              {owned ? (
                <span className="nf-perk-buy maxed">OWNED</span>
              ) : (
                <button
                  className={'nf-perk-buy cash' + (afford ? '' : ' off')}
                  disabled={!afford}
                  onClick={() => actions.buyUpgrade(u.id)}
                >
                  {formatCash(u.cost)}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
