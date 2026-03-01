/**
 * 2주 시즌 랭킹 리셋 시스템
 *
 * 시즌 주기: 매월 1일~15일 / 16일~말일
 * 리셋 시: 아카이브 → 보상 생성 → 삭제 (원자적 트랜잭션)
 * 보상: 난이도별 1등 30조각, 2등 20조각, 3등 15조각, 참여자 1조각
 */

interface Env {
  DB: D1Database;
}

// KST = UTC+9
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

// 난이도별 보상 (조각 수)
const REWARD_TOP1 = 30;
const REWARD_TOP2 = 20;
const REWARD_TOP3 = 15;
const REWARD_PARTICIPANT = 1;
const REWARD_EXPIRY_DAYS = 15;

const DIFFICULTIES = ['4', '5', '7', '8', '10'];

/** KST 기준 현재 날짜 정보 */
function getKstDate(now: Date): { year: number; month: number; day: number } {
  const kstMs = now.getTime() + KST_OFFSET_MS;
  const kst = new Date(kstMs);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1, // 1-indexed
    day: kst.getUTCDate(),
  };
}

/** 해당 월의 마지막 날 */
function getLastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 시즌 경계 계산 (KST 기준) */
export function getSeasonBoundaries(now: Date): {
  seasonId: string;
  seasonStartMs: number;
  seasonEndMs: number;
} {
  const { year, month, day } = getKstDate(now);
  const lastDay = getLastDayOfMonth(year, month);

  let startDay: number;
  let endDay: number;

  if (day <= 15) {
    startDay = 1;
    endDay = 15;
  } else {
    startDay = 16;
    endDay = lastDay;
  }

  // KST 시작: 해당일 00:00:00 KST = UTC 전날 15:00:00
  const seasonStartMs = Date.UTC(year, month - 1, startDay) - KST_OFFSET_MS;
  // KST 종료: 종료일 23:59:59.999 KST
  const seasonEndMs = Date.UTC(year, month - 1, endDay, 23, 59, 59, 999) - KST_OFFSET_MS;

  const seasonId = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;

  return { seasonId, seasonStartMs, seasonEndMs };
}

/** 이전 시즌 경계 계산 (현재 시즌 직전) */
function getPreviousSeasonBoundaries(now: Date): {
  seasonId: string;
  seasonStartMs: number;
} {
  const { year, month, day } = getKstDate(now);

  if (day <= 15) {
    // 현재 전반기 → 이전 = 지난달 후반기
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startDay = 16;
    const seasonStartMs = Date.UTC(prevYear, prevMonth - 1, startDay) - KST_OFFSET_MS;
    const seasonId = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    return { seasonId, seasonStartMs };
  } else {
    // 현재 후반기 → 이전 = 이번달 전반기
    const startDay = 1;
    const seasonStartMs = Date.UTC(year, month - 1, startDay) - KST_OFFSET_MS;
    const seasonId = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    return { seasonId, seasonStartMs };
  }
}

/**
 * 시즌 리셋 필요 여부 확인 후 실행
 * rankings GET/POST 시 매번 호출됨
 */
export async function resetSeasonIfNeeded(env: Env, now: Date = new Date()): Promise<void> {
  const { seasonStartMs } = getSeasonBoundaries(now);

  // rankings 테이블에 데이터가 있는지, 그리고 현재 시즌 이전 데이터인지 확인
  const last = await env.DB.prepare(
    'SELECT MAX(updated_at) AS last_updated FROM rankings'
  ).first<{ last_updated: number | null }>();

  // 데이터 없거나, 현재 시즌 시작 이후 데이터면 리셋 불필요
  if (!last?.last_updated || last.last_updated >= seasonStartMs) {
    return;
  }

  // 이전 시즌 정보
  const prevSeason = getPreviousSeasonBoundaries(now);
  const seasonId = prevSeason.seasonId;
  const rewardExpiresAt = Date.now() + REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const archivedAt = Date.now();

  // 아카이브 + 보상 생성 + 삭제를 batch로 원자적 실행
  const statements: D1PreparedStatement[] = [];

  for (const difficulty of DIFFICULTIES) {
    // 1) 해당 난이도 TOP 3 아카이브
    // ROW_NUMBER 대신 LIMIT + OFFSET으로 구현 (D1 SQLite 호환)
    for (let rank = 1; rank <= 3; rank++) {
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO ranking_seasons (season_id, difficulty, rank, session_id, name, score, install_id_hash, archived_at)
           SELECT ?, ?, ?, session_id, name, score, install_id_hash, ?
           FROM rankings
           WHERE difficulty = ?
           ORDER BY score DESC, updated_at ASC
           LIMIT 1 OFFSET ?`
        ).bind(seasonId, difficulty, rank, archivedAt, difficulty, rank - 1)
      );
    }

    // 2) 보상 생성 (TOP 1~3 + install_id_hash가 있는 유저만)
    const rewardTypes = [
      { rank: 0, type: 'top1', amount: REWARD_TOP1 },
      { rank: 1, type: 'top2', amount: REWARD_TOP2 },
      { rank: 2, type: 'top3', amount: REWARD_TOP3 },
    ];

    for (const reward of rewardTypes) {
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO season_rewards (season_id, difficulty, install_id_hash, reward_type, fragment_amount, created_at, expires_at)
           SELECT ?, ?, install_id_hash, ?, ?, ?, ?
           FROM rankings
           WHERE difficulty = ? AND install_id_hash IS NOT NULL AND COALESCE(platform, '') != 'web'
           ORDER BY score DESC, updated_at ASC
           LIMIT 1 OFFSET ?`
        ).bind(seasonId, difficulty, reward.type, reward.amount, archivedAt, rewardExpiresAt, difficulty, reward.rank)
      );
    }

    // 3) 참여자 보상 (TOP 3 제외, 웹 유저 제외, install_id_hash가 있는 모든 유저)
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO season_rewards (season_id, difficulty, install_id_hash, reward_type, fragment_amount, created_at, expires_at)
         SELECT ?, difficulty, install_id_hash, 'participant', ?, ?, ?
         FROM rankings
         WHERE difficulty = ?
           AND install_id_hash IS NOT NULL
           AND COALESCE(platform, '') != 'web'
           AND install_id_hash NOT IN (
             SELECT install_id_hash FROM rankings
             WHERE difficulty = ? AND install_id_hash IS NOT NULL
             ORDER BY score DESC, updated_at ASC
             LIMIT 3
           )`
      ).bind(seasonId, REWARD_PARTICIPANT, archivedAt, rewardExpiresAt, difficulty, difficulty)
    );
  }

  // 4) 랭킹 삭제 (아카이브 + 보상 생성 후)
  statements.push(
    env.DB.prepare('DELETE FROM rankings')
  );

  // 원자적 실행: 하나라도 실패하면 전체 롤백
  await env.DB.batch(statements);
}
