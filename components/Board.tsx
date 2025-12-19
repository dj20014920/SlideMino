import React, {
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useImperativeHandle,
  forwardRef
} from 'react';
import { Grid, Piece, Phase, Tile, MergingTile } from '../types';
import { canPlacePiece } from '../services/gameLogic';
import { getTileColor, getTileNumberLayout, getSlideAnimationDurationMs, BOARD_CELL_GAP_PX } from '../constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';

export type BoardHandle = {
  setHoverLocation: (pos: { x: number; y: number } | null) => void;
};

interface BoardProps {
  grid: Grid;
  activePiece: Piece | null;
  boardRef: React.RefObject<HTMLDivElement>;
  phase: Phase;
  mergingTiles: MergingTile[];
  valueOverrides?: Record<string, number>;
}

const BackgroundGrid = React.memo<{ size: number }>(({ size }) => {
  return (
    <div
      className="absolute inset-0 grid"
      style={{
        gap: BOARD_CELL_GAP_PX,
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
        zIndex: 0
      }}
    >
      {Array.from({ length: size * size }).map((_, i) => (
        <div
          key={`bg-${i}`}
          className={`
            w-full h-full rounded-xl
            ${getTileColor(0)}
          `}
        />
      ))}
    </div>
  );
});

type GridLayout = {
  cellPx: number;
  pitchPx: number;
  posPx: number[];
};

const tileTransitionEase = 'cubic-bezier(0.25,0.1,0.25,1.0)';

const MergingTilesLayer = React.memo<{
  animatingMerges: (MergingTile & { currentX: number; currentY: number; distance: number })[];
  layout: GridLayout;
}>(({ animatingMerges, layout }) => {
  const { resolveTileAppearance } = useBlockCustomization();
  return (
    <div className="absolute inset-0 z-5 pointer-events-none">
      {animatingMerges.map((mt) => {
        const duration = getSlideAnimationDurationMs(mt.distance);
        const transform = `translate3d(${layout.posPx[mt.currentX]}px, ${layout.posPx[mt.currentY]}px, 0)`;
        const { text, fontPx } = getTileNumberLayout(mt.value, layout.cellPx);
        const appearance = resolveTileAppearance(mt.value);
        return (
          <div
            key={`merge-${mt.id}`}
            data-tile-id={mt.id}
            data-tile-distance={mt.distance}
            data-tile-kind="merge"
            className={`
              absolute rounded-xl flex items-center justify-center 
              font-semibold overflow-hidden text-center
              ${appearance.className}
            `}
            style={{
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              left: 0,
              top: 0,
              transform,
              fontSize: `${fontPx}px`,
              lineHeight: 1,
              whiteSpace: 'pre-line',
              opacity: 0.7,
              transition: duration
                ? `transform ${duration}ms ${tileTransitionEase}`
                : undefined,
              willChange: duration ? 'transform' : undefined,
              ...(appearance.style ?? {}),
            }}
          >
            {text}
          </div>
        );
      })}
    </div>
  );
});

const TilesLayer = React.memo<{
  tiles: (Tile & { x: number; y: number; distance: number })[];
  layout: GridLayout;
  valueOverrides?: Record<string, number>;
}>(({ tiles, layout, valueOverrides }) => {
  const { resolveTileAppearance } = useBlockCustomization();
  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {tiles.map((tile) => {
        const duration = getSlideAnimationDurationMs(tile.distance);
        const displayValue = valueOverrides?.[tile.id] ?? tile.value;
        const transform = `translate3d(${layout.posPx[tile.x]}px, ${layout.posPx[tile.y]}px, 0)`;
        const { text, fontPx } = getTileNumberLayout(displayValue, layout.cellPx);
        const appearance = resolveTileAppearance(displayValue);

        return (
          <div
            key={tile.id}
            data-tile-id={tile.id}
            data-tile-distance={tile.distance}
            data-tile-kind="tile"
            className={`
              absolute rounded-xl flex items-center justify-center 
              font-semibold overflow-hidden text-center
              ${appearance.className}
            `}
            style={{
              width: `${layout.cellPx}px`,
              height: `${layout.cellPx}px`,
              left: 0,
              top: 0,
              transform,
              fontSize: `${fontPx}px`,
              lineHeight: 1,
              whiteSpace: 'pre-line',
              transition: duration
                ? `transform ${duration}ms ${tileTransitionEase}`
                : undefined,
              willChange: duration ? 'transform' : undefined,
              ...(appearance.style ?? {}),
            }}
          >
            {text}
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
}>(({ size, layout, ghostCells }) => {
  if (ghostCells.cells.length === 0) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {ghostCells.cells.map((cell, idx) => {
        if (cell.x < 0 || cell.x >= size || cell.y < 0 || cell.y >= size) return null;
        const transform = `translate3d(${layout.posPx[cell.x]}px, ${layout.posPx[cell.y]}px, 0)`;

        return (
          <div
            key={`ghost-${idx}`}
            className={`
              absolute rounded-xl opacity-70 border-2 box-border
              transition-colors duration-150
              ${ghostCells.isValid
                ? 'bg-gray-800/50 border-gray-600'
                : 'bg-red-400/50 border-red-300'}
            `}
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

export const Board = React.memo(forwardRef<BoardHandle, BoardProps>(function Board({
  grid,
  activePiece,
  boardRef,
  phase,
  mergingTiles,
  valueOverrides
}, ref) {
  const size = grid.length;
  const [layout, setLayout] = useState<GridLayout>(() => ({
    cellPx: 0,
    pitchPx: 0,
    posPx: Array.from({ length: size }, () => 0),
  }));
  const [hoverLocation, setHoverLocation] = useState<{ x: number; y: number } | null>(null);
  const hoverLocationRef = useRef<{ x: number; y: number } | null>(null);

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
  useEffect(() => {
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

      // Phase 2: On next frame, move tiles to DESTINATION (toX, toY)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimatingMerges(prev => prev.map(mt => ({
            ...mt,
            currentX: mt.toX,
            currentY: mt.toY
          })));
        });
      });
    } else {
      setAnimatingMerges([]);
    }
  }, [mergingTiles]);

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

      const innerWidth = rect.width - paddingLeft - paddingRight;
      const innerHeight = rect.height - paddingTop - paddingBottom;
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
  }, [boardRef, size]);

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
  const boardBorderStyle = phase === Phase.SLIDE
    ? 'ring-1 ring-gray-400/50'
    : 'ring-1 ring-white/30';
  const glowOpacityClass = phase === Phase.SLIDE ? 'opacity-100' : 'opacity-0';

  return (
    <div
      ref={boardRef}
      className={`
        relative p-3
        bg-white/40
        rounded-3xl select-none
        shadow-lg transition-shadow duration-200 ease-out
        ${boardBorderStyle}
      `}
      style={{
        width: '420px',
        maxWidth: '100%',
        aspectRatio: '1/1',
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
      <div className="relative w-full h-full">

        {/* 1. Background Grid (Empty Slots) */}
        <BackgroundGrid size={size} />

        {/* 2. Merging Tiles Layer (Absorbed tiles animating to merge destination) */}
        <MergingTilesLayer
          animatingMerges={animatingMerges}
          layout={layout}
        />

        {/* 3. Tiles Layer (Animated with uniform speed) */}
        <TilesLayer
          tiles={renderTiles}
          layout={layout}
          valueOverrides={valueOverrides}
        />

        {/* 4. Ghost Overlay */}
        {ghostCells && <GhostOverlay size={size} layout={layout} ghostCells={ghostCells} />}
      </div>
    </div>
  );
}));
