import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Hand, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createTargetRectTracker } from '../services/tutorialTargetGeometry';

const STORAGE_KEY = 'tutorial_game_mode_seen_v1';
const EDGE_PADDING_PX = 12;
const TARGET_GAP_PX = 12;
const DEFAULT_BUBBLE_HEIGHT_PX = 220;
const MIN_BUBBLE_WIDTH_PX = 220;
const MAX_BUBBLE_WIDTH_PX = 360;
const TARGET_RETRY_INTERVAL_MS = 250;
const MAX_TARGET_CHECK_ATTEMPTS = 20;

const round = Math.round;

const clamp = (value: number, min: number, max: number): number => {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
};

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

interface GameModeTutorialProps {
  enabled?: boolean;
  suppressed?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export const GameModeTutorial: React.FC<GameModeTutorialProps> = ({
  enabled = true,
  suppressed = false,
  onComplete,
  onSkip,
}) => {
  const { t } = useTranslation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const [viewport, setViewport] = useState(() => getViewportDims());
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dismissedRef = useRef(false);
  const completionNotifiedRef = useRef(false);

  const hasSeenTutorial = (): boolean => {
    if (dismissedRef.current) return true;
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return dismissedRef.current;
    }
  };

  const completeTutorial = (reason: 'complete' | 'skip') => {
    if (completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    dismissedRef.current = true;
    setTargetRect(null);
    setIsVisible(false);

    if (reason === 'complete') {
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // Ignore storage failure in-session.
      }
    }

    if (reason === 'skip') {
      if (onSkip) {
        onSkip();
        return;
      }
    }
    onComplete?.();
  };

  useEffect(() => {
    if (!enabled || suppressed || hasSeenTutorial()) {
      setTargetRect(null);
      setIsVisible(false);
      return;
    }

    let attempts = 0;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let tracker: ReturnType<typeof createTargetRectTracker> | null = null;

    const updateViewport = () => setViewport(getViewportDims());

    const clearRetryTimer = () => {
      if (!retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = null;
    };

    const scheduleRetry = () => {
      if (cancelled || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        if (cancelled || hasSeenTutorial()) return;
        attempts += 1;
        if (attempts >= MAX_TARGET_CHECK_ATTEMPTS) {
          completeTutorial('skip');
          return;
        }
        tracker?.refresh();
        scheduleRetry();
      }, TARGET_RETRY_INTERVAL_MS);
    };

    updateViewport();
    tracker = createTargetRectTracker({
      getTarget: () => document.getElementById('mode-btn-beginner'),
      getOverlay: () => overlayRef.current,
      anchorMode: 'self',
      onRect: (rect) => {
        if (cancelled || hasSeenTutorial()) return;
        updateViewport();
        attempts = 0;
        clearRetryTimer();
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
        setIsVisible(true);
      },
      onMissing: () => {
        if (cancelled || hasSeenTutorial()) return;
        updateViewport();
        setTargetRect(null);
        setIsVisible(false);
        scheduleRetry();
      },
    });

    return () => {
      cancelled = true;
      clearRetryTimer();
      tracker?.cleanup();
      tracker = null;
    };
  }, [enabled, suppressed, onComplete, onSkip]);

  useEffect(() => {
    if (!isVisible || !bubbleRef.current) return;

    const measure = () => {
      if (!bubbleRef.current) return;
      const nextHeight = round(bubbleRef.current.getBoundingClientRect().height);
      setBubbleHeight((prev) => (Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight));
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(bubbleRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [isVisible, t]);

  const handleDismiss = () => {
    completeTutorial('complete');
  };

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
    const canPlaceBelow =
      candidateBelowTop + resolvedBubbleHeight <= vpHeight - EDGE_PADDING_PX;
    const canPlaceAbove = candidateAboveTop >= EDGE_PADDING_PX;
    const placement: 'above' | 'below' = canPlaceBelow || !canPlaceAbove ? 'below' : 'above';

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
      vpHeight,
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
  }, [bubbleHeight, targetRect, viewport]);

  if (!enabled || suppressed || !isVisible || !targetRect || !layout) return null;

  return createPortal(
    <AnimatePresence>
      <div ref={overlayRef} className="fixed inset-0 z-[60] pointer-events-none">
        {/* Highlight Box around Target */}
        <div
          className="absolute rounded-2xl border-2 border-blue-200/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
          style={{
            left: clamp(layout.targetLeft - 4, EDGE_PADDING_PX, layout.vpWidth - 16),
            top: clamp(layout.targetTop - 4, EDGE_PADDING_PX, layout.vpHeight - 16),
            width: layout.targetWidth + 8,
            height: layout.targetHeight + 8,
          }}
        />

        {/* Hand Pointer */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
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

        {/* Bubble */}
        <motion.div
          ref={bubbleRef}
          initial={{ opacity: 0, y: layout.placement === 'below' ? 12 : -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="absolute pointer-events-auto"
          style={{
            left: layout.bubbleLeft,
            top: layout.bubbleTop,
            width: layout.bubbleWidth,
          }}
        >
          <div className="relative rounded-2xl border border-blue-300/60 bg-blue-600 text-white shadow-xl p-4">
            <div
              className={`absolute w-4 h-4 bg-blue-600 rotate-45 ${
                layout.placement === 'below' ? '-top-2' : '-bottom-2'
              }`}
              style={{ left: layout.arrowLeft }}
            />

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDismiss();
              }}
              className="absolute top-2 right-2 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label={t('game:tutorial.close', '닫기')}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-start gap-3 pr-7">
              <Sparkles className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <h3 className="font-bold text-sm mb-1">
                  {t('game:tutorial.recommendTitle', '첫 게임은 여기서 시작하세요!')}
                </h3>
                <p className="text-xs text-blue-100 leading-relaxed">
                  {t('game:tutorial.recommendDesc', '첫 게임은 기본 7×7 모드를 추천합니다.')}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-blue-500/45 border border-blue-200/30 p-3 text-[11px] leading-relaxed">
              <p className="font-semibold text-blue-50 mb-1">
                {t('game:tutorial.modeGuideTitle', '모드 한눈에 보기')}
              </p>
              <ul className="space-y-0.5 text-blue-100">
                <li>{t('game:tutorial.modeGuideBeginner', '뉴비 7×7: 공간이 넓어 실수 복구가 쉽습니다.')}</li>
                <li>{t('game:tutorial.modeGuideNormal', '일반 5×5: 표준 밸런스 모드입니다.')}</li>
                <li>{t('game:tutorial.modeGuideExpert', '고수 4×4: 공간이 빠르게 막히는 고난도 모드입니다.')}</li>
              </ul>
            </div>

            <p className="mt-2 text-[11px] text-blue-100/90">
              {t('game:tutorial.tapToDismissMode', '말풍선을 터치하면 닫힙니다.')}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};