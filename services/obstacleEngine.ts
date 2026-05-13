import {
  BoardSize,
  CellObstacle,
  Direction,
  FrozenTileState,
  Grid,
  MergingTile,
  ObstacleFeature,
  ObstacleState,
  Piece,
  PortalEndpoint,
  PortalSide,
  Tile,
} from '../types';
import { canPlacePiece, getRotatedCells, type MergedTile } from './gameLogic';

export const OBSTACLE_RULES_VERSION = 'obstacles_v1' as const;

const MAX_TILE_VALUE = 131072;
const MAX_SCORE = 1_000_000;
const CONCRETE_START_HP = 3;
const FROZEN_SWIPES = 3;
const MAX_ACTIVE_OBSTACLES = 2;
const PITY_STEP_PERCENT = 3;
const PITY_MAX_CHANCE = 60;
const PITY_MAX_MULTIPLIER = 3;
const PORTAL_FEATURE: ObstacleFeature = 'portal';

const DIRECTION_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

const FEATURE_ORDER: ObstacleFeature[] = ['concrete', 'percent', 'ice', 'portal', 'container'];

const SPAWN_CHANCE_BY_STAGE: Record<number, Record<BoardSize, number>> = {
  0: { 4: 0, 5: 0, 7: 0, 8: 0, 10: 0 },
  1: { 4: 3, 5: 4, 7: 4, 8: 4, 10: 5 },
  2: { 4: 5, 5: 6, 7: 6, 8: 7, 10: 8 },
  3: { 4: 7, 5: 8, 7: 9, 8: 10, 10: 12 },
  4: { 4: 10, 5: 10, 7: 12, 8: 13, 10: 16 },
  5: { 4: 12, 5: 13, 7: 15, 8: 16, 10: 20 },
  6: { 4: 13, 5: 15, 7: 17, 8: 19, 10: 23 },
  7: { 4: 14, 5: 17, 7: 19, 8: 22, 10: 25 },
  8: { 4: 15, 5: 18, 7: 21, 8: 24, 10: 28 },
};

const WEIGHTS_BY_STAGE: Record<number, Partial<Record<ObstacleFeature, number>>> = {
  0: {},
  1: { concrete: 100 },
  2: { concrete: 65, percent: 35 },
  3: { concrete: 45, percent: 40, ice: 15 },
  4: { concrete: 35, percent: 35, ice: 20, portal: 10 },
  5: { concrete: 25, percent: 30, ice: 20, portal: 15, container: 10 },
  6: { concrete: 20, percent: 25, ice: 20, portal: 20, container: 15 },
  7: { concrete: 20, percent: 25, ice: 20, portal: 20, container: 15 },
  8: { concrete: 20, percent: 25, ice: 20, portal: 20, container: 15 },
};

const STAGE_THRESHOLDS = [
  { stage: 1, tile: 128, score: 700 },
  { stage: 2, tile: 256, score: 1600 },
  { stage: 3, tile: 512, score: 3600 },
  { stage: 4, tile: 1024, score: 8000 },
  { stage: 5, tile: 2048, score: 18_000 },
  { stage: 6, tile: 4096, score: 40_000 },
  { stage: 7, tile: 8192, score: 90_000 },
  { stage: 8, tile: 16_384, score: 200_000 },
] as const;

type Rng = () => number;

export interface ObstacleSlideResult {
  grid: Grid;
  obstacleState: ObstacleState;
  score: number;
  moved: boolean;
  mergingTiles: MergingTile[];
  mergedTiles: MergedTile[];
  maxDistance: number;
}

export interface ApplyObstacleSpawnParams {
  grid: Grid;
  slots: (Piece | null)[];
  obstacleState: ObstacleState;
  boardSize: BoardSize;
  feature: ObstacleFeature;
  rng?: Rng;
  mergedTileIds?: string[];
  score?: number;
  maxTile?: number;
  disableRotation?: boolean;
}

export interface ApplyObstacleSpawnResult {
  obstacleState: ObstacleState;
  spawnedFeature: ObstacleFeature | null;
  chance: number;
}

export interface ObstacleSpawnRollParams {
  grid: Grid;
  slots: (Piece | null)[];
  obstacleState: ObstacleState;
  boardSize: BoardSize;
  score: number;
  maxTile: number;
  mergedTileIds?: string[];
  rng?: Rng;
  disableRotation?: boolean;
}

export interface ObstacleSpawnChanceBreakdown {
  stage: number;
  activeObstacleCount: number;
  totalChance: number;
  featureChance: number;
}

