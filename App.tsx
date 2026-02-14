import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LoadingScreen } from './components/LoadingScreen';
import { useTranslation } from 'react-i18next';
import { SplashScreen } from '@capacitor/splash-screen';
import {
  GameState,
  Grid,
  Piece,
  Phase,
  BoardSize,
  ShapeType,
  MergingTile
} from './types';
import {
  createEmptyGrid,
  generateRandomPiece,
  getRotatedCells,
  canPlacePiece,
  placePieceOnGrid,
  getTurnActionAvailability,
  slideGrid,
  hasPossibleMoves
} from './services/gameLogic';
import { Board, type BoardHandle } from './components/Board';
import { Slot } from './components/Slot';
import { BlockCustomizationModal } from './components/BlockCustomizationModal';
import { Undo2, Home, RotateCw, Move, Palette, Lock, Trophy, HelpCircle, RotateCcw } from 'lucide-react';

import { GameOverModal } from './components/GameOverModal';
import { GameModeTutorial } from './components/GameModeTutorial';
import { LeaderboardModal } from './components/LeaderboardModal';
import { NameInputModal } from './components/NameInputModal';
import { ActiveGameExitModal, type ActiveGameExitContext } from './components/ActiveGameExitModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import AdBanner from './components/AdBanner';
import { CookieConsent } from './components/CookieConsent';
import { HelpModal } from './components/HelpModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { BOARD_CELL_GAP_PX, SLIDE_UNLOCK_BUFFER_MS, getSlideAnimationDurationMs } from './constants';
import { useBlockCustomization } from './context/BlockCustomizationContext';
import { saveGameState, loadGameState, clearGameState, hasActiveGame, type SavedGameState } from './services/gameStorage';
import { rankingService, type RankEntry, type LiveRankEstimate } from './services/rankingService';
import { getCurrentRoute, onRouteChange, updatePageMeta, type Route } from './utils/routing';
import { isNativeApp, isAppIntoS, isAndroidApp } from './utils/platform';
import { normalizeLanguage } from './i18n/constants';
import { openNativePrivacyOptionsForm, isVirtualDevice } from './services/admob';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import About from './pages/About';
import Contact from './pages/Contact';
import { rewardAdService } from './services/rewardAdService';
import { rewardInterstitialAdService } from './services/rewardInterstitialAdService';
import { isRewardAdSupported, isRewardInterstitialAdSupported } from './services/adConfig';
import { REWARD_UNDO_AMOUNT } from './constants';
import { normalizePlayerName, validatePlayerName } from './utils/playerName';

declare global {
  interface Window {
    __slideMinoSimQaTapReviveAd?: () => void;
  }
}

const EMPTY_TILE_VALUE_OVERRIDES: Record<string, number> = {};
const EMPTY_MERGING_TILES: MergingTile[] = [];
const DRAG_OVERLAY_SCALE = 1;

// Undo 시스템: 직전 상태를 저장하기 위한 스냅샷 인터페이스
interface GameSnapshot {
  grid: Grid;
  slots: (Piece | null)[];
  score: number;
  phase: Phase;
  canSkipSlide: boolean;
}

interface ActiveGameRankingSnapshot {
  sessionId: string;
  score: number;
  difficulty: string;
  duration: number;
  moves: number;
  playerName: string;
}

const cloneGameSnapshot = (snapshot: GameSnapshot): GameSnapshot => ({
  grid: snapshot.grid.map((row) => row.map((tile) => (tile ? { ...tile } : null))),
  slots: snapshot.slots.map((piece) => (piece ? { ...piece, cells: [...piece.cells] } : null)),
  score: snapshot.score,
  phase: snapshot.phase,
  canSkipSlide: snapshot.canSkipSlide,
});

const getReusablePlayerName = (candidate: string | null | undefined): string | null => {
  const normalized = normalizePlayerName(candidate ?? '');
  const errorKey = validatePlayerName(normalized);
  return errorKey ? null : normalized;
};

const loadInitialPlayerName = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return getReusablePlayerName(rankingService.getSavedName()) ?? '';
  } catch {
    return '';
  }
};

interface BoardMetrics {
  rectLeft: number;
  rectTop: number;
  paddingLeft: number;
  paddingTop: number;
  innerWidth: number;
  innerHeight: number;
  cell: number;
  pitch: number;
  size: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

interface GameLayoutProfile {
  columnMaxWidthPx: number;
  columnWidthPx: number;
  boardScaleMultiplier: number;
  boardScaleCeiling: number;
  mainGapPx: number;
  mainTopPaddingPx: number;
  mainBottomPaddingPx: number;
}

interface LayoutChromeHeights {
  header: number;
  banner: number;
}

interface OrientationLockMessage {
  title: string;
  body: string;
}

const DEFAULT_LAYOUT_CHROME_HEIGHTS: LayoutChromeHeights = {
  header: 104,
  banner: 72,
};

const ORIENTATION_LOCK_MESSAGES: Record<string, OrientationLockMessage> = {
  ko: {
    title: '세로 모드로 전환해 주세요',
    body: 'SlideMino는 가로 모드를 지원하지 않습니다.',
  },
  en: {
    title: 'Please rotate to portrait mode',
    body: 'SlideMino does not support landscape mode.',
  },
  ja: {
    title: '縦向きにしてください',
    body: 'SlideMino は横向きモードに対応していません。',
  },
  zh: {
    title: '请切换为竖屏',
    body: 'SlideMino 不支持横屏模式。',
  },
};

const LEGACY_PORTRAIT_ASPECT = 16 / 9;
const MODERN_PHONE_PORTRAIT_ASPECT = 19.5 / 9;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const lerp = (from: number, to: number, t: number): number => from + (to - from) * t;

const getViewportSize = (): ViewportSize => {
  if (typeof window === 'undefined') {
    return { width: 390, height: 844 };
  }
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
};

const getGameLayoutProfile = (
  { width, height }: ViewportSize,
  chromeHeights: LayoutChromeHeights = DEFAULT_LAYOUT_CHROME_HEIGHTS
): GameLayoutProfile => {
  const safeWidth = Math.max(240, Math.round(width));
  const safeHeight = Math.max(320, Math.round(height));
  const portraitAspect = safeHeight / safeWidth;
  const isLandscape = safeWidth > safeHeight;

  const tallProgress = clamp(
    (portraitAspect - LEGACY_PORTRAIT_ASPECT) / (MODERN_PHONE_PORTRAIT_ASPECT - LEGACY_PORTRAIT_ASPECT),
    0,
    1
  );
  const ultraTallBoost = clamp((portraitAspect - MODERN_PHONE_PORTRAIT_ASPECT) / 0.24, 0, 1);
  const shortPenalty = clamp((LEGACY_PORTRAIT_ASPECT - portraitAspect) / 0.24, 0, 1);

  const boardScaleMultiplier = clamp(
    lerp(0.95, 1.02, tallProgress) + ultraTallBoost * 0.02 - shortPenalty * 0.05,
    0.88,
    1.04
  );
  const mainGapPx = Math.round(clamp(lerp(12, 22, tallProgress) * (isLandscape ? 0.58 : 1), 8, 24));
  const whitespacePx = clamp(safeHeight * lerp(0.07, 0.14, tallProgress) * (isLandscape ? 0.34 : 1), 10, 96);
  const columnMaxWidthPx = safeWidth >= 1440 ? 620 : safeWidth >= 1024 ? 560 : safeWidth >= 768 ? 500 : 448;
  const shouldHeightLimitColumn = isLandscape && safeHeight < 760;
  const heightLimitedColumnMaxPx = shouldHeightLimitColumn
    ? Math.max(220, Math.floor(safeHeight * 0.58))
    : Number.POSITIVE_INFINITY;
  const columnWidthPx = Math.min(columnMaxWidthPx, safeWidth, heightLimitedColumnMaxPx);
  const contentWidthPx = Math.max(180, columnWidthPx - 32);
  const rawSlotHeightPx = Math.max(42, (contentWidthPx - 32) / 3);
  const slotHeightPx = shouldHeightLimitColumn
    ? Math.min(rawSlotHeightPx, safeHeight * 0.17)
    : rawSlotHeightPx;
  const mainTopPaddingPx = Math.round(whitespacePx * 0.45);
  const mainBottomPaddingPx = Math.round(whitespacePx * 0.55);
  const measuredHeaderHeightPx = clamp(chromeHeights.header, 56, 180);
  const measuredBottomAdHeightPx = clamp(chromeHeights.banner, 0, 160);
  const availableMainHeightPx = Math.max(180, safeHeight - measuredHeaderHeightPx - measuredBottomAdHeightPx);
  const boardHeightBudgetPx =
    availableMainHeightPx - slotHeightPx - mainGapPx - mainTopPaddingPx - mainBottomPaddingPx;
  const boardScaleCeiling = clamp(
    Math.min(contentWidthPx, boardHeightBudgetPx) / 420,
    0.42,
    1.04
  );

  return {
    columnMaxWidthPx,
    columnWidthPx,
    boardScaleMultiplier,
    boardScaleCeiling,
    mainGapPx,
    mainTopPaddingPx,
    mainBottomPaddingPx,
  };
};

const getOrientationLockMessage = (language: string): OrientationLockMessage => {
  const normalized = normalizeLanguage(language);
  if (normalized.startsWith('ko')) return ORIENTATION_LOCK_MESSAGES.ko;
  if (normalized.startsWith('ja')) return ORIENTATION_LOCK_MESSAGES.ja;
  if (normalized.startsWith('zh')) return ORIENTATION_LOCK_MESSAGES.zh;
  return ORIENTATION_LOCK_MESSAGES.en;
};

const App: React.FC = () => {
  // --- i18n ---
  const { t, i18n } = useTranslation();
  const tagline = String(t('game:tagline'));

  // --- Routing State ---
  const [currentRoute, setCurrentRoute] = useState<Route>(getCurrentRoute());
  const isNative = isNativeApp();
  const isAppIntoSBuild = isAppIntoS();

  useEffect(() => {
    document.documentElement.lang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  }, [i18n.language, i18n.resolvedLanguage]);

  // 앱인토스 빌드 시 body에 클래스 추가 (safe area 활성화)
  useEffect(() => {
    if (isAppIntoSBuild) {
      document.body.classList.add('appintos-build');
    }
    return () => {
      document.body.classList.remove('appintos-build');
    };
  }, [isAppIntoSBuild]);

  // 게임 화면 전용 안전 상단 여백 계산 (노치/카메라/상단바 대응)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;
    const isAndroid = isAndroidApp();
    const minTopPx = isAndroid ? 16 : 8;

    const readSafeTopPx = () => {
      const raw = getComputedStyle(root).getPropertyValue('--app-safe-top');
      const parsed = Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const updateGameSafeTop = () => {
      const safeTop = readSafeTopPx();
      const visualTop = window.visualViewport?.offsetTop ?? 0;
      const nextTop = Math.max(minTopPx, safeTop, visualTop);
      root.style.setProperty('--game-safe-top', `${nextTop}px`);
    };

    updateGameSafeTop();
    window.addEventListener('resize', updateGameSafeTop);
    window.addEventListener('orientationchange', updateGameSafeTop);
    window.visualViewport?.addEventListener('resize', updateGameSafeTop);
    return () => {
      window.removeEventListener('resize', updateGameSafeTop);
      window.removeEventListener('orientationchange', updateGameSafeTop);
      window.visualViewport?.removeEventListener('resize', updateGameSafeTop);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateViewportSize = () => {
      setViewportSize((prev) => {
        const next = getViewportSize();
        const widthChanged = Math.abs(prev.width - next.width) > 0.5;
        const heightChanged = Math.abs(prev.height - next.height) > 0.5;
        if (!widthChanged && !heightChanged) return prev;
        return next;
      });
    };

    updateViewportSize();
    window.addEventListener('resize', updateViewportSize);
    window.addEventListener('orientationchange', updateViewportSize);
    window.visualViewport?.addEventListener('resize', updateViewportSize);
    window.visualViewport?.addEventListener('scroll', updateViewportSize);

    return () => {
      window.removeEventListener('resize', updateViewportSize);
      window.removeEventListener('orientationchange', updateViewportSize);
      window.visualViewport?.removeEventListener('resize', updateViewportSize);
      window.visualViewport?.removeEventListener('scroll', updateViewportSize);
    };
  }, []);

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const { gate: customizationGate, resolveTileAppearance } = useBlockCustomization();
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);

