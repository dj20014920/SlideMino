import React from 'react';

type ExploreGalaxyOverlayProps = {
  size: number;
  cellPx: number;
  active?: boolean;
  mode?: 'board' | 'swatch';
  renderMode?: 'normal' | 'ios-safe';
  zIndex?: number;
};

type StarToken = {
  key: string;
  duration: number;
  delay: number;
  size: number;
  alpha: number;
  distance: number;
  orbitOffset: string;
  angle?: string;
};

const createStaticStarTokens = (count: number): StarToken[] => {
  return Array.from({ length: count }).map((_, idx) => ({
    key: `static-${idx}`,
    duration: 4 + (idx % 5),
    delay: 1 + idx,
    size: 2 + (idx % 3),
    alpha: 0.42 + (idx % 4) * 0.11,
    distance: 20 + idx * 9,
    orbitOffset: `${((idx * 360) / Math.max(1, count)).toFixed(2)}deg`,
  }));
};

const createOrbitStarTokens = (count: number, ringDiameter: number): StarToken[] => {
  return Array.from({ length: count }).map((_, idx) => {
    const distanceRange = ringDiameter * 0.46;
    const minDistance = ringDiameter * 0.12;
    const step = count > 1 ? idx / (count - 1) : 0;
    const distance = Math.round(minDistance + step * distanceRange);
    return {
      key: `ring-${idx}`,
      duration: 6 + (idx % 15),
      delay: 1 + (idx % 10),
      size: 2 + (idx % 5),
      alpha: (40 + (idx % 51)) / 100,
      distance,
      orbitOffset: `${((idx * 360) / Math.max(1, count)).toFixed(2)}deg`,
      angle: `${(idx * 13) % 360}deg`,
    };
  });
};

const ExploreGalaxyOverlay = React.memo<ExploreGalaxyOverlayProps>(({
  size,
  cellPx,
  active = true,
  mode = 'board',
  renderMode = 'normal',
  zIndex,
}) => {
  if (!active || cellPx <= 0) return null;
  const starCount = Math.max(20, size * size * 2);
  const staticStarCount = Math.max(4, Math.ceil(size * 0.6));
  const ringDiameter = cellPx * size * 1.75;
  const ringOffsetY = cellPx * 0.06;
  const center = cellPx * size * 0.5;
  const staticStars = React.useMemo(() => createStaticStarTokens(staticStarCount), [staticStarCount]);
  const orbitStars = React.useMemo(() => createOrbitStarTokens(starCount, ringDiameter), [starCount, ringDiameter]);
  return (
    <div
      // renderMode switches effect intensity only (normal vs ios-safe); clipping is handled by the board SVG mask.
      className={`absolute inset-0 pointer-events-none overflow-hidden skin-explore-galaxy-layer ${renderMode === 'ios-safe' ? 'skin-explore-galaxy-layer--ios-safe' : 'skin-explore-galaxy-layer--normal'}`}
      data-explore-galaxy-layer={mode}
      data-explore-galaxy-render-mode={renderMode}
      style={{
        ['--explore-hue' as any]: 245,
        ['--explore-transition' as any]: '0.25s',
        ['--explore-spark' as any]: '1.8s',
        ['--explore-active' as any]: 1,
        ['--explore-board-size' as any]: size,
        ['--explore-ring-diameter' as any]: `${ringDiameter}px`,
        ['--explore-ring-center' as any]: `${center}px`,
        ['--explore-ring-offset-y' as any]: `${ringOffsetY}px`,
        zIndex: zIndex ?? (mode === 'swatch' ? 0 : 4),
      }}
    >
      <span className="explore-galaxy-spark" />
      <span className="explore-galaxy-backdrop" />
      <span className="explore-galaxy-container">
        {staticStars.map((star) => (
          <span
            key={star.key}
            className="explore-galaxy-star explore-galaxy-star--static"
            style={{
              ['--duration' as any]: star.duration,
              ['--delay' as any]: star.delay,
              ['--size' as any]: star.size,
              ['--alpha' as any]: star.alpha,
              ['--distance' as any]: star.distance,
              ['--orbit-offset' as any]: star.orbitOffset,
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
