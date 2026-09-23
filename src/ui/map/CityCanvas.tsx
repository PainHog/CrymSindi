// -----------------------------------------------------------------------------
// CITY CANVAS
// -----------------------------------------------------------------------------
// Procedural noir-neon city drawn to a <canvas>: seeded street grid, a river,
// dim filler blocks, and extruded lit landmarks at the fixed SLOTS. Pure
// presentation — redraws on resize, no game state. Heist pins are DOM elements
// layered on top (see MapView).
// -----------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { SLOTS, type LandmarkKind } from './mapSlots';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FOOTPRINT: Record<LandmarkKind, [number, number]> = {
  tower: [30, 40],
  block: [62, 42],
  dome: [48, 48],
  twin: [54, 44],
  bunker: [58, 32],
  spire: [26, 50],
};

function drawLandmark(cx: CanvasRenderingContext2D, x: number, y: number, kind: LandmarkKind, seed: number) {
  const rnd = mulberry32(seed);
  const [w, h] = FOOTPRINT[kind] ?? [46, 40];
  // ground glow — a lit building, not a random color blob
  const gg = cx.createRadialGradient(x, y + 4, 2, x, y + 4, Math.max(w, h) * 1.15);
  gg.addColorStop(0, 'rgba(255,196,130,0.10)');
  gg.addColorStop(1, 'rgba(255,196,130,0)');
  cx.fillStyle = gg;
  cx.beginPath();
  cx.arc(x, y + 4, Math.max(w, h) * 1.15, 0, 7);
  cx.fill();
  const L = x - w / 2;
  const T = y - h / 2;
  const ex = 7;
  cx.fillStyle = '#070c15';
  cx.fillRect(L, T, w, h + ex);
  const tg = cx.createLinearGradient(L, T, L, T + h);
  tg.addColorStop(0, '#1b2942');
  tg.addColorStop(1, '#101a2c');
  cx.fillStyle = tg;
  cx.fillRect(L, T, w, h);
  cx.strokeStyle = 'rgba(70,110,150,0.45)';
  cx.lineWidth = 1;
  cx.strokeRect(L + 0.5, T + 0.5, w - 1, h - 1);
  // lit windows
  const cols = Math.max(2, Math.floor(w / 9));
  const rows = Math.max(2, Math.floor(h / 9));
  const gw = (w - 6) / cols;
  const gh = (h - 6) / rows;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const q = rnd();
      cx.fillStyle = q < 0.14 ? 'rgba(55,232,255,0.55)' : q < 0.26 ? 'rgba(255,182,72,0.5)' : 'rgba(90,115,150,0.16)';
      cx.fillRect(L + 3 + c * gw + gw * 0.2, T + 3 + r * gh + gh * 0.2, Math.max(1.5, gw * 0.5), Math.max(1.5, gh * 0.5));
    }
  }
  // roof accent by kind
  cx.strokeStyle = 'rgba(55,232,255,0.4)';
  cx.lineWidth = 1.2;
  if (kind === 'spire' || kind === 'tower') {
    cx.beginPath();
    cx.moveTo(x, T);
    cx.lineTo(x, T - 10);
    cx.stroke();
    cx.fillStyle = 'rgba(255,61,129,0.9)';
    cx.beginPath();
    cx.arc(x, T - 11, 1.8, 0, 7);
    cx.fill();
  }
  if (kind === 'dome') {
    cx.beginPath();
    cx.arc(x, y, w * 0.34, Math.PI, 0);
    cx.stroke();
  }
  if (kind === 'twin') {
    cx.beginPath();
    cx.moveTo(x, T + 3);
    cx.lineTo(x, T + h - 3);
    cx.stroke();
  }
  if (kind === 'bunker') {
    cx.strokeStyle = 'rgba(255,182,72,0.35)';
    for (let i = -1; i < 2; i++) {
      cx.beginPath();
      cx.moveTo(L + 6, y + i * 6);
      cx.lineTo(L + w - 6, y + i * 6);
      cx.stroke();
    }
  }
}

