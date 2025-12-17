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

export const Board: React.FC<BoardProps> = ({ 
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
        // Subtract gap roughly or just divide by size for approximation
        // With gap-1 (4px), total gap space is (size-1)*4
        // But for font size, raw division is safe enough
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

  return (
    <div 
      ref={boardRef}
      className={`relative grid gap-1 p-2 bg-slate-800 rounded-xl shadow-inner select-none transition-all duration-300 ${phase === Phase.SLIDE ? 'ring-4 ring-orange-500 shadow-orange-500/20' : 'ring-2 ring-slate-600'}`}
      style={{
        gridTemplateColumns: `repeat(${size}, 1fr)`,
        gridTemplateRows: `repeat(${size}, 1fr)`, // Ensure rows are exactly equal height to columns
        aspectRatio: '1/1',
        maxWidth: '100%',
        width: '500px' // Keeps the board size constrained but responsive
      }}
    >
      {/* Background Grid & Tiles */}
      {grid.map((row, y) => (
        row.map((val, x) => (
          <div 
            key={`${x}-${y}`}
            className={`
              relative w-full h-full rounded-md flex items-center justify-center 
              font-bold transition-all duration-200
              ${getTileColor(val)}
              ${val > 0 ? 'cell-enter shadow-md' : ''}
            `}
            style={{ fontSize: `${dynamicFontSize}px` }}
          >
            {val > 0 ? val : ''}
          </div>
        ))
      ))}

      {/* Ghost Overlay */}
      <div className="absolute inset-0 grid gap-1 p-2 pointer-events-none"
           style={{ 
             gridTemplateColumns: `repeat(${size}, 1fr)`,
             gridTemplateRows: `repeat(${size}, 1fr)`
           }}>
        {Array.from({ length: size * size }).map((_, idx) => {
          const x = idx % size;
          const y = Math.floor(idx / size);
          
          let isGhost = false;
          let isValid = false;

          if (ghostCells) {
            isGhost = ghostCells.cells.some(c => c.x === x && c.y === y);
            isValid = ghostCells.isValid;
          }

          if (!isGhost) return <div key={`ghost-${idx}`} />;

          return (
            <div 
              key={`ghost-${idx}`} 
              className={`
                rounded-md opacity-60 border-2 box-border z-10
                ${isValid ? 'bg-green-400 border-green-200' : 'bg-red-500 border-red-200'}
              `}
            />
          );
        })}
      </div>
    </div>
  );
};