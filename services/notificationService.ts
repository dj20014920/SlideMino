/**
 * 로컬 푸시 알림 서비스
 *
 * 네이티브(iOS/Android)에서만 동작하며, 웹/앱인토스에서는 no-op.
 * 앱 실행 및 resume 시마다 조건을 재평가하여 알림을 재스케줄링한다.
 *
 * 알림 종류:
 *  - 1001: 스트릭 리마인더 (22:00 KST, 오늘 출석 미완료 시)
 *  - 1002: 미션 안내 (10:00 KST, 매일)
 *  - 1003: 미션 리마인더 (21:00 KST, 일일 미션 미완료 시)
 */

import { isNativeApp } from '../utils/platform';
import { isTodayAttended } from './streakService';
import { getDailyCompletedCount } from './missionService';
import { getLocalAttemptCount, hasAnyEventParticipationHistory } from './weeklyEventService';
import { KST_OFFSET_MS } from '../config/constants';
import i18n from '../i18n/config';
import { DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, normalizeLanguage } from '../i18n/constants';

// ====== 상수 ======
const STORAGE_KEY = 'slidemino.notifications.v1';

/** 알림 ID */
const NOTIF_STREAK_REMINDER = 1001;
const NOTIF_MISSION_MORNING = 1002;
const NOTIF_MISSION_EVENING = 1003;
const NOTIF_EVENT_START = 1004;
const NOTIF_EVENT_END_REMINDER = 1005;

// ====== 알림 콘텐츠 (i18n 미지원 환경 fallback 포함) ======

interface NotifContent {
  title: string;
  body: string;
}

/**
 * 언어별 알림 텍스트 (네이티브 알림은 앱이 꺼진 상태에서 표시되므로
 * i18next 런타임에 의존하지 않고 직접 매핑)
 */
const NOTIF_TEXTS: Record<string, Record<number, NotifContent>> = {
  ko: {
    [NOTIF_STREAK_REMINDER]: { title: '블록 슬라이드', body: '출석이 끊길 것 같아요! 오늘의 게임을 플레이해보세요 🔥' },
    [NOTIF_MISSION_MORNING]: { title: '블록 슬라이드', body: '오늘의 새로운 미션을 확인해보세요! 🎯' },
    [NOTIF_MISSION_EVENING]: { title: '블록 슬라이드', body: '오늘의 미션이 아직 완료되지 않았어요! ⏰' },
    [NOTIF_EVENT_START]: { title: '블록 슬라이드', body: '새로운 주간이벤트가 시작됐어요! 일반 게임은 그대로 보관되니 안심하고 참여하세요 🎯' },
    [NOTIF_EVENT_END_REMINDER]: { title: '블록 슬라이드', body: '이번 주 주간이벤트가 곧 종료됩니다! 보상을 확인하고 참여하세요 ⏰' },
  },
  en: {
    [NOTIF_STREAK_REMINDER]: { title: 'Block Slide', body: 'Your streak is about to break! Play a game today 🔥' },
    [NOTIF_MISSION_MORNING]: { title: 'Block Slide', body: "Check out today's new missions! 🎯" },
    [NOTIF_MISSION_EVENING]: { title: 'Block Slide', body: "Today's missions are not completed yet! ⏰" },
    [NOTIF_EVENT_START]: { title: 'Block Slide', body: 'A new weekly event has started! Your normal game is safe — play with confidence 🎯' },
    [NOTIF_EVENT_END_REMINDER]: { title: 'Block Slide', body: 'This week\'s event is ending soon! Check your rewards and participate ⏰' },
  },
  ja: {
    [NOTIF_STREAK_REMINDER]: { title: 'ブロックスライド', body: '連続出席が途切れそうです！今日のゲームをプレイしましょう 🔥' },
    [NOTIF_MISSION_MORNING]: { title: 'ブロックスライド', body: '今日の新しいミッションをチェックしましょう！🎯' },
    [NOTIF_MISSION_EVENING]: { title: 'ブロックスライド', body: '今日のミッションがまだ完了していません！⏰' },
    [NOTIF_EVENT_START]: { title: 'ブロックスライド', body: '新しいウィークリーイベントが始まりました！通常ゲームはそのまま残るので安心して参加してください 🎯' },
    [NOTIF_EVENT_END_REMINDER]: { title: 'ブロックスライド', body: '今週のイベントがもうすぐ終了します！報酬を確認して参加しましょう ⏰' },
  },
  zh: {
    [NOTIF_STREAK_REMINDER]: { title: '方块滑动', body: '连续签到即将中断！今天来玩一局吧 🔥' },
    [NOTIF_MISSION_MORNING]: { title: '方块滑动', body: '来看看今天的新任务吧！🎯' },
    [NOTIF_MISSION_EVENING]: { title: '方块滑动', body: '今天的任务还没完成哦！⏰' },
    [NOTIF_EVENT_START]: { title: '方块滑动', body: '新的周活动开始了！普通游戏进度不受影响，放心参与吧 🎯' },
    [NOTIF_EVENT_END_REMINDER]: { title: '方块滑动', body: '本周活动即将结束！请查看奖励并参与 ⏰' },
  },
};

