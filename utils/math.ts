/** 값을 [min, max] 범위로 제한한다. */
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
