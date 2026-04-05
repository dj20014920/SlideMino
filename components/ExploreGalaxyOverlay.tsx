import React from 'react';

type ExploreGalaxyOverlayProps = {
  size: number;
  cellPx: number;
  boardSpanPx?: number;
  starfieldSeed?: string;
  active?: boolean;
  mode?: 'board' | 'swatch';
  renderMode?: 'normal' | 'ios-safe';
  zIndex?: number;
};

type StarLayer = 'near' | 'mid' | 'far';

type StarPalette = {
  key: string;
  color: string;
  glow: string;
  sizeMul: number;
  alphaMul: number;
  weight: number;
  large?: boolean;
};

type OrbitStarToken = {
  key: string;
  duration: number;
  delay: number;
  size: number;
  alpha: number;
  distance: number;
  orbitOffset: string;
  angle?: string;
  color: string;
  glow: string;
  layer: StarLayer;
};

type FieldStarToken = {
  key: string;
  x: number;
  y: number;
  size: number;
  alpha: number;
  duration: number;
  delay: number;
  color: string;
  glow: string;
  layer: StarLayer;
};

const STAR_PALETTE: StarPalette[] = [
  { key: 'red-giant', color: '#ffb3a3', glow: 'rgba(255, 122, 92, 0.8)', sizeMul: 1.32, alphaMul: 0.92, weight: 0.1, large: true },
  { key: 'yellow-giant', color: '#ffe39d', glow: 'rgba(255, 215, 122, 0.72)', sizeMul: 1.22, alphaMul: 0.95, weight: 0.14, large: true },
  { key: 'blue-white', color: '#d7edff', glow: 'rgba(157, 204, 255, 0.78)', sizeMul: 1.06, alphaMul: 1.05, weight: 0.2 },
  { key: 'orange-dwarf', color: '#ffd2a6', glow: 'rgba(255, 171, 110, 0.66)', sizeMul: 0.94, alphaMul: 0.88, weight: 0.24 },
  { key: 'white-dwarf', color: '#f7fbff', glow: 'rgba(227, 242, 255, 0.65)', sizeMul: 0.78, alphaMul: 0.82, weight: 0.32 },
];

