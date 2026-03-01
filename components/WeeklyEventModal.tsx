/**
 * 주간 이벤트 모달
 *
 * 역할:
 * 1. 이벤트 정보 표시 (규칙, 보상, 남은 시간)
 * 2. 이벤트 랭킹 표시
 * 3. 이벤트 시작/이어하기 진입점
 * 4. 이벤트 결과 + 점수 제출 (게임오버 시)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Play, Clock, Shield, Flame, Zap, Target, X } from 'lucide-react';
import {
  getCurrentEvent,
  formatEventRemaining,
  getLocalAttemptCount,
  fetchEventRankings,
  hasClaimedEventReward,
  markEventRewardClaimed,
  loadEventGameState,
  type CurrentEventInfo,
  type EventRankingEntry,
} from '../services/weeklyEventService';
import { addFragments } from '../services/skinService';
import { isNativeApp } from '../utils/platform';

// ============================================
// 이벤트 아이콘/색상 매핑
// ============================================

const EVENT_THEME: Record<string, { icon: string; gradient: string; badge: string }> = {
  NO_ROTATION: { icon: '🔒', gradient: 'from-purple-500 to-purple-700', badge: 'bg-purple-100 text-purple-700' },
  BURNING: { icon: '🔥', gradient: 'from-orange-500 to-red-600', badge: 'bg-orange-100 text-orange-700' },
  PLUS_RUSH: { icon: '➕', gradient: 'from-green-500 to-emerald-600', badge: 'bg-green-100 text-green-700' },
  EXPERT_4X4: { icon: '💀', gradient: 'from-red-600 to-red-900', badge: 'bg-red-100 text-red-700' },
  SPEED_RUN: { icon: '⚡', gradient: 'from-yellow-400 to-amber-600', badge: 'bg-yellow-100 text-yellow-700' },
  TRIPLE_KILL: { icon: '💥', gradient: 'from-pink-500 to-rose-600', badge: 'bg-pink-100 text-pink-700' },
  I_BLOCK_RUSH: { icon: '📏', gradient: 'from-blue-500 to-blue-700', badge: 'bg-blue-100 text-blue-700' },
  PLAINS_10X10: { icon: '🌾', gradient: 'from-lime-500 to-green-700', badge: 'bg-lime-100 text-lime-700' },
};

interface WeeklyEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartEvent: () => void;
  onContinueEvent: () => void;
}

export const WeeklyEventModal: React.FC<WeeklyEventModalProps> = ({
  isOpen,
  onClose,
  onStartEvent,
  onContinueEvent,
}) => {
  const { t } = useTranslation(['game', 'common']);
  const [event, setEvent] = useState<CurrentEventInfo | null>(null);
  const [rankings, setRankings] = useState<EventRankingEntry[]>([]);
  const [myRank, setMyRank] = useState<number | undefined>();
  const [myScore, setMyScore] = useState<number | undefined>();
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  const [remainingText, setRemainingText] = useState('');
  const [hasSavedGame, setHasSavedGame] = useState(false);

  // 초기 데이터 로딩
  useEffect(() => {
    if (!isOpen) return;
    const current = getCurrentEvent();
    setEvent(current);
    setAttemptCount(getLocalAttemptCount());
    setRewardClaimed(hasClaimedEventReward());
    setHasSavedGame(!!loadEventGameState());
    setRemainingText(formatEventRemaining(current.remainingMs));

    // 랭킹 비동기 로딩
    fetchEventRankings().then(result => {
      setRankings(result.rankings);
      setMyRank(result.myRank);
      setMyScore(result.myScore);
      setTotalParticipants(result.total);
    });
  }, [isOpen]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!isOpen || !event) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, event.endsAt - Date.now());
      setRemainingText(formatEventRemaining(remaining));
    }, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, [isOpen, event]);

  // 참여 보상 수령
  const handleClaimReward = useCallback(() => {
    if (rewardClaimed || attemptCount === 0) return;
    if (isNativeApp()) {
      addFragments(2);
    }
    markEventRewardClaimed();
    setRewardClaimed(true);
  }, [rewardClaimed, attemptCount]);

  if (!isOpen || !event) return null;

  const theme = EVENT_THEME[event.eventType] ?? EVENT_THEME.BURNING;
  const rule = event.rule;
  const canStart = attemptCount < 3;
  const hasPlayed = attemptCount > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* 헤더 */}
        <div className={`relative bg-gradient-to-br ${theme.gradient} px-5 py-5 text-white rounded-t-2xl`}>
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition"
            aria-label={t('common:actions.close')}
          >
            <X size={18} />
          </button>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{theme.icon}</span>
            <div>
              <h2 className="text-xl font-bold">{t(`game:weeklyEvent.events.${event.eventType}.name`)}</h2>
              <p className="text-sm text-white/80 mt-0.5">
                <Clock size={12} className="inline mr-1" />
                {remainingText} {t('game:weeklyEvent.remaining')}
              </p>
            </div>
          </div>
        </div>

        {/* 규칙 설명 */}
        <div className="px-5 pt-4 pb-3">
          <p className="text-sm text-gray-600 leading-relaxed">
            {t(`game:weeklyEvent.events.${event.eventType}.desc`)}
          </p>

          {/* 규칙 태그 */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className={`text-xs px-2 py-0.5 rounded-full ${theme.badge}`}>
              {rule.boardSize}×{rule.boardSize}
            </span>
            {rule.disableRotation && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                🔒 {t('game:weeklyEvent.tags.noRotation')}
              </span>
            )}
            {rule.scoreMultiplier > 1 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                ×{rule.scoreMultiplier} {t('game:weeklyEvent.tags.scoreBoost')}
              </span>
            )}
            {rule.tripleKillBonus > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700">
                +{rule.tripleKillBonus}pt {t('game:weeklyEvent.tags.tripleKill')}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              ⏱ {Math.floor(rule.timeLimitSeconds / 60)}{t('game:weeklyEvent.tags.minutes')}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              🎯 {t('game:weeklyEvent.tags.attempts', { current: attemptCount, max: 3 })}
            </span>
          </div>
        </div>

        {/* 보상 */}
        <div className="px-5 pb-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Trophy size={12} className="text-amber-500" />
            <span>{t('game:weeklyEvent.rewards.participation')}: {isNativeApp() ? t('game:weeklyEvent.rewards.fragments', { count: 2 }) : t('game:weeklyEvent.rewards.title')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <Flame size={12} className="text-red-500" />
            <span>{t('game:weeklyEvent.rewards.top10')}: {isNativeApp() ? t('game:weeklyEvent.rewards.fragments', { count: 5 }) : t('game:weeklyEvent.rewards.title')}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
            <Zap size={12} className="text-yellow-500" />
            <span>{t('game:weeklyEvent.rewards.first')}: {isNativeApp() ? t('game:weeklyEvent.rewards.fragments', { count: 10 }) + ' + ' : ''}{t('game:weeklyEvent.rewards.specialTitle')}</span>
          </div>
        </div>

        {/* 내 정보 */}
        {hasPlayed && (
          <div className="mx-5 mb-3 p-3 rounded-xl bg-gray-50">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('game:weeklyEvent.myBest')}</span>
              <span className="font-bold text-gray-800">{myScore?.toLocaleString() ?? '-'}</span>
            </div>
            {myRank && (
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">{t('game:weeklyEvent.myRank')}</span>
                <span className="font-bold text-gray-800">
                  #{myRank} / {totalParticipants}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 참여 보상 수령 */}
        {hasPlayed && !rewardClaimed && isNativeApp() && (
          <div className="mx-5 mb-3">
            <button
              onClick={handleClaimReward}
              className="w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition"
            >
              🎁 {t('game:weeklyEvent.claimReward')}
            </button>
          </div>
        )}

        {/* 시작/이어하기 버튼 */}
        <div className="px-5 pb-3 space-y-2">
          {hasSavedGame && (
            <button
              onClick={onContinueEvent}
              className={`w-full py-3.5 rounded-xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}
            >
              <Play size={16} className="inline mr-1 -mt-0.5" />
              {t('game:weeklyEvent.continueGame')}
            </button>
          )}
          {canStart && (
            <button
              onClick={onStartEvent}
              className={`w-full py-3.5 rounded-xl ${hasSavedGame
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : `bg-gradient-to-r ${theme.gradient} text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5`
                } font-bold text-base transition-all`}
            >
              {hasSavedGame ? (
                <>{t('game:weeklyEvent.newAttempt')} ({attemptCount}/3)</>
              ) : (
                <>
                  <Play size={16} className="inline mr-1 -mt-0.5" />
                  {t('game:weeklyEvent.start')} ({attemptCount}/3)
                </>
              )}
            </button>
          )}
          {!canStart && !hasSavedGame && (
            <div className="text-center py-3 text-sm text-gray-400">
              {t('game:weeklyEvent.maxAttempts')}
            </div>
          )}
        </div>

        {/* 랭킹 */}
        {rankings.length > 0 && (
          <div className="px-5 pb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <Trophy size={14} className="text-amber-500" />
              {t('game:weeklyEvent.rankings')}
            </h3>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {rankings.slice(0, 20).map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg text-sm ${
                    myRank === entry.rank ? 'bg-amber-50 font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-6 text-center font-bold ${
                      entry.rank === 1 ? 'text-amber-500' :
                      entry.rank === 2 ? 'text-gray-400' :
                      entry.rank === 3 ? 'text-amber-700' : 'text-gray-400'
                    }`}>
                      {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank}
                    </span>
                    <span className="text-gray-800 truncate max-w-[140px]">{entry.name}</span>
                  </div>
                  <span className="font-bold text-gray-900">{entry.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeeklyEventModal;
