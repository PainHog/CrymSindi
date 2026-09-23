import { useEffect, useRef } from 'react';
import { useGame, useNow } from '../../store/GameContext';
import { playSfx } from '../sfx';

/**
 * Invisible component: plays a sound cue for each game event, and pings when a
 * heist first becomes ready to collect. Mounted once. Renders nothing.
 */
export function SoundFx() {
  const { game, event, eventId } = useGame();
  const now = useNow();
  const lastEventId = useRef(0);
  const readyIds = useRef<Set<string>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (eventId === lastEventId.current || !event) return;
    lastEventId.current = eventId;
    switch (event.kind) {
      case 'launch':
        playSfx('launch');
        break;
      case 'collect':
        playSfx(event.success ? 'success' : 'fail');
        break;
      case 'purchase':
        playSfx('purchase');
        break;
      case 'prestige':
        playSfx('prestige');
        break;
      case 'error':
        playSfx('error');
        break;
    }
  }, [event, eventId]);

  useEffect(() => {
    const nowReady = new Set<string>();
    for (const a of game.activeHeists) {
      if (a.endsAt <= now) nowReady.add(a.id);
    }
    // First pass: seed the set without pinging (heists already ready on load).
    if (!initialized.current) {
      initialized.current = true;
      readyIds.current = nowReady;
      return;
    }
    let fresh = false;
    nowReady.forEach((id) => {
      if (!readyIds.current.has(id)) fresh = true;
    });
    readyIds.current = nowReady;
    if (fresh) playSfx('ready');
  }, [game.activeHeists, now]);

  return null;
}
