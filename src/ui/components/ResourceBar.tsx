import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { CONFIG } from '../../data/config';
import { deriveHeat, heatCoolRateMult, notorietyMult } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { formatCash, pct } from '../format';
import { useCountUp } from '../hooks';
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

  // Cash juice: count up on gains, snap on spends, plus a flash and coin burst.
  const displayCash = useCountUp(game.cash, 500, true);
  const prevCash = useRef(game.cash);
  const [gaining, setGaining] = useState(false);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    const increased = game.cash > prevCash.current;
    prevCash.current = game.cash;
    if (!increased) return;
    setGaining(true);
    setBurst((b) => b + 1);
    const id = window.setTimeout(() => setGaining(false), 650);
    return () => window.clearTimeout(id);
  }, [game.cash]);

  return (
    <div className="resourcebar">
      <div className={`stat cash ${gaining ? 'gain' : ''}`}>
        <span className="stat-icon">
          <Icon name="cash" size={22} />
        </span>
        <div className="stat-body">
          <span className="stat-label">Cash on hand</span>
          <span className="stat-value">{formatCash(displayCash, 'floor')}</span>
        </div>
        {burst > 0 && (
          <div className="coin-burst" key={burst} aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => (
              <span className="coin" style={{ '--i': i } as CSSProperties} key={i} />
            ))}
          </div>
        )}
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
          <span className="stat-value">{formatCash(game.lifetimeCash, 'floor')}</span>
        </div>
      </div>

      <div className="stat notoriety">
        <span className="stat-icon">
          <Icon name="crown" size={22} />
        </span>
        <div className="stat-body">
          <span className="stat-label">Notoriety</span>
          <span className="stat-value">{game.notoriety}</span>
          <span className="stat-sub">
            {game.notoriety > 0 ? 'to spend' : `+${pct(notorietyMult(game) - 1)} take`}
          </span>
        </div>
      </div>
    </div>
  );
}
