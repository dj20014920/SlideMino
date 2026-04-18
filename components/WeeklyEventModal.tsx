/**
 * 주간 이벤트 모달
 *
 * 역할:
 * 1. 이벤트 정보 표시 (규칙, 보상, 남은 시간)
 * 2. 이벤트 랭킹 표시
 * 3. 이벤트 시작/이어하기 진입점
 * 4. 이벤트 결과 + 점수 제출 (게임오버 시)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Play, Clock, Flame, Zap, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { BASE_URL } from '../config/constants';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import {
  getCurrentEvent,
  getPreviousEvent,
  formatEventRemaining,
  getLocalAttemptCount,
  isEventAttemptAdBonusUnlocked,
  unlockEventAttemptAdBonus,
  canUnlockWeeklyEventAdBonus,
  canStartWeeklyEventAttempt,
  getRemainingWeeklyEventAttempts,
  getWeeklyEventAttemptLimit,
  syncAttemptCountFromServer,
  fetchEventRankings,
  hasClaimedEventReward,
  hasParticipatedInPreviousEvent,
  fetchEventRewardStatus,
  claimEventRewardFromServer,
  loadEventGameState,
  type CurrentEventInfo,
  type EventRankingEntry,
} from '../services/weeklyEventService';
import { addFragments } from '../services/skinService';
import { isNativeApp } from '../utils/platform';
import { weeklyEventAttemptAdService } from '../services/weeklyEventAttemptAdService';
import { getLevelBadgeById } from '../services/xpLevelService';

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
  const { t } = useTranslation(['game', 'common', 'modals']);
  useBodyScrollLock(isOpen);
  const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
  const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
  const premiumUiWindowClassName = premiumUiObjects.windowClassName;
  const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
  const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
  const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
  const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
  const premiumUiBadgeClassName = premiumUiObjects.panels.badgeClassName;
  const premiumUiSunkenClassName = premiumUiObjects.panels.sunkenClassName;
  const premiumUiListItemClassName = premiumUiObjects.panels.listItemClassName;
  const premiumUiListItemHighlightClassName = premiumUiObjects.panels.listItemHighlightClassName;
  const premiumUiCompartmentButtonClassName = premiumUiObjects.buttons.compartmentClassName;
  const premiumUiEventTabStripClassName = premiumUiObjects.extended.tabs.weeklyEvent.containerClassName
    || premiumUiObjects.tabs.level.containerClassName;
  const premiumUiEventTabButtonClassName = premiumUiObjects.extended.tabs.weeklyEvent.buttonClassName
    || premiumUiObjects.tabs.level.buttonClassName;
  const isPremiumUi = Boolean(isPremiumUiThemeActive);
  const [event, setEvent] = useState<CurrentEventInfo | null>(null);
  const [rankings, setRankings] = useState<EventRankingEntry[]>([]);
  const [currentRankingsError, setCurrentRankingsError] = useState<'none' | 'network' | 'http'>('none');
  const [myRank, setMyRank] = useState<number | undefined>();
  const [myScore, setMyScore] = useState<number | undefined>();
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [attemptCount, setAttemptCount] = useState(0);
  const [rewardClaimed, setRewardClaimed] = useState(false);
  /** 이전 주 이벤트 참여 여부 (서버 검증 기반) */
  const [prevEventParticipated, setPrevEventParticipated] = useState(false);
  /** 서버가 결정한 보상 조각 수 */
  const [rewardFragments, setRewardFragments] = useState(2);
  /** 서버가 결정한 이전 주 순위 */
  const [prevEventRank, setPrevEventRank] = useState<number | null>(null);
  const [remainingText, setRemainingText] = useState('');
  const [hasSavedGame, setHasSavedGame] = useState(false);
  const [isAdBonusUnlocked, setIsAdBonusUnlocked] = useState(false);
  const [isAttemptUnlockAdReady, setIsAttemptUnlockAdReady] = useState(false);
  const [isAttemptUnlockAdInProgress, setIsAttemptUnlockAdInProgress] = useState(false);
  const [attemptUnlockNotice, setAttemptUnlockNotice] = useState<string | null>(null);
  const formatRemainingText = useCallback((ms: number) => {
    return formatEventRemaining(ms, {
      endedLabel: String(t('game:weeklyEvent.time.ended')),
      daySuffix: String(t('game:weeklyEvent.time.dayShort')),
      hourSuffix: String(t('game:weeklyEvent.time.hourShort')),
      minuteSuffix: String(t('game:weeklyEvent.time.minuteShort')),
    });
  }, [t]);

  // 이전 주 랭킹 탭
  const [showPrevWeek, setShowPrevWeek] = useState(false);
  const [prevRankings, setPrevRankings] = useState<EventRankingEntry[]>([]);
  const [prevRankingsError, setPrevRankingsError] = useState<'none' | 'network' | 'http'>('none');
  const [prevMyRank, setPrevMyRank] = useState<number | undefined>();
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevEventInfo, setPrevEventInfo] = useState<CurrentEventInfo | null>(null);

  // 초기 데이터 로딩
  useEffect(() => {
    if (!isOpen) return;
    let rankingsCancelled = false;
    const current = getCurrentEvent();
    setEvent(current);
    // 우선 로컬 캐시로 즉시 표시하고, 서버 동기화 후 갱신
    setAttemptCount(getLocalAttemptCount());
    setIsAdBonusUnlocked(isEventAttemptAdBonusUnlocked());
    setIsAttemptUnlockAdReady(weeklyEventAttemptAdService.isAdReady());
    setIsAttemptUnlockAdInProgress(false);
    setAttemptUnlockNotice(null);
    setRewardClaimed(hasClaimedEventReward());
    setPrevEventParticipated(hasParticipatedInPreviousEvent());
    setHasSavedGame(!!loadEventGameState());
    setRemainingText(formatRemainingText(current.remainingMs));

    // 서버 도전 횟수 동기화
    syncAttemptCountFromServer().then(count => {
      setAttemptCount(count);
    }).catch(() => { /* 오프라인 등 실패 시 로컬 값 유지 */ });

    // 이번 주 랭킹 로딩
    setCurrentRankingsError('none');
    fetchEventRankings().then(result => {
      if (rankingsCancelled) return;
      setRankings(result.rankings);
      setMyRank(result.myRank);
      setMyScore(result.myScore);
      setTotalParticipants(result.total);
      setCurrentRankingsError(result.error ?? 'none');
    });

    // 서버에서 이전 주 이벤트 보상 상태 조회 (참여 여부·순위·수령 여부 한 번에 확인)
    // AbortController: 모달이 닫히기 전 언마운트 시 setState 호출 방지
    let rewardStatusCancelled = false;
    fetchEventRewardStatus().then(status => {
      if (rewardStatusCancelled) return;
      setPrevEventParticipated(status.participated);
      setRewardClaimed(status.claimed);
      setRewardFragments(status.fragments);
      setPrevEventRank(status.rank);
    }).catch(() => { /* 실패 시 로컬 폴백 유지 */ });

    return () => {
      rankingsCancelled = true;
      rewardStatusCancelled = true;
    };
  }, [isOpen, formatRemainingText]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!isOpen || !event) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, event.endsAt - Date.now());
      setRemainingText(formatRemainingText(remaining));
    }, 60000); // 1분마다 갱신
    return () => clearInterval(interval);
  }, [isOpen, event, formatRemainingText]);

  // 모달 닫힐 때 탭 초기화
  useEffect(() => {
    if (!isOpen) setShowPrevWeek(false);
  }, [isOpen]);

  const canUnlockByAd = canUnlockWeeklyEventAdBonus(attemptCount, isAdBonusUnlocked);
  const isAttemptUnlockAdSupported = weeklyEventAttemptAdService.isSupported();

  useEffect(() => {
    if (!isOpen || !canUnlockByAd || !isAttemptUnlockAdSupported) return;
    weeklyEventAttemptAdService.preloadAd();
    setIsAttemptUnlockAdReady(weeklyEventAttemptAdService.isAdReady());
    const intervalId = window.setInterval(() => {
      const ready = weeklyEventAttemptAdService.isAdReady();
      setIsAttemptUnlockAdReady(ready);
      if (ready) {
        window.clearInterval(intervalId);
      }
    }, 1200);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [isOpen, canUnlockByAd, isAttemptUnlockAdSupported]);

  // 이전 주 랭킹 탭 전환 시 한 번만 fetch
  useEffect(() => {
    if (!isOpen || !showPrevWeek) return;
    if (prevRankings.length > 0 || prevLoading) return; // 이미 로드됨
    const prev = getPreviousEvent();
    setPrevEventInfo(prev);
    setPrevLoading(true);
    setPrevRankingsError('none');
    fetchEventRankings(prev.eventId).then(result => {
      setPrevRankings(result.rankings);
      setPrevMyRank(result.myRank);
      setPrevRankingsError(result.error ?? 'none');
    }).finally(() => setPrevLoading(false));
  }, [isOpen, showPrevWeek, prevRankings.length, prevLoading]);

  // 참여 보상 수령 — 서버 검증 + 서버가 조각 수 결정
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  /** useRef로 stale closure 문제 없이 동시 클릭/재진입 차단 */
  const isClaimingRef = useRef(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const handleClaimReward = useCallback(async () => {
    // isClaimingRef.current으로 stale closure 없이 즉시 재진입 차단
    if (isClaimingRef.current || rewardClaimed) return;
    if (hasClaimedEventReward()) {
      setRewardClaimed(true);
      return;
    }
    if (!prevEventParticipated) return;

    isClaimingRef.current = true;
    setIsClaimingReward(true);
    setClaimError(null);
    try {
      // 서버에 보상 수령 요청 — 서버가 참여·순위·중복을 모두 검증
      const result = await claimEventRewardFromServer();
      if (result.success) {
        setRewardClaimed(true);
        if (!result.alreadyClaimed && result.fragments > 0 && isNativeApp()) {
          // 서버가 결정한 조각 수만큼 지급
          addFragments(result.fragments, 'weekly_event_reward');
        }
      } else {
        // 서버 에러 / 네트워크 오류 — 재시도 가능하도록 에러 메시지 표시
        setClaimError(String(t('game:weeklyEvent.claimFailed')));
      }
    } finally {
      isClaimingRef.current = false;
      setIsClaimingReward(false);
    }
  }, [rewardClaimed, prevEventParticipated, t]);

  const handleWatchAttemptUnlockAd = useCallback(() => {
    if (isAttemptUnlockAdInProgress) return;
    if (!canUnlockByAd) return;
    if (!isAttemptUnlockAdSupported) {
      setAttemptUnlockNotice(String(t('game:weeklyEvent.adUnlockUnsupported')));
      return;
    }
    setAttemptUnlockNotice(null);
    setIsAttemptUnlockAdInProgress(true);
    weeklyEventAttemptAdService.showRewardAd({
      onRewardEarned: () => {
        unlockEventAttemptAdBonus();
        setIsAdBonusUnlocked(true);
        setAttemptUnlockNotice(String(t('game:weeklyEvent.adUnlockSuccess')));
      },
      onAdClosed: () => {
        setIsAttemptUnlockAdInProgress(false);
        setIsAttemptUnlockAdReady(weeklyEventAttemptAdService.isAdReady());
      },
      onError: () => {
        setIsAttemptUnlockAdInProgress(false);
        setIsAttemptUnlockAdReady(weeklyEventAttemptAdService.isAdReady());
        setAttemptUnlockNotice(String(t('game:weeklyEvent.adUnlockError')));
      },
      onDailyLimitReached: () => {
        setIsAttemptUnlockAdInProgress(false);
        setAttemptUnlockNotice(String(t('game:weeklyEvent.adUnlockDailyLimit')));
      },
    });
  }, [isAttemptUnlockAdInProgress, canUnlockByAd, isAttemptUnlockAdSupported, t]);

  if (!isOpen || !event) return null;

  const theme = EVENT_THEME[event.eventType] ?? EVENT_THEME.BURNING;
  const rule = event.rule;
  const canStart = canStartWeeklyEventAttempt(attemptCount, isAdBonusUnlocked);
  const maxAttempts = getWeeklyEventAttemptLimit(isAdBonusUnlocked);
  const remainingAttempts = getRemainingWeeklyEventAttempts(attemptCount, isAdBonusUnlocked);
  const remainingTagTextRaw = String(t('game:weeklyEvent.tags.remainingAttempts', { remaining: remainingAttempts, max: maxAttempts }));
  const remainingTagText = remainingTagTextRaw.includes('weeklyEvent.')
    ? `${remainingAttempts}/${maxAttempts}`
    : remainingTagTextRaw;
  const remainingInlineTextRaw = String(t('game:weeklyEvent.remainingInline', { remaining: remainingAttempts }));
  const remainingInlineText = remainingInlineTextRaw.includes('weeklyEvent.')
    ? `${remainingAttempts}`
    : remainingInlineTextRaw;
  const hasPlayed = attemptCount > 0;
  const isApp = isNativeApp();

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay ${isPremiumUi ? premiumUiModalOverlayClassName : 'bg-black/60 backdrop-blur-sm'}`}>
      <div className={isPremiumUi
        ? `${premiumUiWindowClassName} relative w-full max-w-md max-h-[90vh] modal-safe-panel overflow-y-auto modal-scroll-panel`
        : 'relative w-full max-w-md max-h-[90vh] modal-safe-panel overflow-y-auto modal-scroll-panel rounded-2xl bg-white shadow-2xl'
      }>
        {/* 헤더 */}
        {isPremiumUi ? (
          <div className={premiumUiTitleBarClassName}>
            <div className={premiumUiTitleBarTextClassName}><span className="font-bold">◆</span>{' '}{t(`game:weeklyEvent.events.${event.eventType}.name`)}</div>
            <div className={premiumUiTitleBarControlsClassName}>
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>
        ) : (
          <div className={`relative bg-gradient-to-br ${theme.gradient} px-5 py-5 text-white rounded-t-2xl`}>
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition"
              aria-label={t('common:buttons.close')}
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
        )}

        {/* 규칙 설명 */}
        <div className={isPremiumUi ? `${premiumUiWindowBodyClassName} px-3 pt-2 pb-2` : 'px-5 pt-4 pb-3'}>
          {isPremiumUi && (
            <p className="text-xs mb-2">
              <Clock size={12} className="inline mr-1" />
              {remainingText} {t('game:weeklyEvent.remaining')}
            </p>
          )}
          <p className="text-sm text-gray-600 leading-relaxed">
            {t(`game:weeklyEvent.events.${event.eventType}.desc`)}
          </p>
          <div className={isPremiumUi ? `mt-3 ${premiumUiSunkenClassName} px-3 py-2` : 'mt-3 rounded-xl border border-sky-100 bg-sky-50/85 px-3 py-2'}>
            <p className="text-[11px] font-semibold text-gray-800">
              {t('game:weeklyEvent.separateSessionTitle')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-600">
              {t('game:weeklyEvent.separateSessionBody')}
            </p>
          </div>

          {/* 규칙 태그 */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <span className={isPremiumUi ? `${premiumUiBadgeClassName} text-xs` : `text-xs px-2 py-0.5 rounded-full ${theme.badge}`}>
              {rule.boardSize}×{rule.boardSize}
            </span>
            {rule.disableRotation && (
              <span className={isPremiumUi ? `${premiumUiBadgeClassName} text-xs` : 'text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600'}>
                {isPremiumUi ? <span className="font-bold">▣</span> : '🔒'} {t('game:weeklyEvent.tags.noRotation')}
              </span>
            )}
            {rule.scoreMultiplier > 1 && (
              <span className={isPremiumUi ? `${premiumUiBadgeClassName} text-xs` : 'text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700'}>
                ×{rule.scoreMultiplier} {t('game:weeklyEvent.tags.scoreBoost')}
              </span>
            )}
            {rule.tripleKillBonus > 0 && (
              <span className={isPremiumUi ? `${premiumUiBadgeClassName} text-xs` : 'text-xs px-2 py-0.5 rounded-full bg-pink-100 text-pink-700'}>
                +{rule.tripleKillBonus}pt {t('game:weeklyEvent.tags.tripleKill')}
              </span>
            )}
            <span className={isPremiumUi ? `${premiumUiBadgeClassName} text-xs` : 'text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600'}>
              ⏱ {Math.floor(rule.timeLimitSeconds / 60)}{t('game:weeklyEvent.tags.minutes')}
            </span>
            <span className={isPremiumUi ? `${premiumUiBadgeClassName} text-xs` : 'text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600'}>
              {isPremiumUi ? <span className="font-bold">◆</span> : '🎯'} {remainingTagText}
            </span>
          </div>
        </div>

        {/* 보상 */}
        <div className={isPremiumUi ? 'px-3 pb-2' : 'px-5 pb-3'}>
          {isApp ? (
            // 앱: 구체적인 조각 수량 표시
            <>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Trophy size={12} className="text-amber-500" />
                <span>{t('game:weeklyEvent.rewards.participation')}: {t('game:weeklyEvent.rewards.fragments', { count: 2 })}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Flame size={12} className="text-red-500" />
                <span>{t('game:weeklyEvent.rewards.top10')}: {t('game:weeklyEvent.rewards.fragments', { count: 5 })}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                <Zap size={12} className="text-yellow-500" />
                <span>{t('game:weeklyEvent.rewards.first')}: {t('game:weeklyEvent.rewards.fragments', { count: 10 })} + {t('game:weeklyEvent.rewards.specialTitle')}</span>
              </div>
            </>
          ) : (
            // 웹: 잠긴 보상 + 앱 다운로드 유도
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {t('game:weeklyEvent.rewards.participation')}
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-600">
                  {t('game:weeklyEvent.rewards.appOnlyBadge')}
                </span>
              </div>
              <div className="flex gap-4 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Trophy size={12} className="text-gray-300" />
                  <span>{t('game:weeklyEvent.rewards.fragments', { count: 2 })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Flame size={12} className="text-gray-300" />
                  <span>TOP10 +{t('game:weeklyEvent.rewards.fragments', { count: 5 })}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Zap size={12} className="text-gray-300" />
                  <span>1위 +{t('game:weeklyEvent.rewards.fragments', { count: 10 })}</span>
                </div>
              </div>
              <p className="text-[11px] text-gray-400 mb-2">
                {t('game:weeklyEvent.rewards.appOnlyDesc')}
              </p>
              <a
                href={BASE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-2 rounded-lg bg-indigo-600 text-white font-semibold text-xs hover:bg-indigo-700 active:scale-[0.98] transition-all"
              >
                {t('game:weeklyEvent.rewards.getAppCta')}
              </a>
            </div>
          )}
        </div>

        {/* 내 정보 */}
        {hasPlayed && (
          <div className={isPremiumUi ? `mx-3 mb-2 ${premiumUiSunkenClassName} p-2` : 'mx-5 mb-3 p-3 rounded-xl bg-gray-50'}>
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

        {/* 이전 주 참여 보상 수령 — 서버 검증, 이벤트 로테이션 후 전주 결과 기반 지급 (앱 전용) */}
        {isApp && prevEventParticipated && !rewardClaimed && (
          <div className={isPremiumUi ? 'mx-3 mb-2' : 'mx-5 mb-3'}>
            <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
              <Trophy size={12} className="text-amber-500" />
              {t('game:weeklyEvent.prevWeekRewardLabel')}
              {prevEventRank && (
                <span className="ml-1 font-semibold text-amber-600">#{prevEventRank}</span>
              )}
              {' · '}
              {t('game:weeklyEvent.rewards.fragments', { count: rewardFragments })}
            </p>
            <button
              onClick={handleClaimReward}
              disabled={isClaimingReward}
              className={isPremiumUi
                ? `w-full py-2 font-semibold text-sm ${premiumUiCompartmentButtonClassName}`
                : 'w-full py-2.5 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition disabled:opacity-50'
              }
            >
              {isClaimingReward
                ? t('common:labels.loading')
                : isPremiumUi
                  ? <><span className="font-bold">&#9632;</span>{' '}{t('game:weeklyEvent.claimReward')}</>
                  : `🎁 ${t('game:weeklyEvent.claimReward')}`}
            </button>
            {claimError && (
              <p className="mt-1.5 text-xs text-red-500 text-center">{claimError}</p>
            )}
          </div>
        )}

        {/* 시작/이어하기 버튼 */}
        <div className={isPremiumUi ? 'px-3 pb-2 space-y-1.5' : 'px-5 pb-3 space-y-2'}>
          {!hasSavedGame && canUnlockByAd && isAttemptUnlockAdSupported && (
            <button
              onClick={handleWatchAttemptUnlockAd}
              disabled={isAttemptUnlockAdInProgress || !isAttemptUnlockAdReady}
              className={isPremiumUi
                ? `w-full py-2 font-bold text-base ${premiumUiCompartmentButtonClassName} ${isAttemptUnlockAdInProgress || !isAttemptUnlockAdReady ? 'bg-gray-100 text-gray-500' : ''}`
                : `w-full py-3.5 rounded-xl font-bold text-base transition-all ${isAttemptUnlockAdInProgress || !isAttemptUnlockAdReady
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'
                }`
              }
            >
              {isAttemptUnlockAdInProgress
                ? t('game:weeklyEvent.adUnlockLoading')
                : isAttemptUnlockAdReady
                  ? t('game:weeklyEvent.watchAdForAttempt')
                  : t('game:weeklyEvent.adUnlockPreparing')}
            </button>
          )}
          {hasSavedGame && (
            <button
              onClick={onContinueEvent}
              className={isPremiumUi
                ? `w-full py-2 font-bold text-base ${premiumUiCompartmentButtonClassName}`
                : `w-full py-3.5 rounded-xl bg-gradient-to-r ${theme.gradient} text-white font-bold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`
              }
            >
              <Play size={16} className="inline mr-1 -mt-0.5" />
              {t('game:weeklyEvent.continueGame')}
            </button>
          )}
          {canStart && (
            <button
              onClick={onStartEvent}
              className={isPremiumUi
                ? `w-full py-2 ${hasSavedGame ? '' : ''} font-bold text-base ${premiumUiCompartmentButtonClassName}`
                : `w-full py-3.5 rounded-xl ${hasSavedGame
                  ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  : `bg-gradient-to-r ${theme.gradient} text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5`
                } font-bold text-base transition-all`
              }
            >
              {hasSavedGame ? (
                <>{t('game:weeklyEvent.newAttempt')} ({remainingInlineText})</>
              ) : (
                <>
                  <Play size={16} className="inline mr-1 -mt-0.5" />
                  {t('game:weeklyEvent.start')} ({remainingInlineText})
                </>
              )}
            </button>
          )}
          {!canStart && !hasSavedGame && (
            <div className="text-center py-3 text-sm text-gray-400">
              {canUnlockByAd
                ? (isAttemptUnlockAdSupported ? t('game:weeklyEvent.adUnlockHint') : t('game:weeklyEvent.adUnlockUnsupported'))
                : t('game:weeklyEvent.maxAttempts')}
            </div>
          )}
          {attemptUnlockNotice && (
            <p className="text-center text-xs text-gray-500">{attemptUnlockNotice}</p>
          )}
        </div>

        {/* 랭킹 */}
        <div className={isPremiumUi ? 'px-3 pb-3' : 'px-5 pb-5'}>
          {/* 주차 탭 토글 */}
          <div className={isPremiumUi ? `${premiumUiEventTabStripClassName} mb-2` : 'flex items-center gap-1 mb-3'}>
            <button
              onClick={() => setShowPrevWeek(false)}
              data-active={!showPrevWeek}
              className={isPremiumUi
                ? premiumUiEventTabButtonClassName
                : `flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${!showPrevWeek
                  ? `bg-gradient-to-r ${theme.gradient} text-white shadow-sm`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`
              }
            >
              {t('game:weeklyEvent.thisWeek')}
            </button>
            <button
              onClick={() => setShowPrevWeek(true)}
              data-active={showPrevWeek}
              className={isPremiumUi
                ? premiumUiEventTabButtonClassName
                : `flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${showPrevWeek
                  ? `bg-gradient-to-r ${theme.gradient} text-white shadow-sm`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`
              }
            >
              {t('game:weeklyEvent.lastWeek')}
            </button>
          </div>

          {!showPrevWeek ? (
            /* 이번 주 랭킹 */
            currentRankingsError !== 'none' ? (
              <p className="text-center text-xs text-red-500 py-3">
                {currentRankingsError === 'network'
                  ? t('modals:leaderboard.offline')
                  : t('modals:leaderboard.error')}
              </p>
            ) : rankings.length > 0 ? (
              <>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
                  <Trophy size={14} className="text-amber-500" />
                  {t('game:weeklyEvent.rankings')}
                </h3>
                <div className={isPremiumUi ? `${premiumUiSunkenClassName} space-y-0 max-h-60 overflow-y-auto modal-scroll-panel` : 'space-y-1 max-h-60 overflow-y-auto modal-scroll-panel'}>
                  {rankings.slice(0, 20).map((entry, idx) => {
                    const levelBadgeEmoji = getLevelBadgeById(entry.levelBadge ?? null)?.emoji;
                    return (
                      <div
                        key={idx}
                        className={isPremiumUi
                          ? `${premiumUiListItemClassName} flex items-center justify-between py-1 px-2 text-sm ${myRank === entry.rank ? premiumUiListItemHighlightClassName : ''}`
                          : `flex items-center justify-between py-1.5 px-2.5 rounded-lg text-sm ${myRank === entry.rank ? 'bg-amber-50 font-semibold' : ''}`
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-6 text-center font-bold ${entry.rank === 1 ? 'text-amber-500' :
                            entry.rank === 2 ? 'text-gray-400' :
                              entry.rank === 3 ? 'text-amber-700' : 'text-gray-400'
                            }`}>
                            {isPremiumUi
                              ? (entry.rank <= 3 ? ['[1]', '[2]', '[3]'][entry.rank - 1] : entry.rank)
                              : (entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank)
                            }
                          </span>
                          <span className="text-gray-800 truncate max-w-[140px]">
                            {levelBadgeEmoji ? `${levelBadgeEmoji} ${entry.name}` : entry.name}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">{entry.score.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-center text-xs text-gray-400 py-3">{t('game:weeklyEvent.noRankings')}</p>
            )
          ) : (
            /* 이전 주 랭킹 */
            <>
              {prevEventInfo && (
                <p className="text-xs text-gray-500 mb-2 flex items-center gap-1.5">
                  <span className="text-base">{EVENT_THEME[prevEventInfo.eventType]?.icon}</span>
                  <span className="font-semibold">{t(`game:weeklyEvent.events.${prevEventInfo.eventType}.name`)}</span>
                </p>
              )}
              {prevLoading ? (
                <p className="text-center text-xs text-gray-400 py-3">
                  <span className="inline-block w-3 h-3 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin mr-1" />
                  {t('common:labels.loading')}
                </p>
              ) : prevRankingsError !== 'none' ? (
                <p className="text-center text-xs text-red-500 py-3">
                  {prevRankingsError === 'network'
                    ? t('modals:leaderboard.offline')
                    : t('modals:leaderboard.error')}
                </p>
              ) : prevRankings.length > 0 ? (
                <div className={isPremiumUi ? `${premiumUiSunkenClassName} space-y-0 max-h-60 overflow-y-auto modal-scroll-panel` : 'space-y-1 max-h-60 overflow-y-auto modal-scroll-panel'}>
                  {prevRankings.slice(0, 20).map((entry, idx) => {
                    const levelBadgeEmoji = getLevelBadgeById(entry.levelBadge ?? null)?.emoji;
                    return (
                      <div
                        key={idx}
                        className={isPremiumUi
                          ? `${premiumUiListItemClassName} flex items-center justify-between py-1 px-2 text-sm ${prevMyRank === entry.rank ? premiumUiListItemHighlightClassName : ''}`
                          : `flex items-center justify-between py-1.5 px-2.5 rounded-lg text-sm ${prevMyRank === entry.rank ? 'bg-amber-50 font-semibold' : ''}`
                        }
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-6 text-center font-bold ${entry.rank === 1 ? 'text-amber-500' :
                            entry.rank === 2 ? 'text-gray-400' :
                              entry.rank === 3 ? 'text-amber-700' : 'text-gray-400'
                            }`}>
                            {isPremiumUi
                              ? (entry.rank <= 3 ? ['[1]', '[2]', '[3]'][entry.rank - 1] : entry.rank)
                              : (entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank)
                            }
                          </span>
                          <span className="text-gray-800 truncate max-w-[140px]">
                            {levelBadgeEmoji ? `${levelBadgeEmoji} ${entry.name}` : entry.name}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">{entry.score.toLocaleString()}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-center text-xs text-gray-400 py-3">{t('game:weeklyEvent.noRankings')}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WeeklyEventModal;
