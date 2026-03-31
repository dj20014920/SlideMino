/**
 * 소식 모달 — 이번 주 핵심 정보를 압축 표시
 * 접기/펼치기 가능한 카드 형태
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, X, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import {
  getCalendarItems,
  formatTimeRemaining,
  type CalendarItem,
} from '../services/calendarService';
import {
  getDailyMissions,
  getWeeklyMissions,
  getMissionDefinition,
  getDailyCompletedCount,
  getWeeklyCompletedCount,
  type ActiveMission,
} from '../services/missionService';
import { getCurrentEvent } from '../services/weeklyEventService';

interface CalendarModalProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

/** 항목 타입별 아이콘 */
function getItemIcon(type: CalendarItem['type'], isPremiumUi = false): string {
  if (isPremiumUi) {
    switch (type) {
      case 'daily_challenge': return '◆';
      case 'weekly_event': return '◇';
      case 'season_end': return '◷';
      case 'attendance': return '■';
      case 'daily_mission': return '☐';
      case 'weekly_mission': return '☐';
      default: return '●';
    }
  }
  switch (type) {
    case 'daily_challenge': return '🏆';
    case 'weekly_event': return '🎯';
    case 'season_end': return '⏰';
    case 'attendance': return '🔥';
    case 'daily_mission': return '📋';
    case 'weekly_mission': return '📅';
    default: return '📌';
  }
}

