export type TutorialAnchorMode = 'auto' | 'self' | 'swatch';

export interface WaitForStableRectOptions {
  minStableFrames?: number;
  timeoutMs?: number;
  epsilonPx?: number;
  signal?: AbortSignal;
}

export interface TargetRectTrackerOptions {
  getTarget: () => HTMLElement | null;
  getOverlay?: () => HTMLElement | null;
  anchorMode?: TutorialAnchorMode;
  onRect: (rect: DOMRect, targetEl: HTMLElement) => void;
  onMissing?: () => void;
}

export interface TargetRectTracker {
  refresh: () => void;
  cleanup: () => void;
}

const DEFAULT_MIN_STABLE_FRAMES = 2;
const DEFAULT_TIMEOUT_MS = 900;
const DEFAULT_EPSILON_PX = 0.75;

const readAnchorNumber = (style: CSSStyleDeclaration, name: string, fallback: number): number => {
  const raw = style.getPropertyValue(name).trim();
  if (!raw) return fallback;
  const parsed = Number(raw.replace('px', '').trim());
  return Number.isFinite(parsed) ? parsed : fallback;
};

const cloneRect = (rect: DOMRect): DOMRect =>
  new DOMRect(rect.left, rect.top, rect.width, rect.height);

const isElementDisplayable = (el: HTMLElement): boolean => {
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
};

const areRectsClose = (a: DOMRect, b: DOMRect, epsilonPx: number): boolean =>
  Math.abs(a.left - b.left) <= epsilonPx &&
  Math.abs(a.top - b.top) <= epsilonPx &&
  Math.abs(a.width - b.width) <= epsilonPx &&
  Math.abs(a.height - b.height) <= epsilonPx;

export const resolveAnchorElement = (
  target: HTMLElement,
  anchorMode: TutorialAnchorMode = 'auto'
): HTMLElement => {
  if (anchorMode === 'self') return target;

  const shouldUseSwatch =
    anchorMode === 'swatch' ||
    (anchorMode === 'auto' && target.dataset.tutorialAnchor === 'skin-swatch');

  if (!shouldUseSwatch) return target;

  return target.querySelector<HTMLElement>('[data-skin-swatch="true"]') ?? target;
};

export const measureRectInOverlaySpace = (
  targetEl: HTMLElement,
  overlayEl?: HTMLElement | null,
  anchorMode: TutorialAnchorMode = 'auto'
): DOMRect | null => {
  if (!isElementDisplayable(targetEl)) return null;

  const anchorTarget = resolveAnchorElement(targetEl, anchorMode);
  const baseRect = anchorTarget.getBoundingClientRect();
  const style = window.getComputedStyle(anchorTarget);
  const inset = readAnchorNumber(style, '--tutorial-anchor-inset', 0);
  const offsetX = readAnchorNumber(style, '--tutorial-anchor-offset-x', 0);
  const offsetY = readAnchorNumber(style, '--tutorial-anchor-offset-y', 0);

  const left = baseRect.left + inset + offsetX;
  const top = baseRect.top + inset + offsetY;
  const width = Math.max(2, baseRect.width - inset * 2);
  const height = Math.max(2, baseRect.height - inset * 2);

  const overlayRect = overlayEl?.getBoundingClientRect();
  const overlayLeft = overlayRect?.left ?? 0;
  const overlayTop = overlayRect?.top ?? 0;

  return new DOMRect(left - overlayLeft, top - overlayTop, width, height);
};

export const waitForStableRect = (
  getRect: () => DOMRect | null,
  options: WaitForStableRectOptions = {}
): Promise<DOMRect | null> => {
  const {
    minStableFrames = DEFAULT_MIN_STABLE_FRAMES,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    epsilonPx = DEFAULT_EPSILON_PX,
    signal,
  } = options;

  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(null);
      return;
    }

    const startedAt = performance.now();
    let rafId: number | null = null;
    let settled = false;
    let stableFrames = 0;
    let previousRect: DOMRect | null = null;
    let latestRect: DOMRect | null = null;

    const settle = (rect: DOMRect | null) => {
      if (settled) return;
      settled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      signal?.removeEventListener('abort', onAbort);
      resolve(rect);
    };

    const onAbort = () => {
      settle(latestRect);
    };

    signal?.addEventListener('abort', onAbort, { once: true });

    const tick = () => {
      if (signal?.aborted) {
        settle(latestRect);
        return;
      }

      const currentRect = getRect();
      latestRect = currentRect ? cloneRect(currentRect) : null;

      if (latestRect && previousRect && areRectsClose(previousRect, latestRect, epsilonPx)) {
        stableFrames += 1;
      } else {
        stableFrames = latestRect ? 1 : 0;
      }
      previousRect = latestRect;

      if (latestRect && stableFrames >= minStableFrames) {
        settle(latestRect);
        return;
      }

      if (performance.now() - startedAt >= timeoutMs) {
        settle(latestRect);
        return;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
  });
};

export const createTargetRectTracker = ({
  getTarget,
  getOverlay,
  anchorMode = 'auto',
  onRect,
  onMissing,
}: TargetRectTrackerOptions): TargetRectTracker => {
  let rafId: number | null = null;
  let cleanedUp = false;

  const measure = () => {
    rafId = null;
    if (cleanedUp) return;

    const targetEl = getTarget();
    if (!targetEl) {
      onMissing?.();
      return;
    }

    const overlayEl = getOverlay ? getOverlay() : null;
    const rect = measureRectInOverlaySpace(targetEl, overlayEl, anchorMode);
    if (!rect) {
      onMissing?.();
      return;
    }

    onRect(rect, targetEl);
  };

  const schedule = () => {
    if (cleanedUp || rafId !== null) return;
    rafId = requestAnimationFrame(measure);
  };

  const mutationObserver = new MutationObserver(schedule);
  mutationObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['id', 'class', 'style', 'hidden', 'data-tutorial-anchor', 'data-skin-swatch'],
  });

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.addEventListener('scroll', schedule, true);

  schedule();

  return {
    refresh: schedule,
    cleanup: () => {
      if (cleanedUp) return;
      cleanedUp = true;
      mutationObserver.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
      window.removeEventListener('scroll', schedule, true);
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },
  };
};
