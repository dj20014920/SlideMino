import React, { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone, Mouse, RotateCw, Undo2, Zap } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Language = 'ko' | 'en' | 'ja' | 'zh';

interface LocalizedContent {
    title: string;
    subtitle: string;
    sections: {
        icon: React.ReactNode;
        title: string;
        content: string;
    }[];
    tip: string;
}

const content: Record<Language, LocalizedContent> = {
    ko: {
        title: '게임 설명',
        subtitle: 'SlideMino 플레이 방법',
        sections: [
            {
                icon: <Smartphone size={20} />,
                title: '🎯 블록 배치',
                content: '하단의 블록을 드래그하여 보드 위에 놓으세요. 같은 숫자의 블록이 인접하면 합쳐질 준비가 됩니다!'
            },
            {
                icon: <Mouse size={20} />,
                title: '👆 스와이프 (필수)',
                content: '블록을 놓으면 반드시 스와이프해야 합니다. 화면을 상하좌우로 밀거나 키보드 방향키를 누르세요. 블록들이 밀리면서 같은 숫자끼리 합쳐집니다!'
            },
            {
                icon: <Zap size={20} />,
                title: '⚡ 콤보 찬스',
                content: '스와이프로 블록이 합쳐지면 "콤보 찬스"가 발동! 추가 스와이프를 하거나, 바로 새 블록을 놓을 수 있습니다. 전략적으로 활용하세요!'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 블록 회전',
                content: '블록을 드래그하는 동안 화면의 빈 공간을 탭하면 블록이 90도씩 회전합니다. 좁은 공간에 맞춰 넣어보세요!'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ 되돌리기',
                content: '실수했다면 우측 상단의 되돌리기 버튼을 누르세요. 게임당 3회까지 사용할 수 있습니다.'
            }
        ],
        tip: '💡 팁: 높은 숫자 블록을 한쪽 구석에 모으면 더 큰 숫자를 만들기 쉬워요!'
    },
    en: {
        title: 'How to Play',
        subtitle: 'SlideMino Game Guide',
        sections: [
            {
                icon: <Smartphone size={20} />,
                title: '🎯 Place Blocks',
                content: 'Drag blocks from the bottom and drop them onto the board. When same numbers are adjacent, they\'re ready to merge!'
            },
            {
                icon: <Mouse size={20} />,
                title: '👆 Swipe (Required)',
                content: 'After placing a block, you MUST swipe. Swipe the screen in any direction or use arrow keys. Blocks will slide and merge when matching!'
            },
            {
                icon: <Zap size={20} />,
                title: '⚡ Combo Chance',
                content: 'When blocks merge from a swipe, you get a "Combo Chance"! You can swipe again OR place a new block immediately. Use it strategically!'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 Rotate Blocks',
                content: 'While dragging a block, tap anywhere else on the screen to rotate it 90°. Fit blocks into tight spaces!'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ Undo',
                content: 'Made a mistake? Tap the undo button at the top right. You can use it up to 3 times per game.'
            }
        ],
        tip: '💡 Tip: Keep high-value blocks in one corner to build bigger numbers easily!'
    },
    ja: {
        title: '遊び方',
        subtitle: 'SlideMino ゲームガイド',
        sections: [
            {
                icon: <Smartphone size={20} />,
                title: '🎯 ブロックを置く',
                content: '下のブロックをドラッグしてボードに置きましょう。同じ数字のブロックが隣り合うと、合体の準備完了です！'
            },
            {
                icon: <Mouse size={20} />,
                title: '👆 スワイプ（必須）',
                content: 'ブロックを置いたら、必ずスワイプしてください。画面を上下左右にスワイプするか、矢印キーを押します。ブロックがスライドして同じ数字同士が合体します！'
            },
            {
                icon: <Zap size={20} />,
                title: '⚡ コンボチャンス',
                content: 'スワイプでブロックが合体すると「コンボチャンス」発動！追加でスワイプするか、すぐに新しいブロックを置くことができます。戦略的に活用しましょう！'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 ブロック回転',
                content: 'ブロックをドラッグ中に画面の別の場所をタップすると、ブロックが90度回転します。狭いスペースにフィットさせましょう！'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ 元に戻す',
                content: '間違えた場合は、右上の戻るボタンをタップしてください。1ゲームにつき3回まで使用できます。'
            }
        ],
        tip: '💡 ヒント：高い数字のブロックを一つの角に集めると、より大きな数字が作りやすくなります！'
    },
    zh: {
        title: '游戏说明',
        subtitle: 'SlideMino 玩法指南',
        sections: [
            {
                icon: <Smartphone size={20} />,
                title: '🎯 放置方块',
                content: '将底部的方块拖放到棋盘上。当相同数字的方块相邻时，它们就准备好合并了！'
            },
            {
                icon: <Mouse size={20} />,
                title: '👆 滑动（必须）',
                content: '放置方块后，必须滑动。向任意方向滑动屏幕或使用方向键。方块会滑动，相同数字会合并！'
            },
            {
                icon: <Zap size={20} />,
                title: '⚡ 连击机会',
                content: '滑动合并方块后，获得"连击机会"！可以再次滑动，或立即放置新方块。请策略性地使用！'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 旋转方块',
                content: '拖动方块时，点击屏幕其他位置可将方块旋转90度。让方块适合狭小空间！'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ 撤销',
                content: '操作失误？点击右上角的撤销按钮。每局游戏可使用3次。'
            }
        ],
        tip: '💡 提示：将高数值方块集中在一个角落，更容易创造更大的数字！'
    }
};

