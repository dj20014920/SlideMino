import { useEffect, useRef } from 'react';

type Point = { x: number; y: number };
type Rgb = [number, number, number];

type Trail = {
  x: number;
  y: number;
  vx: number;
  life: number;
  maxLife: number;
  len: number;
  alpha: number;
  width: number;
  rgb: Rgb;
};

const VP_X = 0.535;
const VP_Y = 0.405;
const ROAD_TOP_HALF = 0.5;
const ROAD_HALF = 0.72;
const MAX_TRAILS = 18;

const CYAN: Rgb = [0, 229, 255];
const MAGENTA: Rgb = [255, 0, 128];
const AMBER: Rgb = [255, 179, 0];
const WHITE: Rgb = [245, 250, 255];
const BLUE: Rgb = [58, 145, 255];
const RED: Rgb = [255, 42, 72];

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function rgba([r, g, b]: Rgb, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${clamp(a, 0, 1)})`;
}

function hash(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function roadLeft(w: number, d: number): number {
  return w * (VP_X - lerp(ROAD_TOP_HALF, ROAD_HALF, d));
}

function roadRight(w: number, d: number): number {
  return w * (VP_X + lerp(ROAD_TOP_HALF, ROAD_HALF, d));
}

function roadY(h: number, d: number): number {
  return h * VP_Y + (h - h * VP_Y) * d;
}

function roadDepth(y: number, h: number): number {
  return clamp((y - h * VP_Y) / (h - h * VP_Y), 0, 1);
}

function laneX(w: number, d: number, lane: number): number {
  return w * (VP_X + lerp(ROAD_TOP_HALF, ROAD_HALF, d) * lane);
}

function fillPoly(ctx: CanvasRenderingContext2D, points: Point[], fillStyle: string | CanvasGradient): void {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.fill();
}

function strokePoly(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  strokeStyle: string,
  lineWidth: number,
  close = true
): void {
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  if (close) ctx.closePath();
  ctx.stroke();
}

function drawGlowLine(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  rgb: Rgb,
  alpha: number,
  width: number,
  blur = width * 3
): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = rgba(rgb, alpha);
  ctx.shadowBlur = blur;
  ctx.strokeStyle = rgba(rgb, alpha);
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(WHITE, alpha * 0.45);
  ctx.lineWidth = Math.max(0.6, width * 0.22);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function drawNeonText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  rgb: Rgb,
  blur: number
): void {
  ctx.save();
  ctx.font = `bold ${size}px "Share Tech Mono", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(rgb, 0.96);
  ctx.shadowColor = rgba(rgb, 0.9);
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = rgba(WHITE, 0.24);
  ctx.fillText(text, x, y - Math.max(1, size * 0.03));
  ctx.restore();
}

function drawSign(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  rgb: Rgb,
  size: number,
  fillAlpha = 0.72
): void {
  ctx.save();
  ctx.shadowColor = rgba(rgb, 0.55);
  ctx.shadowBlur = 14;
  ctx.fillStyle = `rgba(2, 6, 17, ${fillAlpha})`;
  ctx.strokeStyle = rgba(rgb, 0.72);
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.035);
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(rgb, 0.18);
  ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.06);
  ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
  drawNeonText(ctx, text, x + w / 2, y + h / 2, size, rgb, Math.max(8, size * 0.45));
  ctx.restore();
}

function drawWindowGrid(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  seed: number,
  tint: Rgb,
  density = 0.5
): void {
  const gap = Math.max(1, Math.min(w / cols, h / rows) * 0.22);
  const cellW = w / cols;
  const cellH = h / rows;

  ctx.save();
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const n = hash(seed + row * 31 + col * 7);
      const lit = n > 1 - density;
      const alpha = lit ? 0.16 + n * 0.22 : 0.035;
      ctx.fillStyle = lit ? rgba(tint, alpha) : 'rgba(16, 28, 44, 0.16)';
      ctx.fillRect(
        x + col * cellW + gap,
        y + row * cellH + gap,
        Math.max(1, cellW - gap * 2),
        Math.max(1, cellH - gap * 2)
      );
    }
  }
  ctx.restore();
}

function drawRoadMask(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(w * VP_X, h * VP_Y);
  ctx.lineTo(roadLeft(w, 1.04), h);
  ctx.lineTo(roadRight(w, 1.04), h);
  ctx.closePath();
}

