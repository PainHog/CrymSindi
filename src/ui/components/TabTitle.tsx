import { useEffect } from 'react';
import { useGame, useNow } from '../../store/GameContext';

const BASE_TITLE = 'Nightfall Syndicate';

/**
 * Reflects ready-to-collect heists in the browser tab title — "(2) Ready ·
 * Nightfall Syndicate" — so a heist finishing pulls the player back to an open tab.
 * Renders nothing.
 */
export function TabTitle() {
  const { game } = useGame();
  const now = useNow();
  const ready = game.activeHeists.reduce((n, a) => (a.endsAt <= now ? n + 1 : n), 0);

  useEffect(() => {
    document.title = ready > 0 ? `(${ready}) Ready · ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [ready]);

  return null;
}
