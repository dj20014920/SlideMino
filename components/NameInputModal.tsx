import React, { useState, useEffect } from 'react';
import { X, Play } from 'lucide-react';

interface NameInputModalProps {
    open: boolean;
    difficulty: number | null;
    onClose: () => void;
    onSubmit: (name: string) => void;
}

export const NameInputModal: React.FC<NameInputModalProps> = ({ open, difficulty, onClose, onSubmit }) => {
    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setName('');
            setError(null);
        }
    }, [open]);

    const validateName = (value: string) => {
        // 1. Length check (1~10)
        if (value.length === 0) return '이름을 입력해주세요.';
        if (value.length > 10) return '이름은 최대 10글자입니다.';

        // 2. Injection Prevention (allow only safe chars)
        // Allowed: Korean (Hangul syllables, Jamo), English, Numbers, Space
        const safePattern = /^[a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ\s]+$/;
        if (!safePattern.test(value)) {
            return '특수문자는 사용할 수 없습니다.';
        }

        return null;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();

        const validationError = validateName(trimmedName);
        if (validationError) {
            setError(validationError);
            return;
        }

        onSubmit(trimmedName);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = e.target.value;
        // Pre-validation to prevent typing too long
        if (newVal.length <= 10) {
            setName(newVal);
            setError(null);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-scale-in">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-gray-800">
                            {difficulty}x{difficulty} 게임 시작
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-600 mb-2">
                                사용할 닉네임 (최대 10자)
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={handleChange}
                                placeholder="닉네임을 입력하세요"
                                className={`
                            w-full px-4 py-3 rounded-xl border-2 outline-none transition-all
                            font-medium text-gray-800 placeholder-gray-400
                            ${error
                                        ? 'border-red-300 focus:border-red-500 bg-red-50'
                                        : 'border-gray-200 focus:border-blue-500 bg-gray-50 focus:bg-white'
                                    }
                        `}
                                autoFocus
                            />
                            {error && (
                                <p className="mt-1 text-xs text-red-500 font-medium">
                                    {error}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="
                        w-full py-3.5 rounded-xl
                        bg-gray-900 text-white font-bold text-lg
                        shadow-lg shadow-gray-900/20
                        hover:bg-gray-800 hover:-translate-y-0.5
                        active:translate-y-0 active:shadow-md
                        transition-all duration-200 ease-out
                        flex items-center justify-center gap-2
                    "
                        >
                            <span>게임 시작</span>
                            <Play size={18} fill="currentColor" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
