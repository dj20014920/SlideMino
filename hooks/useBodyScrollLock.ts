import { useEffect } from 'react';

let lockCount = 0;
let savedScrollY = 0;
let originalBodyStyle: {
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
  overflow: string;
} | null = null;
let originalHtmlOverflow = '';

function lockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (lockCount === 0) {
    const bodyStyle = document.body.style;
    originalBodyStyle = {
      position: bodyStyle.position,
      top: bodyStyle.top,
      left: bodyStyle.left,
      right: bodyStyle.right,
      width: bodyStyle.width,
      overflow: bodyStyle.overflow,
    };
    originalHtmlOverflow = document.documentElement.style.overflow;

    savedScrollY = window.scrollY;

    bodyStyle.position = 'fixed';
    bodyStyle.top = `-${savedScrollY}px`;
    bodyStyle.left = '0';
    bodyStyle.right = '0';
    bodyStyle.width = '100%';
    bodyStyle.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
  }

  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (lockCount === 0) return;

  lockCount -= 1;
  if (lockCount > 0) return;

  if (originalBodyStyle) {
    const bodyStyle = document.body.style;
    bodyStyle.position = originalBodyStyle.position;
    bodyStyle.top = originalBodyStyle.top;
    bodyStyle.left = originalBodyStyle.left;
    bodyStyle.right = originalBodyStyle.right;
    bodyStyle.width = originalBodyStyle.width;
    bodyStyle.overflow = originalBodyStyle.overflow;
  }
  document.documentElement.style.overflow = originalHtmlOverflow;
  window.scrollTo(0, savedScrollY);
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    lockBodyScroll();
    return () => unlockBodyScroll();
  }, [locked]);
}
