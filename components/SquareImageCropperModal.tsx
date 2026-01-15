import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type SquareImageCropperModalProps = {
  open: boolean;
  src: string;
  outputSize?: number; // px
  onCancel: () => void;
  onConfirm: (dataUrl: string) => void;
};

type ImgInfo = { w: number; h: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function SquareImageCropperModal({
  open,
  src,
  outputSize = 256,
  onCancel,
  onConfirm,
}: SquareImageCropperModalProps) {
  const { t } = useTranslation();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [viewportPx, setViewportPx] = useState(280);
  const [imgInfo, setImgInfo] = useState<ImgInfo | null>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; startOffX: number; startOffY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    startOffX: 0,
    startOffY: 0,
  });

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, src]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = viewportRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      const next = Math.max(160, Math.round(Math.min(rect.width, rect.height)));
      setViewportPx(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  const baseScale = useMemo(() => {
    if (!imgInfo) return 1;
    const minSide = Math.min(imgInfo.w, imgInfo.h);
    if (minSide <= 0) return 1;
    return viewportPx / minSide;
  }, [imgInfo, viewportPx]);

  const scale = baseScale * zoom;

  const clampOffset = (next: { x: number; y: number }) => {
    if (!imgInfo) return { x: 0, y: 0 };
    const displayW = imgInfo.w * scale;
    const displayH = imgInfo.h * scale;
    const maxX = Math.max(0, (displayW - viewportPx) / 2);
    const maxY = Math.max(0, (displayH - viewportPx) / 2);
    return { x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  };

  useEffect(() => {
    if (!imgInfo) return;
    setOffset((prev) => clampOffset(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, viewportPx, imgInfo?.w, imgInfo?.h]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!imgInfo) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startOffX: offset.x,
      startOffY: offset.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clampOffset({ x: dragRef.current.startOffX + dx, y: dragRef.current.startOffY + dy }));
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
  };

  const exportCropped = () => {
    const img = imgRef.current;
    if (!imgInfo || !img) return;

    const displayW = imgInfo.w * scale;
    const displayH = imgInfo.h * scale;
    const imageLeft = (viewportPx - displayW) / 2 + offset.x;
    const imageTop = (viewportPx - displayH) / 2 + offset.y;

    const cropX = (0 - imageLeft) / scale;
    const cropY = (0 - imageTop) / scale;
    const cropSize = viewportPx / scale;

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, cropX, cropY, cropSize, cropSize, 0, 0, outputSize, outputSize);

    const dataUrl = canvas.toDataURL('image/webp', 0.92);
    onConfirm(dataUrl);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1001] flex items-center justify-center p-4"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />

      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white/90 backdrop-blur-sm border border-white/60 shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-black/5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('modals:blockCustomization.cropper.title')}</h3>
            <p className="text-sm text-gray-500">{t('modals:blockCustomization.cropper.description')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="p-2 rounded-xl bg-white/70 border border-white/60 text-gray-700 hover:bg-white shadow-sm transition-colors"
              onClick={onCancel}
              aria-label={t('common:aria.close')}
            >
              <X size={18} />
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-xl bg-gray-900 text-white font-semibold shadow-sm hover:bg-gray-800 active:scale-95 transition"
              onClick={exportCropped}
            >
              <span className="inline-flex items-center gap-2">
                <Check size={16} />
                {t('modals:blockCustomization.cropper.apply')}
              </span>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center justify-center">
            <div
              ref={viewportRef}
              className="relative w-full max-w-[360px] aspect-square rounded-3xl overflow-hidden bg-gray-100 border border-gray-200 shadow-[inset_0_2px_12px_rgba(0,0,0,0.06)] touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              >
                <img
                  ref={imgRef}
                  src={src}
                  alt={t('modals:blockCustomization.cropper.alt')}
                  className="absolute left-1/2 top-1/2 max-w-none select-none"
                  style={{
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    transformOrigin: 'center',
                    willChange: 'transform',
                  }}
                  draggable={false}
                  onLoad={() => {
                    const el = imgRef.current;
                    if (!el) return;
                    setImgInfo({ w: el.naturalWidth, h: el.naturalHeight });
                  }}
                />
              </div>

              {/* Safe area guide */}
              <div className="absolute inset-0 pointer-events-none ring-2 ring-white/60 rounded-3xl" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-gray-800">{t('modals:blockCustomization.cropper.zoom')}</div>
              <div className="text-xs text-gray-500 tabular-nums">{Math.round(zoom * 100)}%</div>
            </div>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="px-3 py-2 rounded-xl bg-white/70 border border-white/60 text-gray-700 hover:bg-white shadow-sm transition"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                {t('modals:blockCustomization.cropper.center')}
              </button>
              <div className="text-xs text-gray-500">
                {String(t('modals:blockCustomization.cropper.optimize', { size: outputSize } as any))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
