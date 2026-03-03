/**
 * 출석 정보 + 배지 컬렉션 모달
 * - 현재 스트릭, 프리즈, 배지 표시
 * - 자동 프리즈 ON/OFF 토글
 * - 프리즈 도움말
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, HelpCircle, Flame } from 'lucide-react';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import {
  loadStreakData,
  setAutoFreeze,
  BADGE_MILESTONES,
  type StreakData,
} from '../services/streakService';

interface StreakInfoModalProps {
  open: boolean;
  onClose: () => void;
}

export const StreakInfoModal: React.FC<StreakInfoModalProps> = ({ open, onClose }) => {
  const { t } = useTranslation('common');
  const [data, setData] = useState<StreakData>(() => loadStreakData());
  const [showFreezeHelp, setShowFreezeHelp] = useState(false);
  const { isWin98ThemeActive } = useBlockCustomization();
  const isWin98 = Boolean(isWin98ThemeActive);

  if (!open) return null;

  const handleAutoFreezeToggle = () => {
    const newVal = !data.autoFreezeEnabled;
    setAutoFreeze(newVal);
    setData(prev => ({ ...prev, autoFreezeEnabled: newVal }));
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay">
      <div className={isWin98 ? 'absolute inset-0 win98-modal-overlay' : 'absolute inset-0 bg-black/40 backdrop-blur-sm'} onClick={onClose} />
      <div className={isWin98
        ? 'window relative w-full max-w-sm max-h-[80vh] modal-safe-panel overflow-hidden flex flex-col'
        : 'relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] modal-safe-panel flex flex-col'}>
        {/* Win98 타이틀 바 / 일반 헤더 */}
        {isWin98 ? (
          <div className="title-bar">
            <div className="title-bar-text"><span style={{color:'#ea580c',fontWeight:'bold'}}>▣</span>{' '}{t('common:streak.title')}</div>
            <div className="title-bar-controls">
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>
        ) : (
          <div className="p-5 pb-3 flex justify-between items-center bg-orange-50 border-b border-orange-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Flame className="text-orange-500" size={22} />
              {t('common:streak.title')}
            </h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500">
              <X size={18} />
            </button>
          </div>
        )}

        <div className={isWin98 ? 'window-body flex-1 overflow-y-auto p-3 space-y-3' : 'flex-1 overflow-y-auto p-5 space-y-4'}>
          {/* 스트릭 카운터 */}
          <div className={isWin98 ? 'text-center win98-sunken p-4' : 'text-center bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5'}>
            <div className={isWin98 ? 'text-4xl font-bold' : 'text-5xl font-black text-orange-500'}>{data.currentStreak}</div>
            <div className="text-sm text-gray-600 mt-1">
              {String(t('common:streak.days', { count: data.currentStreak } as any))}
            </div>
            <div className="text-xs text-gray-400 mt-2">
              {t('common:streak.totalDays')}: {data.totalAttendanceDays}
            </div>
          </div>

          {/* 프리즈 */}
          <div className={isWin98 ? 'win98-sunken p-3' : 'bg-blue-50 rounded-2xl p-4'}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">{t('common:streak.freezeCount')}</span>
                <button
                  onClick={() => setShowFreezeHelp(!showFreezeHelp)}
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Freeze help"
                >
                  <HelpCircle size={16} />
                </button>
              </div>
              <span className="text-lg font-bold text-blue-600">
                {data.freezeCount}/{3}
              </span>
            </div>

            {showFreezeHelp && (
              <p className={isWin98 ? 'text-xs mt-2 p-2 win98-sunken' : 'text-xs text-gray-500 mt-2 bg-white rounded-lg p-2'}>
                {t('common:streak.freezeHelp')}
              </p>
            )}

            {/* 자동 프리즈 토글 */}
            <div className={isWin98 ? 'flex items-center justify-between mt-2 pt-2 border-t border-gray-400' : 'flex items-center justify-between mt-3 pt-3 border-t border-blue-100'}>
              <span className={isWin98 ? 'text-sm' : 'text-sm text-gray-600'}>{t('common:streak.autoFreeze')}</span>
              {isWin98 ? (
                <input
                  type="checkbox"
                  checked={data.autoFreezeEnabled}
                  onChange={handleAutoFreezeToggle}
                  aria-label={t('common:streak.autoFreeze')}
                />
              ) : (
                <button
                  onClick={handleAutoFreezeToggle}
                  className={`relative inline-flex h-6 w-12 shrink-0 items-center rounded-full transition-colors ${data.autoFreezeEnabled ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  role="switch"
                  aria-checked={data.autoFreezeEnabled}
                  aria-label={t('common:streak.autoFreeze')}
                >
                  <span
                    className={`pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${data.autoFreezeEnabled ? 'translate-x-6' : 'translate-x-0'
                      }`}
                  />
                </button>
              )}
            </div>
          </div>

          {/* 출석 조건 안내 */}
          <div className="text-xs text-center text-gray-400">
            {t('common:streak.condition')}
          </div>

          {/* 배지 컬렉션 */}
          <div>
            <h3 className={isWin98 ? 'text-sm font-bold mb-2' : 'text-sm font-bold text-gray-700 mb-3'}>{t('common:streak.badgeCollection')}</h3>
            <div className="space-y-2">
              {BADGE_MILESTONES.map(milestone => {
                const earned = data.badges.includes(milestone.id);
                return (
                  <div
                    key={milestone.id}
                    className={isWin98
                      ? `win98-list-item flex items-center justify-between px-3 py-2 ${earned ? '' : 'opacity-60'}`
                      : `flex items-center justify-between rounded-xl px-4 py-3 ${earned ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50 border border-gray-100'}`
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span className={isWin98 ? `text-base ${earned ? '' : 'opacity-30'}` : `text-xl ${earned ? '' : 'opacity-30 grayscale'}`}>
                        {isWin98 ? <span style={{color: earned ? '#f59e0b' : '#9ca3af',fontWeight:'bold'}}>◆</span> : milestone.emoji}
                      </span>
                      <div>
                        <span className={`text-sm font-semibold ${earned ? 'text-gray-800' : 'text-gray-400'}`}>
                          {t(milestone.nameKey as any)}
                        </span>
                        <span className="text-xs text-gray-400 ml-2">
                          {milestone.days}일
                        </span>
                      </div>
                    </div>
                    <span className={isWin98
                      ? `text-xs font-medium ${earned ? '' : ''}`
                      : `text-xs font-medium ${earned ? 'text-emerald-600' : 'text-gray-300'}`}>
                      {earned ? (isWin98 ? '[✓]' : '✓') : `+${milestone.fragments}`}
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
