// -----------------------------------------------------------------------------
// SCENE ATLAS — placeholder actor art, baked at runtime
// -----------------------------------------------------------------------------
// Portal-grade sprites need real art (CC0 packs now, commissioned later). Until
// those land, we BAKE stand-in textures at runtime with Phaser Graphics — no
// binary files, no asset pipeline to block on, and they read as proper top-down
// neon-noir vehicles/people rather than colored boxes.
//
// SWAP-IN SPEC (how real art replaces these, with zero engine changes):
//   * Load a sprite sheet / atlas under the SAME texture key in KEYS below.
//   * Orientation: authored pointing EAST (to the right); the scene rotates the
//     sprite to its heading. Origin is centre.
//   * Suggested source sizes (px, tune freely — the scene scales by role):
//       cars/cruiser  ~30x16   van ~34x18   pedestrian ~10x14
//   * For animated art, register the walk/drive frames as a Phaser animation on
//     the same key; the scene plays 'key' + '_move' if it exists, else shows the
//     static frame. Nothing else in the scene needs to change.
// -----------------------------------------------------------------------------

import Phaser from 'phaser';

// Real CC0 actor art (Kenney Racing Pack, see assets/CREDITS.md), pre-processed
// offline to face east, noir-tinted, and sized to the baked placeholders. Vite
// fingerprints these imports and emits relative URLs (works on itch too).
import carUrl0 from './assets/nf_car0.png';
import carUrl1 from './assets/nf_car1.png';
import carUrl2 from './assets/nf_car2.png';
import cruiserRedUrl from './assets/nf_cruiser_r.png';
import cruiserBlueUrl from './assets/nf_cruiser_b.png';
import pedUrl0 from './assets/nf_ped0.png';
import pedUrl1 from './assets/nf_ped1.png';

/** Stable texture keys. Real art must publish under these exact names. */
export const KEYS = {
  cars: ['nf_car0', 'nf_car1', 'nf_car2'] as const,
  van: 'nf_van',
  cruiserRed: 'nf_cruiser_r',
  cruiserBlue: 'nf_cruiser_b',
  peds: ['nf_ped0', 'nf_ped1'] as const,
  glow: 'nf_glow',
  glowRed: 'nf_glow_r',
  glowBlue: 'nf_glow_b',
} as const;

/** Multiply an 0xRRGGBB colour toward black (for outlines/shading). */
function darken(color: number, f: number): number {
  const r = Math.round(((color >> 16) & 0xff) * f);
  const g = Math.round(((color >> 8) & 0xff) * f);
  const b = Math.round((color & 0xff) * f);
  return (r << 16) | (g << 8) | b;
}

/** Multiply an 0xRRGGBB colour toward white (for highlights). */
function lighten(color: number, f: number): number {
  const r = Math.min(255, Math.round(((color >> 16) & 0xff) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 0xff) * f));
  const b = Math.min(255, Math.round((color & 0xff) * f));
  return (r << 16) | (g << 8) | b;
}

/** A top-down car/van (faces east): wheels, shaded body, cabin with front + rear
 *  glass, head/taillights. Detailed enough to read as a vehicle at map zoom. */
