import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'tutorial_game_mode_seen_v1';
const EDGE_PADDING_PX = 12;
const TARGET_GAP_PX = 12;
const DEFAULT_BUBBLE_HEIGHT_PX = 220;
const MIN_BUBBLE_WIDTH_PX = 220;
const MAX_BUBBLE_WIDTH_PX = 360;

const clamp = (value: number, min: number, max: number): number => {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
};

interface GameModeTutorialProps {
  suppressed?: boolean;
}

export const GameModeTutorial: React.FC<GameModeTutorialProps> = ({ suppressed = false }) => {
  const { t } = useTranslation();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [bubbleHeight, setBubbleHeight] = useState(0);
  const [overlayOffset, setOverlayOffset] = useState({ top: 0, left: 0 });
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 390,
    height: typeof window !== 'undefined' ? window.innerHeight : 844,
  }));
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dismissedRef = useRef(false);

  const hasSeenTutorial = (): boolean => {
    if (dismissedRef.current) return true;
    try {
      return Boolean(localStorage.getItem(STORAGE_KEY));
    } catch {
      return dismissedRef.current;
    }
  };

  useEffect(() => {
    if (hasSeenTutorial()) return;

    let rafId: number | null = null;

    const checkTarget = () => {
      if (hasSeenTutorial()) {
        setTargetRect(null);
        setIsVisible(false);
        return;
      }

      const el = document.getElementById('mode-btn-beginner');
      const nextViewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
      setViewport((prev) =>
        prev.width === nextViewport.width && prev.height === nextViewport.height
          ? prev
          : nextViewport
      );

      if (el) {
        setTargetRect(el.getBoundingClientRect());
        setIsVisible(true);
      } else {
        setTargetRect(null);
      }
    };

    const scheduleCheck = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(checkTarget);
    };

    const timer1 = setTimeout(scheduleCheck, 250);
    const timer2 = setTimeout(scheduleCheck, 700);
    const timer3 = setTimeout(scheduleCheck, 1200);

    scheduleCheck();
    window.addEventListener('resize', scheduleCheck);
    window.addEventListener('orientationchange', scheduleCheck);
    window.addEventListener('scroll', scheduleCheck, true);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleCheck);
      window.removeEventListener('orientationchange', scheduleCheck);
      window.removeEventListener('scroll', scheduleCheck, true);
    };
  }, []);

  useEffect(() => {
    if (!isVisible || !bubbleRef.current) return;

    const measure = () => {
      if (!bubbleRef.current) return;
      const nextHeight = bubbleRef.current.getBoundingClientRect().height;
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

  useEffect(() => {
    if (!isVisible) return;

    const measureOverlayOffset = () => {
      const rect = overlayRef.current?.getBoundingClientRect();
      if (!rect) return;
      setOverlayOffset((prev) =>
        prev.top === rect.top && prev.left === rect.left
          ? prev
          : { top: rect.top, left: rect.left }
      );
    };

    measureOverlayOffset();
    window.addEventListener('resize', measureOverlayOffset);
    window.addEventListener('orientationchange', measureOverlayOffset);

    return () => {
      window.removeEventListener('resize', measureOverlayOffset);
      window.removeEventListener('orientationchange', measureOverlayOffset);
    };
  }, [isVisible]);

  const handleDismiss = () => {
    dismissedRef.current = true;
    setTargetRect(null);
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failure in-session.
    }
  };

  const layout = useMemo(() => {
    if (!targetRect) return null;

    const viewportWidth =
      typeof window !== 'undefined' ? window.innerWidth : viewport.width;
    const viewportHeight =
      typeof window !== 'undefined' ? window.innerHeight : viewport.height;
    const usableHeight = Math.max(viewportHeight - overlayOffset.top, 0);
    const targetLeft = targetRect.left - overlayOffset.left;
    const targetTop = targetRect.top - overlayOffset.top;
    const targetBottom = targetRect.bottom - overlayOffset.top;
    const targetCenterX = targetLeft + targetRect.width / 2;

    const bubbleWidth = clamp(
      viewportWidth - EDGE_PADDING_PX * 2,
      MIN_BUBBLE_WIDTH_PX,
      MAX_BUBBLE_WIDTH_PX
    );
    const bubbleLeft = clamp(
      targetCenterX - bubbleWidth / 2,
      EDGE_PADDING_PX,
      viewportWidth - bubbleWidth - EDGE_PADDING_PX
    );
    const resolvedBubbleHeight = bubbleHeight || DEFAULT_BUBBLE_HEIGHT_PX;

    const candidateBelowTop = targetBottom + TARGET_GAP_PX;
    const candidateAboveTop = targetTop - TARGET_GAP_PX - resolvedBubbleHeight;
    const canPlaceBelow =
      candidateBelowTop + resolvedBubbleHeight <= usableHeight - EDGE_PADDING_PX;
    const canPlaceAbove = candidateAboveTop >= EDGE_PADDING_PX;
    const placement: 'above' | 'below' = canPlaceBelow || !canPlaceAbove ? 'below' : 'above';

    const bubbleTop =
      placement === 'below'
        ? clamp(
            candidateBelowTop,
            EDGE_PADDING_PX,
            usableHeight - resolvedBubbleHeight - EDGE_PADDING_PX
          )
        : clamp(
            candidateAboveTop,
            EDGE_PADDING_PX,
            usableHeight - resolvedBubbleHeight - EDGE_PADDING_PX
          );

    const arrowLeft = clamp(targetCenterX - bubbleLeft - 8, 20, bubbleWidth - 24);
    const handLeft = clamp(targetCenterX - 24, EDGE_PADDING_PX, viewportWidth - 56);
    const handTop = clamp(
      targetTop + targetRect.height / 2 - 24,
      EDGE_PADDING_PX,
      usableHeight - 56
    );

    return {
      viewportWidth,
      targetLeft,
      targetTop,
      bubbleWidth,
      bubbleLeft,
      bubbleTop,
      arrowLeft,
      handLeft,
      handTop,
      placement,
    };
  }, [bubbleHeight, overlayOffset.left, overlayOffset.top, targetRect, viewport.height, viewport.width]);

  if (suppressed || !isVisible || !targetRect || !layout) return null;

  return (
    <AnimatePresence>
      <div ref={overlayRef} className="fixed inset-0 z-[60] pointer-events-none">
        <div
          className="absolute rounded-2xl border-2 border-blue-200/80 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]"
          style={{
            left: clamp(layout.targetLeft - 4, EDGE_PADDING_PX, layout.viewportWidth - 16),
            top: clamp(layout.targetTop - 4, EDGE_PADDING_PX, viewport.height - 16),
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
        />

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
                  {t('game:tutorial.recommendDesc', '첫 게임은 기본 5×5 모드를 추천합니다.')}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl bg-blue-500/45 border border-blue-200/30 p-3 text-[11px] leading-relaxed">
              <p className="font-semibold text-blue-50 mb-1">
                {t('game:tutorial.modeGuideTitle', '모드 한눈에 보기')}
              </p>
              <ul className="space-y-0.5 text-blue-100">
                <li>{t('game:tutorial.modeGuideBeginner', '뉴비 7×7: 공간이 넓어 실수 복구가 쉽습니다.')}</li>
                <li>{t('game:tutorial.modeGuideNormal', '일반 5×5: 표준 밸런스, 첫 게임 추천 모드입니다.')}</li>
                <li>{t('game:tutorial.modeGuideExpert', '고수 4×4: 공간이 빠르게 막히는 고난도 모드입니다.')}</li>
              </ul>
            </div>

            <p className="mt-2 text-[11px] text-blue-100/90">
              {t('game:tutorial.tapToDismissMode', '말풍선을 터치하면 닫힙니다.')}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
