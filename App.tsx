import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LoadingScreen } from './components/LoadingScreen';
import { useTranslation } from 'react-i18next';
import { App as CapacitorApp } from '@capacitor/app';
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
  generateRefreshedSlotPieces,
  getRotatedCells,
  canPlacePiece,
  placePieceOnGrid,
  getTurnActionAvailability,
  slideGrid,
  hasPossibleMoves
} from './services/gameLogic';
import { Board, type BoardHandle, type ReviveDestroyEffect } from './components/Board';
import { Slot } from './components/Slot';
import { BlockCustomizationModal } from './components/BlockCustomizationModal';
import { SkinModal } from './components/SkinModal';
import { Undo2, Home, RotateCw, Move, Palette, Lock, Trophy, HelpCircle, RotateCcw } from 'lucide-react';

import { GameOverModal } from './components/GameOverModal';
import { GameModeTutorial } from './components/GameModeTutorial';
import { LeaderboardModal } from './components/LeaderboardModal';
import { NameInputModal } from './components/NameInputModal';
import { ActiveGameExitModal, type ActiveGameExitContext } from './components/ActiveGameExitModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import { GameFeaturesTutorial } from './components/GameFeaturesTutorial';
import { SkinFeatureTutorial } from './components/SkinFeatureTutorial';
import AdBanner from './components/AdBanner';
import { CookieConsent } from './components/CookieConsent';
import { HelpModal } from './components/HelpModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { NativeUpdateModal } from './components/NativeUpdateModal';
import {
  BOARD_CELL_GAP_PX,
  SLIDE_UNLOCK_BUFFER_MS,
  getSlideAnimationDurationMs,
  INITIAL_BLOCK_REFRESH_AMOUNT,
  INITIAL_UNDO_AMOUNT,
  REWARD_BLOCK_REFRESH_AMOUNT,
  REWARD_UNDO_AMOUNT,
} from './constants';
import { useBlockCustomization } from './context/BlockCustomizationContext';
import { saveGameState, loadGameState, clearGameState, hasActiveGame, type SavedGameState } from './services/gameStorage';
import { rankingService, type LiveRankEstimate } from './services/rankingService';
import { getCurrentRoute, onRouteChange, updatePageMeta, type Route } from './utils/routing';
import { isNativeApp, isAppIntoS, isAndroidApp } from './utils/platform';
import { normalizeLanguage } from './i18n/constants';
import { LANGUAGE_CONFIGS, type SupportedLanguage } from './i18n/constants';
import { openNativePrivacyOptionsForm } from './services/admob';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import About from './pages/About';
import Contact from './pages/Contact';
import { rewardAdService } from './services/rewardAdService';
import { rewardInterstitialAdService } from './services/rewardInterstitialAdService';
import { blockRefreshRewardInterstitialAdService } from './services/blockRefreshRewardInterstitialAdService';
import {
  isBlockRefreshRewardInterstitialAdSupported,
  isRewardAdSupported,
  isRewardInterstitialAdSupported,
} from './services/adConfig';
import { normalizePlayerName, validatePlayerName } from './utils/playerName';
import {
  checkNativeUpdateRequirement,
  openNativeMarketForUpdate,
  type NativeUpdateRequirement,
} from './services/nativeUpdate';

const EMPTY_TILE_VALUE_OVERRIDES: Record<string, number> = {};
const EMPTY_MERGING_TILES: MergingTile[] = [];
const DRAG_OVERLAY_SCALE = 1;
const LIVE_RANK_POLL_INTERVAL_MS = 5000;
const LIVE_RANK_SCORE_SYNC_DEBOUNCE_MS = 350;
const LIVE_RANK_MIN_REQUEST_INTERVAL_MS = 1000;

// Undo 시스템: 직전 상태를 저장하기 위한 스냅샷 인터페이스
interface GameSnapshot {
  grid: Grid;
  slots: (Piece | null)[];
  score: number;
  phase: Phase;
  canSkipSlide: boolean;
}

const REVIVE_DESTROY_COUNT_BY_BOARD_SIZE: Record<BoardSize, number> = {
  4: 3,
  5: 4,
  7: 6,
  8: 7,
  10: 9,
};

interface ActiveGameRankingSnapshot {
  sessionId: string;
  score: number;
  difficulty: string;
  duration: number;
  moves: number;
  playerName: string;
  sessionLockedPlayerName: string | null;
}

const cloneGameSnapshot = (snapshot: GameSnapshot): GameSnapshot => ({
  grid: snapshot.grid.map((row) => row.map((tile) => (tile ? { ...tile } : null))),
  slots: snapshot.slots.map((piece) => (piece ? { ...piece, cells: [...piece.cells] } : null)),
  score: snapshot.score,
  phase: snapshot.phase,
  canSkipSlide: snapshot.canSkipSlide,
});

const countOccupiedTiles = (targetGrid: Grid): number =>
  targetGrid.reduce((sum, row) => {
    const filled = row.reduce((rowCount, tile) => rowCount + (tile ? 1 : 0), 0);
    return sum + filled;
  }, 0);

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

const isDocumentVisible = (): boolean => {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible';
};

const toDurationSeconds = (durationMs: number): number => Math.max(1, Math.floor(Math.max(0, durationMs) / 1000));

