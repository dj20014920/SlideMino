import React from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone, Mouse, RotateCw, Undo2, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_CONFIGS, SUPPORTED_LANGUAGES, normalizeLanguage, type SupportedLanguage } from '../i18n/constants';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Language = SupportedLanguage;

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
        subtitle: '블록 슬라이드 (Block Slide) 플레이 방법',
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
                title: '⚡ 연속 스와이프 규칙',
                content: '스와이프에서 머지가 발생하면 같은 턴에서 계속 스와이프해야 합니다. 머지가 멈춘 순간에만 블록 배치 단계로 돌아갑니다.'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 블록 회전',
                content: '블록을 드래그하는 동안 빈 공간을 탭하거나 회전 버튼을 누르면 90도 회전합니다. PC는 R 키로도 회전할 수 있어요!'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ 되돌리기',
                content: '실수했다면 우측 상단의 되돌리기 버튼을 누르세요. 게임당 1회까지 사용할 수 있습니다.'
            }
        ],
        tip: '💡 팁: 높은 숫자 블록을 한쪽 구석에 모으면 더 큰 숫자를 만들기 쉬워요!'
    },
    en: {
        title: 'How to Play',
        subtitle: '블록 슬라이드 (Block Slide) Game Guide',
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
                title: '⚡ Swipe Chain Rule',
                content: 'If a swipe causes a merge, keep swiping in the same turn. You can place a block only after a swipe with no merge.'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 Rotate Blocks',
                content: 'While dragging, tap empty space or the rotate button to turn 90°. On desktop, press R.'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ Undo',
                content: 'Made a mistake? Tap the undo button at the top right. You can use it once per game.'
            }
        ],
        tip: '💡 Tip: Keep high-value blocks in one corner to build bigger numbers easily!'
    },
    ja: {
        title: '遊び方',
        subtitle: '블록 슬라이드 (Block Slide) ゲームガイド',
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
                title: '⚡ 連続スワイプ規則',
                content: 'スワイプで合体が発生した場合、そのターンはスワイプを継続します。合体しないスワイプが出たときだけ配置フェーズに戻ります。'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 ブロック回転',
                content: 'ドラッグ中に空いている場所をタップするか回転ボタンを押すと90度回転します。PCはRキーです。'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ 元に戻す',
                content: '間違えた場合は、右上の戻るボタンをタップしてください。1ゲームにつき1回まで使用できます。'
            }
        ],
        tip: '💡 ヒント：高い数字のブロックを一つの角に集めると、より大きな数字が作りやすくなります！'
    },
    zh: {
        title: '游戏说明',
        subtitle: '블록 슬라이드 (Block Slide) 玩法指南',
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
                title: '⚡ 连续滑动规则',
                content: '如果一次滑动产生了合并，本回合需要继续滑动。只有出现“无合并滑动”时，才会回到放置方块阶段。'
            },
            {
                icon: <RotateCw size={20} />,
                title: '🔄 旋转方块',
                content: '拖动时点击空白或旋转按钮即可旋转90度，桌面端按R。'
            },
            {
                icon: <Undo2 size={20} />,
                title: '↩️ 撤销',
                content: '操作失误？点击右上角的撤销按钮。每局游戏可使用1次。'
            }
        ],
        tip: '💡 提示：将高数值方块集中在一个角落，更容易创造更大的数字！'
    }
};

const languageOrder: Language[] = [...SUPPORTED_LANGUAGES];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const { i18n, t } = useTranslation();
    const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);

    if (!isOpen) return null;

    const currentContent = content[currentLang];
    const currentIndex = languageOrder.indexOf(currentLang);

    const prevLang = () => {
        const newIndex = (currentIndex - 1 + languageOrder.length) % languageOrder.length;
        i18n.changeLanguage(languageOrder[newIndex]);
    };

    const nextLang = () => {
        const newIndex = (currentIndex + 1) % languageOrder.length;
        i18n.changeLanguage(languageOrder[newIndex]);
    };

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
                className="relative w-full max-w-md max-h-[85vh] overflow-hidden rounded-3xl shadow-2xl border border-white/50 win98-window"
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
                            {LANGUAGE_CONFIGS[currentLang]?.displayName ?? currentLang}
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
                        {t('common:buttons.confirm')}
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
