import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import type { SequentialStep } from '../services/sequentialOnboardingService';
import { getSequentialStepConfig } from '../services/sequentialOnboardingService';

interface SequentialOnboardingOverlayProps {
  step: SequentialStep | null;
  visible: boolean;
  onAdvance: () => void;
  onOpenFeature?: (step: SequentialStep) => void;
  index: number;
  total: number;
}

const EDGE_PADDING_PX = 16;
const TARGET_PADDING_PX = 10;
const TARGET_GAP_PX = 14;
const MIN_CARD_WIDTH_PX = 200;
const MAX_CARD_WIDTH_PX = 360;
/** 타겟 요소를 찾을 수 없을 때 자동으로 넘어가는 시간 (ms) */
const AUTO_ADVANCE_DELAY_MS = 1500;

const round = Math.round;

const clamp = (value: number, min: number, max: number): number => {
  if (min > max) return min;
  return Math.min(Math.max(value, min), max);
};

interface SpotlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ViewportDims {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
}

const getViewportDims = (): ViewportDims => {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844, offsetTop: 0, offsetLeft: 0 };
  }
  const viewport = window.visualViewport;
  return {
    width: round(viewport ? viewport.width : window.innerWidth),
    height: round(viewport ? viewport.height : window.innerHeight),
    offsetTop: round(viewport ? viewport.offsetTop : 0),
    offsetLeft: round(viewport ? viewport.offsetLeft : 0),
  };
};

const isElementDisplayable = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  const viewport = getViewportDims();
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    rect.right > viewport.offsetLeft &&
    rect.left < viewport.offsetLeft + viewport.width &&
    rect.bottom > viewport.offsetTop &&
    rect.top < viewport.offsetTop + viewport.height
  );
};

const findDisplayableTarget = (selector: string): HTMLElement | null => {
  // 설계의도 결정3: data-tutorial-anchor를 우선, id는 폴백
  const parts = selector.split(',').map(s => s.trim());
  const anchorPart = parts.find(p => p.includes('[data-tutorial-anchor'));
  const idPart = parts.find(p => p.startsWith('#') && !p.includes('['));
  if (anchorPart) {
    const found = Array.from(document.querySelectorAll<HTMLElement>(anchorPart)).find(isElementDisplayable);
    if (found) return found;
  }
  if (idPart) {
    const found = Array.from(document.querySelectorAll<HTMLElement>(idPart)).find(isElementDisplayable);
    if (found) return found;
  }
  return null;
};

/**
 * 순차 인터랙티브 온보딩 오버레이.
 * 스포트라이트 + 한줄요약 + 지금열기버튼 + 탭하여 넘어감.
 */
