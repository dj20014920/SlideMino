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
import { Grid, ObstacleState, Piece, Phase, Tile, MergingTile, PortalEndpoint, PortalState, PortalReleaseAnimation, ConcreteObstacle, ContainerObstacle, FrozenTileState } from '../types';
import { canPlacePieceWithObstacles } from '../services/obstacleEngine';
import { getTileColor, getTileNumberLayout, getSlideAnimationDurationMs, BOARD_CELL_GAP_PX } from '../constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import EvervaultTileOverlay from './EvervaultTileOverlay';
import {
  clamp,
  TILE_NUMBER_INHERIT_STYLE,
  TILE_PREMIUM_UI_PRESERVE_ATTRS,
  type ResolvedTileAppearance,
} from '../services/blockCustomization';

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
  readonly?: boolean;
  portalReleaseAnimations?: PortalReleaseAnimation[];
  reviveSelectionEnabled?: boolean;
  revivePendingTileId?: string | null;
  onReviveTileTap?: (tileId: string) => void;
  reviveDestroyEffects?: ReviveDestroyEffect[];
  mergedNumberBurstTileIds?: ReadonlySet<string>;
  mergedNumberBurstByTileId?: Readonly<Record<string, number>>;
  obstacleState?: ObstacleState;
}

const EMPTY_OBSTACLE_STATE: ObstacleState = {
  rulesVersion: 'obstacles_v1',
  cellObstacles: [],
  frozenTiles: [],
  portal: null,
  spawnMissStreak: 0,
};

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
  offsetX: number;
  offsetY: number;
};

const PENDING_MERGE_RIPPLE_TTL_MS = 4500;
const MAX_PENDING_MERGE_RIPPLES = 4;
const LAYOUT_CHANGE_EPS = 0.25;
const MAX_PIXELBLAST_MOBILE_RIPPLE_TARGETS = 2;
const MAX_PIXELBLAST_DESKTOP_RIPPLE_TARGETS = 6;

type PendingMergeRipple = {
  fingerprint: string;
  targets: string[];
  expiresAt: number;
};

const tileTransitionEase = 'cubic-bezier(0.25,0.1,0.25,1.0)';
const reviveDestroyAnimation = 'reviveBreakFade 220ms cubic-bezier(0.16, 1, 0.3, 1) forwards';
const EMPTY_REVIVE_DESTROY_EFFECTS: ReviveDestroyEffect[] = [];
const EMPTY_PORTAL_RELEASE_ANIMATIONS: PortalReleaseAnimation[] = [];

const isCoarsePointerDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return Boolean(window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);
};

const limitPixelBlastRippleTargets = (targets: string[], boardSize: number): string[] => {
  const limit = isCoarsePointerDevice()
    ? MAX_PIXELBLAST_MOBILE_RIPPLE_TARGETS
    : MAX_PIXELBLAST_DESKTOP_RIPPLE_TARGETS;
  if (targets.length <= limit) return targets;
  const center = (boardSize - 1) / 2;
  return targets
    .map((target) => {
      const [xStr, yStr] = target.split(',');
      const x = Number(xStr);
      const y = Number(yStr);
      const distanceFromCenter = Number.isFinite(x) && Number.isFinite(y)
        ? Math.abs(x - center) + Math.abs(y - center)
        : Number.POSITIVE_INFINITY;
      return { target, distanceFromCenter };
    })
    .sort((a, b) => a.distanceFromCenter - b.distanceFromCenter || a.target.localeCompare(b.target))
    .slice(0, limit)
    .map(({ target }) => target);
};

const buildPixelBlastMergeEdgeGlowStyle = (
  baseStyle?: React.CSSProperties
): React.CSSProperties => {
  const backgroundLayers = [
    'linear-gradient(180deg, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.2) 8%, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.01) 30%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.015) 72%, rgba(255,255,255,0.08) 84%, rgba(255,255,255,0.2) 94%, rgba(255,255,255,0.36) 100%)',
    'linear-gradient(90deg, rgba(255,255,255,0.44) 0%, rgba(255,255,255,0.2) 8%, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.01) 30%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.015) 72%, rgba(255,255,255,0.08) 84%, rgba(255,255,255,0.2) 94%, rgba(255,255,255,0.36) 100%)',
  ];
  if (typeof baseStyle?.backgroundImage === 'string' && baseStyle.backgroundImage !== 'none') {
    backgroundLayers.push(baseStyle.backgroundImage);
  }

  const boxShadowLayers = [
    typeof baseStyle?.boxShadow === 'string' ? baseStyle.boxShadow : '',
    'inset 0 0 0 1px rgba(248,245,255,0.28)',
    '0 0 10px rgba(184,163,255,0.12)',
  ].filter(Boolean);

  return {
    ...baseStyle,
    backgroundImage: backgroundLayers.join(', '),
    boxShadow: boxShadowLayers.join(', '),
    filter: 'brightness(1.16)',
  };
};



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
        const isNeonBlock = appearance.className === 'skin-neon-block';
        return (
          <div
            key={`merge-${mt.id}`}
            data-tile-id={mt.id}
            data-tile-distance={mt.distance}
            data-tile-kind="merge"
            {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
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
            <span
              className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}
              style={TILE_NUMBER_INHERIT_STYLE}
            >
              {text}
            </span>
          </div>
        );
      })}
    </div>
  );
});