const cloneTile = (tile: Tile): Tile => ({ ...tile });

const cloneGrid = (grid: Grid): Grid => grid.map((row) => row.map((tile) => (tile ? cloneTile(tile) : null)));

export const createEmptyObstacleState = (): ObstacleState => ({
  rulesVersion: OBSTACLE_RULES_VERSION,
  cellObstacles: [],
  frozenTiles: [],
  portal: null,
  spawnMissStreak: 0,
});

export const cloneObstacleState = (state: ObstacleState | null | undefined): ObstacleState => {
  if (!state) return createEmptyObstacleState();
  return {
    rulesVersion: OBSTACLE_RULES_VERSION,
    cellObstacles: state.cellObstacles.map((obstacle) => ({ ...obstacle })),
    frozenTiles: state.frozenTiles.map((frozen) => ({ ...frozen })),
    portal: state.portal
      ? {
          in: { ...state.portal.in },
          out: { ...state.portal.out },
          queue: state.portal.queue.map(cloneTile),
        }
      : null,
    spawnMissStreak: Math.max(0, Math.floor(state.spawnMissStreak ?? 0)),
  };
};

const cellKey = (x: number, y: number) => `${x},${y}`;

const isInside = (size: number, x: number, y: number): boolean =>
  x >= 0 && x < size && y >= 0 && y < size;

export const getMaxTileValue = (grid: Grid): number => {
  let max = 0;
  for (const row of grid) {
    for (const tile of row) {
      if (tile) max = Math.max(max, tile.value);
    }
  }
  return max;
};

export const getObstacleStage = ({ score, maxTile }: { score: number; maxTile: number }): number => {
  let stage = 0;
  for (const threshold of STAGE_THRESHOLDS) {
    if (score >= threshold.score || maxTile >= threshold.tile) {
      stage = threshold.stage;
    }
  }
  return stage;
};

export const getObstacleSpawnChance = (boardSize: BoardSize, stage: number): number => {
  const normalizedStage = Math.max(0, Math.min(8, Math.floor(stage)));
  return SPAWN_CHANCE_BY_STAGE[normalizedStage]?.[boardSize] ?? 0;
};

export const getObstacleSpawnChanceWithPity = (
  boardSize: BoardSize,
  stage: number,
  missStreak: number
): number => {
  const baseChance = getObstacleSpawnChance(boardSize, stage);
  if (baseChance <= 0) return 0;
  const cap = Math.min(PITY_MAX_CHANCE, baseChance * PITY_MAX_MULTIPLIER);
  return Math.min(cap, baseChance + Math.max(0, Math.floor(missStreak)) * PITY_STEP_PERCENT);
};

export const getObstacleWeights = (stage: number): Partial<Record<ObstacleFeature, number>> => {
  const normalizedStage = Math.max(0, Math.min(8, Math.floor(stage)));
  return { ...(WEIGHTS_BY_STAGE[normalizedStage] ?? {}) };
};

export const getActiveObstacleCount = (state: ObstacleState | null | undefined): number => {
  const cloned = cloneObstacleState(state);
  return cloned.cellObstacles.length + cloned.frozenTiles.length + (cloned.portal ? 1 : 0);
};

export const getUnlockedObstacleFeatures = (stage: number): ObstacleFeature[] => {
  if (stage <= 0) return [];
  return FEATURE_ORDER.filter((feature) => {
    if (feature === 'concrete') return stage >= 1;
    if (feature === 'percent') return stage >= 2;
    if (feature === 'ice') return stage >= 3;
    if (feature === 'portal') return stage >= 4;
    if (feature === 'container') return stage >= 5;
    return false;
  });
};

export const getFrozenTileLimit = ({ score, maxTile }: { score: number; maxTile: number }): number => {
  if (score >= 200_000 || maxTile >= 16_384) return 3;
  if (score >= 40_000 || maxTile >= 4096) return 2;
  return 1;
};

const buildCellObstacleMap = (state: ObstacleState): Map<string, CellObstacle> => {
  const map = new Map<string, CellObstacle>();
  for (const obstacle of state.cellObstacles) {
    map.set(cellKey(obstacle.x, obstacle.y), obstacle);
  }
  return map;
};

export const buildPlacementGridWithObstacles = (grid: Grid, state: ObstacleState): Grid => {
  const next = cloneGrid(grid);
  for (const obstacle of state.cellObstacles) {
    if (!isInside(next.length, obstacle.x, obstacle.y)) continue;
    next[obstacle.y][obstacle.x] = {
      id: `obstacle-occupancy-${obstacle.id}`,
      value: -1,
    };
  }
  return next;
};

