# Security Review: Uncommitted Changes (main)

**Review date:** 2026-05-04  
**Scope:** All unstaged/untracked changes vs HEAD  
**Files analyzed:** combo-rankings.ts, validation.ts, submit.ts (x3), sequentialOnboardingService.ts, SequentialOnboardingOverlay.tsx, seasonReset.ts, rankingService.ts, weeklyEventService.ts, App.tsx diff, LeaderboardModal diff, BottomNavBar diff, onboardingService.ts

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH     | 0 |
| MEDIUM   | 1 |
| LOW      | 3 |
| INFO     | 3 |

No critical or high severity issues. The codebase demonstrates a strong security posture with consistent use of parameterized queries, input validation, rate limiting, CSRF protection, and server-side anti-cheat validation.

---

## MEDIUM Severity

### M-01: No replay attack protection across score submit endpoints

**File:** `functions/api/submit.ts`, `functions/api/daily-challenge/submit.ts`, `functions/api/weekly-event/submit.ts`

**Description:** None of the three submit endpoints implement a nonce, request signature, or time-windowed token to prevent replay attacks. A valid captured HTTP request body could be replayed by an attacker to re-submit the same score payload.

**Risk:** For the main submit endpoint, the same `sessionId` is used as a deduplication key -- the `WHERE NOT EXISTS` guard prevents double-INSERT, and the `WHERE ? > score` clause on UPDATE prevents overwriting a higher score with a lower one. This **limits** replay impact to no-ops. For daily-challenge and weekly-event, the `install_id_hash` + date/event deduplication provides similar protection. However, an attacker could replay a capture of a **higher score** submission to overwrite a user's lower best score with the same higher score repeatedly (a no-op), or replay a request to the daily-challenge with a different `challengeDate` (which is server-validated).

**Mitigation:** The existing deduplication and server-side KST time validation effectively neuter most replay attack vectors. The residual risk is marginal. Consider adding a request nonce or relying on HTTPS + short-lived sessions for defense in depth.

---

## LOW Severity

### L-01: No season parameter format validation in combo-rankings.ts

**File:** `functions/api/combo-rankings.ts` (lines 78, 83-89)

**Description:** The `season` query parameter is used directly in a parameterized query without format validation. While SQL injection is prevented by parameterized binding (`.bind(seasonParam)`), an attacker could pass arbitrary strings (e.g., `season=GARBAGE`, `season=../../etc`) that would produce a valid query with no results or unexpected behavior.

```typescript
const seasonParam = requestUrl.searchParams.get('season') || seasonId;
// ... later:
const query = `SELECT ... WHERE season_id = ?1 ...`;
await env.DB.prepare(query).bind(seasonParam).all<ComboRankingRow>();
```

No harm results from invalid values -- the query simply returns zero rows. But validating against an expected pattern (e.g., `YYYY-MM-DD` format) would provide defense in depth and avoid unexpected behavior if the season ID format changes.

**Recommendation:** Add validation to ensure `seasonParam` matches the expected `YYYY-MM-DD` format before querying.

---

### L-02: Null install_id_hash causes duplicate combo_rankings rows for anonymous users

**File:** `functions/api/submit.ts` (lines 270-285), `functions/api/daily-challenge/submit.ts` (lines 151-167), `functions/api/weekly-event/submit.ts` (lines 264-282, 391-409)

**Description:** The `combo_rankings` table uses `ON CONFLICT(season_id, install_id_hash)` for deduplication. In SQLite, NULL values are distinct in UNIQUE constraints (NULL != NULL). If `installId` is null (anonymous user in normal mode), `install_id_hash` will be NULL, and the ON CONFLICT clause will never trigger a merge. This means anonymous users can accumulate multiple combo ranking rows per season.

**Impact:** The combo rankings GET endpoint has `LIMIT 100` and orders by `best_combo_multiplier DESC`, so duplicate anonymous entries at the bottom of the ranking have negligible real-world impact. The daily-challenge and weekly-event endpoints require `installId`, so this only applies to the normal mode submit path.

**Recommendation:** Either require `installId` for combo ranking (matching daily/weekly behavior), or exclude entries with NULL `install_id_hash` from the combo_rankings insert.

---

### L-03: Race condition in weekly event attempt counting

**File:** `functions/api/weekly-event/submit.ts` (lines 326-357)

