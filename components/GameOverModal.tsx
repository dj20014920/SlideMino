import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trophy, Send, Check, Medal, RotateCcw, Share2 } from 'lucide-react';
import { rankingService } from '../services/rankingService';
import { getAnalyticsInstallId } from '../services/analyticsService';
import { submitDailyChallengeScore, hasClaimedTodayReward, markTodayRewardClaimed, getFirstCompletionFragments } from '../services/dailyChallengeService';
import { submitEventScore, incrementLocalAttemptCount } from '../services/weeklyEventService';
import { addFragments } from '../services/skinService';
import { shareGameResult, type ShareCardOptions, type ShareResult } from '../services/shareCardService';
import { gameEventBus } from '../services/gameEventBus';
import { isFeatureUnlocked } from '../services/onboardingService';
import { getHighestLevelBadgeForLevel, loadXpData } from '../services/xpLevelService';
import { PLAYER_NAME_MAX_LENGTH, normalizePlayerName, validatePlayerName } from '../utils/playerName';
import type { GameMode, BoardSize } from '../types';
import AdBanner from './AdBanner';

interface GameOverModalProps {
    sessionId: string;
    score: number;
    difficulty: string;
    boardSize: BoardSize;
    duration: number;
    moves: number;
    playerName?: string;
    lockedPlayerName?: string | null;
    canOfferRevive: boolean;
    reviveDestroyCount: number;
    isReviveAdReady: boolean;
    isReviveInProgress: boolean;
    onWatchReviveAd: () => void;
    onClose: () => void;
    gameMode?: GameMode;
    challengeDate?: string;
    /** 주간 이벤트 전용: 도전 회차 */
    eventAttemptNumber?: number;
    /** 랭킹 제출 후 반환된 순위/총인원 (공유 카드에 표시) */
    submittedRank?: number;
    submittedTotal?: number;
    /** 제출 완료 후 랭킹 보기 (weekly_event 전용) */
    onViewRankings?: () => void;
    onSessionNameLocked?: (name: string) => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
    sessionId,
    score,
    difficulty,
    boardSize,
    duration,
    moves,
    playerName,
    lockedPlayerName,
    canOfferRevive,
    reviveDestroyCount,
    isReviveAdReady,
    isReviveInProgress,
    onWatchReviveAd,
    onClose,
    gameMode = 'normal',
    challengeDate,
    eventAttemptNumber,
    submittedRank,
    submittedTotal,
    onViewRankings,
    onSessionNameLocked,
}) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'INITIAL' | 'REGISTER' | 'SUBMITTED'>('INITIAL');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submittedMessageOverride, setSubmittedMessageOverride] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareToast, setShareToast] = useState<string | null>(null);
    // 랭킹 제출 후 순위 (챌린지 결과에서도 사용)
    const [localRank, setLocalRank] = useState<number | undefined>(submittedRank);
    const [localTotal, setLocalTotal] = useState<number | undefined>(submittedTotal);
    const levelBadgeId = getHighestLevelBadgeForLevel(loadXpData().level)?.id;

    useEffect(() => {
        // Load saved name or use provided playerName
        setName(lockedPlayerName || playerName || rankingService.getSavedName());
        setNameError(null);
        setSubmitError(null);
        setSubmittedMessageOverride(null);
        setShareToast(null);
        setLocalRank(submittedRank);
        setLocalTotal(submittedTotal);
    }, [lockedPlayerName, playerName, submittedRank, submittedTotal]);

    useEffect(() => {
        if (step === 'REGISTER') {
            setNameError(null);
            setSubmitError(null);
        }
    }, [step]);

    // 공유 핸들러
    const handleShare = useCallback(async () => {
        if (isSharing) return;
        setIsSharing(true);
        setShareToast(null);
        try {
            const opts: ShareCardOptions = {
                score,
                boardSize,
                mode: gameMode,
                rank: localRank,
                total: localTotal,
                playerName,
                challengeDate,
            };
            const result: ShareResult = await shareGameResult(opts);
            if (result === 'shared') {
                setShareToast(t('common:share.shared'));
            } else if (result === 'downloaded') {
                setShareToast(t('common:share.downloaded'));
            } else if (result === 'copied') {
                setShareToast(t('common:share.copied'));
            }
        } catch {
            // 무시
        } finally {
            setIsSharing(false);
            // 토스트 3초 후 자동 제거
            setTimeout(() => setShareToast(null), 3000);
        }
    }, [isSharing, score, boardSize, gameMode, localRank, localTotal, playerName, challengeDate, t]);

    const submitScoreWithName = async (trimmedName: string) => {
        setIsSubmitting(true);
        setNameError(null);
        setSubmitError(null);

        if (gameMode === 'daily_challenge' && challengeDate) {
            setIsSubmitting(false);
            // 사용자 결정사항(임시 운영 정책):
            // 데일리 챌린지 모드 및 데일리 챌린지 랭킹 제출을 사용자 증가 시점까지 비활성화한다.
            // 재활성화 시 아래 기존 제출 로직을 복구한다.
            //
            // const challengeResult = await submitDailyChallengeScore(
            //     challengeDate,
            //     trimmedName,
            //     score,
            //     moves,
            //     duration,
            // );
            // if (challengeResult?.success) {
            //     if (!hasClaimedTodayReward(challengeDate)) {
            //         const fragments = getFirstCompletionFragments();
            //         addFragments(fragments);
            //         markTodayRewardClaimed(challengeDate);
            //     }
            //     setLocalRank(challengeResult.rank);
            //     setLocalTotal(challengeResult.total);
            //     setSubmittedMessageOverride(
            //         String(t('modals:gameOver.challengeSubmitted', {
            //             rank: challengeResult.rank,
            //             total: challengeResult.total,
            //         } as any))
            //     );
            //     setStep('SUBMITTED');
            //     gameEventBus.emit('SCORE_SUBMITTED', {
            //         score, boardSize, mode: gameMode ?? 'normal',
            //         rank: challengeResult.rank, total: challengeResult.total,
            //     });
            // } else {
            //     setSubmitError(t('modals:rankingRegister.failureMessage'));
            // }
            setSubmitError('데일리 챌린지는 현재 임시 비활성화 상태입니다.');
            return;
        }

        if (gameMode === 'weekly_event') {
            // 주간 이벤트 전용 제출
            const eventResult = await submitEventScore({
                name: trimmedName,
                score,
                moves,
                duration,
                attemptNumber: eventAttemptNumber ?? 1,
                levelBadge: levelBadgeId,
            });
            setIsSubmitting(false);
            if (eventResult.success) {
                onSessionNameLocked?.(trimmedName);
                setLocalRank(eventResult.rank);
                setLocalTotal(eventResult.total);
                setSubmittedMessageOverride(
                    eventResult.rank
                        ? String(t('modals:gameOver.challengeSubmitted', {
                            rank: eventResult.rank,
                            total: eventResult.total,
                        } as any))
                        : null
                );
                setStep('SUBMITTED');
                // 미션 추적: 랭킹 제출 이벤트 (weekly_event)
                gameEventBus.emit('SCORE_SUBMITTED', {
                    score, boardSize, mode: gameMode ?? 'normal',
                    rank: eventResult.rank, total: eventResult.total,
                });
            } else {
                setSubmitError(t('modals:rankingRegister.failureMessage'));
            }
            return;
        }

        // Submit score with anti-cheat metadata and session ID
        const result = await rankingService.submitScore(
            sessionId,
            trimmedName,
            score,
            difficulty,
            duration,
            moves,
            getAnalyticsInstallId(),
            levelBadgeId
        );
        setIsSubmitting(false);
        if (result.success) {
            onSessionNameLocked?.(trimmedName);
            setSubmittedMessageOverride(null);
            setStep('SUBMITTED');
            // 미션 추적: 랭킹 제출 이벤트 (normal)
            gameEventBus.emit('SCORE_SUBMITTED', {
                score, boardSize, mode: gameMode ?? 'normal',
            });
        } else if (result.code === 'SESSION_ALREADY_SUBMITTED') {
            // 이미 등록된 세션이면 실패로 막지 않고 완료 단계로 전환한다.
            onSessionNameLocked?.(trimmedName);
            setSubmittedMessageOverride(t('modals:rankingRegister.alreadySubmittedMessage'));
            setStep('SUBMITTED');
            // 이미 제출된 경우에도 미션 추적 (중간저장 등)
            gameEventBus.emit('SCORE_SUBMITTED', {
                score, boardSize, mode: gameMode ?? 'normal',
            });
        } else if (result.offline) {
            setSubmitError(t('modals:leaderboard.offline'));
        } else if (result.status === 403) {
            setSubmitError(t('modals:rankingRegister.rejectedMessage'));
        } else if (result.status === 429) {
            setSubmitError(t('modals:rankingRegister.rateLimitedMessage'));
        } else {
            console.error('[GameOverModal] submit failed', {
                status: result.status,
                code: result.code,
                errorMessage: result.errorMessage,
            });
            setSubmitError(t('modals:rankingRegister.failureMessage'));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = normalizePlayerName(name);
        const errorKey = validatePlayerName(trimmedName);
        if (errorKey) {
            setNameError(t(`modals:nameInput.errors.${errorKey}`));
            return;
        }

        await submitScoreWithName(trimmedName);
    };

    const handleRegisterClick = () => {
        // 랭킹 등록은 항상 이름 입력/확인 단계를 거친다.
        setStep('REGISTER');
    };

    const submittedMessage = submittedMessageOverride ?? t('modals:rankingRegister.successMessage');

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl animate-fade-in" />

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center w-full max-w-sm animate-slide-up win98-window p-5">

                {step === 'INITIAL' && (
                    <div className="flex flex-col items-center space-y-8 w-full">
                        {/* Trophy Icon */}
                        <div className="
              w-24 h-24 rounded-full 
              bg-gradient-to-br from-amber-100 to-yellow-200
              border border-amber-200/50
              shadow-xl shadow-amber-900/10
              flex items-center justify-center
            ">
                            <Trophy size={40} className="text-amber-600 drop-shadow-sm" />
                        </div>

                        {/* Title */}
                        <h2 className="text-4xl font-bold text-gray-900 tracking-tight">{t('modals:gameOver.title')}</h2>

                        {/* Score Display */}
                        <div className="
              w-full text-center px-6 py-8 rounded-3xl
              bg-white/60 backdrop-blur-md
              border border-white/60
              shadow-lg
            ">
                            <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
                                {t('common:labels.finalScore')}
                            </p>
                            <p className="text-6xl font-black text-gray-900 tabular-nums tracking-tighter leading-none">
                                {score}
                            </p>
                        </div>

                        {/* 공유 버튼 (점수 아래) */}
                        {isFeatureUnlocked('share_card') && (
                        <button
                            onClick={handleShare}
                            disabled={isSharing}
                            aria-label={t('common:share.button')}
                            className="
                flex items-center justify-center gap-2
                px-6 py-2.5 rounded-full
                bg-gray-100 text-gray-600 text-sm font-semibold
                border border-gray-200
                hover:bg-gray-200 hover:text-gray-900
                disabled:opacity-50
                active:scale-[0.97]
                transition-all duration-150
              "
                        >
                            <Share2 size={16} />
                            {isSharing ? t('common:share.sharing') : t('common:share.button')}
                        </button>
                        )}

                        {/* 공유 토스트 */}
                        {shareToast && (
                            <p className="text-xs text-green-600 font-medium animate-fade-in">{shareToast}</p>
                        )}

                        {/* Actions */}
                        <div className="flex flex-col gap-3 w-full pt-2">
                            {canOfferRevive && (
                                <div className="
                  rounded-2xl border border-amber-200
                  bg-gradient-to-br from-amber-50 to-yellow-50
                  p-4 text-left
                ">
                                    <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                                        {t('modals:gameOver.reviveTitle')}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-700">
                                        {String(t('modals:gameOver.reviveDescription', { count: reviveDestroyCount } as any))}
                                    </p>
                                    <button
                                        onClick={onWatchReviveAd}
                                        disabled={!isReviveAdReady || isReviveInProgress}
                                        className="
                      mt-3 w-full py-3 rounded-xl
                      bg-amber-500 text-white font-bold
                      shadow-md shadow-amber-500/25
                      hover:bg-amber-600 hover:-translate-y-0.5
                      disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                      active:scale-[0.98]
                      transition-all duration-200
                    "
                                    >
                                        {isReviveInProgress ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                {t('modals:gameOver.reviveLoading')}
                                            </span>
                                        ) : (
                                            <span className="flex items-center justify-center gap-2">
                                                <RotateCcw size={16} />
                                                {t('modals:gameOver.reviveButton')}
                                            </span>
                                        )}
                                    </button>
                                    <p className="mt-2 text-xs text-gray-500">
                                        {isReviveAdReady
                                            ? String(t('modals:gameOver.reviveReadyHint', { count: reviveDestroyCount } as any))
                                            : String(t('modals:gameOver.revivePreparingHint'))}
                                    </p>
                                </div>
                            )}

                            <button
                                onClick={handleRegisterClick}
                                disabled={isSubmitting}
                                className="
                  group relative w-full py-4 rounded-2xl
                  bg-gradient-to-br from-indigo-500 to-purple-600
                  text-white font-bold text-lg
                  shadow-lg shadow-indigo-500/25
                  hover:shadow-xl hover:shadow-indigo-500/40 hover:-translate-y-0.5
                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  active:translate-y-0 active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Medal size={20} className="text-indigo-100" />
                                    {isSubmitting
                                        ? t('modals:rankingRegister.submitting')
                                        : t('modals:gameOver.registerRanking')}
                                </span>
                            </button>

                            <button
                                onClick={onClose}
                                className="
                  w-full py-4 rounded-2xl
                  bg-white border border-gray-200
                  text-gray-900 font-semibold text-lg
                  shadow-sm
                  hover:bg-gray-50 hover:border-gray-300
                  active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                {t('modals:gameOver.backToMenu')}
                            </button>
                        </div>

                        {submitError && (
                            <div className="w-full text-center text-sm text-red-500">
                                {submitError}
                            </div>
                        )}
                    </div>
                )}

                {step === 'REGISTER' && (
                    <form onSubmit={handleSubmit} className="flex flex-col items-center space-y-6 w-full">
                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900">{t('modals:rankingRegister.title')}</h3>
                            <p className="text-gray-500 text-sm" style={{ whiteSpace: 'pre-line' }}>
                                {t('modals:rankingRegister.description')}
                            </p>
                        </div>

                        <div className="w-full p-3 rounded-xl border border-sky-200 bg-sky-50 text-xs text-sky-800 leading-relaxed">
                            {t('modals:nameInput.privacyNotice')}
                        </div>

                        <div className="w-full space-y-4">
                            <div className="space-y-1.5">
                                <label htmlFor="playerName" className="text-xs font-bold text-gray-500 uppercase ml-1">
                                    {t('common:labels.name')}
                                </label>
                                <input
                                    id="playerName"
                                    type="text"
                                    value={name}
                                    onChange={(e) => {
                                        setName(e.target.value);
                                        setNameError(null);
                                        setSubmitError(null);
                                    }}
                                    placeholder={t('modals:nameInput.placeholder')}
                                    maxLength={PLAYER_NAME_MAX_LENGTH}
                                    readOnly={Boolean(lockedPlayerName)}
                                    className="
                    w-full px-5 py-4 rounded-2xl
                    bg-white/80 border border-gray-200
                    text-xl font-bold text-gray-900 text-center
                    placeholder:text-gray-300 placeholder:font-normal
                    focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500
                    transition-all shadow-sm
                  "
                                    autoFocus
                                />
                                {lockedPlayerName && (
                                    <p className="mt-1 text-xs text-gray-500 text-center">
                                        {t('modals:activeGameExit.lockedNameNotice')}
                                    </p>
                                )}
                                {nameError && (
                                    <p className="mt-1 text-xs text-red-500 font-medium text-center">
                                        {nameError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {submitError && (
                            <div className="w-full text-center text-sm text-red-500">
                                {submitError}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 w-full pt-4">
                            <button
                                type="submit"
                                disabled={isSubmitting || !name.trim()}
                                className="
                  relative w-full py-4 rounded-2xl
                  bg-gray-900 text-white font-bold text-lg
                  shadow-lg
                  hover:bg-gray-800 hover:-translate-y-0.5
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                {isSubmitting ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        {t('modals:rankingRegister.submitting')}
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        <Send size={18} />
                                        {t('modals:rankingRegister.submit')}
                                    </span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => setStep('INITIAL')}
                                className="
                  w-full py-3 rounded-2xl
                  text-gray-500 font-medium
                  hover:text-gray-900 hover:bg-gray-100/50
                  transition-colors
                "
                            >
                                {t('common:buttons.cancel')}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'SUBMITTED' && (
                    <div className="flex flex-col items-center space-y-8 w-full animate-pop-in">
                        <div className="
              w-24 h-24 rounded-full
              bg-green-100 border border-green-200
              flex items-center justify-center
            ">
                            <Check size={40} className="text-green-600" />
                        </div>

                        <div className="text-center space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900">{t('modals:rankingRegister.success')}</h3>
                            <p className="text-gray-500">
                                {submittedMessage}
                            </p>
                        </div>

                        {/* 공유 버튼 (강조) */}
                        {isFeatureUnlocked('share_card') && (
                        <button
                            onClick={handleShare}
                            disabled={isSharing}
                            aria-label={t('common:share.button')}
                            className="
                w-full py-4 rounded-2xl
                bg-gradient-to-r from-indigo-500 to-purple-500
                text-white font-bold text-lg
                shadow-lg shadow-indigo-500/25
                hover:shadow-xl hover:-translate-y-0.5
                disabled:opacity-50
                active:scale-[0.98]
                transition-all duration-200
              "
                        >
                            <span className="flex items-center justify-center gap-2">
                                <Share2 size={20} />
                                {isSharing ? t('common:share.sharing') : t('common:share.brag')}
                            </span>
                        </button>
                        )}

                        {shareToast && (
                            <p className="text-xs text-green-600 font-medium animate-fade-in">{shareToast}</p>
                        )}

                        {/* 이벤트 랭킹 바로 보기 (weekly_event 전용) */}
                        {gameMode === 'weekly_event' && onViewRankings && (
                            <button
                                onClick={onViewRankings}
                                className="
                  w-full py-3 rounded-2xl
                  bg-gradient-to-br from-purple-500 to-pink-500
                  text-white font-bold text-base
                  shadow-lg shadow-purple-500/25
                  hover:shadow-xl hover:-translate-y-0.5
                  active:scale-[0.98]
                  transition-all duration-200
                "
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Trophy size={18} />
                                    {t('modals:gameOver.viewEventRankings')}
                                </span>
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            className="
                w-full py-4 rounded-2xl
                bg-gray-900 text-white font-bold text-lg
                shadow-lg
                hover:bg-gray-800 hover:-translate-y-0.5
                active:scale-[0.98]
                transition-all duration-200
              "
                        >
                            {t('common:buttons.confirm')}
                        </button>
                    </div>
                )}


                <div className="w-full mt-4">
                    <AdBanner />
                </div>
            </div>
        </div>
    );
};
