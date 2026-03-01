/**
 * XP & 레벨 모달 — 현재 레벨, XP 진행률, 배지, 보상 목록, XP 로그
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Star, Award, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
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

export const XpLevelModal: React.FC<XpLevelModalProps> = ({ open, onClose, onSpecialRewardClaim }) => {
  const { t } = useTranslation();
  const [progress, setProgress] = useState<XpProgress>(() => getXpProgress());
  const [badges, setBadges] = useState<LevelBadge[]>([]);
  const [todayLog, setTodayLog] = useState<XpLogEntry[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<{ date: string; total: number }[]>([]);
  const [honorLevels, setHonorLevels] = useState<Record<string, number>>({});
  const [pendingRewards, setPendingRewards] = useState<string[]>([]);
  const [showLog, setShowLog] = useState(false);

  const refresh = useCallback(() => {
    setProgress(getXpProgress());
    setBadges(getLevelBadges());
    setTodayLog(getTodayXpLog());
    setWeeklySummary(getWeeklyXpSummary());
    setHonorLevels(getHonorLevels());
    setPendingRewards(getPendingSpecialRewards());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleSpecialClaim = useCallback((rewardType: string) => {
    claimSpecialReward(rewardType);
    setPendingRewards(getPendingSpecialRewards());
    onSpecialRewardClaim?.(rewardType);
  }, [onSpecialRewardClaim]);

  if (!open) return null;

  const seasonRemMs = getSeasonRemainingMs();
  const todayTotalXp = todayLog.reduce((sum, e) => sum + e.amount, 0);
  const maxBarXp = weeklySummary.reduce((max, d) => Math.max(max, d.total), 1);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-6 py-5 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            aria-label={t('common:xp.close')}
          >
            <X size={16} />
          </button>

          {/* 레벨 + XP 바 */}
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-xl font-black">
              {progress.level}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold opacity-90">Lv.{progress.level}</div>
              <div className="text-xs opacity-70">{progress.seasonId}</div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-70">{t('common:xp.seasonRemaining')}</div>
              <div className="text-sm font-bold">{formatSeasonRemaining(seasonRemMs)}</div>
            </div>
          </div>

          {/* XP 프로그레스 바 */}
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
              🏆 {t('common:xp.maxLevel')}
            </div>
          )}

          {/* 오늘 XP */}
          <div className="mt-2 text-xs opacity-70">
            {t('common:xp.todayXp')}: <span className="font-bold text-yellow-200">+{todayTotalXp} XP</span>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

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
                    {t(`common:xp.specialReward.${r}` as any)}
                  </span>
                  <button
                    onClick={() => handleSpecialClaim(r)}
                    className="px-3 py-1 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 active:scale-95 transition-all"
                  >
                    {t('common:xp.claim')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 레벨 배지 */}
          <div>
            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1 mb-2">
              <Star size={14} className="text-purple-500" />
              {t('common:xp.levelBadges')}
            </h3>
            <div className="grid grid-cols-5 gap-2">
              {LEVEL_BADGES.map((b) => {
                const earned = badges.some(eb => eb.id === b.id);
                return (
                  <div
                    key={b.id}
                    className={`flex flex-col items-center gap-0.5 p-2 rounded-xl text-center transition-all
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
            <h3 className="text-sm font-bold text-gray-800 mb-2">{t('common:xp.weeklyGraph')}</h3>
            <div className="flex items-end gap-1 h-20">
              {weeklySummary.map((day, i) => {
                const pct = maxBarXp > 0 ? (day.total / maxBarXp) * 100 : 0;
                const isToday = i === weeklySummary.length - 1;
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] text-gray-400 tabular-nums">{day.total > 0 ? day.total : ''}</span>
                    <div className="w-full relative" style={{ height: '48px' }}>
                      <div
                        className={`absolute bottom-0 w-full rounded-t transition-all duration-300 ${isToday ? 'bg-purple-500' : 'bg-purple-200'}`}
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
                  <p className="text-xs text-gray-400">{t('common:xp.noLogToday')}</p>
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
