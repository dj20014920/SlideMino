import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { Palette, Play, ClipboardList } from 'lucide-react';
import { getKstDateString } from '../services/streakService';

// ── Daily launch tracking ──
const DAILY_LAUNCH_STORAGE_KEY = 'slidemino_daily_launch_modal_date';

export function isFirstLaunchToday(): boolean {
  try {
    const today = getKstDateString();
    const stored = localStorage.getItem(DAILY_LAUNCH_STORAGE_KEY);
    return stored !== today;
  } catch {
    return true;
  }
}

export function markDailyLaunchShown(): void {
  try {
    const today = getKstDateString();
    localStorage.setItem(DAILY_LAUNCH_STORAGE_KEY, today);
  } catch {
    // ignore
  }
}

// ── First-time player tracking ──
const HAS_EVER_PLAYED_KEY = 'slidemino_has_ever_played';

export function hasEverPlayed(): boolean {
  try {
    return localStorage.getItem(HAS_EVER_PLAYED_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markEverPlayed(): void {
  try {
    localStorage.setItem(HAS_EVER_PLAYED_KEY, 'true');
  } catch {
    // ignore
  }
}

// ── Props ──
export type DailyLaunchModalProps = {
  open: boolean;
  onClose: () => void;
  onGoToSkinDraw: () => void;
  onContinueGame: () => void;
  onGoToMissions: () => void;
  hasActiveGame: boolean;
  isPremiumUiThemeActive: boolean;
  premiumWindowClassName: string;
  premiumWindowBodyClassName: string;
  premiumTitleBarClassName: string;
  premiumTitleBarTextClassName: string;
  premiumTitleBarControlsClassName: string;
  premiumModalWindowClassName: string;
  premiumPillButtonClassName: string;
  premiumGameButtonClassName: string;
};

const DailyLaunchModal: React.FC<DailyLaunchModalProps> = ({
  open,
  onClose,
  onGoToSkinDraw,
  onContinueGame,
  onGoToMissions,
  hasActiveGame,
  isPremiumUiThemeActive,
  premiumWindowClassName,
  premiumWindowBodyClassName,
  premiumTitleBarClassName,
  premiumTitleBarTextClassName,
  premiumTitleBarControlsClassName,
  premiumModalWindowClassName,
  premiumPillButtonClassName,
  premiumGameButtonClassName,
}) => {
  const { t } = useTranslation();
  const hasMarkedRef = useRef(false);

  // Mark as shown when modal opens
  useEffect(() => {
    if (!open) {
      hasMarkedRef.current = false;
      return;
    }
    if (hasMarkedRef.current) return;
    hasMarkedRef.current = true;
    markDailyLaunchShown();
  }, [open]);

  const handleSkinDraw = useCallback(() => {
    onGoToSkinDraw();
    onClose();
  }, [onGoToSkinDraw, onClose]);

  const handleContinue = useCallback(() => {
    onContinueGame();
    onClose();
  }, [onContinueGame, onClose]);

  const handleMissions = useCallback(() => {
    onGoToMissions();
    onClose();
  }, [onGoToMissions, onClose]);

  const buttonBaseClass = useMemo(() => {
    const base = 'w-full rounded-2xl px-4 py-3.5 text-base font-bold shadow-lg active:scale-[0.97] transition-all duration-150 flex items-center justify-center gap-2.5';
    if (isPremiumUiThemeActive) {
      return `${base} ${premiumGameButtonClassName || premiumPillButtonClassName}`;
    }
    return base;
  }, [isPremiumUiThemeActive, premiumGameButtonClassName, premiumPillButtonClassName]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`
              mx-4 w-full max-w-sm rounded-3xl
              ${isPremiumUiThemeActive
                ? `${premiumWindowClassName} ${premiumModalWindowClassName}`
                : 'bg-white/95 backdrop-blur-md'
              }
              overflow-hidden shadow-2xl
            `}
          >
            {/* Title bar (premium) */}
            {isPremiumUiThemeActive && (
              <div className={premiumTitleBarClassName}>
                <div className={premiumTitleBarTextClassName}>
                  {t('game:dailyLaunch.title', '오늘의 첫 플레이!')}
                </div>
                <div className={premiumTitleBarControlsClassName}>
                  <button aria-label="Close" onClick={onClose} />
                </div>
              </div>
            )}

            {/* Body */}
            <div className={`
              ${isPremiumUiThemeActive ? premiumWindowBodyClassName : 'p-6'}
              text-center
            `}>
              {/* Icon */}
              {!isPremiumUiThemeActive && (
                <div className="mb-4 text-5xl">🎮</div>
              )}

              {/* Title */}
              {!isPremiumUiThemeActive && (
                <h2 className="text-xl font-extrabold text-gray-900 mb-1">
                  {t('game:dailyLaunch.title', '오늘의 첫 플레이!')}
                </h2>
              )}
              <p className={`
                mt-1 text-sm leading-relaxed whitespace-pre-line
                ${isPremiumUiThemeActive ? '' : 'text-gray-600'}
              `}>
                {t('game:dailyLaunch.description', '블록 슬라이드에 오신 것을 환영합니다!\n오늘은 무엇을 하시겠어요?')}
              </p>

              {/* Buttons */}
              <div className="mt-6 flex flex-col gap-3">
                {/* 스킨 뽑으러 가기 — Primary CTA */}
                <button
                  type="button"
                  onClick={handleSkinDraw}
                  className={`
                    ${buttonBaseClass}
                    bg-gradient-to-r from-violet-500 to-fuchsia-500
                    border border-violet-400/30
                    text-white
                    hover:from-violet-600 hover:to-fuchsia-600
                  `}
                >
                  <Palette size={18} />
                  {t('game:dailyLaunch.goToSkinDraw', '스킨 뽑으러 가기')}
                </button>

                {/* 게임 이어하기 — Secondary */}
                <button
                  type="button"
                  onClick={handleContinue}
                  disabled={!hasActiveGame}
                  className={`
                    ${buttonBaseClass}
                    ${hasActiveGame
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border border-emerald-400/30 hover:from-emerald-600 hover:to-teal-600'
                      : isPremiumUiThemeActive
                        ? 'bg-gray-300/50 text-gray-500 cursor-not-allowed border border-gray-400/20'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                    }
                  `}
                >
                  <Play size={18} />
                  {t('game:dailyLaunch.continueGame', '게임 이어하기')}
                </button>

                {/* 미션 확인하기 — Secondary */}
                <button
                  type="button"
                  onClick={handleMissions}
                  className={`
                    ${buttonBaseClass}
                    ${isPremiumUiThemeActive
                      ? 'bg-white/20 text-white border border-white/20 hover:bg-white/30'
                      : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200'
                    }
                  `}
                >
                  <ClipboardList size={18} />
                  {t('game:dailyLaunch.goToMissions', '미션 확인하기')}
                </button>
              </div>

              {/* 닫기 (하단) */}
              <button
                type="button"
                onClick={onClose}
                className={`
                  mt-4 text-xs font-semibold
                  ${isPremiumUiThemeActive ? 'text-white/60 hover:text-white/90' : 'text-gray-400 hover:text-gray-600'}
                  transition-colors
                `}
              >
                {t('common:buttons.close', '닫기')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DailyLaunchModal;
