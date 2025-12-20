/**
 * 보안 유틸리티: 입력 검증 및 Sanitization
 * Defense in Depth - Layer 3: Input Validation
 */

/** 허용 가능한 난이도 목록 (보드 크기) */
const VALID_DIFFICULTIES = ['5', '7', '8', '10'] as const;
type Difficulty = typeof VALID_DIFFICULTIES[number];

/** 난이도별 최소 게임 시간 (초) - 치팅 방지 */
const MIN_DURATION_BY_DIFFICULTY: Record<Difficulty, number> = {
  '5': 8,    // Extreme: 최소 8초 (고수 플레이어 고려)
  '7': 7,    // Hard: 최소 7초
  '8': 5,    // Normal: 최소 5초
  '10': 4,   // Easy: 최소 4초
};

/** 난이도별 최대 점수/초 비율 - 치팅 방지 */
const MAX_SCORE_PER_SECOND: Record<Difficulty, number> = {
  '5': 3000,   // Extreme
  '7': 3500,   // Hard
  '8': 4000,   // Normal
  '10': 5000,  // Easy
};

/**
 * XSS 방지: HTML 특수 문자 이스케이프 및 위험한 문자 제거
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/\0/g, '') // NULL byte 제거
    .replace(/[\x00-\x1F\x7F]/g, '') // 제어 문자 제거 (탭, 개행 등 포함)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 플레이어 이름 검증
 * - 1-20자
 * - 특수문자 제한
 * - XSS 방지
 */
export function validateName(name: unknown): { valid: boolean; sanitized?: string; error?: string } {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Name must be a string' };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Name cannot be empty' };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: 'Name too long (max 20 characters)' };
  }

  // 알파벳, 숫자, 한글, 공백, 일부 특수문자만 허용
  const validPattern = /^[a-zA-Z0-9가-힣\s._-]+$/;
  if (!validPattern.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters' };
  }

  return { valid: true, sanitized: sanitizeString(trimmed) };
}

/**
 * 난이도 검증 (보드 크기: '5', '7', '8', '10')
 */
export function validateDifficulty(difficulty: unknown): { valid: boolean; value?: Difficulty; error?: string } {
  // 숫자 또는 문자열 허용
  const diffStr = String(difficulty);

  if (!VALID_DIFFICULTIES.includes(diffStr as Difficulty)) {
    return { valid: false, error: 'Invalid difficulty' };
  }

  return { valid: true, value: diffStr as Difficulty };
}

/**
 * 점수 검증
 * - 양의 정수
 * - 합리적인 범위 (0 ~ 1,000,000)
 */
export function validateScore(score: unknown): { valid: boolean; value?: number; error?: string } {
  if (typeof score !== 'number') {
    return { valid: false, error: 'Score must be a number' };
  }

  if (!Number.isInteger(score)) {
    return { valid: false, error: 'Score must be an integer' };
  }

  if (score < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }

  if (score > 1_000_000) {
    return { valid: false, error: 'Score suspiciously high' };
  }

  return { valid: true, value: score };
}

/**
 * 게임 시간 검증
 * - 양의 정수
 * - 합리적인 범위 (1초 ~ 24시간)
 */
export function validateDuration(duration: unknown): { valid: boolean; value?: number; error?: string } {
  if (typeof duration !== 'number') {
    return { valid: false, error: 'Duration must be a number' };
  }

  if (!Number.isInteger(duration)) {
    return { valid: false, error: 'Duration must be an integer' };
  }

  if (duration < 1) {
    return { valid: false, error: 'Duration must be at least 1 second' };
  }

  if (duration > 86400) { // 24시간
    return { valid: false, error: 'Duration too long (max 24 hours)' };
  }

  return { valid: true, value: duration };
}

/**
 * 이동 횟수 검증
 * - 양의 정수
 * - 합리적인 범위 (0 ~ 100,000)
 */
export function validateMoves(moves: unknown): { valid: boolean; value?: number; error?: string } {
  if (typeof moves !== 'number') {
    return { valid: false, error: 'Moves must be a number' };
  }

  if (!Number.isInteger(moves)) {
    return { valid: false, error: 'Moves must be an integer' };
  }

  if (moves < 0) {
    return { valid: false, error: 'Moves cannot be negative' };
  }

  if (moves > 100_000) {
    return { valid: false, error: 'Moves count suspiciously high' };
  }

  return { valid: true, value: moves };
}

/**
 * 안티-치트 검증: 게임 데이터의 일관성 확인
 */
export function validateGameConsistency(
  score: number,
  difficulty: Difficulty,
  duration: number,
  moves: number
): { valid: boolean; error?: string } {

  // 1. 최소 게임 시간 체크
  // 의미 있는 점수(10점 이상)일 때 최소 시간 적용 - 치팅 방지
  const minDuration = MIN_DURATION_BY_DIFFICULTY[difficulty];
  if (score > 10 && duration < minDuration) {
    return { valid: false, error: `Game too fast for ${difficulty} difficulty` };
  }

  // 2. 점수/시간 비율 체크
  const maxScorePerSec = MAX_SCORE_PER_SECOND[difficulty];
  const scorePerSecond = duration > 0 ? score / duration : Infinity;
  if (scorePerSecond > maxScorePerSec) {
    return { valid: false, error: 'Score rate too high' };
  }

  // 3. 움직임 대비 점수 체크 (점수는 움직임에 비례해야 함)
  if (moves > 0) {
    const scorePerMove = score / moves;
    if (scorePerMove > 5000) { // 한 움직임당 평균 5000점 이상은 비정상
      return { valid: false, error: 'Score per move suspiciously high' };
    }
  }

  // 4. 0점이면 움직임도 적어야 함
  if (score === 0 && moves > 10) {
    return { valid: false, error: 'Inconsistent: zero score with many moves' };
  }

  return { valid: true };
}

/**
 * 타임스탬프 검증
 * - 과거 24시간 이내
 * - 미래 아님
 */
export function validateTimestamp(timestamp: unknown): { valid: boolean; error?: string } {
  if (typeof timestamp !== 'number') {
    return { valid: false, error: 'Timestamp must be a number' };
  }

  const now = Date.now();
  const dayAgo = now - 86400_000; // 24시간 전

  if (timestamp > now + 60_000) { // 미래 1분 이상은 비정상
    return { valid: false, error: 'Timestamp is in the future' };
  }

  if (timestamp < dayAgo) {
    return { valid: false, error: 'Timestamp too old' };
  }

  return { valid: true };
}