export const canPlacePieceWithObstacles = (
  grid: Grid,
  state: ObstacleState,
  piece: Piece,
  originX: number,
  originY: number
): boolean => canPlacePiece(buildPlacementGridWithObstacles(grid, state), piece, originX, originY);

const hasPlaceableSlotWithObstacles = (
  grid: Grid,
  state: ObstacleState,
  slots: (Piece | null)[],
  disableRotation = false
): boolean => {
  const pieces = slots.filter((piece): piece is Piece => piece !== null);
  if (pieces.length === 0) return true;

  const maxRotations = disableRotation ? 1 : 4;
  for (const piece of pieces) {
    for (let rotation = 0; rotation < maxRotations; rotation += 1) {
      const rotatedPiece = {
        ...piece,
        rotation,
        cells: getRotatedCells(piece.type, rotation),
      };
      for (let y = 0; y < grid.length; y += 1) {
        for (let x = 0; x < grid.length; x += 1) {
          if (canPlacePieceWithObstacles(grid, state, rotatedPiece, x, y)) return true;
        }
      }
    }
  }
  return false;
};

const getScanCoordinates = (size: number, direction: Direction): Array<{ x: number; y: number }> => {
  const coords: Array<{ x: number; y: number }> = [];
  if (direction === 'LEFT') {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) coords.push({ x, y });
    }
  } else if (direction === 'RIGHT') {
    for (let y = 0; y < size; y += 1) {
      for (let x = size - 1; x >= 0; x -= 1) coords.push({ x, y });
    }
  } else if (direction === 'UP') {
    for (let x = 0; x < size; x += 1) {
      for (let y = 0; y < size; y += 1) coords.push({ x, y });
    }
  } else {
    for (let x = 0; x < size; x += 1) {
      for (let y = size - 1; y >= 0; y -= 1) coords.push({ x, y });
    }
  }
  return coords;
};

const getTilePositions = (grid: Grid): Map<string, { x: number; y: number }> => {
  const positions = new Map<string, { x: number; y: number }>();
  grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile) positions.set(tile.id, { x, y });
    });
  });
  return positions;
};

const portalSideForDirection = (direction: Direction): PortalSide => {
  if (direction === 'LEFT') return 'LEFT';
  if (direction === 'RIGHT') return 'RIGHT';
  if (direction === 'UP') return 'TOP';
  return 'BOTTOM';
};

const isMatchingPortalExit = (
  portal: ObstacleState['portal'],
  direction: Direction,
  x: number,
  y: number
): boolean => {
  if (!portal) return false;
  const side = portalSideForDirection(direction);
  if (portal.in.side !== side) return false;
  if (side === 'LEFT' || side === 'RIGHT') return portal.in.index === y;
  return portal.in.index === x;
};

const getPortalReleaseCells = (
  grid: Grid,
  state: ObstacleState,
  endpoint: PortalEndpoint
): Array<{ x: number; y: number }> => {
  const size = grid.length;
  const obstacleMap = buildCellObstacleMap(state);
  const cells: Array<{ x: number; y: number }> = [];
  const candidates: Array<{ x: number; y: number }> = [];

  if (endpoint.side === 'LEFT') {
    for (let x = 0; x < size; x += 1) candidates.push({ x, y: endpoint.index });
  } else if (endpoint.side === 'RIGHT') {
    for (let x = size - 1; x >= 0; x -= 1) candidates.push({ x, y: endpoint.index });
  } else if (endpoint.side === 'TOP') {
    for (let y = 0; y < size; y += 1) candidates.push({ x: endpoint.index, y });
  } else {
    for (let y = size - 1; y >= 0; y -= 1) candidates.push({ x: endpoint.index, y });
  }

  for (const candidate of candidates) {
    if (!isInside(size, candidate.x, candidate.y)) break;
    if (grid[candidate.y][candidate.x]) break;
    if (obstacleMap.has(cellKey(candidate.x, candidate.y))) break;
    cells.push(candidate);
  }
  return cells;
};

const decrementFrozenTiles = (grid: Grid, frozenTiles: FrozenTileState[]): FrozenTileState[] => {
  const existingIds = new Set(grid.flat().filter((tile): tile is Tile => tile !== null).map((tile) => tile.id));
  return frozenTiles
    .filter((frozen) => existingIds.has(frozen.tileId))
    .map((frozen) => ({ ...frozen, remainingSwipes: frozen.remainingSwipes - 1 }))
    .filter((frozen) => frozen.remainingSwipes > 0);
};