// ====== 사용자 설정 ======

interface NotifSettings {
  enabled: boolean; // 사용자가 앱 내에서 알림을 끈 경우
}

function loadSettings(): NotifSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: true };
    return JSON.parse(raw) as NotifSettings;
  } catch {
    return { enabled: true };
  }
}

function saveSettings(s: NotifSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch { /* private mode 등 */ }
}

/** 알림 활성화 상태 조회 */
export function isNotificationEnabled(): boolean {
  return loadSettings().enabled;
}

/** 알림 활성화/비활성화 토글 */
export function setNotificationEnabled(enabled: boolean): void {
  saveSettings({ enabled });
  if (enabled) {
    void rescheduleNotifications();
  } else {
    void cancelAllNotifications();
  }
}

// ====== 핵심 로직 ======

/** 사용자 언어에 맞는 알림 텍스트 반환 */
function getNotifContent(id: number): NotifContent {
  let lang = DEFAULT_LANGUAGE;
  try {
    const runtimeLanguage = i18n.resolvedLanguage ?? i18n.language;
    if (runtimeLanguage) {
      lang = normalizeLanguage(runtimeLanguage);
    } else {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored) lang = normalizeLanguage(stored);
      else if (navigator.language) lang = normalizeLanguage(navigator.language);
    }
  } catch { /* fallback to default */ }
  const texts = NOTIF_TEXTS[lang] ?? NOTIF_TEXTS['en'];
  return texts[id] ?? NOTIF_TEXTS['en'][id];
}

/** 오늘 KST 기준 특정 시:분의 UTC Date 객체를 반환 */
function getTodayKstTime(hour: number, minute: number): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  kst.setUTCHours(hour, minute, 0, 0);
  // KST → UTC 변환
  return new Date(kst.getTime() - KST_OFFSET_MS);
}

/** KST 기준 오늘의 요일 (0=일, 1=월, ..., 6=토) */
function getKstDay(): number {
  const kst = new Date(Date.now() + KST_OFFSET_MS);
  return kst.getUTCDay();
}

/**
 * 모든 예약 알림을 취소하고, 현재 조건에 맞게 오늘 알림을 재스케줄링.
 *
 * 앱 실행 시, resume 시, 출석 완료 시 호출한다.
 * 네이티브가 아니거나 사용자가 비활성화했으면 no-op.
 */
interface RescheduleNotificationOptions {
  allowPermissionPrompt?: boolean;
}

/** 주간 반복 알림 스케줄 생성 (Capacitor weekday: 일=1, 월=2, ..., 토=7) */
function scheduleOnWeekday(
  weekday: number, // JS convention: 일=0, 월=1, ..., 토=6
  hour: number,
  minute: number,
): { on: { weekday: number; hour: number; minute: number }; repeats: boolean; allowWhileIdle: boolean } {
  // JS weekday(0~6) → Capacitor weekday(1~7)
  const capacitorWeekday = weekday + 1;
  return {
    on: { weekday: capacitorWeekday, hour, minute },
    repeats: true,
    allowWhileIdle: true,
  };
}

