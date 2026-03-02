/**
 * 게임 이벤트 버스 — 타입 안전한 pub/sub 시스템
 *
 * 게임 내 주요 액션(블록 배치, 슬라이드, 점수 변동, 게임오버 등)을
 * 미션·XP·스트릭·공유 카드 등 여러 시스템에 느슨하게 전파합니다.
 *
 * 사용법:
 *   gameEventBus.on('BLOCK_PLACED', (data) => { ... });
 *   gameEventBus.emit('BLOCK_PLACED', { pieceType: 'T', ... });
 */

import type { ShapeType, BoardSize, GameMode } from '../types';
import type { MissionCompleteInfo, MissionProgressInfo } from './missionService';
import type { LevelBadge } from './xpLevelService';

// ====== 이벤트 타입 정의 ======

export interface GameEventMap {
  /** 게임 시작 */
  GAME_STARTED: {
    mode: GameMode;
    boardSize: BoardSize;
  };

  /** 블록 보드에 배치됨 */
  BLOCK_PLACED: {
    pieceType: ShapeType;
    rotation: number;
    initialRotation: number;
    value: number;
  };

  /** 슬라이드 수행됨 (방향 + 병합 결과) */
  SLIDE_PERFORMED: {
    direction: 'up' | 'down' | 'left' | 'right';
    mergeCount: number;
    scoreGained: number;
  };

  /** 점수 변동 */
  SCORE_CHANGED: {
    score: number;
    previousScore: number;
    delta: number;
  };

  /** 게임 종료 */
  GAME_OVER: {
    score: number;
    mode: GameMode;
    boardSize: BoardSize;
    moves: number;
    duration: number;
  };

  /** 랭킹에 점수 제출됨 (중간 저장 포함) */
  SCORE_SUBMITTED: {
    score: number;
    boardSize: BoardSize;
    mode: GameMode;
    rank?: number;
    total?: number;
  };

  // ─── 미션 추적용 이벤트 ───

  /** Undo 사용됨 */
  UNDO_USED: Record<string, never>;

  /** 블록 새로고침 사용됨 */
  BLOCK_REFRESH_USED: Record<string, never>;

  /** 점수 공유 완료 */
  SHARE_COMPLETED: Record<string, never>;

  /** 새 타일 값 생성 (병합 결과) */
  TILE_CREATED: {
    value: number;
  };

  /** 스킨 신규 획득 */
  SKIN_ACQUIRED: {
    count: number;
  };

  // ─── 미션 시스템 알림 이벤트 ───

  /** 미션 완료 알림 */
  MISSION_COMPLETED: MissionCompleteInfo;

  /** 미션 진행도 알림 (점수 미션 등의 비침습적 표시) */
  MISSION_PROGRESS: MissionProgressInfo;

  // ─── XP/레벨 시스템 이벤트 ───

  /** XP 획득됨 */
  XP_GAINED: {
    amount: number;
    source: string;
    newLevel: number;
  };

  /** 레벨업 달성 */
  LEVEL_UP: {
    level: number;
    fragments: number;
    badge: LevelBadge | null;
    special: string | null;
  };
}

// ====== 이벤트 핸들러 타입 ======

type EventHandler<K extends keyof GameEventMap> = (data: GameEventMap[K]) => void;

// ====== 이벤트 버스 클래스 ======

class GameEventBus {
  private listeners = new Map<string, Set<Function>>();

  /**
   * 이벤트 구독. 해제 함수를 반환합니다.
   */
  on<K extends keyof GameEventMap>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  /**
   * 이벤트 구독 해제
   */
  off<K extends keyof GameEventMap>(event: K, handler: EventHandler<K>): void {
    this.listeners.get(event)?.delete(handler);
  }

  /**
   * 이벤트 발행 — 모든 구독자에게 동기적으로 전파
   */
  emit<K extends keyof GameEventMap>(event: K, data: GameEventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers || handlers.size === 0) return;
    for (const handler of handlers) {
      try {
        (handler as EventHandler<K>)(data);
      } catch (err) {
        console.error(`[GameEventBus] Error in handler for "${event}":`, err);
      }
    }
  }

  /**
   * 모든 구독 해제 (테스트·정리용)
   */
  clear(): void {
    this.listeners.clear();
  }
}

/** 앱 전역 싱글턴 */
export const gameEventBus = new GameEventBus();