function bakeVehicle(scene: Phaser.Scene, key: string, w: number, h: number, body: number, roof: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // drop shadow
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(2, 4, w - 3, h - 3, 5);
  // wheels poking out along both sides, near front and rear
  g.fillStyle(0x0a0d12, 1);
  const ww = Math.max(3, w * 0.14);
  const wh = 2.5;
  for (const wx of [w * 0.2, w * 0.64]) {
    g.fillRoundedRect(wx, 0.5, ww, wh, 1);
    g.fillRoundedRect(wx, h - wh - 1.5, ww, wh, 1);
  }
  // body + top highlight band + outline
  g.fillStyle(body, 1);
  g.fillRoundedRect(1, 2, w - 3, h - 5, 5);
  g.fillStyle(lighten(body, 1.28), 0.45);
  g.fillRoundedRect(2, 3, w - 5, (h - 5) * 0.42, 4);
  g.lineStyle(1, darken(body, 0.5), 0.9);
  g.strokeRoundedRect(1.5, 2.5, w - 4, h - 6, 5);
  // cabin / roof
  g.fillStyle(roof, 1);
  g.fillRoundedRect(w * 0.3, 4.5, w * 0.34, h - 10, 2);
  // front windshield + rear window
  g.fillStyle(0xbfefff, 0.6);
  g.fillRect(w * 0.6, 5, Math.max(1, w * 0.045), h - 11);
  g.fillStyle(0x8fc8e0, 0.5);
  g.fillRect(w * 0.31, 5, Math.max(1, w * 0.035), h - 11);
  // headlights (front) + taillights (rear)
  g.fillStyle(0xfff3c0, 1);
  g.fillRect(w - 3, 3.5, 2, 2.5);
  g.fillRect(w - 3, h - 7, 2, 2.5);
  g.fillStyle(0xff5a48, 1);
  g.fillRect(1.5, 3.5, 1.5, 2.5);
  g.fillRect(1.5, h - 7, 1.5, 2.5);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A two-tone police cruiser (faces east): white body, black hood, grey roof with
 *  a two-cell light bar (the lit colours alternate per frame → siren flash). */
function bakeCruiser(scene: Phaser.Scene, key: string, litLeft: number, litRight: number): void {
  const w = 36;
  const h = 18;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(2, 4, w - 3, h - 3, 5);
  // wheels
  g.fillStyle(0x0a0d12, 1);
  for (const wx of [w * 0.2, w * 0.64]) {
    g.fillRoundedRect(wx, 0.5, w * 0.14, 2.5, 1);
    g.fillRoundedRect(wx, h - 4, w * 0.14, 2.5, 1);
  }
  // white body
  g.fillStyle(0xe8edf2, 1);
  g.fillRoundedRect(1, 2, w - 3, h - 5, 5);
  g.lineStyle(1, 0x8a939c, 0.9);
  g.strokeRoundedRect(1.5, 2.5, w - 4, h - 6, 5);
  // black hood (front third)
  g.fillStyle(0x11151b, 1);
  g.fillRoundedRect(w * 0.66, 3, w * 0.3, h - 7, 3);
  // grey roof + light bar
  g.fillStyle(0x9aa4ae, 1);
  g.fillRoundedRect(w * 0.3, 4.5, w * 0.3, h - 10, 2);
  g.fillStyle(litLeft, 1);
  g.fillRect(w * 0.33, 5, w * 0.11, h - 11);
  g.fillStyle(litRight, 1);
  g.fillRect(w * 0.46, 5, w * 0.11, h - 11);
  // headlights on the black hood
  g.fillStyle(0xffffff, 1);
  g.fillRect(w - 3, 3.5, 2, 2.5);
  g.fillRect(w - 3, h - 7, 2, 2.5);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** A top-down pedestrian: legs, a coat/torso with shoulders, and a head with a
 *  cap. Baked facing "down"; the scene keeps peds upright. */
function bakePed(scene: Phaser.Scene, key: string, coat: number): void {
  const w = 12;
  const h = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // ground shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 1.5, w - 3, 3);
  // legs
  g.fillStyle(0x171b26, 1);
  g.fillRect(w * 0.34, h - 6, 2, 5);
  g.fillRect(w * 0.55, h - 6, 2, 5);
  // shoulders / arms
  g.fillStyle(darken(coat, 0.8), 1);
  g.fillRect(w * 0.14, 6.5, 1.8, h - 12);
  g.fillRect(w * 0.78, 6.5, 1.8, h - 12);
  // coat / torso
  g.fillStyle(coat, 1);
  g.fillRoundedRect(w * 0.24, 5, w * 0.52, h - 9, 2);
  g.fillStyle(lighten(coat, 1.25), 0.4);
  g.fillRect(w * 0.32, 5.5, w * 0.36, 1.6);
  g.lineStyle(1, darken(coat, 0.5), 0.8);
  g.strokeRoundedRect(w * 0.24, 5, w * 0.52, h - 9, 2);
  // head + cap
  g.fillStyle(0xd9bd9a, 1);
  g.fillCircle(w / 2, 4, 2.7);
  g.fillStyle(0x20242c, 1);
  g.fillEllipse(w / 2, 3, 5.4, 3.4);
  g.generateTexture(key, w, h);
  g.destroy();
}

function bakeGlow(scene: Phaser.Scene, key: string, color: number, size: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const r = size / 2;
  for (let i = 7; i >= 1; i--) {
    g.fillStyle(color, 0.06);
    g.fillCircle(r, r, (r * i) / 7);
  }
  g.generateTexture(key, size, size);
  g.destroy();
}

/** Real-art URL for each texture key we ship art for. Keys absent here (van,
 *  glows) keep their baked placeholder. */
const ACTOR_ART: Record<string, string> = {
  [KEYS.cars[0]]: carUrl0,
  [KEYS.cars[1]]: carUrl1,
  [KEYS.cars[2]]: carUrl2,
  [KEYS.cruiserRed]: cruiserRedUrl,
  [KEYS.cruiserBlue]: cruiserBlueUrl,
  [KEYS.peds[0]]: pedUrl0,
  [KEYS.peds[1]]: pedUrl1,
};

/** Queue the real actor textures. Call from a scene's preload(); Phaser loads
 *  them before create(), where bakeAtlas() then fills in anything missing. */
export function loadActorArt(scene: Phaser.Scene): void {
  for (const [key, url] of Object.entries(ACTOR_ART)) {
    if (!scene.textures.exists(key)) scene.load.image(key, url);
  }
}

/** Bake every placeholder texture. Idempotent — skips keys already present, so
 *  it's safe to call on scene restart. */
export function bakeAtlas(scene: Phaser.Scene): void {
  const has = (k: string) => scene.textures.exists(k);
  // civilian cars — three body colours for street variety
  const carColors: Array<[number, number]> = [
    [0x2c3a52, 0x415270], // slate
    [0x4a2f3a, 0x6a4552], // maroon
    [0x2f4a44, 0x456a60], // teal
  ];
  KEYS.cars.forEach((k, i) => {
    if (!has(k)) bakeVehicle(scene, k, 36, 18, carColors[i][0], carColors[i][1]);
  });
  if (!has(KEYS.van)) bakeVehicle(scene, KEYS.van, 42, 20, 0x1f2733, 0x2c3a4c);
  if (!has(KEYS.cruiserRed)) bakeCruiser(scene, KEYS.cruiserRed, 0xff3b3b, 0x101830);
  if (!has(KEYS.cruiserBlue)) bakeCruiser(scene, KEYS.cruiserBlue, 0x14203a, 0x3b6bff);
  KEYS.peds.forEach((k, i) => {
    if (!has(k)) bakePed(scene, k, i === 0 ? 0x3a4a63 : 0x5a3f4a);
  });
  if (!has(KEYS.glow)) bakeGlow(scene, KEYS.glow, 0xfff3c0, 40);
  if (!has(KEYS.glowRed)) bakeGlow(scene, KEYS.glowRed, 0xff3b3b, 44);
  if (!has(KEYS.glowBlue)) bakeGlow(scene, KEYS.glowBlue, 0x3b6bff, 44);
}
