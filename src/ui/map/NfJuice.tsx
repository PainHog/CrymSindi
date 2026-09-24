// -----------------------------------------------------------------------------
// COLLECT-MOMENT JUICE LAYER (map)
// -----------------------------------------------------------------------------
// Listens to the one-shot GameEvent signal and spawns a rising "+$X" floater
// near the HUD cash readout each time a job is banked, so the payout visibly
// flies up to meet the count-up total. Renders nothing until something lands.
// Money moments only (see floaterFromEvent); reduced motion still shows the
// number briefly, just without the travel.
// -----------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../store/GameContext';
import { formatCash } from '../format';
import { floaterFromEvent, type Floater } from './juice';

interface Live extends Floater {
  key: number;
}

// A floater lives ~1.3s (matches the CSS animation); we cap concurrent ones so a
// rapid Collect-all can't pile up dozens of nodes.
const LIFETIME_MS = 1300;
const MAX_LIVE = 5;

export function NfJuice() {
  const { event, eventId } = useGame();
  const lastId = useRef(0);
  const seq = useRef(0);
  const mounted = useRef(true);
  const [items, setItems] = useState<Live[]>([]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (eventId === lastId.current) return;
    lastId.current = eventId;
    const f = floaterFromEvent(event);
    if (!f) return;
    const key = ++seq.current;
    setItems((xs) => [...xs.slice(-(MAX_LIVE - 1)), { ...f, key }]);
    window.setTimeout(() => {
      if (mounted.current) setItems((xs) => xs.filter((x) => x.key !== key));
    }, LIFETIME_MS);
  }, [event, eventId]);

  if (items.length === 0) return null;
  return (
    <div className="nf-floaters" aria-hidden="true">
      {items.map((it) => (
        <span key={it.key} className={'nf-floater ' + it.tone + (it.flawless ? ' flawless' : '')}>
          +{formatCash(it.payout)}
          {it.flawless && <i className="nf-floater-perfect">clean</i>}
        </span>
      ))}
    </div>
  );
}
