/**
 * 라우팅 유틸리티 - 해시 기반 SPA 라우팅
 * React Router 없이 경량 라우팅 시스템 구현
 */

import { BASE_URL } from '../config/constants';

export type Route = '/' | '/privacy' | '/terms' | '/about' | '/contact';

/**
 * 현재 해시 기반 라우트 가져오기
 */
export const getCurrentRoute = (): Route => {
  const hash = window.location.hash.slice(1) || '/';
  const validRoutes: Route[] = ['/', '/privacy', '/terms', '/about', '/contact'];
  return validRoutes.includes(hash as Route) ? (hash as Route) : '/';
};

/**
 * 라우트로 이동
 */
export const navigateTo = (route: Route): void => {
  window.location.hash = route;
};

/**
 * 해시 변경 이벤트 리스너 등록
 */
export const onRouteChange = (callback: (route: Route) => void): (() => void) => {
  const handler = () => callback(getCurrentRoute());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
};

/**
 * 페이지 메타데이터 업데이트 (SEO 최적화)
 */
export const updatePageMeta = (route: Route): void => {
  const metaData: Record<Route, { title: string; description: string }> = {
    '/': {
      title: '블록 슬라이드 (Block Slide) - 2048 meets Tetris Logic Puzzle',
      description: 'Play 블록 슬라이드 (Block Slide) for free! The ultimate brain-training puzzle game combining 2048 merging mechanics with Tetris-style block placement.'
    },
    '/privacy': {
      title: 'Privacy Policy - 블록 슬라이드 (Block Slide)',
      description: 'Learn how 블록 슬라이드 (Block Slide) collects, uses, and protects your personal information. Transparent privacy practices and data security.'
    },
    '/terms': {
      title: 'Terms of Service - 블록 슬라이드 (Block Slide)',
      description: 'Read the terms and conditions for using 블록 슬라이드 (Block Slide). User rights, responsibilities, and legal information.'
    },
    '/about': {
      title: 'About 블록 슬라이드 (Block Slide) - Game Guide & Features',
      description: 'Discover how to play 블록 슬라이드 (Block Slide), game features, strategies, and FAQs. Complete guide to mastering this addictive puzzle game.'
    },
    '/contact': {
      title: 'Contact Us - 블록 슬라이드 (Block Slide) Support',
      description: 'Get in touch with the 블록 슬라이드 (Block Slide) team. Report bugs, share feedback, or ask questions. We\'re here to help!'
    }
  };

  const meta = metaData[route];
  document.title = meta.title;
  
  // Update meta description
  let descMeta = document.querySelector('meta[name="description"]');
  if (descMeta) {
    descMeta.setAttribute('content', meta.description);
  }

  // Update Open Graph tags
  let ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', meta.title);

  let ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', meta.description);

  // Update og:url (SNS 공유 시 올바른 URL 표시)
  let ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    const path = route === '/' ? '' : route;
    ogUrl.setAttribute('content', `${BASE_URL}${path}`);
  }

  // Update Twitter tags
  let twitterTitle = document.querySelector('meta[property="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', meta.title);

  let twitterDesc = document.querySelector('meta[property="twitter:description"]');
  if (twitterDesc) twitterDesc.setAttribute('content', meta.description);

  // Update twitter:url (Twitter/X 공유 시 올바른 URL 표시)
  let twitterUrl = document.querySelector('meta[property="twitter:url"]');
  if (twitterUrl) {
    const path = route === '/' ? '' : route;
    twitterUrl.setAttribute('content', `${BASE_URL}${path}`);
  }

  // Update canonical URL
  let canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    const path = route === '/' ? '' : route;
    canonical.setAttribute('href', `${BASE_URL}${path}`);
  }
};
