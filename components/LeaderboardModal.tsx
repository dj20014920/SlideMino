import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trophy } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { rankingService, RankEntry } from '../services/rankingService';
import { getSeasonCountdown } from '../services/seasonService';
import { getLevelBadgeById } from '../services/xpLevelService';

interface LeaderboardModalProps {
    open: boolean;
    onClose: () => void;
}

const LEADERBOARD_REFRESH_INTERVAL_MS = 5000;

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ open, onClose }) => {
    const { t } = useTranslation();
    useBodyScrollLock(open);
    const [rankings, setRankings] = useState<RankEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [fromCache, setFromCache] = useState(false);
    const [activeTab, setActiveTab] = useState<'ALL' | '4x4' | '5x5' | '7x7' | '8x8' | '10x10'>('ALL');
    const [countdown, setCountdown] = useState(() => getSeasonCountdown());

    const formatDifficultyLabel = (difficulty?: string): string | null => {
        if (!difficulty) return null;
        const trimmed = difficulty.trim();
        const match = trimmed.match(/^(\d+)(?:x\1)?$/i);
        return match ? `${match[1]}x${match[1]}` : trimmed;
    };

    // 시즌 카운트다운 1분마다 갱신
    useEffect(() => {
        if (!open) return;
        setCountdown(getSeasonCountdown());
        const intervalId = window.setInterval(() => {
            setCountdown(getSeasonCountdown());
        }, 60_000);
        return () => window.clearInterval(intervalId);
    }, [open]);

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        const fetchLeaderboard = async (showLoading: boolean) => {
            if (showLoading) setLoading(true);
            setHasError(false);

            try {
                const result = await rankingService.getLeaderboard();
                if (cancelled) return;
                setRankings(result.data);
                setIsOffline(result.offline);
                setFromCache(result.fromCache);
            } catch (err) {
                console.error(err);
                if (!cancelled) {
                    setHasError(true);
                    setIsOffline(typeof navigator !== 'undefined' ? !navigator.onLine : false);
                    setFromCache(false);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void fetchLeaderboard(true);
        const intervalId = window.setInterval(() => {
            void fetchLeaderboard(false);
        }, LEADERBOARD_REFRESH_INTERVAL_MS);
        const handleOnline = () => {
            void fetchLeaderboard(false);
        };
        window.addEventListener('online', handleOnline);

        return () => {
            cancelled = true;
            window.clearInterval(intervalId);
            window.removeEventListener('online', handleOnline);
        };
    }, [open]);

    if (!open) return null;

    const filteredRankings = rankings.filter(r => {
        if (activeTab === 'ALL') return true;
        const label = formatDifficultyLabel(r.difficulty);
        return label === activeTab;
    });

    // 시즌 카운트다운 텍스트
    const countdownText = countdown.totalMs <= 0
        ? t('common:season.countdownDone')
        : countdown.isUrgent
            ? t('common:season.countdownUrgent', { hours: countdown.hours, minutes: countdown.minutes } as any)
            : t('common:season.countdown', { days: countdown.days, hours: countdown.hours } as any);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 modal-safe-overlay">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[80vh] modal-safe-panel win98-window">
                {/* Header */}
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

                {/* 시즌 카운트다운 */}
                <div className={`px-4 py-2 text-center text-xs font-semibold ${
                    countdown.isUrgent
                        ? 'bg-red-50 text-red-600 border-b border-red-100'
                        : 'bg-blue-50 text-blue-600 border-b border-blue-100'
                }`}>
                    {String(countdownText)}
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto overflow-y-visible border-b border-gray-100 bg-white px-4 py-3">
                    {(['ALL', '4x4', '5x5', '7x7', '8x8', '10x10'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all
                                ${activeTab === tab
                                    ? 'bg-gray-900 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }
                            `}
                        >
                            {tab === 'ALL' ? t('modals:leaderboard.tabs.all') : tab}
                        </button>
                    ))}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50/50">
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
                                key={index}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between"
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
                                        <div
                                            className="font-bold text-gray-800 max-w-[160px] truncate"
                                            title={entry.name}
                                        >
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
            </div>
        </div>
    );
};