const languageNames: Record<Language, string> = {
    ko: '한국어',
    en: 'English',
    ja: '日本語',
    zh: '中文'
};

const languageOrder: Language[] = ['ko', 'en', 'ja', 'zh'];

// Detect user's browser language and map to supported language
const detectLanguage = (): Language => {
    const browserLang = navigator.language || (navigator as any).userLanguage || 'en';
    const langCode = browserLang.toLowerCase().split('-')[0]; // e.g., 'ko-KR' -> 'ko'

    if (langCode === 'ko') return 'ko';
    if (langCode === 'ja') return 'ja';
    if (langCode === 'zh') return 'zh';
    return 'en'; // Default to English for all other languages
};

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const [currentLang, setCurrentLang] = useState<Language>(detectLanguage);

    if (!isOpen) return null;

    const currentContent = content[currentLang];
    const currentIndex = languageOrder.indexOf(currentLang);

    const prevLang = () => {
        const newIndex = (currentIndex - 1 + languageOrder.length) % languageOrder.length;
        setCurrentLang(languageOrder[newIndex]);
    };

    const nextLang = () => {
        const newIndex = (currentIndex + 1) % languageOrder.length;
        setCurrentLang(languageOrder[newIndex]);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl border border-white/50"
                style={{
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                }}
            >
                {/* Header */}
                <div className="relative px-6 py-5 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-white/10">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>

                    {/* Language Switcher */}
                    <div className="flex items-center justify-center gap-4 mb-3">
                        <button
                            onClick={prevLang}
                            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <ChevronLeft size={18} className="text-white" />
                        </button>
                        <span className="text-white font-medium text-sm px-3 py-1 bg-white/20 rounded-full min-w-[80px] text-center">
                            {languageNames[currentLang]}
                        </span>
                        <button
                            onClick={nextLang}
                            className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <ChevronRight size={18} className="text-white" />
                        </button>
                    </div>

                    <h2 className="text-2xl font-bold text-white text-center">
                        {currentContent.title}
                    </h2>
                    <p className="text-white/80 text-center text-sm mt-1">
                        {currentContent.subtitle}
                    </p>
                </div>

                {/* Content */}
                <div className="px-5 py-4 overflow-y-auto max-h-[calc(85vh-180px)]">
                    <div className="space-y-4">
                        {currentContent.sections.map((section, index) => (
                            <div
                                key={index}
                                className="p-4 rounded-2xl bg-white/80 shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-blue-500">{section.icon}</span>
                                    <h3 className="font-bold text-gray-800">{section.title}</h3>
                                </div>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    {section.content}
                                </p>
                            </div>
                        ))}
                    </div>

                    {/* Tip */}
                    <div className="mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50">
                        <p className="text-amber-800 text-sm font-medium">
                            {currentContent.tip}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black transition-all shadow-lg hover:shadow-xl active:scale-[0.98] border border-white/10"
                    >
                        {currentLang === 'ko' ? '확인' : currentLang === 'en' ? 'Got it!' : currentLang === 'ja' ? '了解' : '知道了'}
                    </button>
                </div>
            </div>

            <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
      `}</style>
        </div>
    );
};
