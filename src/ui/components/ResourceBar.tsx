import { CONFIG } from '../../data/config';
import { deriveHeat, heatCoolRateMult } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { formatCash } from '../format';
import { Icon } from '../icons';

function heatStatus(frac: number): { level: string; word: string } {
  if (frac >= 0.85) return { level: 'critical', word: 'Burning' };
  if (frac >= 0.6) return { level: 'high', word: 'Hot' };
  if (frac >= 0.3) return { level: 'high', word: 'Warm' };
  return { level: 'normal', word: 'Cool' };
}

export function ResourceBar() {
  const { game } = useGame();
  const now = useNow();
  const heat = deriveHeat(game, now);
  const heatFrac = heat / CONFIG.maxHeat;
  const coolPerSec = CONFIG.heatCoolPerSec * heatCoolRateMult(game);
  const { level, word } = heatStatus(heatFrac);

  return (
    <div className="resourcebar">
      <div className="stat cash">
        <span className="stat-icon">
          <Icon name="cash" size={22} />
        </span>
        <div className="stat-body">
          <span className="stat-label">Cash on hand</span>
          <span className="stat-value">{formatCash(game.cash)}</span>
        </div>
      </div>

      <div className="stat heat">
        <span className="stat-icon">
          <Icon name="heat" size={22} />
        </span>
        <div className="stat-body wide">
          <div className="stat-topline">
            <span className="stat-label">Heat — {word}</span>
            <span className="stat-value sm">
              {Math.round(heat)} / {CONFIG.maxHeat}
            </span>
          </div>
          <div
            className="heat-meter"
            role="meter"
            aria-label={`Heat — ${word}`}
            aria-valuenow={Math.round(heat)}
            aria-valuemin={0}
            aria-valuemax={CONFIG.maxHeat}
          >
            <div className={`heat-fill ${level}`} style={{ width: `${heatFrac * 100}%` }} />
          </div>
          <span className="stat-sub">cooling {coolPerSec.toFixed(1)}/s</span>
        </div>
      </div>

      <div className="stat lifetime">
        <span className="stat-icon">
          <Icon name="vault" size={22} />
        </span>
        <div className="stat-body">
          <span className="stat-label">Lifetime take</span>
          <span className="stat-value">{formatCash(game.lifetimeCash)}</span>
        </div>
      </div>
    </div>
  );
}
