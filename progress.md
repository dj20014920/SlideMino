Original prompt: 게임 진행 화면(iPhone 포함)에서 광고 배너가 메인 화면에서만 보이고 플레이 화면에서 사라지는 문제를 근본 원인 기준으로 분석/수정.

## 2026-02-09 작업 로그
- 광고 관련 전수 탐색 완료: App.tsx, components/AdBanner.tsx, components/GameOverModal.tsx, services/bannerAdService.ts, services/admob.ts, services/adConfig.ts.
- 근본 원인 가설 확정: 화면 전환 시 AdBanner 언마운트/마운트가 겹치며 bannerAdService 내부 show/hide 비동기 레이스 발생 가능.
- 조치: services/bannerAdService.ts를 직렬 큐(syncQueue) 기반으로 리팩토링하여 show/hide 요청을 순차 처리하도록 수정.
- 기대 효과: 메뉴→게임, 게임→메뉴, 게임오버 모달 진입/이탈 등에서 최종 사용자 수(bannerUsers)에 맞는 배너 상태로 수렴.

## 검증 완료
- `npm run build` 성공.
- `npm run cap:sync` 성공 (android/ios plugin sync 완료).
- 추가 보강: 앱인토스 분기에서 콜백 이전 hide 누락을 막기 위해 cleanup 함수 획득 즉시 `showStatus='showing'` 처리.

## 후속 점검 권장
- iOS 실제 기기에서 메뉴→게임→게임오버→메뉴 왕복 시 배너 지속 노출 확인.

---

## 2026-02-10 추가 작업 로그 (콤보/스와이프 소모 버그)
- 이슈: 블럭 미리보기/드래그 단계에서 실수 입력(짧은 오입력, 보드 밖 드롭)만으로 `canSkipSlide`가 소모되어 콤보 스와이프 권한이 사라짐.
- 영향 범위 탐색: `/Users/dj/Desktop/SlideMino/App.tsx` 기준으로 `onPointerDown`, 배치 확정 분기, `canSkipSlide` 상태 전이 구간 전수 확인.
- 근본 원인: `SLIDE && canSkipSlide` 상태에서 드래그 시작(`onPointerDown`) 시점에 `finishSlideTurn()`이 호출되어, 실제 배치 성공 여부와 무관하게 턴/권한이 먼저 소모됨.
- 조치:
  - `onPointerDown`의 조기 소모(`finishSlideTurn()`) 제거.
  - 실제 배치 성공 분기에서만 `setCanSkipSlide(false)`, `setComboMessage(null)` 수행하도록 상태 전이 위치 이동.
  - 훅 의존성 정리(불필요 의존성 제거)로 이벤트 핸들러 안정화.
- 기대 효과: 오입력/취소 입력은 콤보 소모 없이 재시도 가능, 실제 배치 성공 때만 콤보가 정상 소모되어 UX 개선과 기존 게임 알고리즘 일관성 유지.

## 2026-02-10 검증 로그
- 수동 재현: `phase='SLIDE' && canSkipSlide=true` 상태에서
  - 보드 밖 드롭(무효 배치) 후 `canSkipSlide` 유지 확인.
  - 유효 배치 성공 시 `canSkipSlide=false` 전환 확인.
- 시각 검증 산출물: `/Users/dj/Desktop/SlideMino/screenshots/combo-swipe-fix-20260210.png`

## 2026-02-10 추가 교차검증 (Playwright MCP 자동화)
- 스킬 스크립트(`/Users/dj/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`) 직접 실행 시 로컬 `playwright` 패키지 부재로 `ERR_MODULE_NOT_FOUND` 발생.
- 대체 검증: 내장 Playwright MCP로 동일 페이지(`http://127.0.0.1:5173`)에서 상태 기반 자동 시나리오 수행.
  - 시작 상태 확인: `phase='SLIDE'`, `canSkipSlide=true`, `moveCount=2`.
  - 시나리오 A(무효 배치): 슬롯 드래그 후 보드 밖 드롭 → `canSkipSlide=true` 유지.
  - 시나리오 B(유효 배치): 보드 내 후보 좌표 순차 드롭 중 실제 배치 성공 지점(`gx=1, gy=1`)에서 `canSkipSlide=false`, `moveCount=3` 전환 확인.
- 결론: 콤보 소모 타이밍이 “드래그 시작”이 아닌 “배치 성공”으로 정상 고정되었고, 오입력으로 스와이프 권한이 소실되는 회귀는 재현되지 않음.