const collectContainerImpacts = (
  grid: Grid,
  state: ObstacleState,
  container: Extract<CellObstacle, { kind: 'container' }>,
  direction: Direction,
  frozenIds: ReadonlySet<string>
): Tile[] => {
  const obstacleMap = buildCellObstacleMap(state);
  const impacted: Tile[] = [];
  const size = grid.length;

  const scan: Array<{ x: number; y: number }> = [];
  if (direction === 'RIGHT') {
    for (let x = container.x - 1; x >= 0; x -= 1) scan.push({ x, y: container.y });
  } else if (direction === 'LEFT') {
    for (let x = container.x + 1; x < size; x += 1) scan.push({ x, y: container.y });
  } else if (direction === 'DOWN') {
    for (let y = container.y - 1; y >= 0; y -= 1) scan.push({ x: container.x, y });
  } else {
    for (let y = container.y + 1; y < size; y += 1) scan.push({ x: container.x, y });
  }

  for (const pos of scan) {
    const key = cellKey(pos.x, pos.y);
    const obstacle = obstacleMap.get(key);
    if (obstacle && obstacle.id !== container.id) break;
    const tile = grid[pos.y][pos.x];
    if (!tile) continue;
    if (frozenIds.has(tile.id)) break;
    impacted.push(tile);
  }

  return impacted;
};

const getRedirectTargets = (
  size: number,
  container: Extract<CellObstacle, { kind: 'container' }>,
  count: number
): Array<{ x: number; y: number }> => {
  const delta = DIRECTION_DELTAS[container.direction];
  return Array.from({ length: count }, (_, index) => ({
    x: container.x + delta.dx * (index + 1),
    y: container.y + delta.dy * (index + 1),
  })).filter((pos) => isInside(size, pos.x, pos.y));
};

const applyContainersBeforeSlide = (
  grid: Grid,
  state: ObstacleState,
  direction: Direction,
  frozenIds: ReadonlySet<string>,
  originalPositions: ReadonlyMap<string, { x: number; y: number }>
): {
  grid: Grid;
  state: ObstacleState;
  moved: boolean;
  lockedTileIds: Set<string>;
  score: number;
  mergingTiles: MergingTile[];
  mergedTiles: MergedTile[];
  maxDistance: number;
} => {
  let nextGrid = grid;
  let nextState = state;
  let moved = false;
  let score = 0;
  let maxDistance = 0;
  const lockedTileIds = new Set<string>();
  const mergingTiles: MergingTile[] = [];
  const mergedTiles: MergedTile[] = [];

  for (const obstacle of state.cellObstacles) {
    if (obstacle.kind !== 'container') continue;
    const impacted = collectContainerImpacts(nextGrid, nextState, obstacle, direction, frozenIds);
    if (impacted.length === 0) continue;

    const targets = getRedirectTargets(nextGrid.length, obstacle, impacted.length);
    if (targets.length !== impacted.length) continue;

    const obstacleMap = buildCellObstacleMap(nextState);
    const impactedIds = new Set(impacted.map((tile) => tile.id));
    const gridWithoutImpacted = nextGrid.map((row) => row.map((tile) => (tile && impactedIds.has(tile.id) ? null : tile)));
    const plannedMergeTargets = new Set<string>();
    const canRedirect = targets.every((target, index) => {
      if (obstacleMap.has(cellKey(target.x, target.y))) return false;
      const targetTile = gridWithoutImpacted[target.y][target.x];
      if (!targetTile) return true;
      if (frozenIds.has(targetTile.id)) return false;
      if (plannedMergeTargets.has(targetTile.id)) return false;
      const impactedTile = impacted[index];
      if (!impactedTile || impactedTile.value !== targetTile.value) return false;
      plannedMergeTargets.add(targetTile.id);
      return true;
    });
    if (!canRedirect) continue;

    nextGrid = gridWithoutImpacted;
    impacted.forEach((tile, index) => {
      const target = targets[index];
      const targetTile = nextGrid[target.y][target.x];
      const original = originalPositions.get(tile.id) ?? { x: obstacle.x, y: obstacle.y };
      if (targetTile && targetTile.value === tile.value && !frozenIds.has(targetTile.id)) {
        const newValue = Math.min(targetTile.value * 2, MAX_TILE_VALUE);
        nextGrid[target.y][target.x] = { ...targetTile, value: newValue };
        score = Math.min(score + newValue, MAX_SCORE);
        mergingTiles.push({
          id: tile.id,
          value: tile.value,
          fromX: original.x,
          fromY: original.y,
          toX: target.x,
          toY: target.y,
        });
        mergedTiles.push({
          id: targetTile.id,
          fromValue: targetTile.value,
          toValue: newValue,
        });
        lockedTileIds.add(targetTile.id);
        maxDistance = Math.max(maxDistance, Math.abs(target.x - original.x) + Math.abs(target.y - original.y));
      } else {
        nextGrid[target.y][target.x] = tile;
        lockedTileIds.add(tile.id);
        maxDistance = Math.max(maxDistance, Math.abs(target.x - original.x) + Math.abs(target.y - original.y));
      }
    });
    nextState = {
      ...nextState,
      cellObstacles: nextState.cellObstacles.filter((candidate) => candidate.id !== obstacle.id),
    };
    moved = true;
  }

  return { grid: nextGrid, state: nextState, moved, lockedTileIds, score, mergingTiles, mergedTiles, maxDistance };
};

