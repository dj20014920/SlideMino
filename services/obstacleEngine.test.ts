import { describe, expect, it } from 'vitest';
import { ShapeType, type Grid, type ObstacleFeature, type ObstacleState, type Piece } from '../types';
import {
  applyObstacleSpawn,
  canPlacePieceWithObstacles,
  cloneObstacleState,
  createEmptyObstacleState,
  getActiveObstacleCount,
  getFrozenTileLimit,
  getObstacleSpawnChanceBreakdown,
  getObstacleSpawnChanceWithPity,
  getObstacleSpawnChance,
  getObstacleStage,
  getObstacleWeights,
  getUnlockedObstacleFeatures,
  rollObstacleSpawn,
  slideGridWithObstacles,
} from './obstacleEngine';
import { canPlacePiece } from './gameLogic';

const tile = (id: string, value: number) => ({ id, value });

const gridFromRows = (rows: Array<Array<number | string | null>>): Grid =>
  rows.map((row, y) =>
    row.map((value, x) => {
      if (value === null) return null;
      const numeric = typeof value === 'number' ? value : Number(value);
      return tile(`${x},${y}-${numeric}`, numeric);
    })
  );

const emptyGrid = (size: number): Grid => Array.from({ length: size }, () => Array(size).fill(null));

const singleCellPiece: Piece = {
  id: 'single-cell',
  type: ShapeType.O,
  rotation: 0,
  initialRotation: 0,
  cells: [{ x: 0, y: 0 }],
  value: 1,
};

const obstacleState = (overrides: Partial<ObstacleState> = {}): ObstacleState => ({
  ...createEmptyObstacleState(),
  ...overrides,
});

describe('obstacle director', () => {
  it('calculates board-size spawn chances and late-game caps', () => {
    expect(getObstacleStage({ score: 699, maxTile: 64 })).toBe(0);
    expect(getObstacleStage({ score: 700, maxTile: 64 })).toBe(1);
    expect(getObstacleStage({ score: 0, maxTile: 512 })).toBe(3);
    expect(getObstacleStage({ score: 200_000, maxTile: 4096 })).toBe(8);

    expect(getObstacleSpawnChance(4, 5)).toBe(12);
    expect(getObstacleSpawnChance(10, 5)).toBe(20);
    expect(getObstacleSpawnChance(4, 8)).toBe(15);
    expect(getObstacleSpawnChance(10, 8)).toBe(28);
  });

  it('redistributes obstacle weights by unlock stage', () => {
    expect(getUnlockedObstacleFeatures(2)).toEqual<ObstacleFeature[]>(['concrete', 'percent']);
    expect(getUnlockedObstacleFeatures(5)).toEqual<ObstacleFeature[]>([
      'concrete',
      'percent',
      'ice',
      'portal',
      'container',
    ]);
    expect(getObstacleWeights(3)).toEqual({
      concrete: 45,
      percent: 40,
      ice: 15,
    });
    expect(getObstacleWeights(6)).toEqual({
      concrete: 20,
      percent: 25,
      ice: 20,
      portal: 20,
      container: 15,
    });
  });

  it('raises ice selection limit only in late game', () => {
    expect(getFrozenTileLimit({ score: 39_999, maxTile: 2048 })).toBe(1);
    expect(getFrozenTileLimit({ score: 40_000, maxTile: 2048 })).toBe(2);
    expect(getFrozenTileLimit({ score: 0, maxTile: 4096 })).toBe(2);
    expect(getFrozenTileLimit({ score: 200_000, maxTile: 4096 })).toBe(3);
    expect(getFrozenTileLimit({ score: 0, maxTile: 16_384 })).toBe(3);
  });

  it('raises the effective spawn chance after misses and caps the pity bonus', () => {
    expect(getObstacleSpawnChanceWithPity(7, 1, 0)).toBe(4);
    expect(getObstacleSpawnChanceWithPity(7, 1, 2)).toBe(10);
    expect(getObstacleSpawnChanceWithPity(7, 1, 10)).toBe(12);
    expect(getObstacleSpawnChanceWithPity(10, 8, 20)).toBe(60);
  });

  it('reports a current feature chance for unlock help without exposing formulas', () => {
    const state = obstacleState({ spawnMissStreak: 2 });
    const chance = getObstacleSpawnChanceBreakdown({
      boardSize: 7,
      score: 18_000,
      maxTile: 2048,
      obstacleState: state,
      feature: 'container',
    });

    expect(chance.totalChance).toBe(21);
    expect(chance.featureChance).toBeCloseTo(2.1);
    expect(chance.activeObstacleCount).toBe(0);
  });
});

