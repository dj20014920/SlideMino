import React, { useMemo, useEffect, useState } from 'react';
import { Grid, Piece, Phase } from '../types';
import { canPlacePiece } from '../services/gameLogic';
import { getTileColor } from '../constants';

interface BoardProps {
  grid: Grid;
  activePiece: Piece | null;
  hoverLocation: { x: number, y: number } | null;
  boardRef: React.RefObject<HTMLDivElement>;
  phase: Phase;
}

export const Board = React.memo<BoardProps>(({
  grid,
  activePiece,
  hoverLocation,
  boardRef,
  phase
}) => {
  const size = grid.length;
  const [cellSizePx, setCellSizePx] = useState(0);

  // ResizeObserver to calculate exact cell size for font scaling
  useEffect(() => {
    if (!boardRef.current) return;

    const updateSize = () => {
      if (boardRef.current) {
        const width = boardRef.current.offsetWidth;
        setCellSizePx(width / size);
      }
    };

    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(boardRef.current);

    return () => observer.disconnect();
  }, [boardRef, size]);

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

  // Dynamic font size: ~45% of cell size, clamped reasonably
  const dynamicFontSize = Math.max(12, Math.min(cellSizePx * 0.45, 40));

  // Phase별 보드 테두리 스타일
  const boardBorderStyle = phase === Phase.SLIDE
    ? 'ring-2 ring-gray-400/50 shadow-[0_0_30px_rgba(0,0,0,0.15)]'
    : 'ring-1 ring-white/30';

  return (
    <div
      ref={boardRef}
      className={`
        relative grid gap-[3px] p-3
        bg-white/40
        rounded-3xl select-none
        shadow-lg
        ${boardBorderStyle}
      `}
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`,
        aspectRatio: '1/1',
        maxWidth: '100%',
        width: '420px'
      }}
    >
      {/* Background Grid & Tiles */}
      {grid.map((row, y) => (
        row.map((val, x) => (
          <div
            key={`${x}-${y}`}
            className={`
              relative w-full h-full rounded-xl flex items-center justify-center 
              font-semibold
              ${getTileColor(val)}
              ${val > 0 ? 'cell-enter' : ''}
            `}
            style={{ fontSize: `${dynamicFontSize}px` }}
          >
            {val > 0 ? val : ''}
          </div>
        ))
      ))}

      {/* Ghost Overlay - Optimized: Only render actual ghost cells */}
      {ghostCells && ghostCells.cells.length > 0 && (
        <div
          className="absolute inset-0 grid gap-[3px] p-3 pointer-events-none"
          style={{
            gridTemplateColumns: `repeat(${size}, 1fr)`,
            gridTemplateRows: `repeat(${size}, 1fr)`
          }}
        >
          {ghostCells.cells.map((cell, idx) => {
            const gridIndex = cell.y * size + cell.x;

            return (
              <div
                key={`ghost-${gridIndex}`}
                className={`
                  rounded-xl opacity-70 border-2 box-border
                  transition-colors duration-150
                  ${ghostCells.isValid
                    ? 'bg-gray-800/50 border-gray-600'
                    : 'bg-red-400/50 border-red-300'}
                `}
                style={{
                  gridColumn: cell.x + 1,
                  gridRow: cell.y + 1
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});