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
  PopAnimation,
  PortalEndpoint,
  PortalInAnimation,
  PortalReleaseAnimation,
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
  portalReleaseAnimations: PortalReleaseAnimation[];
  portalInAnimations: PortalInAnimation[];   // 추가
  popAnimations: PopAnimation[];             // 추가
  maxDistance: number;
  portalReleasedTileIds: Set<string>;
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
  const source = state as Partial<ObstacleState>;
  const rawPortal = source.portal;
  const hasPortal = Boolean(rawPortal?.in && rawPortal?.out);
  const rawMissStreak = source.spawnMissStreak;
  return {
    rulesVersion: OBSTACLE_RULES_VERSION,
    cellObstacles: Array.isArray(source.cellObstacles)
      ? source.cellObstacles.map((obstacle) => {
          const cloned = { ...obstacle };
          if (cloned.kind === 'concrete' && (typeof cloned.hp !== 'number' || !Number.isFinite(cloned.hp))) {
            cloned.hp = CONCRETE_START_HP;
          }
          return cloned;
        })
      : [],
    frozenTiles: Array.isArray(source.frozenTiles)
      ? source.frozenTiles.map((frozen) => ({ ...frozen }))
      : [],
    portal: rawPortal && hasPortal
      ? {
          in: { ...rawPortal.in },
          out: { ...rawPortal.out },
          queue: Array.isArray(rawPortal.queue) ? rawPortal.queue.map(cloneTile) : [],
          usageCount: typeof rawPortal.usageCount === 'number' ? rawPortal.usageCount : 0,
        }
      : null,
    spawnMissStreak:
      typeof rawMissStreak === 'number' && Number.isFinite(rawMissStreak)
        ? Math.min(100, Math.max(0, Math.floor(rawMissStreak)))
        : 0,
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
  if (!state) return 0;
  return (state.cellObstacles?.length ?? 0) + (state.portal ? 1 : 0);
  // frozenTiles는 별도 슬롯으로 관리 (얼음이 다른 장애물 스폰을 막지 않도록)
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

const getPortalInwardDelta = (endpoint: PortalEndpoint): { dx: number; dy: number } => {
  if (endpoint.side === 'LEFT') return { dx: 1, dy: 0 };
  if (endpoint.side === 'RIGHT') return { dx: -1, dy: 0 };
  if (endpoint.side === 'TOP') return { dx: 0, dy: 1 };
  return { dx: 0, dy: -1 };
};

const getPortalEntryCell = (size: number, endpoint: PortalEndpoint): { x: number; y: number } => {
  if (endpoint.side === 'LEFT') return { x: 0, y: endpoint.index };
  if (endpoint.side === 'RIGHT') return { x: size - 1, y: endpoint.index };
  if (endpoint.side === 'TOP') return { x: endpoint.index, y: 0 };
  return { x: endpoint.index, y: size - 1 };
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
  frozenIds: ReadonlySet<string>,
  lockedTileIds: ReadonlySet<string>
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
    if (lockedTileIds.has(tile.id)) break;
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

export const slideGridWithObstacles = (
  grid: Grid,
  obstacleState: ObstacleState | null | undefined,
  direction: Direction,
  rng: () => number = Math.random
): ObstacleSlideResult => {
  const size = grid.length;
  let newGrid = cloneGrid(grid);
  let state = cloneObstacleState(obstacleState);
  let totalScore = 0;
  let moved = false;
  let maxDistance = 0;
  const mergingTiles: MergingTile[] = [];
  const mergedTiles: MergedTile[] = [];
  const portalReleaseAnimations: PortalReleaseAnimation[] = [];
  const portalInAnimations: PortalInAnimation[] = [];
  const popAnimations: PopAnimation[] = [];
  const mergedTargetIds = new Set<string>();
  const noMergeTileIds = new Set<string>();
  const portalReleasedTileIds = new Set<string>();
  const concreteCollisions = new Set<string>();
  const frozenIdsAtStart = new Set(state.frozenTiles.map((frozen) => frozen.tileId));
  const originalPositions = getTilePositions(newGrid);

  const delta = DIRECTION_DELTAS[direction];
  const obstacleMap = buildCellObstacleMap(state);
  const coords = getScanCoordinates(size, direction);

  // ── Phase 1 수집 큐 ──
  const collectedTiles: Array<{
    tile: Tile;
    kind: 'portal' | 'container';
    containerInfo?: { x: number; y: number; direction: Direction };
  }> = [];

  const reservedCells = new Map<string, { x: number; y: number; direction: Direction }>();

  const placeTile = (tile: Tile, x: number, y: number, originalX: number, originalY: number): void => {
    const targetKey = cellKey(x, y);
    const containerInfo = reservedCells.get(targetKey);
    if (containerInfo) {
      // 예약된 셀 → 컨테이너 큐로 흡수
      
      collectedTiles.push({
        tile: cloneTile(tile),
        kind: 'container',
        containerInfo,
      });
      const distance = Math.abs(x - originalX) + Math.abs(y - originalY);
      if (distance > 0) moved = true;
      maxDistance = Math.max(maxDistance, distance);
      return;
    }
    newGrid[y][x] = tile;
    const distance = Math.abs(x - originalX) + Math.abs(y - originalY);
    if (distance > 0) moved = true;
    maxDistance = Math.max(maxDistance, distance);
  };

  // ═══════════════════════════════════════════
  // PHASE 1: 수집 (메인 슬라이드 + 컨테이너/포탈 IN)
  // ═══════════════════════════════════════════
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
        // ── 포탈 IN 체크 ──
        if (isMatchingPortalExit(state.portal, direction, currentX, currentY) && !portalReleasedTileIds.has(tile.id)) {
          collectedTiles.push({ tile: cloneTile(currentTile), kind: 'portal' });
          portalInAnimations.push({
            id: currentTile.id,
            value: currentTile.value,
            x: currentX,
            y: currentY,
          });
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
          placeTile(currentTile, currentX, currentY, original.x, original.y);
          break;
        }
        if (obstacle.kind === 'container') {
          // ── 컨테이너: 현재 타일 + 영향받는 모든 타일을 수집 ──
          collectedTiles.push({
            tile: cloneTile(currentTile),
            kind: 'container',
            containerInfo: { x: obstacle.x, y: obstacle.y, direction: obstacle.direction },
          });
          const impacted = collectContainerImpacts(newGrid, state, obstacle, direction, frozenIdsAtStart, new Set<string>());
          for (const impactedTile of impacted) {
            const ipos = originalPositions.get(impactedTile.id);
            if (ipos && newGrid[ipos.y]?.[ipos.x]?.id === impactedTile.id) {
              newGrid[ipos.y][ipos.x] = null;
            }
            collectedTiles.push({
              tile: cloneTile(impactedTile),
              kind: 'container',
              containerInfo: { x: obstacle.x, y: obstacle.y, direction: obstacle.direction },
            });
          }
          // Phase 2 방출 타겟 중 빈 셀만 예약 (Phase 1 배치 충돌 방지)
          // 타일이 이미 있는 셀은 Phase 2 merge 대상이므로 예약 제외
          const containerTileCount = 1 + impacted.length;
          const targets = getRedirectTargets(size, obstacle, containerTileCount);
          for (const target of targets) {
            if (!newGrid[target.y]?.[target.x]) {
              reservedCells.set(cellKey(target.x, target.y), {
                x: obstacle.x,
                y: obstacle.y,
                direction: obstacle.direction,
              });
            }
          }
          // 컨테이너 제거
          state = {
            ...state,
            cellObstacles: state.cellObstacles.filter((candidate) => candidate.id !== obstacle.id),
          };
          obstacleMap.delete(cellKey(obstacle.x, obstacle.y));
          moved = true;
          maxDistance = Math.max(maxDistance, Math.abs(nextX - original.x) + Math.abs(nextY - original.y));
          consumed = true;
          break;
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

    if (!consumed) {
      const key = cellKey(currentX, currentY);
      if (reservedCells.has(key)) {
        // placeTile이 이미 collectedTiles로 흡수함 — 이중 처리 방지
        consumed = true;
      } else if (!newGrid[currentY][currentX]) {
        placeTile(currentTile, currentX, currentY, original.x, original.y);
      }
    }
  }

  // ═══════════════════════════════════════════
  // PHASE 2: 통합 FIFO 방출
  // ═══════════════════════════════════════════
  const existingPortalQueue = state.portal?.queue ?? [];
  const emissionQueue: Array<{
    tile: Tile;
    kind: 'portal' | 'container';
    containerInfo?: { x: number; y: number; direction: Direction };
  }> = [
    ...existingPortalQueue.map((t) => ({ tile: t, kind: 'portal' as const })),
    ...collectedTiles,
  ];

  const claimedCells = new Set<string>();
  const containerEmitCount = new Map<string, number>();

  for (const entry of emissionQueue) {
    if (entry.kind === 'portal' && state.portal) {
      // ── 포탈 방출 ──
      const releaseDelta = getPortalInwardDelta(state.portal.out);
      const releaseEntry = getPortalEntryCell(size, state.portal.out);
      const entryKey = cellKey(releaseEntry.x, releaseEntry.y);

      if (
        !isInside(size, releaseEntry.x, releaseEntry.y) ||
        newGrid[releaseEntry.y]?.[releaseEntry.x] ||
        obstacleMap.has(entryKey)
      ) {
        // POP! 랜덤 빈 셀로
        const emptyCells = getEmptyInternalCells(newGrid, state);
        if (emptyCells.length > 0) {
          const rc = emptyCells[Math.floor(rng() * emptyCells.length)];
          newGrid[rc.y][rc.x] = cloneTile(entry.tile);
          popAnimations.push({
            id: entry.tile.id,
            value: entry.tile.value,
            fromX: releaseEntry.x,
            fromY: releaseEntry.y,
            toX: rc.x,
            toY: rc.y,
          });
          moved = true;
        } else {
          const allCells: Array<{ x: number; y: number }> = [];
          for (let cy = 0; cy < size; cy += 1) {
            for (let cx = 0; cx < size; cx += 1) {
              allCells.push({ x: cx, y: cy });
            }
          }
          if (allCells.length > 0) {
            const rc = allCells[Math.floor(rng() * allCells.length)];
            newGrid[rc.y][rc.x] = cloneTile(entry.tile);
            popAnimations.push({
              id: entry.tile.id,
              value: entry.tile.value,
              fromX: releaseEntry.x,
              fromY: releaseEntry.y,
              toX: rc.x,
              toY: rc.y,
            });
            moved = true;
          }
        }
        state = {
          ...state,
          portal: { ...state.portal, usageCount: (state.portal.usageCount ?? 0) + 1 },
        };
        continue;
      }

      // 정상 방출: inward 슬라이드
      const releasedTile = cloneTile(entry.tile);
      let currentX = releaseEntry.x;
      let currentY = releaseEntry.y;
      let released = false;

      while (true) {
        const nextX = currentX + releaseDelta.dx;
        const nextY = currentY + releaseDelta.dy;

        if (!isInside(size, nextX, nextY)) {
          newGrid[currentY][currentX] = releasedTile;
          portalReleasedTileIds.add(releasedTile.id);
          portalReleaseAnimations.push({
            id: releasedTile.id,
            value: releasedTile.value,
            fromX: releaseEntry.x,
            fromY: releaseEntry.y,
            toX: currentX,
            toY: currentY,
          });
          moved = true;
          maxDistance = Math.max(
            maxDistance,
            Math.abs(currentX - releaseEntry.x) + Math.abs(currentY - releaseEntry.y)
          );
          released = true;
          break;
        }

        const obstacle = obstacleMap.get(cellKey(nextX, nextY));
        if (obstacle) {
          if (obstacle.kind === 'percent') {
            const nextValue = releasedTile.value <= 1 ? 1 : Math.max(1, Math.floor(releasedTile.value / 2));
            const halvedTile = { ...releasedTile, value: nextValue };
            newGrid[nextY][nextX] = halvedTile;
            portalReleasedTileIds.add(halvedTile.id);
            portalReleaseAnimations.push({
              id: halvedTile.id,
              value: halvedTile.value,
              fromX: releaseEntry.x,
              fromY: releaseEntry.y,
              toX: nextX,
              toY: nextY,
            });
            obstacleMap.delete(cellKey(nextX, nextY));
            state = {
              ...state,
              cellObstacles: state.cellObstacles.filter((candidate) => candidate.id !== obstacle.id),
            };
            noMergeTileIds.add(halvedTile.id);
            moved = true;
            maxDistance = Math.max(
              maxDistance,
              Math.abs(nextX - releaseEntry.x) + Math.abs(nextY - releaseEntry.y)
            );
          } else {
            if (obstacle.kind === 'concrete') {
              concreteCollisions.add(obstacle.id);
            }
            newGrid[currentY][currentX] = releasedTile;
            portalReleasedTileIds.add(releasedTile.id);
            portalReleaseAnimations.push({
              id: releasedTile.id,
              value: releasedTile.value,
              fromX: releaseEntry.x,
              fromY: releaseEntry.y,
              toX: currentX,
              toY: currentY,
            });
            moved = true;
            maxDistance = Math.max(
              maxDistance,
              Math.abs(currentX - releaseEntry.x) + Math.abs(currentY - releaseEntry.y)
            );
          }
          released = true;
          break;
        }

        const nextTile = newGrid[nextY][nextX];
        if (nextTile) {
          const targetFrozen = frozenIdsAtStart.has(nextTile.id);
          const canMerge =
            !targetFrozen &&
            !mergedTargetIds.has(nextTile.id) &&
            !noMergeTileIds.has(nextTile.id) &&
            nextTile.value === releasedTile.value;

          if (canMerge) {
            const newValue = Math.min(nextTile.value * 2, MAX_TILE_VALUE);
            newGrid[nextY][nextX] = { ...nextTile, value: newValue };
            portalReleasedTileIds.add(releasedTile.id);
            mergedTargetIds.add(nextTile.id);
            mergingTiles.push({
              id: releasedTile.id,
              value: releasedTile.value,
              fromX: releaseEntry.x,
              fromY: releaseEntry.y,
              toX: nextX,
              toY: nextY,
            });
            mergedTiles.push({
              id: nextTile.id,
              fromValue: nextTile.value,
              toValue: newValue,
            });
            totalScore = Math.min(totalScore + newValue, MAX_SCORE);
          } else {
            newGrid[currentY][currentX] = releasedTile;
            portalReleaseAnimations.push({
              id: releasedTile.id,
              value: releasedTile.value,
              fromX: releaseEntry.x,
              fromY: releaseEntry.y,
              toX: currentX,
              toY: currentY,
            });
          }
          moved = true;
          maxDistance = Math.max(
            maxDistance,
            Math.abs((canMerge ? nextX : currentX) - releaseEntry.x) +
              Math.abs((canMerge ? nextY : currentY) - releaseEntry.y)
          );
          released = true;
          break;
        }

        currentX = nextX;
        currentY = nextY;
      }

      if (released) {
        claimedCells.add(entryKey);
      }
      state = {
        ...state,
        portal: { ...state.portal, usageCount: (state.portal.usageCount ?? 0) + 1 },
      };

    } else if (entry.kind === 'container' && entry.containerInfo) {
      // ── 컨테이너 방출 (순차 타겟) ──
      const { x: cx, y: cy, direction: containerDir } = entry.containerInfo;
      const cDelta = DIRECTION_DELTAS[containerDir];
      const containerKey = cellKey(cx, cy);
      const emitIndex = containerEmitCount.get(containerKey) ?? 0;
      containerEmitCount.set(containerKey, emitIndex + 1);
      const targetX = cx + cDelta.dx * (emitIndex + 1);
      const targetY = cy + cDelta.dy * (emitIndex + 1);

      if (!isInside(size, targetX, targetY)) {
        const emptyCells = getEmptyInternalCells(newGrid, state);
        if (emptyCells.length > 0) {
          const rc = emptyCells[Math.floor(rng() * emptyCells.length)];
          newGrid[rc.y][rc.x] = cloneTile(entry.tile);
          popAnimations.push({
            id: entry.tile.id,
            value: entry.tile.value,
            fromX: cx,
            fromY: cy,
            toX: rc.x,
            toY: rc.y,
          });
          moved = true;
        } else {
          const allCells: Array<{ x: number; y: number }> = [];
          for (let cy = 0; cy < size; cy += 1) {
            for (let cx = 0; cx < size; cx += 1) {
              allCells.push({ x: cx, y: cy });
            }
          }
          if (allCells.length > 0) {
            const rc = allCells[Math.floor(rng() * allCells.length)];
            newGrid[rc.y][rc.x] = cloneTile(entry.tile);
            popAnimations.push({
              id: entry.tile.id,
              value: entry.tile.value,
              fromX: cx,
              fromY: cy,
              toX: rc.x,
              toY: rc.y,
            });
            moved = true;
          }
        }
        continue;
      }

      const targetKey = cellKey(targetX, targetY);
      const targetTile = newGrid[targetY]?.[targetX];
      

      // 병합 우선: 같은 값이면 merge
      if (
        targetTile &&
        targetTile.value === entry.tile.value &&
        !frozenIdsAtStart.has(targetTile.id) &&
        !mergedTargetIds.has(targetTile.id)
      ) {
        const newValue = Math.min(targetTile.value * 2, MAX_TILE_VALUE);
        newGrid[targetY][targetX] = { ...targetTile, value: newValue };
        mergedTargetIds.add(targetTile.id);
        totalScore = Math.min(totalScore + newValue, MAX_SCORE);
        mergingTiles.push({
          id: entry.tile.id,
          value: entry.tile.value,
          fromX: cx,
          fromY: cy,
          toX: targetX,
          toY: targetY,
        });
        mergedTiles.push({
          id: targetTile.id,
          fromValue: targetTile.value,
          toValue: newValue,
        });
        claimedCells.add(targetKey);
        moved = true;
        maxDistance = Math.max(maxDistance, Math.abs(targetX - cx) + Math.abs(targetY - cy));
        continue;
      }

      // 막힘 → POP!
      if (targetTile || claimedCells.has(targetKey) || obstacleMap.has(targetKey)) {
        const emptyCells = getEmptyInternalCells(newGrid, state);
        if (emptyCells.length > 0) {
          const rc = emptyCells[Math.floor(rng() * emptyCells.length)];
          newGrid[rc.y][rc.x] = cloneTile(entry.tile);
          popAnimations.push({
            id: entry.tile.id,
            value: entry.tile.value,
            fromX: cx,
            fromY: cy,
            toX: rc.x,
            toY: rc.y,
          });
          moved = true;
        } else {
          const allCells: Array<{ x: number; y: number }> = [];
          for (let cy = 0; cy < size; cy += 1) {
            for (let cx = 0; cx < size; cx += 1) {
              allCells.push({ x: cx, y: cy });
            }
          }
          if (allCells.length > 0) {
            const rc = allCells[Math.floor(rng() * allCells.length)];
            newGrid[rc.y][rc.x] = cloneTile(entry.tile);
            popAnimations.push({
              id: entry.tile.id,
              value: entry.tile.value,
              fromX: cx,
              fromY: cy,
              toX: rc.x,
              toY: rc.y,
            });
            moved = true;
          }
        }
        continue;
      }

      // 정상 배치
      newGrid[targetY][targetX] = cloneTile(entry.tile);
      claimedCells.add(targetKey);
      moved = true;
      maxDistance = Math.max(maxDistance, Math.abs(targetX - cx) + Math.abs(targetY - cy));
    }
  }

  // 포탈 큐 비우기 + usageCount 체크로 소멸
  if (state.portal) {
    state = {
      ...state,
      portal: { ...state.portal, queue: [] },
    };
    if (state.portal.usageCount >= 5) {
      state = { ...state, portal: null };
    }
  }

  // ── 콘크리트 손상 ──
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

  // ── 얼음 감소 ──
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
    portalReleaseAnimations,
    portalInAnimations,
    popAnimations,
    maxDistance,
    portalReleasedTileIds,
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
      portal: { ...portal, queue: [], usageCount: 0 },
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
    const allDirections: Direction[] = ['UP', 'RIGHT', 'DOWN', 'LEFT'];
    const validDirections = allDirections.filter((dir) => {
      if (dir === 'LEFT' && cell.x === 0) return false;
      if (dir === 'RIGHT' && cell.x === grid.length - 1) return false;
      if (dir === 'UP' && cell.y === 0) return false;
      if (dir === 'DOWN' && cell.y === grid.length - 1) return false;
      return true;
    });
    const direction = validDirections[Math.floor(rng() * validDirections.length)] ?? 'UP';
    nextState = {
      ...state,
      cellObstacles: [
        ...state.cellObstacles,
        { id, kind: 'container', x: cell.x, y: cell.y, direction },
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
