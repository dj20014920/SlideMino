import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Medal, Send, Share2 } from 'lucide-react';
import { rankingService } from '../services/rankingService';
import { getAnalyticsInstallId } from '../services/analyticsService';
import { submitEventScore } from '../services/weeklyEventService';
import { shareGameResult, type ShareResult } from '../services/shareCardService';
import { gameEventBus } from '../services/gameEventBus';
import { getHighestLevelBadgeForLevel, loadXpData } from '../services/xpLevelService';
import { PLAYER_NAME_MAX_LENGTH, normalizePlayerName, validatePlayerName } from '../utils/playerName';
import type { BoardSize, GameMode } from '../types';

export type ActiveGameExitContext = 'HOME' | 'NEW_GAME';

interface ActiveGameExitModalProps {
    open: boolean;
    context: ActiveGameExitContext;
    score: number;
    difficulty: string;
    boardSize: BoardSize;
    duration: number;
    moves: number;
    sessionId: string;
    playerName?: string;
    lockedPlayerName?: string | null;
    isWin98ThemeActive?: boolean;
    /** 현재 게임 모드 (이벤트 모드 분기에 사용) */
    gameMode?: GameMode;
    /** 주간 이벤트 전용: 현재 도전 회차 */
    eventAttemptNumber?: number;
    onCancel: () => void;
    onProceedWithoutRegister: () => void;
    onIntermediateSaveComplete: () => void;
    onSessionNameLocked?: (name: string) => void;
    onRegisteredAndProceed: () => void;
}

