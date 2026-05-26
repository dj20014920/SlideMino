import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, ChevronRight, ChevronLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { rankingService, RankEntry, LiveRankEstimate, LeaderboardTab } from '../services/rankingService';
import { GameState, BoardSize } from '../types';
import { getLevelBadgeById } from '../services/xpLevelService';
import { useBlockCustomization } from '../context/BlockCustomizationContext';

interface RealTimeRankingPanelProps {
  boardSize: BoardSize;
  score: number;
  gameState: GameState;
  liveRankEstimate: LiveRankEstimate | null;
  playerName: string;
  isOpen: boolean;
  onToggle: () => void;
}

const RANKING_POLL_INTERVAL_MS = 5000;

const DIFFICULTY_TAB_MAP: Record<BoardSize, LeaderboardTab> = {
  4: '4x4',
  5: '5x5',
  7: '7x7',
  8: '8x8',
  10: '10x10',
};

const MEDAL_EMOJIS = ['🥇', '🥈', '🥉'];

function getMedalEmoji(index: number): string {
  return index < 3 ? MEDAL_EMOJIS[index] : `${index + 1}.`;
}

export const RealTimeRankingPanel: React.FC<RealTimeRankingPanelProps> = ({
  boardSize,
  score,
  gameState,
  liveRankEstimate,
  playerName,
  isOpen,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const isPlaying = gameState === GameState.PLAYING;

  const fetchRankings = useCallback(async () => {
    try {
      setIsLoading(true);
      const tab = DIFFICULTY_TAB_MAP[boardSize] ?? 'ALL';
      const result = await rankingService.getLeaderboard(tab);
      if (result.offline) {
        setError(true);
        return;
      }
      setRankings(result.data.slice(0, 7));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, [boardSize]);

  useEffect(() => {
    if (!isOpen || !isPlaying) {
      return;
    }
    fetchRankings();
    intervalRef.current = window.setInterval(fetchRankings, RANKING_POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, isPlaying, fetchRankings]);

  const premiumWindowClass = isPremiumUiThemeActive
    ? premiumUiObjects.windowClassName ?? 'border border-gray-700/40 bg-gray-800/80 backdrop-blur-sm rounded-lg'
    : '';

  const premiumBtnClass = isPremiumUiThemeActive
    ? premiumUiObjects.buttons?.iconClassName ?? ''
    : '';

  return (
    <div className="fixed right-0 top-0 bottom-0 z-[100] flex items-stretch pointer-events-none">
      {/* 패널 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: 220 }}
            animate={{ x: 0 }}
            exit={{ x: 220 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className={`
              w-[220px] overflow-y-auto flex flex-col pointer-events-auto
              bg-white/95 backdrop-blur-md border-l border-gray-200
              shadow-xl
              ${premiumWindowClass}
            `}
            style={{
              paddingTop: 'calc(var(--game-safe-top, env(safe-area-inset-top)) + 16px)',
              paddingBottom: 'calc(var(--game-safe-bottom, 0px) + 16px)',
            }}
          >
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 sticky top-0 bg-white/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2">
                <Trophy size={18} className="text-amber-500" />
                <h3 className="text-sm font-bold text-gray-900">
                  {t('modals:leaderboard.title')}
                </h3>
              </div>
              <div className="text-[10px] text-gray-400">
                TOP 7
              </div>
            </div>

            {/* 내 순위 */}
            {isPlaying && liveRankEstimate && score > 0 && (
              <div className="px-4 py-3 border-b border-gray-100 bg-amber-50/80">
                <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">
                  내 예상 순위
                </p>
                <p className="text-lg font-bold text-amber-700">
                  {liveRankEstimate.totalEntries < 2 ? 'N/A' : `#${liveRankEstimate.rank}`}
                </p>
                {liveRankEstimate.totalEntries >= 2 && liveRankEstimate.pointsToNext > 0 && (
                  <p className="text-[10px] text-amber-500 mt-0.5">
                    다음 순위까지 {liveRankEstimate.pointsToNext}점
                  </p>
                )}
                {playerName && (
                  <p className="text-[10px] text-amber-600 mt-0.5 truncate">
                    {playerName}
                  </p>
                )}
              </div>
            )}

            {/* 랭킹 리스트 */}
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {isLoading && rankings.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-amber-300 border-t-amber-500 rounded-full animate-spin" />
                </div>
              ) : error && rankings.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">
                  랭킹을 불러올 수 없습니다
                </p>
              ) : rankings.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-4">
                  아직 랭킹이 없습니다
                </p>
              ) : (
                <ul className="space-y-1">
                  {rankings.map((entry, index) => {
                    const isMe = playerName && entry.name === playerName;
                    const badge = entry.levelBadge ? getLevelBadgeById(entry.levelBadge) : null;
                    return (
                      <li
                        key={`${entry.name}-${index}`}
                        className={`
                          flex items-center gap-2 px-2 py-1.5 rounded-lg
                          text-[11px] transition-colors
                          ${isMe ? 'bg-amber-100/70 ring-1 ring-amber-300' : 'hover:bg-gray-50'}
                          ${index === 0 ? 'bg-yellow-50/60' : ''}
                          ${index === 1 ? 'bg-gray-50/60' : ''}
                          ${index === 2 ? 'bg-orange-50/60' : ''}
                        `}
                      >
                        <span className="w-5 text-center shrink-0 font-medium text-gray-500">
                          {getMedalEmoji(index)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 truncate flex items-center gap-1">
                            {entry.name}
                            {badge && <span className="text-[10px]">{badge.emoji}</span>}
                          </p>
                        </div>
                        <span className="font-bold text-gray-600 tabular-nums shrink-0">
                          {entry.score.toLocaleString()}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 토글 핸들 — 우측 전체 높이 얇은 바 */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? t('common:aria.close') : '랭킹 보기'}
        title={isOpen ? '랭킹 닫기' : '실시간 랭킹 보기'}
        className={`
          w-[14px] pointer-events-auto flex items-center justify-center
          border-l border-gray-200 dark:border-gray-700/50
          bg-white/30 backdrop-blur-sm
          hover:bg-white/60 dark:hover:bg-gray-800/60
          text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
          transition-colors duration-200 cursor-pointer
          ${premiumBtnClass}
        `}
      >
        <span className="text-[11px] font-bold">
          {isOpen ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </span>
      </button>
    </div>
  );
};
