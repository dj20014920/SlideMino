import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Sparkles, X } from 'lucide-react';
import type { ScoreOnboardingStep } from '../services/onboardingService';

interface GameOnboardingOverlayProps {
  step: ScoreOnboardingStep | null;
  visible: boolean;
  onDismiss: () => void;
  onOpenFeature: () => void;
}

interface StepCopy {
  selector: string;
  titleKey: string;
  messageKey: string;
  actionKey: string;
  fallbackTitle: string;
  fallbackMessage: string;
  fallbackAction: string;
}

const STEP_COPY: Record<ScoreOnboardingStep, StepCopy> = {
  skin: {
    selector: '#menu-skin-btn, [data-tutorial-anchor="menu-skin-btn"]',
    titleKey: 'game:onboarding.skinTitle',
    messageKey: 'game:onboarding.skinHint',
    actionKey: 'game:onboarding.skinAction',
    fallbackTitle: '스킨 컬렉션',
    fallbackMessage: '스킨 화면에서 블록 스타일을 바꾸고 새 스킨을 뽑을 수 있어요.',
    fallbackAction: '스킨 화면 보기',
  },
  weekly_event: {
    selector: '#weekly-event-btn, [data-tutorial-anchor="weekly-event-btn"]',
    titleKey: 'game:onboarding.weeklyEventTitle',
    messageKey: 'game:onboarding.weeklyEventHint',
    actionKey: 'game:onboarding.weeklyEventAction',
    fallbackTitle: '주간 이벤트',
    fallbackMessage: '메뉴의 주간 이벤트에서 매주 바뀌는 규칙으로 도전하고 이벤트 랭킹을 확인할 수 있어요.',
    fallbackAction: '이벤트 화면 보기',
  },
  ranking: {
    selector: '#leaderboard-btn, [data-tutorial-anchor="leaderboard-btn"]',
    titleKey: 'game:onboarding.rankingTitle',
    messageKey: 'game:onboarding.rankingHint',
    actionKey: 'game:onboarding.rankingAction',
    fallbackTitle: '랭킹',
    fallbackMessage: '점수는 자동 저장되고, 랭킹 화면에서 내 기록과 이벤트 순위를 확인할 수 있어요.',
    fallbackAction: '랭킹 보기',
  },
};

const EDGE_PADDING_PX = 16;
const TARGET_PADDING_PX = 10;
const TARGET_GAP_PX = 14;
const DEFAULT_CARD_HEIGHT_PX = 180;
const MIN_CARD_WIDTH_PX = 260;
const MAX_CARD_WIDTH_PX = 380;

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

interface AnchoredLayout {
  left: number;
  top: number;
  width: number;
  arrowLeft: number;
  placement: 'above' | 'below';
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
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
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
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return candidates.find(isElementDisplayable) ?? null;
};

/**
 * 점수 기반 기능 안내 오버레이.
 * 메뉴의 실제 진입점을 강조하고 CTA로 해당 기능 화면을 바로 연다.
 */