export const SequentialOnboardingOverlay: React.FC<SequentialOnboardingOverlayProps> = ({
  step,
  visible,
  onAdvance,
  onOpenFeature,
  index,
  total,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState<ViewportDims>(() => getViewportDims());
  const rafRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [cardHeight, setCardHeight] = useState(0);

  const config = step ? getSequentialStepConfig(step) : null;
  const text = config
    ? String(t(config.textKey, config.fallbackText))
    : '';

  const updateSpotlight = useCallback(() => {
    if (!step) {
      setSpotlight(null);
      setViewport(getViewportDims());
      return;
    }

    const nextViewport = getViewportDims();
    setViewport(nextViewport);

    const targetEl = config ? findDisplayableTarget(config.selector) : null;
    if (!targetEl) {
      setSpotlight(null);
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    setSpotlight({
      left: rect.left - nextViewport.offsetLeft - TARGET_PADDING_PX,
      top: rect.top - nextViewport.offsetTop - TARGET_PADDING_PX,
      width: rect.width + TARGET_PADDING_PX * 2,
      height: rect.height + TARGET_PADDING_PX * 2,
    });
  }, [step, config]);

  useEffect(() => {
    if (!visible) {
      setSpotlight(null);
      return;
    }

    updateSpotlight();

    const scheduleUpdate = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(updateSpotlight);
    };

    window.addEventListener('resize', scheduleUpdate);
    window.addEventListener('orientationchange', scheduleUpdate);
    window.addEventListener('scroll', scheduleUpdate, true);
    window.visualViewport?.addEventListener('resize', scheduleUpdate);
    window.visualViewport?.addEventListener('scroll', scheduleUpdate);

    const mutationObserver = new MutationObserver(scheduleUpdate);
    // data-tutorial-anchor 변경만 감지. 나머지 레이아웃 변경은 resize/scroll 이벤트로 대응.
    const targetEls = config ? Array.from(document.querySelectorAll<HTMLElement>(config.selector)) : [];
    const observeTarget = targetEls.length > 0 ? targetEls : [document.body];
    observeTarget.forEach((el) => {
      mutationObserver.observe(el, {
        subtree: targetEls.length === 0,
        childList: false,
        attributes: true,
        attributeFilter: ['data-tutorial-anchor'],
      });
    });

    return () => {
      window.removeEventListener('resize', scheduleUpdate);
      window.removeEventListener('orientationchange', scheduleUpdate);
      window.removeEventListener('scroll', scheduleUpdate, true);
      window.visualViewport?.removeEventListener('resize', scheduleUpdate);
      window.visualViewport?.removeEventListener('scroll', scheduleUpdate);
      mutationObserver.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [visible, updateSpotlight]);

  useEffect(() => {
    if (!visible || !cardRef.current) return;
    const measure = () => {
      if (!cardRef.current) return;
      const nextHeight = round(cardRef.current.getBoundingClientRect().height);
      setCardHeight((prev) => (Math.abs(prev - nextHeight) < 0.5 ? prev : nextHeight));
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(cardRef.current);
    return () => resizeObserver.disconnect();
  }, [visible, text]);

  // 타겟 요소를 찾을 수 없을 때(spotlight === null) 자동으로 다음 단계로 진행
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (!visible || !step || spotlight !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
      return;
    }
    autoAdvanceTimerRef.current = setTimeout(() => {
      onAdvance();
    }, AUTO_ADVANCE_DELAY_MS);
    return () => {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = undefined;
    };
  }, [visible, step, spotlight, onAdvance]);

  const cardLayout = (() => {
    if (!spotlight) return null;

    const cardWidth = clamp(viewport.width - EDGE_PADDING_PX * 2, MIN_CARD_WIDTH_PX, MAX_CARD_WIDTH_PX);
    const targetCenterX = spotlight.left + round(spotlight.width / 2);
    const cardLeft = clamp(
      round(targetCenterX - cardWidth / 2),
      EDGE_PADDING_PX,
      viewport.width - cardWidth - EDGE_PADDING_PX,
    );
    const resolvedCardHeight = cardHeight || 80;
    const candidateBelowTop = spotlight.top + spotlight.height + TARGET_GAP_PX;
    const candidateAboveTop = spotlight.top - TARGET_GAP_PX - resolvedCardHeight;
    const canPlaceBelow = candidateBelowTop + resolvedCardHeight <= viewport.height - EDGE_PADDING_PX;
    const canPlaceAbove = candidateAboveTop >= EDGE_PADDING_PX;
    const placement: 'above' | 'below' = canPlaceBelow || !canPlaceAbove ? 'below' : 'above';
    const cardTop =
      placement === 'below'
        ? clamp(candidateBelowTop, EDGE_PADDING_PX, viewport.height - resolvedCardHeight - EDGE_PADDING_PX)
        : clamp(candidateAboveTop, EDGE_PADDING_PX, viewport.height - resolvedCardHeight - EDGE_PADDING_PX);
    const arrowLeft = clamp(round(targetCenterX - cardLeft - 8), 24, cardWidth - 28);

    return { left: cardLeft, top: cardTop, width: cardWidth, arrowLeft, placement };
  })();

  const handleTap = useCallback(() => {
    onAdvance();
  }, [onAdvance]);

  const handleCtaTap = useCallback(() => {
    if (step && onOpenFeature) {
      onOpenFeature(step);
    }
  }, [step, onOpenFeature]);

  const openFeatureLabel = String(t('game:onboarding.openFeature', '지금 열기'));
  const tapToContinueLabel = String(t('game:onboarding.tapToContinue', '터치 시 다음으로'));

  const cardContent = (withSpotlight: boolean) => (
    <div
      className={withSpotlight ? 'relative rounded-2xl border border-white/80 bg-white/95 px-5 py-3 shadow-2xl shadow-slate-950/25 backdrop-blur-md' : 'w-full max-w-xs rounded-2xl border border-white/80 bg-white/95 px-5 py-3 shadow-2xl shadow-slate-950/25 backdrop-blur-md'}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-relaxed text-slate-800 flex-1">
          {text}
        </p>
        <span className="shrink-0 text-[10px] font-medium text-slate-400 mt-0.5">
          {index + 1}/{total}
        </span>
      </div>

      {onOpenFeature && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleCtaTap();
          }}
          className="mt-2 w-full rounded-lg border border-blue-200 bg-blue-50 py-1.5 text-xs font-semibold text-blue-700 active:bg-blue-100 active:scale-[0.98] transition-all"
        >
          {openFeatureLabel}
        </button>
      )}

      <p className="mt-1.5 text-[10px] font-medium text-slate-400 text-center">
        {tapToContinueLabel}
      </p>
    </div>
  );

  const overlayContent = (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          ref={overlayRef}
          key="sequential-onboarding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9998]"
          onClick={handleTap}
        >
          {/* 반투명 배경 */}
          <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" />

          {/* 스포트라이트 */}
          {spotlight && (
            <motion.div
              className="absolute rounded-2xl border-2 border-blue-400/70 pointer-events-none"
              style={{
                left: spotlight.left,
                top: spotlight.top,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 28px rgba(37, 99, 235, 0.4)',
              }}
              animate={{ scale: [1, 1.025, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {/* 한줄요약 카드 */}
          {cardLayout ? (
            <div
              className="fixed"
              style={{
                left: cardLayout.left,
                top: cardLayout.top,
                width: cardLayout.width,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, scale: 0.96, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {cardLayout && (
                  <div
                    className={`absolute h-3 w-3 rotate-45 border-white/80 bg-white/95 ${
                      cardLayout.placement === 'below'
                        ? '-top-1.5 border-l border-t'
                        : '-bottom-1.5 border-b border-r'
                    }`}
                    style={{ left: cardLayout.arrowLeft }}
                  />
                )}
                {cardContent(true)}
              </motion.div>
            </div>
          ) : (
            <div
              className="absolute inset-0 flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <motion.div
                ref={cardRef}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                {cardContent(false)}
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlayContent, document.body);
};