export const slideGridWithObstacles = (
  grid: Grid,
  obstacleState: ObstacleState | null | undefined,
  direction: Direction
): ObstacleSlideResult => {
  const size = grid.length;
  let newGrid = cloneGrid(grid);
  let state = cloneObstacleState(obstacleState);
  let totalScore = 0;
  let moved = false;
  let maxDistance = 0;
  const mergingTiles: MergingTile[] = [];
  const mergedTiles: MergedTile[] = [];
  const mergedTargetIds = new Set<string>();
  const noMergeTileIds = new Set<string>();
  const concreteCollisions = new Set<string>();
  const frozenIdsAtStart = new Set(state.frozenTiles.map((frozen) => frozen.tileId));
  const originalPositions = getTilePositions(newGrid);
  const portalQueueLengthAtStart = state.portal?.queue.length ?? 0;

  const containerResult = applyContainersBeforeSlide(newGrid, state, direction, frozenIdsAtStart, originalPositions);
  newGrid = containerResult.grid;
  state = containerResult.state;
  moved = containerResult.moved;
  totalScore = Math.min(totalScore + containerResult.score, MAX_SCORE);
  maxDistance = Math.max(maxDistance, containerResult.maxDistance);
  mergingTiles.push(...containerResult.mergingTiles);
  mergedTiles.push(...containerResult.mergedTiles);
  for (const tileId of containerResult.lockedTileIds) noMergeTileIds.add(tileId);

  const delta = DIRECTION_DELTAS[direction];
  const obstacleMap = buildCellObstacleMap(state);
  const coords = getScanCoordinates(size, direction);

  const placeTile = (tile: Tile, x: number, y: number, originalX: number, originalY: number): void => {
    newGrid[y][x] = tile;
    const distance = Math.abs(x - originalX) + Math.abs(y - originalY);
    if (distance > 0) moved = true;
    maxDistance = Math.max(maxDistance, distance);
  };

  for (const { x, y } of coords) {
    const tile = newGrid[y][x];
    if (!tile) continue;
    if (frozenIdsAtStart.has(tile.id) || noMergeTileIds.has(tile.id)) continue;

    const original = originalPositions.get(tile.id) ?? { x, y };
    let currentX = x;
    let currentY = y;
    let currentTile = tile;
    let consumed = false;
    newGrid[y][x] = null;

    while (true) {
      const nextX = currentX + delta.dx;
      const nextY = currentY + delta.dy;

      if (!isInside(size, nextX, nextY)) {
        if (isMatchingPortalExit(state.portal, direction, currentX, currentY)) {
          state = {
            ...state,
            portal: state.portal
              ? {
                  ...state.portal,
                  queue: [...state.portal.queue, cloneTile(currentTile)],
                }
              : null,
          };
          moved = true;
          maxDistance = Math.max(maxDistance, Math.abs(currentX - original.x) + Math.abs(currentY - original.y) + 1);
          consumed = true;
        } else {
          placeTile(currentTile, currentX, currentY, original.x, original.y);
        }
        break;
      }

      const obstacle = obstacleMap.get(cellKey(nextX, nextY));
      if (obstacle) {
        if (obstacle.kind === 'percent') {
          const nextValue = currentTile.value <= 1 ? 1 : Math.max(1, Math.floor(currentTile.value / 2));
          currentTile = { ...currentTile, value: nextValue };
          newGrid[nextY][nextX] = currentTile;
          obstacleMap.delete(cellKey(nextX, nextY));
          state = {
            ...state,
            cellObstacles: state.cellObstacles.filter((candidate) => candidate.id !== obstacle.id),
          };
          noMergeTileIds.add(currentTile.id);
          moved = true;
          maxDistance = Math.max(maxDistance, Math.abs(nextX - original.x) + Math.abs(nextY - original.y));
          consumed = true;
          break;
        }
        if (obstacle.kind === 'concrete') {
          concreteCollisions.add(obstacle.id);
        }
        placeTile(currentTile, currentX, currentY, original.x, original.y);
        break;
      }

      const nextTile = newGrid[nextY][nextX];
      if (nextTile) {
        const targetFrozen = frozenIdsAtStart.has(nextTile.id);
        const canMerge =
          !targetFrozen &&
          !mergedTargetIds.has(nextTile.id) &&
          !noMergeTileIds.has(nextTile.id) &&
          nextTile.value === currentTile.value;

        if (canMerge) {
          const newValue = Math.min(nextTile.value * 2, MAX_TILE_VALUE);
          newGrid[nextY][nextX] = { ...nextTile, value: newValue };
          mergedTargetIds.add(nextTile.id);
          mergingTiles.push({
            id: currentTile.id,
            value: currentTile.value,
            fromX: original.x,
            fromY: original.y,
            toX: nextX,
            toY: nextY,
          });
          mergedTiles.push({
            id: nextTile.id,
            fromValue: nextTile.value,
            toValue: newValue,
          });
          totalScore = Math.min(totalScore + newValue, MAX_SCORE);
          moved = true;
          maxDistance = Math.max(maxDistance, Math.abs(nextX - original.x) + Math.abs(nextY - original.y));
          consumed = true;
          break;
        }

        placeTile(currentTile, currentX, currentY, original.x, original.y);
        break;
      }

      currentX = nextX;
      currentY = nextY;
    }

    if (!consumed && !newGrid[currentY][currentX]) {
      placeTile(currentTile, currentX, currentY, original.x, original.y);
    }
  }

  if (concreteCollisions.size > 0) {
    state = {
      ...state,
      cellObstacles: state.cellObstacles.flatMap((obstacle) => {
        if (obstacle.kind !== 'concrete' || !concreteCollisions.has(obstacle.id)) return [obstacle];
        const nextHp = obstacle.hp - 1;
        moved = true;
        return nextHp > 0 ? [{ ...obstacle, hp: nextHp }] : [];
      }),
    };
  }

  if (state.portal && portalQueueLengthAtStart > 0) {
    const queuedBeforeSwipe = state.portal.queue.slice(0, portalQueueLengthAtStart);
    const queuedDuringSwipe = state.portal.queue.slice(portalQueueLengthAtStart);
    const releaseCells = getPortalReleaseCells(newGrid, state, state.portal.out);
    const releaseCount = Math.min(releaseCells.length, queuedBeforeSwipe.length);
    for (let index = 0; index < releaseCount; index += 1) {
      const cell = releaseCells[index];
      newGrid[cell.y][cell.x] = cloneTile(queuedBeforeSwipe[index]);
      moved = true;
    }
    state = {
      ...state,
      portal: {
        ...state.portal,
        queue: [...queuedBeforeSwipe.slice(releaseCount), ...queuedDuringSwipe].map(cloneTile),
      },
    };
  }

  if (moved) {
    state = {
      ...state,
      frozenTiles: decrementFrozenTiles(newGrid, state.frozenTiles),
    };
  }

  return {
    grid: newGrid,
    obstacleState: state,
    score: totalScore,
    moved,
    mergingTiles,
    mergedTiles,
    maxDistance,
  };
};

