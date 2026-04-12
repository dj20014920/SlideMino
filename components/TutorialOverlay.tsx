import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hand } from 'lucide-react';
import { measureRectInOverlaySpace } from '../services/tutorialTargetGeometry';

interface TutorialOverlayProps {
  step: number; // 0: off, 1: drag, 2: swipe
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ step }) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [positions, setPositions] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [highlightRects, setHighlightRects] = useState<{
    start: { left: number; top: number; width: number; height: number };
    end: { left: number; top: number; width: number; height: number };
  } | null>(null);

  useEffect(() => {
    if (step === 0) {
      setPositions(null);
      setHighlightRects(null);
      return;
    }

    let rafId: number | null = null;

    const updatePositions = () => {
      const slotEl = document.getElementById('slot-0');
      const boardEl = document.getElementById('game-board');
      if (!boardEl) {
        setPositions(null);
        setHighlightRects(null);
        return;
      }

      const boardRect = measureRectInOverlaySpace(boardEl, overlayRef.current, 'self');
      if (!boardRect) {
        setPositions(null);
        setHighlightRects(null);
        return;
      }

      if (step === 1) {
        if (!slotEl) {
          setPositions(null);
          setHighlightRects(null);
          return;
        }
        const slotRect = measureRectInOverlaySpace(slotEl, overlayRef.current, 'self');
        if (!slotRect) {
          setPositions(null);
          setHighlightRects(null);
          return;
        }
        const next = {
          startX: slotRect.left + slotRect.width / 2,
          startY: slotRect.top + slotRect.height / 2,
          endX: boardRect.left + boardRect.width / 2,
          endY: boardRect.top + boardRect.height / 2,
        };
        setPositions((prev) => {
          if (
            prev &&
            prev.startX === next.startX &&
            prev.startY === next.startY &&
            prev.endX === next.endX &&
            prev.endY === next.endY
          ) {
            return prev;
          }
          return next;
        });
        setHighlightRects({
          start: {
            left: slotRect.left - 4,
            top: slotRect.top - 4,
            width: slotRect.width + 8,
            height: slotRect.height + 8,
          },
          end: {
            left: boardRect.left - 4,
            top: boardRect.top - 4,
            width: boardRect.width + 8,
            height: boardRect.height + 8,
          },
        });
        return;
      }

      const centerY = boardRect.top + boardRect.height / 2;
      const next = {
        startX: boardRect.left + boardRect.width * 0.35,
        startY: centerY,
        endX: boardRect.left + boardRect.width * 0.72,
        endY: centerY,
      };
      setPositions((prev) => {
        if (
          prev &&
          prev.startX === next.startX &&
          prev.startY === next.startY &&
          prev.endX === next.endX &&
          prev.endY === next.endY
        ) {
          return prev;
        }
        return next;
      });
      const markerSize = Math.max(18, Math.min(36, boardRect.width * 0.08));
      setHighlightRects({
        start: {
          left: next.startX - markerSize / 2,
          top: next.startY - markerSize / 2,
          width: markerSize,
          height: markerSize,
        },
        end: {
          left: next.endX - markerSize / 2,
          top: next.endY - markerSize / 2,
          width: markerSize,
          height: markerSize,
        },
      });
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(updatePositions);
    };

    schedule();
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);
    window.addEventListener('scroll', schedule, true);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('scroll', schedule, true);
      setPositions(null);
      setHighlightRects(null);
    };
  }, [step]);

  if (step === 0 || !positions) return null;

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
      {/* Ghost Hand Animation */}
      {highlightRects && (
        <>
          <div
            className="fixed z-[9998] rounded-xl border-2 border-blue-200/80"
            style={{
              ...highlightRects.start,
              boxShadow: step === 1 ? '0 0 0 9999px rgba(15,23,42,0.35)' : undefined,
            }}
          />
          <div
            className="fixed z-[9998] rounded-xl border-2 border-cyan-200/80"
            style={highlightRects.end}
          />
        </>
      )}
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
        {step === 1 ? t('modals:tutorial.drag') : t('modals:tutorial.swipe')}
      </div>
    </div>
  );
};
