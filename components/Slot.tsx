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

export const Slot = React.memo<SlotProps>(({ piece, onPointerDown, onRotate, index, disabled }) => {
  // 빈 슬롯 렌더링
  if (!piece) {
    return (
      <div className="
        w-full aspect-square rounded-2xl
        bg-white/20 backdrop-blur-sm
        border border-dashed border-gray-300/50
        opacity-40
      "/>
    );
  }

  // Calculate viewbox for SVG - using actual piece cells (already rotated)
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
        relative w-full aspect-square rounded-2xl flex items-center justify-center
        bg-white/40 backdrop-blur-sm
        border border-white/50
        shadow-[0_4px_16px_rgba(0,0,0,0.06)]
        cursor-grab active:cursor-grabbing 
        transition-all duration-200 ease-out
        group
        ${disabled
          ? 'opacity-30 pointer-events-none grayscale'
          : 'hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:-translate-y-1 hover:bg-white/50'
        }
      `}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPointerDown(e, piece, index);
      }}
    >
      {/* 회전 버튼 */}
      {!disabled && (
        <button
          className="
            absolute top-2 right-2 z-10 
            p-1.5 rounded-full 
            bg-white/80
            text-gray-600 
            border border-white/40
            shadow-md
            hover:bg-gray-800 hover:text-white hover:border-gray-700
            transition-colors duration-150
            opacity-0 group-hover:opacity-100 focus:opacity-100
          "
          onPointerDown={(e) => {
            e.stopPropagation();
            onRotate(index);
          }}
          aria-label="Rotate block"
        >
          <RotateCw size={14} />
        </button>
      )}

      {/* 블록 SVG 미리보기 */}
      <svg
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
        className="w-full h-full pointer-events-none p-3 drop-shadow-md"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* 블록용 그라데이션 정의 */}
          <linearGradient id={`blockGrad-${piece.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#374151" />
            <stop offset="100%" stopColor="#1f2937" />
          </linearGradient>
        </defs>
        {cells.map((c, i) => (
          <rect
            key={i}
            x={c.x}
            y={c.y}
            width={0.92}
            height={0.92}
            rx={0.12}
            fill={`url(#blockGrad-${piece.id})`}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={0.04}
          />
        ))}
      </svg>
    </div>
  );
});
