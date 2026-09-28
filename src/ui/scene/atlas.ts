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

function bakeVehicle(scene: Phaser.Scene, key: string, w: number, h: number, body: number, roof: number): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // drop shadow (slightly offset, soft)
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(1, 3, w - 2, h - 2, 4);
  // body
  g.fillStyle(body, 1);
  g.fillRoundedRect(0, 1, w - 2, h - 4, 4);
  g.lineStyle(1, darken(body, 0.55), 0.9);
  g.strokeRoundedRect(0.5, 1.5, w - 3, h - 5, 4);
  // cabin / roof
  g.fillStyle(roof, 1);
  g.fillRoundedRect(w * 0.26, 3, w * 0.4, h - 8, 2);
  // windshield glint toward the front
  g.fillStyle(0x9fe0ff, 0.5);
  g.fillRect(w * 0.6, 3.5, Math.max(1, w * 0.06), h - 9);
  // headlights (front / right) — warm
  g.fillStyle(0xfff3c0, 1);
  g.fillRect(w - 3, 2.5, 2, 2);
  g.fillRect(w - 3, h - 6.5, 2, 2);
  // taillights (rear / left) — crimson
  g.fillStyle(0xff5a48, 1);
  g.fillRect(1, 2.5, 1.5, 2);
  g.fillRect(1, h - 6.5, 1.5, 2);
  g.generateTexture(key, w, h);
  g.destroy();
}

function bakeCruiser(scene: Phaser.Scene, key: string, litLeft: number, litRight: number): void {
  const w = 30;
  const h = 16;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(1, 3, w - 2, h - 2, 4);
  // dark unmarked-cruiser body
  g.fillStyle(0x161b24, 1);
  g.fillRoundedRect(0, 1, w - 2, h - 4, 4);
  g.lineStyle(1, 0x0a0d12, 0.9);
  g.strokeRoundedRect(0.5, 1.5, w - 3, h - 5, 4);
  // roof + light bar (two cells that alternate per frame → flashing)
  g.fillStyle(0x20262f, 1);
  g.fillRoundedRect(w * 0.26, 3, w * 0.42, h - 8, 2);
  g.fillStyle(litLeft, 1);
  g.fillRect(w * 0.3, 4, w * 0.16, h - 10);
  g.fillStyle(litRight, 1);
  g.fillRect(w * 0.5, 4, w * 0.16, h - 10);
  // headlights
  g.fillStyle(0xffffff, 1);
  g.fillRect(w - 3, 2.5, 2, 2);
  g.fillRect(w - 3, h - 6.5, 2, 2);
  g.generateTexture(key, w, h);
  g.destroy();
}

function bakePed(scene: Phaser.Scene, key: string, coat: number): void {
  const w = 10;
  const h = 14;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // ground shadow
  g.fillStyle(0x000000, 0.3);
  g.fillEllipse(w / 2, h - 2, w - 2, 3);
  // coat / body
  g.fillStyle(coat, 1);
  g.fillRoundedRect(2, 4, w - 4, h - 5, 2);
  g.lineStyle(1, darken(coat, 0.5), 0.8);
  g.strokeRoundedRect(2, 4, w - 4, h - 5, 2);
  // head
  g.fillStyle(0xd9bd9a, 1);
  g.fillCircle(w / 2, 3.4, 2.3);
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
    if (!has(k)) bakeVehicle(scene, k, 30, 16, carColors[i][0], carColors[i][1]);
  });
  if (!has(KEYS.van)) bakeVehicle(scene, KEYS.van, 34, 18, 0x1f2733, 0x2c3a4c);
  if (!has(KEYS.cruiserRed)) bakeCruiser(scene, KEYS.cruiserRed, 0xff3b3b, 0x101830);
  if (!has(KEYS.cruiserBlue)) bakeCruiser(scene, KEYS.cruiserBlue, 0x14203a, 0x3b6bff);
  KEYS.peds.forEach((k, i) => {
    if (!has(k)) bakePed(scene, k, i === 0 ? 0x3a4a63 : 0x5a3f4a);
  });
  if (!has(KEYS.glow)) bakeGlow(scene, KEYS.glow, 0xfff3c0, 40);
  if (!has(KEYS.glowRed)) bakeGlow(scene, KEYS.glowRed, 0xff3b3b, 44);
  if (!has(KEYS.glowBlue)) bakeGlow(scene, KEYS.glowBlue, 0x3b6bff, 44);
}
