import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  checkGameOver,
  slideGrid,
  hasPossibleMoves
} from './services/gameLogic';
import { Board, type BoardHandle } from './components/Board';
import { Slot } from './components/Slot';
import { BlockCustomizationModal } from './components/BlockCustomizationModal';
import { Undo2, Home, RotateCw, Move, Palette, Lock, Trophy, HelpCircle } from 'lucide-react';

import { GameOverModal } from './components/GameOverModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { NameInputModal } from './components/NameInputModal';
import { TutorialOverlay } from './components/TutorialOverlay';
import AdBanner from './components/AdBanner';
import { CookieConsent } from './components/CookieConsent';
import { HelpModal } from './components/HelpModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { BOARD_CELL_GAP_PX, SLIDE_UNLOCK_BUFFER_MS, getSlideAnimationDurationMs } from './constants';
import { useBlockCustomization } from './context/BlockCustomizationContext';
import { saveGameState, loadGameState, clearGameState, hasActiveGame } from './services/gameStorage';
import { rankingService } from './services/rankingService';
import { getCurrentRoute, onRouteChange, updatePageMeta, type Route } from './utils/routing';
import { isNativeApp } from './utils/platform';
import { normalizeLanguage } from './i18n/constants';
import { openNativePrivacyOptionsForm } from './services/admob';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Terms from './pages/Terms';
import About from './pages/About';
import Contact from './pages/Contact';

const EMPTY_TILE_VALUE_OVERRIDES: Record<string, number> = {};
const EMPTY_MERGING_TILES: MergingTile[] = [];

// Undo 시스템: 직전 상태를 저장하기 위한 스냅샷 인터페이스
interface GameSnapshot {
  grid: Grid;
  slots: (Piece | null)[];
  score: number;
  phase: Phase;
  canSkipSlide: boolean;
}

