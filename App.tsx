import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { TileDebugModal } from './components/TileDebugModal';
import { BlockCustomizationModal } from './components/BlockCustomizationModal';
import { BOARD_CELL_GAP_PX, SLIDE_UNLOCK_BUFFER_MS, getSlideAnimationDurationMs } from './constants';
import { RotateCw, Move, Trophy, Bug, Undo2, Palette, Lock } from 'lucide-react';
import { useBlockCustomization } from './context/BlockCustomizationContext';

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
  // --- State ---
  const { gate: customizationGate, resolveTileAppearance } = useBlockCustomization();
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [grid, setGrid] = useState<Grid>(createEmptyGrid(8));
  const [slots, setSlots] = useState<(Piece | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<Phase>(Phase.PLACE);
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [comboMessage, setComboMessage] = useState<string | null>(null);
  const [isTileDebugOpen, setIsTileDebugOpen] = useState(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState(false);

  // New State for the Rule: "Option to stop sliding if merge happened"
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // Undo 시스템: 직전 스냅샷과 남은 사용 횟수
  const [lastSnapshot, setLastSnapshot] = useState<GameSnapshot | null>(null);
  const [undoRemaining, setUndoRemaining] = useState(3);

  // Merging tiles for animation (tiles being absorbed)
  const [mergingTiles, setMergingTiles] = useState<MergingTile[]>(EMPTY_MERGING_TILES);

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
  }, [phase, canSkipSlide, finishSlideTurn, boardSize]);

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
    // 슬라이드는 보드 영역에서만 시작 (슬롯/버튼 터치로 인한 오작동 방지)
    if (isTileDebugOpen) return;
    if (phase !== Phase.SLIDE) return;
    if (slideLockRef.current) return;
    if (!boardRef.current) return;

    const target = e.target as Node | null;
    if (target && !boardRef.current.contains(target)) return;

    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isTileDebugOpen) {
      swipeStartRef.current = null;
      return;
    }
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
      if (isTileDebugOpen) return;
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
  }, [gameState, phase, grid, draggingPiece, rotateActivePiece, isTileDebugOpen]);

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

  // ========== MENU SCREEN ==========
  if (gameState === GameState.MENU) {
    return (
      <div className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center p-6 space-y-10">
        {/* 로고 영역 */}
        <div className="text-center space-y-3 animate-fade-in">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            SlideMino
          </h1>
          <p className="text-gray-500 text-lg max-w-xs mx-auto leading-relaxed">
            Place blocks like Tetris.<br />
            Merge numbers like 2048.
          </p>
        </div>

        {/* 난이도 선택 버튼들 */}
        <div className="flex flex-col gap-4 w-full max-w-xs animate-slide-up">
          {/* Easy */}
          <button
            onClick={() => startGame(10)}
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
              <span>Easy</span>
              <span className="text-gray-400 font-normal text-sm">10×10</span>
            </span>
          </button>

          {/* Normal */}
          <button
            onClick={() => startGame(8)}
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
              <span>Normal</span>
              <span className="text-gray-400 font-normal text-sm">8×8</span>
            </span>
          </button>

          {/* Hard */}
          <button
            onClick={() => startGame(7)}
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
              <span>Hard</span>
              <span className="text-gray-500 font-normal text-sm">7×7</span>
            </span>
          </button>

          {/* Extreme - 5×5 */}
          <button
            onClick={() => startGame(5)}
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
              <span>🔥 Extreme</span>
              <span className="text-red-200/70 font-normal text-sm">5×5</span>
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
              블럭 커스터마이징
            </span>
            {!customizationGate.allowed ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700/90">
                <Lock size={14} />
                {customizationGate.reason ?? '잠김'}
              </span>
            ) : (
              <span className="text-gray-400 font-normal text-sm">꾸미기</span>
            )}
          </button>
        </div>

        <BlockCustomizationModal
          open={isCustomizationOpen}
          onClose={() => setIsCustomizationOpen(false)}
        />
      </div>
    );
  }

  // Calculate if slots should be disabled
  const isSlotDisabled = (phase === Phase.SLIDE && !canSkipSlide) || isAnimating;

  // ========== GAME SCREEN ==========
  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col items-center text-gray-900 touch-none"
      onPointerDown={handleSwipeStart}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Header */}
      <header
        className="w-full max-w-md flex justify-between items-center p-4"
        style={{ paddingTop: 'calc(36px + var(--app-safe-top))' }}
      >
        <div className="space-y-0.5">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Score</h2>
          <p className="text-3xl font-bold text-gray-900 tabular-nums">{score}</p>
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
            {phase === Phase.PLACE ? 'PLACE BLOCK' : 'SWIPE BOARD'}
            {phase === Phase.SLIDE && <Move size={14} className="animate-pulse" />}
          </div>

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

          {/* Debug: Tile palette */}
          {import.meta.env.DEV && (
            <button
              type="button"
              disabled={!!draggingPiece}
              className={`
                px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2
                border shadow-sm transition-colors
                ${draggingPiece
                  ? 'bg-white/40 text-gray-400 border-white/30 opacity-60 cursor-not-allowed'
                  : 'bg-white/60 hover:bg-white text-gray-700 border-white/50'
                }
              `}
              onClick={() => setIsTileDebugOpen(true)}
            >
              <Bug size={14} />
              Tiles
            </button>
          )}
        </div>
      </header>

      {/* Main Game Area */}
      <main
        className="flex-1 w-full max-w-md flex flex-col items-center justify-start gap-5 p-4 pt-2"
        style={{ paddingBottom: 'calc(16px + var(--app-safe-bottom))' }}
      >

        <Board
          ref={boardHandleRef}
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
              <RotateCw size={14} /> Press 'R' to Rotate
            </span>
          ) : (
            phase === Phase.PLACE ? "Drag blocks to grid" :
              (canSkipSlide ? "Swipe again OR Drag a block" : "Must slide to continue!")
          )}
        </div>

      </main>

      {/* Dragging Overlay */}
      {renderDraggingPiece()}

      {/* Debug Modal */}
      <TileDebugModal
        open={isTileDebugOpen}
        onClose={() => setIsTileDebugOpen(false)}
      />

      {/* Game Over Modal */}
      {gameState === GameState.GAME_OVER && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-white/70 backdrop-blur-lg animate-fade-in" />

          {/* Modal Content */}
          <div className="relative z-10 flex flex-col items-center space-y-8 animate-slide-up">
            {/* Trophy Icon */}
            <div className="
              w-24 h-24 rounded-full 
              bg-gradient-to-br from-amber-100 to-yellow-200
              border border-amber-200/50
              shadow-xl
              flex items-center justify-center
            ">
              <Trophy size={40} className="text-amber-600" />
            </div>

            {/* Title */}
            <h2 className="text-4xl font-bold text-gray-900">Game Over</h2>

            {/* Score Display */}
            <div className="
              text-center px-10 py-6 rounded-3xl
              bg-white/60 backdrop-blur-sm
              border border-white/50
              shadow-lg
            ">
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Final Score</p>
              <p className="text-5xl font-bold text-gray-900 tabular-nums">{score}</p>
            </div>

            {/* Play Again Button */}
            <button
              onClick={() => setGameState(GameState.MENU)}
              className="
                py-4 px-12 rounded-full
                bg-gray-900 text-white font-semibold text-lg
                shadow-lg
                hover:shadow-xl hover:-translate-y-0.5 hover:bg-gray-800
                active:translate-y-0 active:shadow-md
                transition-all duration-200 ease-out
              "
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