**Description:** The weekly event submit reads the current attempt count, then performs `INSERT OR IGNORE INTO event_attempts`. Under concurrent submission (e.g., rapid double-click or retry), two requests may both read `currentCount = 0`, both pass the `currentCount >= 3` check, and both attempt `INSERT OR IGNORE`. One succeeds (attempt 1), the other is ignored because the unique constraint prevents duplicates. The `INSERT OR IGNORE` does not fail -- it returns `meta.changes = 0`, which triggers the 409 handling path.

The 409 path is handled gracefully: it fetches the stored best and returns it. No double-counting of attempts occurs. However, the client receives what appears to be a successful response, while the second submission's potentially higher score is silently dropped if the first request already set the best score.

**Impact:** The 409 handler returns the stored best data, which is consistent. The only risk is a user's best score being not updated if a concurrent submission races. This is a logic edge case, not a data corruption or privilege escalation issue.

**Recommendation:** Accept the current behavior as-is for now (the 409 handler is reasonable). For stronger guarantees, consider using a locking mechanism or serializing per-user requests for the weekly event submit.

---

## INFO Severity

### I-01: Dead `tab` parameter in combo-rankings query

**File:** `functions/api/combo-rankings.ts` (line 77)

**Description:** The `tab` query parameter is extracted but never used in the SQL query or response. The combo rankings are always ordered by combo multiplier globally regardless of game mode.

```typescript
const tab = requestUrl.searchParams.get('tab') || 'ALL';
// tab is never referenced again
```

**Recommendation:** Remove the unused `tab` variable or, if future filtering by game mode is intended, implement the filter in the SQL WHERE clause.

---

### I-02: `validateGameConsistency` normalizes score only by total multiplier but not by difficulty-specific scoring rules

**File:** `functions/utils/validation.ts` (lines 190-230)

**Description:** The anti-cheat consistency check normalizes the score by dividing by `scoreMultiplier * comboMultiplier`, then compares against fixed `MAX_SCORE_PER_SECOND` thresholds per difficulty. This is a reasonable approximation. However, event-specific scoring bonuses (e.g., TRIPLE_KILL's 333-point bonus) are not accounted for in the normalization, which could cause a false positive for legitimate high scores in certain event modes.

**Risk:** Very low. The thresholds are generous (3000-5000 points/second), and the triple kill bonus (333 points) is small relative to the overall score. False rejections are unlikely.

---

### I-03: Overly aggressive HTML entity encoding in `sanitizeString`

**File:** `functions/utils/validation.ts` (lines 39-49)

**Description:** The `sanitizeString` function encodes `/` as `&#x2F;` in addition to the standard HTML entities (`&`, `<`, `>`, `"`, `'`). Escaping forward slashes is unnecessary for XSS prevention in HTML context and can produce unexpected visual output if the sanitized name is used in URLs or paths (unlikely for player names but the encoding is unnecessary).

**Risk:** None. This is purely a style/consistency note. The function correctly prevents XSS.

---

## Areas With No Issues Found

The following areas were reviewed and no security issues were identified:

| Area | Status |
|------|--------|
| **SQL Injection** (all endpoints) | All queries use parameterized `.bind()` -- no concatenation |
| **CSRF Protection** (submit endpoints) | `isCrossSiteMutation` + `isTrustedRequestOrigin` checks present |
| **Rate Limiting** (all endpoints) | Dual-layer rate limiting (workerd binding + DB fallback) |
| **XSS in SequentialOnboarding** | No dynamic HTML rendering; text via React/JSX with i18n |
| **localStorage data integrity** | JSON.parse wrapped in try/catch with type coercion safeguards |
| **Server-side attempt counting** | Weekly event ignores client `attemptNumber`, uses server-determined value |
| **Server-side time enforcement** | Daily challenge validates `challengeDate` against server KST; weekly event enforces time limits server-side |
| **Anti-cheat validation** | `validateGameConsistency` checks score rate, min duration, score-per-move, zero-score consistency |
| **Error message safety** | 500 errors return generic "Internal server error"; detailed logs on server side only |
| **seasonReset.ts** | Atomic batch, parameterized queries, safety check against premature reset |

---

## Conclusion

The codebase demonstrates consistent application of security best practices across the API layer: parameterized queries, rate limiting, input validation, server-side authority for critical checks (attempt count, timestamps, event validity), and cautious error message disclosure. No critical or high severity vulnerabilities were found. The medium-severity finding (replay attack) is largely mitigated by existing deduplication logic. Low-severity findings are minor and relate to edge cases in anonymous user handling and parameter validation.

Recommendations are provided inline for each finding above. The highest priority recommendation is **L-02** (null install_id_hash causing duplicate combo rankings), as it is the most straightforward to fix.