  // Hide Capacitor Splash Screen immediately
  useEffect(() => {
    SplashScreen.hide().catch(() => {
      // 웹 환경에서는 에러가 발생할 수 있으므로 무시
    });
  }, []);

  // 랭킹 오프라인 큐 자동 동기화
  useEffect(() => {
    rankingService.initSync();
  }, []);

  // Fake loading delay for the premium feel
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid(8));
  const [slots, setSlots] = useState<(Piece | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<Phase>(Phase.PLACE);
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(getViewportSize);
  const [layoutChromeHeights, setLayoutChromeHeights] = useState<LayoutChromeHeights>(DEFAULT_LAYOUT_CHROME_HEIGHTS);
  const [, setComboMessage] = useState<string | null>(null);
  const isLandscapeViewport = viewportSize.width > viewportSize.height;
  const isTouchLikeWeb = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  }, [viewportSize.width, viewportSize.height]);
  const shouldBlockLandscapeOnWeb = !isNative && isTouchLikeWeb;
  const shouldShowPortraitLockOverlay = shouldBlockLandscapeOnWeb && isLandscapeViewport;
  const orientationLockMessage = useMemo(
    () => getOrientationLockMessage(i18n.resolvedLanguage ?? i18n.language ?? 'en'),
    [i18n.language, i18n.resolvedLanguage]
  );

  useEffect(() => {
    if (!shouldBlockLandscapeOnWeb) return;
    if (typeof screen === 'undefined') return;
    const orientationApi = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'portrait') => Promise<void>;
    };
    if (!orientationApi.lock) return;

    orientationApi.lock('portrait').catch(() => {
      // 브라우저 정책(사용자 제스처/전체화면 요구)으로 실패할 수 있음.
      // 실패 시에는 가로모드 차단 오버레이로 UX를 보장한다.
    });
  }, [shouldBlockLandscapeOnWeb, viewportSize.width, viewportSize.height]);

  const gameLayoutProfile = useMemo(
    () => getGameLayoutProfile(viewportSize, layoutChromeHeights),
    [viewportSize, layoutChromeHeights]
  );

  const baseBoardScale = useMemo(() => {
    switch (boardSize) {
      case 4:
        return 0.82;
      case 5:
        return 0.88;
      case 7:
        return 0.94;
      default:
        return 1;
    }
  }, [boardSize]);

  const boardScale = useMemo(() => {
    const scaled = baseBoardScale * gameLayoutProfile.boardScaleMultiplier;
    return Math.min(scaled, gameLayoutProfile.boardScaleCeiling);
  }, [baseBoardScale, gameLayoutProfile.boardScaleMultiplier, gameLayoutProfile.boardScaleCeiling]);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Name Input State
  const [isNameInputOpen, setIsNameInputOpen] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string>(loadInitialPlayerName);
  const [showActiveGameWarning, setShowActiveGameWarning] = useState(false);
  const [isActiveGameExitModalOpen, setIsActiveGameExitModalOpen] = useState(false);
  const [activeGameExitContext, setActiveGameExitContext] = useState<ActiveGameExitContext>('HOME');
  const [activeGameRankingSnapshot, setActiveGameRankingSnapshot] = useState<ActiveGameRankingSnapshot | null>(null);

  // 슬라이드 단계에서의 배치 허용 플래그(현재 룰에서는 항상 false를 유지)
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // Undo 시스템: 직전 스냅샷과 남은 사용 횟수
  const [lastSnapshot, setLastSnapshot] = useState<GameSnapshot | null>(null);
  const [undoRemaining, setUndoRemaining] = useState(3);

  // Merging tiles for animation (tiles being absorbed)
  const [mergingTiles, setMergingTiles] = useState<MergingTile[]>(EMPTY_MERGING_TILES);

  // Tutorial State: 0=Off, 1=Drag, 2=Swipe
  const [tutorialStep, setTutorialStep] = useState<number>(0);
  const [tutorialResetKey, setTutorialResetKey] = useState(0);

  // Help Modal
  const [showHelpModal, setShowHelpModal] = useState(false);

  // 🆕 Reward Ad State
  const [isAdReady, setIsAdReady] = useState(false);
  const [isReviveAdReady, setIsReviveAdReady] = useState(false);
  const [isReviveAdInProgress, setIsReviveAdInProgress] = useState(false);
  const [hasUsedReviveThisRun, setHasUsedReviveThisRun] = useState(false);
  const [isSimulatorQaEnabled, setIsSimulatorQaEnabled] = useState(false);
  const [showSimulatorQaPanel, setShowSimulatorQaPanel] = useState(false);
  const [simulatorQaStatus, setSimulatorQaStatus] = useState<string | null>(null);

  // Check tutorial status on load
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted) {
      setTutorialStep(1); // Start with Drag tutorial
    }
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!isNativeApp()) return;

    let isCancelled = false;
    isVirtualDevice()
      .then((isVirtual) => {
        if (!isCancelled) {
          setIsSimulatorQaEnabled(isVirtual);
          if (isVirtual) {
            setShowSimulatorQaPanel(true);
            try {
              localStorage.setItem('slidemino_skip_att_for_qa', '1');
            } catch {
              // ignore
            }
          }
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIsSimulatorQaEnabled(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);


  // Animation Lock
  const [isAnimating, setIsAnimating] = useState(false);
  const [tileValueOverrides, setTileValueOverrides] = useState<Record<string, number>>(EMPTY_TILE_VALUE_OVERRIDES);

  // --- Dragging State ---
  const [draggingPiece, setDraggingPiece] = useState<Piece | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState<number>(-1);
  const [pressedSlotIndex, setPressedSlotIndex] = useState<number>(-1);

  // --- Refs ---
  const headerRef = useRef<HTMLElement>(null);
  const bottomBannerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const boardHandleRef = useRef<BoardHandle | null>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null); // 드래그 오버레이 직접 제어용 Ref
  const gameStartTimeRef = useRef<number>(Date.now()); // Anti-cheat timer
  const moveCountRef = useRef<number>(0); // Anti-cheat move counter
  const sessionIdRef = useRef<string>(crypto.randomUUID()); // 게임 세션 ID
  const [liveRankEstimate, setLiveRankEstimate] = useState<LiveRankEstimate | null>(null); // 게임 중 예상 순위

  const boardMetricsRef = useRef<BoardMetrics | null>(null);
  const leaderboardSnapshotRef = useRef<RankEntry[]>([]);
  const hoverGridPosRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number, y: number } | null>(null); // 스와이프 시작 좌표
  const slideLockRef = useRef(false); // state 반영 전에도 즉시 입력 차단
  const mergeClearTimeoutRef = useRef<number | null>(null);
  const mergeFinalizeTimeoutRef = useRef<number | null>(null);
  const unlockTimeoutRef = useRef<number | null>(null);
  const comboMessageTimeoutRef = useRef<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const currentPointerPosRef = useRef<{ x: number, y: number } | null>(null);
  const reviveSnapshotRef = useRef<GameSnapshot | null>(null);
  const scoreRef = useRef<number>(score);
  const boardSizeRef = useRef<BoardSize>(boardSize);
  const simulatorAutoProbeRunRef = useRef(false);
  const simulatorAutoGameOverTriggeredRef = useRef(false);
  const simulatorAutoReviveTriggeredRef = useRef(false);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    boardSizeRef.current = boardSize;
  }, [boardSize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (gameState !== GameState.PLAYING && gameState !== GameState.GAME_OVER) return;

    const updateChromeHeights = () => {
      const measuredHeader = headerRef.current?.getBoundingClientRect().height;
      const measuredBanner = bottomBannerRef.current?.getBoundingClientRect().height;

      setLayoutChromeHeights((prev) => {
        const nextHeader = measuredHeader ? Math.max(56, measuredHeader) : prev.header;
        const nextBanner = measuredBanner ? Math.max(0, measuredBanner) : prev.banner;
        const headerChanged = Math.abs(prev.header - nextHeader) > 0.5;
        const bannerChanged = Math.abs(prev.banner - nextBanner) > 0.5;
        if (!headerChanged && !bannerChanged) return prev;
        return { header: nextHeader, banner: nextBanner };
      });
    };

    updateChromeHeights();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(updateChromeHeights);
      if (headerRef.current) observer.observe(headerRef.current);
      if (bottomBannerRef.current) observer.observe(bottomBannerRef.current);
    }

    window.addEventListener('resize', updateChromeHeights);
    window.visualViewport?.addEventListener('resize', updateChromeHeights);
    window.visualViewport?.addEventListener('scroll', updateChromeHeights);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateChromeHeights);
      window.visualViewport?.removeEventListener('resize', updateChromeHeights);
      window.visualViewport?.removeEventListener('scroll', updateChromeHeights);
    };
  }, [gameState]);

  // --- Initialization ---

  // 라우팅 설정
  useEffect(() => {
    // 초기 라우트 메타데이터 설정
    updatePageMeta(currentRoute);

    // 라우트 변경 리스너 등록
    const unsubscribe = onRouteChange((route) => {
      setCurrentRoute(route);
      updatePageMeta(route);
      // 정적 페이지로 이동 시 스크롤 최상단으로
      if (route !== '/') {
        window.scrollTo(0, 0);
      }
    });

    return unsubscribe;
  }, []);

  const restoreSavedGame = useCallback((saved: SavedGameState) => {
    setGameState(saved.gameState);
    setGrid(saved.grid);
    setSlots(saved.slots);
    setScore(saved.score);
    setPhase(saved.phase);
    setBoardSize(saved.boardSize);
    // 구버전 저장 데이터 정규화: 이어하기/자동복원 모두 동일한 규칙 적용.
    setCanSkipSlide(false);
    const restoredSnapshot = saved.lastSnapshot ? cloneGameSnapshot(saved.lastSnapshot) : null;
    setLastSnapshot(restoredSnapshot);
    setUndoRemaining(saved.undoRemaining);
    setHasUsedReviveThisRun(Boolean(saved.hasUsedRevive));
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    reviveSnapshotRef.current = null;
    leaderboardSnapshotRef.current = [];
    setLiveRankEstimate(null);
    setPlayerName(
      getReusablePlayerName(saved.playerName) ??
      getReusablePlayerName(rankingService.getSavedName()) ??
      ''
    );
    sessionIdRef.current = saved.sessionId ?? crypto.randomUUID();
    moveCountRef.current = typeof saved.moveCount === 'number' ? saved.moveCount : 0;
    gameStartTimeRef.current = typeof saved.startedAt === 'number' ? saved.startedAt : saved.savedAt;
  }, []);

  // 앱 시작 시 저장된 게임 복원
  useEffect(() => {
    const saved = loadGameState();
    if (saved) {
      // 저장된 복구 상태(진행중/게임오버)가 있으면 즉시 복원
      restoreSavedGame(saved);
    }
  }, [restoreSavedGame]);

  const persistRecoverableGameState = useCallback(() => {
    if (gameState !== GameState.PLAYING && gameState !== GameState.GAME_OVER) return;

    saveGameState({
      gameState,
      grid,
      slots,
      score,
      phase,
      boardSize,
      canSkipSlide,
      undoRemaining,
      lastSnapshot,
      hasUsedRevive: hasUsedReviveThisRun,
      sessionId: sessionIdRef.current,
      moveCount: moveCountRef.current,
      startedAt: gameStartTimeRef.current,
      playerName,
    });
  }, [gameState, grid, slots, score, phase, boardSize, canSkipSlide, undoRemaining, lastSnapshot, hasUsedReviveThisRun, playerName]);

  // 게임 상태 자동 저장 (debounce + 종료 직전 플러시)
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      // 500ms debounce로 과도한 localStorage 저장 방지
      const saveTimer = setTimeout(() => {
        persistRecoverableGameState();
      }, 500);

      return () => clearTimeout(saveTimer);
    }

    if (gameState === GameState.GAME_OVER) {
      // 게임오버 즉시 저장: 앱 종료/업데이트 후에도 랭킹 등록을 이어갈 수 있어야 한다.
      persistRecoverableGameState();
    }
  }, [gameState, persistRecoverableGameState]);

  useEffect(() => {
    const flushRecoverableState = () => {
      persistRecoverableGameState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushRecoverableState();
      }
    };

    window.addEventListener('pagehide', flushRecoverableState);
    window.addEventListener('beforeunload', flushRecoverableState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushRecoverableState);
      window.removeEventListener('beforeunload', flushRecoverableState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistRecoverableGameState]);

  useEffect(() => {
    const shouldLockScroll = gameState !== GameState.MENU;
    document.body.classList.toggle('scroll-locked', shouldLockScroll);
    if (shouldLockScroll) {
      window.scrollTo(0, 0);
    }
    return () => {
      document.body.classList.remove('scroll-locked');
    };
  }, [gameState]);

  // 메인 화면으로 돌아가기 (게임 상태 유지)
  const goToMenu = useCallback(() => {
    // 현재 게임 상태는 이미 자동 저장되어 있으므로 메뉴로만 이동
    setGameState(GameState.MENU);
    // 드래그 상태 정리
    setDraggingPiece(null);
    setDragOriginIndex(-1);
    boardMetricsRef.current = null;
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const buildActiveGameRankingSnapshot = useCallback((): ActiveGameRankingSnapshot | null => {
    const now = Date.now();

    if (gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) {
      const elapsedSeconds = Math.max(1, Math.floor((now - gameStartTimeRef.current) / 1000));
      return {
        sessionId: sessionIdRef.current,
        score,
        difficulty: `${boardSize}x${boardSize}`,
        duration: elapsedSeconds,
        moves: moveCountRef.current,
        playerName,
      };
    }

    const saved = loadGameState();
    if (!saved) return null;
    const startedAt = typeof saved.startedAt === 'number' ? saved.startedAt : saved.savedAt;
    const elapsedSeconds = Math.max(1, Math.floor((now - startedAt) / 1000));

    return {
      sessionId: saved.sessionId ?? sessionIdRef.current,
      score: saved.score,
      difficulty: `${saved.boardSize}x${saved.boardSize}`,
      duration: elapsedSeconds,
      moves: typeof saved.moveCount === 'number' ? saved.moveCount : 0,
      playerName: saved.playerName ?? playerName,
    };
  }, [gameState, score, boardSize, playerName]);

  const resolveReusablePlayerName = useCallback((): string | null => {
    return getReusablePlayerName(playerName) ?? getReusablePlayerName(rankingService.getSavedName());
  }, [playerName]);

  const startGameWithReusableNameOrPrompt = useCallback((size: BoardSize) => {
    const reusableName = resolveReusablePlayerName();
    if (reusableName) {
      setPlayerName(reusableName);
      rankingService.saveName(reusableName);
      startGame(size);
      setPendingDifficulty(null);
      setIsNameInputOpen(false);
      setShowActiveGameWarning(false);
      return;
    }

    setShowActiveGameWarning(false);
    setPendingDifficulty(size);
    setIsNameInputOpen(true);
  }, [resolveReusablePlayerName, startGame]);

  const openActiveGameExitModal = useCallback((context: ActiveGameExitContext, nextDifficulty?: BoardSize) => {
    const snapshot = buildActiveGameRankingSnapshot();
    if (!snapshot) {
      if (context === 'HOME') {
        goToMenu();
        return;
      }
      if (typeof nextDifficulty === 'number') {
        startGameWithReusableNameOrPrompt(nextDifficulty as BoardSize);
      }
      return;
    }

    if (typeof nextDifficulty === 'number') {
      setPendingDifficulty(nextDifficulty);
    }
    setActiveGameExitContext(context);
    setActiveGameRankingSnapshot(snapshot);
    setIsActiveGameExitModalOpen(true);
  }, [buildActiveGameRankingSnapshot, goToMenu, startGameWithReusableNameOrPrompt]);

  const handleGameOverClose = useCallback(() => {
    // 게임오버 결과 확인을 마치고 메뉴로 돌아갈 때 복구 상태를 정리한다.
    clearGameState();
    setGameState(GameState.MENU);
  }, []);

  const handleHomeButtonClick = useCallback(() => {
    if (gameState === GameState.PLAYING) {
      openActiveGameExitModal('HOME');
      return;
    }
    goToMenu();
  }, [gameState, goToMenu, openActiveGameExitModal]);

  const handleActiveGameExitCancel = useCallback(() => {
    if (activeGameExitContext === 'NEW_GAME') {
      setPendingDifficulty(null);
    }
    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);
  }, [activeGameExitContext]);

  const handleActiveGameExitProceedWithoutRegister = useCallback(() => {
    const context = activeGameExitContext;
    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);

    if (context === 'HOME') {
      goToMenu();
      return;
    }

    if (typeof pendingDifficulty === 'number') {
      startGameWithReusableNameOrPrompt(pendingDifficulty as BoardSize);
      return;
    }

    setShowActiveGameWarning(false);
    setIsNameInputOpen(true);
  }, [activeGameExitContext, goToMenu, pendingDifficulty, startGameWithReusableNameOrPrompt]);

  const handleActiveGameExitRegisteredAndProceed = useCallback(() => {
    const context = activeGameExitContext;
    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);
    clearGameState();

    if (context === 'HOME') {
      goToMenu();
      return;
    }

    if (typeof pendingDifficulty === 'number') {
      startGameWithReusableNameOrPrompt(pendingDifficulty as BoardSize);
      return;
    }

    setShowActiveGameWarning(false);
    setIsNameInputOpen(true);
  }, [activeGameExitContext, goToMenu, pendingDifficulty, startGameWithReusableNameOrPrompt]);

  // 난이도 선택 시 진행중 게임 경고 -> 이름 입력 모달
  const tryStartGame = useCallback((size: BoardSize) => {
    const active = hasActiveGame() && (gameState === GameState.MENU || boardSize !== size);
    if (active) {
      openActiveGameExitModal('NEW_GAME', size);
      return;
    }

    startGameWithReusableNameOrPrompt(size);
  }, [gameState, boardSize, openActiveGameExitModal, startGameWithReusableNameOrPrompt]);

  const handleNameSubmit = (name: string) => {
    if (pendingDifficulty) {
      setPlayerName(name);
      rankingService.saveName(name);
      startGame(pendingDifficulty as BoardSize);
      setIsNameInputOpen(false);
      setPendingDifficulty(null);
      setShowActiveGameWarning(false);
    }
  };

  function startGame(size: BoardSize) {
    // 새 게임 시작 시 이전 게임 복구 데이터는 폐기한다.
    clearGameState();

    if (mergeClearTimeoutRef.current) {
      window.clearTimeout(mergeClearTimeoutRef.current);
      mergeClearTimeoutRef.current = null;
    }
    if (mergeFinalizeTimeoutRef.current) {
      window.clearTimeout(mergeFinalizeTimeoutRef.current);
      mergeFinalizeTimeoutRef.current = null;
    }
    if (unlockTimeoutRef.current) {
      window.clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }

    setBoardSize(size);
    setGrid(createEmptyGrid(size));
    setSlots([generateRandomPiece(), generateRandomPiece(), generateRandomPiece()]);
    setScore(0);
    setMergingTiles(EMPTY_MERGING_TILES);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    slideLockRef.current = false;
    setIsAnimating(false);
    setPhase(Phase.PLACE);
    setGameState(GameState.PLAYING);
    setComboMessage(null);
    setCanSkipSlide(false);
    // Undo 초기화
    setLastSnapshot(null);
    setUndoRemaining(3);
    setHasUsedReviveThisRun(false);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    reviveSnapshotRef.current = null;

    // Anti-cheat: Start Timer & Session ID
    gameStartTimeRef.current = Date.now();
    moveCountRef.current = 0;
    sessionIdRef.current = crypto.randomUUID(); // 새 게임마다 고유 세션 ID 생성
    leaderboardSnapshotRef.current = [];
    setLiveRankEstimate(null); // 순위 표시 초기화

    // 온보딩: 튜토리얼 미완료 시 활성화
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted) {
      setTutorialStep(1);
    } else {
      setTutorialStep(0);
    }
  }

  // --- Undo 시스템 ---

  // 현재 상태를 스냅샷으로 저장 (행동 실행 전 호출)
  const saveSnapshot = useCallback(() => {
    setLastSnapshot({
      grid: grid.map(row => row.map(tile => tile ? { ...tile } : null)),
      slots: slots.map(p => p ? { ...p, cells: [...p.cells] } : null),
      score,
      phase,
      canSkipSlide
    });
  }, [grid, slots, score, phase, canSkipSlide]);

  const showComboMessage = useCallback((message: string, durationMs = 1600) => {
    setComboMessage(message);
    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }
    comboMessageTimeoutRef.current = window.setTimeout(() => {
      setComboMessage(null);
      comboMessageTimeoutRef.current = null;
    }, durationMs);
  }, []);

  // Undo 실행: 직전 스냅샷으로 복원
  const executeUndo = useCallback(() => {
    if (!lastSnapshot || undoRemaining <= 0 || isAnimating) return;

    // 스냅샷에서 상태 복원
    setGrid(lastSnapshot.grid);
    setSlots(lastSnapshot.slots);
    setScore(lastSnapshot.score);
    setPhase(lastSnapshot.phase);
    setCanSkipSlide(lastSnapshot.canSkipSlide);

    // 사용 횟수 차감 및 스냅샷 초기화 (연속 Undo 방지)
    setUndoRemaining(prev => prev - 1);
    setLastSnapshot(null);
    if (comboMessageTimeoutRef.current) {
      window.clearTimeout(comboMessageTimeoutRef.current);
      comboMessageTimeoutRef.current = null;
    }
    setComboMessage(null);

    // 애니메이션 관련 상태 정리
    setMergingTiles(EMPTY_MERGING_TILES);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
  }, [lastSnapshot, undoRemaining, isAnimating]);

  // 🆕 리워드 광고 시청 핸들러
  const handleWatchRewardAd = useCallback(() => {
    rewardAdService.showRewardAd({
      onRewardEarned: (amount) => {
        // 🎯 보상 지급: 되돌리기 횟수 충전
        const actualAmount = amount || REWARD_UNDO_AMOUNT;
        setUndoRemaining(prev => Math.min(prev + actualAmount, 99)); // 최대 99회 제한

        // 사용자에게 알림 (다국어)
        showComboMessage(String(t('game:rewardAd.rewardEarned', { amount: actualAmount } as any)), 2000);

        console.log(`[App] 리워드 지급 완료: +${actualAmount}회`);
      },
      onAdClosed: () => {
        console.log('[App] 광고 닫힘');
        // 광고 로드 상태 업데이트
        setIsAdReady(rewardAdService.isAdReady());
      },
      onError: (error) => {
        console.error('[App] 광고 오류:', error);
        // 다국어 에러 메시지
        alert(t('game:rewardAd.error'));
      },
      onDailyLimitReached: () => {
        // 일일 한도 도달 알림
        alert(t('game:rewardAd.dailyLimitReached'));
      },
    });
  }, [t, showComboMessage]);

  const handleWatchReviveAd = useCallback(() => {
    if (isReviveAdInProgress) return;

    const reviveSnapshot = reviveSnapshotRef.current;
    if (!reviveSnapshot) {
      alert(t('modals:gameOver.reviveUnavailable'));
      return;
    }

    setIsReviveAdInProgress(true);

    rewardInterstitialAdService.showReviveAd({
      onRewardEarned: () => {
        const snapshot = reviveSnapshotRef.current;
        if (!snapshot) {
          setIsReviveAdInProgress(false);
          alert(t('modals:gameOver.reviveUnavailable'));
          return;
        }

        // 부활: 게임오버 직전 1수 전 스냅샷으로 복구
        setGrid(snapshot.grid);
        setSlots(snapshot.slots);
        setScore(snapshot.score);
        setPhase(snapshot.phase);
        setCanSkipSlide(snapshot.canSkipSlide);

        setMergingTiles(EMPTY_MERGING_TILES);
        setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
        slideLockRef.current = false;
        setIsAnimating(false);
        setLastSnapshot(null);

        setGameState(GameState.PLAYING);
        setHasUsedReviveThisRun(true);
        setIsReviveAdInProgress(false);
        reviveSnapshotRef.current = null;
        if (import.meta.env.DEV && isSimulatorQaEnabled) {
          setSimulatorQaStatus('자동 QA: 부활 성공, 게임 복귀 완료');
        }
        showComboMessage(String(t('modals:gameOver.reviveSuccess')), 1800);
      },
      onAdClosed: () => {
        setIsReviveAdInProgress(false);
        setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
      },
      onError: (error) => {
        console.error('[App] 보상형 전면 광고 오류:', error);
        setIsReviveAdInProgress(false);
        setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
        if (import.meta.env.DEV && isSimulatorQaEnabled) {
          setSimulatorQaStatus(`자동 QA: 부활 광고 오류 (${error.message})`);
        }
        alert(t('modals:gameOver.reviveError'));
      },
      onDailyLimitReached: () => {
        setIsReviveAdInProgress(false);
        if (import.meta.env.DEV && isSimulatorQaEnabled) {
          setSimulatorQaStatus('자동 QA: 부활 광고 일일 한도 도달');
        }
        alert(t('modals:gameOver.reviveDailyLimitReached'));
      },
    });
  }, [isReviveAdInProgress, isSimulatorQaEnabled, showComboMessage, t]);

  const getSimulatorQaMode = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem('slidemino_sim_qa_mode');
    } catch {
      return null;
    }
  }, []);

  const handleSimulatorReviveAdProbe = useCallback(() => {
    if (!isSimulatorQaEnabled) return;

    if (!isRewardInterstitialAdSupported()) {
      setSimulatorQaStatus('현재 환경에서는 보상형 전면 광고를 지원하지 않습니다.');
      return;
    }

    if (!rewardInterstitialAdService.isAdReady()) {
      rewardInterstitialAdService.preloadAd();
      setSimulatorQaStatus('광고 준비 중... 1~3초 뒤 다시 눌러주세요.');

      window.setTimeout(() => {
        if (rewardInterstitialAdService.isAdReady()) {
          setSimulatorQaStatus('광고 준비 완료. 버튼을 다시 눌러 표시를 테스트하세요.');
        }
      }, 1200);
      return;
    }

    setSimulatorQaStatus('광고 표시 요청 중...');
    rewardInterstitialAdService.showReviveAd({
      onRewardEarned: () => {
        setSimulatorQaStatus('보상 이벤트 수신 완료 (userEarnedReward)');
      },
      onAdClosed: () => {
        setSimulatorQaStatus('광고 닫힘 이벤트 수신 완료 (dismissed)');
      },
      onError: (error) => {
        console.error('[SimulatorQA] 보상형 전면 광고 테스트 실패:', error);
        setSimulatorQaStatus(`광고 테스트 오류: ${error.message}`);
      },
      onDailyLimitReached: () => {
        setSimulatorQaStatus('일일 부활 광고 한도에 도달했습니다.');
      },
    });
  }, [isSimulatorQaEnabled]);

  useEffect(() => {
    if (!isSimulatorQaEnabled) return;

    window.__slideMinoSimQaTapReviveAd = () => {
      handleSimulatorReviveAdProbe();
    };

    return () => {
      delete window.__slideMinoSimQaTapReviveAd;
    };
  }, [handleSimulatorReviveAdProbe, isSimulatorQaEnabled]);

  useEffect(() => {
    if (!isSimulatorQaEnabled) return;
    if (gameState !== GameState.MENU) return;
    if (simulatorAutoProbeRunRef.current) return;

    simulatorAutoProbeRunRef.current = true;
    setShowSimulatorQaPanel(true);
    setSimulatorQaStatus('자동 QA: 보상형 전면 광고 로드 시작...');
    rewardInterstitialAdService.preloadAd();

    let checks = 0;
    const maxChecks = 12;
    const intervalId = window.setInterval(() => {
      checks += 1;
      if (rewardInterstitialAdService.isAdReady()) {
        window.clearInterval(intervalId);
        setSimulatorQaStatus('자동 QA: 로드 완료, 광고 표시 요청 중...');
        rewardInterstitialAdService.showReviveAd({
          onRewardEarned: () => {
            setSimulatorQaStatus('자동 QA 성공: 보상 콜백 수신');
          },
          onAdClosed: () => {
            setSimulatorQaStatus('자동 QA 완료: 광고 닫힘 콜백 수신');
          },
          onError: (error) => {
            console.error('[SimulatorQA] 자동 프로브 오류:', error);
            setSimulatorQaStatus(`자동 QA 오류: ${error.message}`);
          },
          onDailyLimitReached: () => {
            setSimulatorQaStatus('자동 QA: 일일 한도 도달');
          },
        });
        return;
      }

      if (checks >= maxChecks) {
        window.clearInterval(intervalId);
        setSimulatorQaStatus('자동 QA: 광고 준비 대기 중 (추가 탭으로 수동 재시도 가능)');
      }
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [gameState, isSimulatorQaEnabled]);

  useEffect(() => {
    if (gameState === GameState.MENU) {
      simulatorAutoGameOverTriggeredRef.current = false;
      simulatorAutoReviveTriggeredRef.current = false;
    }
  }, [gameState]);

  // DEV 시뮬레이터 전용 자동 QA 모드:
  // localStorage('slidemino_sim_qa_mode') = 'force_gameover_and_revive'
  // => 게임 진입 즉시 강제 게임오버를 만들고, 광고 준비 완료 시 부활까지 자동 시도
  useEffect(() => {
    if (getSimulatorQaMode() !== 'force_gameover_and_revive') return;
    if (gameState !== GameState.PLAYING) return;
    if (simulatorAutoGameOverTriggeredRef.current) return;

    simulatorAutoGameOverTriggeredRef.current = true;
    reviveSnapshotRef.current = cloneGameSnapshot({
      grid,
      slots,
      score,
      phase,
      canSkipSlide,
    });
    setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
    if (!rewardInterstitialAdService.isAdReady()) {
      rewardInterstitialAdService.preloadAd();
    }
    setSimulatorQaStatus('자동 QA: 강제 게임오버 진입');
    setGameState(GameState.GAME_OVER);
  }, [canSkipSlide, gameState, getSimulatorQaMode, grid, phase, score, slots]);

  useEffect(() => {
    if (getSimulatorQaMode() !== 'force_gameover_and_revive') return;
    if (gameState !== GameState.GAME_OVER) return;
    if (!isRewardInterstitialAdSupported()) return;
    if (!reviveSnapshotRef.current || hasUsedReviveThisRun) return;
    if (simulatorAutoReviveTriggeredRef.current || isReviveAdInProgress) return;

    if (!isReviveAdReady) {
      setSimulatorQaStatus('자동 QA: 부활 광고 준비 대기 중...');
      rewardInterstitialAdService.preloadAd();
      return;
    }

    simulatorAutoReviveTriggeredRef.current = true;
    setSimulatorQaStatus('자동 QA: 부활 광고 시도 중...');
    handleWatchReviveAd();
  }, [
    gameState,
    getSimulatorQaMode,
    handleWatchReviveAd,
    hasUsedReviveThisRun,
    isReviveAdInProgress,
    isReviveAdReady,
  ]);

  // 🆕 광고 미리 로드 (게임 진행 중이고 되돌리기가 0일 때)
  useEffect(() => {
    if (!isRewardAdSupported()) return;

    if (gameState === GameState.PLAYING) {
      // 되돌리기 횟수가 0 또는 1 이하일 때 광고 미리 로드
      if (undoRemaining <= 1) {
        rewardAdService.preloadAd();

        // 광고 로드 상태 주기적 체크 (로드 완료 감지)
        const checkInterval = setInterval(() => {
          const ready = rewardAdService.isAdReady();
          setIsAdReady(ready);
          if (ready) {
            clearInterval(checkInterval);
          }
        }, 500);

        return () => clearInterval(checkInterval);
      }
    } else if (gameState === GameState.MENU) {
      // 메뉴로 돌아가면 광고 리소스 정리
      rewardAdService.cleanup();
      setIsAdReady(false);
    }
  }, [gameState, undoRemaining]);

  // 게임오버 부활용 보상형 전면 광고 미리 로드
  useEffect(() => {
    if (!isRewardInterstitialAdSupported()) return;

    if ((gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) && !hasUsedReviveThisRun) {
      rewardInterstitialAdService.preloadAd();
      setIsReviveAdReady(rewardInterstitialAdService.isAdReady());

      const checkInterval = setInterval(() => {
        const ready = rewardInterstitialAdService.isAdReady();
        setIsReviveAdReady(ready);
        if (ready) {
          clearInterval(checkInterval);
        }
      }, 500);

      return () => clearInterval(checkInterval);
    }

    if (gameState === GameState.MENU) {
      rewardInterstitialAdService.cleanup();
      setIsReviveAdReady(false);
      setIsReviveAdInProgress(false);
      reviveSnapshotRef.current = null;
    }
  }, [gameState, hasUsedReviveThisRun]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (mergeClearTimeoutRef.current) window.clearTimeout(mergeClearTimeoutRef.current);
      if (mergeFinalizeTimeoutRef.current) window.clearTimeout(mergeFinalizeTimeoutRef.current);
      if (unlockTimeoutRef.current) window.clearTimeout(unlockTimeoutRef.current);
      if (comboMessageTimeoutRef.current) window.clearTimeout(comboMessageTimeoutRef.current);
    };
  }, []);

  // --- Helpers ---

  const getPieceBounds = useCallback((cells: Piece['cells']) => {
    const minX = Math.min(...cells.map((c) => c.x));
    const maxX = Math.max(...cells.map((c) => c.x));
    const minY = Math.min(...cells.map((c) => c.y));
    const maxY = Math.max(...cells.map((c) => c.y));
    return { minX, maxX, minY, maxY };
  }, []);

  const readBoardMetrics = useCallback((): BoardMetrics | null => {
    if (!boardRef.current) return null;

    const rect = boardRef.current.getBoundingClientRect();
    const styles = window.getComputedStyle(boardRef.current);
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingRight = parseFloat(styles.paddingRight) || 0;
    const paddingBottom = parseFloat(styles.paddingBottom) || 0;

    const size = boardSize;
    const innerWidth = rect.width - paddingLeft - paddingRight;
    const innerHeight = rect.height - paddingTop - paddingBottom;
    const totalGap = (size - 1) * BOARD_CELL_GAP_PX;
    const cell = (innerWidth - totalGap) / size;
    const pitch = cell + BOARD_CELL_GAP_PX;

    return {
      rectLeft: rect.left,
      rectTop: rect.top,
      paddingLeft,
      paddingTop,
      innerWidth,
      innerHeight,
      cell,
      pitch,
      size,
    };
  }, [boardSize]);

  const applyDragOverlayTransform = useCallback((pointerX: number, pointerY: number) => {
    if (!dragOverlayRef.current) return;
    dragOverlayRef.current.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0) scale(${DRAG_OVERLAY_SCALE})`;
  }, []);

  const rotateActivePiece = useCallback(() => {
    if (!draggingPiece) return;

    setDraggingPiece(prev => {
      if (!prev) return null;
      const nextRot = (prev.rotation + 1) % 4;
      const nextCells = getRotatedCells(prev.type, nextRot);
      return {
        ...prev,
        rotation: nextRot,
        cells: nextCells,
      };
    });
  }, [draggingPiece]);

  // --- Event Handlers: Drag & Drop ---

  // finishSlideTurn is used by executeSlide when a swipe does not merge.
  const finishSlideTurn = useCallback(() => {
    setPhase(Phase.PLACE);
    setComboMessage(null);
    setCanSkipSlide(false);
  }, []);

  // Memoized callback to prevent Slot re-renders
  const rotateSlotPiece = useCallback((index: number) => {
    setSlots(currentSlots => {
      const newSlots = [...currentSlots];
      const piece = newSlots[index];
      if (!piece) return currentSlots;

      const nextRot = (piece.rotation + 1) % 4;
      newSlots[index] = {
        ...piece,
        rotation: nextRot,
        cells: getRotatedCells(piece.type, nextRot)
      };
      return newSlots;
    });
  }, []);

  // Memoized callback to prevent Slot re-renders
  const handlePointerDown = useCallback((e: React.PointerEvent, piece: Piece, index: number) => {
    if (draggingPiece) return;
    const isSlidePhaseButSkippable = phase === Phase.SLIDE && canSkipSlide;

    // Animation/Input Lock Check (ref 기반: state 반영 전에도 즉시 차단)
    if (slideLockRef.current) return;

    if (phase !== Phase.PLACE && !isSlidePhaseButSkippable) return;

    if (isSlidePhaseButSkippable) {
      // 콤보(추가 스와이프 가능) 상태에서는 드래그 "시도"만으로 턴을 소비하지 않는다.
      // 실제 배치가 성공했을 때만 콤보를 소모해야 실수 터치로 권한이 사라지지 않는다.
      swipeStartRef.current = null;
    }

    const metrics = readBoardMetrics();
    if (!metrics) return;

    const initCells = getRotatedCells(piece.type, piece.rotation);
    dragPointerIdRef.current = e.pointerId;
    setPressedSlotIndex(index);
    setDraggingPiece({ ...piece, cells: initCells });
    setDragOriginIndex(index);
    boardMetricsRef.current = metrics;
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);
    latestPointerRef.current = null;
    currentPointerPosRef.current = { x: e.clientX, y: e.clientY };
    applyDragOverlayTransform(e.clientX, e.clientY);

    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }, [phase, canSkipSlide, draggingPiece, readBoardMetrics, applyDragOverlayTransform]);

  // RAF 기반으로 포인터 이벤트를 1프레임에 1번으로 합쳐서(코얼레싱) 렌더/연산 폭주를 방지
  const rafIdRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);
  const getGridPosFromPointer = useCallback((clientX: number, clientY: number) => {
    const metrics = boardMetricsRef.current;
    if (!metrics) return null;

    const relativeX = clientX - metrics.rectLeft - metrics.paddingLeft;
    const relativeY = clientY - metrics.rectTop - metrics.paddingTop;
    const isOutside =
      relativeX < 0 || relativeY < 0 || relativeX > metrics.innerWidth || relativeY > metrics.innerHeight;
    if (isOutside) return null;

    return {
      x: Math.round((relativeX - metrics.cell / 2) / metrics.pitch),
      y: Math.round((relativeY - metrics.cell / 2) / metrics.pitch),
    };
  }, []);

  const resetDraggingState = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    latestPointerRef.current = null;
    currentPointerPosRef.current = null;
    setPressedSlotIndex(-1);
    setDraggingPiece(null);
    setDragOriginIndex(-1);
    dragPointerIdRef.current = null;
    boardMetricsRef.current = null;
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);
  }, []);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
    if (!draggingPiece || !boardMetricsRef.current) return;
    latestPointerRef.current = { x: e.clientX, y: e.clientY };
    if (rafIdRef.current) return;

    rafIdRef.current = requestAnimationFrame(() => {
      const pointer = latestPointerRef.current;
      const metrics = boardMetricsRef.current;
      rafIdRef.current = null;
      if (!pointer || !metrics) return;
      currentPointerPosRef.current = pointer;

      applyDragOverlayTransform(pointer.x, pointer.y);
      const next = getGridPosFromPointer(pointer.x, pointer.y);
      if (!next) {
        if (hoverGridPosRef.current) {
          hoverGridPosRef.current = null;
          boardHandleRef.current?.setHoverLocation(null);
        }
        return;
      }

      const prev = hoverGridPosRef.current;
      if (prev && prev.x === next.x && prev.y === next.y) return;

      hoverGridPosRef.current = next;
      boardHandleRef.current?.setHoverLocation(next);
    });
  };

  const handleSwipeStart = (e: React.PointerEvent) => {
    // 슬라이드는 보드 영역에서만 시작하지 않고 전체 화면 허용
    // 단, 버튼 등 상호작용 요소 위에서는 스와이프 시작 방지
    if (phase !== Phase.SLIDE) return;
    if (slideLockRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [role="button"]')) return;

    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleScreenPointerDown = (e: React.PointerEvent) => {
    if (draggingPiece) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-rotate-button], [data-slot], button, input, select, textarea, [role="button"]')) {
        return;
      }
      if (dragPointerIdRef.current !== null && e.pointerId === dragPointerIdRef.current) return;
      rotateActivePiece();
      return;
    }

    handleSwipeStart(e);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // 1. 드래그 중인 조각이 있다면 -> 조각 놓기 처리
    if (draggingPiece) {
      if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
      // 드래그 종료 시 스와이프 시작 좌표가 남아있으면 다음 입력에서 오동작 가능
      swipeStartRef.current = null;
      const hover = hoverGridPosRef.current ?? getGridPosFromPointer(e.clientX, e.clientY);

      if (hover && boardRef.current) {
        if (canPlacePiece(grid, draggingPiece, hover.x, hover.y)) {
          // Undo를 위해 현재 상태 저장 (배치 전)
          saveSnapshot();

          const newGrid = placePieceOnGrid(grid, draggingPiece, hover.x, hover.y);
          setGrid(newGrid);

          // 배치 성공 시점에만 콤보 권한을 소모한다.
          setCanSkipSlide(false);
          setComboMessage(null);

          if (tutorialStep === 1) {
            setTutorialStep(2); // Proceed to Swipe Tutorial
          }

          // Increment move count
          moveCountRef.current += 1;

          const newSlots = [...slots];
          newSlots[dragOriginIndex] = generateRandomPiece();
          setSlots(newSlots);

          if (hasPossibleMoves(newGrid)) {
            setPhase(Phase.SLIDE);
          } else {
            setPhase(Phase.PLACE);
          }
        }
      }

      resetDraggingState();
      return;
    }

    // 2. 드래그 중이 아니고, 슬라이드 단계라면 -> 스와이프 처리
    if (phase === Phase.SLIDE && swipeStartRef.current) {
      const dx = e.clientX - swipeStartRef.current.x;
      const dy = e.clientY - swipeStartRef.current.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // 30px 이상 움직였을 때만 스와이프로 인정
      if (Math.max(absX, absY) > 30) {
        if (absX > absY) {
          executeSlide(dx > 0 ? 'RIGHT' : 'LEFT');
        } else {
          executeSlide(dy > 0 ? 'DOWN' : 'UP');
        }
      }
    }
    swipeStartRef.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    if (!draggingPiece) {
      if (dragPointerIdRef.current !== null && e.pointerId === dragPointerIdRef.current) {
        swipeStartRef.current = null;
        resetDraggingState();
      }
      return;
    }
    if (dragPointerIdRef.current !== null && e.pointerId !== dragPointerIdRef.current) return;
    swipeStartRef.current = null;
    resetDraggingState();
  };

  // --- Event Handlers: Swipe / Slide ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 시뮬레이터 QA 단축키(DEV 전용): 게임오버 상태에서 V 키로 부활 광고 트리거
      if (
        import.meta.env.DEV
        && isSimulatorQaEnabled
        && gameState === GameState.GAME_OVER
        && (e.key === 'v' || e.key === 'V')
      ) {
        e.preventDefault();
        handleWatchReviveAd();
        return;
      }

      if (e.key === 'r' || e.key === 'R') {
        if (draggingPiece) rotateActivePiece();
      }

      if (gameState === GameState.PLAYING && phase === Phase.SLIDE) {
        // Animation/Input Lock Check (ref 기반: state 반영 전에도 즉시 차단)
        if (slideLockRef.current) return;

        let dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null = null;
        if (e.key === 'ArrowUp') dir = 'UP';
        if (e.key === 'ArrowDown') dir = 'DOWN';
        if (e.key === 'ArrowLeft') dir = 'LEFT';
        if (e.key === 'ArrowRight') dir = 'RIGHT';

        if (dir) {
          executeSlide(dir);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, phase, grid, draggingPiece, rotateActivePiece, handleWatchReviveAd, isSimulatorQaEnabled]);

  const executeSlide = (dir: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') => {
    if (slideLockRef.current) return; // Double check

    const {
      grid: newGrid,
      score: scoreAdded,
      moved,
      mergingTiles: newMergingTiles,
      mergedTiles,
      maxDistance
    } = slideGrid(grid, dir);

    if (!moved) {
      // 예외 상태 안전장치: SLIDE 단계에서 어떤 방향도 불가능하면 PLACE로 복귀시킨다.
      if (!hasPossibleMoves(grid)) {
        finishSlideTurn();
        showComboMessage(String(t('game:status.noMergePlaceMessage')));
      }
      return;
    }

    if (tutorialStep === 2) {
      setTutorialStep(0);
      localStorage.setItem('tutorial_completed', 'true');
    }

    // Increment move count for anti-cheat
    moveCountRef.current += 1;

    // Undo를 위해 현재 상태 저장 (슬라이드 전)
    saveSnapshot();
    const lockMs = getSlideAnimationDurationMs(maxDistance) + SLIDE_UNLOCK_BUFFER_MS;

    // Lock Input
    slideLockRef.current = true;
    setIsAnimating(true);

    // Natural merge: 이동 중에는 합쳐지기 전 값으로 보이도록 오버라이드
    if (mergedTiles.length > 0) {
      const overrides: Record<string, number> = {};
      for (const mt of mergedTiles) overrides[mt.id] = mt.fromValue;
      setTileValueOverrides(overrides);
    } else {
      setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
    }

    // Set merging tiles for animation
    if (mergeClearTimeoutRef.current) {
      window.clearTimeout(mergeClearTimeoutRef.current);
      mergeClearTimeoutRef.current = null;
    }
    if (newMergingTiles.length > 0) {
      setMergingTiles(newMergingTiles);
      mergeClearTimeoutRef.current = window.setTimeout(() => {
        setMergingTiles(EMPTY_MERGING_TILES);
        mergeClearTimeoutRef.current = null;
      }, lockMs);
    } else {
      setMergingTiles(EMPTY_MERGING_TILES);
    }

    setGrid(newGrid);

    // Merge 완료 시점에 값/점수 반영 (이동 + 흡수 애니메이션이 끝난 뒤)
    if (mergeFinalizeTimeoutRef.current) {
      window.clearTimeout(mergeFinalizeTimeoutRef.current);
      mergeFinalizeTimeoutRef.current = null;
    }
    if (scoreAdded > 0) {
      mergeFinalizeTimeoutRef.current = window.setTimeout(() => {
        setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
        setScore(prev => prev + scoreAdded);
        mergeFinalizeTimeoutRef.current = null;
      }, lockMs);
    }

    // Wait for animation to finish before unlocking
    if (unlockTimeoutRef.current) {
      window.clearTimeout(unlockTimeoutRef.current);
      unlockTimeoutRef.current = null;
    }
    unlockTimeoutRef.current = window.setTimeout(() => {
      slideLockRef.current = false;
      setIsAnimating(false);
      setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
      unlockTimeoutRef.current = null;

      if (scoreAdded > 0) {
        // 새 규칙: 머지가 발생했다면 이번 턴은 계속 스와이프만 가능
        setPhase(Phase.SLIDE);
        setCanSkipSlide(false);
        showComboMessage(String(t('game:status.mergeContinueMessage')));
      } else {
        finishSlideTurn();
        showComboMessage(String(t('game:status.noMergePlaceMessage')));
      }
    }, lockMs);
  };

  // --- Game Over Check ---
  useEffect(() => {
    // 애니메이션이 진행 중이면 게임 오버 체크 연기
    // (슬라이드 후 grid가 업데이트되는 도중에 체크하면 잘못된 판정 발생)
    if (isAnimating || slideLockRef.current) {
      return;
    }

    if (gameState !== GameState.PLAYING) return;

    const availability = getTurnActionAvailability(grid, slots);

    if (phase === Phase.SLIDE && !availability.canSwipe) {
      finishSlideTurn();
      return;
    }

    if (phase === Phase.PLACE && availability.isGameOver) {
      reviveSnapshotRef.current = lastSnapshot ? cloneGameSnapshot(lastSnapshot) : null;
      setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
      if (isRewardInterstitialAdSupported() && !rewardInterstitialAdService.isAdReady()) {
        rewardInterstitialAdService.preloadAd();
      }
      setGameState(GameState.GAME_OVER);
      if (score > highScore) setHighScore(score);
    }
  }, [phase, grid, slots, gameState, score, highScore, isAnimating, lastSnapshot, finishSlideTurn]);

  // --- 게임 중 예상 랭킹 업데이트 ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      leaderboardSnapshotRef.current = [];
      setLiveRankEstimate(null);
      return;
    }

    let cancelled = false;
    const updateEstimate = async () => {
      try {
        const result = await rankingService.getLeaderboard();
        if (cancelled) return;
        leaderboardSnapshotRef.current = result.data;
        setLiveRankEstimate(
          rankingService.estimateLiveRank(scoreRef.current, String(boardSizeRef.current), result.data)
        );
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[랭킹 추정] 랭킹 조회 실패:', error);
        }
      }
    };

    void updateEstimate();
    const intervalId = window.setInterval(updateEstimate, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [gameState]);

  // 점수/난이도 변경 시 최신 랭킹 스냅샷으로 즉시 재계산
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;
    setLiveRankEstimate(
      rankingService.estimateLiveRank(score, String(boardSize), leaderboardSnapshotRef.current)
    );
  }, [gameState, score, boardSize]);


  // --- Render Helpers ---

  // 드래그 오버레이는 React 상태 갱신 대신 ref + transform으로 위치를 갱신해 지연을 줄인다.

  const renderDraggingPiece = () => {
    if (!draggingPiece) return null;

    const cells = draggingPiece.cells;
    const cellSize = boardMetricsRef.current?.cell ?? 32;
    const cellAppearance = resolveTileAppearance(draggingPiece.value);
    const { minX, maxX, minY, maxY } = getPieceBounds(cells);
    const centerOffsetX = ((minX + maxX) / 2 + 0.5) * cellSize;
    const centerOffsetY = ((minY + maxY) / 2 + 0.5) * cellSize;

    return (
      <div
        ref={(el) => {
          dragOverlayRef.current = el;
          // 마운트 직후 초기 위치 설정 (깜빡임 방지)
          if (el && currentPointerPosRef.current) {
            const { x, y } = currentPointerPosRef.current;
            applyDragOverlayTransform(x, y);
          }
        }}
        className="fixed top-0 left-0 pointer-events-none z-50 opacity-90 will-change-transform"
        style={{
          marginTop: `-${centerOffsetY}px`,
          marginLeft: `-${centerOffsetX}px`,
        }}
      >
        <div className="relative">
          {cells.map((c, i) => (
            <div
              key={i}
              className={`
                absolute rounded-lg
                ${cellAppearance.className}
              `}
              style={{
                left: c.x * cellSize,
                top: c.y * cellSize,
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                ...(cellAppearance.style ?? {}),
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // --- Views ---

  if (shouldShowPortraitLockOverlay) {
    return (
      <>
        <CookieConsent />
        <div className="min-h-screen min-h-[100dvh] flex items-center justify-center px-6 py-10 bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900">
          <div className="w-full max-w-sm rounded-3xl border border-white/70 bg-white/80 backdrop-blur-sm shadow-xl p-8 text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl border border-gray-200 bg-white flex items-center justify-center text-2xl">
              📱
            </div>
            <h1 className="text-xl font-bold tracking-tight">{orientationLockMessage.title}</h1>
            <p className="text-sm text-gray-600 leading-relaxed">{orientationLockMessage.body}</p>
          </div>
        </div>
      </>
    );
  }

  // ========== 정적 페이지 라우팅 ==========
  if (currentRoute === '/privacy') {
    return (
      <>
        <CookieConsent />
        <PrivacyPolicy />
      </>
    );
  }
  if (currentRoute === '/terms') {
    return (
      <>
        <CookieConsent />
        <Terms />
      </>
    );
  }
  if (currentRoute === '/about') {
    return (
      <>
        <CookieConsent />
        <About />
      </>
    );
  }
  if (currentRoute === '/contact') {
    return (
      <>
        <CookieConsent />
        <Contact />
      </>
    );
  }

  // ========== MENU SCREEN ==========
  if (gameState === GameState.MENU) {
    const shouldSuppressGameModeTutorial =
      isNameInputOpen || isCustomizationOpen || isLeaderboardOpen || isActiveGameExitModalOpen;

    return (
      <>
        <CookieConsent />
        <div
          className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-10"
          style={{ paddingTop: 'calc(1.5rem + var(--app-safe-top))' }}
        >
          {/* 로고 영역 */}
          <div className="text-center space-y-3 animate-fade-in">
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              {t('game:title')}
            </h1>
            <p className="text-gray-500 text-lg max-w-xs mx-auto leading-relaxed">
              {tagline.split('\n').map((line, index, arr) => (
                <React.Fragment key={`${line}-${index}`}>
                  {line}
                  {index < arr.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          </div>

          {isSimulatorQaEnabled && (
            <div className="w-full max-w-xs rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-left shadow-sm">
              <button
                type="button"
                id="sim-qa-toggle-btn"
                onClick={() => setShowSimulatorQaPanel((prev) => !prev)}
                className="w-full rounded-xl border border-amber-300/70 bg-amber-100/80 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
              >
                {showSimulatorQaPanel ? '시뮬레이터 QA 닫기' : '시뮬레이터 QA 열기'}
              </button>

              {showSimulatorQaPanel && (
                <div className="mt-2 space-y-2">
                  <button
                    type="button"
                    id="sim-qa-revive-ad-btn"
                    onClick={handleSimulatorReviveAdProbe}
                    className="w-full rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                  >
                    보상형 전면 광고(부활) 테스트
                  </button>
                  <p className="text-xs text-amber-900/90 leading-relaxed">
                    {simulatorQaStatus ?? '시뮬레이터 전용 도구입니다. 실제 사용자에게는 보이지 않습니다.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 난이도 선택 버튼들 */}
          <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
            <AnimatePresence mode="wait">
              {isLoading && <LoadingScreen key="loading-screen-menu" />}
            </AnimatePresence>

            {/* 게임 이어하기 버튼 - 진행중인 게임이 있을 때만 표시 */}
            {hasActiveGame() && (
              <button
                onClick={() => {
                  const saved = loadGameState();
                  if (saved) {
                    restoreSavedGame(saved);
                  }
                }}
                className="
                relative group w-full py-4 px-6 rounded-2xl
                bg-gradient-to-br from-emerald-500 to-emerald-600
                border border-emerald-400/30
                shadow-lg shadow-emerald-900/20
                hover:shadow-xl hover:shadow-emerald-600/30 hover:-translate-y-0.5
                active:translate-y-0 active:shadow-md
                transition-all duration-200 ease-out
                text-white font-semibold text-lg
              "
              >
                <span className="flex items-center justify-between">
                  <span>{t('game:difficulties.continue')}</span>
                  <span className="text-emerald-200/70 font-normal text-sm">{boardSize}×{boardSize}</span>
                </span>
              </button>
            )}

            {/* 고수 - 4×4 */}
            <button
              onClick={() => tryStartGame(4)}
              className="
              relative group w-full py-4 px-6 rounded-2xl
              bg-gradient-to-br from-red-600 via-red-700 to-red-900
              border border-red-400/30
              shadow-lg shadow-red-900/20
              hover:shadow-xl hover:shadow-red-600/30 hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-white font-semibold text-lg
            "
            >
              <span className="flex items-center justify-between">
                <span>{t('game:difficulties.expert')}</span>
                <span className="text-red-200/70 font-normal text-sm">{t('game:boardSizes.4x4')}</span>
              </span>
            </button>

            {/* 일반 - 5×5 */}
            <button
              id="mode-btn-beginner"
              onClick={() => {
                tryStartGame(5);
                localStorage.setItem('tutorial_game_mode_seen_v1', 'true');
              }}
              className="
              relative group w-full py-4 px-6 rounded-2xl
              bg-gradient-to-br from-blue-600 to-blue-700
              border border-blue-400/30
              shadow-lg shadow-blue-900/20
              hover:shadow-xl hover:shadow-blue-600/30 hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-white font-semibold text-lg
            "
            >
              <span className="flex items-center justify-between">
                <span>{t('game:difficulties.normal')}</span>
                <span className="text-blue-200/70 font-normal text-sm">{t('game:boardSizes.5x5')}</span>
              </span>
            </button>

            {/* 뉴비 - 7×7 */}
            <button
              onClick={() => tryStartGame(7)}
              className="
              relative group w-full py-4 px-6 rounded-2xl
              bg-black
              border border-white/10
              shadow-lg
              hover:shadow-xl hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-white font-semibold text-lg
            "
            >
              <span className="flex items-center justify-between">
                <span>{t('game:difficulties.beginner')}</span>
                <span className="text-gray-500 font-normal text-sm">{t('game:boardSizes.7x7')}</span>
              </span>
            </button>

            {/* 왕초보 - 8×8 */}
            <button
              onClick={() => tryStartGame(8)}
              className="
              relative group w-full py-4 px-6 rounded-2xl
              bg-gradient-to-br from-gray-800 to-gray-900
              border border-white/10
              shadow-lg
              hover:shadow-xl hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-white font-semibold text-lg
            "
            >
              <span className="flex items-center justify-between">
                <span>{t('game:difficulties.easy')}</span>
                <span className="text-gray-400 font-normal text-sm">{t('game:boardSizes.8x8')}</span>
              </span>
            </button>

            {/* 무한모드 - 10×10 */}
            <button
              onClick={() => tryStartGame(10)}
              className="
              relative group w-full py-4 px-6 rounded-2xl
              bg-white/60 backdrop-blur-sm
              border border-white/50
              shadow-lg
              hover:shadow-xl hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-gray-800 font-semibold text-lg
            "
            >
              <span className="flex items-center justify-between">
                <span>{t('game:difficulties.infinite')}</span>
                <span className="text-gray-400 font-normal text-sm">{t('game:boardSizes.10x10')}</span>
              </span>
            </button>

            {/* Customization */}
            <button
              onClick={() => setIsCustomizationOpen(true)}
              className={`
              relative group w-full py-3.5 px-6 rounded-2xl
              bg-white/60 backdrop-blur-sm
              border border-white/50
              shadow-lg
              hover:shadow-xl hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-gray-800 font-semibold text-base
              flex items-center justify-between
            `}
            >
              <span className="flex items-center gap-2">
                <Palette size={16} />
                {t('game:actions.customization')}
              </span>
              {!customizationGate.allowed ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700/90">
                  <Lock size={14} />
                  {customizationGate.reasonKey ? t(customizationGate.reasonKey as any) : t('game:actions.locked')}
                </span>
              ) : (
                <span className="text-gray-400 font-normal text-sm">{t('game:actions.customize')}</span>
              )}
            </button>

            {/* Leaderboard Button */}
            <button
              onClick={() => setIsLeaderboardOpen(true)}
              className={`
              relative group w-full py-3.5 px-6 rounded-2xl
              bg-white/60 backdrop-blur-sm
              border border-white/50
              shadow-lg
              hover:shadow-xl hover:-translate-y-0.5
              active:translate-y-0 active:shadow-md
              transition-all duration-200 ease-out
              text-gray-800 font-semibold text-base
              flex items-center justify-between
            `}
            >
              <span className="flex items-center gap-2">
                <Trophy size={16} className="text-yellow-600" />
                {t('game:actions.leaderboard')}
              </span>
            </button>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Replay Tutorial Button */}
            <button
                onClick={() => {
                  localStorage.removeItem('tutorial_back_nav_seen_v1');
                  localStorage.removeItem('tutorial_game_mode_seen_v1');
                  localStorage.removeItem('tutorial_completed'); // Reset game tutorial too
                  setTutorialResetKey(prev => prev + 1);
                  setTutorialStep(1); // Enable game Drag tutorial if they start game immediately
                  
                  // Show feedback toast or alert?
                  // Simple alert for clarity or just button feedback.
                  // Let's use window.alert for now or just visual feedback.
                  // Or just let the UI react (GameModeTutorial will appear).
                  const btn = document.getElementById('replay-tutorial-btn');
                  if(btn) {
                    btn.innerText = "✨ " + t('common:actions.resetDone', '리셋 완료!');
                    setTimeout(() => {
                        if(btn) btn.innerText = t('common:actions.replayTutorial', '튜토리얼 다시보기');
                    }, 1500);
                  }
                }}
                id="replay-tutorial-btn"
                className="
                  w-full py-3.5 px-6 rounded-2xl
                  bg-white/30 backdrop-blur-sm
                  border border-white/20
                  text-gray-600 hover:text-gray-900
                  hover:bg-white/50 hover:-translate-y-0.5
                  active:translate-y-0 active:shadow-sm
                  transition-all duration-200 ease-out
                  shadow-sm
                  text-sm font-semibold
                  flex items-center justify-center gap-2
                "
              >
              <RotateCcw size={14} />
              {t('common:actions.replayTutorial', '튜토리얼 다시보기')}
            </button>
          </div>

          {/* 푸터 네비게이션 - 앱인토스에서는 숨김 (불필요한 영역 제거) */}
          {!isAppIntoS() && (
            <footer className="w-full max-w-md mt-8 pt-6 border-t border-gray-200">
              <nav className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
                <a href="#/about" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.about')}
                </a>
                <span className="text-gray-300">•</span>
                <a href="#/privacy" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.privacy')}
                </a>
                <span className="text-gray-300">•</span>
                <a href="#/terms" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.terms')}
                </a>
                <span className="text-gray-300">•</span>
                <a href="#/contact" className="hover:text-gray-900 transition-colors">
                  {t('common:footer.contact')}
                </a>

                {isNative && (
                  <>
                    <span className="text-gray-300">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        openNativePrivacyOptionsForm().catch(() => {
                          // ignore
                        });
                      }}
                      className="hover:text-gray-900 transition-colors"
                    >
                      {t('common:footer.adPrivacy')}
                    </button>
                  </>
                )}
              </nav>
              <p className="text-center text-xs text-gray-400 mt-3">
                {t('common:footer.copyright')}
              </p>
            </footer>
          )}

          <AdBanner />

          <BlockCustomizationModal
            open={isCustomizationOpen}
            onClose={() => setIsCustomizationOpen(false)}
          />

          <LeaderboardModal
            open={isLeaderboardOpen}
            onClose={() => setIsLeaderboardOpen(false)}
          />

          <NameInputModal
            open={isNameInputOpen}
            difficulty={pendingDifficulty}
            initialName={playerName || rankingService.getSavedName()}
            hasActiveGame={showActiveGameWarning}
            onClose={() => setIsNameInputOpen(false)}
            onSubmit={handleNameSubmit}
          />

          {activeGameRankingSnapshot && (
            <ActiveGameExitModal
              open={isActiveGameExitModalOpen}
              context={activeGameExitContext}
              score={activeGameRankingSnapshot.score}
              difficulty={activeGameRankingSnapshot.difficulty}
              duration={activeGameRankingSnapshot.duration}
              moves={activeGameRankingSnapshot.moves}
              sessionId={activeGameRankingSnapshot.sessionId}
              playerName={activeGameRankingSnapshot.playerName}
              onCancel={handleActiveGameExitCancel}
              onProceedWithoutRegister={handleActiveGameExitProceedWithoutRegister}
              onRegisteredAndProceed={handleActiveGameExitRegisteredAndProceed}
            />
          )}
          
          <GameModeTutorial
            key={tutorialResetKey}
            suppressed={shouldSuppressGameModeTutorial}
          />
        </div>
      </>
    );
  }

  const isPlacePhase = phase === Phase.PLACE;
  const isSwipePhase = phase === Phase.SLIDE;
  const isPlaceFocusMode = isPlacePhase;
  const isSwipeFocusMode = isSwipePhase;
  const focusSurfaceClass = 'scale-[1.01] drop-shadow-[0_22px_40px_rgba(15,23,42,0.18)]';
  const boardFocusSurfaceClass = (isPlaceFocusMode || isSwipeFocusMode)
    ? focusSurfaceClass
    : 'scale-100';
  const undoFocusSurfaceClass = isSwipeFocusMode
    ? focusSurfaceClass
    : 'scale-100';
  const slotFocusSurfaceClass = isPlaceFocusMode
    ? focusSurfaceClass
    : 'scale-100';
  const slotVisibilityClass = isAnimating
    ? 'opacity-40 grayscale'
    : (isSwipeFocusMode ? 'opacity-60 grayscale-[0.3] saturate-75' : 'opacity-100');
  const phaseIndicatorInteractivityClass = isPlacePhase
    ? 'pointer-events-auto'
    : 'pointer-events-none opacity-35 grayscale select-none';

  // 모드 알리미(phase) 상태 기반 포커스:
  // - PLACE: 보드 + 슬롯 강조
  // - SLIDE: 보드 + Undo 강조 (슬롯은 비강조)
  const isSlotPointerLocked = isSwipePhase || isAnimating;
  const isSlotDisabled = isAnimating;

  // ========== GAME SCREEN ==========
  return (
    <>
      <CookieConsent />
      <div
        className="min-h-screen min-h-[100dvh] flex flex-col items-center text-gray-900 touch-none"
        onPointerDown={handleScreenPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Header */}
        <header
          ref={headerRef}
          className="w-full flex justify-between items-center p-4"
          style={{
            maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
            paddingTop: 'calc(16px + var(--game-safe-top))',
            // 앱인토스: 우측 상단 공통 내비게이션 영역 확보
            paddingRight: 'calc(16px + var(--appintos-nav-safe-right))'
          }}
        >
          <div className="flex items-center gap-3">
            {/* Home Button */}
            <button
              type="button"
              onClick={handleHomeButtonClick}
              disabled={isAnimating}
              className={`
              p-2.5 rounded-full flex items-center justify-center
              border shadow-sm transition-all duration-200
              ${isAnimating
                  ? 'bg-gray-100/50 text-gray-300 border-gray-200/50 cursor-not-allowed'
                  : 'bg-white/70 hover:bg-white text-gray-700 border-white/50 hover:shadow-md active:scale-95'
                }
            `}
              aria-label={t('common:aria.home')}
            >
              <Home size={18} />
            </button>
            <div className="space-y-0.5">
              <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                {t('common:labels.score')}
                {liveRankEstimate !== null && gameState === GameState.PLAYING && (
                  <span className="ml-2 text-xs font-semibold text-blue-600">
                    {String(t('game:liveRank.estimatedRank', { rank: liveRankEstimate.rank } as any))}
                  </span>
                )}
              </h2>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">{score}</p>
              {liveRankEstimate !== null && gameState === GameState.PLAYING && (
                <p className="text-xs font-semibold text-blue-500">
                  {liveRankEstimate.pointsToNext > 0
                    ? String(t('game:liveRank.pointsToNext', { points: liveRankEstimate.pointsToNext } as any))
                    : t('game:liveRank.topRank')}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 transition-all duration-200">
            {/* Phase Indicator - Glass Pill */}
            <div className={`
            px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 
            transition-all duration-200 ease-out
            ${phaseIndicatorInteractivityClass}
            ${isPlacePhase
                ? 'bg-emerald-50/90 backdrop-blur-sm border border-emerald-200/90 text-emerald-700 shadow-sm'
                : 'bg-slate-100/90 backdrop-blur-sm border border-slate-300/80 text-slate-700 shadow-sm'
              }
          `}
              aria-disabled={!isPlacePhase}
              tabIndex={isPlacePhase ? 0 : -1}
            >
              {isPlacePhase ? t('game:phases.place') : t('game:phases.swipe')}
              {isSwipePhase && <Move size={14} />}
            </div>

            {/* Help & Undo Buttons - Same Row */}
            <div className="flex items-center gap-2">
              {/* Help Button */}
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className={`
                  p-2 rounded-full text-gray-600
                  bg-white/70 hover:bg-white border border-white/50
                  shadow-sm hover:shadow-md transition-all duration-200 active:scale-95
                  ${isSwipeFocusMode ? 'opacity-35 grayscale pointer-events-none select-none' : ''}
                `}
                aria-label={t('common:aria.help')}
              >
                <HelpCircle size={18} />
              </button>

              {/* Undo Button */}
              <button
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={executeUndo}
                disabled={!lastSnapshot || undoRemaining <= 0 || isAnimating}
                className={`
                px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2
                border shadow-sm transition-all duration-200
                ${undoFocusSurfaceClass}
                pointer-events-auto
                ${(!lastSnapshot || undoRemaining <= 0 || isAnimating)
                    ? 'bg-gray-100/50 text-gray-300 border-gray-200/50 cursor-not-allowed'
                    : 'bg-white/70 hover:bg-white text-gray-700 border-white/50 hover:shadow-md active:scale-95'
                  }
              `}
              >
                <Undo2 size={14} />
                <span className="tabular-nums">{undoRemaining}</span>
              </button>

              {/* 🆕 Reward Ad Button - 되돌리기 0일 때만 표시 */}
              {isRewardAdSupported() && undoRemaining === 0 && (
                <button
                  type="button"
                  onClick={handleWatchRewardAd}
                  disabled={isAnimating}
                  className={`
                    px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5
                    bg-gradient-to-r from-yellow-500 to-amber-500
                    text-white border border-yellow-400/50
                    shadow-md hover:shadow-lg
                    active:scale-95 transition-all duration-200
                    ${isSwipeFocusMode ? 'opacity-35 grayscale pointer-events-none select-none' : ''}
                    ${isAnimating ? 'opacity-50 cursor-not-allowed' : 'hover:from-yellow-600 hover:to-amber-600'}
                  `}
                  aria-label={t('game:rewardAd.watchButtonFull')}
                >
                  <span>📺</span>
                  <span>{t('game:rewardAd.watchButton')}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Game Area */}
        <main
          className="flex-1 w-full flex flex-col items-center justify-center min-h-0 p-4"
          style={{
            maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
            gap: `${gameLayoutProfile.mainGapPx}px`,
            paddingTop: `${gameLayoutProfile.mainTopPaddingPx}px`,
            paddingBottom: `calc(${gameLayoutProfile.mainBottomPaddingPx}px + var(--app-safe-bottom))`
          }}
        >

          <div className={`
            transition-all duration-200
            ${boardFocusSurfaceClass}
          `}>
            <Board
              ref={boardHandleRef}
              htmlId="game-board"
              grid={grid}
              phase={phase}
              activePiece={draggingPiece}
              boardRef={boardRef}
              mergingTiles={mergingTiles}
              valueOverrides={tileValueOverrides}
              boardScale={boardScale}
            />
          </div>


          {/* Inventory Slots */}
          <div className={`
          w-full grid grid-cols-3 gap-4 
          transition-all duration-200
          ${slotFocusSurfaceClass}
          ${isSlotPointerLocked ? 'pointer-events-none' : ''}
          ${slotVisibilityClass}
        `}>
            {slots.map((p, i) => (
              <Slot
                key={p ? p.id : i}
                index={i}
                piece={p}
                htmlId={i === 0 ? 'slot-0' : undefined}
                onPointerDown={handlePointerDown}
                onRotate={rotateSlotPiece}
                isPressed={pressedSlotIndex === i}
                disabled={isSlotDisabled}
              />
            ))}
          </div>

          <div className="w-full h-9 flex items-center justify-center">
            <button
              type="button"
              data-rotate-button
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!draggingPiece) return;
                rotateActivePiece();
              }}
              className={`
                inline-flex items-center justify-center
                w-9 h-9 rounded-full
                bg-white/80 border border-white/70
                text-gray-700 shadow-sm
                hover:bg-white
                transition-colors
                ${draggingPiece ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
              `}
              aria-label={t('common:aria.rotateBlock')}
              aria-hidden={!draggingPiece}
              tabIndex={draggingPiece ? 0 : -1}
            >
              <RotateCw size={16} />
            </button>
          </div>

        </main>

        <TutorialOverlay step={tutorialStep} />
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

        {/* Ad Banner for Game Screen */}
        <div ref={bottomBannerRef} className="w-full">
          <div className={`
          w-full shrink-0 z-10 bg-white/50 backdrop-blur-sm border-t border-white/20
          transition-opacity duration-200
          ${isSwipeFocusMode ? 'opacity-20 pointer-events-none' : 'opacity-100'}
        `}>
            <AdBanner />
          </div>
        </div>

        {/* Dragging Overlay */}
        {renderDraggingPiece()}

        {/* Game Over Modal */}
        {gameState === GameState.GAME_OVER && (
          <GameOverModal
            sessionId={sessionIdRef.current}
            score={score}
            difficulty={`${boardSize}x${boardSize}`}
            duration={Math.floor((Date.now() - gameStartTimeRef.current) / 1000)}
            moves={moveCountRef.current}
            playerName={playerName}
            canOfferRevive={isRewardInterstitialAdSupported() && !hasUsedReviveThisRun && Boolean(reviveSnapshotRef.current)}
            isReviveAdReady={isReviveAdReady}
            isReviveInProgress={isReviveAdInProgress}
            onWatchReviveAd={handleWatchReviveAd}
            onClose={handleGameOverClose}
          />
        )}

        {activeGameRankingSnapshot && (
          <ActiveGameExitModal
            open={isActiveGameExitModalOpen}
            context={activeGameExitContext}
            score={activeGameRankingSnapshot.score}
            difficulty={activeGameRankingSnapshot.difficulty}
            duration={activeGameRankingSnapshot.duration}
            moves={activeGameRankingSnapshot.moves}
            sessionId={activeGameRankingSnapshot.sessionId}
            playerName={activeGameRankingSnapshot.playerName}
            onCancel={handleActiveGameExitCancel}
            onProceedWithoutRegister={handleActiveGameExitProceedWithoutRegister}
            onRegisteredAndProceed={handleActiveGameExitRegisteredAndProceed}
          />
        )}
      </div>
      <AnimatePresence mode="wait">
        {isLoading && <LoadingScreen key="loading-screen-game" />}
      </AnimatePresence>
    </>
  );
};

export default App;
