/**
 * 공유 카드 서비스 — Canvas 기반 결과 이미지 생성 + 공유
 *
 * 게임 결과를 예쁜 카드 이미지(1080×1350)로 렌더링하여
 * SNS 공유·다운로드를 지원합니다.
 *
 * 공유 순서:
 *   1. navigator.share (Web Share API — 모바일 네이티브·웹 모두 지원)
 *   2. 이미지 다운로드 + 텍스트 클립보드 복사 (데스크톱 폴백)
 *   3. 텍스트만 클립보드 복사 (Canvas 실패 시 최후 폴백)
 */

import i18n from 'i18next';
import { loadStreakData, BADGE_MILESTONES } from './streakService';
import { loadSkinSettings } from './skinService';
import { SKIN_CATALOG } from '../constants';
import { gameEventBus } from './gameEventBus';
import type { BoardSize, GameMode } from '../types';

// ====== 카드 옵션 ======

export interface ShareCardOptions {
  score: number;
  boardSize: BoardSize;
  mode: GameMode;
  rank?: number;
  total?: number;
  playerName?: string;
  challengeDate?: string; // 데일리 챌린지: "YYYY-MM-DD"
}

// ====== 상수 ======

const CARD_W = 1080;
const CARD_H = 1350;
const APP_STORE_URL = 'https://apps.apple.com/kr/app/%EB%B8%94%EB%A1%9D-%EC%8A%AC%EB%9D%BC%EC%9D%B4%EB%93%9C-block-slide/id6757861065';
const WEB_URL = 'https://www.slidemino.emozleep.space/';
const FONT_FAMILY = "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif";

// ====== 유틸 ======

/** i18n 번역 헬퍼 (타입 안전성 향상) */
function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options as any) as string;
}

/** 활성 스킨의 대표 HEX → 카드 배경 악센트 색상 */
function getActiveSkinHex(): string {
  const settings = loadSkinSettings();
  if (settings.activeSkinId) {
    const entry = SKIN_CATALOG.find((s) => s.id === settings.activeSkinId);
    if (entry) return entry.hex;
  }
  return '#6366F1'; // 기본 인디고
}

/** HEX → RGBA 문자열 */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 숫자 포맷: 1234 → "1,234" */
function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** 날짜 포맷: "2026-02-28" → "2026.02.28" */
function formatDate(d: string): string {
  return d.replace(/-/g, '.');
}

// ====== Canvas 렌더링 ======

/**
 * 캔버스를 사용하여 공유 카드 이미지(Blob)를 생성합니다.
 * 폰트 로드를 보장하기 위해 document.fonts.ready를 대기합니다.
 */
export async function generateShareCardBlob(options: ShareCardOptions): Promise<Blob> {
  // 폰트 로드 대기 (Canvas 텍스트 깨짐 방지)
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d')!;

  const accentHex = getActiveSkinHex();

  // ① 배경 그라데이션
  drawBackground(ctx, accentHex);

  // ② 상단 로고
  drawLogo(ctx);

  // ③ 점수 (큰 숫자)
  drawScore(ctx, options.score);

  // ④ 보드 크기 + 모드
  drawBoardInfo(ctx, options);

  // ⑤ 순위 (있으면)
  drawRank(ctx, options);

  // ⑥ 스트릭 + 배지
  drawStreakAndBadge(ctx, accentHex);

  // ⑦ 하단 워터마크 (링크 없음)
  drawWatermark(ctx);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas toBlob failed'))),
      'image/png',
    );
  });
}

// ------ 개별 렌더링 함수 ------

function drawBackground(ctx: CanvasRenderingContext2D, accentHex: string) {
  // 깔끔한 어두운 배경 + 상단 악센트 그라데이션
  const bg = ctx.createLinearGradient(0, 0, 0, CARD_H);
  bg.addColorStop(0, '#0F172A');
  bg.addColorStop(0.35, '#1E293B');
  bg.addColorStop(1, '#0F172A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // 악센트 글로우 (상단 중앙)
  const glow = ctx.createRadialGradient(CARD_W / 2, 180, 0, CARD_W / 2, 180, 500);
  glow.addColorStop(0, hexToRgba(accentHex, 0.25));
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, 600);
}