const hashSeed = (seed: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seed: string) => {
  let state = hashSeed(seed) || 0x9e3779b9;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const pickLayer = (rng: () => number): StarLayer => {
  const roll = rng();
  if (roll < 0.22) return 'near';
  if (roll < 0.58) return 'mid';
  return 'far';
};

const pickPalette = (rng: () => number, layer: StarLayer): StarPalette => {
  const layerLargeBoost = layer === 'near' ? 1.35 : layer === 'mid' ? 1.12 : 0.75;
  const total = STAR_PALETTE.reduce((sum, entry) => {
    const largeWeight = entry.large ? layerLargeBoost : 1;
    return sum + (entry.weight * largeWeight);
  }, 0);
  let threshold = rng() * total;
  for (const entry of STAR_PALETTE) {
    threshold -= entry.weight * (entry.large ? layerLargeBoost : 1);
    if (threshold <= 0) return entry;
  }
  return STAR_PALETTE[STAR_PALETTE.length - 1];
};

const isConstrainedConflict = (
  candidate: { x: number; y: number; size: number; layer: StarLayer; large: boolean; },
  existing: { x: number; y: number; size: number; layer: StarLayer; large: boolean; },
): boolean => {
  const dx = candidate.x - existing.x;
  const dy = candidate.y - existing.y;
  const distance = Math.hypot(dx, dy);
  const layerMin = { near: 9, mid: 7, far: 5 };
  let minDistance = Math.max(layerMin[candidate.layer], layerMin[existing.layer], (candidate.size + existing.size) * 1.28);
  if (candidate.large && existing.large) minDistance = Math.max(minDistance, 24);
  else if (candidate.large || existing.large) minDistance = Math.max(minDistance, 15);
  return distance < minDistance;
};

const createFieldStars = (count: number, span: number, rng: () => number): FieldStarToken[] => {
  const stars: (FieldStarToken & { large: boolean })[] = [];
  const layerConfig = {
    near: { size: [1.9, 3.6], alpha: [0.56, 0.94], duration: [2.8, 4.2] },
    mid: { size: [1.2, 2.6], alpha: [0.38, 0.72], duration: [3.8, 5.8] },
    far: { size: [0.8, 1.8], alpha: [0.2, 0.5], duration: [4.6, 7] },
  } as const;
  const maxAttempts = Math.max(count * 45, 220);
  let attempts = 0;
  while (stars.length < count && attempts < maxAttempts) {
    attempts += 1;
    const layer = pickLayer(rng);
    const palette = pickPalette(rng, layer);
    const cfg = layerConfig[layer];
    const baseSize = cfg.size[0] + (cfg.size[1] - cfg.size[0]) * rng();
    const size = baseSize * palette.sizeMul;
    const candidate = {
      x: Math.round(rng() * span),
      y: Math.round(rng() * span),
      size,
      layer,
      large: Boolean(palette.large),
    };
    if (stars.some((star) => isConstrainedConflict(candidate, star))) continue;
    stars.push({
      key: `field-${stars.length}`,
      x: candidate.x,
      y: candidate.y,
      size,
      alpha: (cfg.alpha[0] + (cfg.alpha[1] - cfg.alpha[0]) * rng()) * palette.alphaMul,
      duration: cfg.duration[0] + (cfg.duration[1] - cfg.duration[0]) * rng(),
      delay: rng() * 8,
      color: palette.color,
      glow: palette.glow,
      layer,
      large: candidate.large,
    });
  }
  return stars.slice(0, count).map(({ large: _large, ...star }) => star);
};

const createOrbitStarTokens = (count: number, ringDiameter: number, rng: () => number): OrbitStarToken[] => {
  const tokens: OrbitStarToken[] = [];
  const largeAngles: number[] = [];
  const layerConfig = {
    near: { distance: [0.34, 0.48], size: [2, 4.4], alpha: [0.48, 0.88], duration: [7.5, 11] },
    mid: { distance: [0.25, 0.4], size: [1.5, 3.2], alpha: [0.34, 0.7], duration: [8.8, 12.5] },
    far: { distance: [0.18, 0.34], size: [1.1, 2.4], alpha: [0.22, 0.56], duration: [10.5, 14.8] },
  } as const;
  for (let idx = 0; idx < count; idx += 1) {
    const layer = pickLayer(rng);
    let palette = pickPalette(rng, layer);
    const orbitOffsetDeg = ((idx / Math.max(1, count)) * 360) + (rng() * 8 - 4);
    if (palette.large) {
      const hasNearLarge = largeAngles.some((angle) => {
        const delta = Math.abs((((orbitOffsetDeg - angle + 540) % 360) - 180));
        return delta < 28;
      });
      if (hasNearLarge) palette = STAR_PALETTE[4];
      else largeAngles.push(orbitOffsetDeg);
    }
    const cfg = layerConfig[layer];
    const distance = ringDiameter * (cfg.distance[0] + (cfg.distance[1] - cfg.distance[0]) * rng());
    tokens.push({
      key: `ring-${idx}`,
      duration: cfg.duration[0] + (cfg.duration[1] - cfg.duration[0]) * rng(),
      delay: rng() * 6,
      size: (cfg.size[0] + (cfg.size[1] - cfg.size[0]) * rng()) * palette.sizeMul,
      alpha: (cfg.alpha[0] + (cfg.alpha[1] - cfg.alpha[0]) * rng()) * palette.alphaMul,
      distance,
      orbitOffset: `${orbitOffsetDeg.toFixed(2)}deg`,
      angle: `${Math.round(rng() * 359)}deg`,
      color: palette.color,
      glow: palette.glow,
      layer,
    });
  }
  return tokens;
};

const ExploreGalaxyOverlay = React.memo<ExploreGalaxyOverlayProps>(({
  size,
  cellPx,
  boardSpanPx,
  starfieldSeed,
  active = true,
  mode = 'board',
  renderMode = 'normal',
  zIndex,
}) => {
  if (!active || cellPx <= 0) return null;
  const boardSpan = boardSpanPx ?? (cellPx * size);
  const resolvedSeed = starfieldSeed ?? `explore-galaxy:${mode}:${size}:${Math.round(boardSpan)}:${Math.round(cellPx)}`;
  const starCount = Math.max(24, Math.round(size * size * 1.45));
  const fieldStarCount = Math.max(28, Math.round(size * size * 1.05));
  const ringDiameter = boardSpan * 1.75;
  const ringOffsetY = cellPx * 0.06;
  const center = boardSpan * 0.5;
  const fieldStars = React.useMemo(() => {
    const rng = createSeededRandom(`${resolvedSeed}:field`);
    return createFieldStars(fieldStarCount, boardSpan, rng);
  }, [resolvedSeed, fieldStarCount, boardSpan]);
  const orbitStars = React.useMemo(() => {
    const rng = createSeededRandom(`${resolvedSeed}:orbit`);
    return createOrbitStarTokens(starCount, ringDiameter, rng);
  }, [resolvedSeed, starCount, ringDiameter]);
  return (
    <div
      // renderMode switches effect intensity only (normal vs ios-safe); clipping is handled by the board SVG mask.
      className={`absolute inset-0 pointer-events-none overflow-hidden skin-explore-galaxy-layer ${renderMode === 'ios-safe' ? 'skin-explore-galaxy-layer--ios-safe' : 'skin-explore-galaxy-layer--normal'}`}
      data-explore-galaxy-layer={mode}
      data-explore-galaxy-render-mode={renderMode}
      style={{
        ['--explore-hue' as any]: 245,
        ['--explore-transition' as any]: '0.25s',
        ['--explore-active' as any]: 1,
        ['--explore-board-size' as any]: size,
        ['--explore-ring-diameter' as any]: `${ringDiameter}px`,
        ['--explore-ring-center' as any]: `${center}px`,
        ['--explore-ring-offset-y' as any]: `${ringOffsetY}px`,
        zIndex: zIndex ?? (mode === 'swatch' ? 0 : 4),
      }}
    >
      <span className="explore-galaxy-backdrop" />
      <span className="explore-galaxy-container">
        {fieldStars.map((star) => (
          <span
            key={star.key}
            className={`explore-galaxy-field-star explore-galaxy-field-star--${star.layer}`}
            style={{
              ['--x' as any]: `${star.x}px`,
              ['--y' as any]: `${star.y}px`,
              ['--twinkle-duration' as any]: `${star.duration}s`,
              ['--twinkle-delay' as any]: `${star.delay}s`,
              ['--size' as any]: star.size,
              ['--alpha' as any]: star.alpha,
              ['--star-color' as any]: star.color,
              ['--star-glow' as any]: star.glow,
            }}
          />
        ))}
      </span>
      <span className="explore-galaxy-core">
        <span className="explore-galaxy-ring">
          {orbitStars.map((star) => (
            <span
              key={star.key}
              className="explore-galaxy-star"
                style={{
                  ['--angle' as any]: star.angle,
                  ['--duration' as any]: star.duration,
                  ['--delay' as any]: star.delay,
                  ['--alpha' as any]: star.alpha,
                  ['--size' as any]: star.size,
                  ['--distance' as any]: star.distance,
                  ['--orbit-offset' as any]: star.orbitOffset,
                  ['--star-color' as any]: star.color,
                  ['--star-glow' as any]: star.glow,
                }}
              />
            ))}
        </span>
      </span>
    </div>
  );
});

ExploreGalaxyOverlay.displayName = 'ExploreGalaxyOverlay';

export default ExploreGalaxyOverlay;