const getEmptyInternalCells = (grid: Grid, state: ObstacleState): Array<{ x: number; y: number }> => {
  const obstacleKeys = new Set(state.cellObstacles.map((obstacle) => cellKey(obstacle.x, obstacle.y)));
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid.length; x += 1) {
      if (grid[y][x]) continue;
      if (obstacleKeys.has(cellKey(x, y))) continue;
      cells.push({ x, y });
    }
  }
  return cells;
};

const portalEndpointFromIndex = (size: number, ordinal: number): PortalEndpoint => {
  const sideIndex = Math.floor(ordinal / size);
  const index = ordinal % size;
  const side = (['TOP', 'RIGHT', 'BOTTOM', 'LEFT'] as const)[sideIndex] ?? 'TOP';
  if (side === 'TOP') return { side, index, x: index, y: -1 };
  if (side === 'RIGHT') return { side, index, x: size, y: index };
  if (side === 'BOTTOM') return { side, index, x: index, y: size };
  return { side, index, x: -1, y: index };
};

const createRandomPortalPair = (size: number, rng: Rng): { in: PortalEndpoint; out: PortalEndpoint } => {
  const total = size * 4;
  const inOrdinal = Math.floor(rng() * total);
  let outOrdinal = Math.floor(rng() * (total - 1));
  if (outOrdinal >= inOrdinal) outOrdinal += 1;
  return {
    in: portalEndpointFromIndex(size, inOrdinal),
    out: portalEndpointFromIndex(size, outOrdinal),
  };
};