function drawLogo(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 앱 이름 (i18n)
  const title = t('common:app.title');
  const subtitle = t('common:app.subtitle');
  ctx.font = `800 72px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(title, CARD_W / 2, 120);

  // 부제 (있으면)
  if (subtitle) {
    ctx.font = `400 28px ${FONT_FAMILY}`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(subtitle, CARD_W / 2, 175);
  }
}

function drawScore(ctx: CanvasRenderingContext2D, score: number) {
  const y = 380;

  // "SCORE" 레이블
  ctx.textAlign = 'center';
  ctx.font = `700 30px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.letterSpacing = '8px';
  ctx.fillText('SCORE', CARD_W / 2, y - 80);
  ctx.letterSpacing = '0px';

  // 점수 숫자
  ctx.font = `900 120px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(formatNumber(score), CARD_W / 2, y);

  // 점수 아래 구분선
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(CARD_W / 2 - 200, y + 60);
  ctx.lineTo(CARD_W / 2 + 200, y + 60);
  ctx.stroke();
}

function drawBoardInfo(ctx: CanvasRenderingContext2D, options: ShareCardOptions) {
  const y = 530;
  ctx.textAlign = 'center';
  ctx.font = `600 36px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';

  const parts: string[] = [`${options.boardSize}×${options.boardSize}`];
  if (options.mode === 'daily_challenge' && options.challengeDate) {
    parts.push(`${t('common:share.daily')} ${formatDate(options.challengeDate)}`);
  }
  ctx.fillText(parts.join('  ·  '), CARD_W / 2, y);
}

function drawRank(ctx: CanvasRenderingContext2D, options: ShareCardOptions) {
  if (!options.rank || !options.total) return;
  const y = 620;

  ctx.textAlign = 'center';

  // 순위 메달 이모지
  const medalEmoji = options.rank === 1 ? '🥇' : options.rank === 2 ? '🥈' : options.rank === 3 ? '🥉' : '🏆';

  ctx.font = `700 48px ${FONT_FAMILY}`;
  ctx.fillStyle = '#FBBF24'; // amber-400
  ctx.fillText(`${medalEmoji} #${formatNumber(options.rank)}`, CARD_W / 2, y);

  ctx.font = `400 28px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText(`/ ${formatNumber(options.total)}`, CARD_W / 2, y + 45);
}

function drawStreakAndBadge(ctx: CanvasRenderingContext2D, accentHex: string) {
  const streak = loadStreakData();
  const y = 780;

  if (streak.currentStreak <= 0 && !streak.highestBadge) return;

  // 배경 카드
  const cardW = 600;
  const cardH = 100;
  const cardX = (CARD_W - cardW) / 2;
  const cardY = y - cardH / 2;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(ctx, cardX, cardY, cardW, cardH, 20);
  ctx.fill();

  ctx.textBaseline = 'middle';

  // 스트릭 (i18n: 단수/복수 처리)
  if (streak.currentStreak > 0) {
    const daysText = t('common:share.streakDays', { count: streak.currentStreak });
    const streakLabel = `🔥 ${daysText}`;

    ctx.textAlign = 'left';
    ctx.font = `700 36px ${FONT_FAMILY}`;
    ctx.fillStyle = '#F97316'; // orange-500
    ctx.fillText(streakLabel, cardX + 30, y);
  }

  // 최고 배지
  if (streak.highestBadge) {
    const badge = BADGE_MILESTONES.find((b) => b.id === streak.highestBadge);
    if (badge) {
      ctx.textAlign = 'right';
      ctx.font = `600 32px ${FONT_FAMILY}`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(`${badge.emoji}`, cardX + cardW - 30, y);
    }
  }
}

/** 하단 워터마크만 표시 (링크 없음) */
function drawWatermark(ctx: CanvasRenderingContext2D) {
  // CTA (i18n)
  const y = 1100;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 40px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(t('common:share.beatMyScore'), CARD_W / 2, y);

  // 하단 작은 워터마크 (앱 이름)
  const title = t('common:app.title');
  const subtitle = t('common:app.subtitle');
  const watermark = subtitle ? `${title} ${subtitle}` : title;
  ctx.font = `400 22px ${FONT_FAMILY}`;
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillText(watermark, CARD_W / 2, CARD_H - 60);
}

// ====== Canvas 유틸 ======

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ====== 텍스트 공유 (이미지 실패 시 폴백) ======

export function generateShareText(options: ShareCardOptions): string {
  const appTitle = t('common:app.title');
  const ptsLabel = t('common:labels.pts');

  const lines: string[] = [];
  lines.push(`🎮 ${appTitle}`);

  if (options.mode === 'daily_challenge' && options.challengeDate) {
    lines.push(`📅 ${t('common:share.daily')} ${formatDate(options.challengeDate)} | ${options.boardSize}×${options.boardSize}`);
  } else {
    lines.push(`📐 ${options.boardSize}×${options.boardSize}`);
  }

  lines.push(`🏆 ${formatNumber(options.score)}${ptsLabel}`);

  if (options.rank && options.total) {
    lines.push(`📊 #${formatNumber(options.rank)} / ${formatNumber(options.total)}`);
  }

  const streak = loadStreakData();
  if (streak.currentStreak > 0) {
    const daysText = t('common:share.streakDays', { count: streak.currentStreak });
    const badgeEmoji = streak.highestBadge
      ? BADGE_MILESTONES.find((b) => b.id === streak.highestBadge)?.emoji ?? ''
      : '';
    lines.push(`🔥 ${daysText} ${badgeEmoji}`.trim());
  }

  lines.push('');
  lines.push(t('common:share.beatMyScore'));
  lines.push(`📱 ${t('common:share.appStore')}: ${APP_STORE_URL}`);
  lines.push(`🌐 ${t('common:share.webPlay')}: ${WEB_URL}`);

  return lines.join('\n');
}

