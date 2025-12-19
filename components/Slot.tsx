import React from 'react';
import { Piece } from '../types';
import { RotateCw } from 'lucide-react';
import { useBlockCustomization } from '../context/BlockCustomizationContext';

interface SlotProps {
  piece: Piece | null;
  onPointerDown: (e: React.PointerEvent, piece: Piece, index: number) => void;
  onRotate: (index: number) => void;
  index: number;
  disabled: boolean;
}

export const Slot = React.memo<SlotProps>(({ piece, onPointerDown, onRotate, index, disabled }) => {
  const { resolveTileAppearance } = useBlockCustomization();

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

  // Slot preview should follow tile customization (default: value 1).
  // (No number label in slot preview by design.)
  const previewValue = 1;
  const appearance = resolveTileAppearance(previewValue);
  const fitByWidth = width >= height;
  const normalizedCells = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));

  return (
    <div
      className={`
        relative w-full aspect-square rounded-2xl flex items-center justify-center
        bg-white/40 backdrop-blur-sm
        border border-white/50
        shadow-[0_4px_16px_rgba(0,0,0,0.06)]
        cursor-grab active:cursor-grabbing 
        transition-shadow duration-200 ease-out
        group
        ${disabled
          ? 'opacity-30 pointer-events-none grayscale'
          : 'hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:bg-white/50'
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

      {/* 블록 미리보기 (커스터마이징 색상 반영) */}
      <div className="w-full h-full pointer-events-none p-3">
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="grid gap-1"
            style={{
              aspectRatio: `${width} / ${height}`,
              width: fitByWidth ? '100%' : 'auto',
              height: fitByWidth ? 'auto' : '100%',
              gridTemplateColumns: `repeat(${width}, 1fr)`,
              gridTemplateRows: `repeat(${height}, 1fr)`,
              filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.10))',
            }}
          >
            {normalizedCells.map((c, i) => (
              <div
                key={i}
                className={`
                  rounded-lg
                  border border-white/30
                  ${appearance.className}
                `}
                style={{
                  gridColumn: c.x + 1,
                  gridRow: c.y + 1,
                  ...(appearance.style ?? {}),
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
