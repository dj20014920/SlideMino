import React, {
  Suspense,
  lazy,
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
  useImperativeHandle,
  forwardRef
} from 'react';
import { Grid, Piece, Phase, Tile, MergingTile } from '../types';
import { canPlacePiece } from '../services/gameLogic';
import { getTileColor, getTileNumberLayout, getSlideAnimationDurationMs, BOARD_CELL_GAP_PX } from '../constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import EvervaultTileOverlay from './EvervaultTileOverlay';
import { clamp, type ResolvedTileAppearance } from '../services/blockCustomization';

const EVERVAULT_SKIN_ID = 'skin_digital_evervault';
const PixelBlast = lazy(() => import('../vendor/pixelblast/PixelBlast'));

export type BoardHandle = {
  setHoverLocation: (pos: { x: number; y: number } | null) => void;
};

export interface ReviveDestroyEffect {
  id: string;
  x: number;
  y: number;
  value: number;
}

interface BoardProps {
  grid: Grid;
  activePiece: Piece | null;
  boardRef: React.RefObject<HTMLDivElement>;
  phase: Phase;
  mergingTiles: MergingTile[];
  valueOverrides?: Record<string, number>;
  htmlId?: string;
  boardScale?: number;
  reviveSelectionEnabled?: boolean;
  revivePendingTileId?: string | null;
  onReviveTileTap?: (tileId: string) => void;
  reviveDestroyEffects?: ReviveDestroyEffect[];
  mergedNumberBurstTileIds?: ReadonlySet<string>;
  mergedNumberBurstByTileId?: Readonly<Record<string, number>>;
}

const BackgroundGrid = React.memo<{
  size: number;
  layout: GridLayout;
  isPremiumUiThemeActive: boolean;
  premiumUiBoardCellClassName: string;
}>(({
  size,
  layout,
  isPremiumUiThemeActive,
  premiumUiBoardCellClassName,
}) => {
  if (layout.cellPx <= 0) return null;
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      {Array.from({ length: size * size }).map((_, i) => {
        const x = i % size;
        const y = Math.floor(i / size);
        const transform = `translate3d(${layout.posPx[x]}px, ${layout.posPx[y]}px, 0)`;
        return (
          <div
            key={`bg-${i}`}
            className={`absolute ${isPremiumUiThemeActive ? premiumUiBoardCellClassName : `rounded-xl ${getTileColor(0)}`}`}
            data-board-bg-slot="true"
            style={{
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              left: 0,
              top: 0,
              transform,
            }}
          />
        );
      })}
    </div>
  );
});

type GridLayout = {
  cellPx: number;
  pitchPx: number;
  posPx: number[];
};

const EXPLORE_GALAXY_SKIN_ID = 'skin_digital_explore_galaxy';
const PIXELBLAST_VOID_SKIN_ID = 'skin_digital_pixelblast_void';
const PENDING_MERGE_RIPPLE_TTL_MS = 4500;
const MAX_PENDING_MERGE_RIPPLES = 4;

type PendingMergeRipple = {
  fingerprint: string;
  targets: string[];
  expiresAt: number;
};

const tileTransitionEase = 'cubic-bezier(0.25,0.1,0.25,1.0)';
const reviveDestroyAnimation = 'reviveBreakFade 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards';
const EMPTY_REVIVE_DESTROY_EFFECTS: ReviveDestroyEffect[] = [];

const MergingTilesLayer = React.memo<{
  animatingMerges: (MergingTile & { currentX: number; currentY: number; distance: number })[];
  layout: GridLayout;
  getResolvedAppearance: (value: number) => ResolvedTileAppearance;
  isPremiumUiThemeActive: boolean;
  premiumUiTileFaceClassName: string;
  premiumUiTileNumberClassName: string;
}>(({ animatingMerges, layout, getResolvedAppearance, isPremiumUiThemeActive, premiumUiTileFaceClassName, premiumUiTileNumberClassName }) => {
  return (
    <div className="absolute inset-0 z-5 pointer-events-none">
      {animatingMerges.map((mt) => {
        const duration = getSlideAnimationDurationMs(mt.distance);
        const transform = `translate3d(${layout.posPx[mt.currentX]}px, ${layout.posPx[mt.currentY]}px, 0)`;
        const { text, fontPx } = getTileNumberLayout(mt.value, layout.cellPx);
        const appearance = getResolvedAppearance(mt.value);
        const preserveAppearanceInWin98 = Boolean(appearance.style?.backgroundColor || appearance.style?.backgroundImage || appearance.style?.boxShadow);
        const isNeonBlock = appearance.className === 'skin-neon-block';
        return (
          <div
            key={`merge-${mt.id}`}
            data-tile-id={mt.id}
            data-tile-distance={mt.distance}
            data-tile-kind="merge"
            data-premium-ui-allow-gradient={preserveAppearanceInWin98 ? 'true' : undefined}
            data-premium-ui-allow-shadow={preserveAppearanceInWin98 ? 'true' : undefined}
            className={`
              absolute ${isPremiumUiThemeActive ? premiumUiTileFaceClassName : (isNeonBlock ? '' : 'rounded-xl')} flex items-center justify-center
              font-semibold ${isNeonBlock ? '' : 'overflow-hidden'} text-center
              ${appearance.className}
              ${isNeonBlock ? 'skin-neon-block--board' : ''}
            `}
            style={{
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              left: 0,
              top: 0,
              fontSize: `${fontPx}px`,
              lineHeight: 1,
              whiteSpace: 'pre-line',
              ...(appearance.style ?? {}),
              // 아래 속성들은 appearance.style보다 항상 우선
              transform,
              opacity: 0.7,
              transition: duration
                ? `transform ${duration}ms ${tileTransitionEase}`
                : undefined,
              willChange: duration ? 'transform' : undefined,
            }}
          >
            <span className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}>{text}</span>
          </div>
        );
      })}
    </div>
  );
});

