/**
 * 캘린더 모달 — 이번 주 일정 한눈에 보기
 * 접기/펼치기 가능한 카드 형태
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, X, ChevronDown, ChevronUp, Clock, CheckCircle2 } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  getCalendarItems,
  formatTimeRemaining,
  type CalendarItem,
} from '../services/calendarService';

interface CalendarModalProps {
  open: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

/** 항목 타입별 아이콘 */
function getItemIcon(type: CalendarItem['type']): string {
  switch (type) {
    case 'daily_challenge': return '🏆';
    case 'weekly_event':    return '🎯';
    case 'season_end':      return '⏰';
    case 'attendance':      return '🔥';
    case 'daily_mission':   return '📋';
    case 'weekly_mission':  return '📅';
    default: return '📌';
  }
}

export const CalendarModal: React.FC<CalendarModalProps> = ({ open, onClose, onAction }) => {
  const { t } = useTranslation();
  useBodyScrollLock(open);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [timeNow, setTimeNow] = useState(Date.now());

  const refresh = useCallback(() => {
    setItems(getCalendarItems());
    setTimeNow(Date.now());
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
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

        {/* 항목 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {t('common:calendar.noItems')}
            </p>
          ) : (
            items.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (item.action) {
                    onAction?.(item.action);
                    onClose();
                  }
                }}
                className={`
                  w-full text-left rounded-2xl p-3.5 transition-all duration-200
                  ${item.isUrgent
                    ? 'bg-red-50 border-2 border-red-300 shadow-sm'
                    : item.isCompleted
                      ? 'bg-emerald-50 border border-emerald-200'
                      : 'bg-gray-50 border border-gray-100 hover:bg-gray-100'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{getItemIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-800 truncate">
                        {t(item.titleKey as any)}
                      </span>
                      {item.isUrgent && (
                        <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold">
                          {t('common:calendar.urgent')}
                        </span>
                      )}
                      {item.isCompleted && (
                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      )}
                    </div>
                    {item.descKey && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">
                        {t(item.descKey as any)}
                      </p>
                    )}
                  </div>
                  {item.endsAt && !item.isCompleted && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock size={11} className={item.isUrgent ? 'text-red-500' : 'text-gray-400'} />
                      <span className={`text-xs font-semibold tabular-nums ${item.isUrgent ? 'text-red-600' : 'text-gray-500'}`}>
                        {formatTimeRemaining(item.endsAt)}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))
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
    <div className="w-full rounded-2xl bg-white/60 backdrop-blur-sm border border-white/50 shadow-sm overflow-hidden">
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
            <span className="text-sm">{getItemIcon(item.type)}</span>
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
