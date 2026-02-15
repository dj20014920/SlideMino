import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { hexToRgb } from '../services/blockCustomization';

type SkinAcquisitionOverlayProps = {
  skinHex: string;
  onComplete: () => void;
};

/**
 * 스킨 획득 애니메이션 오버레이
 * LoadingScreen.tsx의 merge 애니메이션 패턴을 재사용하되,
 * 40-50% 느린 타이밍 + 획득 색상 발광 효과 적용.
 * 총 ~3.4초 (phase0: 100ms, phase1: 800ms, phase2: 2500ms)
 */
export const SkinAcquisitionOverlay: React.FC<SkinAcquisitionOverlayProps> = ({ skinHex, onComplete }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(0);

  const rgb = hexToRgb(skinHex);
  const glowColor = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.6)`;

  useEffect(() => {
    const run = async () => {
      setPhase(0);
      await new Promise(r => setTimeout(r, 100));
      setPhase(1);
      await new Promise(r => setTimeout(r, 800));
      setPhase(2);
      await new Promise(r => setTimeout(r, 2500));
      onComplete();
    };
    run();
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl"
    >
      <div className="relative flex flex-col items-center">
        {/* 블록 합성 애니메이션 */}
        <div className="relative h-24 w-48 flex items-center justify-center mb-8">
          <AnimatePresence mode="popLayout">
            {phase < 2 ? (
              <motion.div
                key="block-pair"
                className="absolute inset-0"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* 왼쪽 블록 */}
                <motion.div
                  initial={{ x: -40, opacity: 0, scale: 0.8 }}
                  animate={{
                    x: phase === 0 ? -40 : 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  className="absolute w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold bg-white text-gray-800 border border-gray-200 shadow-lg"
                >
                  ?
                </motion.div>

                {/* 오른쪽 블록 */}
                <motion.div
                  initial={{ x: 40, opacity: 0, scale: 0.8 }}
                  animate={{
                    x: phase === 0 ? 40 : 0,
                    opacity: 1,
                    scale: 1,
                  }}
                  transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  className="absolute w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold bg-white text-gray-800 border border-gray-200 shadow-lg"
                >
                  ?
                </motion.div>
              </motion.div>
            ) : (
              /* 합성 완료 블록: 획득 색상으로 발광 */
              <motion.div
                key="block-merged"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{
                  scale: [1, 1.3, 1.1],
                  opacity: 1,
                  rotate: [0, -3, 3, 0],
                }}
                transition={{ duration: 0.7, ease: 'backOut' }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center z-10"
                style={{
                  backgroundColor: skinHex,
                  boxShadow: `0 0 50px ${glowColor}, 0 0 100px ${glowColor}`,
                }}
              />
            )}
          </AnimatePresence>
        </div>

        {/* 획득 완료 텍스트 */}
        {phase === 2 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-2"
          >
            <div className="text-xl font-bold text-white">
              {t('modals:skin.acquired')}
            </div>
            <div
              className="px-4 py-1.5 rounded-full text-sm font-mono font-semibold text-white/90 border border-white/20"
              style={{ backgroundColor: `${skinHex}66` }}
            >
              {skinHex.toUpperCase()}
            </div>
            <div className="text-sm text-white/60 mt-1">
              {t('modals:skin.addedToCollection')}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