const chooseRandom = <T,>(items: T[], rng: Rng): T | null => {
  if (items.length === 0) return null;
  return items[Math.floor(rng() * items.length)] ?? items[0];
};

const obstacleId = (feature: ObstacleFeature, rng: Rng): string =>
  `${feature}-${Math.floor(rng() * 1_000_000_000).toString(36)}`;

export const applyObstacleSpawn = ({
  grid,
  slots,
  obstacleState,
  boardSize,
  feature,
  rng = Math.random,
  mergedTileIds = [],
  score = 0,
  maxTile = getMaxTileValue(grid),
  disableRotation = false,
}: ApplyObstacleSpawnParams): ApplyObstacleSpawnResult => {
  const state = cloneObstacleState(obstacleState);
  let nextState = cloneObstacleState(state);
  const activeCount = getActiveObstacleCount(state);
  const remainingActiveSlots = Math.max(0, MAX_ACTIVE_OBSTACLES - activeCount);
  if (remainingActiveSlots <= 0) {
    return { obstacleState: state, spawnedFeature: null, chance: 0 };
  }

  if (feature === 'ice') {
    const alreadyFrozen = new Set(state.frozenTiles.map((frozen) => frozen.tileId));
    const availableMergedIds = mergedTileIds.filter((tileId) => !alreadyFrozen.has(tileId));
    if (availableMergedIds.length === 0) return { obstacleState: state, spawnedFeature: null, chance: 0 };
    const limit = Math.min(getFrozenTileLimit({ score, maxTile }), availableMergedIds.length, remainingActiveSlots);
    const candidates = [...availableMergedIds];
    const selected: string[] = [];
    while (selected.length < limit && candidates.length > 0) {
      const index = Math.floor(rng() * candidates.length);
      selected.push(candidates.splice(index, 1)[0]);
    }
    nextState = {
      ...state,
      frozenTiles: [
        ...state.frozenTiles,
        ...selected.map((tileId) => ({ tileId, remainingSwipes: FROZEN_SWIPES })),
      ],
    };
    return { obstacleState: nextState, spawnedFeature: 'ice', chance: 0 };
  }

  if (feature === PORTAL_FEATURE) {
    if (state.portal) return { obstacleState: state, spawnedFeature: null, chance: 0 };
    const portal = createRandomPortalPair(boardSize, rng);
    nextState = {
      ...state,
      portal: { ...portal, queue: [] },
    };
    return { obstacleState: nextState, spawnedFeature: 'portal', chance: 0 };
  }

  const emptyCells = getEmptyInternalCells(grid, state);
  const cell = chooseRandom(emptyCells, rng);
  if (!cell) return { obstacleState: state, spawnedFeature: null, chance: 0 };

  const id = obstacleId(feature, rng);
  if (feature === 'concrete') {
    nextState = {
      ...state,
      cellObstacles: [...state.cellObstacles, { id, kind: 'concrete', x: cell.x, y: cell.y, hp: CONCRETE_START_HP }],
    };
  } else if (feature === 'percent') {
    nextState = {
      ...state,
      cellObstacles: [...state.cellObstacles, { id, kind: 'percent', x: cell.x, y: cell.y }],
    };
  } else {
    const directions: Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    nextState = {
      ...state,
      cellObstacles: [
        ...state.cellObstacles,
        {
          id,
          kind: 'container',
          x: cell.x,
          y: cell.y,
          direction: directions[Math.floor(rng() * directions.length)] ?? 'UP',
        },
      ],
    };
  }

  if (!hasPlaceableSlotWithObstacles(grid, nextState, slots, disableRotation)) {
    return { obstacleState: state, spawnedFeature: null, chance: 0 };
  }

  return { obstacleState: nextState, spawnedFeature: feature, chance: 0 };
};

