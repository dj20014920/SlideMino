import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { TutorialTooltip } from './TutorialTooltip';

const STORAGE_KEY = 'tutorial_game_features_seen_v1';

interface GameFeaturesTutorialProps {
  tutorialStep: number; // 0=none, 1=drag, 2=swipe
  blocked?: boolean;
}

// ── 규칙 설명 전용 풀스크린 오버레이 ──
const RulesOverlay: React.FC<{ onDismiss: () => void }> = ({ onDismiss }) => {
  const { t } = useTranslation();

  const rules = [
    {
      icon: <span className="text-2xl">🔢</span>,
      label: t('game:tutorial.rule1Label', '같은 숫자만 합쳐져요.'),
      sub: t('game:tutorial.rule1Sub', '같은 값끼리 붙여 더 큰 숫자를 만드세요.'),
      color: 'bg-indigo-500/30 border-indigo-300/40',
    },
    {
      icon: <CheckCircle2 className="w-6 h-6 text-emerald-300 flex-shrink-0" strokeWidth={2} />,
      label: t('game:tutorial.rule2Label', '합성 성공 시 스와이프 1회 추가!'),
      sub: t('game:tutorial.rule2Sub', '연속 합성으로 콤보를 이어가세요.'),
      color: 'bg-emerald-500/30 border-emerald-300/40',
    },
    {
      icon: <XCircle className="w-6 h-6 text-rose-300 flex-shrink-0" strokeWidth={2} />,
      label: t('game:tutorial.rule3Label', '합성 실패 시 블록 설치 차례예요.'),
      sub: t('game:tutorial.rule3Sub', '스와이프 후 합성이 없으면 설치 단계로 돌아갑니다.'),
      color: 'bg-rose-500/25 border-rose-300/40',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        key="rules-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/65 backdrop-blur-[3px] flex items-center justify-center px-4 touch-none"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="w-full max-w-sm rounded-3xl bg-blue-700 border border-blue-400/40 shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-center gap-2 px-5 pt-5 pb-3">
            <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse flex-shrink-0" />
            <h2 className="text-white font-bold text-base leading-tight">
              {t('game:tutorial.rulesTitle', '게임 규칙')}
            </h2>
            <button
              type="button"
              onClick={onDismiss}
              className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/25 transition-colors"
              aria-label={t('game:tutorial.close', '닫기')}
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Turn cycle diagram */}
          <div className="mx-4 mb-3 px-3 py-2.5 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-blue-100">
            <span className="px-2 py-1 rounded-lg bg-emerald-500/50 border border-emerald-300/40 text-emerald-100">블럭 설치</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
            <span className="px-2 py-1 rounded-lg bg-sky-500/50 border border-sky-300/40 text-sky-100">스와이프</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-300 flex-shrink-0" />
            <span className="px-2 py-1 rounded-lg bg-sky-500/50 border border-sky-300/40 text-sky-100">스와이프</span>
            <span className="text-blue-300">···</span>
          </div>

          {/* Rules list */}
          <div className="mx-4 mb-4 space-y-2">
            {rules.map((rule, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-2xl border p-3 ${rule.color}`}
              >
                <div className="mt-0.5 flex-shrink-0">{rule.icon}</div>
                <div>
                  <p className="text-white text-[12px] font-semibold leading-snug">{rule.label}</p>
                  <p className="text-blue-100/80 text-[11px] mt-0.5 leading-relaxed">{rule.sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Dismiss */}
          <button
            type="button"
            onClick={onDismiss}
            className="w-full py-3.5 rounded-b-3xl bg-white/10 hover:bg-white/20 active:bg-white/30 transition-colors text-white text-sm font-semibold border-t border-white/10"
          >
            {t('game:tutorial.gotIt', '알겠어요!')}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export const GameFeaturesTutorial: React.FC<GameFeaturesTutorialProps> = ({
  tutorialStep,
  blocked = false,
}) => {
  const { t } = useTranslation();
  const [internalStep, setInternalStep] = useState(0); // 0: none, 1: rules, 2: undo
  const triggeredRef = React.useRef(false);

  useEffect(() => {
    if (blocked) return;
    // 유령손 튜토리얼(step 1, 2)이 진행 중이면 대기
    if (tutorialStep !== 0) return;
    // 이미 트리거됐거나 완료된 경우 스킵
    if (triggeredRef.current) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    triggeredRef.current = true;
    const timer = setTimeout(() => {
      setInternalStep(1);
    }, 500);
    return () => {
      // 타이머가 실행되기 전에 컴포넌트가 언마운트되면(게임 이탈 등)
      // ref를 리셋해서 다음 진입 시 다시 시도할 수 있도록 한다.
      clearTimeout(timer);
      triggeredRef.current = false;
    };
  }, [blocked, tutorialStep]);

  const handleDismissRules = () => {
    setInternalStep(2);
  };

  const handleDismissUndo = () => {
    setInternalStep(0);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (blocked || internalStep === 0) return null;

  return (
    <>
      {/* Step 1: Game Rules fullscreen overlay */}
      {internalStep === 1 && <RulesOverlay onDismiss={handleDismissRules} />}

      {/* Step 2: Undo button tooltip */}
      <TutorialTooltip
        isVisible={internalStep === 2}
        targetId="game-undo-btn"
        onDismiss={handleDismissUndo}
        title={t('game:tutorial.undoTitle', '되돌리기 기능')}
        description={t('game:tutorial.undoDesc', '되돌리기·새로고침으로 실수를 복구하고, 부족하면 광고로 충전하세요.')}
        forcePlacement="below"
      />
    </>
  );
};
