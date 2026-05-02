import React from 'react';

interface ComboIndicatorProps {
  comboCount: number;
  timerMs: number;
  isActive: boolean;
  multiplier: number;
}

const COMBO_TIMER_MS = 2500;

export default function ComboIndicator({ comboCount, timerMs, isActive, multiplier }: ComboIndicatorProps) {
  if (!isActive || comboCount < 2) return null;

  const progress = timerMs / COMBO_TIMER_MS;
  const isUrgent = timerMs < 500;

  let barColor = 'bg-yellow-400';
  if (comboCount >= 5) barColor = 'bg-red-600';
  else if (comboCount >= 4) barColor = 'bg-red-500';
  else if (comboCount >= 3) barColor = 'bg-orange-400';

  let textColor = 'text-yellow-300';
  if (comboCount >= 5) textColor = 'text-red-400';
  else if (comboCount >= 4) textColor = 'text-red-400';
  else if (comboCount >= 3) textColor = 'text-orange-300';

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      {/* Combo counter */}
      <div className="text-center mb-1">
        <span className={`text-lg font-bold ${textColor}`}>
          {comboCount}x COMBO!
        </span>
        <span className="text-xs text-white/70 ml-2">x{multiplier}</span>
      </div>
      {/* Timer bar */}
      <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-50 ${barColor} ${isUrgent ? 'animate-pulse' : ''}`}
          style={{ width: `${Math.max(0, progress * 100)}%` }}
        />
      </div>
    </div>
  );
}