const TilesLayer = React.memo<{
  tiles: (Tile & { x: number; y: number; distance: number })[];
  layout: GridLayout;
  getResolvedAppearance: (value: number) => ResolvedTileAppearance;
  valueOverrides?: Record<string, number>;
  reviveSelectionEnabled?: boolean;
  revivePendingTileId?: string | null;
  onReviveTileTap?: (tileId: string) => void;
  isEvervaultSkin?: boolean;
  mergeFlashTileIds?: ReadonlySet<string>;
  onMergeFlashEnd?: (tileId: string) => void;
  mergedNumberBurstTileIds?: ReadonlySet<string>;
  mergedNumberBurstByTileId?: Readonly<Record<string, number>>;
  isPremiumUiThemeActive?: boolean;
  premiumUiTileFaceClassName: string;
  premiumUiTileNumberClassName: string;
}>(({
  tiles,
  layout,
  getResolvedAppearance,
  valueOverrides,
  reviveSelectionEnabled = false,
  revivePendingTileId = null,
  onReviveTileTap,
  isEvervaultSkin = false,
  mergeFlashTileIds,
  onMergeFlashEnd,
  mergedNumberBurstTileIds,
  mergedNumberBurstByTileId,
  isPremiumUiThemeActive = false,
  premiumUiTileFaceClassName,
  premiumUiTileNumberClassName,
}) => {
  const canSelectTiles = reviveSelectionEnabled && typeof onReviveTileTap === 'function';

  return (
    <div
      className={`
        absolute inset-0 z-10
        ${canSelectTiles ? 'pointer-events-auto' : 'pointer-events-none'}
      `}
    >
      {tiles.map((tile) => {
        const duration = getSlideAnimationDurationMs(tile.distance);
        const displayValue = valueOverrides?.[tile.id] ?? tile.value;
        const transform = `translate3d(${layout.posPx[tile.x]}px, ${layout.posPx[tile.y]}px, 0)`;
        const { text, fontPx } = getTileNumberLayout(displayValue, layout.cellPx);
        const appearance = getResolvedAppearance(displayValue);
        const preserveAppearanceInWin98 = Boolean(appearance.style?.backgroundColor || appearance.style?.backgroundImage || appearance.style?.boxShadow);
        const isNeonBlock = appearance.className === 'skin-neon-block';
        const isPendingTarget = canSelectTiles && revivePendingTileId === tile.id;
        const isMergeNumberBursting = !!mergedNumberBurstTileIds?.has(tile.id);
        const mergedBurstValue = mergedNumberBurstByTileId?.[tile.id] ?? displayValue;
        const mergeBurstStep = isMergeNumberBursting
          ? (() => {
              if (mergedBurstValue >= 8192) return 4;
              if (mergedBurstValue >= 2048) return 3;
              if (mergedBurstValue >= 512) return 2;
              if (mergedBurstValue >= 128) return 1;
              return 0;
            })()
          : 0;
        const mergeBurstScale = 1 + [0.12, 0.145, 0.17, 0.195, 0.22][mergeBurstStep];
        const mergeBurstShadowAlpha = [0.22, 0.26, 0.3, 0.34, 0.38][mergeBurstStep];
        const evervaultIntensity = isEvervaultSkin
          ? clamp(Math.log2(Math.max(1, displayValue)) / 15, 0, 1)
          : 0;
        const isMergeFlashing = isEvervaultSkin && mergeFlashTileIds?.has(tile.id);

        return (
          <div
            key={tile.id}
            data-tile-id={tile.id}
            data-revive-selectable={canSelectTiles ? 'true' : 'false'}
            data-revive-pending={isPendingTarget ? 'true' : 'false'}
            data-tile-distance={tile.distance}
            data-tile-kind="tile"
            data-premium-ui-allow-gradient={preserveAppearanceInWin98 ? 'true' : undefined}
            data-premium-ui-allow-shadow={preserveAppearanceInWin98 ? 'true' : undefined}
            className={`
              absolute ${isPremiumUiThemeActive ? '' : (isNeonBlock ? '' : 'rounded-xl')} ${isPremiumUiThemeActive ? premiumUiTileFaceClassName : ''} flex items-center justify-center
              font-semibold ${isNeonBlock ? '' : 'overflow-hidden'} text-center
              ${appearance.className}
              ${isNeonBlock ? 'skin-neon-block--board' : ''}
              ${canSelectTiles ? 'cursor-pointer ring-2 ring-transparent hover:ring-amber-200/70 focus-visible:ring-amber-300 focus-visible:outline-none active:brightness-95' : ''}
              ${isPendingTarget ? 'ring-amber-300 shadow-[0_0_0_3px_rgba(251,191,36,0.32)]' : ''}
            `}
            role={canSelectTiles ? 'button' : undefined}
            aria-label={canSelectTiles ? `${displayValue} 블럭 파괴 선택` : undefined}
            tabIndex={canSelectTiles ? 0 : -1}
            onPointerDown={canSelectTiles ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            } : undefined}
            onClick={canSelectTiles ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onReviveTileTap?.(tile.id);
            } : undefined}
            onKeyDown={canSelectTiles ? (e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              onReviveTileTap?.(tile.id);
            } : undefined}
            style={{
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              left: 0,
              top: 0,
              fontSize: `${fontPx}px`,
              lineHeight: 1,
              whiteSpace: 'pre-line',
              ...(appearance.style ?? {}),
              // 아래 속성들은 appearance.style보다 항상 우선
              transform,
              transition: duration
                ? `transform ${duration}ms ${tileTransitionEase}`
                : undefined,
              willChange: duration ? 'transform' : undefined,
            }}
          >
            <span className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`} style={{ position: 'relative', zIndex: 2 }}>
              <span
                className={isMergeNumberBursting ? 'tile-number-merge-burst' : ''}
                style={isMergeNumberBursting ? ({
                  ['--merge-burst-scale' as any]: mergeBurstScale.toFixed(3),
                  ['--merge-burst-shadow-alpha' as any]: mergeBurstShadowAlpha.toFixed(3),
                }) : undefined}
              >
                {text}
              </span>
            </span>
            {isEvervaultSkin && evervaultIntensity > 0.01 && (
              <EvervaultTileOverlay
                intensity={evervaultIntensity}
                sizePx={layout.cellPx}
                mergeFlash={!!isMergeFlashing}
                onFlashEnd={onMergeFlashEnd ? () => onMergeFlashEnd(tile.id) : undefined}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});

const ReviveDestroyLayer = React.memo<{
  effects: ReviveDestroyEffect[];
  layout: GridLayout;
  getResolvedAppearance: (value: number) => ResolvedTileAppearance;
  isPremiumUiThemeActive: boolean;
  premiumUiTileFaceClassName: string;
  premiumUiTileNumberClassName: string;
}>(({ effects, layout, getResolvedAppearance, isPremiumUiThemeActive, premiumUiTileFaceClassName, premiumUiTileNumberClassName }) => {
  if (effects.length === 0) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none">
      {effects.map((effect) => {
        const transform = `translate3d(${layout.posPx[effect.x]}px, ${layout.posPx[effect.y]}px, 0)`;
        const appearance = getResolvedAppearance(effect.value);
        const preserveAppearanceInWin98 = Boolean(appearance.style?.backgroundColor || appearance.style?.backgroundImage || appearance.style?.boxShadow);
        const isNeonBlock = appearance.className === 'skin-neon-block';
        const { text, fontPx } = getTileNumberLayout(effect.value, layout.cellPx);
        return (
          <div
            key={effect.id}
            className="absolute"
            style={{
              left: 0,
              top: 0,
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              transform,
            }}
          >
            <div
              className={`
                w-full h-full ${isPremiumUiThemeActive ? '' : (isNeonBlock ? '' : 'rounded-xl')} ${isPremiumUiThemeActive ? premiumUiTileFaceClassName : ''} flex items-center justify-center
                font-semibold ${isNeonBlock ? '' : 'overflow-hidden'} text-center
                ${appearance.className}
                ${isNeonBlock ? 'skin-neon-block--board' : ''}
              `}
              data-tile-kind="revive-effect"
              data-premium-ui-allow-gradient={preserveAppearanceInWin98 ? 'true' : undefined}
              data-premium-ui-allow-shadow={preserveAppearanceInWin98 ? 'true' : undefined}
              style={{
                fontSize: `${fontPx}px`,
                lineHeight: 1,
                whiteSpace: 'pre-line',
                animation: reviveDestroyAnimation,
                ...(appearance.style ?? {}),
              }}
            >
              <span className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}>{text}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
});

const GhostOverlay = React.memo<{
  size: number;
  layout: GridLayout;
  ghostCells: { cells: { x: number; y: number }[]; isValid: boolean };
  isPremiumUiThemeActive: boolean;
  premiumUiGhostValidClassName: string;
  premiumUiGhostInvalidClassName: string;
  isExploreGalaxySkin: boolean;
}>(({
  size,
  layout,
  ghostCells,
  isPremiumUiThemeActive,
  premiumUiGhostValidClassName,
  premiumUiGhostInvalidClassName,
  isExploreGalaxySkin,
}) => {
  if (ghostCells.cells.length === 0) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {ghostCells.cells.map((cell, idx) => {
        if (cell.x < 0 || cell.x >= size || cell.y < 0 || cell.y >= size) return null;
        const transform = `translate3d(${layout.posPx[cell.x]}px, ${layout.posPx[cell.y]}px, 0)`;
        const ghostClassName = isExploreGalaxySkin
          ? 'absolute rounded-xl opacity-100 border-2 box-border transition-colors duration-150'
          : `
              absolute ${isPremiumUiThemeActive ? '' : 'rounded-xl'} ${isPremiumUiThemeActive ? 'opacity-100' : 'opacity-70'} border-2 box-border
              transition-colors duration-150
              ${isPremiumUiThemeActive
                ? ghostCells.isValid
                  ? premiumUiGhostValidClassName
                  : premiumUiGhostInvalidClassName
                : ghostCells.isValid
                  ? 'bg-gray-800/50 border-gray-600'
                  : 'bg-red-400/50 border-red-300'}
            `;
        const ghostStyle = isExploreGalaxySkin
          ? ({
              backgroundColor: ghostCells.isValid ? '#e7ebf5' : '#f1d8df',
              borderColor: ghostCells.isValid ? '#b6bfd4' : '#cf95a5',
            } as React.CSSProperties)
          : undefined;

        return (
          <div
            key={`ghost-${idx}`}
            className={ghostClassName}
            style={{
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              left: 0,
              top: 0,
              transform,
              ...(ghostStyle ?? {}),
            }}
          />
        );
      })}
    </div>
  );
});

export const Board = React.memo(forwardRef<BoardHandle, BoardProps>(function Board({
  grid,
  activePiece,
  boardRef,
  phase,
  mergingTiles,
  valueOverrides,
  htmlId,
  boardScale,
  reviveSelectionEnabled = false,
  revivePendingTileId = null,
  onReviveTileTap,
  reviveDestroyEffects = EMPTY_REVIVE_DESTROY_EFFECTS,
  mergedNumberBurstTileIds,
  mergedNumberBurstByTileId,
}, ref) {
  const baseBoardPx = 420;
  const resolvedScale = boardScale ?? 1;
  const boardPx = Math.round(baseBoardPx * resolvedScale);
  const size = grid.length;
  const [layout, setLayout] = useState<GridLayout>(() => ({
    cellPx: 0,
    pitchPx: 0,
    posPx: Array.from({ length: size }, () => 0),
  }));
  const [hoverLocation, setHoverLocation] = useState<{ x: number; y: number } | null>(null);
  const hoverLocationRef = useRef<{ x: number; y: number } | null>(null);
  const pixelBlastLayerRef = useRef<HTMLDivElement | null>(null);
  const mergeRippleFingerprintRef = useRef<string>('');
  const pendingMergeRippleQueueRef = useRef<PendingMergeRipple[]>([]);
  const pendingMergeReplayRafRef = useRef<number | null>(null);
  const [pixelBlastRenderPhase, setPixelBlastRenderPhase] = useState<'unmounted' | 'active' | 'teardown'>('unmounted');
  const pixelBlastTeardownRafRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    setHoverLocation: (pos) => {
      const prev = hoverLocationRef.current;
      if (!prev && !pos) return;
      if (prev && pos && prev.x === pos.x && prev.y === pos.y) return;
      hoverLocationRef.current = pos;
      setHoverLocation(pos);
    }
  }), []);

  // Track previous positions of tiles for calculating animation distance
  const prevPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());

  // Track merging tiles with their CURRENT animated position and distance
  const [animatingMerges, setAnimatingMerges] = useState<(MergingTile & {
    currentX: number;
    currentY: number;
    distance: number;
  })[]>([]);

  // When new mergingTiles arrive, start animation sequence
  // useLayoutEffect: DOM에 시작 위치를 동기적으로 커밋 (paint 전)
  // single rAF: paint 후 도착 위치로 이동 → CSS transition 발동
  useLayoutEffect(() => {
    let rafId: number | null = null;

    if (mergingTiles.length > 0) {
      // Phase 1: Set tiles at their STARTING position (fromX, fromY)
      const startingTiles = mergingTiles.map(mt => {
        const distance = Math.abs(mt.toX - mt.fromX) + Math.abs(mt.toY - mt.fromY);
        return {
          ...mt,
          currentX: mt.fromX,
          currentY: mt.fromY,
          distance
        };
      });
      setAnimatingMerges(startingTiles);

      // Phase 2: single rAF로 1프레임 만에 transition 시작
      rafId = requestAnimationFrame(() => {
        setAnimatingMerges(prev => prev.map(mt => ({
          ...mt,
          currentX: mt.toX,
          currentY: mt.toY
        })));
      });
    } else {
      setAnimatingMerges([]);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [mergingTiles]);

  // ── Evervault skin: detect active skin & track merge flash ──
  const { activeSkin, isPremiumUiThemeActive, premiumUiObjects, resolveTileAppearance } = useBlockCustomization();
  const premiumUiBoardCellClassName = premiumUiObjects.extended.board.boardCellClassName;
  const premiumUiBoardShellClassName = premiumUiObjects.extended.board.boardShellClassName || premiumUiObjects.blockClassName;
  const premiumUiGhostValidClassName = premiumUiObjects.extended.board.ghostValidClassName;
  const premiumUiGhostInvalidClassName = premiumUiObjects.extended.board.ghostInvalidClassName;
  const premiumUiTileFaceClassName = premiumUiObjects.extended.text.tileFaceClassName;
  const premiumUiTileNumberClassName = premiumUiObjects.extended.text.tileNumberClassName;
  const isEvervaultSkin = activeSkin?.id === EVERVAULT_SKIN_ID;
  const isExploreGalaxySkin = activeSkin?.id === EXPLORE_GALAXY_SKIN_ID;
  const isPixelBlastSkin = activeSkin?.id === PIXELBLAST_VOID_SKIN_ID;

  const [mergeFlashTileIds, setMergeFlashTileIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (pixelBlastTeardownRafRef.current !== null) {
      cancelAnimationFrame(pixelBlastTeardownRafRef.current);
      pixelBlastTeardownRafRef.current = null;
    }

    if (isPixelBlastSkin) {
      setPixelBlastRenderPhase('active');
      return;
    }

    setPixelBlastRenderPhase((prev) => (prev === 'unmounted' ? prev : 'teardown'));
    pixelBlastTeardownRafRef.current = requestAnimationFrame(() => {
      pixelBlastTeardownRafRef.current = null;
      setPixelBlastRenderPhase((prev) => (prev === 'teardown' ? 'unmounted' : prev));
    });

    return () => {
      if (pixelBlastTeardownRafRef.current !== null) {
        cancelAnimationFrame(pixelBlastTeardownRafRef.current);
        pixelBlastTeardownRafRef.current = null;
      }
    };
  }, [isPixelBlastSkin]);

  const appearanceCacheRef = useRef(new Map<number, ResolvedTileAppearance>());
  const resolveTileAppearanceRef = useRef(resolveTileAppearance);
  useEffect(() => {
    resolveTileAppearanceRef.current = resolveTileAppearance;
    appearanceCacheRef.current.clear();
  }, [resolveTileAppearance]);
  const getResolvedAppearance = useCallback((value: number): ResolvedTileAppearance => {
    const cache = appearanceCacheRef.current;
    const cached = cache.get(value);
    if (cached) return cached;
    const resolved = resolveTileAppearanceRef.current(value);
    cache.set(value, resolved);
    return resolved;
  }, []);

  // When mergingTiles arrive, find the RECEIVING tiles at the destination
  useEffect(() => {
    if (!isEvervaultSkin || mergingTiles.length === 0) return;

    // Collect merge destination coordinates
    const destCoords = new Set(mergingTiles.map(mt => `${mt.toX},${mt.toY}`));

    // Find tile IDs at those positions in the grid
    const flashIds = new Set<string>();
    grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile && destCoords.has(`${x},${y}`)) {
          flashIds.add(tile.id);
        }
      });
    });

    if (flashIds.size > 0) {
      setMergeFlashTileIds(flashIds);
    }
  }, [isEvervaultSkin, mergingTiles, grid]);

  const handleMergeFlashEnd = useCallback((tileId: string) => {
    setMergeFlashTileIds(prev => {
      const next = new Set(prev);
      next.delete(tileId);
      return next;
    });
  }, []);

  const triggerMergeRipple = useCallback((targets: string[], fingerprint: string): boolean => {
    if (layout.cellPx <= 0 || layout.pitchPx <= 0) return false;
    const boardEl = boardRef.current;
    if (!boardEl) return false;
    const globalCanvas = Array.from(document.querySelectorAll('.pixelblast-global-background canvas'))
      .find((node): node is HTMLCanvasElement => node instanceof HTMLCanvasElement && node.isConnected);
    const fallbackCanvas = pixelBlastLayerRef.current?.querySelector('canvas');
    const canvasEl = globalCanvas instanceof HTMLCanvasElement
      ? globalCanvas
      : fallbackCanvas;
    if (!(canvasEl instanceof HTMLCanvasElement)) return false;

    const boardRect = boardEl.getBoundingClientRect();
    const styles = window.getComputedStyle(boardEl);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
    const borderTop = parseFloat(styles.borderTopWidth) || 0;
    const innerLeft = boardRect.left + borderLeft + paddingLeft;
    const innerTop = boardRect.top + borderTop + paddingTop;

    targets.forEach((target) => {
      const [xStr, yStr] = target.split(',');
      const x = Number(xStr);
      const y = Number(yStr);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const clientX = innerLeft + x * layout.pitchPx + layout.cellPx * 0.5;
      const clientY = innerTop + y * layout.pitchPx + layout.cellPx * 0.5;
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

      if (typeof window.PointerEvent === 'function') {
        canvasEl.dispatchEvent(new PointerEvent('pointerdown', {
          bubbles: false,
          cancelable: true,
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          clientX,
          clientY,
        }));
      } else {
        canvasEl.dispatchEvent(new MouseEvent('pointerdown', {
          bubbles: false,
          cancelable: true,
          button: 0,
          clientX,
          clientY,
        }));
      }
    });

    mergeRippleFingerprintRef.current = fingerprint;
    return true;
  }, [boardRef, layout.cellPx, layout.pitchPx]);

  const getPendingMergeNow = useCallback(() => (
    typeof performance !== 'undefined' ? performance.now() : Date.now()
  ), []);

  const prunePendingMergeQueue = useCallback((now: number) => {
    const queue = pendingMergeRippleQueueRef.current;
    if (queue.length === 0) return queue;
    const nextQueue = queue.filter((pending) => (
      now < pending.expiresAt && mergeRippleFingerprintRef.current !== pending.fingerprint
    ));
    if (nextQueue.length !== queue.length) {
      pendingMergeRippleQueueRef.current = nextQueue;
    }
    return pendingMergeRippleQueueRef.current;
  }, []);

  const enqueuePendingMergeRipple = useCallback((pending: PendingMergeRipple) => {
    if (mergeRippleFingerprintRef.current === pending.fingerprint) return;
    const now = getPendingMergeNow();
    const queue = prunePendingMergeQueue(now);
    if (queue.some((item) => item.fingerprint === pending.fingerprint)) return;
    const nextQueue = [...queue, pending];
    if (nextQueue.length > MAX_PENDING_MERGE_RIPPLES) {
      nextQueue.splice(0, nextQueue.length - MAX_PENDING_MERGE_RIPPLES);
    }
    pendingMergeRippleQueueRef.current = nextQueue;
  }, [getPendingMergeNow, prunePendingMergeQueue]);

  const schedulePendingMergeReplay = useCallback(() => {
    if (pendingMergeReplayRafRef.current !== null) return;

    const replay = () => {
      pendingMergeReplayRafRef.current = null;

      if (!isPixelBlastSkin) return;

      const now = getPendingMergeNow();
      const queue = prunePendingMergeQueue(now);
      if (queue.length === 0) return;
      const pending = queue[0];

      const replayed = triggerMergeRipple(pending.targets, pending.fingerprint);
      if (replayed) {
        pendingMergeRippleQueueRef.current = pendingMergeRippleQueueRef.current.slice(1);
      }

      const remainingQueue = prunePendingMergeQueue(getPendingMergeNow());
      if ((!replayed || remainingQueue.length > 0) && remainingQueue.length > 0) {
        pendingMergeReplayRafRef.current = requestAnimationFrame(replay);
      }
    };

    pendingMergeReplayRafRef.current = requestAnimationFrame(replay);
  }, [getPendingMergeNow, isPixelBlastSkin, prunePendingMergeQueue, triggerMergeRipple]);

  useEffect(() => {
    if (!isPixelBlastSkin || pendingMergeRippleQueueRef.current.length === 0) return;
    schedulePendingMergeReplay();
  }, [isPixelBlastSkin, layout.cellPx, layout.pitchPx, schedulePendingMergeReplay]);

  useEffect(() => {
    return () => {
      if (pendingMergeReplayRafRef.current !== null) {
        cancelAnimationFrame(pendingMergeReplayRafRef.current);
        pendingMergeReplayRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mergingTiles.length === 0) {
      mergeRippleFingerprintRef.current = '';
      const queue = prunePendingMergeQueue(getPendingMergeNow());
      if (queue.length > 0 && isPixelBlastSkin) {
        schedulePendingMergeReplay();
      } else if (pendingMergeReplayRafRef.current !== null) {
        cancelAnimationFrame(pendingMergeReplayRafRef.current);
        pendingMergeReplayRafRef.current = null;
      }
      return;
    }
    if (!isPixelBlastSkin) {
      mergeRippleFingerprintRef.current = '';
      pendingMergeRippleQueueRef.current = [];
      if (pendingMergeReplayRafRef.current !== null) {
        cancelAnimationFrame(pendingMergeReplayRafRef.current);
        pendingMergeReplayRafRef.current = null;
      }
      return;
    }
    const uniqueTargets = Array.from(
      new Set(mergingTiles.map((tile) => `${tile.toX},${tile.toY}`))
    ).sort();
    if (uniqueTargets.length === 0) return;

    const mergeEventUnits = mergingTiles
      .map((tile) => `${tile.id}@${tile.toX},${tile.toY}`)
      .sort();
    const fingerprint = mergeEventUnits.join('|');
    if (mergeRippleFingerprintRef.current === fingerprint) return;

    if (triggerMergeRipple(uniqueTargets, fingerprint)) return;

    enqueuePendingMergeRipple({
      fingerprint,
      targets: uniqueTargets,
      expiresAt: getPendingMergeNow() + PENDING_MERGE_RIPPLE_TTL_MS,
    });
    schedulePendingMergeReplay();
  }, [enqueuePendingMergeRipple, getPendingMergeNow, isPixelBlastSkin, mergingTiles, prunePendingMergeQueue, schedulePendingMergeReplay, triggerMergeRipple]);

  // 드래그가 끝나면(= activePiece가 없어지면) hover를 즉시 정리해서 불필요한 렌더를 줄임
  useEffect(() => {
    if (activePiece) return;
    hoverLocationRef.current = null;
    setHoverLocation(null);
  }, [activePiece]);

  // ResizeObserver: 보드의 실제 inner(content) 크기를 기반으로 px 레이아웃을 계산해
  // translate3d 애니메이션(컴포지터 레벨)을 사용하도록 함.
  useLayoutEffect(() => {
    const el = boardRef.current;
    if (!el) return;

    const updateLayout = () => {
      const rect = el.getBoundingClientRect();
      const styles = window.getComputedStyle(el);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingTop = parseFloat(styles.paddingTop) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const paddingBottom = parseFloat(styles.paddingBottom) || 0;
      const borderLeft = parseFloat(styles.borderLeftWidth) || 0;
      const borderTop = parseFloat(styles.borderTopWidth) || 0;
      const borderRight = parseFloat(styles.borderRightWidth) || 0;
      const borderBottom = parseFloat(styles.borderBottomWidth) || 0;

      const innerWidth = rect.width - borderLeft - borderRight - paddingLeft - paddingRight;
      const innerHeight = rect.height - borderTop - borderBottom - paddingTop - paddingBottom;
      const inner = Math.min(innerWidth, innerHeight);
      const totalGap = (size - 1) * BOARD_CELL_GAP_PX;
      const cellPx = (inner - totalGap) / size;
      const pitchPx = cellPx + BOARD_CELL_GAP_PX;
      const posPx = Array.from({ length: size }, (_, idx) => idx * pitchPx);

      const EPS = 0.01;
      setLayout((prev) => {
        if (
          prev.posPx.length === size &&
          Math.abs(prev.cellPx - cellPx) < EPS &&
          Math.abs(prev.pitchPx - pitchPx) < EPS
        ) {
          return prev;
        }
        return { cellPx, pitchPx, posPx };
      });
    };

    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);

    return () => observer.disconnect();
  }, [boardRef, size, boardPx]);

  // Extract tiles for rendering with distance calculation
  const { tiles: renderTiles, nextPositions } = useMemo(() => {
    const tiles: (Tile & { x: number; y: number; distance: number })[] = [];
    const nextPositions = new Map<string, { x: number; y: number }>();

    grid.forEach((row, y) => {
      row.forEach((tile, x) => {
        if (tile) {
          const prev = prevPositionsRef.current.get(tile.id);
          let distance = 0;

          if (prev) {
            // Calculate Manhattan distance from previous position
            distance = Math.abs(x - prev.x) + Math.abs(y - prev.y);
          }

          tiles.push({ ...tile, x, y, distance });
          nextPositions.set(tile.id, { x, y });
        }
      });
    });

    return { tiles, nextPositions };
  }, [grid]);

  // Commit next positions AFTER paint (StrictMode-safe)
  useLayoutEffect(() => {
    prevPositionsRef.current = nextPositions;
  }, [nextPositions]);

  // Calculate ghost overlay
  const ghostCells = useMemo(() => {
    if (!activePiece || !hoverLocation) return null;

    const { x, y } = hoverLocation;
    const isValid = canPlacePiece(grid, activePiece, x, y);

    return {
      cells: activePiece.cells.map(c => ({ x: x + c.x, y: y + c.y })),
      isValid
    };
  }, [grid, activePiece, hoverLocation]);

  // Phase별 보드 테두리 스타일
  const boardBorderStyle = isPremiumUiThemeActive
    ? ''
    : phase === Phase.SLIDE
      ? 'ring-1 ring-gray-400/50'
      : 'ring-1 ring-white/30';
  const premiumUiBoardPaddingClassName = isPremiumUiThemeActive
    ? premiumUiBoardShellClassName === 'win98-board-shell'
      ? 'p-2'
      : 'p-4'
    : 'p-3';
  const glowOpacityClass = isPremiumUiThemeActive || isExploreGalaxySkin ? 'opacity-0' : phase === Phase.SLIDE ? 'opacity-100' : 'opacity-0';

  return (
    <div
      ref={boardRef}
      id={htmlId}
        className={`
        relative ${premiumUiBoardPaddingClassName} ${isPremiumUiThemeActive ? premiumUiBoardShellClassName : ''}
        ${isPremiumUiThemeActive ? '' : 'bg-white/40'}
        ${isPremiumUiThemeActive ? '' : 'rounded-3xl'} select-none overflow-hidden
        shadow-lg transition-shadow duration-200 ease-out
        ${boardBorderStyle}
      `}
      style={{
        width: `${boardPx}px`,
        maxWidth: '100%',
        aspectRatio: '1 / 1',
      }}
    >
      {/* Phase glow */}
      <div
        className={`
          absolute inset-0 rounded-3xl pointer-events-none
          transition-opacity duration-200 ease-out
          ${glowOpacityClass}
        `}
        style={{
          boxShadow: '0 0 30px rgba(0,0,0,0.15)',
        }}
        aria-hidden="true"
      />
      {/* Container for content aiming to match padding-box area */}
      <div
        className={`relative w-full h-full ${isExploreGalaxySkin ? 'explore-galaxy-phase-sync' : ''}`}
      >
        <style>{`
          @keyframes reviveBreakFade {
            0% { opacity: 0.95; transform: scale(1); filter: saturate(1); }
            100% { opacity: 0; transform: scale(0.58); filter: saturate(0.8) blur(1px); }
          }
          @keyframes evervaultFlash {
            0% { opacity: 1; transform: scale(1); }
            40% { opacity: 0.8; transform: scale(1.02); }
            100% { opacity: 0; transform: scale(1); }
          }
        `}</style>

        {/* 1. Background Grid (Empty Slots) */}
        <BackgroundGrid
          size={size}
          layout={layout}
          isPremiumUiThemeActive={isPremiumUiThemeActive}
          premiumUiBoardCellClassName={premiumUiBoardCellClassName}
        />

        {pixelBlastRenderPhase !== 'unmounted' && (
          <div
            ref={pixelBlastLayerRef}
            className={`absolute inset-0 z-[1] pointer-events-none transition-opacity duration-150 ${isPixelBlastSkin ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden={!isPixelBlastSkin}
          >
            <Suspense fallback={null}>
              <PixelBlast
                variant="square"
                pixelSize={4}
                patternScale={4}
                patternDensity={0}
                pixelSizeJitter={0}
                speed={0.5}
                edgeFade={0.25}
                transparent
              />
            </Suspense>
          </div>
        )}

        {/* 2. Merging Tiles Layer (Absorbed tiles animating to merge destination) */}
        <MergingTilesLayer
          animatingMerges={animatingMerges}
          layout={layout}
          getResolvedAppearance={getResolvedAppearance}
          isPremiumUiThemeActive={isPremiumUiThemeActive}
          premiumUiTileFaceClassName={premiumUiTileFaceClassName}
          premiumUiTileNumberClassName={premiumUiTileNumberClassName}
        />

        {/* 3. Tiles Layer (Animated with uniform speed) */}
        <TilesLayer
          tiles={renderTiles}
          layout={layout}
          getResolvedAppearance={getResolvedAppearance}
          valueOverrides={valueOverrides}
          reviveSelectionEnabled={reviveSelectionEnabled}
          revivePendingTileId={revivePendingTileId}
          onReviveTileTap={onReviveTileTap}
          isEvervaultSkin={isEvervaultSkin}
          mergeFlashTileIds={mergeFlashTileIds}
          onMergeFlashEnd={handleMergeFlashEnd}
          mergedNumberBurstTileIds={mergedNumberBurstTileIds}
          mergedNumberBurstByTileId={mergedNumberBurstByTileId}
          isPremiumUiThemeActive={isPremiumUiThemeActive}
          premiumUiTileFaceClassName={premiumUiTileFaceClassName}
          premiumUiTileNumberClassName={premiumUiTileNumberClassName}
        />

        {/* 4. Revive Destroy FX */}
        <ReviveDestroyLayer
          effects={reviveDestroyEffects}
          layout={layout}
          getResolvedAppearance={getResolvedAppearance}
          isPremiumUiThemeActive={isPremiumUiThemeActive}
          premiumUiTileFaceClassName={premiumUiTileFaceClassName}
          premiumUiTileNumberClassName={premiumUiTileNumberClassName}
        />

        {/* 5. Ghost Overlay */}
        {ghostCells && (
          <GhostOverlay
            size={size}
            layout={layout}
            ghostCells={ghostCells}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            premiumUiGhostValidClassName={premiumUiGhostValidClassName}
            premiumUiGhostInvalidClassName={premiumUiGhostInvalidClassName}
            isExploreGalaxySkin={isExploreGalaxySkin}
          />
        )}
      </div>
    </div>
  );
}));