function drawCity(cx: CanvasRenderingContext2D, W: number, H: number) {
  cx.clearRect(0, 0, W, H);
  const rnd = mulberry32(4242);
  const bg = cx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#0a1120');
  bg.addColorStop(1, '#05070d');
  cx.fillStyle = bg;
  cx.fillRect(0, 0, W, H);
  // recon coordinate ticks
  cx.strokeStyle = 'rgba(60,90,125,0.18)';
  cx.fillStyle = 'rgba(80,110,150,0.35)';
  cx.font = "8px 'JetBrains Mono',monospace";
  cx.lineWidth = 1;
  const gs = Math.max(70, W / 14);
  for (let i = 0, gx = 0; gx < W; gx += gs, i++) {
    cx.beginPath();
    cx.moveTo(gx, 0);
    cx.lineTo(gx, 7);
    cx.stroke();
    cx.fillText(String.fromCharCode(65 + (i % 26)), gx + 3, 11);
  }
  for (let i = 0, gy = 0; gy < H; gy += gs, i++) {
    cx.beginPath();
    cx.moveTo(0, gy);
    cx.lineTo(7, gy);
    cx.stroke();
    if (i > 0) cx.fillText(String(i).padStart(2, '0'), 3, gy + 11);
  }
  // river
  cx.save();
  cx.beginPath();
  const ry = H * 0.63;
  cx.moveTo(-20, ry - 42);
  cx.bezierCurveTo(W * 0.3, ry - 92, W * 0.56, ry + 58, W + 20, ry - 32);
  cx.lineTo(W + 20, ry + 66);
  cx.bezierCurveTo(W * 0.56, ry + 146, W * 0.3, ry + 8, -20, ry + 58);
  cx.closePath();
  const rg = cx.createLinearGradient(0, ry - 60, 0, ry + 120);
  rg.addColorStop(0, '#0a1c2c');
  rg.addColorStop(1, '#07131f');
  cx.fillStyle = rg;
  cx.fill();
  cx.strokeStyle = 'rgba(55,232,255,0.16)';
  cx.lineWidth = 1;
  cx.stroke();
  cx.restore();
  // faint street grid
  const step = Math.max(46, Math.min(W, H) / 13);
  for (let gx = 0; gx <= W + step; gx += step) {
    const j = (rnd() - 0.5) * 8;
    cx.strokeStyle = 'rgba(38,55,82,' + (0.16 + rnd() * 0.2) + ')';
    cx.beginPath();
    cx.moveTo(gx + j, 0);
    cx.lineTo(gx + j * 1.5, H);
    cx.stroke();
  }
  for (let gy = 0; gy <= H + step; gy += step) {
    const j = (rnd() - 0.5) * 8;
    cx.strokeStyle = 'rgba(38,55,82,' + (0.14 + rnd() * 0.2) + ')';
    cx.beginPath();
    cx.moveTo(0, gy + j);
    cx.lineTo(W, gy + j * 1.5);
    cx.stroke();
  }
  // dim filler blocks so landmarks stand out
  for (let bx = step; bx < W - step; bx += step) {
    for (let by = step; by < H - step; by += step) {
      if (rnd() < 0.55) continue;
      const pad = 8 + rnd() * 8;
      const bw = step - pad * 2;
      const bh = step - pad * 2;
      if (bw < 8 || bh < 8) continue;
      cx.fillStyle = 'rgba(14,22,36,' + (0.5 + rnd() * 0.3) + ')';
      cx.fillRect(bx + pad, by + pad, bw, bh);
      cx.strokeStyle = 'rgba(30,44,68,0.4)';
      cx.strokeRect(bx + pad, by + pad, bw, bh);
    }
  }
  // landmarks at every slot
  SLOTS.forEach((sl, i) => drawLandmark(cx, (sl[0] / 100) * W, (sl[1] / 100) * H, sl[2], 100 + i * 77));
}

/** Full-bleed procedural city, redrawn whenever its container resizes. */
export function CityCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const cx = canvas.getContext('2d');
    if (!cx) return;

    let raf = 0;
    const render = () => {
      raf = 0;
      const r = parent.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.max(1, r.width);
      const H = Math.max(1, r.height);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawCity(cx, W, H);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(render);
    };

    render();
    const ro = new ResizeObserver(schedule);
    ro.observe(parent);
    return () => {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={ref} className="nf-city" />;
}
