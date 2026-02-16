import React, { useCallback, useEffect, useRef, useState } from 'react';

// Characters used for encrypted text effect
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*(){}[]|;:,.<>?/~`±§';

const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)];

// Generate a grid of random characters
const generateCharGrid = (cols: number, rows: number): string[][] => {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => randomChar())
  );
};

type EvervaultTileOverlayProps = {
  /** 0–1 intensity (derived from tile value: higher = stronger effect) */
  intensity: number;
  /** Size in px */
  sizePx: number;
  /** Whether this tile just merged (triggers flash animation) */
  mergeFlash: boolean;
  /** Callback when flash animation ends */
  onFlashEnd?: () => void;
};

const EvervaultTileOverlay = React.memo<EvervaultTileOverlayProps>(({
  intensity,
  sizePx,
  mergeFlash,
  onFlashEnd,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const [charGrid, setCharGrid] = useState<string[][] | null>(null);
  const intervalRef = useRef<number | null>(null);
  const flashTimeoutRef = useRef<number | null>(null);
  const [flashActive, setFlashActive] = useState(false);

  // Calculate grid dimensions based on tile size
  const fontSize = Math.max(5, Math.floor(sizePx / 8));
  const cols = Math.max(3, Math.floor(sizePx / (fontSize * 0.65)));
  const rows = Math.max(2, Math.floor(sizePx / (fontSize * 1.1)));

  // Regenerate characters periodically while hovered or flashing
  const active = isHovered || flashActive;

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setCharGrid(null);
      return;
    }

    setCharGrid(generateCharGrid(cols, rows));
    intervalRef.current = window.setInterval(() => {
      setCharGrid(generateCharGrid(cols, rows));
    }, 80);

    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [active, cols, rows]);

  // Handle merge flash
  useEffect(() => {
    if (!mergeFlash) return;

    setFlashActive(true);
    setMousePos({ x: 0.5, y: 0.5 });

    flashTimeoutRef.current = window.setTimeout(() => {
      setFlashActive(false);
      onFlashEnd?.();
      flashTimeoutRef.current = null;
    }, 500);

    return () => {
      if (flashTimeoutRef.current) {
        window.clearTimeout(flashTimeoutRef.current);
        flashTimeoutRef.current = null;
      }
    };
  }, [mergeFlash, onFlashEnd]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setMousePos({ x, y });
  }, []);

  const handlePointerEnter = useCallback(() => setIsHovered(true), []);
  const handlePointerLeave = useCallback(() => setIsHovered(false), []);

  // Gradient colors based on intensity (more intense = more vivid purple/pink)
  const gradientOpacity = flashActive ? intensity * 0.95 : intensity * 0.85;
  const textOpacity = flashActive ? intensity * 0.9 : intensity * 0.75;

  // Radial gradient follows mouse position
  const gradientStyle: React.CSSProperties = {
    background: `radial-gradient(
      ${sizePx * 1.2}px circle at ${mousePos.x * 100}% ${mousePos.y * 100}%,
      rgba(168, 85, 247, ${gradientOpacity * 0.7}),
      rgba(236, 72, 153, ${gradientOpacity * 0.5}),
      rgba(59, 130, 246, ${gradientOpacity * 0.3}),
      transparent 70%
    )`,
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 rounded-xl overflow-hidden"
      style={{ pointerEvents: 'auto', zIndex: 1 }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
    >
      {/* Encrypted text layer */}
      {active && charGrid && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden"
          style={{
            opacity: flashActive
              ? textOpacity * (1 - Math.max(0, (Date.now() % 500) / 500) * 0.5)
              : textOpacity,
            transition: flashActive ? 'opacity 500ms ease-out' : 'opacity 200ms ease-in',
            mixBlendMode: 'overlay',
          }}
        >
          {charGrid.map((row, ri) => (
            <div
              key={ri}
              className="flex justify-center whitespace-nowrap"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${fontSize * 1.1}px`,
                letterSpacing: '0.05em',
                color: `rgba(255, 255, 255, ${0.3 + intensity * 0.5})`,
                fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
                fontWeight: 300,
              }}
            >
              {row.map((ch, ci) => {
                // Distance from mouse for per-character brightness
                const cx = (ci + 0.5) / cols;
                const cy = (ri + 0.5) / rows;
                const dist = Math.sqrt((cx - mousePos.x) ** 2 + (cy - mousePos.y) ** 2);
                const charOpacity = Math.max(0.1, 1 - dist * 1.5);

                return (
                  <span key={ci} style={{ opacity: charOpacity }}>
                    {ch}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Gradient overlay (follows mouse) */}
      {active && (
        <div
          className="absolute inset-0"
          style={{
            ...gradientStyle,
            opacity: flashActive ? 1 : 1,
            transition: flashActive ? 'opacity 500ms ease-out' : 'opacity 150ms ease-in',
            mixBlendMode: 'screen',
          }}
        />
      )}

      {/* Flash pulse on merge */}
      {flashActive && (
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: `radial-gradient(circle at 50% 50%,
              rgba(168, 85, 247, ${intensity * 0.8}),
              rgba(236, 72, 153, ${intensity * 0.4}),
              transparent 80%
            )`,
            animation: 'evervaultFlash 500ms ease-out forwards',
          }}
        />
      )}
    </div>
  );
});

EvervaultTileOverlay.displayName = 'EvervaultTileOverlay';
export default EvervaultTileOverlay;