const App: React.FC = () => {
  // --- i18n ---
  const { t, i18n } = useTranslation();
  const tagline = String(t('game:tagline'));

  // --- Routing State ---
  const [currentRoute, setCurrentRoute] = useState<Route>(getCurrentRoute());
  const isNative = isNativeApp();

  useEffect(() => {
    document.documentElement.lang = normalizeLanguage(i18n.resolvedLanguage ?? i18n.language);
  }, [i18n.language, i18n.resolvedLanguage]);

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
  const [comboMessage, setComboMessage] = useState<string | null>(null);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  // Name Input State
  const [isNameInputOpen, setIsNameInputOpen] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [showActiveGameWarning, setShowActiveGameWarning] = useState(false);

  // New State for the Rule: "Option to stop sliding if merge happened"
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // Undo 시스템: 직전 스냅샷과 남은 사용 횟수
  const [lastSnapshot, setLastSnapshot] = useState<GameSnapshot | null>(null);
  const [undoRemaining, setUndoRemaining] = useState(3);

  // Merging tiles for animation (tiles being absorbed)
  const [mergingTiles, setMergingTiles] = useState<MergingTile[]>(EMPTY_MERGING_TILES);

  // Tutorial State: 0=Off, 1=Drag, 2=Swipe
  const [tutorialStep, setTutorialStep] = useState<number>(0);

  // Help Modal
  const [showHelpModal, setShowHelpModal] = useState(false);

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

  // --- Refs ---
  const boardRef = useRef<HTMLDivElement>(null);
  const boardHandleRef = useRef<BoardHandle | null>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null); // 드래그 오버레이 직접 제어용 Ref
  const gameStartTimeRef = useRef<number>(Date.now()); // Anti-cheat timer
  const moveCountRef = useRef<number>(0); // Anti-cheat move counter
  const sessionIdRef = useRef<string>(crypto.randomUUID()); // 게임 세션 ID
  const [currentRank, setCurrentRank] = useState<number | null>(null); // 실시간 순위

  const boardMetricsRef = useRef<{
    rectLeft: number;
    rectTop: number;
    paddingLeft: number;
    paddingTop: number;
    innerWidth: number;
    innerHeight: number;
    cell: number;
    pitch: number;
    size: number;
  } | null>(null);
  const hoverGridPosRef = useRef<{ x: number; y: number } | null>(null);
  const swipeStartRef = useRef<{ x: number, y: number } | null>(null); // 스와이프 시작 좌표
  const slideLockRef = useRef(false); // state 반영 전에도 즉시 입력 차단
  const mergeClearTimeoutRef = useRef<number | null>(null);
  const mergeFinalizeTimeoutRef = useRef<number | null>(null);
  const unlockTimeoutRef = useRef<number | null>(null);

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

  // 앱 시작 시 저장된 게임 복원
  useEffect(() => {
    const saved = loadGameState();
    if (saved) {
      // 저장된 진행중 게임이 있으면 바로 게임 화면으로
      setGameState(saved.gameState);
      setGrid(saved.grid);
      setSlots(saved.slots);
      setScore(saved.score);
      setPhase(saved.phase);
      setBoardSize(saved.boardSize);
      setCanSkipSlide(saved.canSkipSlide);
      setUndoRemaining(saved.undoRemaining);
    }
  }, []);

  // 게임 상태 자동 저장 (게임 진행중일 때만)
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      saveGameState({
        gameState,
        grid,
        slots,
        score,
        phase,
        boardSize,
        canSkipSlide,
        undoRemaining,
      });
    } else if (gameState === GameState.GAME_OVER) {
      // 게임 오버 시에만 저장된 게임 삭제 (메뉴로 돌아갈 때는 유지)
      clearGameState();
    }
  }, [gameState, grid, slots, score, phase, boardSize, canSkipSlide, undoRemaining]);

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

  // 난이도 선택 시 진행중 게임 경고 -> 이름 입력 모달
  const tryStartGame = useCallback((size: BoardSize) => {
    const active = hasActiveGame() && (gameState === GameState.MENU || boardSize !== size);
    setShowActiveGameWarning(active);

    // Open Name Input Modal directly (no window.confirm)
    setPendingDifficulty(size);
    setIsNameInputOpen(true);
  }, [gameState, boardSize]);

  const handleNameSubmit = (name: string) => {
    if (pendingDifficulty) {
      // If we warned about active game, clear it now
      if (showActiveGameWarning) {
        clearGameState();
      }
      setPlayerName(name);
      startGame(pendingDifficulty as BoardSize);
      setIsNameInputOpen(false);
      setPendingDifficulty(null);
      setShowActiveGameWarning(false);
    }
  };

  const startGame = (size: BoardSize) => {
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

    // Anti-cheat: Start Timer & Session ID
    gameStartTimeRef.current = Date.now();
    moveCountRef.current = 0;
    sessionIdRef.current = crypto.randomUUID(); // 새 게임마다 고유 세션 ID 생성
    setCurrentRank(null); // 순위 초기화

    // 온보딩: 튜토리얼 미완료 시 활성화
    const tutorialCompleted = localStorage.getItem('tutorial_completed');
    if (!tutorialCompleted) {
      setTutorialStep(1);
    } else {
      setTutorialStep(0);
    }
  };

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
    setComboMessage(null);

    // 애니메이션 관련 상태 정리
    setMergingTiles(EMPTY_MERGING_TILES);
    setTileValueOverrides(EMPTY_TILE_VALUE_OVERRIDES);
  }, [lastSnapshot, undoRemaining, isAnimating]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (mergeClearTimeoutRef.current) window.clearTimeout(mergeClearTimeoutRef.current);
      if (mergeFinalizeTimeoutRef.current) window.clearTimeout(mergeFinalizeTimeoutRef.current);
      if (unlockTimeoutRef.current) window.clearTimeout(unlockTimeoutRef.current);
    };
  }, []);

  // --- Helpers ---

  const rotateActivePiece = useCallback(() => {
    if (!draggingPiece) return;

    setDraggingPiece(prev => {
      if (!prev) return null;
      const nextRot = (prev.rotation + 1) % 4;
      return {
        ...prev,
        rotation: nextRot,
        cells: getRotatedCells(prev.type, nextRot)
      };
    });
  }, [draggingPiece]);

  // --- Event Handlers: Drag & Drop ---

  // finishSlideTurn must be defined before handlePointerDown (dependency)
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
    const isSlidePhaseButSkippable = phase === Phase.SLIDE && canSkipSlide;

    // Animation/Input Lock Check (ref 기반: state 반영 전에도 즉시 차단)
    if (slideLockRef.current) return;

    if (phase !== Phase.PLACE && !isSlidePhaseButSkippable) return;

    if (isSlidePhaseButSkippable) {
      swipeStartRef.current = null;
      finishSlideTurn();
    }

    // Cache board metrics on drag start only
    if (boardRef.current) {
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

      boardMetricsRef.current = {
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
    }

    const initCells = getRotatedCells(piece.type, piece.rotation);

    setDraggingPiece({ ...piece, cells: initCells });
    setDragOriginIndex(index);
    hoverGridPosRef.current = null;
    boardHandleRef.current?.setHoverLocation(null);

    // Direct DOM: set initial drag position
    currentPointerPosRef.current = { x: e.clientX, y: e.clientY };

    if (dragOverlayRef.current) {
      dragOverlayRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(1.15)`;
    }

    (e.target as Element).setPointerCapture(e.pointerId);
  }, [phase, canSkipSlide, finishSlideTurn, boardSize, tutorialStep]);

  // RAF 기반으로 포인터 이벤트를 1프레임에 1번으로 합쳐서(코얼레싱) 렌더/연산 폭주를 방지
  const rafIdRef = useRef<number | null>(null);
  const latestPointerRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPiece || !boardMetricsRef.current) return;
    latestPointerRef.current = { x: e.clientX, y: e.clientY };
    if (rafIdRef.current) return;

    rafIdRef.current = requestAnimationFrame(() => {
      const pointer = latestPointerRef.current;
      const metrics = boardMetricsRef.current;
      rafIdRef.current = null;
      if (!pointer || !metrics) return;

      // Direct DOM manipulation for drag overlay (bypass React render)
      if (dragOverlayRef.current) {
        dragOverlayRef.current.style.transform = `translate3d(${pointer.x}px, ${pointer.y}px, 0) scale(1.15)`;
      }

      // Grid position calculation (cached rect)
      const relativeX = pointer.x - metrics.rectLeft - metrics.paddingLeft;
      const relativeY = pointer.y - metrics.rectTop - metrics.paddingTop;

      // 보드 바깥이면 ghost를 숨기고, 불필요한 업데이트를 막음
      const isOutside =
        relativeX < 0 || relativeY < 0 || relativeX > metrics.innerWidth || relativeY > metrics.innerHeight;
      if (isOutside) {
        if (hoverGridPosRef.current) {
          hoverGridPosRef.current = null;
          boardHandleRef.current?.setHoverLocation(null);
        }
        return;
      }

      const gridX = Math.round((relativeX - metrics.cell / 2) / metrics.pitch);
      const gridY = Math.round((relativeY - metrics.cell / 2) / metrics.pitch);

      const prev = hoverGridPosRef.current;
      if (prev && prev.x === gridX && prev.y === gridY) return;

      const next = { x: gridX, y: gridY };
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

  const handlePointerUp = (e: React.PointerEvent) => {
    // 1. 드래그 중인 조각이 있다면 -> 조각 놓기 처리
    if (draggingPiece) {
      // 드래그 종료 시 스와이프 시작 좌표가 남아있으면 다음 입력에서 오동작 가능
      swipeStartRef.current = null;
      const hover = hoverGridPosRef.current;
      if (hover && boardRef.current) {
        if (canPlacePiece(grid, draggingPiece, hover.x, hover.y)) {
          // Undo를 위해 현재 상태 저장 (배치 전)
          saveSnapshot();

          const newGrid = placePieceOnGrid(grid, draggingPiece, hover.x, hover.y);
          setGrid(newGrid);

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
            setCanSkipSlide(false);
            setComboMessage(null);
          } else {
            setPhase(Phase.PLACE);
          }
        }
      }

      setDraggingPiece(null);
      setDragOriginIndex(-1);
      boardMetricsRef.current = null; // Reset cache
      hoverGridPosRef.current = null;
      boardHandleRef.current?.setHoverLocation(null);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
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

  // --- Event Handlers: Swipe / Slide ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [gameState, phase, grid, draggingPiece, rotateActivePiece]);

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

    if (!moved) return;

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
        setCanSkipSlide(true);
        setComboMessage("MERGE! Slide again OR Place block");
      } else {
        finishSlideTurn();
      }
    }, lockMs);
  };



  // --- Game Over Check ---
  useEffect(() => {
    if (gameState === GameState.PLAYING && phase === Phase.PLACE) {
      const isOver = checkGameOver(grid, slots);
      if (isOver) {
        setGameState(GameState.GAME_OVER);
        if (score > highScore) setHighScore(score);
      }
    }
  }, [phase, grid, slots, gameState, score, highScore]);

  // --- 자동 점수 업데이트 (10초마다) ---
  useEffect(() => {
    if (gameState !== GameState.PLAYING) {
      return;
    }

    // 즉시 첫 업데이트 실행 (게임 시작 직후)
    const performUpdate = async () => {
      const duration = Math.floor((Date.now() - gameStartTimeRef.current) / 1000);
      const difficultyStr = String(boardSize);
      const name = playerName || rankingService.getSavedName() || 'Guest';

      console.log('[자동 업데이트] 점수 전송:', { sessionId: sessionIdRef.current, name, score, rank: currentRank });

      const result = await rankingService.updateScore(
        sessionIdRef.current,
        name,
        score,
        difficultyStr,
        duration,
        moveCountRef.current
      );

      console.log('[자동 업데이트] 응답:', result);

      if (result.success && result.rank !== undefined) {
        setCurrentRank(result.rank);
      }
    };

    // 즉시 첫 업데이트
    performUpdate();

    // 10초마다 자동 업데이트
    const intervalId = setInterval(performUpdate, 10000);

    return () => clearInterval(intervalId);
  }, [gameState, score, boardSize]); // playerName 의존성 제거


  // --- Render Helpers ---

  const currentPointerPosRef = useRef<{ x: number, y: number } | null>(null);

  // --- Handlers 수정: PointerDown에서 좌표 저장 ---
  // (이 부분은 handlePointerDown 내부 수정이 필요하지만, 여기서는 renderDraggingPiece를 중심으로 수정하고 
  // handlePointerDown은 별도로 수정하지 않아도 동작하게끔 리렌더링 사이클 활용)
  // 단, 아래 코드는 renderDraggingPiece 함수 자체를 대체함.

  const renderDraggingPiece = () => {
    if (!draggingPiece) return null;

    const cells = draggingPiece.cells;
    const cellSize = 32;
    const cellAppearance = resolveTileAppearance(draggingPiece.value);

    const minX = Math.min(...cells.map(c => c.x));
    const maxX = Math.max(...cells.map(c => c.x));
    const minY = Math.min(...cells.map(c => c.y));
    const maxY = Math.max(...cells.map(c => c.y));

    // 중심점 오프셋 계산 (고정값)
    const centerOffsetX = ((minX + maxX) / 2 + 0.5) * cellSize;
    const centerOffsetY = ((minY + maxY) / 2 + 0.5) * cellSize;

    return (
      <div
        ref={(el) => {
          dragOverlayRef.current = el;
          // 마운트 직후 초기 위치 설정 (깜빡임 방지)
          if (el && currentPointerPosRef.current) {
            const { x, y } = currentPointerPosRef.current;
            el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(1.15)`;
          }
        }}
        className="fixed top-0 left-0 pointer-events-none z-50 opacity-90 will-change-transform"
        style={{
          // 초기 위치를 마이너스로 보내서 깜빡임 방지하거나, 
          // 위 ref callback에서 즉시 설정되므로 0,0에 두고 transform으로 이동
          marginTop: `-${centerOffsetY}px`,
          marginLeft: `-${centerOffsetX}px`,
          // 기본적으로 숨겨두고 JS로 위치 잡히면 보이게 할 수도 있음.
          // 여기서는 transform으로 제어.
        }}
      >
        <div className="relative">
          {cells.map((c, i) => (
            <div
              key={i}
              className={`
                absolute w-8 h-8 rounded-lg
                ${cellAppearance.className}
              `}
              style={{
                left: c.x * cellSize,
                top: c.y * cellSize,
                ...(cellAppearance.style ?? {}),
              }}
            />
          ))}
        </div>
      </div>
    );
  };

  // --- Views ---

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
    return (
      <>
        <CookieConsent />
        <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-10">
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
                    setGameState(saved.gameState);
                    setGrid(saved.grid);
                    setSlots(saved.slots);
                    setScore(saved.score);
                    setPhase(saved.phase);
                    setBoardSize(saved.boardSize);
                    setCanSkipSlide(saved.canSkipSlide);
                    setUndoRemaining(saved.undoRemaining);
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
              onClick={() => tryStartGame(5)}
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
          </div>

          {/* 푸터 네비게이션 */}
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
            hasActiveGame={showActiveGameWarning}
            onClose={() => setIsNameInputOpen(false)}
            onSubmit={handleNameSubmit}
          />
        </div>
      </>
    );
  }

  // Calculate if slots should be disabled
  const isSlotDisabled = (phase === Phase.SLIDE && !canSkipSlide) || isAnimating;

  // ========== GAME SCREEN ==========
  return (
    <>
      <CookieConsent />
      <div
        className="min-h-screen min-h-[100dvh] flex flex-col items-center text-gray-900 touch-none"
        onPointerDown={handleSwipeStart}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Header */}
        <header
          className="w-full max-w-md flex justify-between items-center p-4"
          style={{ paddingTop: '36px' }}
        >
          <div className="flex items-center gap-3">
            {/* Home Button */}
            <button
              type="button"
              onClick={goToMenu}
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
                {currentRank !== null && gameState === GameState.PLAYING && (
                  <span className="ml-2 text-xs font-semibold text-blue-600">
                    #{currentRank}
                  </span>
                )}
              </h2>
              <p className="text-3xl font-bold text-gray-900 tabular-nums">{score}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* Phase Indicator - Glass Pill */}
            <div className={`
            px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 
            transition-all duration-200 ease-out
            ${phase === Phase.PLACE
                ? 'bg-white/50 backdrop-blur-sm border border-white/40 text-gray-700 shadow-md'
                : 'bg-gray-900 text-white shadow-lg border border-transparent'
              }
          `}>
              {phase === Phase.PLACE ? t('game:phases.place') : t('game:phases.swipe')}
              {phase === Phase.SLIDE && <Move size={14} className="animate-pulse" />}
            </div>

            {/* Help & Undo Buttons - Same Row */}
            <div className="flex items-center gap-2">
              {/* Help Button */}
              <button
                type="button"
                onClick={() => setShowHelpModal(true)}
                className="
                  p-2 rounded-full text-gray-600
                  bg-white/70 hover:bg-white border border-white/50
                  shadow-sm hover:shadow-md transition-all duration-200 active:scale-95
                "
                aria-label={t('common:aria.help')}
              >
                <HelpCircle size={18} />
              </button>

              {/* Undo Button */}
              <button
                type="button"
                onClick={executeUndo}
                disabled={!lastSnapshot || undoRemaining <= 0 || isAnimating}
                className={`
                px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2
                border shadow-sm transition-all duration-200
                ${(!lastSnapshot || undoRemaining <= 0 || isAnimating)
                    ? 'bg-gray-100/50 text-gray-300 border-gray-200/50 cursor-not-allowed'
                    : 'bg-white/70 hover:bg-white text-gray-700 border-white/50 hover:shadow-md active:scale-95'
                  }
              `}
              >
                <Undo2 size={14} />
                <span className="tabular-nums">{undoRemaining}</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Game Area */}
        <main
          className="flex-1 w-full max-w-md flex flex-col items-center justify-start gap-5 p-4 pt-2"
          style={{ paddingBottom: 'calc(16px + var(--app-safe-bottom))' }}
        >

          <Board
            ref={boardHandleRef}
            htmlId="game-board"
            grid={grid}
            phase={phase}
            activePiece={draggingPiece}
            boardRef={boardRef}
            mergingTiles={mergingTiles}
            valueOverrides={tileValueOverrides}
          />


          {/* Inventory Slots */}
          <div className={`
          w-full grid grid-cols-3 gap-4 
          transition-opacity duration-300
          ${isSlotDisabled ? 'opacity-40 grayscale' : 'opacity-100'}
        `}>
            {slots.map((p, i) => (
              <Slot
                key={p ? p.id : i}
                index={i}
                piece={p}
                htmlId={i === 0 ? 'slot-0' : undefined}
                onPointerDown={handlePointerDown}
                onRotate={rotateSlotPiece}
                disabled={isSlotDisabled}
              />
            ))}
          </div>

          {/* Hints */}
          <div className="text-gray-400 text-sm text-center font-medium">
            {draggingPiece ? (
              <span className="text-gray-600 flex items-center justify-center gap-2">
                <RotateCw size={14} /> {t('game:hints.rotate')}
              </span>
            ) : (
              phase === Phase.PLACE ? t('game:hints.drag') :
                (canSkipSlide ? t('game:hints.combo') : t('game:hints.swipe'))
            )}
          </div>

        </main>

        <TutorialOverlay step={tutorialStep} />
        <HelpModal isOpen={showHelpModal} onClose={() => setShowHelpModal(false)} />

        {/* Ad Banner for Game Screen */}
        <div className="w-full shrink-0 z-10 bg-white/50 backdrop-blur-sm border-t border-white/20">
          <AdBanner />
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
            onClose={() => setGameState(GameState.MENU)}
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
