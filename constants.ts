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

// Colors for cell values
export const TILE_COLORS: Record<number, string> = {
  0: 'bg-slate-900 border-2 border-slate-600', // Empty - High contrast borders
  1: 'bg-blue-500 text-white border-2 border-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.5)]',
  2: 'bg-indigo-500 text-white border-2 border-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]',
  4: 'bg-violet-500 text-white border-2 border-violet-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]',
  8: 'bg-purple-600 text-white border-2 border-purple-500 shadow-[0_0_10px_rgba(147,51,234,0.5)]',
  16: 'bg-fuchsia-600 text-white border-2 border-fuchsia-500 shadow-[0_0_10px_rgba(192,38,211,0.5)]',
  32: 'bg-pink-600 text-white border-2 border-pink-500 shadow-[0_0_10px_rgba(219,39,119,0.5)]',
  64: 'bg-rose-600 text-white border-2 border-rose-500 shadow-[0_0_10px_rgba(225,29,72,0.5)]',
  128: 'bg-red-600 text-white border-2 border-red-400',
  256: 'bg-orange-600 text-white border-2 border-orange-400',
  512: 'bg-amber-500 text-black border-2 border-white',
  1024: 'bg-yellow-500 text-black border-2 border-white',
  2048: 'bg-yellow-300 text-black border-4 border-white shadow-[0_0_20px_rgba(253,224,71,0.8)]',
};

// Fallback for higher numbers
export const getTileColor = (val: number): string => {
  if (val === 0) return TILE_COLORS[0];
  if (val in TILE_COLORS) return TILE_COLORS[val];
  return 'bg-black text-white border-2 border-yellow-500';
};