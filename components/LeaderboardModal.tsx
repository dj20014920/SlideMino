import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, Trophy, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import { rankingService, RankEntry } from '../services/rankingService';
import {
  fetchEventRankings,
  formatEventRemaining,
  getCurrentEvent,
  getPreviousEvent,
  type CurrentEventInfo,
  type EventRankingEntry,
} from '../services/weeklyEventService';
import { getSeasonCountdown } from '../services/seasonService';
import { getLevelBadgeById } from '../services/xpLevelService';

interface LeaderboardModalProps {
  open: boolean;
  onClose: () => void;
}

type LeaderboardModeTab = 'NORMAL' | 'WEEKLY_EVENT';
type NormalLeaderboardTab = 'ALL' | '4x4' | '5x5' | '7x7' | '8x8' | '10x10';
type EventPeriodTab = 'CURRENT' | 'PREVIOUS';

interface EventLeaderboardState {
  rankings: EventRankingEntry[];
  myRank?: number;
  total: number;
  loading: boolean;
  hasError: boolean;
  errorType: 'none' | 'http' | 'network';
  loaded: boolean;
}

const LEADERBOARD_REFRESH_INTERVAL_MS = 5000;
const NORMAL_TABS: readonly NormalLeaderboardTab[] = ['ALL', '4x4', '5x5', '7x7', '8x8', '10x10'];
const EMPTY_EVENT_STATE: EventLeaderboardState = {
  rankings: [],
  total: 0,
  loading: false,
  hasError: false,
  errorType: 'none',
  loaded: false,
};

