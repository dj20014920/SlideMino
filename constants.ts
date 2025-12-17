import { ShapeType, Coordinate } from './types';

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