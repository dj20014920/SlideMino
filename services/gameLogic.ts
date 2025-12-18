import { Grid, Piece, ShapeType, Coordinate, Phase, Tile, MergingTile } from '../types';
import { SHAPES } from '../constants';

// --- Utils ---

export const createEmptyGrid = (size: number): Grid => {
  return Array.from({ length: size }, () => Array(size).fill(null));
};

export const generateRandomPiece = (): Piece => {
  const shapes = Object.values(ShapeType);
  const type = shapes[Math.floor(Math.random() * shapes.length)];
  const rotation = Math.floor(Math.random() * 4);

  return {
    id: Math.random().toString(36).substr(2, 9),
    type,
    rotation,
    cells: getRotatedCells(type, rotation),
    value: 1, // Default value for MVP
  };
};

export const getRotatedCells = (type: ShapeType, rotation: number): Coordinate[] => {
  let cells = [...SHAPES[type]];

  // O piece doesn't rotate
  if (type === ShapeType.O) return cells;

  for (let i = 0; i < rotation; i++) {
    cells = cells.map(({ x, y }) => ({ x: -y, y: x }));
  }
  return cells;
};

// --- Placement Logic ---

export const canPlacePiece = (grid: Grid, piece: Piece, originX: number, originY: number): boolean => {
  const size = grid.length;
  for (const cell of piece.cells) {
    const x = originX + cell.x;
    const y = originY + cell.y;

    // Check bounds
    if (x < 0 || x >= size || y < 0 || y >= size) return false;

    // Check collision (must be empty null)
    if (grid[y][x] !== null) return false;
  }
  return true;
};

export const placePieceOnGrid = (grid: Grid, piece: Piece, originX: number, originY: number): Grid => {
  const newGrid = grid.map(row => [...row]);
  for (const cell of piece.cells) {
    const x = originX + cell.x;
    const y = originY + cell.y;
    // Create new Tile with unique ID
    newGrid[y][x] = {
      id: Math.random().toString(36).substr(2, 9) + `-${x}-${y}`, // Add coords to ensure uniqueness
      value: piece.value
    };
  }
  return newGrid;
};

// --- 2048 Logic ---

interface MergeLineResult {
  mergedLine: (Tile | null)[];
  score: number;
  absorbedTiles: { tile: Tile; originalIndex: number; mergeIndex: number }[];
  mergedTiles: { id: string; fromValue: number; toValue: number }[];
}

/**
 * 표준 2048 알고리즘 기반 라인 병합 함수
 * 
 * 핵심 원리:
 * - 라인은 항상 "LEFT 방향으로 슬라이드"하는 형태로 정규화되어 전달됨
 * - 병합 시 "먼저 도착하는 타일(current)"의 ID를 유지해야 순서가 보존됨
 * - next 타일은 current로 "흡수"되어 사라지므로 애니메이션 대상
 * 
 * 예시: [2(id:A), _, 2(id:B), _] → LEFT 슬라이드
 * - 결과: [4(id:A), _, _, _] (A가 유지, B는 흡수됨)
 */
const mergeLine = (line: (Tile | null)[]): MergeLineResult => {
  // 1. null이 아닌 타일들과 원래 위치를 추출
  const tilesWithPos: { tile: Tile; originalIndex: number }[] = [];
  line.forEach((t, i) => {
    if (t) tilesWithPos.push({ tile: t, originalIndex: i });
  });

  const out: (Tile | null)[] = [];
  const absorbedTiles: { tile: Tile; originalIndex: number; mergeIndex: number }[] = [];
  const mergedTiles: { id: string; fromValue: number; toValue: number }[] = [];
  let score = 0;
  let i = 0;
  let outIndex = 0;

  // 2. 인접한 동일 값 타일 병합 (한 번에 두 개씩만)
  while (i < tilesWithPos.length) {
    const current = tilesWithPos[i];
    const next = tilesWithPos[i + 1];

    if (next && current.tile.value === next.tile.value) {
      // 병합 발생!
      const newVal = current.tile.value * 2;

      // ✅ 핵심 수정: current(먼저 도착하는 타일)의 ID 유지
      // 이렇게 해야 React의 key 기반 렌더링에서 순서가 보존됨
      out.push({ ...current.tile, value: newVal });
      mergedTiles.push({
        id: current.tile.id,
        fromValue: current.tile.value,
        toValue: newVal,
      });

      // next 타일이 current로 흡수됨 → 애니메이션 대상
      absorbedTiles.push({
        tile: next.tile,
        originalIndex: next.originalIndex,
        mergeIndex: outIndex // 흡수되는 위치
      });

      score += newVal;
      i += 2; // 두 타일 모두 처리됨
    } else {
      // 병합 없음, 그대로 이동
      out.push(current.tile);
      i++;
    }
    outIndex++;
  }

  // 3. 나머지를 null로 채움 (라인 끝까지)
  while (out.length < line.length) {
    out.push(null);
  }

  return { mergedLine: out, score, absorbedTiles, mergedTiles };
};

