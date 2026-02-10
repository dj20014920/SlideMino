import React from 'react';
import { useTranslation } from 'react-i18next';
import { Piece } from '../types';
import { RotateCw } from 'lucide-react';
import { useBlockCustomization } from '../context/BlockCustomizationContext';

export interface SlotProps {
  piece: Piece | null;
  onPointerDown: (e: React.PointerEvent, piece: Piece, index: number) => void;
  onRotate: (index: number) => void;
  index: number;
  disabled: boolean;
  isPressed?: boolean;
  htmlId?: string; // For tutorial overlay targeting
}

export const Slot = React.memo<SlotProps>(({ piece, onPointerDown, onRotate, index, disabled, isPressed = false, htmlId }) => {
  const { t } = useTranslation();
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
        transition-all duration-150 ease-out
        group
        ${disabled
          ? 'opacity-30 pointer-events-none grayscale'
          : isPressed
            ? 'bg-white/55 ring-2 ring-emerald-300/80 shadow-[0_8px_20px_rgba(16,185,129,0.2)] scale-[1.01]'
            : 'hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:bg-white/50 active:scale-[0.99]'
        }
      `}
      id={htmlId}
      data-slot
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPointerDown(e, piece, index);
      }}
    >
      {/* 회전 버튼 */}
      {!disabled && (
        <button
          type="button"
          className="
            absolute left-2 bottom-2 z-10
            w-7 h-7 rounded-full touch-manipulation
            inline-flex items-center justify-center
            bg-white/80
            text-gray-600 
            border border-white/40
            shadow-md
            hover:bg-gray-800 hover:text-white hover:border-gray-700
            transition-colors duration-150
            opacity-100
          "
          data-rotate-button
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRotate(index);
          }}
          aria-label={t('common:aria.rotateBlock')}
        >
          <RotateCw size={13} />
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