export async function rescheduleNotifications(options: RescheduleNotificationOptions = {}): Promise<void> {
  if (!isNativeApp()) return;
  if (!loadSettings().enabled) return;
  const { allowPermissionPrompt = true } = options;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // 권한 확인 (아직 미요청이면 요청)
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
      if (!allowPermissionPrompt) return;
      const result = await LocalNotifications.requestPermissions();
      if (result.display !== 'granted') return; // 거부 시 조용히 포기
    } else if (perm.display !== 'granted') {
      return; // 이미 거부됨
    }

    // 기존 알림 모두 취소
    await LocalNotifications.cancel({
      notifications: [
        { id: NOTIF_STREAK_REMINDER },
        { id: NOTIF_MISSION_MORNING },
        { id: NOTIF_MISSION_EVENING },
        { id: NOTIF_EVENT_START },
        { id: NOTIF_EVENT_END_REMINDER },
      ],
    });

    const now = new Date();
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { on?: { weekday: number; hour: number; minute: number }; at?: Date; repeats?: boolean; allowWhileIdle: boolean };
    }> = [];

    // 1) 스트릭 리마인더 — 22:00 KST, 오늘 출석 미완료이고 streak 해금 시
    if (!isTodayAttended()) {
      const at = getTodayKstTime(22, 0);
      if (at.getTime() > now.getTime()) {
        const c = getNotifContent(NOTIF_STREAK_REMINDER);
        notifications.push({
          id: NOTIF_STREAK_REMINDER,
          title: c.title,
          body: c.body,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }

    // 2) 미션 아침 안내 — 10:00 KST
    const at = getTodayKstTime(10, 0);
    if (at.getTime() > now.getTime()) {
      const c = getNotifContent(NOTIF_MISSION_MORNING);
      notifications.push({
        id: NOTIF_MISSION_MORNING,
        title: c.title,
        body: c.body,
        schedule: { at, allowWhileIdle: true },
      });
    }

    // 3) 미션 저녁 리마인더 — 21:00 KST, 일일 미션 3개 미완료 시
    if (getDailyCompletedCount() < 3) {
      const at = getTodayKstTime(21, 0);
      if (at.getTime() > now.getTime()) {
        const c = getNotifContent(NOTIF_MISSION_EVENING);
        notifications.push({
          id: NOTIF_MISSION_EVENING,
          title: c.title,
          body: c.body,
          schedule: { at, allowWhileIdle: true },
        });
      }
    }

    // 4) 주간이벤트 시작 알림 — 매주 월요일 10:00 KST, weekly_event 해금 + 미참여 시
    //    on.weekday + repeats로 자동 주간 반복, 이미 지났어도 다음 주에 자동 발동
    //    과거 참여 이력이 있는 사용자는 재발송 방지 (Week N 참여 → Week N+1 알림 반복 방지)
    if (getLocalAttemptCount() === 0 && !hasAnyEventParticipationHistory()) {
      // 월요일 시작 알림 (JS weekday: 월=1 → Capacitor weekday: 2)
      const c4 = getNotifContent(NOTIF_EVENT_START);
      notifications.push({
        id: NOTIF_EVENT_START,
        title: c4.title,
        body: c4.body,
        schedule: scheduleOnWeekday(1, 10, 0), // 월요일 10:00 KST, 매주 반복
      });

      // 일요일 종료 알림 (JS weekday: 일=0 → Capacitor weekday: 1)
      const c5 = getNotifContent(NOTIF_EVENT_END_REMINDER);
      notifications.push({
        id: NOTIF_EVENT_END_REMINDER,
        title: c5.title,
        body: c5.body,
        schedule: scheduleOnWeekday(0, 21, 0), // 일요일 21:00 KST, 매주 반복
      });
    }

    // 스케줄링
    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch {
    // 플러그인 로드 실패 등 — 조용히 무시 (웹 환경에서 호출된 경우 등)
  }
}

/** 모든 예약 알림 취소 */
async function cancelAllNotifications(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({
      notifications: [
        { id: NOTIF_STREAK_REMINDER },
        { id: NOTIF_MISSION_MORNING },
        { id: NOTIF_MISSION_EVENING },
        { id: NOTIF_EVENT_START },
        { id: NOTIF_EVENT_END_REMINDER },
      ],
    });
  } catch { /* ignore */ }
}
