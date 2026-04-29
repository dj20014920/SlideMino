import { useEffect, useRef } from 'react';

/* Neon Cortex — Shibuya Crossing Cityscape
   VP=(55%,48%) 오른쪽 치우침, 하단 넓은 도로, 좌우 빌딩, 대형 전광판, 차량 라이트 트레일
   원칙: 대담한 면(fill)+네온 엣지+최소 디테일 → 도시 구조가 명확하게 읽힘 */

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }
function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }

const VP_X = 0.55;
const VP_Y = 0.48;
const ROAD_HALF = 0.40; // road half-width at bottom relative to screen

function roadLeft(w: number, d: number): number { return w * (VP_X - ROAD_HALF * d); }
function roadRight(w: number, d: number): number { return w * (VP_X + ROAD_HALF * d); }
function sy(h: number, d: number): number { return h * VP_Y + (h - h * VP_Y) * d; }
function rdepth(y: number, h: number): number { return clamp((y - h * VP_Y) / (h - h * VP_Y), 0, 1); }

interface Trail {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number;
  len: number; alpha: number;
  color: string; // css color like '#00e5ff'
}

function renderScene(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d')!;
  const VX = w * VP_X, VY = h * VP_Y;

  /* ═══ 1. Sky ═══ */
  const sky = ctx.createLinearGradient(0, 0, 0, VY);
  sky.addColorStop(0, '#020218');
  sky.addColorStop(0.5, '#06061e');
  sky.addColorStop(1, '#0a0520');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, VY);

  // Light pollution halo
  for (const hx of [0.25, 0.5, 0.75]) {
    const g = ctx.createRadialGradient(w * hx, VY * 0.6, 0, w * hx, VY * 0.6, h * 0.25);
    const col = hx < 0.4 ? 'rgba(0,140,240,0.025)' : hx > 0.6 ? 'rgba(255,0,80,0.022)' : 'rgba(80,0,180,0.018)';
    g.addColorStop(0, col); g.addColorStop(1, 'transparent');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, VY);
  }

  /* ═══ 2. Road ═══ */
  const rlx = (d: number) => roadLeft(w, d);
  const rrx = (d: number) => roadRight(w, d);

  // Road surface
  ctx.fillStyle = '#0a0a18';
  ctx.beginPath();
  ctx.moveTo(VX, VY);
  ctx.lineTo(rlx(1), h);
  ctx.lineTo(rrx(1), h);
  ctx.closePath();
  ctx.fill();

  // Asphalt texture gradient
  const rdG = ctx.createLinearGradient(0, VY, 0, h);
  rdG.addColorStop(0, 'rgba(0,0,0,0.35)');
  rdG.addColorStop(0.25, 'rgba(6,3,12,0.04)');
  rdG.addColorStop(0.5, 'rgba(8,4,14,0.03)');
  rdG.addColorStop(0.7, 'rgba(10,5,16,0.08)');
  rdG.addColorStop(1, 'rgba(12,7,18,0.5)');
  ctx.fillStyle = rdG; ctx.fillRect(0, VY, w, h - VY);

  // Center lane dashes
  ctx.fillStyle = 'rgba(190,200,220,0.11)';
  for (let i = 0; i < 28; i++) {
    const d1 = i * 0.036, d2 = d1 + 0.02;
    if (d2 > 1) break;
    const y1 = sy(h, d1), y2 = sy(h, d2);
    const lw = 2 * d1 * d1;
    ctx.beginPath();
    ctx.moveTo(VX - lw / 2, y1); ctx.lineTo(VX + lw / 2, y1);
    ctx.lineTo(VX + lw / 2, y2); ctx.lineTo(VX - lw / 2, y2);
    ctx.fill();
  }

  // Crosswalk
  const crossDepth = 0.62;
  for (let i = 0; i < 12; i++) {
    const d1 = crossDepth - 0.015 + i * 0.003;
    const d2 = d1 + 0.002;
    if (d1 < 0 || d1 > 1) continue;
    const y1 = sy(h, d1), y2 = sy(h, Math.min(d2, 1));
    const lx1 = rlx(d1), rx1 = rrx(d1);
    const lx2 = rlx(Math.min(d2, 1)), rx2 = rrx(Math.min(d2, 1));
    const a = 0.07 + i * 0.004;
    ctx.fillStyle = `rgba(200,210,230,${a})`;
    ctx.beginPath();
    ctx.moveTo(lx1, y1); ctx.lineTo(rx1, y1);
    ctx.lineTo(rx2, y2); ctx.lineTo(lx2, y2);
    ctx.fill();
  }

  // Curb lines
  ctx.strokeStyle = 'rgba(0,180,240,0.05)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(VX, VY); ctx.lineTo(rlx(1) - 2, h); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(VX, VY); ctx.lineTo(rrx(1) + 2, h); ctx.stroke();

  // Wet reflection
  const wet = ctx.createLinearGradient(0, VY, 0, h);
  wet.addColorStop(0, 'rgba(0,160,230,0.012)');
  wet.addColorStop(0.4, 'rgba(100,0,220,0.02)');
  wet.addColorStop(0.7, 'rgba(240,0,110,0.014)');
  wet.addColorStop(1, 'rgba(0,220,255,0.025)');
  ctx.fillStyle = wet; ctx.fillRect(0, VY, w, h - VY);

  /* ═══ 3. Left Buildings ═══ */
  // L1 - far
  (() => {
    const t = 0.13, b = 0.32;
    const xl = 0, xr = rlx(b * 0.55) / w;
    ctx.fillStyle = 'rgba(5,4,14,0.94)';
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xr, h * t);
    ctx.lineTo(w * xr, h * b); ctx.lineTo(w * xl, h * b); ctx.fill();

    // Rim
    const rg = ctx.createLinearGradient(0, h * t, 0, h * t + 3);
    rg.addColorStop(0, 'rgba(0,220,255,0.12)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(w * xl, h * t, w * (xr - xl), 3);

    // Window rows (horizontal only)
    for (let r = 0; r < 4; r++) {
      const rt = t + (b - t) * (r + 0.5) / 4;
      ctx.strokeStyle = 'rgba(0,180,220,0.06)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(w * xl + 4, h * rt); ctx.lineTo(w * xr - 4, h * rt); ctx.stroke();
    }
    // Vertical dividers
    for (let c = 0; c < 3; c++) {
      const ct = xl + (xr - xl) * (c + 0.5) / 3;
      ctx.strokeStyle = 'rgba(0,180,220,0.05)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(w * ct, h * t + 3); ctx.lineTo(w * ct, h * b - 3); ctx.stroke();
    }
  })();

  // L2 - mid
  (() => {
    const t = 0.26, b = 0.56;
    const xl = 0, xr = rlx(0.58) / w;
    ctx.fillStyle = 'rgba(5,4,14,0.94)';
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xr, h * t);
    ctx.lineTo(w * xr, h * b); ctx.lineTo(w * xl, h * b); ctx.fill();

    // Rim
    const rg = ctx.createLinearGradient(0, h * t, 0, h * t + 4);
    rg.addColorStop(0, 'rgba(0,220,255,0.14)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(w * xl, h * t, w * (xr - xl), 4);

    // Billboard: 24H
    const bx = w * 0.04, by = h * 0.32, bw = w * 0.11, bh = h * 0.04;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = '#ffb300aa'; ctx.lineWidth = 1.5; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
    ctx.font = 'bold 16px "Share Tech Mono",monospace'; ctx.fillStyle = '#ffb300';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 8; ctx.fillText('24H', bx + bw / 2, by + bh / 2); ctx.shadowBlur = 0;

    // Billboard: NEON
    const bx2 = w * 0.03, by2 = h * 0.45, bw2 = w * 0.1, bh2 = h * 0.045;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.strokeStyle = '#00e5ffaa'; ctx.lineWidth = 1.5; ctx.fillRect(bx2, by2, bw2, bh2); ctx.strokeRect(bx2, by2, bw2, bh2);
    ctx.font = 'bold 18px "Share Tech Mono",monospace'; ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 8; ctx.fillText('NEON', bx2 + bw2 / 2, by2 + bh2 / 2); ctx.shadowBlur = 0;

    // Window rows
    for (let r = 0; r < 5; r++) {
      const rt = t + (b - t) * (0.1 + r * 0.16);
      ctx.strokeStyle = 'rgba(0,180,220,0.07)'; ctx.lineWidth = 0.6;
      ctx.beginPath(); ctx.moveTo(w * xl + 4, h * rt); ctx.lineTo(w * xr - 4, h * rt); ctx.stroke();
    }
  })();

  // L3 - near
  (() => {
    const t = 0.45, b = 0.92;
    const xl = 0, xr = rlx(0.72) / w;
    ctx.fillStyle = 'rgba(4,3,12,0.95)';
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xr, h * t);
    ctx.lineTo(w * xr, h * b); ctx.lineTo(w * xl, h * b); ctx.fill();

    // Rim
    const rg = ctx.createLinearGradient(0, h * t, 0, h * t + 5);
    rg.addColorStop(0, 'rgba(0,220,255,0.16)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(w * xl, h * t, w * (xr - xl), 5);

    // Billboard: CYBERPUNK
    const bx = w * 0.02, by = h * 0.52, bw = w * 0.16, bh = h * 0.055;
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.strokeStyle = '#ff0080cc'; ctx.lineWidth = 2; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
    ctx.font = 'bold 20px "Share Tech Mono",monospace'; ctx.fillStyle = '#ff0080';
    ctx.shadowColor = '#ff0080'; ctx.shadowBlur = 10; ctx.fillText('CYBER', bx + bw / 2, by + bh / 2); ctx.shadowBlur = 0;

    // Billboard: TOKYO
    const bx2 = w * 0.02, by2 = h * 0.68, bw2 = w * 0.12, bh2 = h * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = '#00e5ffcc'; ctx.lineWidth = 2; ctx.fillRect(bx2, by2, bw2, bh2); ctx.strokeRect(bx2, by2, bw2, bh2);
    ctx.font = 'bold 24px "Share Tech Mono",monospace'; ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12; ctx.fillText('TOKYO', bx2 + bw2 / 2, by2 + bh2 / 2); ctx.shadowBlur = 0;

    // Window rows
    for (let r = 0; r < 6; r++) {
      const rt = t + (b - t) * (0.05 + r * 0.13);
      ctx.strokeStyle = 'rgba(0,180,220,0.08)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(w * xl + 5, h * rt); ctx.lineTo(w * xr - 5, h * rt); ctx.stroke();
    }
  })();

  /* ═══ 4. Right Buildings ═══ */
  // R1 - far
  (() => {
    const t = 0.14, b = 0.30;
    const xl = rrx(0.5) / w, xr = 1;
    ctx.fillStyle = 'rgba(5,4,14,0.94)';
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xr, h * t);
    ctx.lineTo(w * xr, h * b); ctx.lineTo(w * xl, h * b); ctx.fill();

    const rg = ctx.createLinearGradient(0, h * t, 0, h * t + 3);
    rg.addColorStop(0, 'rgba(0,220,255,0.12)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(w * xl, h * t, w * (xr - xl), 3);

    for (let r = 0; r < 3; r++) {
      const rt = t + (b - t) * (r + 0.5) / 3;
      ctx.strokeStyle = 'rgba(0,180,220,0.06)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(w * xl + 4, h * rt); ctx.lineTo(w * xr - 4, h * rt); ctx.stroke();
    }
  })();

  // R2 - mid (glass curtain wall)
  (() => {
    const t = 0.24, b = 0.58;
    const xl = rrx(0.55) / w, xr = 1;
    // Glass-like facade
    const fg = ctx.createLinearGradient(w * xl, 0, w * xr, 0);
    fg.addColorStop(0, 'rgba(4,3,12,0.92)');
    fg.addColorStop(0.3, 'rgba(6,4,15,0.88)');
    fg.addColorStop(0.5, 'rgba(8,5,18,0.86)');
    fg.addColorStop(1, 'rgba(4,3,12,0.92)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xr, h * t);
    ctx.lineTo(w * xr, h * b); ctx.lineTo(w * xl, h * b); ctx.fill();

    // Rim
    const rg = ctx.createLinearGradient(0, h * t, 0, h * t + 4);
    rg.addColorStop(0, 'rgba(0,220,255,0.16)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(w * xl, h * t, w * (xr - xl), 4);

    // Side rim
    ctx.strokeStyle = 'rgba(0,220,255,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xl, h * b); ctx.stroke();

    // Billboard: 2048 (large)
    const bx = w * 0.82, by = h * 0.32, bw = w * 0.16, bh = h * 0.07;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.strokeStyle = '#00e5ffcc'; ctx.lineWidth = 2.5; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
    // Inner glow plate
    ctx.strokeStyle = 'rgba(0,229,255,0.2)'; ctx.lineWidth = 3; ctx.strokeRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.font = 'bold 36px "Share Tech Mono",monospace'; ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 16; ctx.fillText('2048', bx + bw / 2, by + bh / 2); ctx.shadowBlur = 0;

    // Billboard: GAME
    const bx2 = w * 0.83, by2 = h * 0.48, bw2 = w * 0.14, bh2 = h * 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.strokeStyle = '#ff0080cc'; ctx.lineWidth = 2; ctx.fillRect(bx2, by2, bw2, bh2); ctx.strokeRect(bx2, by2, bw2, bh2);
    ctx.font = 'bold 22px "Share Tech Mono",monospace'; ctx.fillStyle = '#ff0080';
    ctx.shadowColor = '#ff0080'; ctx.shadowBlur = 10; ctx.fillText('GAME', bx2 + bw2 / 2, by2 + bh2 / 2); ctx.shadowBlur = 0;

    // Window grid lines
    for (let r = 0; r < 6; r++) {
      const rt = t + (b - t) * (0.08 + r * 0.14);
      ctx.strokeStyle = 'rgba(0,200,240,0.08)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(w * xl + 4, h * rt); ctx.lineTo(w * xr - 4, h * rt); ctx.stroke();
    }
    for (let c = 0; c < 3; c++) {
      const ct = xl + (xr - xl) * (c + 0.5) / 3;
      ctx.strokeStyle = 'rgba(0,200,240,0.06)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(w * ct, h * t + 3); ctx.lineTo(w * ct, h * b - 3); ctx.stroke();
    }
  })();

  // R3 - near
  (() => {
    const t = 0.42, b = 0.88;
    const xl = rrx(0.7) / w, xr = 1;
    ctx.fillStyle = 'rgba(5,4,14,0.95)';
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xr, h * t);
    ctx.lineTo(w * xr, h * b); ctx.lineTo(w * xl, h * b); ctx.fill();

    const rg = ctx.createLinearGradient(0, h * t, 0, h * t + 5);
    rg.addColorStop(0, 'rgba(0,220,255,0.16)'); rg.addColorStop(1, 'transparent');
    ctx.fillStyle = rg; ctx.fillRect(w * xl, h * t, w * (xr - xl), 5);

    // Side rim
    ctx.strokeStyle = 'rgba(0,220,255,0.06)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w * xl, h * t); ctx.lineTo(w * xl, h * b); ctx.stroke();

    // Billboard: ラーメン
    const bx = w * 0.86, by = h * 0.58, bw = w * 0.12, bh = h * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeStyle = '#ffb300cc'; ctx.lineWidth = 2; ctx.fillRect(bx, by, bw, bh); ctx.strokeRect(bx, by, bw, bh);
    ctx.font = 'bold 20px "Share Tech Mono",monospace'; ctx.fillStyle = '#ffb300';
    ctx.shadowColor = '#ffb300'; ctx.shadowBlur = 10; ctx.fillText('\u30E9\u30FC\u30E1\u30F3', bx + bw / 2, by + bh / 2); ctx.shadowBlur = 0;

    // Billboard: OPEN
    const bx2 = w * 0.85, by2 = h * 0.72, bw2 = w * 0.13, bh2 = h * 0.05;
    ctx.fillStyle = 'rgba(0,0,0,0.78)';
    ctx.strokeStyle = '#00e5ffcc'; ctx.lineWidth = 2; ctx.fillRect(bx2, by2, bw2, bh2); ctx.strokeRect(bx2, by2, bw2, bh2);
    ctx.font = 'bold 20px "Share Tech Mono",monospace'; ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10; ctx.fillText('OPEN', bx2 + bw2 / 2, by2 + bh2 / 2); ctx.shadowBlur = 0;

    for (let r = 0; r < 5; r++) {
      const rt = t + (b - t) * (0.06 + r * 0.15);
      ctx.strokeStyle = 'rgba(0,180,220,0.08)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(w * xl + 5, h * rt); ctx.lineTo(w * xr - 5, h * rt); ctx.stroke();
    }
  })();

  /* ═══ 5. Center dark overlay for board ═══ */
  const bo = ctx.createRadialGradient(w / 2, h * 0.52, w * 0.04, w / 2, h * 0.52, w * 0.34);
  bo.addColorStop(0, 'rgba(0,0,0,0.40)'); bo.addColorStop(0.5, 'rgba(0,0,0,0.12)');
  bo.addColorStop(1, 'transparent');
  ctx.fillStyle = bo; ctx.fillRect(0, 0, w, h);

  return c;
}

