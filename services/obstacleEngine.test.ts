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

  it('absorbs into an exterior IN portal and releases FIFO from OUT only on a later swipe', () => {
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
      },
    });

    const absorbed = slideGridWithObstacles(grid, state, 'LEFT');

    expect(absorbed.grid.flat().filter(Boolean).map((t) => t!.value)).toEqual([4]);
    expect(absorbed.obstacleState.portal?.queue.map((t) => t.value)).toEqual([2]);

    const released = slideGridWithObstacles(absorbed.grid, absorbed.obstacleState, 'UP');

    expect(released.obstacleState.portal?.queue).toEqual([]);
    expect(released.grid[1].map((cell) => cell?.value ?? null)).toEqual([2, null, null, null]);
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
      },
    });

    const result = slideGridWithObstacles(grid, state, 'UP');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([2, 4, null, null]);
    expect(result.portalReleaseAnimations).toEqual([
      { id: 'queued-first', value: 2, fromX: 3, fromY: 1, toX: 0, toY: 1 },
      { id: 'queued-second', value: 4, fromX: 3, fromY: 1, toX: 1, toY: 1 },
    ]);
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
      },
    });

    const result = slideGridWithObstacles(grid, state, 'UP');

    expect(result.obstacleState.portal?.queue).toEqual([]);
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([null, null, 2, null]);
    expect(result.obstacleState.cellObstacles).toEqual([{ id: 'c1', kind: 'concrete', x: 1, y: 1, hp: 2 }]);
  });

  it('does not release queued portal tiles when the OUT path is blocked', () => {
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
      },
    });

    const result = slideGridWithObstacles(grid, state, 'UP');

    expect(result.obstacleState.portal?.queue.map((t) => t.value)).toEqual([2]);
    expect(result.grid[1][3]).toBeNull();
  });

  it('fires a container only when every redirected tile has a safe landing', () => {
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

  it('keeps a container alive when the first redirected landing cell is blocked by another obstacle', () => {
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

    expect(result.obstacleState.cellObstacles).toEqual([
      { id: 'k1', kind: 'container', x: 3, y: 0, direction: 'DOWN' },
      { id: 'c1', kind: 'concrete', x: 3, y: 1, hp: 3 },
    ]);
    expect(result.grid[1][3]).toBeNull();
    expect(result.grid[2][3]).toBeNull();
  });

  it('partially fires a container before a later redirected landing cell is blocked', () => {
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

    expect(result.obstacleState.cellObstacles).toEqual([{ id: 'c1', kind: 'concrete', x: 3, y: 2, hp: 3 }]);
    expect(result.grid[0].map((cell) => cell?.value ?? null)).toEqual([null, null, null, 2]);
    expect(result.grid[1][3]?.value).toBe(4);
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

    expect(result.obstacleState.cellObstacles).toEqual([
      { id: 'k2', kind: 'container', x: 3, y: 2, direction: 'DOWN' },
    ]);
    expect(result.grid[2][2]?.value).toBe(2);
    expect(result.grid[3][3]).toBeNull();
  });

  it('redirects only as many impacted tiles as fit inside the board', () => {
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

    const result = slideGridWithObstacles(grid, state, 'RIGHT');

    expect(result.obstacleState.cellObstacles).toEqual([]);
    expect(result.grid[1].map((cell) => cell?.value ?? null)).toEqual([null, null, null, null, 2]);
    expect(result.grid[2][4]?.value).toBe(16);
    expect(result.grid[3][4]?.value).toBe(8);
    expect(result.grid[4][4]?.value).toBe(4);
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
