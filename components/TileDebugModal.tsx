import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { TILE_COLORS, getTileBaseFontPx, getTileColor, getTileNumberLayout } from '../constants';

type TileDebugModalProps = {
  open: boolean;
  onClose: () => void;
};

const TileSwatch = React.memo<{
  value: number;
  tilePx: number;
}>(({ value, tilePx }) => {
  const { text, fontPx } = getTileNumberLayout(value, tilePx);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          rounded-xl flex items-center justify-center 
          font-semibold select-none overflow-hidden text-center
          ${getTileColor(value)}
        `}
        style={{
          width: `${tilePx}px`,
          height: `${tilePx}px`,
          fontSize: value === 0 ? undefined : `${fontPx}px`,
          lineHeight: 1,
          whiteSpace: 'pre-line',
        }}
      >
        {text}
      </div>
      <div className="text-[11px] text-gray-500 tabular-nums leading-none">
        {value}
      </div>
    </div>
  );
});

export function TileDebugModal({ open, onClose }: TileDebugModalProps) {
  const [tilePx, setTilePx] = useState(48);

  const { styledMax, styledValues, overflowValues } = useMemo(() => {
    const styledKeys = Object.keys(TILE_COLORS)
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);
    const styledMax = styledKeys.length > 0 ? Math.max(...styledKeys) : 2048;

    const styledValues: number[] = [];
    let v = 1;
    while (v <= styledMax) {
      styledValues.push(v);
      v *= 2;
    }

    const overflowValues: number[] = [];
    let extra = styledMax * 2;
    for (let i = 0; i < 8; i++) {
      overflowValues.push(extra);
      extra *= 2;
    }

    return { styledMax, styledValues, overflowValues };
  }, []);

  const baseFontPx = useMemo(() => getTileBaseFontPx(tilePx), [tilePx]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl bg-white/85 backdrop-blur-sm border border-white/50 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-black/5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">타일 디버그 팔레트</h3>
            <p className="text-sm text-gray-500">
              색감/폰트 크기(자리수) 확인용
            </p>
          </div>
          <button
            type="button"
            className="p-2 rounded-xl bg-white/70 border border-white/60 text-gray-700 hover:bg-white shadow-sm transition-colors"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[78vh] overflow-auto">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">타일 크기</div>
              <div className="text-xs text-gray-500 tabular-nums">
                {tilePx}px · base font {Math.round(baseFontPx)}px (auto-fit)
              </div>
            </div>
            <input
              type="range"
              min={22}
              max={96}
              step={1}
              value={tilePx}
              onChange={(e) => setTilePx(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-800">빈 칸</h4>
            <div className="flex flex-wrap gap-3">
              <TileSwatch value={0} tilePx={tilePx} />
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-800">
              정의된 색상 (≤ {styledMax})
            </h4>
            <div className="flex flex-wrap gap-3">
              {styledValues.map((value) => (
                <TileSwatch key={value} value={value} tilePx={tilePx} />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-800">
              Fallback 스타일 (&gt; {styledMax})
            </h4>
            <div className="flex flex-wrap gap-3">
              {overflowValues.map((value) => (
                <TileSwatch key={value} value={value} tilePx={tilePx} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
