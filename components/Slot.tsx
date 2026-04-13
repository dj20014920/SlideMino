import React from 'react';
import { useTranslation } from 'react-i18next';
import { Piece } from '../types';
import { RotateCw } from 'lucide-react';
import { useBlockCustomization } from '../context/BlockCustomizationContext';

const LIQUID_GLASS_SKIN_PREFIX = 'skin_digital_liquid_glass_';
const LEGACY_LIQUID_GLASS_SKIN_ID = 'skin_digital_liquid_glass';
const isLiquidGlassSkinId = (skinId?: string | null): boolean => (
  Boolean(skinId) && (
    skinId === LEGACY_LIQUID_GLASS_SKIN_ID ||
    skinId.startsWith(LIQUID_GLASS_SKIN_PREFIX)
  )
);

export interface SlotProps {
  piece: Piece | null;
  onPointerDown: (e: React.PointerEvent, piece: Piece, index: number) => void;
  onRotate: (index: number) => void;
  index: number;
  disabled: boolean;
  rotationDisabled?: boolean;
  isPressed?: boolean;
  htmlId?: string; // For tutorial overlay targeting
}

export const Slot = React.memo<SlotProps>(({ piece, onPointerDown, onRotate, index, disabled, rotationDisabled = false, isPressed = false, htmlId }) => {
  const { t } = useTranslation();
  const { resolveTileAppearance, activeSkin, isPremiumUiThemeActive, premiumUiObjects, premiumSkinRuntime } = useBlockCustomization();
  const premiumUiSlotShellClassName = premiumUiObjects.board.slotShellClassName;
  const premiumUiSlotMiniCellClassName = premiumUiObjects.board.slotMiniCellClassName;
  const premiumUiSlotRotateButtonClassName = premiumUiObjects.board.slotRotateButtonClassName;
  const premiumUiGameButtonClassName = premiumUiObjects.buttons.gameClassName;
  const slotPreviewRuntime = premiumSkinRuntime.slot.preview;

  // 빈 슬롯 렌더링
  if (!piece) {
    return (
      <div
        className={`
          w-full aspect-square opacity-40
          ${isPremiumUiThemeActive
            ? premiumUiSlotShellClassName
            : 'rounded-2xl bg-white/20 backdrop-blur-sm border border-dashed border-gray-300/50'
          }
        `}
      />
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

  // Liquid Glass는 value=1이 완전 투명이므로 슬롯 프리뷰에서 블록이 안 보일 수 있다.
  // 프리뷰 전용으로 가시성이 확보되는 중간 값(16)을 사용한다.
  const isLiquidGlassPreview = isLiquidGlassSkinId(activeSkin?.id);
  const previewValue = isLiquidGlassPreview ? 16 : (slotPreviewRuntime.valueOverride ?? 1);
  const appearance = resolveTileAppearance(previewValue);
  const previewAppearanceClassName = appearance.className;
  const previewAppearanceStyle = appearance.style ?? {};
  const previewCellBoxShadow = [
    typeof appearance.style?.boxShadow === 'string' ? appearance.style.boxShadow : '',
    isLiquidGlassPreview ? 'inset 0 0 0 1px rgba(255,255,255,0.34)' : '',
  ].filter(Boolean).join(', ');
  const fitByWidth = width >= height;
  const normalizedCells = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  const rotateHitboxPx = isPremiumUiThemeActive ? 16 : 18;
  const rotateIconPx = isPremiumUiThemeActive ? 8 : 10;

  return (
    <div
      className={`
        relative w-full aspect-square flex items-center justify-center
        ${isPremiumUiThemeActive ? premiumUiSlotShellClassName : 'rounded-2xl bg-white/40 backdrop-blur-sm border border-white/50 shadow-[0_4px_16px_rgba(0,0,0,0.06)]'}
        cursor-grab active:cursor-grabbing 
        transition-all duration-150 ease-out
        group
        ${disabled
          ? `${slotPreviewRuntime.disabledClassName} pointer-events-none`
          : isPressed
            ? isPremiumUiThemeActive
              ? 'brightness-95'
              : 'bg-white/55 ring-2 ring-emerald-300/80 shadow-[0_8px_20px_rgba(16,185,129,0.2)]'
            : isPremiumUiThemeActive
              ? ''
              : 'hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:bg-white/50'
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
      {!disabled && !rotationDisabled && (
        <button
          type="button"
          className={`
            absolute left-1 bottom-1 z-10
            touch-manipulation
            inline-flex items-center justify-center
            transition-colors duration-150
            opacity-100
            ${isPremiumUiThemeActive
              ? `${premiumUiGameButtonClassName} ${premiumUiSlotRotateButtonClassName} text-gray-700`
              : 'rounded-full bg-white/80 text-gray-600 border border-white/40 shadow-md hover:bg-gray-800 hover:text-white hover:border-gray-700'
            }
          `}
          style={{
            width: `${rotateHitboxPx}px`,
            height: `${rotateHitboxPx}px`,
            minWidth: `${rotateHitboxPx}px`,
            minHeight: `${rotateHitboxPx}px`,
          }}
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
          <RotateCw size={rotateIconPx} />
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
                  ${isPremiumUiThemeActive ? premiumUiSlotMiniCellClassName : 'rounded-lg border border-white/30'}
                  ${slotPreviewRuntime.useResolvedAppearanceClass ? previewAppearanceClassName : ''}
                `}
                style={{
                  gridColumn: c.x + 1,
                  gridRow: c.y + 1,
                  ...previewAppearanceStyle,
                  ...slotPreviewRuntime.cellStyle,
                  ...(isLiquidGlassPreview
                    ? {
                      backgroundColor: 'rgba(255,255,255,0.24)',
                      boxShadow: previewCellBoxShadow,
                    }
                    : {}),
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});
