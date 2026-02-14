import { ShapeType, Coordinate } from './types';

// Board slide animation (one swipe)
export const SLIDE_ANIMATION_MS = 250;
export const SLIDE_UNLOCK_BUFFER_MS = 12;

export const getSlideAnimationDurationMs = (distance: number): number => {
  if (!Number.isFinite(distance) || distance <= 0) return 0;
  // 모든 블록 이동 애니메이션 속도를 통일
  return SLIDE_ANIMATION_MS;
};

// Board rendering/layout constants
export const BOARD_CELL_GAP_PX = 3;

// --- Tile typography helpers ---

const TILE_FONT_FAMILY =
  "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";
const TILE_FONT_WEIGHT = 600; // Tailwind `font-semibold`

let tileMeasureCtx: CanvasRenderingContext2D | null = null;
const tileTextWidthCache = new Map<string, number>();
const tileFontSizeCache = new Map<string, number>();
const tileNumberLayoutCache = new Map<string, { text: string; fontPx: number }>();

const getTileMeasureCtx = (): CanvasRenderingContext2D | null => {
  if (tileMeasureCtx) return tileMeasureCtx;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  tileMeasureCtx = canvas.getContext('2d');
  return tileMeasureCtx;
};

const measureTileTextWidth = (text: string, fontPx: number): number => {
  const key = `${fontPx}|${text}`;
  const cached = tileTextWidthCache.get(key);
  if (cached !== undefined) return cached;

  const ctx = getTileMeasureCtx();
  if (!ctx) {
    const approx = text.length * fontPx * 0.6;
    tileTextWidthCache.set(key, approx);
    return approx;
  }

  ctx.font = `${TILE_FONT_WEIGHT} ${fontPx}px ${TILE_FONT_FAMILY}`;
  const width = ctx.measureText(text).width;
  tileTextWidthCache.set(key, width);
  return width;
};

export const getTileBaseFontPx = (tilePx: number): number => {
  return Math.max(12, Math.min(tilePx * 0.45, 40));
};

const fitFontForLines = (lines: string[], tilePx: number, baseFontPx: number): number => {
  const maxWidth = tilePx * 0.78;
  const maxHeight = tilePx * 0.86;
  const lineHeight = 1;

  const baseWidth = Math.max(...lines.map((line) => measureTileTextWidth(line, baseFontPx)));
  const baseHeight = baseFontPx * lines.length * lineHeight;

  if (baseWidth <= maxWidth && baseHeight <= maxHeight) return baseFontPx;

  const widthScale = baseWidth > 0 ? maxWidth / baseWidth : 1;
  const heightScale = baseHeight > 0 ? maxHeight / baseHeight : 1;
  const scale = Math.min(widthScale, heightScale, 1);

  let fontPx = Math.floor(baseFontPx * scale);

  // 10×10처럼 작은 셀에서도 1024/524288(6 digits)이 반드시 들어가도록 최소 폰트를 낮게 허용.
  // (너무 큰 수는 가독성보다 'fit'을 우선)
  const minFontPx = Math.max(4, Math.floor(tilePx * 0.16));
  if (fontPx < minFontPx) fontPx = minFontPx;

  for (let tries = 0; tries < 24 && fontPx > minFontPx; tries++) {
    const w = Math.max(...lines.map((line) => measureTileTextWidth(line, fontPx)));
    const h = fontPx * lines.length * lineHeight;
    if (w <= maxWidth && h <= maxHeight) break;
    fontPx -= 1;
  }

  return fontPx;
};

const splitNumberForSmallTile = (text: string): string[] => {
  const len = text.length;
  if (len <= 3) return [text];
  if (len === 4) return [text.slice(0, 2), text.slice(2)];
  const split = Math.max(1, len - 3);
  return [text.slice(0, split), text.slice(split)];
};

const splitNumberForTwoLines = (text: string): string[] => {
  const len = text.length;
  if (len <= 3) return [text];
  const split = Math.ceil(len / 2);
  return [text.slice(0, split), text.slice(split)];
};

export const getTileNumberLayout = (value: number, tilePx: number): { text: string; fontPx: number } => {
  if (!Number.isFinite(value) || value <= 0) return { text: '', fontPx: getTileBaseFontPx(tilePx) };

  const key = `${tilePx.toFixed(2)}|${value}`;
  const cached = tileNumberLayoutCache.get(key);
  if (cached) return cached;

  const baseFontPx = getTileBaseFontPx(tilePx);
  const text = String(value);

  // 기본: 한 줄
  const singleLines = [text];
  const singleFontPx = fitFontForLines(singleLines, tilePx, baseFontPx);

  // 6글자(예: 524288) 이상은 배열/타일 크기와 무관하게 2줄로 고정 표시
  if (text.length >= 6) {
    const forcedLines = splitNumberForTwoLines(text);
    const forcedFontPx = fitFontForLines(forcedLines, tilePx, baseFontPx);
    const result = { text: forcedLines.join('\n'), fontPx: forcedFontPx };
    tileNumberLayoutCache.set(key, result);
    return result;
  }

  // 작은 타일에서만(예: 10×10) 줄바꿈 후보를 추가로 고려
  let bestText = text;
  let bestFontPx = singleFontPx;

  if (tilePx <= 42 && text.length >= 4) {
    const wrappedLines = splitNumberForSmallTile(text);
    const wrappedText = wrappedLines.join('\n');
    const wrappedFontPx = fitFontForLines(wrappedLines, tilePx, baseFontPx);

    // 의미 있게 커질 때만 줄바꿈을 선택 (레이아웃 일관성 유지)
    if (wrappedFontPx >= singleFontPx + 1) {
      bestText = wrappedText;
      bestFontPx = wrappedFontPx;
    }
  }

  const result = { text: bestText, fontPx: bestFontPx };
  tileNumberLayoutCache.set(key, result);
  return result;
};

