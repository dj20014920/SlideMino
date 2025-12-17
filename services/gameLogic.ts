import { Grid, Piece, ShapeType, Coordinate, Phase } from '../types';
import { SHAPES } from '../constants';

// --- Utils ---

export const createEmptyGrid = (size: number): Grid => {
  return Array.from({ length: size }, () => Array(size).fill(0));
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
    
    // Check collision (must be empty 0)
    if (grid[y][x] !== 0) return false;
  }
  return true;
};

export const placePieceOnGrid = (grid: Grid, piece: Piece, originX: number, originY: number): Grid => {
  const newGrid = grid.map(row => [...row]);
  for (const cell of piece.cells) {
    const x = originX + cell.x;
    const y = originY + cell.y;
    newGrid[y][x] = piece.value;
  }
  return newGrid;
};

// --- 2048 Logic ---

const mergeLine = (line: number[]): { mergedLine: number[], score: number } => {
  // 1. Remove zeros
  let compact = line.filter(v => v !== 0);
  const out: number[] = [];
  let score = 0;
  let i = 0;

  // 2. Merge adjacent
  while (i < compact.length) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      const newVal = compact[i] * 2;
      out.push(newVal);
      score += newVal;
      i += 2; // Skip next
    } else {
      out.push(compact[i]);
      i++;
    }
  }

  // 3. Pad with zeros
  while (out.length < line.length) {
    out.push(0);
  }

  return { mergedLine: out, score };
};

export const slideGrid = (grid: Grid, direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'): { grid: Grid, score: number, moved: boolean } => {
  const size = grid.length;
  let newGrid = grid.map(row => [...row]);
  let totalScore = 0;
  let somethingChanged = false;

  if (direction === 'LEFT' || direction === 'RIGHT') {
    for (let y = 0; y < size; y++) {
      let line = newGrid[y];
      if (direction === 'RIGHT') line = line.reverse();
      
      const { mergedLine, score } = mergeLine(line);
      totalScore += score;
      
      // Check for changes
      if (JSON.stringify(line) !== JSON.stringify(mergedLine)) somethingChanged = true;

      if (direction === 'RIGHT') newGrid[y] = mergedLine.reverse();
      else newGrid[y] = mergedLine;
    }
  } else {
    // UP or DOWN (Operate on columns)
    for (let x = 0; x < size; x++) {
      let line: number[] = [];
      for (let y = 0; y < size; y++) line.push(newGrid[y][x]);
      
      if (direction === 'DOWN') line = line.reverse();

      const { mergedLine, score } = mergeLine(line);
      totalScore += score;

      if (JSON.stringify(line) !== JSON.stringify(mergedLine)) somethingChanged = true;

      const finalLine = direction === 'DOWN' ? mergedLine.reverse() : mergedLine;
      for (let y = 0; y < size; y++) newGrid[y][x] = finalLine[y];
    }
  }

  return { grid: newGrid, score: totalScore, moved: somethingChanged };
};

// Safety check: Can the board move in ANY direction?
export const hasPossibleMoves = (grid: Grid): boolean => {
  const directions: ('UP' | 'DOWN' | 'LEFT' | 'RIGHT')[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
  for (const dir of directions) {
    const { moved } = slideGrid(grid, dir);
    if (moved) return true;
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
