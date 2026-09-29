// -----------------------------------------------------------------------------
// CITY SCENE — the animated actor layer
// -----------------------------------------------------------------------------
// A transparent Phaser scene that lives over the noir map backdrop and below the
// interactive pins. It brings the streets to life and reacts to the game state
// it's fed through the registry:
//   * ambient traffic + pedestrians drift along a lane grid (always)
//   * a patrol cruiser appears as Heat climbs (heatFrac >= PATROL_AT)
//   * a full chase — siren cruiser hunting a getaway van — runs while a MANHUNT
//     is on, tying the visuals straight to the heat mechanic
// Presentation only: it never writes game state. Motion is delta-timed so it's
// framerate-independent, counts are capped, and Phaser pauses it when the tab is
// hidden. Real art swaps in via atlas.ts without touching this file.
// -----------------------------------------------------------------------------

import Phaser from 'phaser';
import { KEYS, bakeAtlas } from './atlas';

type Axis = 'h' | 'v';

interface Actor {
  c: Phaser.GameObjects.Container;
  axis: Axis;
  dir: 1 | -1;
  speed: number; // px/sec
  lane: number; // cross-axis coordinate (world px)
  role: 'car' | 'ped' | 'patrol' | 'runner' | 'chaser';
  glow?: Phaser.GameObjects.Image;
  body?: Phaser.GameObjects.Image; // cruisers: swapped for siren flash
  phase?: number; // pedestrian walk-bob phase
}

const PATROL_AT = 0.4; // heatFrac at/above which a lone patrol cruises
const MAX_CARS = 9;
const MAX_PEDS = 8;

export class CityScene extends Phaser.Scene {
  private W = 0;
  private H = 0;
  private hLanes: number[] = [];
  private vLanes: number[] = [];
  private walkLanes: number[] = [];
  private cars: Actor[] = [];
  private peds: Actor[] = [];
  private patrol: Actor | null = null;
  private chase: Actor[] = [];
  private manhunt = false;
  private heatFrac = 0;
  private sirenT = 0;
  private sirenOn = false;
  private chaseCooldown = 0;
  private vigCount = 0;

  constructor() {
    super('city');
  }

