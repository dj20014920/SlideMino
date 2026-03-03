/**
 * 미션 모달 — 일일/주간 미션 목록 + 보상 수령 + 다시굴리기
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RefreshCw, Check, Gift, Clock, Star } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { SHAPES } from '../constants';
import { ShapeType } from '../types';
import {
  getDailyMissions,
  getWeeklyMissions,
  getMissionDefinition,
  claimMissionReward,
  claimDailyBonus,
  canClaimDailyBonus,
  canRerollDailyMission,
  canRerollWeeklyMission,
  rerollDailyMission,
  rerollWeeklyMission,
  getDailyTimeRemainingMs,
  getWeeklyTimeRemainingMs,
  getReward,
  type ActiveMission,
  type MissionDifficulty,
} from '../services/missionService';

interface MissionModalProps {
  open: boolean;
  onClose: () => void;
  onRewardClaimed?: (fragments: number) => void;
}

/** 남은 시간을 "HH:MM:SS" 형식으로 변환 */
function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 난이도 라벨 & 색상 */
function getDifficultyInfo(d: MissionDifficulty): { label: string; color: string; bg: string } {
  switch (d) {
    case 'easy': return { label: '⭐', color: 'text-green-600', bg: 'bg-green-50' };
    case 'medium': return { label: '⭐⭐', color: 'text-amber-600', bg: 'bg-amber-50' };
    case 'hard': return { label: '⭐⭐⭐', color: 'text-red-600', bg: 'bg-red-50' };
  }
}

/** 보상 조각 수 — 서비스의 단일 소스 사용 */
function getRewardAmount(d: MissionDifficulty, isDaily: boolean): number {
  return getReward(d, isDaily);
}

function toShapeType(value?: string): ShapeType | null {
  if (!value) return null;
  switch (value) {
    case ShapeType.I:
    case ShapeType.O:
    case ShapeType.T:
    case ShapeType.S:
    case ShapeType.Z:
    case ShapeType.J:
    case ShapeType.L:
    case ShapeType.PLUS:
      return value;
    default:
      return null;
  }
}

const BlockShapeBadge: React.FC<{ type: ShapeType }> = ({ type }) => {
  const cells = SHAPES[type];
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxY = Math.max(...cells.map((c) => c.y));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;
  const normalized = cells.map((c) => ({ x: c.x - minX, y: c.y - minY }));
  const cellSize = 4;
  const viewSize = 18;
  const shapeWidth = width * cellSize;
  const shapeHeight = height * cellSize;
  const offsetX = (viewSize - shapeWidth) / 2;
  const offsetY = (viewSize - shapeHeight) / 2;

  return (
    <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5">
      <svg
        width={viewSize}
        height={viewSize}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        aria-hidden="true"
      >
        {normalized.map((cell, idx) => (
          <rect
            key={idx}
            x={offsetX + cell.x * cellSize}
            y={offsetY + cell.y * cellSize}
            width={cellSize - 0.5}
            height={cellSize - 0.5}
            rx="0.6"
            className="fill-slate-600"
          />
        ))}
      </svg>
    </span>
  );
};