const getSavedGameActiveDurationMs = (saved: SavedGameState): number => {
  if (typeof saved.activeDurationMs === 'number' && Number.isFinite(saved.activeDurationMs)) {
    return Math.max(0, Math.floor(saved.activeDurationMs));
  }
  const startedAt = typeof saved.startedAt === 'number' ? saved.startedAt : saved.savedAt;
  return Math.max(0, saved.savedAt - startedAt);
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
    body: '블록 슬라이드 (Block Slide)는 가로 모드를 지원하지 않습니다.',
  },
  en: {
    title: 'Please rotate to portrait mode',
    body: '블록 슬라이드 (Block Slide) does not support landscape mode.',
  },
  ja: {
    title: '縦向きにしてください',
    body: '블록 슬라이드 (Block Slide) は横向きモードに対応していません。',
  },
  zh: {
    title: '请切换为竖屏',
    body: '블록 슬라이드 (Block Slide) 不支持横屏模式。',
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

    // iOS WKWebView 콜드스타트: 초기 뷰포트가 0×0 일 수 있어 지연 재측정으로 보정
    const retryId = setTimeout(updateViewportSize, 120);

    window.addEventListener('resize', updateViewportSize);
    window.addEventListener('orientationchange', updateViewportSize);
    window.visualViewport?.addEventListener('resize', updateViewportSize);
    window.visualViewport?.addEventListener('scroll', updateViewportSize);

    return () => {
      clearTimeout(retryId);
      window.removeEventListener('resize', updateViewportSize);
      window.removeEventListener('orientationchange', updateViewportSize);
      window.visualViewport?.removeEventListener('resize', updateViewportSize);
      window.visualViewport?.removeEventListener('scroll', updateViewportSize);
    };
  }, []);

  // --- State ---
  const [isLoading, setIsLoading] = useState(true);
  const [nativeUpdateRequirement, setNativeUpdateRequirement] = useState<NativeUpdateRequirement | null>(null);
  const [isOpeningUpdateStore, setIsOpeningUpdateStore] = useState(false);
  const { gate: customizationGate, resolveTileAppearance, isWin98ThemeActive, premiumUiOverrides } = useBlockCustomization();
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

  useEffect(() => {
    if (!isNative || isAppIntoSBuild) {
      setNativeUpdateRequirement(null);
      setIsOpeningUpdateStore(false);
      return;
    }

    let isDisposed = false;
    let checkInFlight = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const runVersionCheck = async () => {
      if (checkInFlight) return;
      checkInFlight = true;
      try {
        const requirement = await checkNativeUpdateRequirement();
        if (!isDisposed) {
          setNativeUpdateRequirement(requirement);
          if (!requirement) {
            setIsOpeningUpdateStore(false);
          }
        }
      } finally {
        checkInFlight = false;
      }
    };

    void runVersionCheck();

    CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) return;
      void runVersionCheck();
    }).then((handle) => {
      if (isDisposed) {
        void handle.remove();
        return;
      }
      listenerHandle = handle;
    }).catch(() => {
      // ignore
    });

    return () => {
      isDisposed = true;
      if (listenerHandle) {
        void listenerHandle.remove();
      }
    };
  }, [isNative, isAppIntoSBuild]);

  useEffect(() => {
    if (!isOpeningUpdateStore) return;
    const timer = globalThis.setTimeout(() => {
      setIsOpeningUpdateStore(false);
    }, 2500);
    return () => globalThis.clearTimeout(timer);
  }, [isOpeningUpdateStore]);

  const [grid, setGrid] = useState<Grid>(createEmptyGrid(8));
  const [slots, setSlots] = useState<(Piece | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<Phase>(Phase.PLACE);
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(getViewportSize);
  const [layoutChromeHeights, setLayoutChromeHeights] = useState<LayoutChromeHeights>(DEFAULT_LAYOUT_CHROME_HEIGHTS);
  const [comboMessage, setComboMessage] = useState<string | null>(null);
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
  const [isSkinOpen, setIsSkinOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Name Input State
  const [isNameInputOpen, setIsNameInputOpen] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string>(loadInitialPlayerName);
  const [sessionLockedPlayerName, setSessionLockedPlayerName] = useState<string | null>(null);
  const [showActiveGameWarning, setShowActiveGameWarning] = useState(false);
  const [isActiveGameExitModalOpen, setIsActiveGameExitModalOpen] = useState(false);
  const [activeGameExitContext, setActiveGameExitContext] = useState<ActiveGameExitContext>('HOME');
  const [activeGameRankingSnapshot, setActiveGameRankingSnapshot] = useState<ActiveGameRankingSnapshot | null>(null);

  // 슬라이드 단계에서의 배치 허용 플래그(현재 룰에서는 항상 false를 유지)
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // Undo 시스템: 직전 스냅샷과 남은 사용 횟수
  const [lastSnapshot, setLastSnapshot] = useState<GameSnapshot | null>(null);
  const [undoRemaining, setUndoRemaining] = useState(INITIAL_UNDO_AMOUNT);
  const [blockRefreshRemaining, setBlockRefreshRemaining] = useState(INITIAL_BLOCK_REFRESH_AMOUNT);
  const [showBlockRefreshAdButton, setShowBlockRefreshAdButton] = useState(false);
  const [isBlockRefreshAdInProgress, setIsBlockRefreshAdInProgress] = useState(false);
  const [blockRefreshNotice, setBlockRefreshNotice] = useState<string | null>(null);

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
  const [isReviveSelectionMode, setIsReviveSelectionMode] = useState(false);
  const [reviveBreakRemaining, setReviveBreakRemaining] = useState(0);
  const [revivePendingTileId, setRevivePendingTileId] = useState<string | null>(null);
  const [reviveDestroyEffects, setReviveDestroyEffects] = useState<ReviveDestroyEffect[]>([]);

  // Check tutorial status on load
  useEffect(() => {
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted) {
      setTutorialStep(1); // Start with Drag tutorial
    }
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
  const gameStartTimeRef = useRef<number>(Date.now()); // Legacy start marker (migration compatibility)
  const activePlayDurationMsRef = useRef<number>(0); // 실제 플레이 누적 시간 (백그라운드 제외)
  const activePlayStartedAtRef = useRef<number | null>(null); // 플레이 타이머가 재개된 시각
  const moveCountRef = useRef<number>(0); // Anti-cheat move counter
  const sessionIdRef = useRef<string>(crypto.randomUUID()); // 게임 세션 ID
  const [liveRankEstimate, setLiveRankEstimate] = useState<LiveRankEstimate | null>(null); // 게임 중 예상 순위

  const boardMetricsRef = useRef<BoardMetrics | null>(null);
  const liveRankFailureCountRef = useRef(0);
  const liveRankRetryAfterRef = useRef(0);
  const liveRankLastRequestAtRef = useRef(0);
  const liveRankRequestInFlightRef = useRef(false);
  const liveRankRequestQueuedRef = useRef(false);
  const liveRankRequestSequenceRef = useRef(0);
  const hoverGridPosRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number, y: number } | null>(null); // 스와이프 시작 좌표
  const slideLockRef = useRef(false); // state 반영 전에도 즉시 입력 차단
  const isReviveSelectionModeRef = useRef(false); // 부활 선택 모드 동기 가드 (state보다 먼저 반영)
  const mergeClearTimeoutRef = useRef<number | null>(null);
  const mergeFinalizeTimeoutRef = useRef<number | null>(null);
  const unlockTimeoutRef = useRef<number | null>(null);
  const comboMessageTimeoutRef = useRef<number | null>(null);
  const blockRefreshNoticeTimeoutRef = useRef<number | null>(null);
  const reviveDestroyEffectTimeoutsRef = useRef<number[]>([]);
  const dragPointerIdRef = useRef<number | null>(null);
  const currentPointerPosRef = useRef<{ x: number, y: number } | null>(null);
  const scoreRef = useRef<number>(score);
  const boardSizeRef = useRef<BoardSize>(boardSize);
  const gameStateRef = useRef<GameState>(gameState);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  useEffect(() => {
    boardSizeRef.current = boardSize;
  }, [boardSize]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const pauseActivePlayTimer = useCallback(() => {
    const startedAt = activePlayStartedAtRef.current;
    if (startedAt === null) return;
    activePlayDurationMsRef.current += Math.max(0, Date.now() - startedAt);
    activePlayStartedAtRef.current = null;
  }, []);

  const resumeActivePlayTimer = useCallback(() => {
    if (activePlayStartedAtRef.current !== null) return;
    activePlayStartedAtRef.current = Date.now();
  }, []);

  const syncActivePlayTimer = useCallback(() => {
    const shouldRun = gameStateRef.current === GameState.PLAYING && isDocumentVisible();
    if (shouldRun) {
      resumeActivePlayTimer();
      return;
    }
    pauseActivePlayTimer();
  }, [pauseActivePlayTimer, resumeActivePlayTimer]);

  const getCurrentActiveDurationMs = useCallback((): number => {
    const startedAt = activePlayStartedAtRef.current;
    if (startedAt === null) return activePlayDurationMsRef.current;
    return activePlayDurationMsRef.current + Math.max(0, Date.now() - startedAt);
  }, []);

  const getCurrentActiveDurationSeconds = useCallback((): number => {
    return toDurationSeconds(getCurrentActiveDurationMs());
  }, [getCurrentActiveDurationMs]);

  useEffect(() => {
    syncActivePlayTimer();
  }, [gameState, syncActivePlayTimer]);

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
    setBlockRefreshRemaining(saved.blockRefreshRemaining ?? INITIAL_BLOCK_REFRESH_AMOUNT);
    setShowBlockRefreshAdButton(Boolean(saved.showBlockRefreshAdButton));
    setHasUsedReviveThisRun(Boolean(saved.hasUsedRevive));
    isReviveSelectionModeRef.current = Boolean(saved.isReviveSelectionMode);
    setIsReviveSelectionMode(Boolean(saved.isReviveSelectionMode));
    setReviveBreakRemaining(saved.reviveBreakRemaining ?? 0);
    setRevivePendingTileId(saved.revivePendingTileId ?? null);
    setReviveDestroyEffects([]);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    setIsBlockRefreshAdInProgress(false);
    liveRankFailureCountRef.current = 0;
    liveRankRetryAfterRef.current = 0;
    liveRankLastRequestAtRef.current = 0;
    liveRankRequestInFlightRef.current = false;
    liveRankRequestQueuedRef.current = false;
    setLiveRankEstimate(null);
    setPlayerName(
      getReusablePlayerName(saved.playerName) ??
      getReusablePlayerName(rankingService.getSavedName()) ??
      ''
    );
    setSessionLockedPlayerName(getReusablePlayerName(saved.sessionLockedPlayerName) ?? null);
    sessionIdRef.current = saved.sessionId ?? crypto.randomUUID();
    moveCountRef.current = typeof saved.moveCount === 'number' ? saved.moveCount : 0;
    gameStartTimeRef.current = typeof saved.startedAt === 'number' ? saved.startedAt : saved.savedAt;
    activePlayDurationMsRef.current = getSavedGameActiveDurationMs(saved);
    activePlayStartedAtRef.current =
      saved.gameState === GameState.PLAYING && isDocumentVisible()
        ? Date.now()
        : null;
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
    if (gameState !== GameState.PLAYING) {
      pauseActivePlayTimer();
    }

    const activeDurationMs = getCurrentActiveDurationMs();

    saveGameState({
      gameState,
      grid,
      slots,
      score,
      phase,
      boardSize,
      canSkipSlide,
      undoRemaining,
      blockRefreshRemaining,
      showBlockRefreshAdButton,
      lastSnapshot,
      hasUsedRevive: hasUsedReviveThisRun,
      isReviveSelectionMode,
      reviveBreakRemaining,
      revivePendingTileId,
      sessionId: sessionIdRef.current,
      moveCount: moveCountRef.current,
      startedAt: gameStartTimeRef.current,
      activeDurationMs,
      playerName,
      sessionLockedPlayerName: sessionLockedPlayerName ?? undefined,
    });
  }, [
    gameState,
    grid,
    slots,
    score,
    phase,
    boardSize,
    canSkipSlide,
    undoRemaining,
    blockRefreshRemaining,
    showBlockRefreshAdButton,
    lastSnapshot,
    hasUsedReviveThisRun,
    isReviveSelectionMode,
    reviveBreakRemaining,
    revivePendingTileId,
    playerName,
    sessionLockedPlayerName,
    pauseActivePlayTimer,
    getCurrentActiveDurationMs,
  ]);

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
      pauseActivePlayTimer();
      persistRecoverableGameState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushRecoverableState();
        return;
      }
      syncActivePlayTimer();
    };

    window.addEventListener('pagehide', flushRecoverableState);
    window.addEventListener('beforeunload', flushRecoverableState);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', flushRecoverableState);
      window.removeEventListener('beforeunload', flushRecoverableState);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [persistRecoverableGameState, pauseActivePlayTimer, syncActivePlayTimer]);

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
    if (gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) {
      const elapsedSeconds = getCurrentActiveDurationSeconds();
      return {
        sessionId: sessionIdRef.current,
        score,
        difficulty: `${boardSize}x${boardSize}`,
        duration: elapsedSeconds,
        moves: moveCountRef.current,
        playerName,
        sessionLockedPlayerName,
      };
    }

    const saved = loadGameState();
    if (!saved) return null;
    const elapsedSeconds = toDurationSeconds(getSavedGameActiveDurationMs(saved));

    return {
      sessionId: saved.sessionId ?? sessionIdRef.current,
      score: saved.score,
      difficulty: `${saved.boardSize}x${saved.boardSize}`,
      duration: elapsedSeconds,
      moves: typeof saved.moveCount === 'number' ? saved.moveCount : 0,
      playerName: saved.playerName ?? playerName,
      sessionLockedPlayerName: getReusablePlayerName(saved.sessionLockedPlayerName) ?? sessionLockedPlayerName,
    };
  }, [gameState, score, boardSize, playerName, sessionLockedPlayerName, getCurrentActiveDurationSeconds]);

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
    reviveDestroyEffectTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    reviveDestroyEffectTimeoutsRef.current = [];
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setReviveBreakRemaining(0);
    setRevivePendingTileId(null);
    setReviveDestroyEffects([]);
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

  const handleActiveGameExitNameLocked = useCallback((name: string) => {
    setSessionLockedPlayerName(name);
    setPlayerName(name);
    rankingService.saveName(name);
  }, []);

  const handleActiveGameExitIntermediateSaveComplete = useCallback(() => {
    setIsActiveGameExitModalOpen(false);
    setActiveGameRankingSnapshot(null);
  }, []);

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
    reviveDestroyEffectTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    reviveDestroyEffectTimeoutsRef.current = [];

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
    setUndoRemaining(INITIAL_UNDO_AMOUNT);
    setBlockRefreshRemaining(INITIAL_BLOCK_REFRESH_AMOUNT);
    setShowBlockRefreshAdButton(false);
    setHasUsedReviveThisRun(false);
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setReviveBreakRemaining(0);
    setRevivePendingTileId(null);
    setReviveDestroyEffects([]);
    setIsReviveAdInProgress(false);
    setIsReviveAdReady(false);
    setIsBlockRefreshAdInProgress(false);
    setSessionLockedPlayerName(null);

    // Anti-cheat: Start Timer & Session ID
    const now = Date.now();
    gameStartTimeRef.current = now;
    activePlayDurationMsRef.current = 0;
    activePlayStartedAtRef.current = isDocumentVisible() ? now : null;
    moveCountRef.current = 0;
    sessionIdRef.current = crypto.randomUUID(); // 새 게임마다 고유 세션 ID 생성
    liveRankFailureCountRef.current = 0;
    liveRankRetryAfterRef.current = 0;
    liveRankLastRequestAtRef.current = 0;
    liveRankRequestInFlightRef.current = false;
    liveRankRequestQueuedRef.current = false;
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

  const showBlockRefreshNotice = useCallback((message: string, durationMs = 1600) => {
    setBlockRefreshNotice(message);
    if (blockRefreshNoticeTimeoutRef.current) {
      window.clearTimeout(blockRefreshNoticeTimeoutRef.current);
      blockRefreshNoticeTimeoutRef.current = null;
    }
    blockRefreshNoticeTimeoutRef.current = window.setTimeout(() => {
      setBlockRefreshNotice(null);
      blockRefreshNoticeTimeoutRef.current = null;
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
      onRewardEarned: () => {
        // 🎯 보상 지급: 되돌리기 횟수 충전
        const actualAmount = REWARD_UNDO_AMOUNT;
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
        showComboMessage(String(t('game:rewardAd.error')), 2200);
      },
      onDailyLimitReached: () => {
        showComboMessage(String(t('game:rewardAd.dailyLimitReached')), 2200);
      },
    });
  }, [t, showComboMessage]);

  const handleRefreshPreviewBlocks = useCallback(() => {
    if (isAnimating || isReviveSelectionMode || draggingPiece) return;

    if (blockRefreshRemaining <= 0) {
      showBlockRefreshNotice(String(t('game:blockRefresh.limitExceeded')));
      setShowBlockRefreshAdButton(true);
      return;
    }

    setSlots((prevSlots) => generateRefreshedSlotPieces(prevSlots, prevSlots.length));
    setBlockRefreshRemaining((prev) => Math.max(0, prev - 1));
  }, [
    blockRefreshRemaining,
    draggingPiece,
    isAnimating,
    isReviveSelectionMode,
    showBlockRefreshNotice,
    t,
  ]);

  const handleWatchBlockRefreshAd = useCallback(() => {
    if (!isBlockRefreshRewardInterstitialAdSupported()) {
      showBlockRefreshNotice(String(t('game:blockRefresh.ad.notSupported')));
      return;
    }

    if (isBlockRefreshAdInProgress) return;
    setIsBlockRefreshAdInProgress(true);

    blockRefreshRewardInterstitialAdService.showRewardAd({
      onRewardEarned: () => {
        setBlockRefreshRemaining((prev) => Math.min(prev + REWARD_BLOCK_REFRESH_AMOUNT, 99));
        setShowBlockRefreshAdButton(false);
        setIsBlockRefreshAdInProgress(false);
        showComboMessage(String(t('game:blockRefresh.ad.rewardEarned', { amount: REWARD_BLOCK_REFRESH_AMOUNT } as any)), 2000);
      },
      onAdClosed: () => {
        setIsBlockRefreshAdInProgress(false);
      },
      onError: (error) => {
        console.error('[App] 블록 새로고침 보상형 전면 광고 오류:', error);
        setIsBlockRefreshAdInProgress(false);
        showBlockRefreshNotice(String(t('game:blockRefresh.ad.error')));
      },
      onDailyLimitReached: () => {
        setIsBlockRefreshAdInProgress(false);
        showBlockRefreshNotice(String(t('game:blockRefresh.ad.dailyLimitReached')));
      },
    });
  }, [isBlockRefreshAdInProgress, showBlockRefreshNotice, showComboMessage, t]);

  const handleWatchReviveAd = useCallback(() => {
    if (isReviveAdInProgress) return;
    if (countOccupiedTiles(grid) <= 0) {
      showComboMessage(String(t('modals:gameOver.reviveUnavailable')), 1800);
      return;
    }

    setIsReviveAdInProgress(true);

    rewardInterstitialAdService.showReviveAd({
      onRewardEarned: () => {
        const destroyCount = REVIVE_DESTROY_COUNT_BY_BOARD_SIZE[boardSize];

        // ref를 state보다 먼저 동기적으로 설정하여
        // 네이티브 콜백 내 개별 setState 사이에 게임오버 체크가 끼어드는 것을 방지
        isReviveSelectionModeRef.current = true;

        // 이전 슬라이드 애니메이션 잔여 타임아웃 정리 (부활 도중 예기치 않은 상태 변경 방지)
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

        setMergingTiles(EMPTY_MERGING_TILES);
        setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
        slideLockRef.current = false;
        setIsAnimating(false);
        setLastSnapshot(null);
        setPhase(Phase.PLACE);
        setCanSkipSlide(false);
        setReviveDestroyEffects([]);
        setRevivePendingTileId(null);
        setReviveBreakRemaining(destroyCount);
        setIsReviveSelectionMode(true);

        setGameState(GameState.PLAYING);
        setHasUsedReviveThisRun(true);
        setIsReviveAdInProgress(false);
        showComboMessage(String(t('modals:gameOver.reviveSuccess', { count: destroyCount } as any)), 1800);
      },
      onAdClosed: () => {
        setIsReviveAdInProgress(false);
        setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
      },
      onError: (error) => {
        console.error('[App] 보상형 전면 광고 오류:', error);
        setIsReviveAdInProgress(false);
        setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
        showComboMessage(String(t('modals:gameOver.reviveError')), 2200);
      },
      onDailyLimitReached: () => {
        setIsReviveAdInProgress(false);
        showComboMessage(String(t('modals:gameOver.reviveDailyLimitReached')), 2200);
      },
    });
  }, [boardSize, grid, isReviveAdInProgress, showComboMessage, t]);

  const handleReviveTileTap = useCallback((tileId: string) => {
    if (!isReviveSelectionMode || gameState !== GameState.PLAYING) return;
    if (isAnimating || slideLockRef.current) return;
    if (reviveBreakRemaining <= 0) return;

    if (revivePendingTileId !== tileId) {
      setRevivePendingTileId(tileId);
      return;
    }

    let targetX = -1;
    let targetY = -1;
    let targetValue = 0;
    for (let y = 0; y < grid.length; y += 1) {
      const row = grid[y];
      for (let x = 0; x < row.length; x += 1) {
        const tile = row[x];
        if (!tile || tile.id !== tileId) continue;
        targetX = x;
        targetY = y;
        targetValue = tile.value;
        break;
      }
      if (targetX >= 0) break;
    }

    setRevivePendingTileId(null);
    if (targetX < 0 || targetY < 0) return;

    setGrid((prevGrid) =>
      prevGrid.map((row, y) =>
        row.map((tile, x) => (x === targetX && y === targetY ? null : tile))
      )
    );

    const effect: ReviveDestroyEffect = {
      id: `${tileId}-${Date.now()}`,
      x: targetX,
      y: targetY,
      value: targetValue,
    };
    setReviveBreakRemaining((prev) => Math.max(prev - 1, 0));
    setReviveDestroyEffects((prev) => [...prev, effect]);

    const timeoutId = window.setTimeout(() => {
      setReviveDestroyEffects((prev) => prev.filter((item) => item.id !== effect.id));
      reviveDestroyEffectTimeoutsRef.current = reviveDestroyEffectTimeoutsRef.current.filter((id) => id !== timeoutId);
    }, 240);
    reviveDestroyEffectTimeoutsRef.current.push(timeoutId);
  }, [gameState, grid, isAnimating, isReviveSelectionMode, reviveBreakRemaining, revivePendingTileId]);

  useEffect(() => {
    if (!isReviveSelectionMode) return;
    const occupied = countOccupiedTiles(grid);
    if (reviveBreakRemaining > 0 && occupied > 0) return;

    const exhaustedByCount = reviveBreakRemaining <= 0;
    isReviveSelectionModeRef.current = false;
    setIsReviveSelectionMode(false);
    setRevivePendingTileId(null);
    setReviveBreakRemaining(0);
    // 부활 파괴 모드가 끝나면 블록 배치가 아니라 스와이프 단계부터 재개한다.
    setPhase(Phase.SLIDE);
    setCanSkipSlide(false);

    if (exhaustedByCount) {
      showComboMessage(String(t('modals:gameOver.reviveSelectionComplete')), 1600);
      return;
    }
    showComboMessage(String(t('modals:gameOver.reviveNoTargets')), 1600);
  }, [grid, isReviveSelectionMode, reviveBreakRemaining, showComboMessage, t]);

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

  useEffect(() => {
    if (blockRefreshRemaining > 0 && showBlockRefreshAdButton) {
      setShowBlockRefreshAdButton(false);
    }
  }, [blockRefreshRemaining, showBlockRefreshAdButton]);

  // 블록 새로고침 보상형 전면 광고 미리 로드
  useEffect(() => {
    if (!isBlockRefreshRewardInterstitialAdSupported()) return;

    if (gameState === GameState.PLAYING && showBlockRefreshAdButton) {
      blockRefreshRewardInterstitialAdService.preloadAd();
      return;
    }

    if (gameState === GameState.MENU) {
      blockRefreshRewardInterstitialAdService.cleanup();
      setIsBlockRefreshAdInProgress(false);
    }
  }, [gameState, showBlockRefreshAdButton]);

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
      isReviveSelectionModeRef.current = false;
      setIsReviveSelectionMode(false);
      setReviveBreakRemaining(0);
      setRevivePendingTileId(null);
      setReviveDestroyEffects([]);
    }
  }, [gameState, hasUsedReviveThisRun]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (mergeClearTimeoutRef.current) window.clearTimeout(mergeClearTimeoutRef.current);
      if (mergeFinalizeTimeoutRef.current) window.clearTimeout(mergeFinalizeTimeoutRef.current);
      if (unlockTimeoutRef.current) window.clearTimeout(unlockTimeoutRef.current);
      if (comboMessageTimeoutRef.current) window.clearTimeout(comboMessageTimeoutRef.current);
      if (blockRefreshNoticeTimeoutRef.current) window.clearTimeout(blockRefreshNoticeTimeoutRef.current);
      reviveDestroyEffectTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      reviveDestroyEffectTimeoutsRef.current = [];
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

    // Board 컴포넌트와 동일하게 grid.length 기반으로 계산하여 일관성 보장
    const size = grid.length;
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
  }, [grid]);

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
    if (isReviveSelectionMode) return;
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
  }, [phase, canSkipSlide, draggingPiece, isReviveSelectionMode, readBoardMetrics, applyDragOverlayTransform]);

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
    if (isReviveSelectionMode) return;
    if (phase !== Phase.SLIDE) return;
    if (slideLockRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('button, input, select, textarea, [role="button"]')) return;

    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleScreenPointerDown = (e: React.PointerEvent) => {
    if (isReviveSelectionMode) return;

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
    if (isReviveSelectionMode) {
      swipeStartRef.current = null;
      return;
    }

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
      if (e.key === 'r' || e.key === 'R') {
        if (draggingPiece) rotateActivePiece();
      }

      if (isReviveSelectionMode) {
        if (e.key === 'Escape') {
          setRevivePendingTileId(null);
        }
        return;
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
  }, [
    gameState,
    phase,
    draggingPiece,
    rotateActivePiece,
    isReviveSelectionMode,
  ]);

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

    // Post-animation 상태 변경을 스태거링하여 한 프레임에 몰리는 글리치 방지
    // Step 1 (lockMs): 병합 고스트 타일 제거 (위에서 이미 설정됨)
    // Step 2 (lockMs + 16ms): 값/점수 반영
    // Step 3 (lockMs + 32ms): 입력 해제
    if (mergeFinalizeTimeoutRef.current) {
      window.clearTimeout(mergeFinalizeTimeoutRef.current);
      mergeFinalizeTimeoutRef.current = null;
    }
    if (scoreAdded > 0) {
      mergeFinalizeTimeoutRef.current = window.setTimeout(() => {
        setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
        setScore(prev => prev + scoreAdded);
        mergeFinalizeTimeoutRef.current = null;
      }, lockMs + 16);
    }

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
      } else {
        finishSlideTurn();
      }
    }, lockMs + 32);
  };

  // --- Game Over Check ---
  useEffect(() => {
    // 애니메이션이 진행 중이면 게임 오버 체크 연기
    // (슬라이드 후 grid가 업데이트되는 도중에 체크하면 잘못된 판정 발생)
    if (isAnimating || slideLockRef.current) {
      return;
    }

    if (gameState !== GameState.PLAYING) return;
    // state + ref 이중 가드: 네이티브 광고 콜백의 비동기 타이밍으로 인해
    // state가 아직 반영되지 않은 중간 렌더에서도 게임오버 판정을 방지
    if (isReviveSelectionMode || isReviveSelectionModeRef.current) return;

    const availability = getTurnActionAvailability(grid, slots);

    if (phase === Phase.SLIDE && !availability.canSwipe) {
      finishSlideTurn();
      return;
    }

    if (phase === Phase.PLACE && availability.isGameOver) {
      setIsReviveAdReady(rewardInterstitialAdService.isAdReady());
      if (isRewardInterstitialAdSupported() && !rewardInterstitialAdService.isAdReady()) {
        rewardInterstitialAdService.preloadAd();
      }
      setGameState(GameState.GAME_OVER);
      if (score > highScore) setHighScore(score);
    }
  }, [phase, grid, slots, gameState, score, highScore, isAnimating, finishSlideTurn, isReviveSelectionMode]);

  const refreshLiveRankEstimate = useCallback(async (force = false) => {
    if (gameStateRef.current !== GameState.PLAYING) return;

    const now = Date.now();
    if (!force && now < liveRankRetryAfterRef.current) return;
    if (!force && now - liveRankLastRequestAtRef.current < LIVE_RANK_MIN_REQUEST_INTERVAL_MS) return;

    if (liveRankRequestInFlightRef.current) {
      liveRankRequestQueuedRef.current = true;
      return;
    }

    liveRankRequestInFlightRef.current = true;
    liveRankLastRequestAtRef.current = now;
    const requestSequence = ++liveRankRequestSequenceRef.current;
    const requestedScore = scoreRef.current;
    const requestedDifficulty = String(boardSizeRef.current);

    try {
      const estimate = await rankingService.getLiveRankEstimate(requestedScore, requestedDifficulty);
      if (requestSequence !== liveRankRequestSequenceRef.current) return;

      liveRankFailureCountRef.current = 0;
      liveRankRetryAfterRef.current = 0;

      if (gameStateRef.current !== GameState.PLAYING) return;
      if (requestedScore !== scoreRef.current || requestedDifficulty !== String(boardSizeRef.current)) {
        liveRankRequestQueuedRef.current = true;
        return;
      }

      setLiveRankEstimate(estimate);
    } catch (error) {
      if (requestSequence !== liveRankRequestSequenceRef.current) return;

      liveRankFailureCountRef.current += 1;
      const cappedFailures = Math.min(liveRankFailureCountRef.current, 6);
      const backoffMs = Math.min(120_000, 5_000 * (2 ** (cappedFailures - 1)));
      liveRankRetryAfterRef.current = Date.now() + backoffMs;

      if (import.meta.env.DEV && liveRankFailureCountRef.current === 1) {
        console.warn('[랭킹 추정] 실시간 랭킹 조회 실패:', error);
      }
    } finally {
      liveRankRequestInFlightRef.current = false;
      if (liveRankRequestQueuedRef.current) {
        liveRankRequestQueuedRef.current = false;
        void refreshLiveRankEstimate();
      }
    }
  }, []);

  // --- 게임 중 예상 랭킹 업데이트 ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      liveRankFailureCountRef.current = 0;
      liveRankRetryAfterRef.current = 0;
      liveRankLastRequestAtRef.current = 0;
      liveRankRequestInFlightRef.current = false;
      liveRankRequestQueuedRef.current = false;
      setLiveRankEstimate(null);
      return;
    }

    void refreshLiveRankEstimate(true);
    const intervalId = window.setInterval(() => {
      void refreshLiveRankEstimate();
    }, LIVE_RANK_POLL_INTERVAL_MS);
    const handleOnline = () => {
      void refreshLiveRankEstimate(true);
    };
    window.addEventListener('online', handleOnline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
    };
  }, [gameState, refreshLiveRankEstimate]);

  // 점수/난이도 변경 시 실제 랭킹 기준으로 빠르게 동기화
  useEffect(() => {
    if (gameState !== GameState.PLAYING) return;

    const timeoutId = window.setTimeout(() => {
      void refreshLiveRankEstimate();
    }, LIVE_RANK_SCORE_SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [gameState, score, boardSize, refreshLiveRankEstimate]);


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

  const handleOpenNativeUpdateStore = useCallback(() => {
    if (!nativeUpdateRequirement) return;
    setIsOpeningUpdateStore(true);
    openNativeMarketForUpdate(nativeUpdateRequirement);
  }, [nativeUpdateRequirement]);

  // --- Views ---

  if (shouldShowPortraitLockOverlay) {
    return (
      <>
        <CookieConsent />
        <div className={`${isWin98ThemeActive ? 'win98-app-shell' : ''} min-h-screen min-h-[100dvh] flex items-center justify-center px-6 py-10 bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900`}>
          <div className={`w-full max-w-sm rounded-3xl border border-white/70 bg-white/80 backdrop-blur-sm shadow-xl p-8 text-center space-y-3 ${isWin98ThemeActive ? 'win98-window' : ''}`}>
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

  if (nativeUpdateRequirement) {
    return (
      <>
        <NativeUpdateModal
          open
          requirement={nativeUpdateRequirement}
          isOpeningStore={isOpeningUpdateStore}
          onUpdateNow={handleOpenNativeUpdateStore}
        />
        <AnimatePresence mode="wait">
          {isLoading && <LoadingScreen key="loading-screen-update-gate" />}
        </AnimatePresence>
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

  const premiumUi = premiumUiOverrides;
  const premiumMenuActionRadioGroupName = premiumUi?.menuActionRadioGroupName ?? 'menu-action-win98';
  const premiumDifficultyRadioGroupName = premiumUi?.difficultyRadioGroupName ?? 'difficulty-win98';
  const premiumLanguageRadioGroupName = premiumUi?.languageRadioGroupName ?? 'menu-language-win98';
  const premiumTopWindowTitle = premiumUi?.topWindowTitle ?? '블록 슬라이드\n(Block Slide)';
  const premiumTopWindowTitleLines = premiumTopWindowTitle.split('\n');
  const premiumTopWindowTitleSingleLine = premiumTopWindowTitleLines.join(' ');

  // ========== MENU SCREEN ==========
  if (gameState === GameState.MENU) {
    const shouldSuppressGameModeTutorial =
      isNameInputOpen || isCustomizationOpen || isLeaderboardOpen || isActiveGameExitModalOpen;

    const handleReplayTutorial = () => {
      localStorage.removeItem('tutorial_back_nav_seen_v1');
      localStorage.removeItem('tutorial_game_mode_seen_v1');
      localStorage.removeItem('tutorial_completed');
      setTutorialResetKey(prev => prev + 1);
      setTutorialStep(1);
      const btn = document.getElementById('replay-tutorial-btn');
      if(btn) {
        btn.innerText = "✨ " + t('common:actions.resetDone', '리셋 완료!');
        setTimeout(() => {
            if(btn) btn.innerText = t('common:actions.replayTutorial', '튜토리얼 다시보기');
        }, 1500);
      }
    };

    const setLanguageFromMenu = (langCode: SupportedLanguage) => {
      i18n.changeLanguage(langCode);
      try {
        localStorage.setItem('slidemino-language', langCode);
      } catch {
        // ignore
      }
    };

    const currentLang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
    const win98UtilityButtons = (
      <fieldset>
        <legend>{premiumUi?.utilityLegend ?? '메뉴'}</legend>
        {isNativeApp() && (
          <div className="field-row">
            <input id="menu-action-skin" type="radio" name={premiumMenuActionRadioGroupName} onClick={() => setIsSkinOpen(true)} readOnly />
            <label htmlFor="menu-action-skin">{t('game:actions.skin')}</label>
          </div>
        )}

        {!isNativeApp() && (
          <div className="field-row">
            <input
              id="menu-action-customize"
              type="radio"
              name={premiumMenuActionRadioGroupName}
              onClick={() => setIsCustomizationOpen(true)}
              disabled={!customizationGate.allowed}
              readOnly
            />
            <label htmlFor="menu-action-customize">
              {!customizationGate.allowed
                ? `${t('game:actions.customization')} (${customizationGate.reasonKey ? t(customizationGate.reasonKey as any) : t('game:actions.locked')})`
                : t('game:actions.customization')}
            </label>
          </div>
        )}

        <div className="field-row">
          <input id="menu-action-leaderboard" type="radio" name={premiumMenuActionRadioGroupName} onClick={() => setIsLeaderboardOpen(true)} readOnly />
          <label htmlFor="menu-action-leaderboard">{t('game:actions.leaderboard')}</label>
        </div>

        <div className="field-row">
          <input id="menu-action-replay" type="radio" name={premiumMenuActionRadioGroupName} onClick={handleReplayTutorial} readOnly />
          <label htmlFor="menu-action-replay">{t('common:actions.replayTutorial', '튜토리얼 다시보기')}</label>
        </div>

        <fieldset style={{ marginTop: '8px' }}>
          <legend>{premiumUi?.languageLegend ?? '언어'}</legend>
          {(Object.keys(LANGUAGE_CONFIGS) as SupportedLanguage[]).map((langCode) => (
            <div key={langCode} className="field-row">
              <input
                id={`menu-lang-${langCode}`}
                type="radio"
                name={premiumLanguageRadioGroupName}
                checked={currentLang === langCode}
                onClick={() => setLanguageFromMenu(langCode)}
                readOnly
              />
              <label htmlFor={`menu-lang-${langCode}`}>
                {LANGUAGE_CONFIGS[langCode].displayName} {LANGUAGE_CONFIGS[langCode].flag}
              </label>
            </div>
          ))}
        </fieldset>
      </fieldset>
    );

    const win98DifficultyRows = (
      <>
        {hasActiveGame() && (
          <div className="field-row">
            <input
              id="difficulty-continue"
              type="radio"
              name={premiumDifficultyRadioGroupName}
              onChange={() => {
                const saved = loadGameState();
                if (saved) {
                  restoreSavedGame(saved);
                }
              }}
            />
            <label htmlFor="difficulty-continue">{t('game:difficulties.continue')} ({boardSize}×{boardSize})</label>
          </div>
        )}

        <div className="field-row">
          <input id="difficulty-4" type="radio" name={premiumDifficultyRadioGroupName} checked={boardSize === 4} onChange={() => tryStartGame(4)} />
          <label htmlFor="difficulty-4">{t('game:difficulties.expert')} ({t('game:boardSizes.4x4')})</label>
        </div>
        <div className="field-row">
          <input
            id="difficulty-5"
            type="radio"
            name={premiumDifficultyRadioGroupName}
            checked={boardSize === 5}
            onChange={() => {
              tryStartGame(5);
              localStorage.setItem('tutorial_game_mode_seen_v1', 'true');
            }}
          />
          <label htmlFor="difficulty-5">{t('game:difficulties.normal')} ({t('game:boardSizes.5x5')})</label>
        </div>
        <div className="field-row">
          <input id="difficulty-7" type="radio" name={premiumDifficultyRadioGroupName} checked={boardSize === 7} onChange={() => tryStartGame(7)} />
          <label htmlFor="difficulty-7">{t('game:difficulties.beginner')} ({t('game:boardSizes.7x7')})</label>
        </div>
        <div className="field-row">
          <input id="difficulty-8" type="radio" name={premiumDifficultyRadioGroupName} checked={boardSize === 8} onChange={() => tryStartGame(8)} />
          <label htmlFor="difficulty-8">{t('game:difficulties.easy')} ({t('game:boardSizes.8x8')})</label>
        </div>
        <div className="field-row">
          <input id="difficulty-10" type="radio" name={premiumDifficultyRadioGroupName} checked={boardSize === 10} onChange={() => tryStartGame(10)} />
          <label htmlFor="difficulty-10">{t('game:difficulties.infinite')} ({t('game:boardSizes.10x10')})</label>
        </div>
      </>
    );

    const menuActionButtons = (
      <>
        <AnimatePresence mode="wait">
          {isLoading && <LoadingScreen key="loading-screen-menu" />}
        </AnimatePresence>

        {hasActiveGame() && (
          <button
            onClick={() => {
              const saved = loadGameState();
              if (saved) {
                restoreSavedGame(saved);
              }
            }}
            className="
            relative group w-full py-4 px-6 rounded-2xl win98-menu-btn
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
              <span className={`${isWin98ThemeActive ? 'win98-muted' : 'text-emerald-200/70'} font-normal text-sm`}>{boardSize}×{boardSize}</span>
            </span>
          </button>
        )}

        <button
          onClick={() => tryStartGame(4)}
          className="
          relative group w-full py-4 px-6 rounded-2xl win98-menu-btn
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
            <span className={`${isWin98ThemeActive ? 'win98-muted' : 'text-red-200/70'} font-normal text-sm`}>{t('game:boardSizes.4x4')}</span>
          </span>
        </button>

        <button
          id="mode-btn-beginner"
          onClick={() => {
            tryStartGame(5);
            localStorage.setItem('tutorial_game_mode_seen_v1', 'true');
          }}
          className="
          relative group w-full py-4 px-6 rounded-2xl win98-menu-btn
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
            <span className={`${isWin98ThemeActive ? 'win98-muted' : 'text-blue-200/70'} font-normal text-sm`}>{t('game:boardSizes.5x5')}</span>
          </span>
        </button>

        <button
          onClick={() => tryStartGame(7)}
          className="
          relative group w-full py-4 px-6 rounded-2xl win98-menu-btn
          bg-gradient-to-br from-indigo-600 to-indigo-800
          border border-indigo-400/30
          shadow-lg shadow-indigo-900/20
          hover:shadow-xl hover:shadow-indigo-600/30 hover:-translate-y-0.5
          active:translate-y-0 active:shadow-md
          transition-all duration-200 ease-out
          text-white font-semibold text-lg
        "
        >
          <span className="flex items-center justify-between">
            <span>{t('game:difficulties.beginner')}</span>
            <span className={`${isWin98ThemeActive ? 'win98-muted' : 'text-indigo-200/70'} font-normal text-sm`}>{t('game:boardSizes.7x7')}</span>
          </span>
        </button>

        <button
          onClick={() => tryStartGame(8)}
          className="
          relative group w-full py-4 px-6 rounded-2xl win98-menu-btn
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
            <span className={`${isWin98ThemeActive ? 'win98-muted' : 'text-gray-400'} font-normal text-sm`}>{t('game:boardSizes.8x8')}</span>
          </span>
        </button>

        <button
          onClick={() => tryStartGame(10)}
          className="
          relative group w-full py-4 px-6 rounded-2xl win98-menu-btn
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
            <span>{t('game:difficulties.infinite')}</span>
            <span className={`${isWin98ThemeActive ? 'win98-muted' : 'text-gray-500'} font-normal text-sm`}>{t('game:boardSizes.10x10')}</span>
          </span>
        </button>

        {isNativeApp() && (
          <button
            id="menu-skin-btn"
            onClick={() => setIsSkinOpen(true)}
            className={`
            relative group w-full py-3.5 px-6 rounded-2xl win98-menu-btn
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
              {t('game:actions.skin')}
            </span>
            <span className="text-gray-400 font-normal text-sm">{t('game:actions.skinDescription')}</span>
          </button>
        )}

        {!isNativeApp() && (
          <button
            onClick={() => setIsCustomizationOpen(true)}
            className={`
            relative group w-full py-3.5 px-6 rounded-2xl win98-menu-btn
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
        )}

        <button
          onClick={() => setIsLeaderboardOpen(true)}
          className={`
          relative group w-full py-3.5 px-6 rounded-2xl win98-menu-btn
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

        {!isWin98ThemeActive && <LanguageSwitcher />}

        <button
          onClick={handleReplayTutorial}
          id="replay-tutorial-btn"
          className="
            w-full py-3.5 px-6 rounded-2xl win98-menu-btn
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
      </>
    );

    return (
      <>
        <CookieConsent />
        {comboMessage && (
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed left-1/2 top-[calc(12px+var(--app-safe-top))] z-[120] w-max max-w-[92vw] -translate-x-1/2 rounded-full bg-gray-900/92 px-4 py-2 text-center text-[12px] font-medium text-white shadow-xl backdrop-blur-sm whitespace-pre-line"
          >
            {comboMessage}
          </div>
        )}
        <div
          className={`${isWin98ThemeActive ? 'win98-app-shell' : ''} min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-6`}
          style={{ paddingTop: 'calc(0.5rem + var(--app-safe-top))' }}
        >
          {isWin98ThemeActive && (
            <div className="window w-full max-w-md win98-top-window">
              <div className="title-bar">
                <div className="title-bar-text">
                  {premiumTopWindowTitleLines.map((line, index) => (
                    <React.Fragment key={`${line}-${index}`}>
                      {line}
                      {index < premiumTopWindowTitleLines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </div>
                <div className="title-bar-controls">
                  <button aria-label="Help" onClick={() => setIsLeaderboardOpen(true)} />
                </div>
              </div>
            </div>
          )}

          {/* 로고 영역 */}
          <div className="text-center space-y-3 animate-fade-in">
            <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
              {isWin98ThemeActive ? (
                (() => {
                  const titleText = String(t('game:title'));
                  const matched = titleText.match(/^(.*)\s\((.*)\)$/);
                  if (!matched) return titleText;
                  return (
                    <>
                      {matched[1]}
                      <br />
                      ({matched[2]})
                    </>
                  );
                })()
              ) : (
                t('game:title')
              )}
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

          {isWin98ThemeActive ? (
            <div className="window w-full max-w-md animate-slide-up win98-menu-window">
              <div className="title-bar">
                <div className="title-bar-text">{premiumUi?.menuWindowTitle ?? '난이도 선택'}</div>
                <div className="title-bar-controls">
                  <button aria-label="Close" onClick={() => setIsLeaderboardOpen(false)} />
                </div>
              </div>
              <div className="window-body">
                <div className="win98-radio-group">
                  <fieldset>
                    <legend>{premiumUi?.difficultyLegend ?? '난이도 선택 메뉴'}</legend>
                    {win98DifficultyRows}
                  </fieldset>
                  {win98UtilityButtons}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
              {menuActionButtons}
            </div>
          )}

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

          <SkinModal
            open={isSkinOpen}
            onClose={() => setIsSkinOpen(false)}
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
              lockedPlayerName={activeGameRankingSnapshot.sessionLockedPlayerName}
              isWin98ThemeActive={isWin98ThemeActive}
              onCancel={handleActiveGameExitCancel}
              onProceedWithoutRegister={handleActiveGameExitProceedWithoutRegister}
              onIntermediateSaveComplete={handleActiveGameExitIntermediateSaveComplete}
              onSessionNameLocked={handleActiveGameExitNameLocked}
              onRegisteredAndProceed={handleActiveGameExitRegisteredAndProceed}
            />
          )}
          
          <GameModeTutorial
            key={tutorialResetKey}
            suppressed={shouldSuppressGameModeTutorial}
          />
          <SkinFeatureTutorial isMenuVisible={true} />
        </div>
      </>
    );
  }

  const reviveDestroyCount = REVIVE_DESTROY_COUNT_BY_BOARD_SIZE[boardSize];
  const occupiedTileCount = countOccupiedTiles(grid);
  const canOfferRevive =
    isRewardInterstitialAdSupported() &&
    !hasUsedReviveThisRun &&
    occupiedTileCount > 0 &&
    !isReviveSelectionMode;
  const reviveSelectionHintKey = revivePendingTileId
    ? 'modals:gameOver.reviveSelectionConfirmHint'
    : 'modals:gameOver.reviveSelectionHint';

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
    : (isSwipeFocusMode ? 'opacity-45 grayscale-[0.4] saturate-75 blur-[1.5px]' : 'opacity-100');
  const phaseIndicatorInteractivityClass = isPlacePhase && !isReviveSelectionMode
    ? 'pointer-events-auto'
    : 'pointer-events-none opacity-35 grayscale select-none';

  // 모드 알리미(phase) 상태 기반 포커스:
  // - PLACE: 보드 + 슬롯 강조
  // - SLIDE: 보드 + Undo 강조 (슬롯은 비강조)
  const isSlotPointerLocked = isSwipePhase || isAnimating || isReviveSelectionMode;
  const isSlotDisabled = isAnimating || isReviveSelectionMode;
  const shouldShowBlockRefreshAdCta = showBlockRefreshAdButton && blockRefreshRemaining <= 0;
  const isBlockRefreshButtonDisabled = isAnimating || isReviveSelectionMode || Boolean(draggingPiece);

  // ========== GAME SCREEN ==========
  return (
    <>
      <CookieConsent />
      {comboMessage && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed left-1/2 top-[calc(12px+var(--app-safe-top))] z-[120] w-max max-w-[92vw] -translate-x-1/2 rounded-full bg-gray-900/92 px-4 py-2 text-center text-[12px] font-medium text-white shadow-xl backdrop-blur-sm whitespace-pre-line"
        >
          {comboMessage}
        </div>
      )}
      <div
        className={`${isWin98ThemeActive ? 'win98-app-shell' : ''} min-h-screen min-h-[100dvh] flex flex-col items-center text-gray-900 touch-none`}
        onPointerDown={handleScreenPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {isWin98ThemeActive && (
          <div
            className="window w-full"
            style={{
              maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
              marginTop: 'calc(8px + var(--game-safe-top))',
            }}
          >
            <div className="title-bar">
              <div className="title-bar-text">{premiumTopWindowTitleSingleLine}</div>
              <div className="title-bar-controls">
                <button aria-label="Help" onClick={() => setShowHelpModal(true)} />
                <button aria-label="Close" onClick={handleHomeButtonClick} disabled={isAnimating} />
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <header
          ref={headerRef}
          className={`w-full flex justify-between items-center p-4 ${isWin98ThemeActive ? 'win98-game-header' : ''}`}
          style={{
            maxWidth: `${gameLayoutProfile.columnWidthPx}px`,
            paddingTop: isWin98ThemeActive ? '8px' : 'calc(16px + var(--game-safe-top))',
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
              p-2.5 rounded-full flex items-center justify-center win98-icon-btn
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
            px-4 py-2 rounded-full text-sm font-semibold flex items-center justify-center gap-2 win98-pill-btn
            ${isWin98ThemeActive ? 'win98-header-main-btn' : ''}
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
                disabled={isReviveSelectionMode}
                className={`
                  p-2 rounded-full text-gray-600 win98-icon-btn ${isWin98ThemeActive ? 'win98-header-icon-btn' : ''}
                  flex items-center justify-center leading-none
                  bg-white/70 hover:bg-white border border-white/50
                  shadow-sm hover:shadow-md transition-all duration-200 active:scale-95
                  ${(isSwipeFocusMode || isReviveSelectionMode) ? 'opacity-35 grayscale pointer-events-none select-none' : ''}
                `}
                aria-label={t('common:aria.help')}
              >
                <HelpCircle size={18} className="block" />
              </button>

              {/* Undo / Recharge Button (single slot) */}
              <button
                id="game-undo-btn"
                type="button"
                onPointerDown={(e) => {
                  e.stopPropagation();
                }}
                onClick={undoRemaining === 0 && isRewardAdSupported() ? handleWatchRewardAd : executeUndo}
                disabled={
                  undoRemaining === 0 && isRewardAdSupported()
                    ? (isAnimating || isReviveSelectionMode)
                    : (!lastSnapshot || undoRemaining <= 0 || isAnimating || isReviveSelectionMode)
                }
                aria-label={
                  undoRemaining === 0 && isRewardAdSupported()
                    ? t('game:rewardAd.watchButtonFull')
                    : t('game:actions.undo')
                }
                className={`
                px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-2 win98-game-btn ${isWin98ThemeActive ? 'win98-header-action-btn' : ''}
                border shadow-sm transition-all duration-200
                ${undoFocusSurfaceClass}
                pointer-events-auto
                ${undoRemaining === 0 && isRewardAdSupported()
                    ? `bg-gradient-to-r from-yellow-500 to-amber-500 text-white border-yellow-400/50 shadow-md active:scale-95 ${isSwipeFocusMode ? 'opacity-35 grayscale pointer-events-none select-none' : ''} ${(isAnimating || isReviveSelectionMode) ? 'opacity-50 cursor-not-allowed' : 'hover:from-yellow-600 hover:to-amber-600 hover:shadow-lg'}`
                    : (!lastSnapshot || undoRemaining <= 0 || isAnimating || isReviveSelectionMode)
                      ? 'bg-gray-100/50 text-gray-300 border-gray-200/50 cursor-not-allowed'
                      : 'bg-white/70 hover:bg-white text-gray-700 border-white/50 hover:shadow-md active:scale-95'
                  }
              `}
              >
                {undoRemaining === 0 && isRewardAdSupported() ? (
                  <>
                    <span>📺</span>
                    <span>{t('game:rewardAd.watchButton')}</span>
                  </>
                ) : (
                  <>
                    <Undo2 size={14} />
                    <span className="tabular-nums">{undoRemaining}</span>
                  </>
                )}
              </button>
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

          {isReviveSelectionMode && (
            <div className="w-full rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-[12px] text-amber-900 shadow-sm">
              <p className="font-semibold">
                {String(t('modals:gameOver.reviveSelectionStatus', { remaining: reviveBreakRemaining } as any))}
              </p>
              <p className="mt-1 text-[11px] text-amber-800/80">
                {String(t(reviveSelectionHintKey))}
              </p>
            </div>
          )}

          <div className={`
            transition-all duration-200 w-full flex items-center justify-center
            ${boardFocusSurfaceClass}
          `}>
            {isWin98ThemeActive ? (
              <div className="window win98-game-board-window w-full max-w-[520px]">
                <div className="title-bar">
                  <div className="title-bar-text">{premiumUi?.gameWindowTitle ?? 'Game...'}</div>
                </div>
                <div className="window-body win98-board-body">
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
                    reviveSelectionEnabled={isReviveSelectionMode}
                    revivePendingTileId={revivePendingTileId}
                    onReviveTileTap={handleReviveTileTap}
                    reviveDestroyEffects={reviveDestroyEffects}
                  />
                </div>
              </div>
            ) : (
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
                reviveSelectionEnabled={isReviveSelectionMode}
                revivePendingTileId={revivePendingTileId}
                onReviveTileTap={handleReviveTileTap}
                reviveDestroyEffects={reviveDestroyEffects}
              />
            )}
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

          <div className="w-full min-h-10 flex items-center justify-center relative">
            {blockRefreshNotice && (
              <div
                role="status"
                aria-live="polite"
                className="pointer-events-none absolute -top-11 left-1/2 z-20 w-max max-w-[92%] -translate-x-1/2 rounded-full bg-gray-900/90 px-3 py-1.5 text-center text-[11px] font-medium text-white shadow-lg backdrop-blur-sm whitespace-pre-line"
              >
                {blockRefreshNotice}
              </div>
            )}
            {shouldShowBlockRefreshAdCta ? (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleWatchBlockRefreshAd}
                disabled={isBlockRefreshButtonDisabled || isBlockRefreshAdInProgress}
                className={`
                  inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold win98-game-btn
                  border transition-all duration-200
                  ${(isBlockRefreshButtonDisabled || isBlockRefreshAdInProgress)
                    ? 'bg-gray-100/60 text-gray-400 border-gray-200/80 cursor-not-allowed'
                    : 'bg-gray-200/85 text-gray-700 border-gray-300/85 shadow-sm hover:bg-gray-300/90 hover:shadow-md'}
                `}
              >
                <span>{t('game:blockRefresh.ad.watchButton')}</span>
              </button>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={handleRefreshPreviewBlocks}
                disabled={isBlockRefreshButtonDisabled}
                className={`
                  inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold win98-game-btn
                  border transition-all duration-200
                  ${isBlockRefreshButtonDisabled
                    ? 'bg-gray-100/60 text-gray-400 border-gray-200/80 cursor-not-allowed'
                    : 'bg-white/80 text-gray-700 border-white/70 shadow-sm hover:bg-white hover:shadow-md'}
                `}
              >
                <span>{t('game:blockRefresh.refreshButton')}</span>
              </button>
            )}

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
                absolute right-0 inline-flex items-center justify-center
                w-9 h-9 rounded-full win98-icon-btn
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
        <GameFeaturesTutorial tutorialStep={tutorialStep} />
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
            duration={getCurrentActiveDurationSeconds()}
            moves={moveCountRef.current}
            playerName={playerName}
            canOfferRevive={canOfferRevive}
            reviveDestroyCount={reviveDestroyCount}
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
            lockedPlayerName={activeGameRankingSnapshot.sessionLockedPlayerName}
            isWin98ThemeActive={isWin98ThemeActive}
            onCancel={handleActiveGameExitCancel}
            onProceedWithoutRegister={handleActiveGameExitProceedWithoutRegister}
            onIntermediateSaveComplete={handleActiveGameExitIntermediateSaveComplete}
            onSessionNameLocked={handleActiveGameExitNameLocked}
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
