// -----------------------------------------------------------------------------
// SCENE GAME — the lazy Phaser entry point
// -----------------------------------------------------------------------------
// Isolated so Phaser lands in its own chunk (SceneLayer imports this only via
// dynamic import()). The base bundle never pays for Phaser unless the animated
// layer actually mounts.
// -----------------------------------------------------------------------------

import Phaser from 'phaser';
import { CityScene } from './CityScene';

/** Create the transparent, parent-filling actor game. Audio is disabled (the
 *  app owns its own SFX) and fps is capped for battery. */
export function createGame(parent: HTMLElement): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    transparent: true,
    banner: false,
    audio: { noAudio: true },
    fps: { target: 30, min: 15 },
    render: { antialias: true, powerPreference: 'low-power' },
    scale: { mode: Phaser.Scale.RESIZE, width: '100%', height: '100%' },
    scene: [CityScene],
  });
  // Debug handle for driving the scene from the console / a headless check.
  if (import.meta.env.DEV) {
    (window as unknown as { __nfCityGame?: Phaser.Game }).__nfCityGame = game;
  }
  return game;
}
