/**
 * 서버 시간 오프셋 서비스
 *
 * 기존 API 응답의 Date 헤더를 활용하여 클라이언트-서버 시간 차이를 캐싱합니다.
 * 추가 API 호출 없이, 기존 응답의 Date 헤더만 파싱합니다.
 *
 * - offsetMs = serverTime - clientTime
 * - getServerAdjustedNow() = new Date(Date.now() + offsetMs)
 * - 24시간 이상 차이 시 경고 플래그
 */

const OFFSET_STORAGE_KEY = 'slidemino.serverTimeOffset';
const WARNING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24시간

let cachedOffsetMs: number | null = null;
let clockWarning = false;

/** 저장된 오프셋 복원 */
function loadOffset(): number | null {
  try {
    const raw = localStorage.getItem(OFFSET_STORAGE_KEY);
    if (raw === null) return null;
    const val = Number(raw);
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

/** 오프셋 저장 */
function saveOffset(ms: number): void {
  try {
    localStorage.setItem(OFFSET_STORAGE_KEY, String(Math.round(ms)));
  } catch {
    // ignore
  }
}

/** 초기화: 저장된 오프셋 복원 */
function ensureLoaded(): void {
  if (cachedOffsetMs === null) {
    cachedOffsetMs = loadOffset() ?? 0;
    clockWarning = Math.abs(cachedOffsetMs) >= WARNING_THRESHOLD_MS;
  }
}

/**
 * API 응답의 Date 헤더로 오프셋 갱신.
 * fetch() 후 response를 넘겨주면 자동 처리됩니다.
 */
export function updateServerTimeOffset(response: Response): void {
  const dateHeader = response.headers.get('Date');
  if (!dateHeader) return;

  const serverTime = new Date(dateHeader).getTime();
  if (Number.isNaN(serverTime)) return;

  const clientNow = Date.now();
  cachedOffsetMs = serverTime - clientNow;
  clockWarning = Math.abs(cachedOffsetMs) >= WARNING_THRESHOLD_MS;
  saveOffset(cachedOffsetMs);
}

/**
 * 서버 시간으로 보정된 현재 시각을 반환합니다.
 * 오프셋이 아직 없으면 로컬 시간을 그대로 반환합니다.
 */
export function getServerAdjustedNow(): Date {
  ensureLoaded();
  return new Date(Date.now() + (cachedOffsetMs ?? 0));
}

/** 기기-서버 시간 차이가 24시간 이상인지 여부 */
export function hasClockWarning(): boolean {
  ensureLoaded();
  return clockWarning;
}

/** 현재 캐싱된 오프셋(ms) 반환 (디버그용) */
export function getOffsetMs(): number {
  ensureLoaded();
  return cachedOffsetMs ?? 0;
}
