export type SafeAreaEdge = 'top' | 'right' | 'bottom' | 'left';

const SAFE_AREA_VAR_BY_EDGE: Record<SafeAreaEdge, string> = {
  top: '--app-safe-top',
  right: '--app-safe-right',
  bottom: '--app-safe-bottom',
  left: '--app-safe-left',
};

const parseCssPxValue = (value: string): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export const readRootCssPxVar = (variableName: string): number => {
  if (typeof window === 'undefined') return 0;
  return parseCssPxValue(
    window.getComputedStyle(document.documentElement).getPropertyValue(variableName)
  );
};

export const getSafeAreaInsetPx = (edge: SafeAreaEdge): number =>
  readRootCssPxVar(SAFE_AREA_VAR_BY_EDGE[edge]);
