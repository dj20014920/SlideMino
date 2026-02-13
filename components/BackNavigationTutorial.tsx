import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'tutorial_back_nav_seen_v1';

export const BackNavigationTutorial: React.FC = () => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 390
  );
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

    const timer = setTimeout(() => {
      if (hasSeenTutorial()) {
        setIsVisible(false);
        return;
      }
      setIsVisible(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const handleDismiss = () => {
    dismissedRef.current = true;
    setIsVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Ignore storage failure in-session.
    }
  };

  const swipeDistance = Math.max(96, Math.min(150, Math.floor(viewportWidth * 0.45)));

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-[2px] flex items-center justify-center touch-none"
        onClick={handleDismiss}
      >
        <div className="relative w-full h-full max-w-lg mx-auto pointer-events-none px-3">
          <div className="absolute inset-x-0 top-[44%] -translate-y-1/2 h-52 flex items-center">
            <motion.div
              initial={{ x: 20, opacity: 0, scale: 0.8 }}
              animate={{
                x: [20, swipeDistance, swipeDistance],
                opacity: [0, 1, 0],
                scale: [1, 1, 0.9]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
                times: [0, 0.7, 1]
              }}
              className="absolute left-3 top-1/2 -mt-6"
            >
              <div className="relative">
                <div className="absolute -inset-4 bg-white/20 rounded-full blur-xl" />
                <Hand
                  size={48}
                  className="relative text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] fill-white/20"
                  strokeWidth={1.5}
                />
              </div>
            </motion.div>

            <svg
              className="absolute left-14 top-1/2 -translate-y-1/2 h-12 pointer-events-none overflow-visible"
              style={{ width: `${swipeDistance + 12}px` }}
            >
              <defs>
                <linearGradient id="swipeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="white" stopOpacity="0" />
                  <stop offset="50%" stopColor="white" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </linearGradient>
              </defs>
              <motion.path
                d={`M 0,24 L ${Math.max(80, swipeDistance - 10)},24`}
                stroke="url(#swipeGradient)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={Math.max(80, swipeDistance - 10)}
                initial={{ strokeDashoffset: Math.max(80, swipeDistance - 10), opacity: 0 }}
                animate={{ strokeDashoffset: 0, opacity: [0, 1, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  times: [0, 0.7, 1]
                }}
              />
            </svg>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute left-0 right-0 px-4 text-center"
            style={{ bottom: 'max(16px, calc(env(safe-area-inset-bottom) + 12px))' }}
          >
            <div className="mx-auto max-w-sm bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 shadow-xl">
              <div className="flex items-center justify-center gap-2 text-white">
                <ArrowLeft className="w-5 h-5 animate-pulse flex-shrink-0" />
                <span className="font-bold text-base sm:text-lg break-keep leading-snug">
                  {t('game:tutorial.swipeBack', '오른쪽으로 스와이프하여 뒤로가기')}
                </span>
              </div>
            </div>
            <p className="text-white/70 text-xs sm:text-sm mt-2 font-medium animate-pulse">
              {t('game:tutorial.tapToDismiss', '터치하여 닫기')}
            </p>
          </motion.div>
        </div>
      </div>
    </AnimatePresence>
  );
};
