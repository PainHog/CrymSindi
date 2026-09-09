import { CONFIG } from '../../data/config';
import { deriveHeat, heatCoolRateMult } from '../../engine';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';

export function ResourceBar() {
  const { game, now } = useGame();
  const heat = deriveHeat(game, now);
  const heatFrac = heat / CONFIG.maxHeat;
  const coolPerSec = CONFIG.heatCoolPerSec * heatCoolRateMult(game);

  const heatLevel = heatFrac >= 0.85 ? 'critical' : heatFrac >= 0.6 ? 'high' : 'normal';

  return (
    <div className="resourcebar">
      <div className="resource cash">
        <span className="resource-label">Cash</span>
        <span className="resource-value">{formatCash(game.cash)}</span>
      </div>

      <div className="resource heat">
        <div className="heat-head">
          <span className="resource-label">Heat</span>
          <span className="resource-value">
            {Math.round(heat)} / {CONFIG.maxHeat}
          </span>
        </div>
        <div className="heat-track" role="meter" aria-valuenow={Math.round(heat)} aria-valuemax={CONFIG.maxHeat}>
          <div className={`heat-fill ${heatLevel}`} style={{ width: `${heatFrac * 100}%` }} />
        </div>
        <span className="resource-sub">cooling {coolPerSec.toFixed(1)}/s</span>
      </div>

      <div className="resource lifetime">
        <span className="resource-label">Lifetime take</span>
        <span className="resource-value">{formatCash(game.lifetimeCash)}</span>
      </div>
    </div>
  );
}
