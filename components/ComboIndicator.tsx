import React from 'react';

interface ComboIndicatorProps {
  comboCount: number;
  timerMs: number;
  isActive: boolean;
  multiplier: number;
}

const COMBO_TIMER_MS = 2500;

function getComboColors(comboCount: number) {
  if (comboCount >= 5) return { bar: 'bg-red-600', text: 'text-red-400', glow: 'rgba(220,38,38,0.35)' };
  if (comboCount >= 4) return { bar: 'bg-red-500', text: 'text-red-400', glow: 'rgba(239,68,68,0.30)' };
  if (comboCount >= 3) return { bar: 'bg-orange-400', text: 'text-orange-300', glow: 'rgba(251,146,60,0.25)' };
  return { bar: 'bg-yellow-400', text: 'text-yellow-300', glow: 'rgba(250,204,21,0.20)' };
}

export default function ComboIndicator({ comboCount, timerMs, isActive, multiplier }: ComboIndicatorProps) {
  if (!isActive || comboCount < 2) return null;

  const progress = timerMs / COMBO_TIMER_MS;
  const isUrgent = timerMs < 500;
  const colors = getComboColors(comboCount);

  return (
    <>
      {/* Fever border around screen edges */}
      <div
        className="fixed inset-0 z-25 pointer-events-none transition-all duration-300"
        style={{
          boxShadow: `inset 0 0 80px 24px ${colors.glow}, inset 0 0 30px 8px ${colors.glow}`,
          animation: isUrgent ? 'combo-pulse 0.4s ease-in-out infinite' : 'none',
        }}
      />

      {/* Combo counter + timer bar */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className="text-center mb-1">
          <span className={`text-lg font-bold drop-shadow-[0_0_8px_currentColor] ${colors.text}`}>
            {comboCount}x COMBO!
          </span>
          <span className="text-xs text-white/70 ml-2">x{multiplier}</span>
        </div>
        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-50 ${colors.bar} ${isUrgent ? 'animate-pulse' : ''}`}
            style={{ width: `${Math.max(0, progress * 100)}%` }}
          />
        </div>
      </div>
    </>
  );
}