const chooseSpawnFeature = (
  stage: number,
  state: ObstacleState,
  mergedTileIds: string[],
  rng: Rng
): ObstacleFeature | null => {
  const weights = getObstacleWeights(stage);
  const entries = Object.entries(weights).filter(([feature, weight]) => {
    if (!weight || weight <= 0) return false;
    if (feature === 'portal' && state.portal) return false;
    if (feature === 'ice' && mergedTileIds.length === 0) return false;
    return true;
  }) as Array<[ObstacleFeature, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) return null;
  let roll = rng() * total;
  for (const [feature, weight] of entries) {
    if (roll < weight) return feature;
    roll -= weight;
  }
  return entries[entries.length - 1]?.[0] ?? null;
};

export const getObstacleSpawnChanceBreakdown = ({
  boardSize,
  score,
  maxTile,
  obstacleState,
  feature,
}: {
  boardSize: BoardSize;
  score: number;
  maxTile: number;
  obstacleState: ObstacleState;
  feature?: ObstacleFeature;
}): ObstacleSpawnChanceBreakdown => {
  const state = cloneObstacleState(obstacleState);
  const stage = getObstacleStage({ score, maxTile });
  const activeObstacleCount = getActiveObstacleCount(state);
  const totalChance = activeObstacleCount >= MAX_ACTIVE_OBSTACLES
    ? 0
    : getObstacleSpawnChanceWithPity(boardSize, stage, state.spawnMissStreak);
  const weights = getObstacleWeights(stage);
  const entries = Object.entries(weights).filter(([candidate, weight]) => {
    if (!weight || weight <= 0) return false;
    if (candidate === 'portal' && state.portal) return false;
    return true;
  }) as Array<[ObstacleFeature, number]>;
  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const featureWeight = feature
    ? entries.find(([candidate]) => candidate === feature)?.[1] ?? 0
    : totalWeight;
  const featureChance = totalWeight > 0 ? totalChance * (featureWeight / totalWeight) : 0;
  return {
    stage,
    activeObstacleCount,
    totalChance,
    featureChance,
  };
};

export const rollObstacleSpawn = ({
  grid,
  slots,
  obstacleState,
  boardSize,
  score,
  maxTile,
  mergedTileIds = [],
  rng = Math.random,
  disableRotation = false,
}: ObstacleSpawnRollParams): ApplyObstacleSpawnResult => {
  const state = cloneObstacleState(obstacleState);
  const stage = getObstacleStage({ score, maxTile });
  const chance = getActiveObstacleCount(state) >= MAX_ACTIVE_OBSTACLES
    ? 0
    : getObstacleSpawnChanceWithPity(boardSize, stage, state.spawnMissStreak);
  if (chance <= 0) {
    return { obstacleState: state, spawnedFeature: null, chance };
  }

  const withMiss = (): ApplyObstacleSpawnResult => ({
    obstacleState: {
      ...state,
      spawnMissStreak: state.spawnMissStreak + 1,
    },
    spawnedFeature: null,
    chance,
  });

  if (rng() * 100 >= chance) {
    return withMiss();
  }
  const feature = chooseSpawnFeature(stage, state, mergedTileIds, rng);
  if (!feature) return withMiss();
  const spawnResult = applyObstacleSpawn({
    grid,
    slots,
    obstacleState: state,
    boardSize,
    feature,
    rng,
    mergedTileIds,
    score,
    maxTile,
    disableRotation,
  });
  if (!spawnResult.spawnedFeature) return withMiss();
  return {
    obstacleState: {
      ...spawnResult.obstacleState,
      spawnMissStreak: 0,
    },
    spawnedFeature: spawnResult.spawnedFeature,
    chance,
  };
};

export const hasPossibleMovesWithObstacles = (grid: Grid, state: ObstacleState): boolean => {
  return (['UP', 'DOWN', 'LEFT', 'RIGHT'] as Direction[]).some((direction) =>
    slideGridWithObstacles(grid, state, direction).moved
  );
};

export const getTurnActionAvailabilityWithObstacles = (
  grid: Grid,
  slots: (Piece | null)[],
  state: ObstacleState,
  disableRotation = false
): { canSwipe: boolean; canPlace: boolean; isGameOver: boolean } => {
  const canPlace = hasPlaceableSlotWithObstacles(grid, state, slots, disableRotation);
  const canSwipe = hasPossibleMovesWithObstacles(grid, state);
  return {
    canSwipe,
    canPlace,
    isGameOver: !canPlace,
  };
};
