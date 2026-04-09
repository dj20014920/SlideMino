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

async function ensureRankingMemberBestConflictTarget(env: Env): Promise<void> {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS ranking_member_best (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       season_id TEXT NOT NULL,
       board_size TEXT NOT NULL,
       member_key TEXT NOT NULL,
       name TEXT NOT NULL,
       best_score INTEGER NOT NULL DEFAULT 0,
       session_id TEXT NOT NULL,
       install_id_hash TEXT,
       platform TEXT,
       updated_at INTEGER NOT NULL
     )`
  ).run();

  // 부분 마이그레이션 환경에서 중복 데이터가 있으면 UNIQUE 인덱스 생성이 실패하므로 선제 정리한다.
  await env.DB.prepare(
    `DELETE FROM ranking_member_best
     WHERE id IN (
       SELECT id
       FROM (
         SELECT
           id,
           ROW_NUMBER() OVER (
             PARTITION BY season_id, board_size, member_key
             ORDER BY best_score DESC, updated_at ASC, id ASC
           ) AS row_num
         FROM ranking_member_best
       ) ranked
       WHERE ranked.row_num > 1
     )`
  ).run();

  await env.DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_ranking_member_best_uniq
     ON ranking_member_best (season_id, board_size, member_key)`
  ).run();
}

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
  seasonEndMs: number;
} {
  const { year, month, day } = getKstDate(now);

  if (day <= 15) {
    // 현재 전반기 → 이전 = 지난달 후반기
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const startDay = 16;
    const endDay = getLastDayOfMonth(prevYear, prevMonth);
    const seasonStartMs = Date.UTC(prevYear, prevMonth - 1, startDay) - KST_OFFSET_MS;
    const seasonEndMs = Date.UTC(prevYear, prevMonth - 1, endDay, 23, 59, 59, 999) - KST_OFFSET_MS;
    const seasonId = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    return { seasonId, seasonStartMs, seasonEndMs };
  } else {
    // 현재 후반기 → 이전 = 이번달 전반기
    const startDay = 1;
    const endDay = 15;
    const seasonStartMs = Date.UTC(year, month - 1, startDay) - KST_OFFSET_MS;
    const seasonEndMs = Date.UTC(year, month - 1, endDay, 23, 59, 59, 999) - KST_OFFSET_MS;
    const seasonId = `${year}-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`;
    return { seasonId, seasonStartMs, seasonEndMs };
  }
}

/**
 * 시즌 리셋 필요 여부 확인 후 실행
 * rankings GET/POST 시 매번 호출됨
 */
