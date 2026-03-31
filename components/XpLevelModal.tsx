/**
 * XP & 레벨 모달 — 현재 레벨, XP 진행률, 배지, 보상 목록, XP 로그
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Star, Award, TrendingUp, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import { gameEventBus } from '../services/gameEventBus';
import { getAnalyticsInstallHash } from '../services/analyticsService';
import {
  getXpProgress,
  getLevelBadges,
  getTodayXpLog,
  getWeeklyXpSummary,
  getHonorLevels,
  getPendingSpecialRewards,
  claimSpecialReward,
  xpRequiredForLevel,
  getSeasonRemainingMs,
  LEVEL_BADGES,
  type XpProgress,
  type LevelBadge,
  type XpLogEntry,
} from '../services/xpLevelService';

interface XpLevelModalProps {
  open: boolean;
  onClose: () => void;
  onSpecialRewardClaim?: (rewardType: string) => void;
}

/** 시즌 남은 시간 포맷 */
function formatSeasonRemaining(ms: number): string {
  if (ms <= 0) return '종료';
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h`;
}

/** XP 소스 한글/아이콘 */
function getSourceLabel(source: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    daily_mission: t('common:xp.sources.dailyMission'),
    weekly_mission: t('common:xp.sources.weeklyMission'),
    event: t('common:xp.sources.event'),
    streak: t('common:xp.sources.streak'),
    tile_2048: t('common:xp.sources.tile2048'),
    skin: t('common:xp.sources.skin'),
    game_complete: t('common:xp.sources.gameComplete'),
  };
  return map[source] ?? source;
}

type XpMethodSource = 'daily_mission' | 'weekly_mission' | 'event' | 'streak' | 'tile_2048' | 'skin' | 'game_complete';

interface XpMethodGuideItem {
  source: XpMethodSource;
  amountLabel: string;
  dailyLimit: 'once' | 'unlimited';
  descKey: string;
}

const XP_METHOD_GUIDE: readonly XpMethodGuideItem[] = [
  { source: 'daily_mission', amountLabel: '+10 XP', dailyLimit: 'once', descKey: 'common:xp.earnMethods.dailyMission' },
  { source: 'weekly_mission', amountLabel: '+15 XP', dailyLimit: 'once', descKey: 'common:xp.earnMethods.weeklyMission' },
  { source: 'event', amountLabel: '+20 XP', dailyLimit: 'once', descKey: 'common:xp.earnMethods.event' },
  { source: 'streak', amountLabel: '+1~10 XP', dailyLimit: 'once', descKey: 'common:xp.earnMethods.streak' },
  { source: 'tile_2048', amountLabel: '+2 XP', dailyLimit: 'unlimited', descKey: 'common:xp.earnMethods.tile2048' },
  { source: 'skin', amountLabel: '+5 XP', dailyLimit: 'once', descKey: 'common:xp.earnMethods.skin' },
  { source: 'game_complete', amountLabel: '+10 XP', dailyLimit: 'once', descKey: 'common:xp.earnMethods.gameComplete' },
];

export const XpLevelModal: React.FC<XpLevelModalProps> = ({ open, onClose, onSpecialRewardClaim }) => {
  const { t } = useTranslation();
  const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
  const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
  const premiumUiWindowClassName = premiumUiObjects.windowClassName;
  const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
  const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
  const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
  const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
  const premiumUiSunkenClassName = premiumUiObjects.panels.sunkenClassName;
  const premiumUiBadgeClassName = premiumUiObjects.panels.badgeClassName;
  const premiumUiProgressTrackClassName = premiumUiObjects.progress.trackClassName;
  const premiumUiProgressFillClassName = premiumUiObjects.progress.fillClassName;
  const premiumUiModalWindowClassName = premiumUiObjects.extended.windows.modalWindowClassName;
  const isPremiumUi = Boolean(isPremiumUiThemeActive);
  useBodyScrollLock(open);
  const [progress, setProgress] = useState<XpProgress>(() => getXpProgress());
  const [badges, setBadges] = useState<LevelBadge[]>([]);
  const [todayLog, setTodayLog] = useState<XpLogEntry[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<{ date: string; total: number }[]>([]);
  const [honorLevels, setHonorLevels] = useState<Record<string, number>>({});
  const [pendingRewards, setPendingRewards] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [installHash, setInstallHash] = useState<string | null>(null);
  const [hashCopied, setHashCopied] = useState(false);

  const refresh = useCallback(() => {
    setProgress(getXpProgress());
    setBadges(getLevelBadges());
    setTodayLog(getTodayXpLog());
    setWeeklySummary(getWeeklyXpSummary());
    setHonorLevels(getHonorLevels());
    setPendingRewards(getPendingSpecialRewards());
    setInstallHash(getAnalyticsInstallHash());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const unsubXp = gameEventBus.on('XP_GAINED', () => refresh());
    const unsubLevelUp = gameEventBus.on('LEVEL_UP', () => refresh());
    const refreshIntervalId = window.setInterval(() => refresh(), 60_000);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      unsubXp();
      unsubLevelUp();
      window.clearInterval(refreshIntervalId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [open, refresh]);

  const [claimingReward, setClaimingReward] = useState<string | null>(null);

  const handleSpecialClaim = useCallback((rewardType: string) => {
    // 중복 클릭 방지: 이미 수령 처리 중이면 무시
    if (claimingReward) return;
    setClaimingReward(rewardType);

    const success = claimSpecialReward(rewardType);
    setPendingRewards(getPendingSpecialRewards());

    // claimSpecialReward가 성공한 경우에만 후속 보상 지급
    if (success) {
      onSpecialRewardClaim?.(rewardType);
    }
    setClaimingReward(null);
  }, [onSpecialRewardClaim, claimingReward]);

  if (!open) return null;

  const seasonRemMs = getSeasonRemainingMs();
  const todayTotalXp = todayLog.reduce((sum, e) => sum + e.amount, 0);
  const maxBarXp = weeklySummary.reduce((max, d) => Math.max(max, d.total), 1);

  return (
    <div
      className={`fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay ${isPremiumUi ? premiumUiModalOverlayClassName : 'bg-black/50 backdrop-blur-sm'}`}
      onClick={onClose}
    >
      <div
        className={isPremiumUi
          ? `${premiumUiWindowClassName} ${premiumUiModalWindowClassName} w-full max-w-md max-h-[85vh] modal-safe-panel overflow-hidden flex flex-col`
          : 'bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] modal-safe-panel overflow-hidden flex flex-col'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Win98 타이틀 바 */}
        {isPremiumUi && (
          <div className={premiumUiTitleBarClassName}>
            <div className={premiumUiTitleBarTextClassName}><span className="font-bold">★</span>{' '}Lv.{progress.level} — XP</div>
            <div className={premiumUiTitleBarControlsClassName}>
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>
        )}

        {/* 헤더 */}
        {isPremiumUi ? (
          <div className="px-3 pt-3 pb-2">
            <div className={`${premiumUiSunkenClassName} p-2`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base">Lv.{progress.level}</span>
                  <button
                    type="button"
                    className="text-[10px] hover:underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (installHash) {
                        void navigator.clipboard?.writeText(installHash).then(() => {
                          setHashCopied(true);
                          setTimeout(() => setHashCopied(false), 1500);
                        });
                      }
                    }}
                    title={installHash ? `ID: ${installHash}` : progress.seasonId}
                  >
                    {installHash ? `${installHash.slice(0, 8)}...${installHash.slice(-6)}` : progress.seasonId}
                    {installHash && (hashCopied ? ' \u2713' : ' [copy]')}
                  </button>
                </div>
                <div className="text-right text-xs">
                  <div>{t('common:xp.seasonRemainingLabel')}</div>
                  <div className="font-bold">{formatSeasonRemaining(seasonRemMs)}</div>
                </div>
              </div>
              {!progress.isMaxLevel ? (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>{progress.xp} / {progress.xpRequired} XP</span>
                    <span>{progress.progressPercent}%</span>
                  </div>
                  <div className={premiumUiProgressTrackClassName}>
                    <div className={premiumUiProgressFillClassName} style={{ width: `${progress.progressPercent}%` }} />
                  </div>
                  <div className="text-xs mt-1">
                    {t('common:xp.nextLevel')}: {xpRequiredForLevel(progress.level + 1) - progress.xp} XP
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm font-bold">MAX LEVEL</div>
              )}
              <div className="mt-1 text-xs">
                {t('common:xp.todayXp')}: <span className="font-bold">+{todayTotalXp} XP</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-5 text-white">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              aria-label={t('common:buttons.close')}
            >
              <X size={16} />
            </button>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-black">
                {progress.level}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold opacity-90">Lv.{progress.level}</div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-[10px] opacity-60 hover:opacity-90 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (installHash) {
                      void navigator.clipboard?.writeText(installHash).then(() => {
                        setHashCopied(true);
                        setTimeout(() => setHashCopied(false), 1500);
                      });
                    }
                  }}
                  title={installHash ? `ID: ${installHash}` : progress.seasonId}
                >
                  <span className="font-mono truncate max-w-[120px]">
                    {installHash ? `${installHash.slice(0, 8)}...${installHash.slice(-6)}` : progress.seasonId}
                  </span>
                  {installHash && (hashCopied ? <Check size={10} /> : <Copy size={10} />)}
                </button>
              </div>
              <div className="text-right">
                <div className="text-xs opacity-70">{t('common:xp.seasonRemainingLabel')}</div>
                <div className="text-sm font-bold">{formatSeasonRemaining(seasonRemMs)}</div>
              </div>
            </div>
            {!progress.isMaxLevel ? (
              <div>
                <div className="flex justify-between text-xs mb-1 opacity-80">
                  <span>{progress.xp} / {progress.xpRequired} XP</span>
                  <span>{progress.progressPercent}%</span>
                </div>
                <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-300 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${progress.progressPercent}%` }}
                  />
                </div>
                <div className="text-xs text-white/60 mt-1">
                  {t('common:xp.nextLevel')}: {xpRequiredForLevel(progress.level + 1) - progress.xp} XP
                </div>
              </div>
            ) : (
              <div className="text-center text-sm font-semibold text-yellow-200">
                {'\u{1F3C6}'} {t('common:xp.maxLevel')}
              </div>
            )}
            <div className="mt-2 text-xs opacity-70">
              {t('common:xp.todayXp')}: <span className="font-bold text-yellow-200">+{todayTotalXp} XP</span>
            </div>
          </div>
        )}

        {/* 본문 */}
        <div
          className={isPremiumUi ? `${premiumUiWindowBodyClassName} flex-1 min-h-0 overflow-y-auto p-3 space-y-3 modal-scroll-panel` : 'flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-4 modal-scroll-panel'}
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >

          {/* 특별 보상 미수령 */}
          {pendingRewards.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1">
                <Award size={14} className="text-amber-500" />
                {t('common:xp.pendingRewards')}
              </h3>
              {pendingRewards.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-3">
                  <span className="text-sm font-semibold text-amber-800">
                    {t(`common:xp.specialRewards.${r}` as any)}
                  </span>
                  <button
                    onClick={() => handleSpecialClaim(r)}
                    disabled={claimingReward !== null}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('common:xp.claimReward')}
                  </button>
                </div>
              ))}
            </div>
          )}


          {/* 레벨 배지 */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1 mb-2">
              {isPremiumUi ? <span className="font-bold">★</span> : <Star size={14} className="text-purple-500" />}
              {t('common:xp.badges')}
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {LEVEL_BADGES.map((b) => {
                const earned = badges.some(eb => eb.id === b.id);
                return (
                  <div
                    key={b.id}
                    className={isPremiumUi
                      ? `flex flex-col items-center gap-0.5 p-2 text-center ${earned ? premiumUiSunkenClassName : 'opacity-40'}`
                      : `flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-all
                        ${earned ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50 border border-gray-100 opacity-40 grayscale'}`}
                  >
                    <span className="text-lg">{b.emoji}</span>
                    <span className="text-[10px] font-semibold text-gray-700">Lv.{b.level}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 명예 레벨 */}
          {Object.keys(honorLevels).length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1 mb-2">
                <TrendingUp size={14} className="text-blue-500" />
                {t('common:xp.honorLevels')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(honorLevels).map(([season, level]) => (
                  <div key={season} className="px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700">
                    {season}: Lv.{level}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 주간 XP 그래프 */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">{t('common:xp.weeklyXp')}</h3>
            <div className={`flex items-end gap-1 h-20 ${isPremiumUi ? `${premiumUiSunkenClassName} p-1` : ''}`}>
              {weeklySummary.map((day, i) => {
                const pct = maxBarXp > 0 ? (day.total / maxBarXp) * 100 : 0;
                const isToday = i === weeklySummary.length - 1;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-gray-400 tabular-nums">{day.total > 0 ? day.total : ''}</span>
                    <div className="w-full relative" style={{ height: '48px' }}>
                      <div
                        className={`absolute bottom-0 w-full transition-all duration-300 ${isPremiumUi
                          ? (isToday ? 'bg-gray-900' : 'bg-gray-500')
                          : (isToday ? 'bg-purple-500 rounded-t' : 'bg-purple-200 rounded-t')}`}
                        style={{ height: `${Math.max(pct, day.total > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-gray-400">{day.date.slice(8)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 오늘 XP 로그 (접기/펼치기) */}
          <div>
            <button
              onClick={() => setShowLog(!showLog)}
              className="flex items-center gap-1 text-sm font-bold text-gray-800 hover:text-gray-600 transition-colors"
            >
              {t('common:xp.todayLog')}
              {showLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showLog && (
              <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
                {todayLog.length === 0 ? (
                  <p className="text-xs text-gray-400">{t('common:xp.noLog')}</p>
                ) : (
                  todayLog.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between text-xs px-2 py-1 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">{getSourceLabel(entry.source, t as (key: string) => string)}</span>
                      <span className="font-bold text-purple-600">+{entry.amount} XP</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* XP 획득 방법 */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">{t('common:xp.earnMethodsTitle')}</h3>
            <div className="space-y-1.5">
              {XP_METHOD_GUIDE.map((item) => (
                <div key={item.source} className={isPremiumUi ? `${premiumUiSunkenClassName} px-3 py-2` : 'rounded-lg border border-gray-100 bg-gray-50 px-3 py-2'}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-700">
                      {getSourceLabel(item.source, t as (key: string) => string)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${isPremiumUi ? '' : 'text-purple-600'}`}>{item.amountLabel}</span>
                      <span className={isPremiumUi
                        ? premiumUiBadgeClassName
                        : `rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${item.dailyLimit === 'once' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {item.dailyLimit === 'once' ? t('common:xp.limitDailyOnce') : t('common:xp.limitUnlimited')}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">{t(item.descKey as any)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 레벨 보상 로드맵 (간략) */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-2">{t('common:xp.roadmap')}</h3>
            <div className="space-y-1">
              {[5, 10, 15, 20, 25, 30, 40, 50].map((lv) => {
                const reached = progress.level >= lv;
                return (
                  <div key={lv} className={`flex items-center justify-between text-xs px-3 py-1.5 rounded-lg ${reached ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'}`}>
                    <span className={`font-semibold ${reached ? 'text-emerald-700' : 'text-gray-500'}`}>
                      Lv.{lv}
                    </span>
                    <span className={`${reached ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {t(`common:xp.roadmapReward.lv${lv}` as any)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
