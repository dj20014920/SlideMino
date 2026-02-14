import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Medal, Send } from 'lucide-react';
import { rankingService } from '../services/rankingService';
import { PLAYER_NAME_MAX_LENGTH, normalizePlayerName, validatePlayerName } from '../utils/playerName';

export type ActiveGameExitContext = 'HOME' | 'NEW_GAME';

interface ActiveGameExitModalProps {
    open: boolean;
    context: ActiveGameExitContext;
    score: number;
    difficulty: string;
    duration: number;
    moves: number;
    sessionId: string;
    playerName?: string;
    onCancel: () => void;
    onProceedWithoutRegister: () => void;
    onRegisteredAndProceed: () => void;
}

export const ActiveGameExitModal: React.FC<ActiveGameExitModalProps> = ({
    open,
    context,
    score,
    difficulty,
    duration,
    moves,
    sessionId,
    playerName,
    onCancel,
    onProceedWithoutRegister,
    onRegisteredAndProceed,
}) => {
    const { t } = useTranslation();
    const [step, setStep] = useState<'CHOICE' | 'REGISTER' | 'SUBMITTED'>('CHOICE');
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitInfo, setSubmitInfo] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setStep('CHOICE');
        setName(playerName || rankingService.getSavedName());
        setIsSubmitting(false);
        setNameError(null);
        setSubmitError(null);
        setSubmitInfo(null);
    }, [open, context, playerName]);

    if (!open) return null;

    const submitScoreWithName = async (trimmedName: string) => {
        setIsSubmitting(true);
        setNameError(null);
        setSubmitError(null);
        setSubmitInfo(null);

        const result = await rankingService.submitScore(
            sessionId,
            trimmedName,
            score,
            difficulty,
            duration,
            moves
        );

        setIsSubmitting(false);
        if (result.success) {
            setStep('SUBMITTED');
            return;
        }

        if (result.queued) {
            setSubmitInfo(t('modals:rankingRegister.queuedMessage'));
            setStep('SUBMITTED');
            return;
        }

        if (result.alreadySubmitted) {
            setSubmitInfo(t('modals:rankingRegister.alreadySubmittedMessage'));
            setStep('SUBMITTED');
            return;
        }

        setSubmitError(t('modals:rankingRegister.failureMessage'));
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
        const defaultName = normalizePlayerName(name || playerName || rankingService.getSavedName());
        const errorKey = validatePlayerName(defaultName);
        if (errorKey) {
            setStep('REGISTER');
            return;
        }
        void submitScoreWithName(defaultName);
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

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xl animate-fade-in" />

            <div className="relative z-10 w-full max-w-sm rounded-3xl border border-white/70 bg-white/70 p-6 shadow-2xl shadow-slate-900/10 animate-slide-up">
                {step === 'CHOICE' && (
                    <div className="space-y-5">
                        <div className="space-y-2 text-center">
                            <h3 className="text-2xl font-bold text-gray-900">{t(titleKey)}</h3>
                            <p className="text-sm text-gray-500 whitespace-pre-line">{t(descriptionKey)}</p>
                        </div>

                        <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50 to-violet-50 px-5 py-4">
                            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500">
                                {t('modals:activeGameExit.scoreLabel')}
                            </p>
                            <p className="mt-1 text-4xl font-black tracking-tight text-gray-900 tabular-nums">{score}</p>
                            <p className="mt-2 text-xs text-gray-500">
                                {difficulty} · {duration}s · {moves} moves
                            </p>
                        </div>

                        <div className="flex flex-col gap-3 pt-1">
                            <button
                                type="button"
                                onClick={handleRegisterClick}
                                disabled={isSubmitting}
                                className="
                                  w-full py-4 rounded-2xl
                                  bg-gradient-to-br from-indigo-500 to-purple-600
                                  text-white font-bold text-lg
                                  shadow-lg shadow-indigo-500/25
                                  hover:shadow-xl hover:shadow-indigo-500/35 hover:-translate-y-0.5
                                  disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0
                                  active:translate-y-0 active:scale-[0.98]
                                  transition-all duration-200
                                "
                            >
                                <span className="flex items-center justify-center gap-2">
                                    <Medal size={20} className="text-indigo-100" />
                                    {isSubmitting
                                        ? t('modals:rankingRegister.submitting')
                                        : t('modals:activeGameExit.registerButton')}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={onProceedWithoutRegister}
                                className="
                                  w-full py-3.5 rounded-2xl
                                  bg-white border border-gray-200
                                  text-gray-900 font-semibold
                                  shadow-sm
                                  hover:bg-gray-50 hover:border-gray-300
                                  active:scale-[0.98]
                                  transition-all duration-200
                                "
                            >
                                {t(proceedWithoutKey)}
                            </button>

                            <button
                                type="button"
                                onClick={onCancel}
                                className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
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
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2 text-center">
                            <h3 className="text-2xl font-bold text-gray-900">{t('modals:activeGameExit.registerTitle')}</h3>
                            <p className="text-sm text-gray-500 whitespace-pre-line">{t('modals:activeGameExit.registerDescription')}</p>
                        </div>

                        <div className="w-full p-3 rounded-xl border border-sky-200 bg-sky-50 text-xs text-sky-800 leading-relaxed">
                            {t('modals:nameInput.privacyNotice')}
                        </div>

                        <div>
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
                            {nameError && (
                                <p className="mt-1 text-xs text-red-500 font-medium text-center">{nameError}</p>
                            )}
                        </div>

                        {submitError && (
                            <div className="w-full text-center text-sm text-red-500">
                                {submitError}
                            </div>
                        )}
                        {submitInfo && (
                            <div className="w-full text-center text-sm text-amber-600">
                                {submitInfo}
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                            <button
                                type="submit"
                                disabled={isSubmitting || !name.trim()}
                                className="
                                  w-full py-4 rounded-2xl
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
                                onClick={() => setStep('CHOICE')}
                                className="w-full py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                            >
                                {t('common:buttons.cancel')}
                            </button>
                        </div>
                    </form>
                )}

                {step === 'SUBMITTED' && (
                    <div className="space-y-6 text-center">
                        <div className="mx-auto w-20 h-20 rounded-full bg-green-100 border border-green-200 flex items-center justify-center">
                            <Check size={34} className="text-green-600" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-bold text-gray-900">{t('modals:rankingRegister.success')}</h3>
                            <p className="text-sm text-gray-500 whitespace-pre-line">
                                {submitInfo ?? t('modals:activeGameExit.submittedMessage')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onRegisteredAndProceed}
                            className="
                              w-full py-4 rounded-2xl
                              bg-gray-900 text-white font-bold text-lg
                              shadow-lg
                              hover:bg-gray-800 hover:-translate-y-0.5
                              active:scale-[0.98]
                              transition-all duration-200
                            "
                        >
                            {t(confirmKey)}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActiveGameExitModal;
