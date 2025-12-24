import React, { useEffect, useState, useRef } from 'react';
import { Hand } from 'lucide-react';

interface TutorialOverlayProps {
  step: number; // 0: off, 1: drag, 2: swipe
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ step }) => {
  const [positions, setPositions] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);

  useEffect(() => {
    if (step === 0) return;

    let rafId: number;

    const updatePositions = () => {
      const slotEl = document.getElementById('slot-0');
      const boardEl = document.getElementById('game-board');

      if (boardEl) {
        const boardRect = boardEl.getBoundingClientRect();

        if (step === 1 && slotEl) {
          // STEP 1: DRAG (Slot -> Board)
          const slotRect = slotEl.getBoundingClientRect();
          setPositions({
            startX: slotRect.left + slotRect.width / 2,
            startY: slotRect.top + slotRect.height / 2,
            endX: boardRect.left + boardRect.width / 2,
            endY: boardRect.top + boardRect.height / 2,
          });
        } else if (step === 2) {
          // STEP 2: SWIPE (Center -> Right)
          const cx = boardRect.left + boardRect.width / 2;
          const cy = boardRect.top + boardRect.height / 2;
          setPositions({
            startX: cx - 50,
            startY: cy,
            endX: cx + 100, // Swipe right
            endY: cy,
          });
        }
      }

      rafId = requestAnimationFrame(updatePositions);
    };

    updatePositions();

    return () => cancelAnimationFrame(rafId);
  }, [step]);

  if (step === 0 || !positions) return null;

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Ghost Hand Animation */}
      <div
        className="absolute text-white drop-shadow-xl filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]"
        style={{
          left: 0,
          top: 0,
          animation: step === 1
            ? 'ghost-drag 3s infinite ease-in-out'
            : 'ghost-swipe 2s infinite ease-in-out',
        }}
      >
        <Hand
          size={48}
          fill="rgba(255, 255, 255, 0.9)"
          strokeWidth={1.5}
          className="text-gray-900"
        />
      </div>

      <style>{`
        @keyframes ghost-drag {
          0% { transform: translate3d(${positions.startX}px, ${positions.startY}px, 0) scale(1) rotate(0deg); opacity: 0; }
          10% { transform: translate3d(${positions.startX}px, ${positions.startY}px, 0) scale(1) rotate(0deg); opacity: 1; }
          20% { transform: translate3d(${positions.startX}px, ${positions.startY}px, 0) scale(0.9) rotate(-5deg); opacity: 1; }
          50% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(0.95) rotate(-5deg); opacity: 1; }
          65% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(0.95) rotate(-5deg); opacity: 1; }
          75% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(1.1) rotate(0deg); opacity: 1; }
          85% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(1) rotate(0deg); opacity: 0; }
          100% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(1) rotate(0deg); opacity: 0; }
        }
        @keyframes ghost-swipe {
          0% { transform: translate3d(${positions.startX}px, ${positions.startY}px, 0) scale(0.9) rotate(-10deg); opacity: 0; }
          10% { transform: translate3d(${positions.startX}px, ${positions.startY}px, 0) scale(0.9) rotate(-10deg); opacity: 1; }
          60% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(0.9) rotate(0deg); opacity: 1; }
          80% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(1) rotate(0deg); opacity: 0; }
          100% { transform: translate3d(${positions.endX}px, ${positions.endY}px, 0) scale(1) rotate(0deg); opacity: 0; }
        }
`}</style>

      {/* Optional Text Hint */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-3 rounded-full text-white font-semibold text-lg animate-bounce"
        style={{ animationDuration: '2s' }}
      >
        {step === 1 ? 'Drag block to board!' : 'Swipe screen/keys to Merge!'}
      </div>
    </div>
  );
};