export const GameOnboardingOverlay: React.FC<GameOnboardingOverlayProps> = ({
  step,
  visible,
  onDismiss,
  onOpenFeature,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState<ViewportDims>(() => getViewportDims());
  const [cardHeight, setCardHeight] = useState(0);
  const rafRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const updateSpotlight = useCallback(() => {
    if (!step) {
      setSpotlight(null);
      setViewport(getViewportDims());
      return;
    }

    const nextViewport = getViewportDims();
    setViewport(nextViewport);

    const targetEl = findDisplayableTarget(STEP_COPY[step].selector);
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
  }, [step]);

  useEffect(() => {
    if (!visible) {
      setSpotlight(null);
      return;
    }

    // 초기 측정
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
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['id', 'class', 'style', 'hidden', 'data-tutorial-anchor'],
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
  }, [visible, step, t]);

  const layout: AnchoredLayout | null = React.useMemo(() => {
    if (!spotlight) return null;

    const cardWidth = clamp(
      viewport.width - EDGE_PADDING_PX * 2,
      MIN_CARD_WIDTH_PX,
      MAX_CARD_WIDTH_PX
    );
    const targetCenterX = spotlight.left + round(spotlight.width / 2);
    const cardLeft = clamp(
      round(targetCenterX - cardWidth / 2),
      EDGE_PADDING_PX,
      viewport.width - cardWidth - EDGE_PADDING_PX
    );
    const resolvedCardHeight = cardHeight || DEFAULT_CARD_HEIGHT_PX;
    const candidateBelowTop = spotlight.top + spotlight.height + TARGET_GAP_PX;
    const candidateAboveTop = spotlight.top - TARGET_GAP_PX - resolvedCardHeight;
    const canPlaceBelow =
      candidateBelowTop + resolvedCardHeight <= viewport.height - EDGE_PADDING_PX;
    const canPlaceAbove = candidateAboveTop >= EDGE_PADDING_PX;
    const placement: 'above' | 'below' = canPlaceBelow || !canPlaceAbove ? 'below' : 'above';
    const cardTop =
      placement === 'below'
        ? clamp(candidateBelowTop, EDGE_PADDING_PX, viewport.height - resolvedCardHeight - EDGE_PADDING_PX)
        : clamp(candidateAboveTop, EDGE_PADDING_PX, viewport.height - resolvedCardHeight - EDGE_PADDING_PX);
    const arrowLeft = clamp(round(targetCenterX - cardLeft - 8), 24, cardWidth - 28);

    return {
      left: cardLeft,
      top: cardTop,
      width: cardWidth,
      arrowLeft,
      placement,
    };
  }, [cardHeight, spotlight, viewport]);

  const copy = step ? STEP_COPY[step] : null;
  const title = copy ? String(t(copy.titleKey, copy.fallbackTitle)) : '';
  const message = copy ? String(t(copy.messageKey, copy.fallbackMessage)) : '';
  const actionLabel = copy ? String(t(copy.actionKey, copy.fallbackAction)) : '';
  const laterLabel = String(t('game:onboarding.later', t('common:actions.later', '나중에')));

  const card = (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative w-full rounded-2xl border border-white/80 bg-white/95 p-4 text-left shadow-2xl shadow-slate-950/25 backdrop-blur-md"
      onClick={(event) => event.stopPropagation()}
    >
      {layout && (
        <div
          className={`absolute h-4 w-4 rotate-45 border-white/80 bg-white/95 ${
            layout.placement === 'below'
              ? '-top-2 border-l border-t'
              : '-bottom-2 border-b border-r'
          }`}
          style={{ left: layout.arrowLeft }}
        />
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 active:scale-95"
        aria-label={t('common:actions.close', '닫기')}
      >
        <X size={17} />
      </button>

      <div className="flex items-start gap-3 pr-9">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Sparkles size={18} />
        </div>
        <div>
          <h3 className="text-base font-extrabold leading-tight text-slate-950">{title}</h3>
          <p className="mt-1.5 text-sm font-medium leading-relaxed text-slate-600">{message}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[0.85fr_1.15fr] gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-11 rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-500 transition-colors active:bg-slate-200"
        >
          {laterLabel}
        </button>
        <button
          type="button"
          onClick={onOpenFeature}
          className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 text-sm font-extrabold text-white shadow-lg shadow-blue-600/20 transition-transform active:scale-[0.98]"
        >
          <span>{actionLabel}</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </motion.div>
  );

  const overlayContent = (
    <AnimatePresence>
      {visible && step && (
        <motion.div
          ref={overlayRef}
          key="game-onboarding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9998] pointer-events-auto"
          onClick={onDismiss}
        >
          {!spotlight && <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px]" />}

          {spotlight && (
            <motion.div
              className="absolute rounded-2xl border-2 border-white/90 pointer-events-none"
              style={{
                left: spotlight.left,
                top: spotlight.top,
                width: spotlight.width,
                height: spotlight.height,
                boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62), 0 0 28px rgba(37, 99, 235, 0.42)',
              }}
              animate={{ scale: [1, 1.025, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          {layout ? (
            <div
              className="fixed"
              style={{
                left: layout.left,
                top: layout.top,
                width: layout.width,
              }}
            >
              {card}
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="w-full max-w-sm">{card}</div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(overlayContent, document.body);
};
