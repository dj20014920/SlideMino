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
import { isFeatureUnlocked } from './onboardingService';

// ====== 상수 ======

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const STORAGE_KEY = 'slidemino.notifications.v1';

/** 알림 ID */
const NOTIF_STREAK_REMINDER = 1001;
const NOTIF_MISSION_MORNING = 1002;
const NOTIF_MISSION_EVENING = 1003;

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
  },
  en: {
    [NOTIF_STREAK_REMINDER]: { title: 'Block Slide', body: 'Your streak is about to break! Play a game today 🔥' },
    [NOTIF_MISSION_MORNING]: { title: 'Block Slide', body: "Check out today's new missions! 🎯" },
    [NOTIF_MISSION_EVENING]: { title: 'Block Slide', body: "Today's missions are not completed yet! ⏰" },
  },
  ja: {
    [NOTIF_STREAK_REMINDER]: { title: 'ブロックスライド', body: '連続出席が途切れそうです！今日のゲームをプレイしましょう 🔥' },
    [NOTIF_MISSION_MORNING]: { title: 'ブロックスライド', body: '今日の新しいミッションをチェックしましょう！🎯' },
    [NOTIF_MISSION_EVENING]: { title: 'ブロックスライド', body: '今日のミッションがまだ完了していません！⏰' },
  },
  zh: {
    [NOTIF_STREAK_REMINDER]: { title: '方块滑动', body: '连续签到即将中断！今天来玩一局吧 🔥' },
    [NOTIF_MISSION_MORNING]: { title: '方块滑动', body: '来看看今天的新任务吧！🎯' },
    [NOTIF_MISSION_EVENING]: { title: '方块滑动', body: '今天的任务还没完成哦！⏰' },
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
  // i18next 사용 가능 시 언어 감지, 아니면 navigator.language
  let lang = 'en';
  try {
    const stored = localStorage.getItem('i18nextLng');
    if (stored) lang = stored.substring(0, 2);
    else lang = navigator.language.substring(0, 2);
  } catch { /* fallback to en */ }
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

/**
 * 모든 예약 알림을 취소하고, 현재 조건에 맞게 오늘 알림을 재스케줄링.
 *
 * 앱 실행 시, resume 시, 출석 완료 시 호출한다.
 * 네이티브가 아니거나 사용자가 비활성화했으면 no-op.
 */
export async function rescheduleNotifications(): Promise<void> {
  if (!isNativeApp()) return;
  if (!loadSettings().enabled) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // 권한 확인 (아직 미요청이면 요청)
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display === 'prompt' || perm.display === 'prompt-with-rationale') {
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
      ],
    });

    const now = new Date();
    const notifications: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle: boolean };
    }> = [];

    // 1) 스트릭 리마인더 — 22:00 KST, 오늘 출석 미완료이고 streak 해금 시
    if (isFeatureUnlocked('streak') && !isTodayAttended()) {
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

    // 2) 미션 아침 안내 — 10:00 KST, daily_mission 해금 시
    if (isFeatureUnlocked('daily_mission')) {
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
    }

    // 3) 미션 저녁 리마인더 — 21:00 KST, 일일 미션 3개 미완료 시
    if (isFeatureUnlocked('daily_mission') && getDailyCompletedCount() < 3) {
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
      ],
    });
  } catch { /* ignore */ }
}