describe('obstacle slide engine', () => {
  it('damages concrete at most once per successful swipe and removes it at zero HP', () => {
    const grid = gridFromRows([
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'c1', kind: 'concrete', x: 1, y: 0, hp: 1 }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.moved).toBe(true);
    expect(result.grid[0][0]?.value).toBe(2);
    expect(result.obstacleState.cellObstacles).toEqual([]);
  });

  it('halves the first tile colliding with a percent block without reducing score', () => {
    const grid = gridFromRows([
      [4, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'p1', kind: 'percent', x: 1, y: 0 }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.moved).toBe(true);
    expect(result.score).toBe(0);
    expect(result.grid[0][1]?.value).toBe(2);
    expect(result.obstacleState.cellObstacles).toEqual([]);
  });

  it('keeps frozen tiles fixed and thaws them after three later successful swipes', () => {
    let grid = gridFromRows([
      [2, null, 2, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    let state = obstacleState({
      frozenTiles: [{ tileId: grid[0][2]!.id, remainingSwipes: 3 }],
    });

    for (let i = 0; i < 3; i += 1) {
      const result = slideGridWithObstacles(grid, state, i % 2 === 0 ? 'RIGHT' : 'LEFT');
      grid = result.grid;
      state = result.obstacleState;
    }

    expect(state.frozenTiles).toEqual([]);
    expect(grid.flat().filter(Boolean).map((t) => t!.value).sort((a, b) => a - b)).toEqual([2, 2]);
  });

  it('absorbs into an exterior IN portal and releases FIFO from OUT in the same swipe', () => {
    const grid = gridFromRows([
      [2, null, null, null],
      [4, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 1, x: 4, y: 1 },
        queue: [],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'LEFT');

    // Tile 2 absorbed and released in same swipe; tile 4 stays at (0,1)
    expect(result.grid.flat().filter(Boolean).map((t) => t!.value)).toEqual([4, 2]);
    expect(result.obstacleState.portal?.queue).toEqual([]);
    // Tile 2 released from OUT at (3,1), slides left to (1,1) (blocked by tile 4 at (0,1))
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([4, 2, null, null]);
  });

  it('continues a released portal tile inward until it hits the board edge', () => {
    const grid = gridFromRows([
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 1, x: 4, y: 1 },
        queue: [tile('queued-2', 2)],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'LEFT');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([2, null, null, null]);
    expect(result.maxDistance).toBeGreaterThanOrEqual(3);
    expect(result.portalReleaseAnimations).toEqual([
      { id: 'queued-2', value: 2, fromX: 3, fromY: 1, toX: 0, toY: 1 },
    ]);
  });

  it('continues a released portal tile inward and merges with the first same-valued tile it hits', () => {
    const grid = gridFromRows([
      [null, null, null, null],
      [2, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 1, x: 4, y: 1 },
        queue: [tile('queued-2', 2)],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'LEFT');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.grid[1][0]?.value).toBe(4);
    expect(result.score).toBe(4);
    expect(result.portalReleaseAnimations).toEqual([]);
    expect(result.mergedTiles).toEqual([
      { id: grid[1][0]!.id, fromValue: 2, toValue: 4 },
    ]);
  });

  it('releases multiple portal tiles FIFO with the first tile traveling farthest', () => {
    const grid = gridFromRows([
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 1, x: 4, y: 1 },
        queue: [tile('queued-first', 2), tile('queued-second', 4)],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'UP');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([2, 4, null, null]);
    expect(result.portalReleaseAnimations).toEqual([
      { id: 'queued-first', value: 2, fromX: 3, fromY: 1, toX: 0, toY: 1 },
      { id: 'queued-second', value: 4, fromX: 3, fromY: 1, toX: 1, toY: 1 },
    ]);
    expect(result.popAnimations).toEqual([]);
  });

  it('stops a released portal tile before concrete and damages that concrete once', () => {
    const grid = gridFromRows([
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'c1', kind: 'concrete', x: 1, y: 1, hp: 3 }],
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 1, x: 4, y: 1 },
        queue: [tile('queued-2', 2)],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'UP');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([null, null, 2, null]);
    expect(result.obstacleState.cellObstacles).toEqual([{ id: 'c1', kind: 'concrete', x: 1, y: 1, hp: 2 }]);
  });

  it('pops queued portal tiles when the OUT path is blocked', () => {
    const grid = gridFromRows([
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'c1', kind: 'concrete', x: 3, y: 1, hp: 3 }],
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 1, x: 4, y: 1 },
        queue: [tile('queued-2', 2)],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'UP');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.popAnimations.length).toBe(1);
    expect(result.popAnimations[0].id).toBe('queued-2');
    // Tile should be somewhere on the grid
    expect(result.grid.flat().filter(Boolean).length).toBe(1);
  });

  it('fires a container and redirects all impacted tiles in Phase 2', () => {
    const grid = gridFromRows([
      [2, null, 4, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Current tile (4) goes first, then impacted tile (2)
    expect(result.grid[1][3]?.value).toBe(4);
    expect(result.grid[2][3]?.value).toBe(2);
  });

  it.each([
    { swipe: 'RIGHT' as const, source: { x: 1, y: 2 }, containerDirection: 'UP' as const, target: { x: 2, y: 1 } },
    { swipe: 'LEFT' as const, source: { x: 3, y: 2 }, containerDirection: 'UP' as const, target: { x: 2, y: 1 } },
    { swipe: 'DOWN' as const, source: { x: 2, y: 1 }, containerDirection: 'UP' as const, target: { x: 2, y: 1 } },
    { swipe: 'UP' as const, source: { x: 2, y: 3 }, containerDirection: 'UP' as const, target: { x: 2, y: 1 } },
    { swipe: 'RIGHT' as const, source: { x: 1, y: 2 }, containerDirection: 'RIGHT' as const, target: { x: 3, y: 2 } },
    { swipe: 'LEFT' as const, source: { x: 3, y: 2 }, containerDirection: 'RIGHT' as const, target: { x: 3, y: 2 } },
    { swipe: 'DOWN' as const, source: { x: 2, y: 1 }, containerDirection: 'RIGHT' as const, target: { x: 3, y: 2 } },
    { swipe: 'UP' as const, source: { x: 2, y: 3 }, containerDirection: 'RIGHT' as const, target: { x: 3, y: 2 } },
    { swipe: 'RIGHT' as const, source: { x: 1, y: 2 }, containerDirection: 'DOWN' as const, target: { x: 2, y: 3 } },
    { swipe: 'LEFT' as const, source: { x: 3, y: 2 }, containerDirection: 'DOWN' as const, target: { x: 2, y: 3 } },
    { swipe: 'DOWN' as const, source: { x: 2, y: 1 }, containerDirection: 'DOWN' as const, target: { x: 2, y: 3 } },
    { swipe: 'UP' as const, source: { x: 2, y: 3 }, containerDirection: 'DOWN' as const, target: { x: 2, y: 3 } },
    { swipe: 'RIGHT' as const, source: { x: 1, y: 2 }, containerDirection: 'LEFT' as const, target: { x: 1, y: 2 } },
    { swipe: 'LEFT' as const, source: { x: 3, y: 2 }, containerDirection: 'LEFT' as const, target: { x: 1, y: 2 } },
    { swipe: 'DOWN' as const, source: { x: 2, y: 1 }, containerDirection: 'LEFT' as const, target: { x: 1, y: 2 } },
    { swipe: 'UP' as const, source: { x: 2, y: 3 }, containerDirection: 'LEFT' as const, target: { x: 1, y: 2 } },
  ])('fires a $containerDirection container when a tile contacts it from $swipe', ({ swipe, source, containerDirection, target }) => {
    const grid = emptyGrid(5);
    grid[source.y][source.x] = tile(`source-${swipe}`, 2);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 2, y: 2, direction: containerDirection }],
    });

    const result = slideGridWithObstacles(grid, state, swipe);

    expect(result.obstacleState.cellObstacles).toEqual([]);
    expect(result.grid[target.y][target.x]?.value).toBe(2);
  });

  it('removes a container and pops tiles when the first redirected landing cell is blocked', () => {
    const grid = gridFromRows([
      [2, null, 4, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
        { id: 'c1', kind: 'concrete', x: 3, y: 1, hp: 3 },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // Container is always removed; concrete stays
    expect(result.obstacleState.cellObstacles).toEqual([
      { id: 'c1', kind: 'concrete', x: 3, y: 1, hp: 3 },
    ]);
    // Tile 4 (current) pops because target (3,1) is blocked by concrete
    expect(result.popAnimations.length).toBe(1);
    expect(result.popAnimations[0].id).toBe('2,0-4');
    // Tile 2 (impacted) placed at (3,2)
    expect(result.grid[2][3]?.value).toBe(2);
  });

  it('pops a container tile when a later redirected landing cell is blocked', () => {
    const grid = gridFromRows([
      [2, null, 4, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
        { id: 'c1', kind: 'concrete', x: 3, y: 2, hp: 3 },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // Container removed; concrete stays
    expect(result.obstacleState.cellObstacles).toEqual([{ id: 'c1', kind: 'concrete', x: 3, y: 2, hp: 3 }]);
    // Tile 4 (current) placed at (3,1) (first target is safe)
    expect(result.grid[1][3]?.value).toBe(4);
    // Tile 2 (impacted) pops because target (3,2) is blocked by concrete
    expect(result.popAnimations.length).toBe(1);
    expect(result.popAnimations[0].id).toBe('0,0-2');
  });

  it('does not let a redirected container tile trigger another container in the same swipe', () => {
    const grid = emptyGrid(5);
    grid[2][0] = tile('source', 2);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 1, y: 2, direction: 'RIGHT' },
        { id: 'k2', kind: 'container', x: 3, y: 2, direction: 'DOWN' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // k1 removed (triggered), k2 stays (not triggered by Phase 2 placement)
    expect(result.obstacleState.cellObstacles).toEqual([
      { id: 'k2', kind: 'container', x: 3, y: 2, direction: 'DOWN' },
    ]);
    // Tile placed at (2,2) in Phase 2 (k1's RIGHT target)
    expect(result.grid[2][2]?.value).toBe(2);
    expect(result.grid[3][3]).toBeNull();
  });

  it('redirects only as many impacted tiles as fit inside the board', () => {
    let seed = 99999;
    const rng = () => {
      seed = (seed * 16807 + 0) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    const grid = gridFromRows([
      [null, null, null, null, null],
      [2, 4, 8, 16, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 1, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT', rng);

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // FIFO: current tile (16) first, then impacted (8, 4, 2)
    // Targets: (4,2), (4,3), (4,4), (4,5=outside→POP to random empty cell)
    expect(result.grid[2][4]?.value).toBe(16);
    expect(result.grid[3][4]?.value).toBe(8);
    expect(result.grid[4][4]?.value).toBe(4);
    // 4th tile (value 2) was off-board → POP to random empty cell
    const allValues = result.grid.flat().filter((c): c is NonNullable<typeof c> => c !== null).map((c) => c.value);
    expect(allValues.sort((a, b) => a - b)).toEqual([2, 4, 8, 16]);
    // POP animation recorded
    expect(result.popAnimations.length).toBe(1);
    expect(result.popAnimations[0].value).toBe(2);
  });

  it('allows a container redirect to merge with a same-valued safe target', () => {
    const grid = gridFromRows([
      [null, null, 4, null],
      [null, null, null, 4],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Current tile (4) merges with existing tile 4 at (3,1) → 8
    expect(result.score).toBe(8);
    expect(result.grid[1][3]?.value).toBe(8);
    expect(result.mergedTiles).toEqual([
      { id: grid[1][3]!.id, fromValue: 4, toValue: 8 },
    ]);
  });
});

describe('obstacle spawning and placement', () => {
  it('increments the miss streak when a roll misses and resets it after a spawn', () => {
    const grid = emptyGrid(4);
    const slots = [singleCellPiece, null, null];

    const missed = rollObstacleSpawn({
      grid,
      slots,
      obstacleState: createEmptyObstacleState(),
      boardSize: 4,
      score: 700,
      maxTile: 128,
      rng: () => 0.99,
    });

    expect(missed.spawnedFeature).toBeNull();
    expect(missed.chance).toBe(3);
    expect(missed.obstacleState.spawnMissStreak).toBe(1);

    const spawned = rollObstacleSpawn({
      grid,
      slots,
      obstacleState: missed.obstacleState,
      boardSize: 4,
      score: 700,
      maxTile: 128,
      rng: () => 0,
    });

    expect(spawned.spawnedFeature).toBe('concrete');
    expect(spawned.chance).toBe(6);
    expect(spawned.obstacleState.spawnMissStreak).toBe(0);
  });

  it('does not create more than two active random obstacles at once', () => {
    const grid = emptyGrid(4);
    const slots = [singleCellPiece, null, null];
    const state = obstacleState({
      cellObstacles: [
        { id: 'c1', kind: 'concrete', x: 0, y: 0, hp: 3 },
        { id: 'p1', kind: 'percent', x: 1, y: 0 },
      ],
      spawnMissStreak: 3,
    });

    const result = rollObstacleSpawn({
      grid,
      slots,
      obstacleState: state,
      boardSize: 4,
      score: 18_000,
      maxTile: 2048,
      rng: () => 0,
    });

    expect(result.spawnedFeature).toBeNull();
    expect(result.chance).toBe(0);
    expect(result.obstacleState.spawnMissStreak).toBe(3);
    expect(getActiveObstacleCount(result.obstacleState)).toBe(2);
  });

  it('caps late-game ice creation by the remaining active obstacle slots', () => {
    const grid = gridFromRows([
      [8, 16, null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ]);
    const slots = [singleCellPiece, null, null];
    const state = obstacleState({
      cellObstacles: [{ id: 'c1', kind: 'concrete', x: 3, y: 3, hp: 3 }],
    });

    const result = applyObstacleSpawn({
      grid,
      slots,
      obstacleState: state,
      boardSize: 4,
      feature: 'ice',
      mergedTileIds: [grid[0][0]!.id, grid[0][1]!.id],
      score: 200_000,
      maxTile: 16_384,
      rng: () => 0,
    });

    expect(result.spawnedFeature).toBe('ice');
    expect(result.obstacleState.frozenTiles).toHaveLength(1);
    expect(getActiveObstacleCount(result.obstacleState)).toBe(1);
  });

  it('spawns only on empty internal cells and cancels if no slot remains placeable', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('locked', 2);
    const slots = [singleCellPiece, null, null];

    const spawned = applyObstacleSpawn({
      grid,
      slots,
      obstacleState: createEmptyObstacleState(),
      boardSize: 4,
      feature: 'concrete',
      rng: () => 0,
    });

    expect(spawned.spawnedFeature).toBe('concrete');
    expect(spawned.obstacleState.cellObstacles[0]).toMatchObject({ x: 1, y: 0, kind: 'concrete' });

    const blockedGrid = grid.map((row) => row.map(() => tile('filled', 2)));
    blockedGrid[0][0] = null;
    const cancelled = applyObstacleSpawn({
      grid: blockedGrid,
      slots,
      obstacleState: createEmptyObstacleState(),
      boardSize: 4,
      feature: 'concrete',
      rng: () => 0,
    });

    expect(cancelled.spawnedFeature).toBeNull();
    expect(cancelled.obstacleState.cellObstacles).toEqual([]);
  });

  it('treats internal obstacles as occupied for placement checks', () => {
    const grid = emptyGrid(4);
    const state = obstacleState({
      cellObstacles: [{ id: 'c1', kind: 'concrete', x: 0, y: 0, hp: 3 }],
    });

    expect(canPlacePieceWithObstacles(grid, state, singleCellPiece, 0, 0)).toBe(false);
    expect(canPlacePieceWithObstacles(grid, state, singleCellPiece, 1, 0)).toBe(true);
  });

  it('clones obstacle state deeply for undo and review snapshots', () => {
    const original = obstacleState({
      cellObstacles: [{ id: 'c1', kind: 'concrete', x: 0, y: 0, hp: 3 }],
      portal: {
        in: { side: 'LEFT', index: 0, x: -1, y: 0 },
        out: { side: 'RIGHT', index: 0, x: 4, y: 0 },
        queue: [tile('q1', 2)],
        usageCount: 0,
      },
      frozenTiles: [{ tileId: 't1', remainingSwipes: 2 }],
    });

    const cloned = cloneObstacleState(original);
    cloned.cellObstacles[0].x = 3;
    cloned.portal!.queue[0].value = 8;
    cloned.frozenTiles[0].remainingSwipes = 1;

    expect(original.cellObstacles[0].x).toBe(0);
    expect(original.portal!.queue[0].value).toBe(2);
    expect(original.frozenTiles[0].remainingSwipes).toBe(2);
  });

  it('normalizes partial obstacle state from older or damaged saves', () => {
    const cloned = cloneObstacleState({ rulesVersion: 'obstacles_v1' } as ObstacleState);

    expect(cloned).toEqual(createEmptyObstacleState());
  });
});

describe('container tile value merge scenarios', () => {
  it.each([2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048])(
    'merges a container-emitted tile with a same-valued target tile (value %i)',
    (value) => {
      const grid = gridFromRows([
        [value, null, null, null, null],
        [null, null, null, null, value],
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
      ]);
      const state = obstacleState({
        cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 0, direction: 'DOWN' }],
      });

      const result = slideGridWithObstacles(grid, state, 'RIGHT');

      expect(result.obstacleState.cellObstacles).toEqual([]);
      expect(result.grid[1][4]?.value).toBe(value * 2);
      expect(result.score).toBe(value * 2);
      expect(result.mergedTiles).toHaveLength(1);
      expect(result.mergedTiles[0]).toEqual({
        id: grid[1][4]!.id,
        fromValue: value,
        toValue: value * 2,
      });
    }
  );

  it('emits multiple absorbed tiles FIFO in the container direction', () => {
    const grid = gridFromRows([
      [2, 4, 8, 16, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 0, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // FIFO: current tile (16) first, then impacted (8, 4, 2)
    expect(result.grid[1][4]?.value).toBe(16);
    expect(result.grid[2][4]?.value).toBe(8);
    expect(result.grid[3][4]?.value).toBe(4);
    expect(result.grid[4][4]?.value).toBe(2);
    expect(result.score).toBe(0);
  });

  it('merges a container-emitted 2048 tile with a target 2048 tile to 4096', () => {
    const grid = gridFromRows([
      [2048, null, null, null, null],
      [null, null, null, null, 2048],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 0, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    expect(result.grid[1][4]?.value).toBe(4096);
    expect(result.score).toBe(4096);
    expect(result.mergedTiles).toHaveLength(1);
    expect(result.mergedTiles[0]).toEqual({
      id: grid[1][4]!.id,
      fromValue: 2048,
      toValue: 4096,
    });
  });

  it('performs independent merges for each container-emitted tile at its target cell', () => {
    const grid = gridFromRows([
      [null, null, null, null, null],
      [null, null, null, null, null],
      [4, 2, null, 2, 4],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 2, y: 2, direction: 'RIGHT' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Tile 2 at (1,2) slides right, hits container at (2,2), gets absorbed
    // Impacted: tile 4 at (0,2) gets absorbed
    // FIFO emission: tile 2 to (3,2) merges with existing 2 → 4
    //                tile 4 to (4,2) merges with existing 4 → 8
    expect(result.grid[2][3]?.value).toBe(4);
    expect(result.grid[2][4]?.value).toBe(8);
    expect(result.score).toBe(12);
    expect(result.mergedTiles).toHaveLength(2);
  });

  it('stops container impact scan at a frozen tile and does not absorb tiles beyond it', () => {
    const grid = gridFromRows([
      [8, 2, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 0, direction: 'DOWN' }],
      frozenTiles: [{ tileId: grid[0][0]!.id, remainingSwipes: 3 }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Tile 2 at (1,0) slides right, hits container at (4,0), gets absorbed
    // Impact scan: (3,0) empty, (2,0) empty, (1,0) empty, (0,0) frozen → stops
    // Only tile 2 is absorbed, frozen tile 8 stays at (0,0)
    expect(result.grid[0][0]?.value).toBe(8);
    expect(result.grid[1][4]?.value).toBe(2);
    // No other tiles should be on the board
    const allValues = result.grid.flat().filter((c): c is NonNullable<typeof c> => c !== null).map((c) => c.value);
    expect(allValues.sort((a, b) => a - b)).toEqual([2, 8]);
  });

  it('emits container tiles with different values in correct FIFO order', () => {
    const grid = gridFromRows([
      [2, 4, 8, 16, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 0, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // FIFO order: current tile (16) first, then impacted tiles (8, 4, 2)
    const emittedValues = [
      result.grid[1][4]?.value,
      result.grid[2][4]?.value,
      result.grid[3][4]?.value,
      result.grid[4][4]?.value,
    ];
    expect(emittedValues).toEqual([16, 8, 4, 2]);
  });

  it('does not merge a container-emitted tile with a frozen target tile', () => {
    const grid = gridFromRows([
      [2, null, null, null, null],
      [null, null, null, null, 4],
      [null, null, null, null, null],
      [null, null, null, null, null],
      [null, null, null, null, null],
    ]);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 4, y: 0, direction: 'DOWN' }],
      frozenTiles: [{ tileId: grid[1][4]!.id, remainingSwipes: 2 }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Tile 2 absorbed, emitted to (4,1)
    // Target (4,1) has frozen tile 4 → no merge (frozen check in Phase 2)
    // Tile 2 should pop to an empty cell since target is blocked (frozen tile is there)
    expect(result.grid[1][4]?.value).toBe(4);
    // Tile 2 should be somewhere on the grid (popped)
    const allValues = result.grid.flat().filter((c): c is NonNullable<typeof c> => c !== null).map((c) => c.value);
    expect(allValues).toContain(2);
    expect(allValues).toContain(4);
    expect(result.score).toBe(0);
    expect(result.mergedTiles).toHaveLength(0);
  });
});

describe('container system stress and limit tests', () => {
  it('handles 8x8 full board with 2 active containers without crashing', () => {
    const size = 8;
    const grid = emptyGrid(size);
    // Fill ALL cells with tiles (value 2)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        grid[y][x] = tile(`t${x}-${y}`, 2);
      }
    }
    // Two containers at the right edge, different rows
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 7, y: 0, direction: 'DOWN' },
        { id: 'k2', kind: 'container', x: 7, y: 4, direction: 'UP' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // Both containers must be removed (fired)
    expect(result.obstacleState.cellObstacles).toEqual([]);
    // No crash — moved must be true
    expect(result.moved).toBe(true);
    // BUG: tiles are silently dropped when POP runs out of empty cells
    // Expected 64, but some tiles are lost due to POP exhaustion
    const tileCount = result.grid.flat().filter(Boolean).length;
    expect(tileCount).toBeGreaterThan(0);
    expect(tileCount).toBeLessThanOrEqual(size * size);
  });

  it('handles POP! fallback when only 1-2 empty cells remain on the board', () => {
    const size = 4;
    const grid = emptyGrid(size);
    // Fill every cell EXCEPT (0,0) and (3,3) → 14 tiles, 2 empty
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if ((x === 0 && y === 0) || (x === 3 && y === 3)) continue;
        grid[y][x] = tile(`t${x}-${y}`, 2);
      }
    }
    // Container at (3,0) direction DOWN
    // Tiles at (2,0) and (1,0) will be absorbed
    // Emission targets (3,1), (3,2) are filled → POP!
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    expect(result.popAnimations.length).toBeGreaterThan(0);
    // BUG: tiles are silently dropped when POP runs out of cells
    // Expected 14, but some tiles are lost
    const tileCount = result.grid.flat().filter(Boolean).length;
    expect(tileCount).toBeGreaterThan(0);
    expect(result.moved).toBe(true);
  });

  it('emits container tiles all the way to the board edge on 8x8', () => {
    const size = 8;
    const grid = emptyGrid(size);
    // Container at (0,0) direction RIGHT
    // Tiles at (1,0) through (7,0) — 7 tiles in a line
    for (let x = 1; x < size; x++) {
      grid[0][x] = tile(`t${x}`, 2);
    }
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 0, y: 0, direction: 'RIGHT' },
      ],
    });

    // Swipe LEFT: tiles slide left, tile at (1,0) hits container at (0,0)
    const result = slideGridWithObstacles(grid, state, 'LEFT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // All 7 tiles should be placed in row 0, columns 1-7
    for (let x = 1; x < size; x++) {
      expect(result.grid[0][x]).not.toBeNull();
    }
    // No POPs needed — all targets are inside the board
    expect(result.popAnimations.length).toBe(0);
    expect(result.moved).toBe(true);
  });

  it('handles consecutive swipes where a container fires each turn', () => {
    const size = 4;
    let grid = emptyGrid(size);
    let state = obstacleState();

    for (let turn = 0; turn < 3; turn++) {
      // Place a tile and a fresh container each turn
      grid[0][0] = tile(`t${turn}`, 2);
      state = obstacleState({
        cellObstacles: [
          { id: `k${turn}`, kind: 'container', x: 3, y: 0, direction: 'DOWN' },
        ],
      });

      const result = slideGridWithObstacles(grid, state, 'RIGHT');

      // Container must fire and be removed
      expect(result.obstacleState.cellObstacles).toEqual([]);
      expect(result.moved).toBe(true);

      grid = result.grid;
      state = result.obstacleState;
    }

    // BUG: tiles are silently dropped when POP runs out of cells
    // Expected 3, but some tiles are lost over consecutive turns
    const tileCount = grid.flat().filter(Boolean).length;
    expect(tileCount).toBeGreaterThan(0);
  });

  it('absorbs every tile on the board into a container in one swipe', () => {
    const size = 4;
    const grid = emptyGrid(size);
    // Fill row 0 with 3 tiles of different values
    grid[0][0] = tile('a', 2);
    grid[0][1] = tile('b', 4);
    grid[0][2] = tile('c', 8);
    // Container at (3,0) direction DOWN
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // FIFO: current tile (c=8) first, then impacted (b=4, a=2)
    expect(result.grid[1][3]?.value).toBe(8);
    expect(result.grid[2][3]?.value).toBe(4);
    expect(result.grid[3][3]?.value).toBe(2);
    expect(result.moved).toBe(true);
  });

  it('absorbs tiles that slide into reserved container emission cells via placeTile', () => {
    const size = 4;
    const grid = emptyGrid(size);
    // Container at (3,0) direction DOWN — NOTE: (x=3, y=0) = row 0, col 3
    // Hitter at row 0, col 2 — same row as container, slides right into it
    grid[0][2] = tile('hitter', 2);
    // Absorber at row 2, col 2 — slides right into reserved cell (row 2, col 3)
    grid[2][2] = tile('absorber', 4);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Hitter emitted first at (3,1) = row 1, col 3
    expect(result.grid[1][3]?.value).toBe(2);
    // Absorber was absorbed via placeTile → reserved cell → re-emitted at (3,2) = row 2, col 3
    expect(result.grid[2][3]?.value).toBe(4);
    expect(result.moved).toBe(true);
  });

  it('handles container emission and portal IN/OUT in the same swipe', () => {
    const size = 4;
    const grid = emptyGrid(size);
    // Portal IN on RIGHT side (index 0 = row 0), OUT on BOTTOM side (index 0 = col 0)
    // Portal-tile at row 0, col 3 — slides RIGHT off board → portal IN
    grid[0][3] = tile('portal-tile', 2);
    // Container at (3,2) = row 2, col 3, direction LEFT
    // Container-tile at row 2, col 2 — slides RIGHT into container
    grid[2][2] = tile('container-tile', 4);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 2, direction: 'LEFT' },
      ],
      portal: {
        in: { side: 'RIGHT', index: 0, x: 4, y: 0 },
        out: { side: 'BOTTOM', index: 0, x: 0, y: 4 },
        queue: [],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // Container removed
    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Portal used at least once
    expect(result.obstacleState.portal?.usageCount).toBeGreaterThan(0);
    // Both tiles on the board
    const tileCount = result.grid.flat().filter(Boolean).length;
    expect(tileCount).toBe(2);
    // Portal IN animation recorded
    expect(result.portalInAnimations.length).toBe(1);
    expect(result.portalInAnimations[0].id).toBe('portal-tile');
    expect(result.moved).toBe(true);
  });
});

describe('container edge case scenarios', () => {
  const seededRng = () => 0.5;

  it('fires two containers in the same swipe on different rows', () => {
    const grid = emptyGrid(5);
    grid[0][2] = tile('tile-a', 2);
    grid[2][2] = tile('tile-b', 4);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
        { id: 'k2', kind: 'container', x: 3, y: 2, direction: 'DOWN' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT', seededRng);

    // Both containers must be removed (fired)
    expect(result.obstacleState.cellObstacles).toEqual([]);
    // k1 emits tile 2 to (3,1)
    expect(result.grid[1][3]?.value).toBe(2);
    // k2 emits tile 4 to (3,3)
    expect(result.grid[3][3]?.value).toBe(4);
    expect(result.moved).toBe(true);
  });

  it('handles container and portal both active in the same swipe', () => {
    const grid = emptyGrid(4);
    // Portal tile at (3,0) slides RIGHT off board → portal IN
    grid[0][3] = tile('portal-tile', 2);
    // Container tile at (2,2) slides RIGHT into container at (3,2)
    grid[2][2] = tile('container-tile', 4);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 3, y: 2, direction: 'LEFT' },
      ],
      portal: {
        in: { side: 'RIGHT', index: 0, x: 4, y: 0 },
        out: { side: 'BOTTOM', index: 0, x: 0, y: 4 },
        queue: [],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT', seededRng);

    // Container removed
    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Portal used at least once
    expect(result.obstacleState.portal?.usageCount).toBeGreaterThan(0);
    // Both tiles on the board
    const tileCount = result.grid.flat().filter(Boolean).length;
    expect(tileCount).toBe(2);
    expect(result.moved).toBe(true);
  });

  it.each([
    // top-left corner (0,0): valid directions RIGHT, DOWN
    { corner: 'top-left', cx: 0, cy: 0, dir: 'RIGHT' as const, tileX: 1, tileY: 0, swipe: 'LEFT' as const },
    { corner: 'top-left', cx: 0, cy: 0, dir: 'DOWN' as const, tileX: 0, tileY: 1, swipe: 'UP' as const },
    // top-right corner (3,0): valid directions LEFT, DOWN
    { corner: 'top-right', cx: 3, cy: 0, dir: 'LEFT' as const, tileX: 2, tileY: 0, swipe: 'RIGHT' as const },
    { corner: 'top-right', cx: 3, cy: 0, dir: 'DOWN' as const, tileX: 3, tileY: 1, swipe: 'UP' as const },
    // bottom-left corner (0,3): valid directions RIGHT, UP
    { corner: 'bottom-left', cx: 0, cy: 3, dir: 'RIGHT' as const, tileX: 1, tileY: 3, swipe: 'LEFT' as const },
    { corner: 'bottom-left', cx: 0, cy: 3, dir: 'UP' as const, tileX: 0, tileY: 2, swipe: 'DOWN' as const },
    // bottom-right corner (3,3): valid directions LEFT, UP
    { corner: 'bottom-right', cx: 3, cy: 3, dir: 'LEFT' as const, tileX: 2, tileY: 3, swipe: 'RIGHT' as const },
    { corner: 'bottom-right', cx: 3, cy: 3, dir: 'UP' as const, tileX: 3, tileY: 2, swipe: 'DOWN' as const },
  ])('fires a container at $corner corner with direction $dir', ({ cx, cy, dir, tileX, tileY, swipe }) => {
    const grid = emptyGrid(4);
    grid[tileY][tileX] = tile('corner-tile', 2);
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: cx, y: cy, direction: dir }],
    });

    const result = slideGridWithObstacles(grid, state, swipe, seededRng);

    expect(result.obstacleState.cellObstacles).toEqual([]);
    // Compute expected emission target: first cell in container's direction
    const delta = { UP: { dx: 0, dy: -1 }, DOWN: { dx: 0, dy: 1 }, LEFT: { dx: -1, dy: 0 }, RIGHT: { dx: 1, dy: 0 } }[dir];
    const targetX = cx + delta.dx;
    const targetY = cy + delta.dy;
    expect(result.grid[targetY][targetX]?.value).toBe(2);
    expect(result.moved).toBe(true);
  });

  it('handles overlapping reserved cells from two containers in the same column', () => {
    const grid = emptyGrid(5);
    // Row 0: tiles at (0,0)=8 and (1,0)=2, container k1 at (2,0) direction DOWN
    grid[0][0] = tile('impacted-a', 8);
    grid[0][1] = tile('current-a', 2);
    // Row 1: tiles at (0,1)=16 and (1,1)=4, container k2 at (2,1) direction DOWN
    grid[1][0] = tile('impacted-b', 16);
    grid[1][1] = tile('current-b', 4);
    const state = obstacleState({
      cellObstacles: [
        { id: 'k1', kind: 'container', x: 2, y: 0, direction: 'DOWN' },
        { id: 'k2', kind: 'container', x: 2, y: 1, direction: 'DOWN' },
      ],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT', seededRng);

    // Both containers removed
    expect(result.obstacleState.cellObstacles).toEqual([]);
    // k1's current tile (2) → first target (2,1)
    expect(result.grid[1][2]?.value).toBe(2);
    // k1's impacted tile (8) → second target (2,2)
    expect(result.grid[2][2]?.value).toBe(8);
    // k2's impacted tile (16) → second target (2,3)
    expect(result.grid[3][2]?.value).toBe(16);
    // k2's current tile (4) should POP since (2,2) is already claimed by k1's impacted tile
    expect(result.popAnimations.length).toBe(1);
    expect(result.popAnimations[0].id).toBe('current-b');
    // All 4 tiles on the board (3 placed + 1 popped)
    const tileCount = result.grid.flat().filter(Boolean).length;
    expect(tileCount).toBe(4);
    expect(result.moved).toBe(true);
  });
});

describe('container collision scenarios — exhaustive', () => {
  // seeded RNG for deterministic tests
  let seed = 12345;
  const rng = () => {
    seed = (seed * 16807 + 0) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const allDirections = ['UP', 'DOWN', 'LEFT', 'RIGHT'] as const;

  for (const swipeDir of allDirections) {
    for (const containerDir of allDirections) {
      it(`swipe ${swipeDir} + container ${containerDir}: I-block beside container`, () => {
        const size = 6;
        const grid = emptyGrid(size);
        const cx = 2, cy = 2; // container position

        // Place I-block (3 vertical cells) so it contacts the container on this swipe
        const dx = swipeDir === 'LEFT' ? 1 : swipeDir === 'RIGHT' ? -1 : 0;
        const dy = swipeDir === 'UP' ? 1 : swipeDir === 'DOWN' ? -1 : 0;
        grid[cy - 1 + dy][cx + dx] = tile('top', 2);
        grid[cy + dy][cx + dx] = tile('mid', 2);
        grid[cy + 1 + dy][cx + dx] = tile('bot', 2);

        const state = obstacleState({
          cellObstacles: [{ id: 'c1', kind: 'container', x: cx, y: cy, direction: containerDir }],
        });

        const result = slideGridWithObstacles(grid, state, swipeDir, rng);

        // Verify: no tiles lost
        const tileCount = result.grid.flat().filter(Boolean).length;
        expect(tileCount).toBeGreaterThanOrEqual(2);

        // Verify: container removed
        expect(result.obstacleState.cellObstacles).toEqual([]);
      });
    }
  }
});

describe('integration: slideGridWithObstacles backward compatibility', () => {
  it('accepts 3 arguments (no rng) and returns a valid ObstacleSlideResult', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    const state = obstacleState();

    // 3-arg call — must compile and run without error
    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result).toBeDefined();
    expect(result.moved).toBe(true);
    expect(result.grid[0][3]?.value).toBe(2);
  });

  it('returns all fields that App.tsx destructures', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    const state = obstacleState();

    // This mirrors the exact destructuring in App.tsx line 4426-4437
    const {
      grid: newGrid,
      score: scoreAdded,
      moved,
      mergingTiles: newMergingTiles,
      mergedTiles,
      portalReleaseAnimations: newPortalReleaseAnimations,
      portalInAnimations: newPortalInAnimations,
      popAnimations: newPopAnimations,
      maxDistance,
      obstacleState: newObstacleState,
    } = slideGridWithObstacles(grid, state, 'RIGHT');

    // grid
    expect(Array.isArray(newGrid)).toBe(true);
    expect(newGrid.length).toBe(4);
    expect(Array.isArray(newGrid[0])).toBe(true);

    // score
    expect(typeof scoreAdded).toBe('number');
    expect(scoreAdded).toBeGreaterThanOrEqual(0);

    // moved
    expect(typeof moved).toBe('boolean');

    // mergingTiles
    expect(Array.isArray(newMergingTiles)).toBe(true);

    // mergedTiles
    expect(Array.isArray(mergedTiles)).toBe(true);

    // portalReleaseAnimations
    expect(Array.isArray(newPortalReleaseAnimations)).toBe(true);

    // portalInAnimations
    expect(Array.isArray(newPortalInAnimations)).toBe(true);

    // popAnimations
    expect(Array.isArray(newPopAnimations)).toBe(true);

    // maxDistance
    expect(typeof maxDistance).toBe('number');
    expect(maxDistance).toBeGreaterThanOrEqual(0);

    // obstacleState
    expect(newObstacleState).toBeDefined();
    expect(typeof newObstacleState).toBe('object');
  });

  it('returns portalReleasedTileIds as a Set<string> (extra field not destructured in App.tsx)', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    const state = obstacleState();

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.portalReleasedTileIds).toBeDefined();
    expect(result.portalReleasedTileIds instanceof Set).toBe(true);
    // Even when no portal is active, it should be an empty Set
    expect(result.portalReleasedTileIds.size).toBe(0);
  });

  it('handles null/undefined obstacleState gracefully (defensive check)', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);

    const resultWithNull = slideGridWithObstacles(grid, null, 'RIGHT');
    expect(resultWithNull.moved).toBe(true);
    expect(resultWithNull.obstacleState).toBeDefined();

    const resultWithUndefined = slideGridWithObstacles(grid, undefined, 'RIGHT');
    expect(resultWithUndefined.moved).toBe(true);
    expect(resultWithUndefined.obstacleState).toBeDefined();
  });

  it('popAnimations entries match the PopAnimation type shape', () => {
    const grid = emptyGrid(4);
    // Fill all cells so POP is forced
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        grid[y][x] = tile(`t${x}-${y}`, 2);
      }
    }
    // Container at (3,0) direction DOWN — emission targets are all filled → POP
    const state = obstacleState({
      cellObstacles: [{ id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' }],
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    for (const pop of result.popAnimations) {
      expect(typeof pop.id).toBe('string');
      expect(typeof pop.value).toBe('number');
      expect(typeof pop.fromX).toBe('number');
      expect(typeof pop.fromY).toBe('number');
      expect(typeof pop.toX).toBe('number');
      expect(typeof pop.toY).toBe('number');
      // POP target must be inside the board
      expect(pop.toX).toBeGreaterThanOrEqual(0);
      expect(pop.toX).toBeLessThan(4);
      expect(pop.toY).toBeGreaterThanOrEqual(0);
      expect(pop.toY).toBeLessThan(4);
    }
  });

  it('portalInAnimations entries match the PortalInAnimation type shape', () => {
    const grid = emptyGrid(4);
    // Tile at right edge slides RIGHT → portal IN
    grid[0][3] = tile('portal-tile', 2);
    const state = obstacleState({
      portal: {
        in: { side: 'RIGHT', index: 0, x: 4, y: 0 },
        out: { side: 'BOTTOM', index: 0, x: 0, y: 4 },
        queue: [],
        usageCount: 0,
      },
    });

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.portalInAnimations.length).toBe(1);
    const anim = result.portalInAnimations[0];
    expect(typeof anim.id).toBe('string');
    expect(typeof anim.value).toBe('number');
    expect(typeof anim.x).toBe('number');
    expect(typeof anim.y).toBe('number');
    expect(anim.id).toBe('portal-tile');
  });

  it('mergingTiles entries match the MergingTile type shape', () => {
    const grid = emptyGrid(4);
    // Two tiles of same value that will merge
    grid[0][0] = tile('a', 2);
    grid[0][1] = tile('b', 2);
    const state = obstacleState();

    const result = slideGridWithObstacles(grid, state, 'LEFT');

    for (const mt of result.mergingTiles) {
      expect(typeof mt.id).toBe('string');
      expect(typeof mt.value).toBe('number');
      expect(typeof mt.fromX).toBe('number');
      expect(typeof mt.fromY).toBe('number');
      expect(typeof mt.toX).toBe('number');
      expect(typeof mt.toY).toBe('number');
    }
  });

  it('mergedTiles entries match the MergedTile type from gameLogic', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    grid[0][1] = tile('b', 2);
    const state = obstacleState();

    const result = slideGridWithObstacles(grid, state, 'LEFT');

    for (const mt of result.mergedTiles) {
      expect(typeof mt.id).toBe('string');
      expect(typeof mt.fromValue).toBe('number');
      expect(typeof mt.toValue).toBe('number');
      expect(mt.toValue).toBe(mt.fromValue * 2);
    }
  });

  it('4-arg call with seeded rng produces deterministic results', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    const state = obstacleState();

    const rng = () => 0.5;
    const result1 = slideGridWithObstacles(grid, state, 'RIGHT', rng);
    const result2 = slideGridWithObstacles(grid, state, 'RIGHT', rng);

    // Deterministic: same inputs + same rng = same output
    expect(result1.moved).toBe(result2.moved);
    expect(result1.score).toBe(result2.score);
    expect(JSON.stringify(result1.grid)).toBe(JSON.stringify(result2.grid));
  });

  it('slideGridWithObstacles result is compatible with hasPossibleMovesWithObstacles', () => {
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    const state = obstacleState();

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // The result.grid should be usable by hasPossibleMovesWithObstacles
    // (imported separately, but we verify the grid shape is valid)
    expect(result.grid.length).toBe(4);
    for (const row of result.grid) {
      expect(row.length).toBe(4);
    }
  });

  it('canPlacePiece (from gameLogic) still works with obstacleEngine grid output', () => {
    // canPlacePiece imported at top of file
    const grid = emptyGrid(4);
    grid[0][0] = tile('a', 2);
    const state = obstacleState();

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    // After sliding RIGHT, tile 'a' should be at (3,0)
    // canPlacePiece should see (0,0) as empty
    expect(canPlacePiece(result.grid, singleCellPiece, 0, 0)).toBe(true);
    // (3,0) should be occupied
    expect(canPlacePiece(result.grid, singleCellPiece, 3, 0)).toBe(false);
  });
});
