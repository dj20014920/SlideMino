import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TutorialTooltip } from './TutorialTooltip';
import { ONBOARDING_STORAGE_KEYS, SKIN_TARGET_POLICY } from '../services/onboardingOrchestrator';

interface SkinFeatureTutorialProps {
  isEnabled: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
}

export const SkinFeatureTutorial: React.FC<SkinFeatureTutorialProps> = ({
  isEnabled,
  onComplete,
  onSkip,
}) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [targetId, setTargetId] = useState<string | null>(null);
  const dismissedRef = React.useRef(false);
  const skipNotifiedRef = React.useRef(false);
  const completionNotifiedRef = React.useRef(false);
  const persistedSeenRef = React.useRef<boolean | null>(null);

  const hasSeenTutorial = (): boolean => {
    try {
      const persistedSeen = Boolean(localStorage.getItem(ONBOARDING_STORAGE_KEYS.skinFeatureTutorialSeen));
      if (persistedSeenRef.current === true && !persistedSeen) {
        dismissedRef.current = false;
        skipNotifiedRef.current = false;
        completionNotifiedRef.current = false;
      }
      persistedSeenRef.current = persistedSeen;
      return dismissedRef.current || persistedSeen;
    } catch {
      return dismissedRef.current;
    }
  };

  const persistTutorialSeen = () => {
    dismissedRef.current = true;
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEYS.skinFeatureTutorialSeen, 'true');
    } catch {
      // Ignore storage failure in-session.
    }
  };

  const notifyCompletionOnce = () => {
    if (completionNotifiedRef.current) return;
    completionNotifiedRef.current = true;
    onComplete?.();
  };

  useEffect(() => {
    if (!isEnabled || hasSeenTutorial()) {
      setIsVisible(false);
      setTargetId(null);
      return;
    }

    let completed = false;
    let attempts = 0;
    let rafId: number | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const isElementDisplayable = (el: HTMLElement): boolean => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };

    const findSkinTarget = (): HTMLElement | null => {
      const primary = document.querySelector<HTMLElement>(SKIN_TARGET_POLICY.primarySelector);
      if (primary && isElementDisplayable(primary)) return primary;
      const anchored = document.querySelector<HTMLElement>(SKIN_TARGET_POLICY.fallbackSelector);
      if (anchored && isElementDisplayable(anchored)) return anchored;
      return null;
    };

    const checkTarget = () => {
      if (completed) return;

      if (hasSeenTutorial()) {
        setIsVisible(false);
        setTargetId(null);
        completed = true;
        return;
      }

      const target = findSkinTarget();
      if (target) {
        if (!target.id) {
          target.id = SKIN_TARGET_POLICY.targetId;
        }
        setTargetId(target.id);
        setIsVisible(true);
        attempts = 0;
        return;
      }

      setIsVisible(false);
      setTargetId(null);
      attempts += 1;
      if (attempts >= SKIN_TARGET_POLICY.maxCheckAttempts) {
        completed = true;
        if (!skipNotifiedRef.current) {
          skipNotifiedRef.current = true;
          // Run callback on microtask so parent onboarding step transition does not race the current effect teardown.
          Promise.resolve().then(() => {
            if (onSkip) {
              onSkip();
            } else {
              notifyCompletionOnce();
            }
          });
        }
        return;
      }
      const retryDelay =
        attempts >= Math.ceil(SKIN_TARGET_POLICY.maxCheckAttempts / 2)
          ? SKIN_TARGET_POLICY.deferredRetryIntervalMs
          : SKIN_TARGET_POLICY.retryIntervalMs;

      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(scheduleCheck, retryDelay);
    };

    const scheduleCheck = () => {
      if (completed) return;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(checkTarget);
    };

    const mutationObserver = new MutationObserver(scheduleCheck);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['id', 'class', 'style', 'hidden'],
    });

    scheduleCheck();
    window.addEventListener('resize', scheduleCheck);
    window.addEventListener('orientationchange', scheduleCheck);
    window.addEventListener('scroll', scheduleCheck, true);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (rafId !== null) cancelAnimationFrame(rafId);
      mutationObserver.disconnect();
      window.removeEventListener('resize', scheduleCheck);
      window.removeEventListener('orientationchange', scheduleCheck);
      window.removeEventListener('scroll', scheduleCheck, true);
    };
  }, [isEnabled, onComplete, onSkip]);

  const markDismissed = () => {
    setIsVisible(false);
    setTargetId(null);
    persistTutorialSeen();
    notifyCompletionOnce();
  };

  if (!isVisible || !targetId) return null;

  return (
    <TutorialTooltip
      isVisible={isVisible}
      targetId={targetId}
      onDismiss={markDismissed}
      title={t('game:tutorial.skinTitle', '스킨 기능')}
      description={t('game:tutorial.skinDesc', '나만의 블럭 스타일을 꾸며보세요!')}
      forcePlacement="above"
    />
  );
};