export const CalendarModal: React.FC<CalendarModalProps> = ({ open, onClose, onAction }) => {
  const { t } = useTranslation();
  useBodyScrollLock(open);
  const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
  const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
  const premiumUiWindowClassName = premiumUiObjects.windowClassName;
  const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
  const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
  const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
  const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
  const premiumUiSunkenClassName = premiumUiObjects.panels.sunkenClassName;
  const premiumUiSunkenWhiteClassName = premiumUiObjects.panels.sunkenWhiteClassName;
  const premiumUiBadgeClassName = premiumUiObjects.panels.badgeClassName;
  const isPremiumUi = Boolean(isPremiumUiThemeActive);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [dailyMissions, setDailyMissions] = useState<ActiveMission[]>([]);
  const [weeklyMissions, setWeeklyMissions] = useState<ActiveMission[]>([]);
  const [dailyCompleted, setDailyCompleted] = useState(0);
  const [weeklyCompleted, setWeeklyCompleted] = useState(0);
  const [eventInfo, setEventInfo] = useState(() => getCurrentEvent());

  const refresh = useCallback(() => {
    setItems(getCalendarItems());
    setDailyMissions(getDailyMissions());
    setWeeklyMissions(getWeeklyMissions());
    setDailyCompleted(getDailyCompletedCount());
    setWeeklyCompleted(getWeeklyCompletedCount());
    setEventInfo(getCurrentEvent());
  }, []);

  useEffect(() => {
    if (open) {
      refresh();
      // 1분마다 갱신
      const timer = setInterval(refresh, 60000);
      return () => clearInterval(timer);
    }
  }, [open, refresh]);

  if (!open) return null;

  const attendanceItem = items.find((item) => item.type === 'attendance');
  const seasonEndItem = items.find((item) => item.type === 'season_end');
  const dailyMissionItem = items.find((item) => item.type === 'daily_mission');
  const weeklyMissionItem = items.find((item) => item.type === 'weekly_mission');

  const eventRuleTags: string[] = [
    `${eventInfo.rule.boardSize}×${eventInfo.rule.boardSize}`,
    `⏱ ${Math.floor(eventInfo.rule.timeLimitSeconds / 60)}${t('game:weeklyEvent.tags.minutes')}`,
  ];
  if (eventInfo.rule.disableRotation) {
    eventRuleTags.push(t('game:weeklyEvent.tags.noRotation'));
  }
  if (eventInfo.rule.scoreMultiplier > 1) {
    eventRuleTags.push(`×${eventInfo.rule.scoreMultiplier} ${t('game:weeklyEvent.tags.scoreBoost')}`);
  }
  if (eventInfo.rule.tripleKillBonus > 0) {
    eventRuleTags.push(`+${eventInfo.rule.tripleKillBonus}pt ${t('game:weeklyEvent.tags.tripleKill')}`);
  }

  const dailyMissionRows = dailyMissions
    .map((mission) => {
      const def = getMissionDefinition(mission.definitionId);
      if (!def) return null;
      return {
        id: mission.definitionId,
        nameKey: def.nameKey,
        progress: Math.min(mission.progress, def.target),
        target: def.target,
        completed: mission.completed,
      };
    })
    .filter((row): row is {
      id: string;
      nameKey: string;
      progress: number;
      target: number;
      completed: boolean;
    } => Boolean(row));

  const weeklyMissionRows = weeklyMissions
    .map((mission) => {
      const def = getMissionDefinition(mission.definitionId);
      if (!def) return null;
      return {
        id: mission.definitionId,
        nameKey: def.nameKey,
        progress: Math.min(mission.progress, def.target),
        target: def.target,
        completed: mission.completed,
      };
    })
    .filter((row): row is {
      id: string;
      nameKey: string;
      progress: number;
      target: number;
      completed: boolean;
    } => Boolean(row));

  return (
    <div className={`fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay ${isPremiumUi ? premiumUiModalOverlayClassName : 'bg-black/50 backdrop-blur-sm'}`} onClick={onClose}>
      <div
        className={isPremiumUi
          ? `${premiumUiWindowClassName} w-full max-w-md max-h-[80vh] modal-safe-panel overflow-hidden flex flex-col`
          : 'bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] modal-safe-panel overflow-hidden flex flex-col'
        }
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        {isPremiumUi ? (
          <div className={premiumUiTitleBarClassName}>
            <div className={premiumUiTitleBarTextClassName}><span className="font-bold">★</span>{' '}{t('common:calendar.title')}</div>
            <div className={premiumUiTitleBarControlsClassName}>
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-500" />
              <h2 className="text-base font-bold text-gray-800">{t('common:calendar.title')}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="close"
            >
              <X size={16} className="text-gray-400" />
            </button>
          </div>
        )}

        {/* 항목 목록 */}
        <div className={isPremiumUi ? `${premiumUiWindowBodyClassName} flex-1 overflow-y-auto px-2 py-2 space-y-2 modal-scroll-panel` : 'flex-1 overflow-y-auto px-4 py-3 space-y-2.5 modal-scroll-panel'}>
          <div className="grid grid-cols-2 gap-2">
            <div className={isPremiumUi ? `${premiumUiSunkenClassName} px-2 py-1.5` : 'rounded-xl border border-emerald-100 bg-emerald-50 px-2.5 py-2'}>
              <div className={`text-[10px] font-semibold ${isPremiumUi ? '' : 'text-emerald-700'}`}>
                {t('common:calendar.attendance')}
              </div>
              <div className={`mt-0.5 text-[11px] ${isPremiumUi ? '' : 'text-emerald-800'} truncate`}>
                {attendanceItem?.isCompleted
                  ? t('common:calendar.attendanceComplete')
                  : t('common:calendar.attendanceIncomplete')}
              </div>
            </div>
            <div className={isPremiumUi ? `${premiumUiSunkenClassName} px-2 py-1.5` : 'rounded-xl border border-blue-100 bg-blue-50 px-2.5 py-2'}>
              <div className={`text-[10px] font-semibold ${isPremiumUi ? '' : 'text-blue-700'}`}>
                {t('common:calendar.seasonEnd')}
              </div>
              <div className={`mt-0.5 text-[11px] ${isPremiumUi ? '' : 'text-blue-800'} tabular-nums`}>
                {seasonEndItem?.endsAt ? formatTimeRemaining(seasonEndItem.endsAt) : '-'}
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onAction?.('mission');
              onClose();
            }}
            className={isPremiumUi
              ? `w-full text-left ${premiumUiSunkenWhiteClassName} px-2 py-2 mb-0.5`
              : 'w-full text-left rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 transition-colors hover:bg-gray-100'
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{isPremiumUi ? <span className="font-bold">&#9632;</span> : '📋'}</span>
                <span className="text-xs font-bold text-gray-800">{t('common:calendar.dailyMission')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-blue-600 tabular-nums">{dailyCompleted}/3</span>
                {dailyMissionItem?.isCompleted && <CheckCircle2 size={13} className="text-emerald-500" />}
              </div>
            </div>
            <div className="mt-1.5 space-y-1">
              {dailyMissionRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-600 truncate">{t(row.nameKey as any)}</span>
                  <span className={`text-[10px] tabular-nums ${row.completed ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                    {row.progress}/{row.target}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-gray-400 tabular-nums">
              {dailyMissionItem?.endsAt ? formatTimeRemaining(dailyMissionItem.endsAt) : ''}
            </div>
          </button>

          <button
            onClick={() => {
              onAction?.('weekly_event');
              onClose();
            }}
            className={isPremiumUi
              ? `w-full text-left ${premiumUiSunkenWhiteClassName} px-2 py-2 mb-0.5`
              : 'w-full text-left rounded-2xl border border-violet-100 bg-violet-50 px-3 py-2.5 transition-colors hover:bg-violet-100/80'
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-sm">{isPremiumUi ? <span className="font-bold">&#9670;</span> : '🎯'}</span>
                <span className="text-xs font-bold text-gray-800 truncate">{t('common:calendar.weeklyEvent')}</span>
              </div>
              <span className="text-[10px] font-semibold text-violet-600 tabular-nums">
                {formatTimeRemaining(eventInfo.endsAt)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-violet-700 truncate">
              {t(`game:weeklyEvent.events.${eventInfo.eventType}.name` as any)}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {eventRuleTags.slice(0, 4).map((tag) => (
                <span key={tag} className={isPremiumUi ? `${premiumUiBadgeClassName} text-[10px]` : 'rounded-full bg-white/70 border border-violet-200 px-1.5 py-0.5 text-[10px] text-violet-700'}>
                  {tag}
                </span>
              ))}
            </div>
          </button>

          <button
            onClick={() => {
              onAction?.('mission');
              onClose();
            }}
            className={isPremiumUi
              ? `w-full text-left ${premiumUiSunkenWhiteClassName} px-2 py-2 mb-0.5`
              : 'w-full text-left rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2.5 transition-colors hover:bg-gray-100'
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{isPremiumUi ? <span className="font-bold">&#9632;</span> : '📅'}</span>
                <span className="text-xs font-bold text-gray-800">{t('common:calendar.weeklyMission')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-blue-600 tabular-nums">{weeklyCompleted}/3</span>
                {weeklyMissionItem?.isCompleted && <CheckCircle2 size={13} className="text-emerald-500" />}
              </div>
            </div>
            <div className="mt-1.5 space-y-1">
              {weeklyMissionRows.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-gray-600 truncate">{t(row.nameKey as any)}</span>
                  <span className={`text-[10px] tabular-nums ${row.completed ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>
                    {row.progress}/{row.target}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-1 text-[10px] text-gray-400 tabular-nums">
              {weeklyMissionItem?.endsAt ? formatTimeRemaining(weeklyMissionItem.endsAt) : ''}
            </div>
          </button>
          {items.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-8">
              {t('common:calendar.noItems')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ====== 메뉴용 인라인 캘린더 카드 ======

interface CalendarCardProps {
  onAction?: (action: string) => void;
  onExpand?: () => void;
}

/**
 * 메인 메뉴에 삽입할 축약형 캘린더 카드.
 * 기본 2줄만 표시, 탭하면 전체 캘린더 모달 오픈.
 */
export const CalendarCard: React.FC<CalendarCardProps> = ({ onAction, onExpand }) => {
  const { t } = useTranslation();
  const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
  const premiumUiSunkenClassName = premiumUiObjects.panels.sunkenClassName;
  const isPremiumUi = Boolean(isPremiumUiThemeActive);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setItems(getCalendarItems());
    // 1분마다 갱신
    const timer = setInterval(() => setItems(getCalendarItems()), 60000);
    return () => clearInterval(timer);
  }, []);

  const visibleItems = expanded ? items : items.slice(0, 2);

  if (items.length === 0) return null;

  return (
    <div className={isPremiumUi ? `w-full ${premiumUiSunkenClassName} overflow-hidden` : 'w-full rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-sm overflow-hidden'}>
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-gray-700">{t('common:calendar.title')}</span>
        </div>
        <button
          onClick={() => onExpand ? onExpand() : setExpanded(!expanded)}
          className="p-1 rounded hover:bg-gray-200/50 transition-colors"
        >
          {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
        </button>
      </div>
      <div className="px-3 pb-2.5 space-y-1.5">
        {visibleItems.map((item, idx) => (
          <button
            key={idx}
            onClick={() => {
              if (item.action) onAction?.(item.action);
            }}
            className={`
              w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors
              ${item.isUrgent ? 'bg-red-50' : item.isCompleted ? 'bg-emerald-50' : 'hover:bg-gray-100'}
            `}
          >
            <span className="text-sm">{getItemIcon(item.type, isPremiumUi)}</span>
            <span className="flex-1 text-xs text-gray-700 truncate">
              {t(item.titleKey as any)}
            </span>
            {item.isCompleted && <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />}
            {item.endsAt && !item.isCompleted && (
              <span className={`text-[10px] tabular-nums shrink-0 ${item.isUrgent ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                {formatTimeRemaining(item.endsAt)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
