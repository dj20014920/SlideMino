import React from 'react';
import { Piece } from '../types';
import { SHAPES } from '../constants';
import { RotateCw } from 'lucide-react';

interface SlotProps {
  piece: Piece | null;
  onPointerDown: (e: React.PointerEvent, piece: Piece, index: number) => void;
  onRotate: (index: number) => void;
  index: number;
  disabled: boolean;
}

export const Slot: React.FC<SlotProps> = ({ piece, onPointerDown, onRotate, index, disabled }) => {
  if (!piece) {
    return (
      <div className="w-full aspect-square bg-slate-800/50 rounded-lg flex items-center justify-center border-2 border-slate-700 border-dashed opacity-50">
      </div>
    );
  }

  // Calculate viewbox for SVG
  // Calculate viewbox for SVG
  // Use actual piece cells (which are already rotated) instead of base shape
  const cells = piece.cells;

  const minX = Math.min(...cells.map(c => c.x));
  const maxX = Math.max(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  const maxY = Math.max(...cells.map(c => c.y));

  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  // Padding to prevent border clipping - tighter fit
  const padding = 0.1;
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxW = width + (padding * 2);
  const viewBoxH = height + (padding * 2);

  return (
    <div
      className={`
        relative w-full aspect-square bg-slate-800 rounded-lg flex items-center justify-center
        cursor-grab active:cursor-grabbing transition-transform hover:scale-105 group
        ${disabled ? 'opacity-30 pointer-events-none grayscale' : 'shadow-lg border border-slate-600'}
      `}
      onPointerDown={(e) => {
        // Prevent default touch actions to ensure our custom drag works
        e.preventDefault();
        onPointerDown(e, piece, index);
      }}
    >
      {!disabled && (
        <button
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-slate-700 text-white hover:bg-blue-500 transition-colors shadow-sm ring-1 ring-white/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
          onPointerDown={(e) => {
            e.stopPropagation();
            onRotate(index);
          }}
          aria-label="Rotate block"
        >
          <RotateCw size={14} />
        </button>
      )}

      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
        className="w-full h-full pointer-events-none fill-blue-400 drop-shadow-md p-2"
        preserveAspectRatio="xMidYMid meet"
      >
        {cells.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={0.95}
            height={0.95}
            rx={0.15}
          />
        ))}
      </svg>
    </div>
  );
};