export const getFittedTileNumberFontPx = (value: number, tilePx: number): number => {
  const base = getTileBaseFontPx(tilePx);
  if (!Number.isFinite(value) || value <= 0) return base;

  // 캐시 키는 너무 세분화되지 않게 소수점 2자리로 정규화
  const key = `${tilePx.toFixed(2)}|${value}`;
  const cached = tileFontSizeCache.get(key);
  if (cached !== undefined) return cached;

  const fitted = getTileNumberLayout(value, tilePx);
  tileFontSizeCache.set(key, fitted.fontPx);
  return fitted.fontPx;
};

// Base coordinates for shapes at rotation 0
export const SHAPES: Record<ShapeType, Coordinate[]> = {
  [ShapeType.I]: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }],
  [ShapeType.O]: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [ShapeType.T]: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }],
  [ShapeType.S]: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }, { x: 0, y: 1 }],
  [ShapeType.Z]: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [ShapeType.J]: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
  [ShapeType.L]: [{ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 1 }],
};

/**
 * 최적화된 타일 색상 시스템
 * - backdrop-blur 완전 제거 (성능 병목 해결)
 * - 단순화된 shadow (GPU 부담 감소)
 * - 시각적 효과 유지하면서 60fps 달성
 */
// 주의: 이 값들은 Tailwind 클래스 문자열이므로 tailwind.config.cjs의 content에 constants.ts가 포함되어야 합니다.
// 네이티브(안드/아이폰)에서는 CDN tailwind가 로드되지 않으니 항상 로컬 빌드 CSS를 사용하세요.
export const TILE_COLORS: Record<number, string> = {
  // 빈 셀: 약간 어둡고 안으로 들어간 느낌 (구분감 강화)
  0: 'bg-gray-200/40 border border-gray-300/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]',

  // Level 1~2: 밝은 톤 + 명확한 그림자 (떠오른 느낌)
  1: 'bg-white text-gray-800 border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.08)]',
  2: 'bg-gray-50 text-gray-800 border border-gray-200 shadow-[0_2px_6px_rgba(0,0,0,0.08)]',

  // Level 4~8: 중간 톤 (그림자 조금 더 진하게)
  4: 'bg-gradient-to-br from-gray-100 to-gray-200 text-gray-900 border border-white/60 shadow-[0_3px_8px_rgba(0,0,0,0.1)]',
  8: 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-900 border border-white/50 shadow-[0_3px_8px_rgba(0,0,0,0.1)]',

  // Level 16~32: 어두운 톤 + 입체감
  16: 'bg-gradient-to-br from-gray-400 to-gray-500 text-white border border-white/30 shadow-[0_4px_10px_rgba(0,0,0,0.15)]',
  32: 'bg-gradient-to-br from-gray-500 to-gray-600 text-white border border-white/25 shadow-[0_4px_10px_rgba(0,0,0,0.15)]',

  // Level 64~128: 진한 톤
  64: 'bg-gradient-to-br from-gray-600 to-gray-700 text-white border border-white/20 shadow-[0_6px_14px_rgba(0,0,0,0.2)]',
  128: 'bg-gradient-to-br from-gray-700 to-gray-800 text-white border border-white/20 shadow-[0_6px_14px_rgba(0,0,0,0.2)]',

  // Level 256~512: 블랙 계열
  256: 'bg-gradient-to-br from-gray-800 to-gray-900 text-white border border-white/10 shadow-[0_8px_20px_rgba(0,0,0,0.3)]',
  512: 'bg-gradient-to-br from-gray-900 to-black text-white border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.35)]',

  // Level 1024~2048: 골드 액센트
  1024: 'bg-gradient-to-br from-black to-gray-900 text-amber-400 border border-amber-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.4)]',
  2048: 'bg-gradient-to-br from-black via-gray-900 to-black text-amber-300 border-2 border-amber-400/50 shadow-[0_10px_30px_rgba(0,0,0,0.4)]',
};

// Fallback for higher numbers
export const getTileColor = (val: number): string => {
  if (val === 0) return TILE_COLORS[0];
  if (val in TILE_COLORS) return TILE_COLORS[val];
  return 'bg-black text-amber-200 border-2 border-amber-300/40 shadow-xl';
};


// ==========================================
// 📌 리워드 광고 관련 상수
// ==========================================

/**
 * 리워드 광고 시청 시 지급할 되돌리기 횟수
 * - 앱인토스 콘솔의 "보상 수량"과 일치해야 함
 */
export const REWARD_UNDO_AMOUNT = 1;

/**
 * 게임 시작 시 기본으로 제공되는 되돌리기 횟수
 */
export const INITIAL_UNDO_AMOUNT = 1;

/**
 * 게임 시작 시 기본으로 제공되는 블록 새로고침 횟수
 */
export const INITIAL_BLOCK_REFRESH_AMOUNT = 1;

/**
 * 보상형 전면 광고 시청 시 지급할 블록 새로고침 횟수
 */
export const REWARD_BLOCK_REFRESH_AMOUNT = 1;

/**
 * 하루 최대 광고 시청 횟수 (남용 방지)
 */
export const MAX_DAILY_AD_VIEWS = 5;

/**
 * 하루 최대 부활 광고 시청 횟수 (게임오버 보상형 전면)
 */
export const MAX_DAILY_REVIVE_AD_VIEWS = 2;

/**
 * 하루 최대 블록 새로고침 보상형 전면 광고 시청 횟수
 */
export const MAX_DAILY_BLOCK_REFRESH_AD_VIEWS = 5;
