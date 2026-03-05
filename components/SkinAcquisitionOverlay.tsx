import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { hexToRgb, resolveSkinAppearance } from '../services/blockCustomization';
import { SKIN_CATALOG } from '../constants';
import { getSkinFallbackDisplayName } from '../services/skinDisplayName';

type SkinAcquisitionOverlayProps = {
  skin: { id?: string; hex: string; style?: any };
  isDuplicate?: boolean;
  fragmentsEarned?: number;
  totalFragments?: number;
  onComplete: () => void;
};

const ANIMATION_TIMINGS = {
  prepare: 140,
  struggleMerge: 2800, // 더욱 길게 늘려서 극적인 효과 강화
  fusionFlash: 520,
  revealHold: 2400,
} as const;

/**
 * 스킨 획득 애니메이션 오버레이
 * - 양쪽 블럭이 중앙으로 "힘겹게" 수렴하는 자석/저항감 연출
 * - 임계점에서 고광도 플래시 + 코로나(후광) + 플레어
 * - 최종 획득 스킨 블럭 노출
 */
export const SkinAcquisitionOverlay: React.FC<SkinAcquisitionOverlayProps> = ({
  skin,
  isDuplicate = false,
  fragmentsEarned = 0,
  totalFragments = 0,
  onComplete,
}) => {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState(0); // 0=준비, 1=힘겹게 합성, 2=임계 플래시, 3=결과 노출
  const [canDismiss, setCanDismiss] = useState(false); // 클릭해서 닫을 수 있는지 여부
  const skinHex = skin.hex;
  const appearance = useMemo(() => resolveSkinAppearance(2048, skin), [skin]);
  const displayName = useMemo(() => {
    const catalogEntry = skin.id ? SKIN_CATALOG.find((entry) => entry.id === skin.id) : undefined;
    const fallbackName = getSkinFallbackDisplayName(
      { id: skin.id, hex: skin.hex, nameKey: catalogEntry?.nameKey },
      i18n.language
    );
    if (catalogEntry?.nameKey) {
      return t(`skins:${catalogEntry.nameKey}`, fallbackName);
    }
    return fallbackName;
  }, [i18n.language, skin.hex, skin.id, t]);

  const colors = useMemo(() => {
    const rgb = hexToRgb(skinHex);
    return {
      glow: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.68)`,
      corona: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`,
      flare: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.82)`,
      solid: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1)`,
      highlight: `rgba(${Math.min(255, rgb.r + 50)}, ${Math.min(255, rgb.g + 50)}, ${Math.min(255, rgb.b + 50)}, 1)`,
    };
  }, [skinHex]);

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
      
      // 스킨 표시 후 짧은 딜레이 후 탭 가능하게 설정
      await new Promise(r => setTimeout(r, 800)); // 0.8초 후 탭 가능
      if (!mounted) return;
      setCanDismiss(true);
    };

    run();

    return () => {
      mounted = false;
    };
  }, []); // onComplete 의존성 제거 (자동 호출 안 함)

  const handleDismiss = () => {
    if (canDismiss) {
      onComplete();
    }
  };

  // Generate shake keyframes for the struggle phase
  const shakeKeyframes = useMemo(() => {
    const frames = [];
    const steps = 60; // More frames for smoother slow motion
    for (let i = 0; i <= steps; i++) {
        const progress = i / steps;
        // 후반부(합쳐지기 직전)에 진동 강도 극대화
        // 초반엔 약하게, 후반에 매우 강하게
        const amplitude = progress < 0.6 ? 1 : 1 + (Math.pow(progress, 3) * 6); 
        const y = (Math.random() - 0.5) * amplitude;
        const rotate = (Math.random() - 0.5) * (amplitude * 2);
        frames.push({ y, rotate });
    }
    return {
        y: frames.map(f => f.y),
        rotate: frames.map(f => f.rotate)
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-xl cursor-pointer"
      onClick={handleDismiss}
    >
      <div className="relative flex flex-col items-center w-full max-w-md pointer-events-none">
        {/* 블록 합성 애니메이션 컨테이너 */}
        <div className="relative h-64 w-full flex items-center justify-center mb-8 overflow-visible">
          
          {/* Phase 1 & 2: Center Energy Build-up */}
          {(phase === 1 || phase === 2) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{
                opacity: phase === 1 ? [0, 0.2, 0.4, 0.9] : 1, 
                scale: phase === 1 ? [0.8, 1, 1.2, 0.9, 1.6] : 3, 
                filter: phase === 1 ? ["brightness(1)", "brightness(1.5)", "brightness(2.5)"] : "brightness(3)",
              }}
              transition={{
                duration: phase === 1 ? ANIMATION_TIMINGS.struggleMerge / 1000 : 0.2,
                times: phase === 1 ? [0, 0.5, 0.8, 0.9, 1] : undefined,
              }}
              className="absolute w-16 h-16 rounded-full blur-xl z-0"
              style={{
                background: `radial-gradient(circle, ${colors.corona} 0%, rgba(255,255,255,0) 70%)`,
              }}
            />
          )}

          <AnimatePresence mode="wait">
            {phase < 3 ? (
              <motion.div
                key="block-pair"
                className="absolute inset-0 flex items-center justify-center"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
              >
                {/* 왼쪽 블록: -40 위치에서 만남 (w-20은 80px, 중심 40px) */}
                <motion.div
                  initial={{ x: -160, opacity: 0, scale: 0.8 }}
                  animate={{
                    x: phase === 0
                      ? -160
                      : phase === 1
                        ? [-160, -60, -68, -48, -55, -42, -45, -41, -43, -40, -42, -40] // -40 부근에서 격렬하게 저항하며 천천히 접근
                        : -40,
                    y: phase === 1 ? shakeKeyframes.y : 0,
                    rotate: phase === 1 ? shakeKeyframes.rotate : 0,
                    opacity: 1,
                    scale: phase === 1 ? [1, 0.9, 1.1, 0.95, 1.05, 0.98, 1.02, 1] : 1,
                    filter: phase === 1 ? ["brightness(1)", "brightness(1.2)", "brightness(3)"] : "brightness(1)"
                  }}
                  transition={{
                    x: {
                        duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                        // 초반에 빠르게 접근하고, 후반에 매우 느리게(0.5 이후부터 촘촘하게)
                        times: [0, 0.15, 0.25, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1],
                        ease: "easeInOut" 
                    },
                    y: {
                        duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                        repeat: 0,
                    },
                    rotate: {
                        duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                        repeat: 0
                    },
                    filter: { duration: ANIMATION_TIMINGS.struggleMerge / 1000 }
                  }}
                  className="absolute w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-bold bg-white text-gray-800 border-2 border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
                  style={{ left: '50%', top: '50%', marginLeft: '-40px', marginTop: '-40px' }}
                >
                  ?
                </motion.div>

                {/* 오른쪽 블록: 40 위치에서 만남 */}
                <motion.div
                  initial={{ x: 160, opacity: 0, scale: 0.8 }}
                  animate={{
                    x: phase === 0
                      ? 160
                      : phase === 1
                        ? [160, 60, 68, 48, 55, 42, 45, 41, 43, 40, 42, 40]
                        : 40,
                    y: phase === 1 ? shakeKeyframes.y : 0,
                    rotate: phase === 1 ? shakeKeyframes.rotate : 0,
                    opacity: 1,
                    scale: phase === 1 ? [1, 0.9, 1.1, 0.95, 1.05, 0.98, 1.02, 1] : 1,
                    filter: phase === 1 ? ["brightness(1)", "brightness(1.2)", "brightness(3)"] : "brightness(1)"
                  }}
                  transition={{
                    x: {
                        duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                        times: [0, 0.15, 0.25, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1],
                        ease: "easeInOut"
                    },
                    y: {
                        duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                        repeat: 0,
                    },
                    rotate: {
                        duration: ANIMATION_TIMINGS.struggleMerge / 1000,
                        repeat: 0
                    },
                    filter: { duration: ANIMATION_TIMINGS.struggleMerge / 1000 }
                  }}
                  className="absolute w-20 h-20 rounded-xl flex items-center justify-center text-3xl font-bold bg-white text-gray-800 border-2 border-white/50 shadow-[0_0_15px_rgba(255,255,255,0.3)] z-10"
                  style={{ left: '50%', top: '50%', marginLeft: '-40px', marginTop: '-40px' }}
                >
                  ?
                </motion.div>

                {/* 임계점 플래시 (폭발) */}
                {phase === 2 && (
                  <>
                    <motion.div
                      initial={{ scale: 0.1, opacity: 1 }}
                      animate={{ scale: [0.1, 4, 8], opacity: [1, 1, 0] }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="absolute inset-0 z-50 bg-white"
                      style={{ mixBlendMode: 'screen' }}
                    />
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 20 }}
                        transition={{ duration: 0.8 }}
                        className="absolute w-10 h-10 rounded-full bg-white blur-md z-40"
                    />
                  </>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="block-merged" 
                className="absolute inset-0 flex items-center justify-center"
              >
                {/* === 뒷배경 후광 효과 (Backlight/Corona) === */}
                
                {/* 1. 회전하는 태양광선 (Sun Rays) */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.5, rotate: 0 }}
                  animate={{ 
                    opacity: [0, 0.6, 0.4], 
                    scale: [0.8, 1.2, 1.1],
                    rotate: 180 
                  }}
                  transition={{ 
                    opacity: { duration: 1, ease: "easeOut" },
                    scale: { duration: 2, ease: "easeOut" },
                    rotate: { duration: 20, repeat: Infinity, ease: "linear" } 
                  }}
                  className="absolute w-[200%] h-[200%] z-0"
                  style={{
                    background: `conic-gradient(from 0deg, transparent 0deg, ${colors.corona} 20deg, transparent 40deg, ${colors.corona} 120deg, transparent 160deg, ${colors.corona} 200deg, transparent 240deg, ${colors.corona} 300deg, transparent 360deg)`,
                    filter: 'blur(20px)',
                    mixBlendMode: 'screen'
                  }}
                />

                {/* 2. 중앙 집중 코어 글로우 (Core Glow) */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.2 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="absolute w-64 h-64 rounded-full blur-3xl z-0"
                  style={{
                    background: `radial-gradient(circle, ${colors.glow} 0%, transparent 70%)`,
                  }}
                />
                
                {/* 3. 강력한 렌즈 플레어 (Horizontal Flare) */}
                <motion.div
                  initial={{ opacity: 0, scaleX: 0, width: '100px' }}
                  animate={{ opacity: [0, 1, 0.6], scaleX: [0.2, 4, 3], width: '300px' }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="absolute h-1 rounded-full blur-[2px] z-10 bg-white"
                  style={{boxShadow: `0 0 20px 2px ${colors.highlight}`}}
                />

                {/* 합성 완료 블록 Reveal */}
                <motion.div
                  initial={{ scale: 0, opacity: 0, rotate: -45 }}
                  animate={{
                    scale: [0.5, 1.2, 1], // Pop effect
                    opacity: 1,
                    rotate: 0,
                  }}
                  transition={{ 
                    duration: 0.8, 
                    type: "spring",
                    stiffness: 200,
                    damping: 15
                  }}
                  className="relative w-32 h-32 rounded-3xl z-20 overflow-hidden ring-4 ring-white/30"
                  style={{
                    backgroundColor: skinHex,
                    ...appearance.style,
                    boxShadow: `0 0 50px ${colors.glow}, 0 0 100px ${colors.corona}, ${appearance.style?.boxShadow ?? ''}`,
                  }}
                >
                  {/* 블록 내부의 하이라이트 */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-white/30" />
                  <motion.div
                    initial={{ x: '-100%', opacity: 0 }}
                    animate={{ x: '100%', opacity: [0, 0.5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' }}
                    className="absolute top-0 bottom-0 w-1/2 -skew-x-12 bg-white/40 blur-md"
                  />
                </motion.div>
                
                {/* 코로나 링 (Corona Ring) - 뒤쪽에서 퍼지는 링 */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: [0, 0.5, 0], scale: [1, 2, 2.2] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                    className="absolute w-32 h-32 rounded-full border-2 border-white/20 blur-sm z-0"
                    style={{ borderColor: colors.highlight }}
                />

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 획득 완료 텍스트 */}
        {phase === 3 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="flex flex-col items-center gap-4 z-30"
          >
            <div className="text-3xl font-bold text-white drop-shadow-lg tracking-wider">
              {isDuplicate
                ? t('modals:skinAcquisition.duplicateTitle')
                : t('modals:skinAcquisition.title')}
            </div>
            
            <div 
                className="px-6 py-2 rounded-full text-base font-mono font-bold text-white border border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                style={{ backgroundColor: colors.corona, textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
            >
              {isDuplicate
                ? String(t('modals:skinAcquisition.fragmentEarned', { count: fragmentsEarned } as any))
                : displayName}
            </div>
            
            <div className="text-base text-white/70 font-medium">
              {isDuplicate
                ? String(t('modals:skinAcquisition.totalFragments', { total: totalFragments } as any))
                : t('modals:skinAcquisition.addedToCollection')}
            </div>
            
            {/* 탭하여 닫기 안내 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: canDismiss ? 1 : 0, scale: canDismiss ? 1 : 0.9 }}
              transition={{ duration: 0.3 }}
              className="mt-6 px-5 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white/80 text-sm font-medium flex items-center gap-2"
            >
              <span>👆</span>
              <span>{t('modals:skinAcquisition.tapToClose')}</span>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};