export const ActiveGameExitModal: React.FC<ActiveGameExitModalProps> = ({
    open,
    context,
    score,
    difficulty,
    boardSize,
    duration,
    moves,
    sessionId,
    playerName,
    lockedPlayerName,
    isWin98ThemeActive,
    gameMode = 'normal',
    eventAttemptNumber,
    onCancel,
    onProceedWithoutRegister,
    onIntermediateSaveComplete,
    onSessionNameLocked,
    onRegisteredAndProceed,
}) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'CHOICE' | 'REGISTER' | 'SUBMITTED'>('CHOICE');
    const [submitIntent, setSubmitIntent] = useState<'EXIT' | 'MID_SAVE'>('EXIT');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submittedMessageOverride, setSubmittedMessageOverride] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [shareToast, setShareToast] = useState<string | null>(null);

    // 중간 저장 후 작은 공유 아이콘 핸들러
    const handleShare = useCallback(async () => {
        if (isSharing) return;
        setIsSharing(true);
        setShareToast(null);
        try {
            const result: ShareResult = await shareGameResult({
                score,
                boardSize,
                mode: gameMode,
                playerName,
            });
            if (result === 'shared') {
                setShareToast(t('common:share.shared'));
            } else if (result === 'downloaded') {
                setShareToast(t('common:share.downloaded'));
            } else if (result === 'copied') {
                setShareToast(t('common:share.copied'));
            }
        } catch { /* 무시 */ } finally {
            setIsSharing(false);
            setTimeout(() => setShareToast(null), 3000);
        }
    }, [isSharing, score, boardSize, playerName, t]);

    useEffect(() => {
        if (!open) return;
        setStep('CHOICE');
        setSubmitIntent('EXIT');
        setName(lockedPlayerName || playerName || rankingService.getSavedName());
        setIsSubmitting(false);
        setNameError(null);
        setSubmitError(null);
        setSubmittedMessageOverride(null);
    }, [open, context, playerName, lockedPlayerName]);

    if (!open) return null;

    const submitScoreWithName = async (trimmedName: string, intent: 'EXIT' | 'MID_SAVE') => {
        setIsSubmitting(true);
        setNameError(null);
        setSubmitError(null);
        setSubmitIntent(intent);

        // 이벤트 모드: 이벤트 전용 API로 제출
        if (gameMode === 'weekly_event') {
            const levelBadgeId = getHighestLevelBadgeForLevel(loadXpData().level)?.id;
            const eventResult = await submitEventScore({
                name: trimmedName,
                score,
                moves,
                duration,
                attemptNumber: eventAttemptNumber ?? 1,
                levelBadge: levelBadgeId,
                isIntermediate: intent === 'MID_SAVE',
            });
            setIsSubmitting(false);
            if (eventResult.success) {
                onSessionNameLocked?.(trimmedName);
                setSubmittedMessageOverride(null);
                setStep('SUBMITTED');
                gameEventBus.emit('SCORE_SUBMITTED', {
                    score, boardSize, mode: gameMode,
                });
            } else {
                setSubmitError(t('modals:rankingRegister.failureMessage'));
            }
            return;
        }

        // 일반 모드: 기존 랭킹 API로 제출
        const result = await rankingService.submitScore(
            sessionId,
            trimmedName,
            score,
            difficulty,
            duration,
            moves,
            getAnalyticsInstallId()
        );

        setIsSubmitting(false);
        if (result.success) {
            onSessionNameLocked?.(trimmedName);
            setSubmittedMessageOverride(null);
            setStep('SUBMITTED');
            // 미션 추적: 랭킹 제출 이벤트 (중간저장/나가기)
            gameEventBus.emit('SCORE_SUBMITTED', {
                score, boardSize, mode: gameMode,
            });
            return;
        }

        if (result.code === 'SESSION_ALREADY_SUBMITTED') {
            // 구버전 서버(세션당 1회 등록 제한)와의 호환:
            // 이미 등록된 세션은 실패로 막지 않고 다음 단계로 진행시킨다.
            onSessionNameLocked?.(trimmedName);
            setSubmittedMessageOverride(
                intent === 'MID_SAVE'
                    ? t('modals:activeGameExit.alreadySubmittedMidSaveMessage')
                    : t('modals:activeGameExit.alreadySubmittedExitMessage')
            );
            setStep('SUBMITTED');
            // 이미 제출된 경우에도 미션 추적
            gameEventBus.emit('SCORE_SUBMITTED', {
                score, boardSize, mode: gameMode,
            });
            return;
        }

        if (result.offline) {
            setSubmitError(t('modals:leaderboard.offline'));
            return;
        }

        if (result.status === 403) {
            setSubmitError(t('modals:rankingRegister.rejectedMessage'));
            return;
        }

        if (result.status === 429) {
            setSubmitError(t('modals:rankingRegister.rateLimitedMessage'));
            return;
        }

        console.error('[ActiveGameExitModal] submit failed', {
            status: result.status,
            code: result.code,
            errorMessage: result.errorMessage,
            intent,
        });
        setSubmitError(t('modals:rankingRegister.failureMessage'));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const fixedName = normalizePlayerName(lockedPlayerName ?? '');
        if (fixedName) {
            await submitScoreWithName(fixedName, submitIntent);
            return;
        }

        const trimmedName = normalizePlayerName(name);
        const errorKey = validatePlayerName(trimmedName);
        if (errorKey) {
            setNameError(t(`modals:nameInput.errors.${errorKey}`));
            return;
        }

        await submitScoreWithName(trimmedName, submitIntent);
    };

    const handleRegisterAndExitClick = () => {
        setSubmitIntent('EXIT');
        setStep('REGISTER');
    };

    const handleIntermediateSaveClick = () => {
        setSubmitIntent('MID_SAVE');
        setStep('REGISTER');
    };

    const titleKey = context === 'HOME'
        ? 'modals:activeGameExit.homeTitle'
        : 'modals:activeGameExit.newGameTitle';
    const descriptionKey = context === 'HOME'
        ? 'modals:activeGameExit.homeDescription'
        : 'modals:activeGameExit.newGameDescription';
    const proceedWithoutKey = context === 'HOME'
        ? 'modals:activeGameExit.homeProceed'
        : 'modals:activeGameExit.newGameProceed';
    const cancelKey = context === 'HOME'
        ? 'modals:activeGameExit.cancelHome'
        : 'modals:activeGameExit.cancelNewGame';
    const confirmKey = context === 'HOME'
        ? 'modals:activeGameExit.confirmHome'
        : 'modals:activeGameExit.confirmNewGame';
    const submittedMessage = submittedMessageOverride ?? (submitIntent === 'MID_SAVE'
        ? t('modals:activeGameExit.midSaveSubmittedMessage')
        : t('modals:activeGameExit.submittedMessage'));
    const isWin98 = Boolean(isWin98ThemeActive);

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
            <div className={isWin98 ? 'absolute inset-0 bg-black/45' : 'absolute inset-0 bg-white/80 backdrop-blur-xl animate-fade-in'} />

            <div className={isWin98
                ? 'window relative z-10 w-full max-w-sm animate-slide-up'
                : 'relative z-10 w-full max-w-sm rounded-3xl border border-white/70 bg-white/70 p-6 shadow-2xl shadow-slate-900/10 animate-slide-up win98-window'}
            >
                {isWin98 && (
                    <div className="title-bar" style={{ background: 'linear-gradient(90deg, #000080, #1084d0)' }}>
                        <div className="title-bar-text" style={{ color: '#fff' }}>Menu?</div>
                        <div className="title-bar-controls">
                            <button aria-label="Close" onClick={onCancel} />
                        </div>
                    </div>
                )}

                <div className={isWin98 ? 'window-body space-y-4 p-3' : ''}>
                    {step === 'CHOICE' && (
                        <div className={isWin98 ? 'space-y-4' : 'space-y-5'}>
                            <div className="space-y-2 text-center">
                                <h3 className={isWin98 ? 'text-xl font-bold text-gray-900' : 'text-2xl font-bold text-gray-900'}>{t(titleKey)}</h3>
                                <p className={isWin98 ? 'text-sm text-gray-700 whitespace-pre-line' : 'text-sm text-gray-500 whitespace-pre-line'}>{t(descriptionKey)}</p>
                            </div>

                            <div className={isWin98 ? 'sunken-panel px-3 py-2' : 'rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-violet-50 px-5 py-4'}>
                                <p className={isWin98 ? 'text-xs font-bold text-gray-700' : 'text-xs font-bold uppercase tracking-widest text-indigo-500'}>
                                    {t('modals:activeGameExit.scoreLabel')}
                                </p>
                                <p className={isWin98 ? 'mt-1 text-3xl font-black tracking-tight text-gray-900 tabular-nums' : 'mt-1 text-4xl font-black tracking-tight text-gray-900 tabular-nums'}>{score}</p>
                                <p className={isWin98 ? 'mt-2 text-xs text-gray-700' : 'mt-2 text-xs text-gray-500'}>
                                    {difficulty} · {duration}s · {moves} moves
                                </p>
                            </div>

                            <div className={isWin98 ? 'flex flex-col gap-2 pt-1' : 'flex flex-col gap-3 pt-1'}>
                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={onProceedWithoutRegister}
                                        className={isWin98
                                            ? 'w-full py-2 px-3 win98-menu-btn win98-exit-home-btn text-sm font-semibold'
                                            : 'w-full py-3.5 rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 text-amber-900 font-semibold shadow-sm shadow-amber-100/70 hover:from-amber-100 hover:to-orange-200 hover:border-amber-400 active:scale-[0.98] transition-all duration-200'}
                                    >
                                        {t(proceedWithoutKey)}
                                    </button>
                                    {context === 'HOME' && (
                                        <p className={isWin98 ? 'text-xs text-gray-500' : 'text-xs text-gray-400'}>
                                            {t('modals:activeGameExit.homeProceedHint')}
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={handleIntermediateSaveClick}
                                        className={isWin98
                                            ? 'w-full py-2 px-3 win98-menu-btn text-sm font-semibold'
                                            : 'w-full py-4 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/35 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200'}
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            <Send size={isWin98 ? 14 : 18} className={isWin98 ? '' : 'text-emerald-100'} />
                                            {t('modals:activeGameExit.midSaveButton')}
                                        </span>
                                    </button>
                                    <p className={isWin98 ? 'text-xs text-gray-500' : 'text-xs text-gray-400'}>
                                        {t('modals:activeGameExit.midSaveButtonHint')}
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleRegisterAndExitClick}
                                    className={isWin98
                                        ? 'w-full py-2 px-3 win98-menu-btn text-sm font-semibold'
                                        : 'w-full py-4 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold text-lg shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/35 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200'}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Medal size={isWin98 ? 14 : 20} className={isWin98 ? '' : 'text-indigo-100'} />
                                        {t('modals:activeGameExit.registerButton')}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={onCancel}
                                    className={isWin98
                                        ? 'w-full py-2 px-3 win98-menu-btn win98-exit-cancel-btn text-sm font-semibold'
                                        : 'w-full py-3.5 rounded-2xl border border-slate-300 bg-white text-slate-800 text-base font-semibold shadow-sm hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] transition-all duration-200'}
                                >
                                    {t(cancelKey)}
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
                        <form onSubmit={handleSubmit} className={isWin98 ? 'space-y-4' : 'space-y-5'}>
                            <div className="space-y-2 text-center">
                                <h3 className={isWin98 ? 'text-xl font-bold text-gray-900' : 'text-2xl font-bold text-gray-900'}>{t('modals:activeGameExit.registerTitle')}</h3>
                                <p className={isWin98 ? 'text-sm text-gray-700 whitespace-pre-line' : 'text-sm text-gray-500 whitespace-pre-line'}>{t('modals:activeGameExit.registerDescription')}</p>
                            </div>

                            <div className={isWin98 ? 'sunken-panel p-2 text-xs leading-relaxed text-gray-700' : 'w-full p-3 rounded-xl border border-sky-200 bg-sky-50 text-xs text-sky-800 leading-relaxed'}>
                                {t('modals:nameInput.privacyNotice')}
                            </div>

                            <div>
                                {isWin98ThemeActive ? (
                                    <div className="field-row items-center gap-2">
                                        <label htmlFor="active-game-exit-name" className="shrink-0">
                                            {t('common:labels.name')}
                                        </label>
                                        <input
                                            id="active-game-exit-name"
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
                                            className="min-w-0 flex-1 px-2 py-1"
                                            autoFocus
                                        />
                                    </div>
                                ) : (
                                    <>
                                        <label htmlFor="active-game-exit-name" className="block text-xs font-bold text-gray-500 uppercase ml-1 mb-1.5">
                                            {t('common:labels.name')}
                                        </label>
                                        <input
                                            id="active-game-exit-name"
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
                                    </>
                                )}
                                {lockedPlayerName && (
                                    <p className={isWin98 ? 'mt-1 text-xs text-gray-700 text-center' : 'mt-1 text-xs text-gray-500 text-center'}>{t('modals:activeGameExit.lockedNameNotice')}</p>
                                )}
                                {nameError && (
                                    <p className="mt-1 text-xs text-red-500 font-medium text-center">{nameError}</p>
                                )}
                            </div>

                            {submitError && (
                                <div className="w-full text-center text-sm text-red-500">
                                    {submitError}
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={isSubmitting || (!lockedPlayerName && !name.trim())}
                                    className={isWin98
                                        ? 'w-full py-2 px-3 win98-menu-btn text-sm font-semibold disabled:opacity-100'
                                        : 'w-full py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg shadow-lg hover:bg-gray-800 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 active:scale-[0.98] transition-all duration-200'}
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
                                    onClick={() => setStep('CHOICE')}
                                    className={isWin98
                                        ? 'w-full py-2 px-3 win98-menu-btn text-sm font-semibold'
                                        : 'w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors'}
                                >
                                    {t('common:buttons.cancel')}
                                </button>
                            </div>
                        </form>
                    )}

                    {step === 'SUBMITTED' && (
                        <div className={isWin98 ? 'space-y-4 text-center' : 'space-y-6 text-center'}>
                            <div className="mx-auto w-20 h-20 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                                <Check size={34} className="text-green-600" />
                            </div>
                            <div className="space-y-2">
                                <h3 className={isWin98 ? 'text-xl font-bold text-gray-900' : 'text-2xl font-bold text-gray-900'}>{t('modals:rankingRegister.success')}</h3>
                                <p className={isWin98 ? 'text-sm text-gray-700 whitespace-pre-line' : 'text-sm text-gray-500 whitespace-pre-line'}>
                                    {submittedMessage}
                                </p>
                            </div>
                            <div className="flex gap-3 w-full">
                                <button
                                    type="button"
                                    onClick={submitIntent === 'MID_SAVE' ? onIntermediateSaveComplete : onRegisteredAndProceed}
                                    className={isWin98
                                        ? 'flex-1 py-2 px-3 win98-menu-btn text-sm font-semibold'
                                        : 'flex-1 py-4 rounded-2xl bg-gray-900 text-white font-bold text-lg shadow-lg hover:bg-gray-800 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200'}
                                >
                                    {submitIntent === 'MID_SAVE'
                                        ? t('modals:activeGameExit.continueAfterMidSave')
                                        : t(confirmKey)}
                                </button>
                                {/* 작은 공유 아이콘 */}
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    disabled={isSharing}
                                    aria-label={t('common:share.button')}
                                    className={isWin98
                                        ? 'px-3 py-2 win98-menu-btn text-sm'
                                        : 'px-4 py-4 rounded-2xl border border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 active:scale-[0.97] transition-all duration-150'}
                                >
                                    <Share2 size={20} />
                                </button>
                            </div>
                            {shareToast && (
                                <p className="text-xs text-green-600 font-medium">{shareToast}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ActiveGameExitModal;
