import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { hexToRgb } from '../services/blockCustomization';

type SkinAcquisitionOverlayProps = {
  skinHex: string;
  onComplete: () => void;
};

const ANIMATION_TIMINGS = {
  prepare: 140,
  struggleMerge: 1700,
  fusionFlash: 520,
  revealHold: 1900,
} as const;

/**
 * 스킨 획득 애니메이션 오버레이
 * - 양쪽 블럭이 중앙으로 "힘겹게" 수렴하는 진동/저항감 연출
 * - 임계점에서 고광도 플래시 + 코로나(후광) + 플레어
 * - 최종 획득 스킨 블럭 노출
 */
export const SkinAcquisitionOverlay: React.FC<SkinAcquisitionOverlayProps> = ({ skinHex, onComplete }) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState(0); // 0=준비, 1=힘겹게 합성, 2=임계 플래시, 3=결과 노출

  const rgb = hexToRgb(skinHex);
  const glowColor = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.68)`;
  const coronaColor = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.5)`;
  const flareColor = `rgba(${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}, 0.82)`;

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      setPhase(0);
      await new Promise(r => setTimeout(r, ANIMATION_TIMINGS.prepare));

      if (!mounted) return;
      setPhase(1);
      await new Promise(r => setTimeout(r, ANIMATION_TIMINGS.struggleMerge));

      if (!mounted) return;
      setPhase(2);

      await new Promise(r => setTimeout(r, ANIMATION_TIMINGS.fusionFlash));
      if (!mounted) return;
      setPhase(3);

      await new Promise(r => setTimeout(r, ANIMATION_TIMINGS.revealHold));
      if (!mounted) return;
      onComplete();
    };

    run();

    return () => {
      mounted = false;
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/72 backdrop-blur-xl"
    >
      <div className="relative flex flex-col items-center">
        {/* 블록 합성 애니메이션 */}
        <div className="relative h-36 w-72 flex items-center justify-center mb-8 overflow-visible">
          {(phase === 1 || phase === 2) && (
            <motion.div
              initial={{ opacity: 0.15, scale: 0.5 }}
              animate={{
                opacity: [0.24, 0.46, 0.3],
                scale: [0.75, 1.08, 0.94],
              }}
              transition={{
                duration: phase === 1 ? 0.85 : 0.34,
                repeat: phase === 1 ? Infinity : 0,
                ease: 'easeInOut',
              }}
              className="absolute w-24 h-24 rounded-full blur-lg"
              style={{
                left: '50%',
                top: '50%',
                marginLeft: '-48px',
                marginTop: '-48px',
                background: `radial-gradient(circle, ${coronaColor} 0%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0) 100%)`,
              }}
            />
          )}

          <AnimatePresence mode="popLayout">
            {phase < 3 ? (
              <motion.div
                key="block-pair"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {/* 왼쪽 블록 */}
                <motion.div
                  initial={{ x: -96, opacity: 0, scale: 0.82 }}
                  animate={{
                    x: phase === 0
                      ? -96
                      : phase === 1
                        ? [-96, -84, -76, -69, -60, -52, -43, -34, -26, -19, -13, -9, -6, -3, 0]
                        : [0, -2, 1, 0],
                    y: phase === 1 ? [0, -2, 1, -1, 2, -1, 0] : 0,
                    opacity: phase === 2 ? [1, 0.85, 1] : 1,
                    scale: phase === 1 ? [1, 1.03, 0.98, 1.02, 1] : [1, 0.96, 1],
                    rotate: phase === 1 ? [0, -1.4, 0.8, -0.4, 0] : [0, -1, 0],
                  }}
                  transition={
                    phase === 1
                      ? {
                          duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                          ease: [0.22, 1, 0.36, 1],
                        }
                      : {
                          duration: phase === 0 ? 0.2 : ANIMATION_TIMINGS.fusionFlash / 1000,
                          ease: 'easeInOut',
                        }
                  }
                  className="absolute w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold bg-white text-gray-800 border border-gray-200 shadow-lg"
                  style={{ left: '50%', top: '50%', marginLeft: '-32px', marginTop: '-32px' }}
                >
                  ?
                </motion.div>

                {/* 오른쪽 블록 */}
                <motion.div
                  initial={{ x: 96, opacity: 0, scale: 0.82 }}
                  animate={{
                    x: phase === 0
                      ? 96
                      : phase === 1
                        ? [96, 84, 76, 69, 60, 52, 43, 34, 26, 19, 13, 9, 6, 3, 0]
                        : [0, 2, -1, 0],
                    y: phase === 1 ? [0, 2, -1, 1, -2, 1, 0] : 0,
                    opacity: phase === 2 ? [1, 0.85, 1] : 1,
                    scale: phase === 1 ? [1, 1.03, 0.98, 1.02, 1] : [1, 0.96, 1],
                    rotate: phase === 1 ? [0, 1.4, -0.8, 0.4, 0] : [0, 1, 0],
                  }}
                  transition={
                    phase === 1
                      ? {
                          duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                          ease: [0.22, 1, 0.36, 1],
                        }
                      : {
                          duration: phase === 0 ? 0.2 : ANIMATION_TIMINGS.fusionFlash / 1000,
                          ease: 'easeInOut',
                        }
                  }
                  className="absolute w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold bg-white text-gray-800 border border-gray-200 shadow-lg"
                  style={{ left: '50%', top: '50%', marginLeft: '-32px', marginTop: '-32px' }}
                >
                  ?
                </motion.div>

                {/* 임계점 플래시 */}
                {phase === 2 && (
                  <>
                    <motion.div
                      initial={{ scale: 0.25, opacity: 0.95 }}
                      animate={{ scale: 2.6, opacity: 0 }}
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      className="absolute w-20 h-20 rounded-full border"
                      style={{
                        left: '50%',
                        top: '50%',
                        marginLeft: '-40px',
                        marginTop: '-40px',
                        borderColor: `${skinHex}99`,
                      }}
                    />
                    <motion.div
                      initial={{ opacity: 0.92, scale: 0.8 }}
                      animate={{ opacity: 0, scale: 1.85 }}
                      transition={{ duration: 0.4, ease: 'easeOut' }}
                      className="absolute w-24 h-24 rounded-full"
                      style={{
                        left: '50%',
                        top: '50%',
                        marginLeft: '-48px',
                        marginTop: '-48px',
                        background: `radial-gradient(circle, rgba(255,255,255,0.95) 0%, ${coronaColor} 45%, rgba(255,255,255,0) 100%)`,
                      }}
                    />
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div key="block-merged" className="absolute inset-0 flex items-center justify-center">
                {/* 햇빛 코로나/후광 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: [0.45, 0.7, 0.55], scale: [0.85, 1.15, 1] }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className="absolute w-44 h-44 rounded-full blur-2xl"
                  style={{
                    background: `radial-gradient(circle, ${coronaColor} 0%, rgba(255,255,255,0.18) 44%, rgba(255,255,255,0) 100%)`,
                  }}
                />

                {/* 수평 플레어 */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0.2 }}
                  animate={{ opacity: [0, 0.9, 0.35], scaleX: [0.4, 1.25, 1] }}
                  transition={{ duration: 0.95, ease: 'easeOut' }}
                  className="absolute h-[3px] w-64 rounded-full blur-[1.2px]"
                  style={{ backgroundColor: flareColor }}
                />

                {/* 합성 완료 블록 */}
                <motion.div
                  initial={{ scale: 0.72, opacity: 0, rotate: -6 }}
                  animate={{
                    scale: [1, 1.13, 1.02],
                    opacity: 1,
                    rotate: [0, -1.6, 1.2, 0],
                  }}
                  transition={{ duration: 0.88, ease: [0.34, 1.56, 0.64, 1] }}
                  className="relative w-24 h-24 rounded-2xl z-10 overflow-hidden"
                  style={{
                    backgroundColor: skinHex,
                    boxShadow: `0 0 36px ${glowColor}, 0 0 96px ${coronaColor}, 0 0 150px ${coronaColor}`,
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0.25, y: -18 }}
                    animate={{ opacity: [0.3, 0.55, 0.36], y: [-16, -6, -12] }}
                    transition={{ duration: 1, ease: 'easeInOut' }}
                    className="absolute inset-x-2 top-1 h-8 rounded-full blur-md bg-white"
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 획득 완료 텍스트 */}
        {phase === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