function roadMask(w: number, h: number): Path2D {
  const VX = w * VP_X, VY = h * VP_Y;
  const p = new Path2D();
  p.moveTo(VX, VY);
  p.lineTo(roadLeft(w, 1), h);
  p.lineTo(roadRight(w, 1), h);
  p.closePath();
  return p;
}

/* ═══ Component ═══ */
export default function NeonCortexBg() {
  const cr = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const can = cr.current; if (!can) return;
    const ctx = can.getContext('2d'); if (!ctx) return;

    let w = 0, h = 0;
    let scene: HTMLCanvasElement | null = null;
    let mask: Path2D = new Path2D();
    let rid = 0, tick = 0, glUntil = 0;
    let glSlices: Array<{ y: number; h: number; ox: number }> = [];

    const trails: Trail[] = [];
    const MAX_T = 10;

    function spawn() {
      const VY = h * VP_Y;
      const d = 0.2 + Math.random() * 0.75;
      const ty = sy(h, d);
      const trx = roadLeft(w, d);
      const txx = roadRight(w, d);
      const dir = Math.random() > 0.5 ? 1 : -1;
      const spd = dir * (1.5 + Math.random() * 3) * (0.25 + d * 0.75);
      const colors = [
        { c: '#00e5ff', p: 0.25 }, { c: '#ff0080', p: 0.15 },
        { c: '#ff3030', p: 0.2 }, { c: '#ffffff', p: 0.3 }, { c: '#7000ff', p: 0.1 },
      ];
      let r = Math.random(), acc = 0, col = '#ffffff';
      for (const { c, p } of colors) { acc += p; if (r < acc) { col = c; break; } }

      trails.push({
        x: dir === 1 ? trx : txx, y: ty, vx: spd, vy: 0,
        life: 0, maxLife: 40 + Math.random() * 100,
        len: 30 + Math.random() * 80 * (0.3 + d * 0.7),
        alpha: 0.35 + Math.random() * 0.45, color: col,
      });
    }

    function resize() {
      const dpr = 0.6;
      w = Math.floor(can.offsetWidth * dpr);
      h = Math.floor(can.offsetHeight * dpr);
      can.width = w; can.height = h;
      scene = renderScene(w, h);
      mask = roadMask(w, h);
      trails.length = 0;
    }

    function frame(_t: number) {
      rid = requestAnimationFrame(frame); tick++;

      ctx!.clearRect(0, 0, w, h);
      if (scene) ctx!.drawImage(scene, 0, 0);

      if (trails.length < MAX_T && Math.random() < 0.05) spawn();

      // Car trails - clipped to road
      ctx!.save(); ctx!.clip(mask);

      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i];
        t.life++;
        t.x += t.vx;
        t.y += t.vy;
        if (t.life > t.maxLife || t.y > h || t.y < 0) { trails.splice(i, 1); continue; }

        const p = t.life / t.maxLife;
        const fade = p < 0.1 ? p / 0.1 : p > 0.9 ? (1 - p) / 0.1 : 1;
        const a = t.alpha * fade;
        const d = rdepth(t.y, h);
        const dir = t.vx > 0 ? 1 : -1;

        // Streak line
        const lw = 1 + d * 3.5;
        ctx!.strokeStyle = t.color + Math.floor(a * 255).toString(16).padStart(2, '0');
        ctx!.lineWidth = lw;
        ctx!.beginPath();
        ctx!.moveTo(t.x, t.y);
        const endX = t.x - dir * t.len;
        ctx!.lineTo(endX, t.y + (Math.random() - 0.5) * 1.5);
        ctx!.stroke();

        // Core bright streak
        ctx!.strokeStyle = 'rgba(255,255,255,' + (a * 0.65) + ')';
        ctx!.lineWidth = lw * 0.3;
        ctx!.beginPath();
        ctx!.moveTo(t.x, t.y);
        ctx!.lineTo(t.x - dir * t.len * 0.5, t.y);
        ctx!.stroke();

        // Glow bloom around head
        const gl = ctx!.createRadialGradient(t.x, t.y, 0, t.x, t.y, 4 + d * 5);
        gl.addColorStop(0, t.color + '66');
        gl.addColorStop(1, 'transparent');
        ctx!.fillStyle = gl;
        ctx!.fillRect(t.x - 8, t.y - 5, 16, 10);
      }

      ctx!.restore();

      // Fog
      const ft = tick * 0.006;
      ctx!.globalCompositeOperation = 'lighter';
      for (let fi = 0; fi < 3; fi++) {
        const fy = sy(h, 0.08 + fi * 0.25);
        const fa = 0.006 + 0.005 * Math.sin(ft + fi * 2);
        const fg = ctx!.createLinearGradient(0, fy - 8, 0, fy + 14);
        const fcs = ['rgba(0,229,255,', 'rgba(255,0,128,', 'rgba(112,0,255,'];
        fg.addColorStop(0, 'transparent'); fg.addColorStop(0.5, fcs[fi] + fa + ')'); fg.addColorStop(1, 'transparent');
        ctx!.fillStyle = fg; ctx!.fillRect(0, fy - 8, w, 22);
      }
      ctx!.globalCompositeOperation = 'source-over';

      // Scanlines
      ctx!.fillStyle = 'rgba(0,0,0,0.022)';
      for (let y = 0; y < h; y += 3) ctx!.fillRect(0, y, w, 1);

      // Glitch
      if (tick > glUntil && Math.random() < 0.005) {
        glUntil = tick + 3 + Math.floor(Math.random() * 8);
        glSlices = [];
        for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
          glSlices.push({ y: Math.floor(Math.random() * h * 0.5), h: 2 + Math.floor(Math.random() * 10), ox: (Math.random() - 0.5) * 16 });
        }
      }
      if (tick <= glUntil) for (const s of glSlices) {
        ctx!.fillStyle = 'rgba(0,229,255,' + (0.04 + Math.random() * 0.03) + ')';
        ctx!.fillRect(s.ox, s.y, Math.abs(s.ox) + 2, s.h);
      }
    }

    resize();
    window.addEventListener('resize', resize);
    rid = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(rid); window.removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={cr} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />;
}
