// -----------------------------------------------------------------------------
// SCENE LAYER — React mount for the animated actor layer
// -----------------------------------------------------------------------------
// Mounts the Phaser game into a transparent, non-interactive div layered in the
// map stage, and feeds it live game state (manhunt on/off + Heat) through the
// Phaser registry. Phaser is loaded lazily, so it never enters the base bundle
// unless this actually mounts. Honors the reduced-motion / kill-switch flag.
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import type PhaserNS from 'phaser';
import { CONFIG } from '../../data/config';
import { deriveHeat, isManhuntAt } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { sceneEnabled } from './flags';

export function SceneLayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PhaserNS.Game | null>(null);

  const { game } = useGame();
  const now = useNow();
  const heat = deriveHeat(game, now);
  const manhunt = isManhuntAt(heat);
  // Bucket the fraction so the sync effect isn't chasing meaningless float churn.
  const heatFrac = Math.round(Math.min(1, heat / CONFIG.maxHeat) * 100) / 100;

  // Latest values for the initial push right after the async mount resolves.
  const stateRef = useRef({ manhunt, heatFrac });
  stateRef.current = { manhunt, heatFrac };

  // Mount once. Phaser arrives via dynamic import → its own chunk.
  useEffect(() => {
    if (!sceneEnabled() || !containerRef.current) return;
    let cancelled = false;
    void import('./game').then(({ createGame }) => {
      if (cancelled || !containerRef.current) return;
      const g = createGame(containerRef.current);
      gameRef.current = g;
      g.registry.set('manhunt', stateRef.current.manhunt);
      g.registry.set('heatFrac', stateRef.current.heatFrac);
    });
    return () => {
      cancelled = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  // Feed state changes through to the scene.
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.registry.set('manhunt', manhunt);
    g.registry.set('heatFrac', heatFrac);
  }, [manhunt, heatFrac]);

  return <div ref={containerRef} className="nf-scene" aria-hidden="true" />;
}