  create(): void {
    bakeAtlas(this);
    this.readDims();
    for (let i = 0; i < MAX_CARS; i++) this.cars.push(this.makeVehicle('car', true));
    for (let i = 0; i < MAX_PEDS; i++) this.peds.push(this.makePed(true));
    this.scale.on('resize', this.readDims, this);
    // One-shot gameplay vignettes are pushed from React via the game emitter.
    this.game.events.on('nf-vignette', this.onVignette);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.readDims, this);
      this.game.events.off('nf-vignette', this.onVignette);
    });
  }

  private readDims(): void {
    this.W = this.scale.width;
    this.H = this.scale.height;
    this.hLanes = [0.2, 0.44, 0.7, 0.86].map((f) => Math.round(this.H * f));
    this.vLanes = [0.16, 0.5, 0.8].map((f) => Math.round(this.W * f));
    this.walkLanes = [0.26, 0.52, 0.78].map((f) => Math.round(this.H * f) + 14);
  }

  // ---- factories ------------------------------------------------------------

  private carKey(): string {
    return KEYS.cars[Math.floor(Math.random() * KEYS.cars.length)];
  }

  private makeVehicle(role: Actor['role'], scatter: boolean): Actor {
    const axis: Axis = Math.random() < 0.62 ? 'h' : 'v';
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const lane = axis === 'h' ? pick(this.hLanes) : pick(this.vLanes);
    const key =
      role === 'patrol' || role === 'chaser'
        ? KEYS.cruiserRed
        : role === 'runner'
          ? KEYS.van
          : this.carKey();
    const body = this.add.image(0, 0, key);
    const glowKey = role === 'patrol' || role === 'chaser' ? KEYS.glowRed : KEYS.glow;
    const glow = this.add.image(body.width / 2 + 4, 0, glowKey);
    glow.setBlendMode(Phaser.BlendModes.ADD).setScale(0.5).setAlpha(0.5);
    const c = this.add.container(0, 0, [glow, body]);
    c.setDepth(role === 'car' ? 2 : 3);
    const speed =
      role === 'chaser' ? 172 : role === 'runner' ? 158 : role === 'patrol' ? 46 : 42 + Math.random() * 42;
    const a: Actor = { c, axis, dir, speed, lane, role, glow, body };
    this.placeAlongLane(a, scatter ? Math.random() : dir === 1 ? -0.05 : 1.05);
    this.orient(a);
    return a;
  }

  private makePed(scatter: boolean): Actor {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const lane = pick(this.walkLanes);
    const body = this.add.image(0, 0, KEYS.peds[Math.floor(Math.random() * KEYS.peds.length)]);
    const c = this.add.container(0, 0, [body]);
    c.setDepth(3);
    const a: Actor = { c, axis: 'h', dir, speed: 12 + Math.random() * 10, lane, role: 'ped', phase: Math.random() * 6.283 };
    this.placeAlongLane(a, scatter ? Math.random() : dir === 1 ? -0.05 : 1.05);
    return a;
  }

  /** Position an actor along its lane. `t` is 0..1 progress across the axis. */
  private placeAlongLane(a: Actor, t: number): void {
    if (a.axis === 'h') {
      a.c.x = -20 + t * (this.W + 40);
      a.c.y = a.lane;
    } else {
      a.c.x = a.lane;
      a.c.y = -20 + t * (this.H + 40);
    }
  }

  /** Point the actor (art faces east) along its travel heading. */
  private orient(a: Actor): void {
    if (a.role === 'ped') return; // peds stay upright
    a.c.rotation =
      a.axis === 'h' ? (a.dir === 1 ? 0 : Math.PI) : a.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
  }

  private recycle(a: Actor): void {
    // fresh lane/axis/dir, re-enter from the correct edge
    a.axis = a.role === 'ped' ? 'h' : Math.random() < 0.62 ? 'h' : 'v';
    a.dir = Math.random() < 0.5 ? 1 : -1;
    a.lane = a.role === 'ped' ? pick(this.walkLanes) : a.axis === 'h' ? pick(this.hLanes) : pick(this.vLanes);
    if (a.role === 'car') a.speed = 42 + Math.random() * 42;
    this.placeAlongLane(a, a.dir === 1 ? -0.05 : 1.05);
    this.orient(a);
  }

  private offscreen(a: Actor): boolean {
    const m = 40;
    return a.c.x < -m || a.c.x > this.W + m || a.c.y < -m || a.c.y > this.H + m;
  }

  private step(a: Actor, dt: number): void {
    const d = a.speed * dt * a.dir;
    if (a.axis === 'h') a.c.x += d;
    else a.c.y += d;
  }

  // ---- chase / patrol -------------------------------------------------------

  private setPatrol(on: boolean): void {
    if (on && !this.patrol) {
      this.patrol = this.makeVehicle('patrol', true);
    } else if (!on && this.patrol) {
      this.patrol.c.destroy();
      this.patrol = null;
    }
  }

  private spawnChase(): void {
    const axis: Axis = 'h';
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const lane = pick(this.hLanes);
    const runner = this.makeVehicle('runner', false);
    const chaser = this.makeVehicle('chaser', false);
    for (const a of [runner, chaser]) {
      a.axis = axis;
      a.dir = dir;
      a.lane = lane;
      this.orient(a);
    }
    // runner ahead, chaser a few lengths back
    this.placeAlongLane(runner, dir === 1 ? -0.02 : 1.02);
    this.placeAlongLane(chaser, dir === 1 ? -0.14 : 1.14);
    this.chase = [runner, chaser];
  }

  private clearChase(): void {
    for (const a of this.chase) a.c.destroy();
    this.chase = [];
  }

  private flashSiren(chaser: Actor): void {
    if (!chaser.body || !chaser.glow) return;
    chaser.body.setTexture(this.sirenOn ? KEYS.cruiserRed : KEYS.cruiserBlue);
    chaser.glow.setTexture(this.sirenOn ? KEYS.glowRed : KEYS.glowBlue);
    chaser.glow.setAlpha(0.75);
  }

  // ---- one-shot vignettes ---------------------------------------------------

  private onVignette = (p: { kind: string; nx: number; ny: number }): void => {
    const x = Phaser.Math.Clamp(p.nx, 0, 1) * this.W;
    const y = Phaser.Math.Clamp(p.ny, 0, 1) * this.H;
    switch (p.kind) {
      case 'arrive':
        this.vArrive(x, y);
        break;
      case 'getaway':
        this.vGetaway(x, y);
        break;
      case 'bust':
        this.vBust(x, y);
        break;
      case 'turf':
        this.vTurf(x, y);
        break;
    }
  };

  /** Build a vignette in its own container that self-destructs after `life` ms
   *  (which stops any tweens on its children). Capped so bursts can't pile up. */
  private runVignette(build: (c: Phaser.GameObjects.Container) => number): void {
    if (this.vigCount >= 4) return;
    this.vigCount += 1;
    const c = this.add.container(0, 0).setDepth(10);
    const life = build(c);
    this.time.delayedCall(life, () => {
      c.destroy(true);
      this.vigCount -= 1;
    });
  }

  private addGlow(c: Phaser.GameObjects.Container, x: number, y: number, key: string, scale: number, alpha: number): Phaser.GameObjects.Image {
    const g = this.add.image(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha);
    c.add(g);
    return g;
  }

  /** Launch: a van pulls up to the job, a figure slips out toward it, van departs. */
  private vArrive(x: number, y: number): void {
    this.runVignette((c) => {
      const fromLeft = x < this.W / 2;
      const sx = fromLeft ? -34 : this.W + 34;
      const van = this.add.image(sx, y, KEYS.van);
      van.rotation = fromLeft ? 0 : Math.PI;
      const glow = this.addGlow(c, sx, y, KEYS.glow, 0.5, 0.5);
      c.add(van);
      this.tweens.add({
        targets: [van, glow],
        x,
        duration: 850,
        ease: 'Sine.easeOut',
        onComplete: () => {
          const ped = this.add.image(x, y + 2, KEYS.peds[0]);
          c.add(ped);
          this.tweens.add({ targets: ped, y: y - 12, alpha: 0, duration: 550, ease: 'Sine.easeIn' });
          this.time.delayedCall(450, () => {
            this.tweens.add({
              targets: [van, glow],
              x: fromLeft ? this.W + 40 : -40,
              alpha: 0,
              duration: 750,
              ease: 'Sine.easeIn',
            });
          });
        },
      });
      return 2200;
    });
  }

  /** Success: a gold cash burst, then the getaway van speeds off the board. */
  private vGetaway(x: number, y: number): void {
    this.runVignette((c) => {
      const toRight = x <= this.W / 2;
      const ex = toRight ? this.W + 40 : -40;
      const van = this.add.image(x, y, KEYS.van);
      van.rotation = toRight ? 0 : Math.PI;
      const glow = this.addGlow(c, x, y, KEYS.glow, 0.5, 0.6);
      c.add(van);
      for (let i = 0; i < 5; i++) {
        const s = this.add.image(x, y, KEYS.glow).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd27a).setScale(0.24).setAlpha(0.9);
        c.add(s);
        const ang = (Math.PI * 2 * i) / 5 + Math.random();
        this.tweens.add({
          targets: s,
          x: x + Math.cos(ang) * 26,
          y: y + Math.sin(ang) * 26,
          alpha: 0,
          scale: 0.05,
          duration: 700,
          ease: 'Sine.easeOut',
        });
      }
      this.time.delayedCall(220, () => {
        this.tweens.add({ targets: [van, glow], x: ex, alpha: 0, duration: 900, ease: 'Sine.easeIn' });
      });
      return 1500;
    });
  }

  /** Blown job: two cruisers converge on the spot, light-bars flashing. */
  private vBust(x: number, y: number): void {
    this.runVignette((c) => {
      const unit = (sx: number, sy: number, tx: number, ty: number, rot: number) => {
        const car = this.add.image(sx, sy, KEYS.cruiserRed);
        car.rotation = rot;
        const gr = this.addGlow(c, sx, sy, KEYS.glowRed, 0.55, 0.85);
        const gb = this.addGlow(c, sx, sy, KEYS.glowBlue, 0.55, 0);
        c.add(car);
        this.tweens.add({ targets: [car, gr, gb], x: tx, y: ty, duration: 650, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: gr, alpha: 0, duration: 180, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: gb, alpha: 0.85, duration: 180, yoyo: true, repeat: -1 });
      };
      unit(-34, y, x - 16, y, 0);
      unit(x, -34, x, y - 16, Math.PI / 2);
      return 1700;
    });
  }

  /** Turf seized: crew and rival clash, an impact flash, the rival breaks off. */
  private vTurf(x: number, y: number): void {
    this.runVignette((c) => {
      const a = this.add.image(x - 10, y, KEYS.peds[0]);
      const b = this.add.image(x + 10, y, KEYS.peds[1]).setTint(0xff6a5a);
      c.add([a, b]);
      this.tweens.add({ targets: a, x: x - 3, duration: 260, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: b, x: x + 3, duration: 260, yoyo: true, repeat: 1, ease: 'Sine.easeInOut' });
      this.time.delayedCall(260, () => {
        const fl = this.addGlow(c, x, y - 2, KEYS.glow, 0.2, 0.9);
        this.tweens.add({ targets: fl, scale: 0.7, alpha: 0, duration: 380, ease: 'Sine.easeOut' });
      });
      this.time.delayedCall(760, () => {
        this.tweens.add({ targets: b, x: x + 40, alpha: 0, duration: 600, ease: 'Sine.easeIn' });
      });
      return 1500;
    });
  }

  // ---- registry sync --------------------------------------------------------

  private syncState(): void {
    this.manhunt = this.registry.get('manhunt') === true;
    const hf = this.registry.get('heatFrac');
    this.heatFrac = typeof hf === 'number' ? hf : 0;
  }

  // ---- main loop ------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 60) / 1000; // clamp big frame gaps (tab refocus)
    this.syncState();

    for (const a of this.cars) {
      this.step(a, dt);
      if (this.offscreen(a)) this.recycle(a);
    }
    for (const a of this.peds) {
      this.step(a, dt);
      // subtle walk bob so pedestrians read as moving, not sliding
      a.c.y = a.lane + Math.sin(this.time.now / 180 + (a.phase ?? 0)) * 1.3;
      if (this.offscreen(a)) this.recycle(a);
    }

    // Patrol presence tracks Heat, but stands down once the chase takes over.
    this.setPatrol(!this.manhunt && this.heatFrac >= PATROL_AT);
    if (this.patrol) {
      this.step(this.patrol, dt);
      if (this.offscreen(this.patrol)) this.recycle(this.patrol);
    }

    // Chase runs while the manhunt is on; it loops with a short breather.
    if (this.manhunt) {
      if (this.chase.length === 0) {
        this.chaseCooldown -= dt;
        if (this.chaseCooldown <= 0) this.spawnChase();
      } else {
        this.sirenT += dt;
        if (this.sirenT >= 0.16) {
          this.sirenT = 0;
          this.sirenOn = !this.sirenOn;
          const chaser = this.chase[1];
          if (chaser) this.flashSiren(chaser);
        }
        let gone = true;
        for (const a of this.chase) {
          this.step(a, dt);
          if (!this.offscreen(a)) gone = false;
        }
        if (gone) {
          this.clearChase();
          this.chaseCooldown = 1.2;
        }
      }
    } else if (this.chase.length > 0) {
      this.clearChase();
    }
  }
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
