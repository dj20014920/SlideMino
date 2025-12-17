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
import { RotateCw, Move, Trophy, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [grid, setGrid] = useState<Grid>([]);
  const [slots, setSlots] = useState<(Piece | null)[]>([null, null, null]);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0); // Ephemeral for MVP
  const [phase, setPhase] = useState<Phase>(Phase.PLACE);
  const [boardSize, setBoardSize] = useState<BoardSize>(8);
  const [comboMessage, setComboMessage] = useState<string | null>(null);

  // New State for the Rule: "Option to stop sliding if merge happened"
  const [canSkipSlide, setCanSkipSlide] = useState(false);

  // --- Dragging State ---
  const [draggingPiece, setDraggingPiece] = useState<Piece | null>(null);
  const [dragOriginIndex, setDragOriginIndex] = useState<number>(-1);
  const [hoverGridPos, setHoverGridPos] = useState<{ x: number, y: number } | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number, y: number } | null>(null);

  // --- Refs ---
  const boardRef = useRef<HTMLDivElement>(null);

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

  const rotateSlotPiece = (index: number) => {
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
  };

  const handlePointerDown = (e: React.PointerEvent, piece: Piece, index: number) => {
    // Logic update: If in PLACE phase OR (SLIDE phase but allowed to skip), start dragging.
    const isSlidePhaseButSkippable = phase === Phase.SLIDE && canSkipSlide;

    if (phase !== Phase.PLACE && !isSlidePhaseButSkippable) return;

    // If we are interrupting the slide phase to drag, switch phase immediately
    if (isSlidePhaseButSkippable) {
      finishSlideTurn(); // This sets phase to PLACE and clears flags
    }

    // Create a copy of the piece for dragging
    // Initialize with current cells
    const initCells = getRotatedCells(piece.type, piece.rotation);

    setDraggingPiece({ ...piece, cells: initCells });
    setDragOriginIndex(index);

    // Capture pointer
    (e.target as Element).setPointerCapture(e.pointerId);
    setPointerPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingPiece || !boardRef.current) return;

    setPointerPos({ x: e.clientX, y: e.clientY });

    // Calculate Grid Position
    const rect = boardRef.current.getBoundingClientRect();
    const cellSize = rect.width / grid.length;

    const relativeX = e.clientX - rect.left;
    const relativeY = e.clientY - rect.top;

    const gridX = Math.round((relativeX - cellSize / 2) / cellSize);
    const gridY = Math.round((relativeY - cellSize / 2) / cellSize);

    setHoverGridPos({ x: gridX, y: gridY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!draggingPiece) return;

    if (hoverGridPos && boardRef.current) {
      // Check Valid Placement
      if (canPlacePiece(grid, draggingPiece, hoverGridPos.x, hoverGridPos.y)) {
        // 1. Place Piece
        const newGrid = placePieceOnGrid(grid, draggingPiece, hoverGridPos.x, hoverGridPos.y);
        setGrid(newGrid);

        // 2. Remove from slot & Replace
        const newSlots = [...slots];
        newSlots[dragOriginIndex] = generateRandomPiece();
        setSlots(newSlots);

        // 3. Switch Phase or Handle Safety
        // Safety: If after placement, NO slides are possible (grid locked), 
        // we can't force the player to slide. 
        if (hasPossibleMoves(newGrid)) {
          setPhase(Phase.SLIDE);
          setCanSkipSlide(false); // Reset: Must slide at least once
          setComboMessage(null);
        } else {
          // Edge case: Board full or locked immediately after placement.
          // Stay in PLACE phase (effectively ending the 'slide' turn before it started).
          // Check game over will handle if no pieces can be placed next.
          setPhase(Phase.PLACE);
        }
      }
    }

    // Reset Drag State
    setDraggingPiece(null);
    setHoverGridPos(null);
    setPointerPos(null);
    setDragOriginIndex(-1);
  };

  // --- Event Handlers: Swipe / Slide ---

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Rotate handling (Always allowed if dragging)
      if (e.key === 'r' || e.key === 'R') {
        if (draggingPiece) rotateActivePiece();
      }

      // Slide Handling
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
    // 1. Calculate result
    const { grid: newGrid, score: scoreAdded, moved } = slideGrid(grid, dir);

    // Safety Rule: Ignore inputs that result in NO change.
    // This prevents wasting a "one-time slide" on a wall-bonk.
    if (!moved) return;

    // Apply State
    setGrid(newGrid);
    setScore(prev => prev + scoreAdded);

    // Rule Logic:
    // A. If Merge (scoreAdded > 0) -> Allow choice (Continue Slide OR Stop).
    // B. If No Merge (scoreAdded == 0) BUT Moved -> Turn End (Switch to Place).

    if (scoreAdded > 0) {
      // A: Merge Happened
      setCanSkipSlide(true); // Now user CAN stop if they want
      setComboMessage("MERGE! Slide again OR Place block");
      // Phase remains SLIDE
    } else {
      // B: Just moved, no merge
      finishSlideTurn();
    }
  };

  const finishSlideTurn = () => {
    setPhase(Phase.PLACE);
    setComboMessage(null);
    setCanSkipSlide(false);
  };

  // --- Game Over Check ---
  useEffect(() => {
    if (gameState === GameState.PLAYING && phase === Phase.PLACE) {
      // Check if any move is possible with current slots
      const isOver = checkGameOver(grid, slots);
      if (isOver) {
        setGameState(GameState.GAME_OVER);
        if (score > highScore) setHighScore(score);
      }
    }
  }, [phase, grid, slots, gameState, score, highScore]);


  // --- Render Helpers ---

  const renderDraggingPiece = () => {
    if (!draggingPiece || !pointerPos) return null;

    const cells = draggingPiece.cells;
    const cellSize = 32; // 드래그 시 각 셀의 픽셀 크기

    // 블록의 기하학적 중심점 계산 (bounding box 중심)
    const minX = Math.min(...cells.map(c => c.x));
    const maxX = Math.max(...cells.map(c => c.x));
    const minY = Math.min(...cells.map(c => c.y));
    const maxY = Math.max(...cells.map(c => c.y));

    // 중심점 오프셋 (셀 단위 → 픽셀 변환)
    const centerOffsetX = ((minX + maxX) / 2 + 0.5) * cellSize;
    const centerOffsetY = ((minY + maxY) / 2 + 0.5) * cellSize;

    return (
      <div
        className="fixed pointer-events-none z-50 opacity-80"
        style={{
          left: pointerPos.x - centerOffsetX,
          top: pointerPos.y - centerOffsetY,
          transform: 'scale(1.2)',
          transformOrigin: `${centerOffsetX}px ${centerOffsetY}px`
        }}
      >
        <div className="relative">
          {cells.map((c, i) => (
            <div
              key={i}
              className="absolute w-8 h-8 bg-blue-500 rounded border border-white shadow-lg"
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

  if (gameState === GameState.MENU) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4 space-y-8">
        <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Block Slide
        </h1>
        <p className="text-slate-400 text-xl text-center max-w-md">
          Place blocks like Tetris.<br />Merge numbers like 2048.
        </p>

        <div className="grid grid-cols-1 gap-4 w-full max-w-xs">
          <button onClick={() => startGame(10)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-6 rounded-xl shadow-[0_4px_0_rgb(21,128,61)] active:shadow-none active:translate-y-1 transition-all">
            Easy (10x10)
          </button>
          <button onClick={() => startGame(8)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl shadow-[0_4px_0_rgb(29,78,216)] active:shadow-none active:translate-y-1 transition-all">
            Normal (8x8)
          </button>
          <button onClick={() => startGame(7)} className="bg-red-600 hover:bg-red-500 text-white font-bold py-4 px-6 rounded-xl shadow-[0_4px_0_rgb(185,28,28)] active:shadow-none active:translate-y-1 transition-all">
            Hard (7x7)
          </button>
        </div>
      </div>
    );
  }

  // Calculate if slots should be disabled
  // Disabled only if we are in SLIDE phase AND we are NOT allowed to skip (haven't merged yet)
  const isSlotDisabled = phase === Phase.SLIDE && !canSkipSlide;

  return (
    <div
      className="min-h-screen flex flex-col items-center bg-slate-900 text-white touch-none"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Header */}
      <header className="w-full max-w-md flex justify-between items-center p-4">
        <div>
          <h2 className="text-xl font-bold text-slate-400">SCORE</h2>
          <p className="text-3xl font-mono">{score}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Phase Indicator */}
          <div className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 transition-colors duration-300 ${phase === Phase.PLACE ? 'bg-blue-600' : 'bg-orange-600'}`}>
            {phase === Phase.PLACE ? 'PLACE BLOCK' : 'SWIPE BOARD'}
            {phase === Phase.SLIDE && <Move size={16} className="animate-pulse" />}
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 w-full max-w-md flex flex-col items-center justify-start gap-6 p-4">

        <Board
          grid={grid}
          phase={phase}
          activePiece={draggingPiece}
          hoverLocation={hoverGridPos}
          boardRef={boardRef}
        />

        {/* Phase Action Indicator / Controls */}
        {phase === Phase.SLIDE && (
          <div className={`
             w-full p-4 rounded-xl flex items-center justify-center gap-4 transition-all duration-300 border
             ${comboMessage
              ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400 scale-105'
              : 'bg-slate-800/50 border-orange-500/30 text-orange-400'}
           `}>
            {comboMessage ? (
              <>
                <Zap className="animate-bounce" />
                <span className="font-extrabold">{comboMessage}</span>
              </>
            ) : (
              <span className="font-bold animate-pulse">Swipe or Arrows to Merge!</span>
            )}
          </div>
        )}

        {/* Inventory Slots */}
        <div className={`w-full grid grid-cols-3 gap-4 transition-opacity duration-300 ${isSlotDisabled ? 'opacity-50 grayscale' : 'opacity-100'}`}>
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
        <div className="text-slate-500 text-sm text-center">
          {draggingPiece ? (
            <span className="text-blue-400 animate-pulse font-bold flex items-center justify-center gap-2">
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
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 space-y-6">
          <Trophy size={64} className="text-yellow-400" />
          <h2 className="text-4xl font-bold text-white">Game Over!</h2>
          <div className="text-center">
            <p className="text-slate-400">Final Score</p>
            <p className="text-5xl font-mono text-white">{score}</p>
          </div>
          <button
            onClick={() => setGameState(GameState.MENU)}
            className="bg-white text-slate-900 font-bold py-4 px-10 rounded-full hover:scale-105 transition-transform"
          >
            Play Again
          </button>
        </div>
      )}
    </div>
  );
};

export default App;