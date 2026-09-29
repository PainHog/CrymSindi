// -----------------------------------------------------------------------------
// SCENE LAYER — React mount for the animated actor layer
// -----------------------------------------------------------------------------
// Mounts the Phaser game into a transparent, non-interactive div layered in the
// map stage, and feeds it live game state (manhunt on/off + Heat) through the
// Phaser registry. Phaser is loaded lazily, so it never enters the base bundle
// unless this actually mounts. Honors the reduced-motion / kill-switch flag.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useRef } from 'react';
import type PhaserNS from 'phaser';
import { CONFIG } from '../../data/config';
import { deriveHeat, isManhuntAt } from '../../engine';
import { useGame, useNow } from '../../store/GameContext';
import { slotForHeist } from '../map/board';
import { sceneEnabled } from './flags';

export function SceneLayer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<PhaserNS.Game | null>(null);

  const { game, event, eventId } = useGame();
  const now = useNow();
  const heat = deriveHeat(game, now);
  const manhunt = isManhuntAt(heat);
  // Bucket the fraction so the sync effect isn't chasing meaningless float churn.
  const heatFrac = Math.round(Math.min(1, heat / CONFIG.maxHeat) * 100) / 100;

  // Latest values for the initial push right after the async mount resolves.
  const stateRef = useRef({ manhunt, heatFrac });
  stateRef.current = { manhunt, heatFrac };

  // Mount/unmount the Phaser game. Phaser arrives via dynamic import → its own
  // chunk, so it's never loaded unless the layer actually mounts.
  const mountedRef = useRef(false);
  const mount = useCallback(() => {
    if (mountedRef.current || gameRef.current || !containerRef.current || !sceneEnabled()) return;
    mountedRef.current = true;
    void import('./game').then(({ createGame }) => {
      // Bail if we were toggled off (or already mounted) during the async import.
      if (!mountedRef.current || gameRef.current || !containerRef.current) return;
      const g = createGame(containerRef.current);
      gameRef.current = g;
      g.registry.set('manhunt', stateRef.current.manhunt);
      g.registry.set('heatFrac', stateRef.current.heatFrac);
    });
  }, []);
  const unmount = useCallback(() => {
    mountedRef.current = false;
    gameRef.current?.destroy(true);
    gameRef.current = null;
  }, []);

  useEffect(() => {
    mount();
    // The Settings toggle flips the flag then dispatches this event so the layer
    // appears/disappears live, no reload.
    const onToggle = () => (sceneEnabled() ? mount() : unmount());
    window.addEventListener('nf-scene-toggle', onToggle);
    return () => {
      window.removeEventListener('nf-scene-toggle', onToggle);
      unmount();
    };
  }, [mount, unmount]);

  // Feed state changes through to the scene.
  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    g.registry.set('manhunt', manhunt);
    g.registry.set('heatFrac', heatFrac);
  }, [manhunt, heatFrac]);

  // Fire a one-shot vignette at the relevant pin when a job launches/collects.
  const lastVig = useRef(0);
  useEffect(() => {
    const g = gameRef.current;
    if (!g || !event || eventId === lastVig.current) return;
    lastVig.current = eventId;
    let kind: string | null = null;
    let heistId: string | undefined;
    if (event.kind === 'launch') {
      kind = 'arrive';
      heistId = event.heistId;
    } else if (event.kind === 'collect') {
      heistId = event.heistId;
      kind = !event.success ? 'bust' : event.turfSeized ? 'turf' : 'getaway';
    }
    if (!kind || !heistId) return;
    const pos = slotForHeist(game, heistId);
    if (!pos) return;
    g.events.emit('nf-vignette', { kind, nx: pos.nx, ny: pos.ny });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, eventId]);

  return <div ref={containerRef} className="nf-scene" aria-hidden="true" />;
}