const formatDifficultyLabel = (difficulty?: string): string | null => {
  if (!difficulty) return null;
  const trimmed = difficulty.trim();
  const match = trimmed.match(/^(\d+)(?:x\1)?$/i);
  return match ? `${match[1]}x${match[1]}` : trimmed;
};

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  useBodyScrollLock(open);
  const { isWin98ThemeActive } = useBlockCustomization();
  const isWin98 = Boolean(isWin98ThemeActive);

  const [modeTab, setModeTab] = useState<LeaderboardModeTab>('NORMAL');
  const [activeTab, setActiveTab] = useState<NormalLeaderboardTab>('ALL');
  const [eventPeriodTab, setEventPeriodTab] = useState<EventPeriodTab>('CURRENT');

  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const [countdown, setCountdown] = useState(() => getSeasonCountdown());

  const [currentEventInfo, setCurrentEventInfo] = useState<CurrentEventInfo>(() => getCurrentEvent());
  const [previousEventInfo, setPreviousEventInfo] = useState<CurrentEventInfo>(() => getPreviousEvent());
  const [currentEventState, setCurrentEventState] = useState<EventLeaderboardState>(EMPTY_EVENT_STATE);
  const [previousEventState, setPreviousEventState] = useState<EventLeaderboardState>(EMPTY_EVENT_STATE);
  const [currentEventRemainingText, setCurrentEventRemainingText] = useState('');

  const formatCurrentEventRemaining = useCallback((endsAt: number): string => {
    return formatEventRemaining(Math.max(0, endsAt - Date.now()), {
      endedLabel: String(t('game:weeklyEvent.time.ended')),
      daySuffix: String(t('game:weeklyEvent.time.dayShort')),
      hourSuffix: String(t('game:weeklyEvent.time.hourShort')),
      minuteSuffix: String(t('game:weeklyEvent.time.minuteShort')),
    });
  }, [t]);

  const fetchNormalLeaderboard = useCallback(async (showLoading: boolean) => {
    if (showLoading) setLoading(true);
    setHasError(false);

    try {
      const result = await rankingService.getLeaderboard();
      setRankings(result.data);
      setIsOffline(result.offline);
      setFromCache(result.fromCache);
    } catch (err) {
      console.error(err);
      setHasError(true);
      setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
      setFromCache(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWeeklyEventLeaderboard = useCallback(async (period: EventPeriodTab, showLoading: boolean) => {
    const isCurrent = period === 'CURRENT';
    const eventId = isCurrent ? currentEventInfo.eventId : previousEventInfo.eventId;
    const setEventState = isCurrent ? setCurrentEventState : setPreviousEventState;

    if (showLoading) {
      setEventState((prev) => ({ ...prev, loading: true }));
    }
    setEventState((prev) => ({ ...prev, hasError: false, errorType: 'none' }));

    const result = await fetchEventRankings(eventId);
    const isOfflineNow = typeof navigator !== 'undefined' ? !navigator.onLine : false;
    setEventState((prev) => {
      const errorType: EventLeaderboardState['errorType'] = result.error ?? 'none';
      const keepPreviousData = errorType === 'network' && prev.loaded;
      return {
        rankings: keepPreviousData ? prev.rankings : result.rankings,
        myRank: keepPreviousData ? prev.myRank : result.myRank,
        total: keepPreviousData ? prev.total : result.total,
        loading: false,
        hasError: errorType === 'http' || (errorType === 'network' && !isOfflineNow),
        errorType,
        loaded: true,
      };
    });
  }, [currentEventInfo.eventId, previousEventInfo.eventId]);

  // 모달 닫힘 시 기본 탭 초기화
  useEffect(() => {
    if (open) return;
    setModeTab('NORMAL');
    setActiveTab('ALL');
    setEventPeriodTab('CURRENT');
  }, [open]);

  // 시즌 카운트다운 1분마다 갱신
  useEffect(() => {
    if (!open) return;
    setCountdown(getSeasonCountdown());
    const intervalId = window.setInterval(() => {
      setCountdown(getSeasonCountdown());
    }, 60_000);
    return () => window.clearInterval(intervalId);
  }, [open]);

  // 현재/이전 이벤트 정보 + 현재 이벤트 남은 시간 텍스트 갱신
  useEffect(() => {
    if (!open) return;

    const syncEventInfo = () => {
      const current = getCurrentEvent();
      setCurrentEventInfo(current);
      setPreviousEventInfo(getPreviousEvent());
      setCurrentEventRemainingText(formatCurrentEventRemaining(current.endsAt));
    };

    syncEventInfo();

    const intervalId = window.setInterval(syncEventInfo, 60_000);
    return () => window.clearInterval(intervalId);
  }, [open, formatCurrentEventRemaining]);

  // 주차 변경 시 이벤트 랭킹 캐시 상태 초기화
  useEffect(() => {
    setCurrentEventState(EMPTY_EVENT_STATE);
  }, [currentEventInfo.eventId]);

  useEffect(() => {
    setPreviousEventState(EMPTY_EVENT_STATE);
  }, [previousEventInfo.eventId]);

  // 모달 오픈 시: 기본 탭(일반 모드)만 프리로드
  useEffect(() => {
    if (!open) return;
    void fetchNormalLeaderboard(true);
  }, [open, fetchNormalLeaderboard]);

  // 선택된 뷰 자동 새로고침
  const refreshActiveView = useCallback(() => {
    if (modeTab === 'NORMAL') {
      void fetchNormalLeaderboard(false);
      return;
    }

    if (eventPeriodTab === 'CURRENT') {
      void fetchWeeklyEventLeaderboard('CURRENT', false);
    }
  }, [modeTab, eventPeriodTab, fetchNormalLeaderboard, fetchWeeklyEventLeaderboard]);

  useEffect(() => {
    if (!open) return;

    const intervalId = window.setInterval(refreshActiveView, LEADERBOARD_REFRESH_INTERVAL_MS);
    const handleOnline = () => {
      if (modeTab === 'WEEKLY_EVENT' && eventPeriodTab === 'PREVIOUS' && previousEventState.hasError) {
        void fetchWeeklyEventLeaderboard('PREVIOUS', false);
        return;
      }
      refreshActiveView();
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [
    open,
    modeTab,
    eventPeriodTab,
    previousEventState.hasError,
    refreshActiveView,
    fetchWeeklyEventLeaderboard,
  ]);

  // 현재 주 탭은 필요할 때만 로드
  useEffect(() => {
    if (!open || modeTab !== 'WEEKLY_EVENT' || eventPeriodTab !== 'CURRENT') return;
    if (currentEventState.loaded || currentEventState.loading) return;
    void fetchWeeklyEventLeaderboard('CURRENT', true);
  }, [
    open,
    modeTab,
    eventPeriodTab,
    currentEventState.loaded,
    currentEventState.loading,
    fetchWeeklyEventLeaderboard,
  ]);

  // 지난 주 탭은 필요할 때만 로드
  useEffect(() => {
    if (!open || modeTab !== 'WEEKLY_EVENT' || eventPeriodTab !== 'PREVIOUS') return;
    if (previousEventState.loaded || previousEventState.loading) return;
    void fetchWeeklyEventLeaderboard('PREVIOUS', true);
  }, [
    open,
    modeTab,
    eventPeriodTab,
    previousEventState.loaded,
    previousEventState.loading,
    fetchWeeklyEventLeaderboard,
  ]);

  const filteredRankings = rankings.filter((entry) => {
    if (activeTab === 'ALL') return true;
    const label = formatDifficultyLabel(entry.difficulty);
    return label === activeTab;
  });

  if (!open) return null;

  const countdownText = countdown.totalMs <= 0
    ? t('common:season.countdownDone')
    : countdown.isUrgent
      ? t('common:season.countdownUrgent', { hours: countdown.hours, minutes: countdown.minutes } as any)
      : t('common:season.countdown', { days: countdown.days, hours: countdown.hours } as any);

  const selectedEventInfo = eventPeriodTab === 'CURRENT' ? currentEventInfo : previousEventInfo;
  const selectedEventState = eventPeriodTab === 'CURRENT' ? currentEventState : previousEventState;
  const selectedEventTotal = selectedEventState.total > 0
    ? selectedEventState.total
    : selectedEventState.rankings.length;
  const selectedEventNameRaw = String(t(`game:weeklyEvent.events.${selectedEventInfo.eventType}.name`));
  const selectedEventName = selectedEventNameRaw.includes('weeklyEvent.events.')
    ? selectedEventInfo.eventType
    : selectedEventNameRaw;
  const eventOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay ${isWin98 ? 'win98-modal-overlay' : ''}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 ${isWin98 ? '' : 'bg-black/40 backdrop-blur-sm'} animate-fade-in`}
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className={isWin98
        ? 'window relative w-full max-w-md overflow-hidden flex flex-col max-h-[80vh] modal-safe-panel'
        : 'relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh] modal-safe-panel'
      }>
        {/* Header */}
        {isWin98 ? (
          <div className="title-bar">
            <div className="title-bar-text"><span style={{color:'#1084d0',fontWeight:'bold'}}>◆</span> {t('modals:leaderboard.title')}</div>
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>
        ) : (
          <div className="p-6 pb-2 flex justify-between items-center bg-gray-50 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="text-yellow-500 fill-yellow-500" />
              {t('modals:leaderboard.title')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* 랭킹 모드 분리 탭: 일반 / 주간 이벤트 */}
        <div className={isWin98 ? 'win98-tabstrip' : 'flex items-center gap-2 border-b border-gray-100 bg-white px-4 py-3'}>
          <button
            onClick={() => setModeTab('NORMAL')}
            data-active={modeTab === 'NORMAL'}
            className={isWin98
              ? 'win98-tabstrip-tab'
              : `px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  modeTab === 'NORMAL'
                    ? 'bg-gray-900 text-white shadow-md'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`
            }
          >
            {t('modals:leaderboard.modeTabs.normal')}
          </button>
          <button
            onClick={() => setModeTab('WEEKLY_EVENT')}
            data-active={modeTab === 'WEEKLY_EVENT'}
            className={isWin98
              ? 'win98-tabstrip-tab'
              : `px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                  modeTab === 'WEEKLY_EVENT'
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`
            }
          >
            {t('modals:leaderboard.modeTabs.weeklyEvent')}
          </button>
        </div>

        <div className="px-4 py-2 text-[11px] text-gray-500 bg-gray-50 border-b border-gray-100">
          {t('modals:leaderboard.separateNotice')}
        </div>

        {modeTab === 'NORMAL' ? (
          <>
            {/* 시즌 카운트다운 */}
            <div className={`px-4 py-2 text-center text-xs font-semibold ${
              countdown.isUrgent
                ? 'bg-red-50 text-red-600 border-b border-red-100'
                : 'bg-blue-50 text-blue-600 border-b border-blue-100'
            }`}>
              {String(countdownText)}
            </div>

            {/* 일반 모드 세부 탭 */}
            <div className={isWin98 ? 'win98-tabstrip' : 'flex items-center gap-2 overflow-x-auto overflow-y-visible border-b border-gray-100 bg-white px-4 py-3'}>
              {NORMAL_TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  data-active={activeTab === tab}
                  className={isWin98
                    ? 'win98-tabstrip-tab'
                    : `px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                      ${activeTab === tab
                        ? 'bg-gray-900 text-white shadow-md'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`
                  }
                >
                  {tab === 'ALL' ? t('modals:leaderboard.tabs.all') : tab}
                </button>
              ))}
            </div>

            {/* 일반 모드 랭킹 리스트 */}
            <div className={isWin98 ? 'window-body flex-1 overflow-y-auto p-2 space-y-1' : 'flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50'}>
              {(isOffline || fromCache) && (
                <div className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                  {isOffline ? t('modals:leaderboard.offline') : t('modals:leaderboard.cached')}
                </div>
              )}
              {loading ? (
                <div className="text-center py-10 text-gray-400">{t('common:labels.loading')}</div>
              ) : hasError ? (
                <div className="text-center py-10 text-red-400">{t('modals:leaderboard.error')}</div>
              ) : filteredRankings.length === 0 ? (
                <div className="text-center py-10 text-gray-400" style={{ whiteSpace: 'pre-line' }}>
                  {t('modals:leaderboard.empty')}
                </div>
              ) : (
                filteredRankings.map((entry, index) => {
                  const levelBadge = getLevelBadgeById(entry.levelBadge ?? null);
                  return (
                    <div
                      key={`${entry.name}-${entry.score}-${entry.timestamp}-${index}`}
                      className={isWin98
                        ? 'win98-list-item flex items-center justify-between p-1.5'
                        : 'bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between'
                      }
                    >
                      <div className="flex items-center gap-4">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                          ${index === 0 ? 'bg-yellow-100 text-yellow-600' :
                            index === 1 ? 'bg-gray-100 text-gray-600' :
                              index === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}
                        `}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 max-w-[160px] truncate" title={entry.name}>
                            {levelBadge ? `${levelBadge.emoji} ` : ''}{entry.name}
                          </div>
                          <div className="text-xs text-gray-400 flex items-center gap-2">
                            <span>{formatDifficultyLabel(entry.difficulty) || '8x8'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-emerald-600 tabular-nums">
                          {entry.score.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">{t('common:labels.pts')}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <>
            {/* 이벤트 요약 */}
            <div className={isWin98 ? 'mx-2 mt-2 win98-sunken p-2' : 'mx-4 mt-3 p-3 rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 via-amber-50 to-rose-50'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-orange-600 uppercase tracking-wide">
                    {eventPeriodTab === 'CURRENT' ? t('game:weeklyEvent.thisWeek') : t('game:weeklyEvent.lastWeek')}
                  </p>
                  <p className="font-bold text-orange-900 truncate" title={selectedEventName}>
                    {selectedEventName}
                  </p>
                </div>
                <div className="text-right text-xs text-orange-700">
                  <p className="font-semibold">
                    {selectedEventInfo.rule.boardSize}x{selectedEventInfo.rule.boardSize}
                  </p>
                  {eventPeriodTab === 'CURRENT' && (
                    <p className="inline-flex items-center gap-1 text-orange-600 mt-1">
                      <CalendarClock size={12} />
                      {t('game:weeklyEvent.remaining')} {currentEventRemainingText}
                    </p>
                  )}
                </div>
              </div>
              {selectedEventState.myRank && (
                <p className="mt-2 text-xs font-semibold text-orange-700">
                  {t('game:weeklyEvent.myRank')}: #{selectedEventState.myRank} / {selectedEventTotal}
                </p>
              )}
            </div>

            {/* 이벤트 기간 탭 */}
            <div className={isWin98 ? 'win98-tabstrip mt-2' : 'flex items-center gap-2 overflow-x-auto overflow-y-visible border-b border-gray-100 bg-white px-4 py-3 mt-3'}>
              <button
                onClick={() => setEventPeriodTab('CURRENT')}
                data-active={eventPeriodTab === 'CURRENT'}
                className={isWin98
                  ? 'win98-tabstrip-tab'
                  : `px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                    ${eventPeriodTab === 'CURRENT'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                    }`
                }
              >
                {t('game:weeklyEvent.thisWeek')}
              </button>
              <button
                onClick={() => setEventPeriodTab('PREVIOUS')}
                data-active={eventPeriodTab === 'PREVIOUS'}
                className={isWin98
                  ? 'win98-tabstrip-tab'
                  : `px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                    ${eventPeriodTab === 'PREVIOUS'
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`
                }
              >
                {t('game:weeklyEvent.lastWeek')}
              </button>
            </div>

            {/* 이벤트 랭킹 리스트 */}
            <div className={isWin98 ? 'window-body flex-1 overflow-y-auto p-2 space-y-1' : 'flex-1 overflow-y-auto p-4 space-y-2 bg-orange-50/40'}>
              {eventOffline && (
                <div className="px-4 py-2 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200">
                  {t('modals:leaderboard.offline')}
                </div>
              )}
              {selectedEventState.loading ? (
                <div className="text-center py-10 text-gray-400">{t('common:labels.loading')}</div>
              ) : selectedEventState.hasError ? (
                <div className="text-center py-10 text-red-400">{t('modals:leaderboard.error')}</div>
              ) : selectedEventState.rankings.length === 0 ? (
                <div className="text-center py-10 text-gray-400">{t('game:weeklyEvent.noRankings')}</div>
              ) : (
                selectedEventState.rankings.map((entry, index) => {
                  const levelBadge = getLevelBadgeById(entry.levelBadge ?? null);
                  const isMyRank = selectedEventState.myRank === entry.rank;
                  return (
                    <div
                      key={`${entry.rank}-${entry.name}-${index}`}
                      className={isWin98
                        ? `win98-list-item flex items-center justify-between p-1.5 ${isMyRank ? 'win98-list-item-highlight' : ''}`
                        : `bg-white p-4 rounded-2xl shadow-sm border flex items-center justify-between ${
                            isMyRank ? 'border-orange-300 bg-orange-50/70' : 'border-gray-100'
                          }`
                      }
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                          ${entry.rank === 1 ? 'bg-yellow-100 text-yellow-600' :
                            entry.rank === 2 ? 'bg-gray-100 text-gray-600' :
                              entry.rank === 3 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}
                        `}>
                          {isWin98
                            ? (entry.rank === 1 ? <span style={{color:'#FFD700',fontWeight:'bold'}}>[1]</span> : entry.rank === 2 ? <span style={{color:'#a0a0a0',fontWeight:'bold'}}>[2]</span> : entry.rank === 3 ? <span style={{color:'#f97316',fontWeight:'bold'}}>[3]</span> : entry.rank)
                            : (entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : entry.rank)
                          }
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-gray-800 max-w-[170px] truncate" title={entry.name}>
                            {levelBadge ? `${levelBadge.emoji} ` : ''}{entry.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            #{entry.rank}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-orange-600 tabular-nums">
                          {entry.score.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">{t('common:labels.pts')}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