function roadMask(w: number, h: number): Path2D {
  const p = new Path2D();
  p.moveTo(w * VP_X, h * VP_Y);
  p.lineTo(roadLeft(w, 1.04), h);
  p.lineTo(roadRight(w, 1.04), h);
  p.closePath();
  return p;
}

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#020314');
  sky.addColorStop(0.2, '#031027');
  sky.addColorStop(0.42, '#07152d');
  sky.addColorStop(1, '#080713');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  const centerGlow = ctx.createRadialGradient(w * 0.57, h * 0.22, 0, w * 0.57, h * 0.22, w * 0.68);
  centerGlow.addColorStop(0, 'rgba(41, 171, 255, 0.18)');
  centerGlow.addColorStop(0.38, 'rgba(64, 42, 190, 0.09)');
  centerGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = centerGlow;
  ctx.fillRect(0, 0, w, h);

  const magentaGlow = ctx.createRadialGradient(w * 0.78, h * 0.55, 0, w * 0.78, h * 0.55, w * 0.6);
  magentaGlow.addColorStop(0, 'rgba(255, 0, 128, 0.12)');
  magentaGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = magentaGlow;
  ctx.fillRect(0, 0, w, h);
}

function drawCity(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vh = h * VP_Y;

  const leftTower = [
    { x: 0, y: h * 0.02 },
    { x: w * 0.36, y: 0 },
    { x: w * 0.39, y: vh * 1.08 },
    { x: 0, y: vh * 1.18 },
  ];
  fillPoly(ctx, leftTower, 'rgba(2, 6, 20, 0.95)');
  strokePoly(ctx, leftTower, 'rgba(0, 229, 255, 0.16)', 1.2);
  drawWindowGrid(ctx, w * 0.05, h * 0.04, w * 0.26, h * 0.16, 5, 6, 10, BLUE, 0.42);
  drawSign(ctx, w * 0.11, h * 0.07, w * 0.17, h * 0.055, 'SLIDE', CYAN, Math.max(12, w * 0.027));
  drawSign(ctx, w * 0.18, h * 0.14, w * 0.14, h * 0.055, 'DMC', BLUE, Math.max(11, w * 0.026), 0.66);
  drawSign(ctx, w * 0.07, h * 0.22, w * 0.19, h * 0.06, 'NOVA', AMBER, Math.max(12, w * 0.03), 0.68);
  drawSign(ctx, w * 0.02, h * 0.34, w * 0.2, h * 0.062, 'TOKYO', MAGENTA, Math.max(14, w * 0.034), 0.72);

  const centerBlock = [
    { x: w * 0.34, y: h * 0.08 },
    { x: w * 0.62, y: h * 0.03 },
    { x: w * 0.63, y: vh * 1.04 },
    { x: w * 0.37, y: vh * 1.08 },
  ];
  const centerGrad = ctx.createLinearGradient(w * 0.34, 0, w * 0.62, 0);
  centerGrad.addColorStop(0, 'rgba(4, 11, 28, 0.93)');
  centerGrad.addColorStop(0.55, 'rgba(7, 18, 41, 0.82)');
  centerGrad.addColorStop(1, 'rgba(3, 8, 22, 0.93)');
  fillPoly(ctx, centerBlock, centerGrad);
  strokePoly(ctx, centerBlock, 'rgba(122, 198, 255, 0.14)', 1);
  drawWindowGrid(ctx, w * 0.39, h * 0.08, w * 0.18, h * 0.28, 5, 11, 80, CYAN, 0.58);
  drawSign(ctx, w * 0.41, h * 0.04, w * 0.2, h * 0.06, 'CORTEX', WHITE, Math.max(10, w * 0.024), 0.58);

  const rightGlass = [
    { x: w * 0.58, y: h * 0.02 },
    { x: w, y: 0 },
    { x: w, y: vh * 1.18 },
    { x: w * 0.61, y: vh * 1.02 },
  ];
  const glass = ctx.createLinearGradient(w * 0.58, 0, w, 0);
  glass.addColorStop(0, 'rgba(2, 8, 22, 0.9)');
  glass.addColorStop(0.38, 'rgba(8, 31, 58, 0.72)');
  glass.addColorStop(0.72, 'rgba(2, 12, 26, 0.9)');
  glass.addColorStop(1, 'rgba(1, 5, 17, 0.96)');
  fillPoly(ctx, rightGlass, glass);
  strokePoly(ctx, rightGlass, 'rgba(0, 229, 255, 0.17)', 1.2);
  drawWindowGrid(ctx, w * 0.64, h * 0.13, w * 0.32, h * 0.26, 8, 9, 170, CYAN, 0.56);
  drawSign(ctx, w * 0.68, h * 0.025, w * 0.26, h * 0.075, '2048', WHITE, Math.max(17, w * 0.043), 0.76);
  drawSign(ctx, w * 0.72, h * 0.18, w * 0.23, h * 0.058, 'SLIDEYA', CYAN, Math.max(12, w * 0.029), 0.62);
  drawSign(ctx, w * 0.81, h * 0.31, w * 0.16, h * 0.075, 'MINO', MAGENTA, Math.max(14, w * 0.036), 0.7);

  const farShops = ctx.createLinearGradient(0, vh * 0.84, w, vh * 1.1);
  farShops.addColorStop(0, 'rgba(3, 8, 18, 0.9)');
  farShops.addColorStop(0.5, 'rgba(12, 20, 38, 0.78)');
  farShops.addColorStop(1, 'rgba(2, 7, 18, 0.9)');
  ctx.fillStyle = farShops;
  ctx.fillRect(0, vh * 0.82, w, vh * 0.2);
  drawGlowLine(ctx, { x: 0, y: vh * 0.86 }, { x: w, y: vh * 0.82 }, CYAN, 0.18, 1.2, 8);
  drawGlowLine(ctx, { x: w * 0.14, y: vh * 0.96 }, { x: w * 0.56, y: vh * 0.9 }, AMBER, 0.16, 1.4, 8);

  for (let i = 0; i < 16; i++) {
    const x = w * (0.03 + i * 0.06);
    const y = vh * (0.88 + hash(240 + i) * 0.08);
    const color = i % 3 === 0 ? CYAN : i % 3 === 1 ? MAGENTA : AMBER;
    drawGlowLine(ctx, { x, y }, { x: x + w * (0.035 + hash(300 + i) * 0.05), y: y - h * 0.004 }, color, 0.16, 1.2, 5);
  }

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
  for (let i = 0; i < 18; i++) {
    const isLeft = i < 9;
    const baseX = isLeft ? w * (-0.03 + hash(380 + i) * 0.12) : w * (0.93 + hash(390 + i) * 0.13);
    const top = h * (0.03 + hash(410 + i) * 0.16);
    const crown = h * (0.055 + hash(420 + i) * 0.075);
    ctx.beginPath();
    ctx.ellipse(baseX, top + crown, w * (0.018 + hash(430 + i) * 0.028), crown, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawRoad(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vy = h * VP_Y;

  drawRoadMask(ctx, w, h);
  const roadGradient = ctx.createLinearGradient(0, vy, 0, h);
  roadGradient.addColorStop(0, '#080914');
  roadGradient.addColorStop(0.45, '#0b0d15');
  roadGradient.addColorStop(1, '#08070d');
  ctx.fillStyle = roadGradient;
  ctx.fill();

  const asphalt = ctx.createRadialGradient(w * 0.53, h * 0.78, 0, w * 0.53, h * 0.78, w * 0.74);
  asphalt.addColorStop(0, 'rgba(70, 90, 105, 0.1)');
  asphalt.addColorStop(0.45, 'rgba(0, 229, 255, 0.035)');
  asphalt.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  ctx.fillStyle = asphalt;
  ctx.fillRect(0, vy, w, h - vy);

  ctx.save();
  drawRoadMask(ctx, w, h);
  ctx.clip();

  for (let d = 0.1; d <= 1.02; d += 0.055) {
    const y = roadY(h, d);
    const left = roadLeft(w, d);
    const right = roadRight(w, d);
    const alpha = 0.045 + d * 0.055;
    ctx.strokeStyle = `rgba(190, 210, 230, ${alpha})`;
    ctx.lineWidth = 0.5 + d * 1.2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y - h * 0.018 * d);
    ctx.stroke();
  }

  for (const lane of [-0.68, -0.34, 0, 0.34, 0.68]) {
    const bottom = { x: laneX(w, 1.02, lane), y: h };
    const top = { x: laneX(w, 0, lane * 0.36), y: vy };
    drawGlowLine(ctx, top, bottom, WHITE, lane === 0 ? 0.1 : 0.045, lane === 0 ? 1.1 : 0.8, 2.4);
  }

  for (let i = 0; i < 13; i++) {
    const d0 = 0.45 + i * 0.024;
    const d1 = d0 + 0.013;
    const left0 = laneX(w, d0, -0.96 + i * 0.025);
    const right0 = laneX(w, d0, 0.34 + i * 0.038);
    const left1 = laneX(w, d1, -0.93 + i * 0.025);
    const right1 = laneX(w, d1, 0.4 + i * 0.038);
    fillPoly(ctx, [
      { x: left0, y: roadY(h, d0) },
      { x: right0, y: roadY(h, d0) - h * 0.014 },
      { x: right1, y: roadY(h, d1) - h * 0.014 },
      { x: left1, y: roadY(h, d1) },
    ], `rgba(230, 238, 255, ${0.05 + i * 0.005})`);
  }

  for (let i = 0; i < 8; i++) {
    const d0 = 0.62 + i * 0.03;
    const d1 = d0 + 0.015;
    fillPoly(ctx, [
      { x: laneX(w, d0, -0.2 + i * 0.03), y: roadY(h, d0) - h * 0.018 },
      { x: laneX(w, d0, 0.92), y: roadY(h, d0) - h * 0.04 },
      { x: laneX(w, d1, 0.98), y: roadY(h, d1) - h * 0.04 },
      { x: laneX(w, d1, -0.16 + i * 0.03), y: roadY(h, d1) - h * 0.018 },
    ], `rgba(235, 242, 255, ${0.05 + i * 0.006})`);
  }

  ctx.globalCompositeOperation = 'lighter';
  const staticBands: Array<{ y: number; rgb: Rgb; alpha: number; width: number; skew: number }> = [
    { y: 0.43, rgb: BLUE, alpha: 0.28, width: 2.2, skew: -0.035 },
    { y: 0.455, rgb: CYAN, alpha: 0.36, width: 3.0, skew: -0.026 },
    { y: 0.48, rgb: MAGENTA, alpha: 0.38, width: 3.2, skew: -0.012 },
    { y: 0.505, rgb: WHITE, alpha: 0.3, width: 2.4, skew: 0.008 },
    { y: 0.532, rgb: CYAN, alpha: 0.4, width: 3.8, skew: 0.018 },
    { y: 0.562, rgb: RED, alpha: 0.3, width: 2.8, skew: 0.032 },
    { y: 0.595, rgb: AMBER, alpha: 0.32, width: 3.0, skew: 0.045 },
    { y: 0.635, rgb: MAGENTA, alpha: 0.28, width: 2.6, skew: 0.056 },
  ];
  for (const band of staticBands) {
    drawGlowLine(
      ctx,
      { x: w * -0.04, y: h * band.y },
      { x: w * 1.08, y: h * (band.y + band.skew) },
      band.rgb,
      band.alpha,
      band.width,
      band.width * 9
    );
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();

  const wet = ctx.createLinearGradient(0, vy, 0, h);
  wet.addColorStop(0, 'rgba(255, 255, 255, 0)');
  wet.addColorStop(0.5, 'rgba(0, 229, 255, 0.025)');
  wet.addColorStop(0.73, 'rgba(255, 0, 128, 0.028)');
  wet.addColorStop(1, 'rgba(255, 179, 0, 0.026)');
  ctx.fillStyle = wet;
  ctx.fillRect(0, vy, w, h - vy);
}

function drawTaxi(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const x = w * 0.08;
  const y = h * 0.66;
  const carW = w * 0.28;
  const carH = h * 0.075;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.035);
  ctx.shadowColor = rgba(BLUE, 0.5);
  ctx.shadowBlur = 16;
  fillPoly(ctx, [
    { x: carW * 0.05, y: carH * 0.58 },
    { x: carW * 0.18, y: carH * 0.22 },
    { x: carW * 0.67, y: carH * 0.16 },
    { x: carW * 0.93, y: carH * 0.45 },
    { x: carW * 0.86, y: carH * 0.83 },
    { x: carW * 0.13, y: carH * 0.9 },
  ], 'rgba(7, 11, 19, 0.94)');
  strokePoly(ctx, [
    { x: carW * 0.05, y: carH * 0.58 },
    { x: carW * 0.18, y: carH * 0.22 },
    { x: carW * 0.67, y: carH * 0.16 },
    { x: carW * 0.93, y: carH * 0.45 },
    { x: carW * 0.86, y: carH * 0.83 },
    { x: carW * 0.13, y: carH * 0.9 },
  ], rgba(BLUE, 0.72), 1.4);

  ctx.shadowBlur = 0;
  fillPoly(ctx, [
    { x: carW * 0.2, y: carH * 0.28 },
    { x: carW * 0.4, y: carH * 0.19 },
    { x: carW * 0.6, y: carH * 0.2 },
    { x: carW * 0.7, y: carH * 0.42 },
    { x: carW * 0.24, y: carH * 0.47 },
  ], 'rgba(18, 34, 52, 0.82)');
  ctx.fillStyle = 'rgba(230, 245, 255, 0.72)';
  ctx.fillRect(carW * 0.5, carH * 0.52, carW * 0.18, carH * 0.13);
  ctx.fillStyle = rgba(RED, 0.85);
  ctx.fillRect(carW * 0.08, carH * 0.62, carW * 0.05, carH * 0.1);
  ctx.fillStyle = rgba(AMBER, 0.86);
  ctx.fillRect(carW * 0.82, carH * 0.5, carW * 0.07, carH * 0.1);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.beginPath();
  ctx.ellipse(carW * 0.23, carH * 0.88, carH * 0.15, carH * 0.15, 0, 0, Math.PI * 2);
  ctx.ellipse(carW * 0.73, carH * 0.84, carH * 0.14, carH * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();
  drawGlowLine(ctx, { x: carW * 0.04, y: carH * 0.96 }, { x: carW * 0.92, y: carH * 0.88 }, BLUE, 0.32, 1.4, 8);
  ctx.restore();
}

function drawForegroundAtmosphere(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vignette = ctx.createRadialGradient(w * 0.52, h * 0.48, w * 0.08, w * 0.52, h * 0.5, w * 0.72);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0.18)');
  vignette.addColorStop(0.48, 'rgba(0, 0, 0, 0.04)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.48)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  const boardReadability = ctx.createRadialGradient(w * 0.5, h * 0.48, w * 0.03, w * 0.5, h * 0.48, w * 0.4);
  boardReadability.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
  boardReadability.addColorStop(0.55, 'rgba(0, 0, 0, 0.14)');
  boardReadability.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = boardReadability;
  ctx.fillRect(0, 0, w, h);
}

function renderScene(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  drawSky(ctx, w, h);
  drawCity(ctx, w, h);
  drawRoad(ctx, w, h);
  drawTaxi(ctx, w, h);
  drawForegroundAtmosphere(ctx, w, h);

  return c;
}

function pickTrailColor(): Rgb {
  const roll = Math.random();
  if (roll < 0.26) return CYAN;
  if (roll < 0.45) return MAGENTA;
  if (roll < 0.62) return RED;
  if (roll < 0.82) return WHITE;
  if (roll < 0.92) return BLUE;
  return AMBER;
}

export default function NeonCortexBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let w = 0;
    let h = 0;
    let scene: HTMLCanvasElement | null = null;
    let mask = new Path2D();
    let rafId = 0;
    let tick = 0;
    let glitchUntil = 0;
    let glitchSlices: Array<{ y: number; height: number; offset: number }> = [];
    const trails: Trail[] = [];

    function spawnTrail(initial = false): void {
      if (w <= 0 || h <= 0) return;
      const d = 0.24 + Math.random() * 0.72;
      const left = roadLeft(w, d) - w * 0.04;
      const right = roadRight(w, d) + w * 0.04;
      const dir = Math.random() > 0.5 ? 1 : -1;
      const y = roadY(h, d) - h * (0.02 + Math.random() * 0.035) * (0.4 + d);
      const speed = dir * (1.1 + Math.random() * 3.3) * (0.45 + d * 1.1);
      const len = w * (0.14 + Math.random() * 0.36) * (0.5 + d);
      const maxLife = Math.max(56, (right - left + len * 2) / Math.max(0.1, Math.abs(speed)));
      const trail: Trail = {
        x: initial ? lerp(left, right, Math.random()) : dir > 0 ? left - len : right + len,
        y,
        vx: speed,
        life: initial ? Math.random() * maxLife * 0.85 : 0,
        maxLife,
        len,
        alpha: 0.24 + Math.random() * 0.5,
        width: 1 + d * 3.6,
        rgb: pickTrailColor(),
      };
      trails.push(trail);
    }

    function resize(): void {
      const dpr = Math.min(window.devicePixelRatio || 1, 1);
      w = Math.max(1, Math.floor(canvas.offsetWidth * dpr));
      h = Math.max(1, Math.floor(canvas.offsetHeight * dpr));
      canvas.width = w;
      canvas.height = h;
      scene = renderScene(w, h);
      mask = roadMask(w, h);
      trails.length = 0;
      for (let i = 0; i < 12; i++) spawnTrail(true);
    }

    function drawTrail(trail: Trail): void {
      const d = roadDepth(trail.y, h);
      const dir = trail.vx > 0 ? 1 : -1;
      const endX = trail.x - dir * trail.len;
      const tailY = trail.y + (Math.sin((tick + trail.life) * 0.08) * 0.8 + d * h * 0.015);
      const progress = trail.life / trail.maxLife;
      const fade = progress < 0.12 ? progress / 0.12 : progress > 0.88 ? (1 - progress) / 0.12 : 1;
      const alpha = trail.alpha * clamp(fade, 0, 1);

      const gradient = ctx.createLinearGradient(trail.x, trail.y, endX, tailY);
      gradient.addColorStop(0, rgba(trail.rgb, 0));
      gradient.addColorStop(0.18, rgba(trail.rgb, alpha * 0.44));
      gradient.addColorStop(0.62, rgba(trail.rgb, alpha));
      gradient.addColorStop(1, rgba(WHITE, alpha * 0.55));

      ctx.save();
      ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = rgba(trail.rgb, alpha);
      ctx.shadowBlur = 16 + d * 14;
      ctx.strokeStyle = gradient;
      ctx.lineWidth = trail.width;
      ctx.beginPath();
      ctx.moveTo(endX, tailY);
      ctx.lineTo(trail.x, trail.y);
      ctx.stroke();

      ctx.shadowBlur = 4;
      ctx.strokeStyle = rgba(WHITE, alpha * 0.62);
      ctx.lineWidth = Math.max(0.7, trail.width * 0.22);
      ctx.beginPath();
      ctx.moveTo(lerp(endX, trail.x, 0.45), lerp(tailY, trail.y, 0.45));
      ctx.lineTo(trail.x, trail.y);
      ctx.stroke();

      const flare = ctx.createRadialGradient(trail.x, trail.y, 0, trail.x, trail.y, 5 + d * 9);
      flare.addColorStop(0, rgba(trail.rgb, alpha * 0.7));
      flare.addColorStop(1, rgba(trail.rgb, 0));
      ctx.fillStyle = flare;
      ctx.fillRect(trail.x - 18, trail.y - 12, 36, 24);
      ctx.restore();
    }

    function drawFrame(): void {
      rafId = requestAnimationFrame(drawFrame);
      tick += 1;

      ctx.clearRect(0, 0, w, h);
      if (scene) ctx.drawImage(scene, 0, 0);

      if (trails.length < MAX_TRAILS && Math.random() < 0.105) spawnTrail();

      ctx.save();
      ctx.clip(mask);
      for (let i = trails.length - 1; i >= 0; i--) {
        const trail = trails[i];
        trail.life += 1;
        trail.x += trail.vx;
        if (
          trail.life > trail.maxLife
          || trail.x < roadLeft(w, 1) - trail.len - w * 0.1
          || trail.x > roadRight(w, 1) + trail.len + w * 0.1
        ) {
          trails.splice(i, 1);
          continue;
        }
        drawTrail(trail);
      }
      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const y = roadY(h, 0.1 + i * 0.2);
        const alpha = 0.008 + Math.sin(tick * 0.012 + i * 1.8) * 0.004;
        const fog = ctx.createLinearGradient(0, y - h * 0.014, 0, y + h * 0.018);
        fog.addColorStop(0, 'rgba(0, 0, 0, 0)');
        fog.addColorStop(0.5, i % 2 === 0 ? rgba(CYAN, alpha) : rgba(MAGENTA, alpha));
        fog.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = fog;
        ctx.fillRect(0, y - h * 0.02, w, h * 0.04);
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.022)';
      for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

      if (tick > glitchUntil && Math.random() < 0.004) {
        glitchUntil = tick + 3 + Math.floor(Math.random() * 6);
        glitchSlices = [];
        const count = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
          glitchSlices.push({
            y: Math.floor(Math.random() * h * 0.72),
            height: 2 + Math.floor(Math.random() * 8),
            offset: (Math.random() - 0.5) * 18,
          });
        }
      }
      if (tick <= glitchUntil) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const slice of glitchSlices) {
          ctx.fillStyle = rgba(CYAN, 0.05 + Math.random() * 0.04);
          ctx.fillRect(slice.offset, slice.y, w, slice.height);
          ctx.fillStyle = rgba(MAGENTA, 0.035);
          ctx.fillRect(-slice.offset * 0.7, slice.y + slice.height + 1, w, 1);
        }
        ctx.restore();
      }
    }

    resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', resize);
    rafId = requestAnimationFrame(drawFrame);

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  );
}