export interface MergedTile {
  id: string;
  fromValue: number;
  toValue: number;
}

export interface SlideResult {
  grid: Grid;
  score: number;
  moved: boolean;
  mergingTiles: MergingTile[];
  mergedTiles: MergedTile[];
}

export const slideGrid = (grid: Grid, direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): SlideResult => {
  const size = grid.length;
  let newGrid = grid.map(row => [...row]);
  let totalScore = 0;
  let somethingChanged = false;
  const mergingTiles: MergingTile[] = [];
  const mergedTiles: MergedTile[] = [];

  const getLineIds = (line: (Tile | null)[]) => line.map(t => t?.id).join(',');

  if (direction === 'LEFT' || direction === 'RIGHT') {
    for (let y = 0; y < size; y++) {
      let line = [...newGrid[y]];
      const originalIds = getLineIds(line);

      if (direction === 'RIGHT') line = line.reverse();

      const { mergedLine, score, absorbedTiles, mergedTiles: lineMergedTiles } = mergeLine(line);
      totalScore += score;
      mergedTiles.push(...lineMergedTiles);

      let finalLine = [...mergedLine];
      if (direction === 'RIGHT') {
        finalLine = finalLine.reverse();
        // Adjust absorbed tile indices for reversed direction
        absorbedTiles.forEach(at => {
          const fromX = size - 1 - at.originalIndex;
          const toX = size - 1 - at.mergeIndex;
          mergingTiles.push({
            id: at.tile.id,
            value: at.tile.value,
            fromX,
            fromY: y,
            toX,
            toY: y
          });
        });
      } else {
        absorbedTiles.forEach(at => {
          mergingTiles.push({
            id: at.tile.id,
            value: at.tile.value,
            fromX: at.originalIndex,
            fromY: y,
            toX: at.mergeIndex,
            toY: y
          });
        });
      }

      if (getLineIds(finalLine) !== originalIds) somethingChanged = true;

      newGrid[y] = finalLine;
    }
  } else {
    // UP or DOWN (Operate on columns)
    for (let x = 0; x < size; x++) {
      let line: (Tile | null)[] = [];
      for (let y = 0; y < size; y++) line.push(newGrid[y][x]);

      const originalIds = getLineIds(line);

      if (direction === 'DOWN') line = line.reverse();

      const { mergedLine, score, absorbedTiles, mergedTiles: lineMergedTiles } = mergeLine(line);
      totalScore += score;
      mergedTiles.push(...lineMergedTiles);

      let finalLine = [...mergedLine];
      if (direction === 'DOWN') {
        finalLine = finalLine.reverse();
        // Adjust absorbed tile indices for reversed direction
        absorbedTiles.forEach(at => {
          const fromY = size - 1 - at.originalIndex;
          const toY = size - 1 - at.mergeIndex;
          mergingTiles.push({
            id: at.tile.id,
            value: at.tile.value,
            fromX: x,
            fromY,
            toX: x,
            toY
          });
        });
      } else {
        absorbedTiles.forEach(at => {
          mergingTiles.push({
            id: at.tile.id,
            value: at.tile.value,
            fromX: x,
            fromY: at.originalIndex,
            toX: x,
            toY: at.mergeIndex
          });
        });
      }

      if (getLineIds(finalLine) !== originalIds) somethingChanged = true;

      for (let y = 0; y < size; y++) newGrid[y][x] = finalLine[y];
    }
  }

  return { grid: newGrid, score: totalScore, moved: somethingChanged, mergingTiles, mergedTiles };
};

// Safety check: Can the board move in ANY direction?
export const hasPossibleMoves = (grid: Grid): boolean => {
  // 2048 규칙 기준:
  // - 빈 칸(null)이 하나라도 있으면 어떤 방향으로든 "이동"은 항상 가능
  // - 빈 칸이 없더라도 인접한 동일 값이 있으면 "병합"으로 이동 가능
  const size = grid.length;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tile = grid[y][x];
      if (!tile) return true;

      const right = x + 1 < size ? grid[y][x + 1] : null;
      if (right && right.value === tile.value) return true;

      const down = y + 1 < size ? grid[y + 1][x] : null;
      if (down && down.value === tile.value) return true;
    }
  }

  return false;
};

// --- Game Over Logic ---

export const checkGameOver = (grid: Grid, slots: (Piece | null)[]): boolean => {
  // Game over if we are in PLACE phase and NO piece in slots can be placed anywhere
  // We check all rotations for all available pieces
  const size = grid.length;

  // If all slots are empty (rare edge case in middle of turn), not game over
  const availablePieces = slots.filter((s): s is Piece => s !== null);
  if (availablePieces.length === 0) return false;

  for (const piece of availablePieces) {
    // Check all 4 rotations
    for (let r = 0; r < 4; r++) {
      const tempCells = getRotatedCells(piece.type, r);
      const tempPiece = { ...piece, cells: tempCells, rotation: r };

      // Try every position on board
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (canPlacePiece(grid, tempPiece, x, y)) {
            return false; // Found a valid move
          }
        }
      }
    }
  }

  return true;
};
