import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Hand, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createTargetRectTracker } from '../services/tutorialTargetGeometry';

const EDGE_PADDING_PX = 12;
const TARGET_GAP_PX = 12;
const DEFAULT_BUBBLE_HEIGHT_PX = 180;
const MIN_BUBBLE_WIDTH_PX = 220;
const MAX_BUBBLE_WIDTH_PX = 360;

const round = Math.round;

const clamp = (value: number, min: number, max: number): number => {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
};

/**
 * visualViewport 기반 실제 보이는 화면 크기 반환 (키보드, 브라우저 UI 제외).
 * visualViewport 미지원 환경에서는 window.innerHeight 사용.
 */
const getViewportDims = (): { width: number; height: number; offsetTop: number; offsetLeft: number } => {
  if (typeof window === 'undefined') return { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 };
  const vv = window.visualViewport;
  return {
    width: round(vv ? vv.width : window.innerWidth),
    height: round(vv ? vv.height : window.innerHeight),
    offsetTop: round(vv ? vv.offsetTop : 0),
    offsetLeft: round(vv ? vv.offsetLeft : 0),
  };
};

interface TutorialTooltipProps {
  isVisible: boolean;
  targetId: string | null;
  onDismiss: () => void;
  title: string;
  description: string;
  children?: React.ReactNode;
  stepName?: string;
  forcePlacement?: 'above' | 'below';
}

