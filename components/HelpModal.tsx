import React from 'react';
import { X, ChevronLeft, ChevronRight, Smartphone, Mouse, RotateCw, Undo2, Zap, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import { LANGUAGE_CONFIGS, SUPPORTED_LANGUAGES, normalizeLanguage, type SupportedLanguage } from '../i18n/constants';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

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
                title: '🎯 블록배치',
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
            },
            {
                icon: <AlertTriangle size={20} />,
                title: '⚠️ 새 게임 시작 안내',
                content: '일반 모드는 동시에 1개 세션만 저장됩니다. 새 게임을 시작하면 이전 일반 게임 이어하기 데이터가 덮어써집니다. 점수를 남기려면 먼저 랭킹 등록 또는 중간 저장을 완료하세요.'
            }
        ],
        tip: '💡 팁: 높은 숫자 블록을 한쪽 구석에 모으면 더 큰 숫자를 만들기 쉬워요!'
    },
    en: {
        title: 'How to Play',
        subtitle: 'Block Slide Game Guide',
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
            },
            {
                icon: <AlertTriangle size={20} />,
                title: '⚠️ Starting a New Run',
                content: 'Normal mode keeps only one resumable session at a time. Starting a new run overwrites the previous normal run. If you want to keep your score, submit ranking or use mid-save first.'
            }
        ],
        tip: '💡 Tip: Keep high-value blocks in one corner to build bigger numbers easily!'
    },
    ja: {
        title: '遊び方',
        subtitle: 'ブロック スライド（Block Slide）ゲームガイド',
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
            },
            {
                icon: <AlertTriangle size={20} />,
                title: '⚠️ 新しいゲーム開始の注意',
                content: '通常モードは同時に1つのセッションのみ保存されます。新しいゲームを開始すると、以前の通常プレイ再開データは上書きされます。スコアを残したい場合は、先にランキング登録または途中保存を行ってください。'
            }
        ],
        tip: '💡 ヒント：高い数字のブロックを一つの角に集めると、より大きな数字が作りやすくなります！'
    },
    zh: {
        title: '游戏说明',
        subtitle: 'Block Slide（方块滑动）玩法指南',
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
            },
            {
                icon: <AlertTriangle size={20} />,
                title: '⚠️ 开始新局说明',
                content: '普通模式同一时间只保留1个可续玩会话。开始新一局会覆盖上一局普通模式数据。若想保留分数，请先完成排行榜登记或中途保存。'
            }
        ],
        tip: '💡 提示：将高数值方块集中在一个角落，更容易创造更大的数字！'
    }
};

const languageOrder: Language[] = [...SUPPORTED_LANGUAGES];

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    const { i18n, t } = useTranslation();
    useBodyScrollLock(isOpen);
    const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
    const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
    const premiumUiWindowClassName = premiumUiObjects.windowClassName;
    const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
    const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
    const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
    const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
    const premiumUiSunkenClassName = premiumUiObjects.panels.sunkenClassName;
    const premiumUiBadgeClassName = premiumUiObjects.panels.badgeClassName;
    const premiumUiModalWindowClassName = premiumUiObjects.extended.windows.modalWindowClassName;
    const isPremiumUi = Boolean(isPremiumUiThemeActive);
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
        <div className={`fixed inset-0 z-[10000] flex items-center justify-center p-4 modal-safe-overlay ${isPremiumUi ? premiumUiModalOverlayClassName : 'bg-black/60 backdrop-blur-sm'} animate-fadeIn`}>
            <div
                className={isPremiumUi
                    ? `${premiumUiWindowClassName} ${premiumUiModalWindowClassName} relative w-full max-w-md max-h-[85vh] modal-safe-panel overflow-hidden flex flex-col`
                    : 'relative w-full max-w-md max-h-[85vh] modal-safe-panel overflow-hidden rounded-3xl shadow-2xl border border-white/50 flex flex-col'
                }
                style={isPremiumUi ? undefined : {
                    background: 'rgba(255, 255, 255, 0.85)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)',
                }}
            >
                {/* Header */}
                {isPremiumUi ? (
                    <>
                        <div className={premiumUiTitleBarClassName}>
                            <div className={premiumUiTitleBarTextClassName}>{currentContent.title}</div>
                            <div className={premiumUiTitleBarControlsClassName}>
                                <button aria-label="Close" onClick={onClose} />
                            </div>
                        </div>
                        <div className={`${premiumUiWindowBodyClassName} p-2`}>
                            <div className="flex items-center justify-center gap-3 mb-2">
                                <button onClick={prevLang} className="px-1">
                                    <ChevronLeft size={16} />
                                </button>
                                <span className={`text-xs font-semibold px-2 py-0.5 ${premiumUiBadgeClassName}`}>
                                    {LANGUAGE_CONFIGS[currentLang]?.displayName ?? currentLang}
                                </span>
                                <button onClick={nextLang} className="px-1">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <p className="text-xs text-center mb-2">
                                {currentContent.subtitle}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="relative px-6 py-5 bg-gradient-to-b from-gray-800 to-gray-900 border-b border-white/10">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
                        >
                            <X size={20} className="text-white" />
                        </button>
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
                )}

                {/* Content */}
                <div className={isPremiumUi ? 'px-2 py-2 overflow-y-auto max-h-[calc(85vh-140px)] modal-scroll-panel' : 'px-5 py-4 overflow-y-auto max-h-[calc(85vh-180px)] modal-scroll-panel'}>
                    <div className={isPremiumUi ? 'space-y-2' : 'space-y-4'}>
                        {currentContent.sections.map((section, index) => (
                            <div
                                key={index}
                                className={isPremiumUi
                                    ? `${premiumUiSunkenClassName} p-2`
                                    : 'p-4 rounded-2xl bg-white/80 shadow-sm border border-gray-100/50 hover:shadow-md transition-shadow'
                                }
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
                    <div className={isPremiumUi ? `mt-3 ${premiumUiSunkenClassName} p-2` : 'mt-5 p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/50'}>
                        <p className="text-amber-800 text-sm font-medium">
                            {currentContent.tip}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className={isPremiumUi ? 'px-2 py-2' : 'px-6 py-4 border-t border-gray-100'}>
                    <button
                        onClick={onClose}
                        className={isPremiumUi
                            ? 'w-full py-1.5 font-bold'
                            : 'w-full py-3 rounded-xl font-bold text-white bg-gradient-to-br from-gray-800 to-gray-900 hover:from-gray-900 hover:to-black transition-all shadow-lg hover:shadow-xl active:scale-[0.98] border border-white/10'
                        }
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
