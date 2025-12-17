import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  GameState,
  Grid,
  Piece,
  Phase,
  BoardSize,
  ShapeType
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
import { Board } from './components/Board';
import { Slot } from './components/Slot';
import { RotateCw, Move, Trophy, Zap } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [grid, setGrid] = useState<Grid>([]);
  const [slots, setSlots] = useState<(Piece | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<Phase>(Phase.PLACE);
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [comboMessage, setComboMessage] = useState<string | null>(null);

  // New State for the Rule: "Option to stop sliding if merge happened"
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // --- Dragging State ---
  const [draggingPiece, setDraggingPiece] = useState<Piece | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState<number>(-1);
  const [hoverGridPos, setHoverGridPos] = useState<{ x: number, y: number } | null>(null);

  // --- Refs ---
  const boardRef = useRef<HTMLDivElement>(null);
  const dragOverlayRef = useRef<HTMLDivElement>(null); // 드래그 오버레이 직접 제어용 Ref
  const boardRectRef = useRef<DOMRect | null>(null); // 보드 위치 캐싱
  const swipeStartRef = useRef<{ x: number, y: number } | null>(null); // 스와이프 시작 좌표

  // --- Initialization ---

  const startGame = (size: BoardSize) => {
    setBoardSize(size);
    setGrid(createEmptyGrid(size));
    setSlots([generateRandomPiece(), generateRandomPiece(), generateRandomPiece()]);
    setScore(0);
    setPhase(Phase.PLACE);
    setGameState(GameState.PLAYING);
    setComboMessage(null);
    setCanSkipSlide(false);
  };

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

    if (phase !== Phase.PLACE && !isSlidePhaseButSkippable) return;

    if (isSlidePhaseButSkippable) {
      finishSlideTurn();
    }

    // Cache board rect on drag start only
    if (boardRef.current) {
      boardRectRef.current = boardRef.current.getBoundingClientRect();
    }

    const initCells = getRotatedCells(piece.type, piece.rotation);

    setDraggingPiece({ ...piece, cells: initCells });
    setDragOriginIndex(index);

    // Direct DOM: set initial drag position
    currentPointerPosRef.current = { x: e.clientX, y: e.clientY };

    if (dragOverlayRef.current) {
      dragOverlayRef.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) scale(1.15)`;
    }

    (e.target as Element).setPointerCapture(e.pointerId);
  }, [phase, canSkipSlide, finishSlideTurn]);

  // RAF ID for drag animation optimization
  const rafIdRef = useRef<number | null>(null);

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPiece || !boardRef.current || !boardRectRef.current) return;

    // Cancel any pending RAF to prevent stacking
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
    }

    const clientX = e.clientX;
    const clientY = e.clientY;

    // Use RAF for smooth 60fps animation
    rafIdRef.current = requestAnimationFrame(() => {
      // Direct DOM manipulation for drag overlay (bypass React render)
      if (dragOverlayRef.current) {
        dragOverlayRef.current.style.transform = `translate3d(${clientX}px, ${clientY}px, 0) scale(1.15)`;
      }

      // Grid position calculation (cached rect)
      const rect = boardRectRef.current!;
      const cellSize = rect.width / grid.length;
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      const gridX = Math.round((relativeX - cellSize / 2) / cellSize);
      const gridY = Math.round((relativeY - cellSize / 2) / cellSize);

      // Only update state if position actually changed
      setHoverGridPos(prev => {
        if (prev && prev.x === gridX && prev.y === gridY) return prev;
        return { x: gridX, y: gridY };
      });

      rafIdRef.current = null;
    });
  };

  const handleSwipeStart = (e: React.PointerEvent) => {
    // 슬라이드 단계일 때만 스와이프 감지 시작
    if (phase === Phase.SLIDE) {
      swipeStartRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    // 1. 드래그 중인 조각이 있다면 -> 조각 놓기 처리
    if (draggingPiece) {
      if (hoverGridPos && boardRef.current) {
        if (canPlacePiece(grid, draggingPiece, hoverGridPos.x, hoverGridPos.y)) {
          const newGrid = placePieceOnGrid(grid, draggingPiece, hoverGridPos.x, hoverGridPos.y);
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
      setHoverGridPos(null);
      setDragOriginIndex(-1);
      boardRectRef.current = null; // Reset cache
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
    const { grid: newGrid, score: scoreAdded, moved } = slideGrid(grid, dir);

    if (!moved) return;

    setGrid(newGrid);
    setScore(prev => prev + scoreAdded);

    if (scoreAdded > 0) {
      setCanSkipSlide(true);
      setComboMessage("MERGE! Slide again OR Place block");
    } else {
      finishSlideTurn();
    }
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
              className="absolute w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg border border-white/30 shadow-lg"
              style={{
                left: c.x * cellSize,
                top: c.y * cellSize
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
            Block Slide
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
        </div>
      </div>
    );
  }

  // Calculate if slots should be disabled
  const isSlotDisabled = phase === Phase.SLIDE && !canSkipSlide;

  // ========== GAME SCREEN ==========
  return (
    <div
      className="min-h-screen min-h-[100dvh] flex flex-col items-center text-gray-900 touch-none"
      onPointerDown={handleSwipeStart}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Header */}
      <header className="w-full max-w-md flex justify-between items-center p-4 pt-6">
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
              : 'bg-gray-900 text-white shadow-lg'
            }
          `}>
            {phase === Phase.PLACE ? 'PLACE BLOCK' : 'SWIPE BOARD'}
            {phase === Phase.SLIDE && <Move size={14} className="animate-pulse" />}
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-start gap-5 p-4 pt-2">

        <Board
          grid={grid}
          phase={phase}
          activePiece={draggingPiece}
          hoverLocation={hoverGridPos}
          boardRef={boardRef}
        />


        {/* Inventory Slots */}
        <div className={`
          w-full grid grid-cols-3 gap-4 
          transition-all duration-300
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