export const TutorialTooltip: React.FC<TutorialTooltipProps> = ({
  isVisible,
  targetId,
  onDismiss,
  title,
  description,
  children,
  forcePlacement,
}) => {
  const { t } = useTranslation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const [viewport, setViewport] = useState(() => getViewportDims());
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setTargetRect(null);
      return;
    }

    const updateViewport = () => setViewport(getViewportDims());

    updateViewport();
    const tracker = createTargetRectTracker({
      getTarget: () => (targetId ? document.getElementById(targetId) : null),
      anchorMode: 'auto',
      onRect: (rect) => {
        updateViewport();
        setTargetRect((prev) => {
          if (
            prev &&
            prev.left === rect.left &&
            prev.top === rect.top &&
            prev.width === rect.width &&
            prev.height === rect.height
          ) {
            return prev;
          }
          return rect;
        });
      },
      onMissing: () => {
        updateViewport();
        setTargetRect(null);
      },
    });

    return () => {
      tracker.cleanup();
    };
  }, [isVisible, targetId]);

  useEffect(() => {
    if (!isVisible || !bubbleRef.current) return;
    const measure = () => {
      if (!bubbleRef.current) return;
      const nextHeight = round(bubbleRef.current.getBoundingClientRect().height);
      setBubbleHeight((prev) => (Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bubbleRef.current);
    return () => ro.disconnect();
  }, [isVisible, children, description, title]);

  const layout = useMemo(() => {
    if (!targetRect) return null;

    const vpWidth = viewport.width;
    const vpHeight = viewport.height;
    const vpOffsetTop = viewport.offsetTop;
    const vpOffsetLeft = viewport.offsetLeft;

    const targetLeft = round(targetRect.left - vpOffsetLeft);
    const targetTop = round(targetRect.top - vpOffsetTop);
    const targetWidth = round(targetRect.width);
    const targetHeight = round(targetRect.height);
    const targetBottom = targetTop + targetHeight;
    const targetCenterX = targetLeft + round(targetWidth / 2);

    const bubbleWidth = clamp(
      vpWidth - EDGE_PADDING_PX * 2,
      MIN_BUBBLE_WIDTH_PX,
      MAX_BUBBLE_WIDTH_PX
    );
    const bubbleLeft = clamp(
      round(targetCenterX - bubbleWidth / 2),
      EDGE_PADDING_PX,
      vpWidth - bubbleWidth - EDGE_PADDING_PX
    );
    const resolvedBubbleHeight = bubbleHeight || DEFAULT_BUBBLE_HEIGHT_PX;

    const candidateBelowTop = targetBottom + TARGET_GAP_PX;
    const candidateAboveTop = targetTop - TARGET_GAP_PX - resolvedBubbleHeight;

    let placement: 'above' | 'below' = 'below';

    if (forcePlacement) {
      placement = forcePlacement;
    } else {
      const canPlaceBelow = candidateBelowTop + resolvedBubbleHeight <= vpHeight - EDGE_PADDING_PX;
      const canPlaceAbove = candidateAboveTop >= EDGE_PADDING_PX;
      placement = canPlaceBelow || !canPlaceAbove ? 'below' : 'above';
    }

    const bubbleTop =
      placement === 'below'
        ? clamp(
            candidateBelowTop,
            EDGE_PADDING_PX,
            vpHeight - resolvedBubbleHeight - EDGE_PADDING_PX
          )
        : clamp(
            candidateAboveTop,
            EDGE_PADDING_PX,
            vpHeight - resolvedBubbleHeight - EDGE_PADDING_PX
          );

    const arrowLeft = clamp(
      round(targetCenterX - bubbleLeft - 8),
      20,
      bubbleWidth - 24
    );

    const handLeft = clamp(
      round(targetCenterX - 24),
      EDGE_PADDING_PX,
      vpWidth - 56
    );
    const handTop = clamp(
      round(targetTop + targetHeight / 2 - 24),
      EDGE_PADDING_PX,
      vpHeight - 56
    );

    return {
      vpWidth,
      targetLeft,
      targetTop,
      targetWidth,
      targetHeight,
      bubbleWidth,
      bubbleLeft,
      bubbleTop,
      arrowLeft,
      handLeft,
      handTop,
      placement,
    };
  }, [bubbleHeight, targetRect, viewport, forcePlacement]);

  if (!isVisible || !targetRect || !layout) return null;

  return createPortal(
    <AnimatePresence>
      {/* Highlight Box around Target */}
      {targetRect && (
        <div
          className="fixed z-[9999] pointer-events-none transition-all duration-300"
          style={{
            left: layout.targetLeft - 4,
            top: layout.targetTop - 4,
            width: layout.targetWidth + 8,
            height: layout.targetHeight + 8,
            borderRadius: 12,
            border: '2px solid rgba(191, 219, 254, 0.8)',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.45)',
          }}
        />
      )}

      {/* Hand Pointer */}
      {targetRect && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="fixed z-[10000] pointer-events-none text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
          style={{
            left: layout.handLeft,
            top: layout.handTop,
          }}
        >
          <motion.div
            animate={{ y: [0, -6, 0], scale: [1, 0.95, 1] }}
            transition={{
              duration: 1.4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Hand size={48} className="fill-white/25 rotate-[-45deg]" strokeWidth={2} />
          </motion.div>
        </motion.div>
      )}

      {/* Bubble */}
      <motion.div
        ref={bubbleRef}
        initial={{ opacity: 0, y: layout.placement === 'below' ? 12 : -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        onClick={onDismiss}
        className="fixed z-[10000] pointer-events-auto"
        style={{
          left: layout.bubbleLeft,
          top: layout.bubbleTop,
          width: layout.bubbleWidth,
        }}
      >
        <div className="relative rounded-2xl border border-blue-300/60 bg-blue-600 text-white shadow-xl p-4 cursor-pointer">
          {/* Arrow */}
          <div
            className={`absolute w-4 h-4 bg-blue-600 rotate-45 ${
              layout.placement === 'below' ? '-top-2' : '-bottom-2'
            }`}
            style={{ left: layout.arrowLeft }}
          />

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            className="absolute top-2 right-2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            aria-label={t('game:tutorial.close', '닫기')}
          >
            <X className="w-4 h-4" />
          </button>

          {/* Content */}
          <div className="flex items-start gap-3 pr-7">
            <Sparkles className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5 animate-pulse" />
            <div>
              <h3 className="font-bold text-sm mb-1">{title}</h3>
              <p className="text-xs text-blue-100 leading-relaxed whitespace-pre-wrap">{description}</p>
            </div>
          </div>

          {children && (
            <div className="mt-3 rounded-xl bg-blue-500/45 border border-blue-200/30 p-3 text-[11px] leading-relaxed">
              {children}
            </div>
          )}

          <p className="mt-2 text-[11px] text-blue-100/90 text-center">
            {t('game:tutorial.tapToDismiss', '터치하여 닫기')}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};