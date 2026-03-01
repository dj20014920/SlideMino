/**
 * 시드 기반 의사난수 생성기 (Seeded PRNG)
 * 데일리 챌린지에서 모든 유저에게 동일한 블록 시퀀스를 제공하기 위해 사용
 */

import { ShapeType, Piece, Coordinate } from '../types';
import { SHAPES } from '../constants';

/**
 * mulberry32: 32비트 시드 기반 결정론적 난수 생성기
 * 같은 시드 → 항상 같은 숫자 시퀀스 생성
 * @returns 0~1 사이 부동소수점 반환 함수 (Math.random() 대체)
 */
export function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 피스의 셀 좌표를 회전 적용하여 반환
 * gameLogic.ts의 getRotatedCells와 동일한 로직
 */
function getRotatedCells(type: ShapeType, rotation: number): Coordinate[] {
  let cells = [...SHAPES[type]];
  if (type === ShapeType.O) return cells;
  for (let i = 0; i < rotation; i++) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
  }
  return cells;
}

/**
 * PRNG로 단일 피스 생성 (서버/클라이언트 공용 시퀀스 생성용)
 */
export function generateSeededPieceData(rng: () => number): { type: ShapeType; rotation: number } {
  const shapes = Object.values(ShapeType);
  const type = shapes[Math.floor(rng() * shapes.length)];
  const rotation = Math.floor(rng() * 4);
  return { type, rotation };
}

/**
 * 피스 데이터로부터 Piece 객체 생성 (클라이언트 전용)
 */
export function createPieceFromData(data: { type: ShapeType; rotation: number }, index: number): Piece {
  return {
    id: `challenge-${index}-${data.type}-${data.rotation}`,
    type: data.type,
    rotation: data.rotation,
    cells: getRotatedCells(data.type, data.rotation),
    value: 1,
  };
}

/**
 * PRNG로 슬롯용 3개 피스 데이터 생성
 */
export function generateSeededSlotData(rng: () => number, count = 3): { type: ShapeType; rotation: number }[] {
  const result: { type: ShapeType; rotation: number }[] = [];
  for (let i = 0; i < count; i++) {
    result.push(generateSeededPieceData(rng));
  }
  return result;
}