export async function resetSeasonIfNeeded(env: Env, now: Date = new Date()): Promise<void> {
  const { seasonStartMs } = getSeasonBoundaries(now);

  await ensureRankingMemberBestConflictTarget(env);

  const [legacyLast, memberBestLast] = await Promise.all([
    env.DB.prepare(
      'SELECT MAX(updated_at) AS last_updated FROM rankings'
    ).first<{ last_updated: number | null }>(),
    env.DB.prepare(
      'SELECT MAX(updated_at) AS last_updated FROM ranking_member_best'
    ).first<{ last_updated: number | null }>(),
  ]);

  const latestUpdatedAt = Math.max(
    Number(legacyLast?.last_updated ?? 0),
    Number(memberBestLast?.last_updated ?? 0)
  );

  // 데이터 없거나, 현재 시즌 시작 이후 데이터면 리셋 불필요
  if (!latestUpdatedAt || latestUpdatedAt >= seasonStartMs) {
    return;
  }

  // 이전 시즌 정보
  const prevSeason = getPreviousSeasonBoundaries(now);
  const seasonId = prevSeason.seasonId;
  const difficultyPlaceholders = DIFFICULTIES.map(() => '?').join(', ');
  const rewardExpiresAt = Date.now() + REWARD_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  const archivedAt = Date.now();

  const [memberBestCountResult, legacyCountResult] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM ranking_member_best
       WHERE season_id = ?`
    ).bind(seasonId).first<{ total: number | string }>(),
    env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM rankings
       WHERE updated_at >= ? AND updated_at <= ?
         AND difficulty IN (${difficultyPlaceholders})`
    ).bind(prevSeason.seasonStartMs, prevSeason.seasonEndMs, ...DIFFICULTIES).first<{ total: number | string }>(),
  ]);

  const memberBestCount = Number(memberBestCountResult?.total ?? 0);
  const legacyCount = Number(legacyCountResult?.total ?? 0);
  const shouldBackfillFromLegacy = memberBestCount === 0 && legacyCount > 0;
  const archiveCandidateCount = shouldBackfillFromLegacy ? legacyCount : memberBestCount;

  const rewardEligibleCountResult = shouldBackfillFromLegacy
    ? await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM rankings
       WHERE updated_at >= ? AND updated_at <= ?
         AND difficulty IN (${difficultyPlaceholders})
         AND install_id_hash IS NOT NULL
         AND COALESCE(platform, '') != 'web'`
    ).bind(prevSeason.seasonStartMs, prevSeason.seasonEndMs, ...DIFFICULTIES).first<{ total: number | string }>()
    : await env.DB.prepare(
      `SELECT COUNT(*) AS total
       FROM ranking_member_best
       WHERE season_id = ?
         AND install_id_hash IS NOT NULL
         AND COALESCE(platform, '') != 'web'`
    ).bind(seasonId).first<{ total: number | string }>();

  const rewardEligibleCount = Number(rewardEligibleCountResult?.total ?? 0);
  if (archiveCandidateCount === 0 && rewardEligibleCount === 0) {
    console.warn('[SeasonReset] Skip reset: no archive/reward candidates found', {
      seasonId,
      memberBestCount,
      legacyCount,
    });
    return;
  }

  // 아카이브 + 보상 생성 + 삭제를 batch로 원자적 실행
  const statements: D1PreparedStatement[] = [];

  if (shouldBackfillFromLegacy) {
    statements.push(
      env.DB.prepare(
        `WITH ranked_rows AS (
           SELECT
             difficulty AS board_size,
             COALESCE(NULLIF(install_id_hash, ''), 'legacy:' || session_id) AS member_key,
             name,
             score AS best_score,
             session_id,
             install_id_hash,
             platform,
             updated_at,
             ROW_NUMBER() OVER (
               PARTITION BY difficulty, COALESCE(NULLIF(install_id_hash, ''), 'legacy:' || session_id)
               ORDER BY score DESC, updated_at ASC, id ASC
             ) AS row_num
           FROM rankings
           WHERE updated_at >= ? AND updated_at <= ?
             AND difficulty IN (${difficultyPlaceholders})
         )
         INSERT INTO ranking_member_best (
           season_id, board_size, member_key, name, best_score, session_id, install_id_hash, platform, updated_at
         )
         SELECT
           ?, board_size, member_key, name, best_score, session_id, install_id_hash, platform, updated_at
         FROM ranked_rows
         WHERE row_num = 1
         ON CONFLICT (season_id, board_size, member_key) DO UPDATE SET
           name = excluded.name,
           best_score = excluded.best_score,
           session_id = excluded.session_id,
           install_id_hash = COALESCE(excluded.install_id_hash, ranking_member_best.install_id_hash),
           platform = COALESCE(excluded.platform, ranking_member_best.platform),
           updated_at = excluded.updated_at
         WHERE
           excluded.best_score > ranking_member_best.best_score
           OR (
             excluded.best_score = ranking_member_best.best_score
             AND excluded.updated_at < ranking_member_best.updated_at
           )`
      ).bind(prevSeason.seasonStartMs, prevSeason.seasonEndMs, ...DIFFICULTIES, seasonId)
    );
  }

  for (const difficulty of DIFFICULTIES) {
    // 1) 해당 난이도 TOP 3 아카이브
    // ROW_NUMBER 대신 LIMIT + OFFSET으로 구현 (D1 SQLite 호환)
    for (let rank = 1; rank <= 3; rank++) {
      statements.push(
        env.DB.prepare(
          `INSERT OR IGNORE INTO ranking_seasons (season_id, difficulty, rank, session_id, name, score, install_id_hash, archived_at)
           SELECT ?, ?, ?, session_id, name, best_score, install_id_hash, ?
           FROM ranking_member_best
           WHERE season_id = ? AND board_size = ?
           ORDER BY best_score DESC, updated_at ASC
           LIMIT 1 OFFSET ?`
        ).bind(seasonId, difficulty, rank, archivedAt, seasonId, difficulty, rank - 1)
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
           FROM ranking_member_best
           WHERE season_id = ? AND board_size = ? AND install_id_hash IS NOT NULL AND COALESCE(platform, '') != 'web'
           ORDER BY best_score DESC, updated_at ASC
           LIMIT 1 OFFSET ?`
        ).bind(seasonId, difficulty, reward.type, reward.amount, archivedAt, rewardExpiresAt, seasonId, difficulty, reward.rank)
      );
    }

    // 3) 참여자 보상 (TOP 3 제외, 웹 유저 제외, install_id_hash가 있는 모든 유저)
    statements.push(
      env.DB.prepare(
        `INSERT OR IGNORE INTO season_rewards (season_id, difficulty, install_id_hash, reward_type, fragment_amount, created_at, expires_at)
         SELECT ?, ?, install_id_hash, 'participant', ?, ?, ?
         FROM ranking_member_best
         WHERE season_id = ?
           AND board_size = ?
           AND install_id_hash IS NOT NULL
           AND COALESCE(platform, '') != 'web'
           AND install_id_hash NOT IN (
             SELECT install_id_hash FROM ranking_member_best
             WHERE season_id = ? AND board_size = ? AND install_id_hash IS NOT NULL
             ORDER BY best_score DESC, updated_at ASC
             LIMIT 3
           )`
      ).bind(seasonId, difficulty, REWARD_PARTICIPANT, archivedAt, rewardExpiresAt, seasonId, difficulty, seasonId, difficulty)
    );
  }

  // 4) 랭킹 삭제 (아카이브 + 보상 생성 후)
  statements.push(
    env.DB.prepare('DELETE FROM rankings')
  );
  statements.push(
    env.DB.prepare('DELETE FROM ranking_member_best')
  );

  // 원자적 실행: 하나라도 실패하면 전체 롤백
  await env.DB.batch(statements);
}