const PortalReleaseLayer = React.memo<{
  releases: (PortalReleaseAnimation & { currentX: number; currentY: number; distance: number })[];
  layout: GridLayout;
  getResolvedAppearance: (value: number) => ResolvedTileAppearance;
  isPremiumUiThemeActive: boolean;
  premiumUiTileFaceClassName: string;
  premiumUiTileNumberClassName: string;
}>(({ releases, layout, getResolvedAppearance, isPremiumUiThemeActive, premiumUiTileFaceClassName, premiumUiTileNumberClassName }) => {
  if (releases.length === 0) return null;

  return (
    <div className="absolute inset-0 z-[18] pointer-events-none">
      {releases.map((release) => {
        const duration = getSlideAnimationDurationMs(release.distance);
        const transform = `translate3d(${layout.posPx[release.currentX]}px, ${layout.posPx[release.currentY]}px, 0)`;
        const { text, fontPx } = getTileNumberLayout(release.value, layout.cellPx);
        const appearance = getResolvedAppearance(release.value);
        const isNeonBlock = appearance.className === 'skin-neon-block';
        return (
          <div
            key={`portal-release-${release.id}`}
            data-tile-id={release.id}
            data-tile-kind="portal-release"
            data-tile-distance={release.distance}
            {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
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
              transform,
              transition: duration
                ? `transform ${duration}ms ${tileTransitionEase}`
                : undefined,
              willChange: duration ? 'transform' : undefined,
            }}
          >
            <span
              className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}
              style={TILE_NUMBER_INHERIT_STYLE}
            >
              {text}
            </span>
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
  isPixelBlastSkin?: boolean;
  mergeFlashTileIds?: ReadonlySet<string>;
  onMergeFlashEnd?: (tileId: string) => void;
  mergedNumberBurstTileIds?: ReadonlySet<string>;
  mergedNumberBurstByTileId?: Readonly<Record<string, number>>;
  isPremiumUiThemeActive?: boolean;
  premiumUiTileFaceClassName: string;
  premiumUiTileNumberClassName: string;
  hiddenTileIds?: ReadonlySet<string>;
}>(({
  tiles,
  layout,
  getResolvedAppearance,
  valueOverrides,
  reviveSelectionEnabled = false,
  revivePendingTileId = null,
  onReviveTileTap,
  isEvervaultSkin = false,
  isPixelBlastSkin = false,
  mergeFlashTileIds,
  onMergeFlashEnd,
  mergedNumberBurstTileIds,
  mergedNumberBurstByTileId,
  isPremiumUiThemeActive = false,
  premiumUiTileFaceClassName,
  premiumUiTileNumberClassName,
  hiddenTileIds,
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
        if (hiddenTileIds?.has(tile.id)) {
          return (
            <div
              key={tile.id}
              data-tile-id={tile.id}
              data-tile-kind="tile-hidden"
              style={{
                width: `${layout.cellPx}px`,
                height: `${layout.cellPx}px`,
                left: 0,
                top: 0,
                visibility: 'hidden',
                position: 'absolute',
              }}
            />
          );
        }
        const duration = getSlideAnimationDurationMs(tile.distance);
        const displayValue = valueOverrides?.[tile.id] ?? tile.value;
        const transform = `translate3d(${layout.posPx[tile.x]}px, ${layout.posPx[tile.y]}px, 0)`;
        const { text, fontPx } = getTileNumberLayout(displayValue, layout.cellPx);
        const appearance = getResolvedAppearance(displayValue);
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
        const isMergeFlashing = !!mergeFlashTileIds?.has(tile.id);
        const tileAppearanceStyle = isPixelBlastSkin && isMergeFlashing
          ? buildPixelBlastMergeEdgeGlowStyle(appearance.style)
          : (appearance.style ?? {});

        return (
          <div
            key={tile.id}
            data-tile-id={tile.id}
            data-revive-selectable={canSelectTiles ? 'true' : 'false'}
            data-revive-pending={isPendingTarget ? 'true' : 'false'}
            data-tile-distance={tile.distance}
            data-tile-kind="tile"
            {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
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
              ...tileAppearanceStyle,
              // 아래 속성들은 appearance.style보다 항상 우선
              transform,
              transition: duration
                ? `transform ${duration}ms ${tileTransitionEase}`
                : undefined,
              willChange: duration ? 'transform' : undefined,
            }}
          >
            <span
              className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}
              style={{ ...TILE_NUMBER_INHERIT_STYLE, position: 'relative', zIndex: 2 }}
            >
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
                mergeFlash={isMergeFlashing}
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
              {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
              style={{
                fontSize: `${fontPx}px`,
                lineHeight: 1,
                whiteSpace: 'pre-line',
                animation: reviveDestroyAnimation,
                ...(appearance.style ?? {}),
              }}
            >
              <span
                className={`${isPremiumUiThemeActive ? premiumUiTileNumberClassName : ''} ${isNeonBlock ? 'skin-neon-block-number' : ''}`}
                style={TILE_NUMBER_INHERIT_STYLE}
              >
                {text}
              </span>
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
  useGalaxyGhostStyle: boolean;
  galaxyGhostValidStyle?: React.CSSProperties;
  galaxyGhostInvalidStyle?: React.CSSProperties;
}>(({
  size,
  layout,
  ghostCells,
  isPremiumUiThemeActive,
  premiumUiGhostValidClassName,
  premiumUiGhostInvalidClassName,
  useGalaxyGhostStyle,
  galaxyGhostValidStyle,
  galaxyGhostInvalidStyle,
}) => {
  if (ghostCells.cells.length === 0) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {ghostCells.cells.map((cell, idx) => {
        if (cell.x < 0 || cell.x >= size || cell.y < 0 || cell.y >= size) return null;
        const transform = `translate3d(${layout.posPx[cell.x]}px, ${layout.posPx[cell.y]}px, 0)`;
        const ghostClassName = useGalaxyGhostStyle
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
        const ghostStyle = useGalaxyGhostStyle
          ? ({
              ...(ghostCells.isValid ? galaxyGhostValidStyle : galaxyGhostInvalidStyle),
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

const CONTAINER_ARROW_BY_DIRECTION: Record<string, string> = {
  UP: '↑',
  RIGHT: '→',
  DOWN: '↓',
  LEFT: '←',
};



const getPortalEntryKey = (kind: 'in' | 'out', endpoint: PortalEndpoint): string =>
  `portal-${kind}-${endpoint.side}-${endpoint.index}`;

const getObstacleVisualKeys = (state: ObstacleState): Set<string> => {
  const keys = new Set<string>();
  for (const obstacle of state.cellObstacles) keys.add(`cell-${obstacle.id}`);
  for (const frozen of state.frozenTiles) keys.add(`ice-${frozen.tileId}`);
  if (state.portal) {
    keys.add(getPortalEntryKey('in', state.portal.in));
    keys.add(getPortalEntryKey('out', state.portal.out));
  }
  return keys;
};

const getPortalMarkerStyle = (
  endpoint: PortalEndpoint,
  layout: GridLayout,
  size: number
): React.CSSProperties => {
  const markerSize = Math.max(22, layout.cellPx * 0.50);
  const outsideGap = Math.max(4, layout.cellPx * 0.12);
  let x = 0;
  let y = 0;

  if (endpoint.side === 'LEFT') {
    x = -markerSize - outsideGap;
    y = layout.posPx[endpoint.index] + (layout.cellPx - markerSize) / 2;
  } else if (endpoint.side === 'RIGHT') {
    x = layout.posPx[size - 1] + layout.cellPx + outsideGap;
    y = layout.posPx[endpoint.index] + (layout.cellPx - markerSize) / 2;
  } else if (endpoint.side === 'TOP') {
    x = layout.posPx[endpoint.index] + (layout.cellPx - markerSize) / 2;
    y = -markerSize - outsideGap;
  } else {
    x = layout.posPx[endpoint.index] + (layout.cellPx - markerSize) / 2;
    y = layout.posPx[size - 1] + layout.cellPx + outsideGap;
  }

  return {
    width: `${markerSize}px`,
    height: `${markerSize}px`,
    transform: `translate3d(${x}px, ${y}px, 0)`,
  };
};

const PortalMarkers = React.memo<{
  portal: PortalState;
  gridSize: number;
  layout: GridLayout;
  impactKeys: ReadonlySet<string>;
}>(({
  portal,
  gridSize,
  layout,
  impactKeys,
}) => {
  const inEntering = impactKeys.has(getPortalEntryKey('in', portal.in));
  const outEntering = impactKeys.has(getPortalEntryKey('out', portal.out));

  return (
    <>
      <div
        className="absolute"
        style={{ left: 0, top: 0, ...getPortalMarkerStyle(portal.in, layout, gridSize) }}
      >
        <div
          data-tile-kind="obstacle"
          data-obstacle-kind="portal-in"
          {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
          className={`relative flex h-full w-full items-center justify-center rounded-full border-2 border-sky-200 bg-sky-500 text-white shadow-[0_0_18px_rgba(14,165,233,0.48)] text-[11px] font-black ${inEntering ? 'obstacle-drop-impact' : ''}`}
        >
          {inEntering && (
            <span className="obstacle-impact-ring absolute inset-[-7px] rounded-full border-2 border-sky-100/85" />
          )}
          <span className="relative z-10 flex flex-col items-center leading-none">
            <span>IN</span>
            <span className="text-[10px]">▼</span>
          </span>
        </div>
      </div>
      <div
        className="absolute"
        style={{ left: 0, top: 0, ...getPortalMarkerStyle(portal.out, layout, gridSize) }}
      >
        <div
          data-tile-kind="obstacle"
          data-obstacle-kind="portal-out"
          {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
          className={`relative flex h-full w-full items-center justify-center rounded-full border-2 border-amber-200 bg-amber-500 text-white shadow-[0_0_18px_rgba(245,158,11,0.48)] text-[11px] font-black ${outEntering ? 'obstacle-drop-impact' : ''}`}
        >
          {outEntering && (
            <span className="obstacle-impact-ring absolute inset-[-7px] rounded-full border-2 border-amber-100/85" />
          )}
          <span className="relative z-10 flex flex-col items-center leading-none">
            <span>OUT</span>
            <span className="text-[10px]">▲</span>
          </span>
          {portal.queue.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
              {portal.queue.length}
            </span>
          )}
        </div>
      </div>
    </>
  );
});

const LockIcon = React.memo(({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <circle cx="12" cy="16" r="1.2" fill="white" stroke="none" />
    <line x1="12" y1="17.5" x2="12" y2="19.5" stroke="white" strokeWidth="2" />
  </svg>
));

const ShieldIcon = React.memo(({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" strokeWidth="2.5" />
  </svg>
));

/** obstacle 진입 애니메이션 지속시간 (CSS @keyframes와 일치해야 함) */
const OBSTACLE_IMPACT_ANIMATION_MS = 560;
/** CSS 애니메이션 종료 후 impactKeys를 유지하는 버퍼. 애니메이션이 완전히 끝난 후에 클리어 */
const OBSTACLE_IMPACT_BUFFER_MS = 120;
/** impactKeys 초기화 타이머 = 애니메이션 + 버퍼 */
const OBSTACLE_IMPACT_CLEAR_MS = OBSTACLE_IMPACT_ANIMATION_MS + OBSTACLE_IMPACT_BUFFER_MS;

const ConcreteObstacleCell = React.memo<{
  obstacle: ConcreteObstacle;
  layout: GridLayout;
  isEntering: boolean;
}>(({ obstacle, layout, isEntering }) => {
  const hpSize = Math.max(18, layout.cellPx * 0.35);
  const hpBgColor = obstacle.hp >= 3 ? 'bg-slate-800' : obstacle.hp === 2 ? 'bg-slate-600' : 'bg-slate-500';
  const hpBorderColor = obstacle.hp <= 1 ? 'border-red-400/80' : obstacle.hp === 2 ? 'border-slate-300/50' : 'border-slate-400/60';
  return (
    <div
      data-tile-kind="obstacle"
      data-obstacle-kind="concrete"
      {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
      className={`relative flex h-full w-full items-center justify-center rounded-xl border-2 ${hpBorderColor} ${hpBgColor} shadow-[inset_0_2px_0_rgba(255,255,255,0.12),0_6px_14px_rgba(15,23,42,0.35)] ${
        isEntering ? 'obstacle-drop-impact' : ''
      }`}
    >
      {isEntering && (
        <span className="obstacle-impact-ring absolute inset-[-7px] rounded-2xl border-2 border-white/80" />
      )}
      <span className="font-black text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] flex items-center gap-1" style={{ fontSize: `${hpSize}px` }}>
        <ShieldIcon size={hpSize * 0.8} />
        {obstacle.hp}
      </span>
    </div>
  );
});

const PercentObstacleCell = React.memo<{
  layout: GridLayout;
  isEntering: boolean;
}>(({ layout, isEntering }) => {
  const pctSize = Math.max(18, layout.cellPx * 0.35);
  return (
    <div
      data-tile-kind="obstacle"
      data-obstacle-kind="percent"
      {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
      className={`relative flex h-full w-full items-center justify-center rounded-xl border-2 border-rose-300/70 bg-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.35)] ${
        isEntering ? 'obstacle-drop-impact' : ''
      }`}
    >
      {isEntering && (
        <span className="obstacle-impact-ring absolute inset-[-7px] rounded-2xl border-2 border-white/80" />
      )}
      <span className="font-black text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.4)]" style={{ fontSize: `${pctSize}px` }}>
        ÷2
      </span>
    </div>
  );
});

const ContainerObstacleCell = React.memo<{
  obstacle: ContainerObstacle;
  layout: GridLayout;
  isEntering: boolean;
}>(({ obstacle, layout, isEntering }) => {
  const arrowSize = Math.max(20, layout.cellPx * 0.4);
  const arrow = CONTAINER_ARROW_BY_DIRECTION[obstacle.direction] ?? '?';
  return (
    <div
      data-tile-kind="obstacle"
      data-obstacle-kind="container"
      {...TILE_PREMIUM_UI_PRESERVE_ATTRS}
      className={`relative flex h-full w-full items-center justify-center rounded-xl border-2 border-emerald-300/60 bg-emerald-600 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.1),0_6px_14px_rgba(4,120,87,0.3)] ${
        isEntering ? 'obstacle-drop-impact' : ''
      }`}
    >
      {isEntering && (
        <span className="obstacle-impact-ring absolute inset-[-7px] rounded-2xl border-2 border-white/80" />
      )}
      <span className="font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" style={{ fontSize: `${arrowSize}px` }}>
        {arrow}
      </span>
    </div>
  );
});

const FrozenTileOverlay = React.memo<{
  frozen: FrozenTileState;
  pos: { x: number; y: number };
  layout: GridLayout;
  isEntering: boolean;
}>(({ frozen, pos, layout, isEntering }) => {
  const lockSize = Math.max(14, layout.cellPx * 0.35);
  const countSize = Math.max(12, layout.cellPx * 0.18);
  return (
    <div className="absolute rounded-xl" style={{ left: 0, top: 0, width: `${layout.cellPx}px`, height: `${layout.cellPx}px`, transform: `translate3d(${layout.posPx[pos.x]}px, ${layout.posPx[pos.y]}px, 0)`, boxShadow: 'inset 0 0 12px rgba(255,255,255,0.25), 0 0 8px rgba(56,189,248,0.2)' }}>
      <div className="absolute inset-0 rounded-xl bg-sky-950/35 z-10" />
      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-1">
        <LockIcon size={lockSize} />
        <span className="font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)]" style={{ fontSize: `${countSize}px`, lineHeight: 1 }}>
          {frozen.remainingSwipes}
        </span>
      </div>
      {isEntering && (
        <span className="obstacle-impact-ring absolute inset-[-7px] rounded-2xl border-2 border-white/60 z-30" />
      )}
    </div>
  );
});

const ObstacleLayer = React.memo<{
  grid: Grid;
  obstacleState: ObstacleState;
  layout: GridLayout;
}>(({
  grid,
  obstacleState,
  layout,
}) => {
  const [impactKeys, setImpactKeys] = useState<Set<string>>(() => new Set());
  const previousVisualKeysRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    const currentKeys = getObstacleVisualKeys(obstacleState);
    const previousKeys = previousVisualKeysRef.current;
    previousVisualKeysRef.current = currentKeys;

    if (!previousKeys) return;

    const enteringKeys = [...currentKeys].filter((key) => !previousKeys.has(key));
    if (enteringKeys.length === 0) return;

    setImpactKeys(new Set(enteringKeys));
    const timer = window.setTimeout(() => {
      setImpactKeys(new Set());
    }, OBSTACLE_IMPACT_CLEAR_MS);
    return () => window.clearTimeout(timer);
  }, [obstacleState]);

  if (layout.cellPx <= 0) return null;

  const frozenPositions = new Map<string, { x: number; y: number }>();
  grid.forEach((row, y) => {
    row.forEach((tile, x) => {
      if (tile) frozenPositions.set(tile.id, { x, y });
    });
  });

  return (
    <div className="absolute inset-0 z-[25] pointer-events-none overflow-visible" aria-hidden="true">
      {obstacleState.cellObstacles.map((obstacle) => {
        const transform = `translate3d(${layout.posPx[obstacle.x]}px, ${layout.posPx[obstacle.y]}px, 0)`;
        const entryKey = `cell-${obstacle.id}`;
        const isEntering = impactKeys.has(entryKey);

        return (
          <div key={obstacle.id} className="absolute" style={{ left: 0, top: 0, width: `${layout.cellPx}px`, height: `${layout.cellPx}px`, transform }}>
            {obstacle.kind === 'concrete' ? (
              <ConcreteObstacleCell obstacle={obstacle} layout={layout} isEntering={isEntering} />
            ) : obstacle.kind === 'percent' ? (
              <PercentObstacleCell layout={layout} isEntering={isEntering} />
            ) : (
              <ContainerObstacleCell obstacle={obstacle} layout={layout} isEntering={isEntering} />
            )}
          </div>
        );
      })}

      {obstacleState.frozenTiles.map((frozen) => {
        const pos = frozenPositions.get(frozen.tileId);
        if (!pos) return null;
        const entryKey = `ice-${frozen.tileId}`;
        const isEntering = impactKeys.has(entryKey);
        return (
          <FrozenTileOverlay key={`ice-${frozen.tileId}`} frozen={frozen} pos={pos} layout={layout} isEntering={isEntering} />
        );
      })}

      {obstacleState.portal && (
        <PortalMarkers
          portal={obstacleState.portal}
          gridSize={grid.length}
          layout={layout}
          impactKeys={impactKeys}
        />
      )}
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
  readonly = false,
  portalReleaseAnimations = EMPTY_PORTAL_RELEASE_ANIMATIONS,
  reviveSelectionEnabled = false,
  revivePendingTileId = null,
  onReviveTileTap,
  reviveDestroyEffects = EMPTY_REVIVE_DESTROY_EFFECTS,
  mergedNumberBurstTileIds,
  mergedNumberBurstByTileId,
  obstacleState = EMPTY_OBSTACLE_STATE,
}, ref) {
  const baseBoardPx = 420;
  const resolvedScale = boardScale ?? 1;
  const boardPx = Math.round(baseBoardPx * resolvedScale);
  const size = grid.length;
  const [layout, setLayout] = useState<GridLayout>(() => ({
    cellPx: 0,
    pitchPx: 0,
    posPx: Array.from({ length: size }, () => 0),
    offsetX: 0,
    offsetY: 0,
  }));
  const [hoverLocation, setHoverLocation] = useState<{ x: number; y: number } | null>(null);
  const hoverLocationRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Board coordinate contract
   *
   * - `boardRef` / `#game-board` is the decorative shell. Skins may change its padding,
   *   border, shadow, glow, background, or rounded-corner treatment.
   * - `gridViewportRef` is the single gameplay coordinate system. Cells, tiles, ghost
   *   overlays, drag hit-tests, and board-local FX all use this box.
   * - New skins/effects should not measure the shell and subtract CSS padding/borders.
   *   That was the old fragile path: theme changes and async ad/layout shifts could make
   *   the grid appear too small or misaligned.
   * - If an effect needs a cell center in client coordinates, use:
   *   `gridViewport.getBoundingClientRect()` + `layout.offset*` + `layout.pitchPx`.
   *
   * Longer guide: GAME_BOARD_LAYOUT_CONTRACT.md
   */
  const gridViewportRef = useRef<HTMLDivElement | null>(null);
  const pixelBlastLayerRef = useRef<HTMLDivElement | null>(null);
  const mergeRippleFingerprintRef = useRef<string>('');
  const pendingMergeRippleQueueRef = useRef<PendingMergeRipple[]>([]);
  const pendingMergeReplayRafRef = useRef<number | null>(null);
  const mergeRippleDelayTimeoutRef = useRef<number | null>(null);
  const scheduledMergeRippleFingerprintRef = useRef<string>('');
  const pixelBlastMergeFlashTimeoutRef = useRef<number | null>(null);
  const [shouldRenderPixelBlastFallback, setShouldRenderPixelBlastFallback] = useState(false);

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
  const [animatingPortalReleases, setAnimatingPortalReleases] = useState<(PortalReleaseAnimation & {
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

  useLayoutEffect(() => {
    let rafId: number | null = null;

    if (portalReleaseAnimations.length > 0) {
      const startingReleases = portalReleaseAnimations.map((release) => {
        const distance = Math.abs(release.toX - release.fromX) + Math.abs(release.toY - release.fromY);
        return {
          ...release,
          currentX: release.fromX,
          currentY: release.fromY,
          distance,
        };
      });
      setAnimatingPortalReleases(startingReleases);

      rafId = requestAnimationFrame(() => {
        setAnimatingPortalReleases((prev) => prev.map((release) => ({
          ...release,
          currentX: release.toX,
          currentY: release.toY,
        })));
      });
    } else {
      setAnimatingPortalReleases([]);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [portalReleaseAnimations]);

  // ── Evervault skin: detect active skin & track merge flash ──
  const { activeSkin, isPremiumUiThemeActive, premiumUiObjects, resolveTileAppearance, premiumSkinRuntime } = useBlockCustomization();
  const premiumUiBoardCellClassName = premiumUiObjects.extended.board.boardCellClassName;
  const premiumUiBoardShellClassName = premiumUiObjects.extended.board.boardShellClassName || premiumUiObjects.blockClassName;
  const premiumUiGhostValidClassName = premiumUiObjects.extended.board.ghostValidClassName;
  const premiumUiGhostInvalidClassName = premiumUiObjects.extended.board.ghostInvalidClassName;
  const premiumUiTileFaceClassName = premiumUiObjects.extended.text.tileFaceClassName;
  const premiumUiTileNumberClassName = premiumUiObjects.extended.text.tileNumberClassName;
  const isEvervaultSkin = activeSkin?.id === EVERVAULT_SKIN_ID;
  const isPixelBlastSkin = premiumSkinRuntime.board.features.enablePixelBlastFallback;
  const isPixelBlastMergeRippleEnabled = premiumSkinRuntime.board.features.enablePixelBlastMergeRipple;
  const useGalaxyGhostStyle = premiumSkinRuntime.board.features.useGalaxyGhostStyle;
  const useGalaxyPhaseSyncClass = premiumSkinRuntime.board.features.enableGalaxyPhaseSyncClass;
  const galaxyGhostValidStyle = premiumSkinRuntime.board.ghost.validStyle;
  const galaxyGhostInvalidStyle = premiumSkinRuntime.board.ghost.invalidStyle;

  const [mergeFlashTileIds, setMergeFlashTileIds] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!isPixelBlastSkin || typeof document === 'undefined') {
      setShouldRenderPixelBlastFallback(false);
      return;
    }

    const hasGlobalPixelBlastSurface = () => Boolean(document.querySelector('.pixelblast-global-background'));
    const hasGlobalPixelBlastCanvas = () => Boolean(document.querySelector('.pixelblast-global-background canvas'));
    const syncFallbackVisibility = () => {
      setShouldRenderPixelBlastFallback(!hasGlobalPixelBlastSurface() && !hasGlobalPixelBlastCanvas());
    };

    syncFallbackVisibility();
    if (hasGlobalPixelBlastSurface() || hasGlobalPixelBlastCanvas()) return;

    const observer = new MutationObserver(() => {
      syncFallbackVisibility();
      if (hasGlobalPixelBlastSurface() || hasGlobalPixelBlastCanvas()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
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
    if ((!isEvervaultSkin && !isPixelBlastSkin) || mergingTiles.length === 0) return;

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
  }, [isEvervaultSkin, isPixelBlastSkin, mergingTiles, grid]);

  useEffect(() => {
    if (!isPixelBlastSkin || mergeFlashTileIds.size === 0) return;
    if (pixelBlastMergeFlashTimeoutRef.current !== null) {
      window.clearTimeout(pixelBlastMergeFlashTimeoutRef.current);
    }
    pixelBlastMergeFlashTimeoutRef.current = window.setTimeout(() => {
      setMergeFlashTileIds(new Set());
      pixelBlastMergeFlashTimeoutRef.current = null;
    }, 180);
    return () => {
      if (pixelBlastMergeFlashTimeoutRef.current !== null) {
        window.clearTimeout(pixelBlastMergeFlashTimeoutRef.current);
        pixelBlastMergeFlashTimeoutRef.current = null;
      }
    };
  }, [isPixelBlastSkin, mergeFlashTileIds]);

  const handleMergeFlashEnd = useCallback((tileId: string) => {
    setMergeFlashTileIds(prev => {
      const next = new Set(prev);
      next.delete(tileId);
      return next;
    });
  }, []);

  const triggerMergeRipple = useCallback((targets: string[], fingerprint: string): boolean => {
    if (layout.cellPx <= 0 || layout.pitchPx <= 0) return false;
    const gridViewportEl = gridViewportRef.current;
    if (!gridViewportEl) return false;
    const globalCanvas = Array.from(document.querySelectorAll('.pixelblast-global-background canvas'))
      .find((node): node is HTMLCanvasElement => node instanceof HTMLCanvasElement && node.isConnected);
    const fallbackCanvas = pixelBlastLayerRef.current?.querySelector('canvas');
    const canvasEl = globalCanvas instanceof HTMLCanvasElement
      ? globalCanvas
      : fallbackCanvas;
    if (!(canvasEl instanceof HTMLCanvasElement)) return false;

    const viewportRect = gridViewportEl.getBoundingClientRect();

    targets.forEach((target) => {
      const [xStr, yStr] = target.split(',');
      const x = Number(xStr);
      const y = Number(yStr);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return;
      const clientX = viewportRect.left + layout.offsetX + x * layout.pitchPx + layout.cellPx * 0.5;
      const clientY = viewportRect.top + layout.offsetY + y * layout.pitchPx + layout.cellPx * 0.5;
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
  }, [layout.cellPx, layout.offsetX, layout.offsetY, layout.pitchPx]);

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

      if (!isPixelBlastMergeRippleEnabled) return;

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
  }, [getPendingMergeNow, isPixelBlastMergeRippleEnabled, prunePendingMergeQueue, triggerMergeRipple]);

  useEffect(() => {
    if (!isPixelBlastMergeRippleEnabled || pendingMergeRippleQueueRef.current.length === 0) return;
    schedulePendingMergeReplay();
  }, [isPixelBlastMergeRippleEnabled, layout.cellPx, layout.pitchPx, schedulePendingMergeReplay]);

  useEffect(() => {
    return () => {
      if (mergeRippleDelayTimeoutRef.current !== null) {
        window.clearTimeout(mergeRippleDelayTimeoutRef.current);
        mergeRippleDelayTimeoutRef.current = null;
      }
      if (pixelBlastMergeFlashTimeoutRef.current !== null) {
        window.clearTimeout(pixelBlastMergeFlashTimeoutRef.current);
        pixelBlastMergeFlashTimeoutRef.current = null;
      }
      if (pendingMergeReplayRafRef.current !== null) {
        cancelAnimationFrame(pendingMergeReplayRafRef.current);
        pendingMergeReplayRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (mergingTiles.length === 0) {
      if (mergeRippleDelayTimeoutRef.current === null) {
        mergeRippleFingerprintRef.current = '';
      }
      const queue = prunePendingMergeQueue(getPendingMergeNow());
      if (queue.length > 0 && isPixelBlastMergeRippleEnabled) {
        schedulePendingMergeReplay();
      } else if (pendingMergeReplayRafRef.current !== null) {
        cancelAnimationFrame(pendingMergeReplayRafRef.current);
        pendingMergeReplayRafRef.current = null;
      }
      return;
    }
    if (!isPixelBlastMergeRippleEnabled) {
      if (mergeRippleDelayTimeoutRef.current !== null) {
        window.clearTimeout(mergeRippleDelayTimeoutRef.current);
        mergeRippleDelayTimeoutRef.current = null;
      }
      mergeRippleFingerprintRef.current = '';
      scheduledMergeRippleFingerprintRef.current = '';
      pendingMergeRippleQueueRef.current = [];
      if (pendingMergeReplayRafRef.current !== null) {
        cancelAnimationFrame(pendingMergeReplayRafRef.current);
        pendingMergeReplayRafRef.current = null;
      }
      return;
    }
    const uniqueTargets = limitPixelBlastRippleTargets(Array.from(
      new Set(mergingTiles.map((tile) => `${tile.toX},${tile.toY}`))
    ).sort(), size);
    if (uniqueTargets.length === 0) return;

    const mergeEventUnits = mergingTiles
      .map((tile) => `${tile.id}@${tile.toX},${tile.toY}`)
      .sort();
    const fingerprint = mergeEventUnits.join('|');
    if (
      mergeRippleFingerprintRef.current === fingerprint ||
      scheduledMergeRippleFingerprintRef.current === fingerprint
    ) {
      return;
    }

    const rippleDelayMs = Math.max(
      0,
      ...mergingTiles.map((tile) => getSlideAnimationDurationMs(
        Math.abs(tile.toX - tile.fromX) + Math.abs(tile.toY - tile.fromY)
      ))
    );

    if (mergeRippleDelayTimeoutRef.current !== null) {
      window.clearTimeout(mergeRippleDelayTimeoutRef.current);
      mergeRippleDelayTimeoutRef.current = null;
    }

    scheduledMergeRippleFingerprintRef.current = fingerprint;
    mergeRippleDelayTimeoutRef.current = window.setTimeout(() => {
      mergeRippleDelayTimeoutRef.current = null;
      scheduledMergeRippleFingerprintRef.current = '';

      if (triggerMergeRipple(uniqueTargets, fingerprint)) return;

      enqueuePendingMergeRipple({
        fingerprint,
        targets: uniqueTargets,
        expiresAt: getPendingMergeNow() + PENDING_MERGE_RIPPLE_TTL_MS,
      });
      schedulePendingMergeReplay();
    }, rippleDelayMs);
  }, [enqueuePendingMergeRipple, getPendingMergeNow, isPixelBlastMergeRippleEnabled, mergingTiles, prunePendingMergeQueue, schedulePendingMergeReplay, size, triggerMergeRipple]);

  // 드래그가 끝나면(= activePiece가 없어지면) hover를 즉시 정리해서 불필요한 렌더를 줄임
  useEffect(() => {
    if (activePiece) return;
    hoverLocationRef.current = null;
    setHoverLocation(null);
  }, [activePiece]);

  const premiumUiBoardPaddingClassName = isPremiumUiThemeActive
    ? premiumUiBoardShellClassName === 'win98-board-shell'
      ? 'p-2'
      : 'p-4'
    : 'p-3';

  // 보드 셸/스킨 장식이 아니라 실제 게임 좌표계 viewport만 측정한다.
  //
  // ResizeObserver는 viewport box 자체의 크기 변화만 구독한다. 스킨이 셸의 padding,
  // border, shadow, background를 바꾸더라도 gameplay math는 이 viewport 안에서만 닫혀
  // 있어야 한다. 그래서 여기에는 theme class MutationObserver, 지연 timer, root padding
  // 보정 같은 보완 로직을 넣지 않는다. 그런 로직이 필요해 보이면 먼저 스킨이
  // grid viewport 계약을 깨고 있는지 확인한다.
  useLayoutEffect(() => {
    const el = gridViewportRef.current;
    if (!el) return;

    const updateLayout = () => {
      const rect = el.getBoundingClientRect();
      const innerWidth = rect.width;
      const innerHeight = rect.height;
      const inner = Math.min(innerWidth, innerHeight);
      const totalGap = (size - 1) * BOARD_CELL_GAP_PX;
      if (!Number.isFinite(inner) || inner <= totalGap) return;
      const cellPx = (inner - totalGap) / size;
      const pitchPx = cellPx + BOARD_CELL_GAP_PX;
      const posPx = Array.from({ length: size }, (_, idx) => idx * pitchPx);
      const offsetX = Math.max(0, (innerWidth - inner) / 2);
      // Grid viewport should always be square (aspect-ratio: 1/1).
      // If innerHeight > innerWidth, it's a browser/environment bug
      // (e.g., WKWebView height:100% resolution issue). Force offsetY=0
      // to prevent the grid from being shifted downward.
      const offsetY = 0;

      setLayout((prev) => {
        if (
          prev.posPx.length === size &&
          Math.abs(prev.cellPx - cellPx) < LAYOUT_CHANGE_EPS &&
          Math.abs(prev.pitchPx - pitchPx) < LAYOUT_CHANGE_EPS &&
          Math.abs(prev.offsetX - offsetX) < LAYOUT_CHANGE_EPS &&
          Math.abs(prev.offsetY - offsetY) < LAYOUT_CHANGE_EPS
        ) {
          return prev;
        }
        return { cellPx, pitchPx, posPx, offsetX, offsetY };
      });
    };

    updateLayout();

    const observer = new ResizeObserver(updateLayout);
    observer.observe(el);

    return () => observer.disconnect();
  }, [size, boardPx]);

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

  const portalReleaseAnimatingTileIds = useMemo<ReadonlySet<string>>(
    () => new Set(animatingPortalReleases.map((release) => release.id)),
    [animatingPortalReleases]
  );

  // Commit next positions AFTER paint (StrictMode-safe)
  useLayoutEffect(() => {
    prevPositionsRef.current = nextPositions;
  }, [nextPositions]);

  // Calculate ghost overlay
  const ghostCells = useMemo(() => {
    if (readonly || !activePiece || !hoverLocation) return null;

    const { x, y } = hoverLocation;
    const isValid = canPlacePieceWithObstacles(grid, obstacleState, activePiece, x, y);

    return {
      cells: activePiece.cells.map(c => ({ x: x + c.x, y: y + c.y })),
      isValid
    };
  }, [readonly, grid, obstacleState, activePiece, hoverLocation]);

  // Phase별 보드 테두리 스타일
  const boardBorderStyle = isPremiumUiThemeActive
    ? ''
    : phase === Phase.SLIDE
      ? 'ring-1 ring-gray-400/50'
      : 'ring-1 ring-white/30';
  const glowOpacityClass = isPremiumUiThemeActive || useGalaxyGhostStyle ? 'opacity-0' : phase === Phase.SLIDE ? 'opacity-100' : 'opacity-0';
  const boardLayersTransform = `translate3d(${layout.offsetX}px, ${layout.offsetY}px, 0)`;

  return (
    <div
      ref={boardRef}
      id={htmlId}
        className={`
        relative ${premiumUiBoardPaddingClassName} ${isPremiumUiThemeActive ? premiumUiBoardShellClassName : ''}
        ${isPremiumUiThemeActive ? '' : 'bg-white/40'}
        {/* !overflow-visible: 포탈 IN/OUT 마커가 보드 외곽에 위치하므로 필수. 프리미엄 스킨 CSS가 overflow-hidden을 선언해도 덮어쓰이지 않도록 !important 적용 */}
        ${isPremiumUiThemeActive ? '' : 'rounded-3xl'} select-none !overflow-visible
        shadow-lg transition-shadow duration-200 ease-out
        ${boardBorderStyle}
        ${readonly ? 'pointer-events-none' : ''}
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
      {/*
        Grid viewport

        이 div가 보드의 유일한 게임 좌표계다. 아래 레이어들은 모두 `absolute inset-0`
        + `layout` 값으로 이 viewport 안에 그려진다. 새 스킨이 보드 주변 장식을 추가하려면
        부모 셸(`#game-board`)에 class/style을 더하고, 새 이펙트가 셀 위치를 따라가야 하면
        이 viewport 또는 `layout` 값을 사용한다.

        금지 패턴:
        - `#game-board.getBoundingClientRect()`를 읽고 padding/border를 빼서 좌표 계산
        - 광고/하단 UI의 실측 높이를 보드 scale 재계산에 직접 연결
        - 스킨 CSS에서 이 viewport에 padding, border, transform을 넣어 좌표계를 이동
      */}
      <div
        ref={gridViewportRef}
        data-board-grid-viewport="true"
        className={`relative w-full ${useGalaxyPhaseSyncClass ? 'explore-galaxy-phase-sync' : ''}`}
        style={{ aspectRatio: '1 / 1' }}
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
          @keyframes obstacleDropImpact {
            0% {
              opacity: 0;
              transform: translate3d(0, -44px, 0) scale(0.9);
              filter: brightness(1.18) saturate(1.08);
            }
            58% {
              opacity: 1;
              transform: translate3d(0, 5px, 0) scale(1.05, 0.9);
              filter: brightness(1.08) saturate(1.04);
            }
            76% {
              transform: translate3d(0, -3px, 0) scale(0.98, 1.04);
            }
            100% {
              opacity: 1;
              transform: translate3d(0, 0, 0) scale(1);
              filter: brightness(1) saturate(1);
            }
          }
          @keyframes obstacleImpactRing {
            0% {
              opacity: 0.75;
              transform: scale(0.7);
            }
            70% {
              opacity: 0;
              transform: scale(1.48);
            }
            100% {
              opacity: 0;
              transform: scale(1.55);
            }
          }
          .obstacle-drop-impact {
            /* OBSTACLE_IMPACT_ANIMATION_MS = 560ms */
            animation: obstacleDropImpact 560ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
            transform-origin: center bottom;
            will-change: transform, opacity, filter;
          }
          .obstacle-impact-ring {
            /* OBSTACLE_IMPACT_ANIMATION_MS = 560ms */
            animation: obstacleImpactRing 560ms ease-out both;
            will-change: transform, opacity;
          }
          @media (prefers-reduced-motion: reduce) {
            .obstacle-drop-impact,
            .obstacle-impact-ring {
              animation: none;
            }
          }
        `}</style>

        <div
          className="absolute inset-0"
          style={{ transform: boardLayersTransform }}
        >
          {/* 1. Background Grid (Empty Slots) */}
          <BackgroundGrid
            size={size}
            layout={layout}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            premiumUiBoardCellClassName={premiumUiBoardCellClassName}
          />

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
            isPixelBlastSkin={isPixelBlastSkin}
            mergeFlashTileIds={mergeFlashTileIds}
            onMergeFlashEnd={handleMergeFlashEnd}
            mergedNumberBurstTileIds={mergedNumberBurstTileIds}
            mergedNumberBurstByTileId={mergedNumberBurstByTileId}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            premiumUiTileFaceClassName={premiumUiTileFaceClassName}
            premiumUiTileNumberClassName={premiumUiTileNumberClassName}
            hiddenTileIds={portalReleaseAnimatingTileIds}
          />

          {/* 4. Portal release travel */}
          <PortalReleaseLayer
            releases={animatingPortalReleases}
            layout={layout}
            getResolvedAppearance={getResolvedAppearance}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            premiumUiTileFaceClassName={premiumUiTileFaceClassName}
            premiumUiTileNumberClassName={premiumUiTileNumberClassName}
          />

          {/* 5. Obstacles and portals */}
          <ObstacleLayer
            grid={grid}
            obstacleState={obstacleState}
            layout={layout}
          />

          {/* 6. Revive Destroy FX */}
          <ReviveDestroyLayer
            effects={reviveDestroyEffects}
            layout={layout}
            getResolvedAppearance={getResolvedAppearance}
            isPremiumUiThemeActive={isPremiumUiThemeActive}
            premiumUiTileFaceClassName={premiumUiTileFaceClassName}
            premiumUiTileNumberClassName={premiumUiTileNumberClassName}
          />

          {/* 7. Ghost Overlay */}
          {ghostCells && (
            <GhostOverlay
              size={size}
              layout={layout}
              ghostCells={ghostCells}
              isPremiumUiThemeActive={isPremiumUiThemeActive}
              premiumUiGhostValidClassName={premiumUiGhostValidClassName}
              premiumUiGhostInvalidClassName={premiumUiGhostInvalidClassName}
              useGalaxyGhostStyle={useGalaxyGhostStyle}
              galaxyGhostValidStyle={galaxyGhostValidStyle}
              galaxyGhostInvalidStyle={galaxyGhostInvalidStyle}
            />
          )}
        </div>

        {shouldRenderPixelBlastFallback && (
          <div
            ref={pixelBlastLayerRef}
            className="absolute inset-0 z-[1] pointer-events-none"
            aria-hidden="true"
          >
            <Suspense fallback={null}>
              <PixelBlast
                variant="square"
                pixelSize={4}
                patternScale={6}
                patternDensity={1}
                pixelSizeJitter={1}
                speed={0.5}
                edgeFade={0.25}
                transparent
              />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}));