// ====== 공유 실행 ======

export type ShareResult = 'shared' | 'downloaded' | 'copied' | 'failed';

/**
 * 공유 카드 이미지를 생성하고 공유합니다.
 *
 * 우선순위:
 *   1. Web Share API (files) — 모바일 네이티브·웹 모두 지원
 *   2. 이미지 다운로드 — 데스크톱 등 Web Share 미지원
 *   3. 텍스트 클립보드 — Canvas 실패 시 최후 수단
 */
export async function shareGameResult(options: ShareCardOptions): Promise<ShareResult> {
  const text = generateShareText(options);

  // ① 이미지 생성 시도
  let blob: Blob | null = null;
  try {
    blob = await generateShareCardBlob(options);
  } catch (err) {
    console.warn('[ShareCard] Image generation failed:', err);
  }

  // ② Web Share API로 공유 시도 (이미지 포함)
  if (blob && typeof navigator !== 'undefined' && navigator.share) {
    try {
      const file = new File([blob], 'block-slide-result.png', { type: 'image/png' });
      // navigator.canShare로 파일 공유 가능 여부 확인
      const shareData: ShareData = { text, files: [file] };
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        gameEventBus.emit('SHARE_COMPLETED', {});
        return 'shared';
      }
      // 파일 공유 불가 시 텍스트만 공유 시도
      await navigator.share({ text });
      // 이미지는 별도 다운로드
      downloadBlob(blob, 'block-slide-result.png');
      gameEventBus.emit('SHARE_COMPLETED', {});
      return 'shared';
    } catch (err: any) {
      // 사용자가 공유 시트를 취소한 경우
      if (err?.name === 'AbortError') return 'failed';
      console.warn('[ShareCard] Web Share failed:', err);
    }
  }

  // ③ 이미지 다운로드 + 텍스트 클립보드 복사
  if (blob) {
    downloadBlob(blob, 'block-slide-result.png');
    await copyToClipboard(text);
    gameEventBus.emit('SHARE_COMPLETED', {});
    return 'downloaded';
  }

  // ④ 최후 폴백: 텍스트만 클립보드
  const copied = await copyToClipboard(text);
  return copied ? 'copied' : 'failed';
}

// ====== 내부 유틸 ======

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // 클린업
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // 폴백: execCommand
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