const MissionRow: React.FC<{
  mission: ActiveMission;
  isDaily: boolean;
  onClaim: (id: string) => void;
  onReroll?: (index: number) => void;
  index: number;
  canReroll: boolean;
}> = ({ mission, isDaily, onClaim, onReroll, index, canReroll }) => {
  const { t } = useTranslation();
  const def = getMissionDefinition(mission.definitionId);
  if (!def) return null;

  const diffInfo = getDifficultyInfo(def.difficulty);
  const reward = getRewardAmount(def.difficulty, isDaily);
  const progress = Math.min(mission.progress, def.target);
  const pct = Math.min(100, Math.round((progress / def.target) * 100));
  const blockShapeType = def.type === 'BLOCK_TYPE_COUNT' ? toShapeType(def.param) : null;

  return (
    <div className={`rounded-2xl p-3.5 ${mission.completed ? 'bg-emerald-50 border border-emerald-200' : 'bg-gray-50 border border-gray-100'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs">{diffInfo.label}</span>
            {blockShapeType && <BlockShapeBadge type={blockShapeType} />}
            <span className="text-sm font-semibold text-gray-800 truncate">
              {t(def.nameKey as any)}
            </span>
          </div>
          {/* 프로그레스 바 */}
          {!mission.completed && (
            <div className="mt-1.5">
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {progress} / {def.target}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* 보상 표시 */}
          <span className="text-xs font-semibold text-amber-600">+{reward}💎</span>

          {mission.completed && !mission.claimed && (
            <button
              onClick={() => onClaim(mission.definitionId)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold shadow-sm hover:bg-emerald-600 active:scale-95 transition-all"
            >
              <Gift size={12} className="inline mr-0.5" />
              {t('game:missions.claim')}
            </button>
          )}

          {mission.completed && mission.claimed && (
            <span className="text-emerald-500">
              <Check size={18} strokeWidth={3} />
            </span>
          )}

          {/* 다시굴리기 버튼 (미완료 + 해당 슬롯 미사용) */}
          {!mission.completed && canReroll && onReroll && (
            <button
              onClick={() => onReroll(index)}
              className="p-1.5 rounded-lg hover:bg-gray-200/60 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={t('game:missions.reroll')}
              title={t('game:missions.reroll')}
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const MissionModal: React.FC<MissionModalProps> = ({ open, onClose, onRewardClaimed }) => {
  const { t } = useTranslation();
  useBodyScrollLock(open);
  const [dailyMissions, setDailyMissions] = useState<ActiveMission[]>([]);
  const [weeklyMissions, setWeeklyMissions] = useState<ActiveMission[]>([]);
  const [dailyRerollAvailableSlots, setDailyRerollAvailableSlots] = useState<boolean[]>([]);
  const [weeklyRerollAvailableSlots, setWeeklyRerollAvailableSlots] = useState<boolean[]>([]);
  const [dailyTimeLeft, setDailyTimeLeft] = useState('');
  const [weeklyTimeLeft, setWeeklyTimeLeft] = useState('');
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');

  // 데이터 새로고침
  const refresh = useCallback(() => {
    const nextDailyMissions = getDailyMissions();
    const nextWeeklyMissions = getWeeklyMissions();
    setDailyMissions(nextDailyMissions);
    setWeeklyMissions(nextWeeklyMissions);
    setDailyRerollAvailableSlots(
      nextDailyMissions.map((_, index) => canRerollDailyMission(index))
    );
    setWeeklyRerollAvailableSlots(
      nextWeeklyMissions.map((_, index) => canRerollWeeklyMission(index))
    );
    setDailyTimeLeft(formatTimeRemaining(getDailyTimeRemainingMs()));
    setWeeklyTimeLeft(formatTimeRemaining(getWeeklyTimeRemainingMs()));
  }, []);

  // 모달 열릴 때 데이터 신선하게
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  // 타이머 업데이트
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      setDailyTimeLeft(formatTimeRemaining(getDailyTimeRemainingMs()));
      setWeeklyTimeLeft(formatTimeRemaining(getWeeklyTimeRemainingMs()));
    }, 1000);
    return () => clearInterval(id);
  }, [open]);

  const handleClaim = useCallback((definitionId: string) => {
    const isDaily = tab === 'daily';
    const reward = claimMissionReward(definitionId, isDaily);
    if (reward > 0) {
      onRewardClaimed?.(reward);
      refresh();
    }
  }, [tab, onRewardClaimed, refresh]);

  const handleDailyBonus = useCallback(() => {
    const reward = claimDailyBonus();
    if (reward > 0) {
      onRewardClaimed?.(reward);
      refresh();
    }
  }, [onRewardClaimed, refresh]);

  const handleDailyReroll = useCallback((index: number) => {
    rerollDailyMission(index);
    refresh();
  }, [refresh]);

  const handleWeeklyReroll = useCallback((index: number) => {
    rerollWeeklyMission(index);
    refresh();
  }, [refresh]);

  if (!open) return null;

  const dailyCompleted = dailyMissions.filter(m => m.completed).length;
  const weeklyCompleted = weeklyMissions.filter(m => m.completed).length;
  const bonusAvailable = canClaimDailyBonus();
  const dailyRerollAvailable = dailyRerollAvailableSlots.some(Boolean);
  const weeklyRerollAvailable = weeklyRerollAvailableSlots.some(Boolean);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] modal-safe-panel flex flex-col">
        {/* 헤더 */}
        <div className="p-5 pb-3 flex justify-between items-center bg-gradient-to-r from-violet-50 to-blue-50 border-b border-violet-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <Star className="text-violet-500" size={22} />
            {t('game:missions.title')}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500">
            <X size={18} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('daily')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'daily'
                ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/50'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {t('game:missions.daily')} ({dailyCompleted}/3)
          </button>
          <button
            onClick={() => setTab('weekly')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'weekly'
                ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            {t('game:missions.weekly')} ({weeklyCompleted}/3)
          </button>
        </div>

        {/* 미션 목록 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {/* 남은 시간 */}
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
            <Clock size={12} />
            <span>
              {tab === 'daily'
                ? t('game:missions.dailyReset' as any, { time: dailyTimeLeft })
                : t('game:missions.weeklyReset' as any, { time: weeklyTimeLeft })
              }
            </span>
          </div>

          {tab === 'daily' ? (
            <>
              {dailyMissions.map((mission, idx) => (
                <MissionRow
                  key={`daily-${idx}`}
                  mission={mission}
                  isDaily={true}
                  onClaim={handleClaim}
                  onReroll={handleDailyReroll}
                  index={idx}
                  canReroll={dailyRerollAvailableSlots[idx] ?? false}
                />
              ))}

              {/* 전체 완료 보너스 */}
              {dailyCompleted === 3 && (
                <div className="mt-3 rounded-2xl p-4 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 text-center">
                  <div className="text-sm font-bold text-amber-700 mb-2">
                    🎉 {t('game:missions.allComplete')}
                  </div>
                  {bonusAvailable ? (
                    <button
                      onClick={handleDailyBonus}
                      className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition-all"
                    >
                      +3💎 {t('game:missions.claimBonus')}
                    </button>
                  ) : (
                    <span className="text-xs text-amber-600">{t('game:missions.bonusClaimed')}</span>
                  )}
                </div>
              )}
            </>
          ) : (
            weeklyMissions.map((mission, idx) => (
              <MissionRow
                key={`weekly-${idx}`}
                mission={mission}
                isDaily={false}
                onClaim={handleClaim}
                onReroll={handleWeeklyReroll}
                index={idx}
                canReroll={weeklyRerollAvailableSlots[idx] ?? false}
              />
            ))
          )}
        </div>

        {/* 다시굴리기 안내 */}
        {tab === 'daily' && dailyRerollAvailable && (
          <div className="px-4 pb-3 pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {t('game:missions.rerollHint')}
            </p>
          </div>
        )}
        {tab === 'weekly' && weeklyRerollAvailable && (
          <div className="px-4 pb-3 pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center">
              {t('game:missions.weeklyRerollHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
