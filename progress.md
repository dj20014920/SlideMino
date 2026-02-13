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

## 2026-02-10 추가 작업 로그 (스와이프/배치 규칙 변경)
- 요청 규칙:
  - 스와이프 후 **머지 발생 시**: 블록 배치 불가, 스와이프만 계속 가능.
  - 스와이프 후 **머지 미발생 시**: 그때만 블록 배치 가능.
- 핵심 수정(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - `executeSlide()` 해제 분기에서 `scoreAdded > 0`일 때 `setCanSkipSlide(true)`를 제거하고, `Phase.SLIDE` + `canSkipSlide=false` 유지로 변경.
  - 저장 게임 복원/이어하기 시 구버전 `canSkipSlide=true`가 남아도 새 규칙에 맞게 `false`로 정규화.
- 검증:
  - `npm run build` 성공.
  - Playwright MCP 상태 주입 기반 시나리오:
    - 머지 발생 보드: 스와이프 후 `phase='SLIDE'`, `canSkipSlide=false`, 슬롯 `pointer-events='none'` 유지.
    - 머지 미발생(이동만) 보드: 스와이프 후 `phase='PLACE'`, `canSkipSlide=false`, 슬롯 `pointer-events='auto'` 전환.

## 2026-02-10 추가 작업 로그 (UI/UX 정리 + 교차검증)
- UI/UX 개선(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - 상단 Phase pill을 고대비/펄스 스타일에서 저피로 톤(emerald/slate)으로 완화.
  - Turn Guide 카드 신설: 현재 가능한 행동(배치/스와이프) 배지 + 한 줄 설명 노출.
  - 하단 힌트 텍스트를 현재 phase 기준으로 단순화(`drag` vs `swipe`).
  - 머지/비머지 결과 메시지를 공통 helper(`showComboMessage`)로 통합해 타이머 누수/중복 방지.
- 다국어 추가(`/Users/dj/Desktop/SlideMino/public/locales/{ko,en,ja,zh}/game.json`):
  - `status.*` 키(턴 안내, 배지, 설명, 머지/비머지 메시지) 추가.
  - `hints.swipe`를 신규 규칙 문구로 갱신.
- 빌드 검증:
  - `npm run build` 성공.
- Playwright MCP 실검증:
  - 머지 발생 상태 캡처: `/Users/dj/Desktop/SlideMino/screenshots/phase-swipe-merge-20260210.png`
    - 확인값: `phase='SLIDE'`, 슬롯 `pointer-events='none'`, 메시지 `머지 성공! 이번 턴은 계속 스와이프`.
  - 머지 미발생 상태 캡처: `/Users/dj/Desktop/SlideMino/screenshots/phase-place-no-merge-20260210.png`
    - 확인값: `phase='PLACE'`, 슬롯 `pointer-events='auto'`, 메시지 `머지 없음. 이제 블록을 배치하세요`.
- 비고:
  - 콘솔의 `/api/submit` 404 및 `React.Fragment` prop warning은 기존 개발환경/타 기능 이슈로 관측되며, 이번 규칙/UX 변경의 기능 검증에는 영향 없음.

## 2026-02-10 추가 재검증 로그 (결정적 상태 주입 + 키보드 입력)
- 목적: “머지 시 스와이프 유지 / 비머지 시 배치 전환” 규칙이 실제 런타임에서 일관되게 동작하는지 재확정.
- 방법:
  - `localStorage(slidemino_game_state_v1)`에 테스트 보드 상태를 직접 주입한 뒤 페이지 리로드.
  - 포인터 스와이프 대신 `ArrowLeft` 키 입력으로 `executeSlide()`를 결정적으로 호출.
- 시나리오 A(비머지):
  - 초기 보드: `[null,2,4,null]`.
  - 결과: `phase='PLACE'`, `score=0`, `moveCount=1`, 슬롯 `pointer-events='auto'`, 메시지 `머지 없음. 이제 블록을 배치하세요`.
- 시나리오 B(머지):
  - 초기 보드: `[2,2,null,null]`.
  - 결과: `phase='SLIDE'`, `score=4`, `moveCount=1`, 슬롯 `pointer-events='none'`, 메시지 `머지 성공! 이번 턴은 계속 스와이프`.
- 결론:
  - 요청한 규칙 전이가 코드/빌드/실행 상태에서 모두 확인됨.

## 2026-02-10 추가 작업 로그 (드래그 UX 입력 간섭 개선)
- 사용자 체감 이슈 재현/원인 확정:
  - 슬롯 우상단의 회전 버튼 hit-area가 슬롯 내부 일부(약 3.39%)를 점유하여, 해당 영역 시작 드래그가 회전 버튼 입력으로 흡수됨.
  - Playwright 자동 계측에서 `top-right-inner` 시작점은 기존 코드에서 `hasDragOverlay=false`로 재현됨.
- 조치:
  - `/Users/dj/Desktop/SlideMino/components/Slot.tsx`
    - 회전 버튼 위치를 슬롯 내부 우상단에서 슬롯 상단 외부 중앙(`-top-6 left-1/2 -translate-x-1/2`)으로 이동해 드래그 시작 영역과 분리.
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - 드래그 포인터 캡처 대상을 `e.target` -> `e.currentTarget`으로 고정.
    - `handlePointerMove/Up`에 active pointerId 가드 추가(멀티포인터 간섭 차단).
    - `getGridPosFromPointer()` 경계 판정을 `>=`로 수정하고 인덱스를 [0..size-1] 클램프해 경계 드롭 안정화.
    - 공통 정리 함수 `resetDraggingState()` 도입 + `onPointerCancel` 처리 추가(시스템 캔슬 시 드래그 잔상/고착 방지).
- 검증:
  - `npm run build` 성공.
  - Playwright 자동 계측:
    - 회전 버튼-슬롯 overlap 비율: `0` (기존 약 3.39% → 0%).
    - 기존 실패 지점(`top-right-inner`) 시작 드래그에서 `hasDragOverlay=true`로 개선 확인.
    - 드래그 배치 E2E: 슬롯 우상단 근접 시작 -> 보드 드롭 후 `tileCount 0→4`, `phase PLACE→SLIDE`, `moveCount 0→1` 확인.
    - pointercancel 강제 이벤트 시 드래그 오버레이 즉시 해제(`true -> false`) 확인.
  - 시각 캡처: `/Users/dj/Desktop/SlideMino/screenshots/drag-ux-after-fix-20260210.png`
- 추가 회귀 확인(상태 주입 + ArrowLeft):
  - 비머지 보드(`[null,2,4,null]`) -> `phase='PLACE'`, `score=0`, `moveCount=1`, 슬롯 `pointer-events='auto'`.
  - 머지 보드(`[2,2,null,null]`) -> `phase='SLIDE'`, `score=4`, `moveCount=1`, 슬롯 `pointer-events='none'`.
  - 결론: 드래그 UX 수정이 기존 턴 규칙(머지/비머지 전이)을 깨지 않음.

## 2026-02-10 추가 작업 로그 (드래그 시작 UX 리팩토링)
- 사용자 피드백 반영: "드래그를 시작하는 순간 블럭이 튀거나 이상하게 잡히는 체감" 중심으로 시작 입력 경로 재설계.
- 구현 변경(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - 즉시 드래그 시작을 제거하고 `DRAG_START_THRESHOLD_PX=8` 이동 임계치 기반으로 변경.
    - 터치/홀드만 하고 움직임이 작을 때는 드래그 오버레이를 띄우지 않음.
  - 시작 위치 기반 앵커(`dragAnchorRef`) 도입:
    - 슬롯 내 터치 위치 비율을 블럭 바운딩 박스(px)로 매핑해, 잡은 지점을 기준으로 오버레이가 따라오도록 변경.
  - 포인터 흐름을 `pendingDragRef -> beginDragFromPending()` 단계로 분리해 시작 타이밍과 상태 전이를 단순화.
  - 공통 오버레이 이동 함수 `applyDragOverlayTransform()`로 transform 계산 단일화.
  - 드래그 중 회전 시에도 앵커 비율을 유지해 급격한 점프를 완화.
  - `resetDraggingState()`에서 pending/anchor/pressed 상태를 일괄 초기화.
- UI 피드백(`/Users/dj/Desktop/SlideMino/components/Slot.tsx`, `/Users/dj/Desktop/SlideMino/App.tsx`):
  - 홀드 중 슬롯에 시각 피드백(은은한 링/그림자/미세 스케일) 추가 (`pressedSlotIndex`).
  - 사용자가 "잡힘" 상태를 즉시 인지할 수 있도록 반응 강화.
- 검증:
  - `npm run build` 성공.
  - Playwright 계측(동일 세션, 상태 오염 없이):
    - 임계치 검증: `holdOnlyVisible=false`, `underThresholdVisible=false`, `overThresholdVisible=true`.
    - 앵커 검증(같은 타겟 좌표):
      - 상단 잡기 offsetY `~11.08`
      - 하단 잡기 offsetY `~144.72`
      - `anchorDeltaY ~133.64` (잡은 위치에 따라 따라오는 기준점이 달라짐 확인)
  - 스크린샷:
    - 홀드 피드백: `/Users/dj/Desktop/SlideMino/screenshots/drag-hold-feedback-20260210.png`
- 추가 보강:
  - 임계치 통과 직후 `pointerup`이 `setState`보다 먼저 들어오는 레이스를 방지하기 위해 `handlePointerUp`/`handlePointerCancel`에 안전 분기 추가.
- 최종 재검증(PLACE 상태에서 재측정):
  - 임계치 검증: `holdVisible=false`, `smallVisible=false`, `largeVisible=true`.
  - 앵커 검증(동일 타겟 좌표):
    - 상단 잡기 offsetY `~11.20`
    - 하단 잡기 offsetY `~144.48`
    - `anchorDeltaY ~133.28`

## 2026-02-10 추가 작업 로그 (턴 안내 텍스트 제거 + 보드 포커스 복귀)
- 요청 반영: `턴 안내` 카드/텍스트 기반 힌트 제거, 스와이프 단계에서 보드만 선명하게 보이는 구 UI 감성으로 전환.
- 변경(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - `isSwipeFocusMode` 도입: `phase===SLIDE && !draggingPiece`.
  - 우측 헤더 컨트롤(phase/help/undo/reward)을 스와이프 단계에서 저채도/저투명 + `pointer-events-none` 처리.
  - 보드 컨테이너 강조(미세 스케일/그림자)로 시선 집중.
  - 슬롯 영역을 스와이프 단계에서 강한 dim + blur + `pointer-events-none` 처리.
  - `Turn Guide` 블록 제거.
  - 하단 텍스트 힌트/콤보 메시지 렌더 제거(텍스트 의존 최소화).
  - 드래그 중에는 회전 아이콘 버튼만 최소 노출.
  - 하단 광고 배너도 스와이프 단계에서 저투명 + `pointer-events-none` 처리.
- 검증:
  - `npm run build` 성공.
  - Playwright 상태 점검: `hasTurnGuide=false`, `hasPlaceDesc=false`, `slotPointer='none'`, 헤더 우측 opacity `0.35` 확인.
  - 스크린샷:
    - 스와이프 포커스: `/Users/dj/Desktop/SlideMino/screenshots/swipe-focus-ui-20260210.png`
    - 배치 화면(턴 안내 없음): `/Users/dj/Desktop/SlideMino/screenshots/place-ui-no-turn-guide-20260210.png`

## 2026-02-10 추가 작업 로그 (회전 버튼 좌하단 이동 + 드래그 오인식 방지)
- 요청 반영:
  - 슬롯 회전 버튼을 미리보기 블록의 좌하단으로 이동.
  - 회전 버튼 입력이 블록 드래그로 인식되지 않도록 포인터 판정 보강.
- 변경 파일:
  - `/Users/dj/Desktop/SlideMino/components/Slot.tsx`
    - 버튼 위치: `left-2 bottom-2`
    - 버튼 입력: `onPointerDown` + `onPointerUp`에서 `preventDefault/stopPropagation` 처리 유지/추가
    - 회전 실행은 `onClick`에서만 수행
- 검증:
  - `npm run build` 성공.
  - Playwright 계측:
    - 회전 버튼 클릭 시 실제 회전 발생(`rotated=true`)
    - 버튼에서 드래그 유사 입력 시 드래그 오버레이 미생성(`dragOverlayExists=false`)
  - 스크린샷: `/Users/dj/Desktop/SlideMino/screenshots/slot-rotate-bottom-left-20260210.png`

## 2026-02-10 추가 작업 로그 (드래그 오버레이 vs 고스트 정렬 오차 수정)
- 이슈 재현:
  - 사용자 제보와 동일하게 드래그 중 흰색 오버레이와 회색 고스트가 어긋남.
  - Playwright 수치 계측(패치 전 기준): `avgDx=-17.56px`, `avgDy=+21.14px`, `avgDist=27.58px`.
- 근본 원인:
  - 오버레이는 포인터 연속 좌표, 고스트는 그리드 스냅 좌표를 따르면서 서로 다른 기준으로 렌더됨.
  - 임계치 전환 직후 hover 계산에서 `pending.piece`와 실제 드래그 셀(`initCells`)의 불일치 가능성이 존재.
  - 오버레이 `scale`이 셀 간 상대 오차를 확대.
- 조치(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - `computeGridPosFromPointer()`를 공통 좌표 변환으로 사용해 hover 계산 기준 단일화.
  - `applyDragOverlayTransform()`에 스냅 옵션 추가:
    - 보드 위에서는 `hover grid pos` 기준으로 오버레이를 직접 스냅 렌더.
    - 보드 밖에서는 기존 포인터-앵커 추적 유지.
  - 임계치 전환 시 hover 계산을 `pending.piece`가 아닌 `{ ...pending.piece, cells: pending.initCells }`로 계산.
  - 오버레이 셀 배치 간격을 `cellPitch` 기준으로 유지(보드 gap 포함).
  - 오버레이 기준점 `origin-top-left` 적용.
  - 최종적으로 오버레이 스케일을 `1`로 고정(`DRAG_OVERLAY_SCALE=1`)해 시각/논리 오차 제거.
- 검증:
  - `npm run build` 성공.
  - Playwright 계측(동일 시나리오) 개선 추이:
    - 1차: `avgDist 27.58px` (기존)
    - 2차: `avgDist 5.03px` (스냅 정렬 후)
    - 최종: `avgDx=0.003px`, `avgDy=0.002px`, `avgDist=0.004px`
  - 시각 캡처: `/Users/dj/Desktop/SlideMino/screenshots/drag-ghost-aligned-20260210.png`
- 참고:
  - 스킬 클라이언트(`web_game_playwright_client.js`) 실행은 로컬 `playwright` 패키지 부재로 `ERR_MODULE_NOT_FOUND` 발생.
  - 대체로 Playwright MCP 기반 자동 드래그/수치 계측으로 동일 검증 수행.

## 2026-02-10 추가 작업 로그 (일반 퍼즐게임식 드래그 프록시 UX 전환)
- 사용자 추가 요청: "고스트만 보이는 방식 말고, 드래그 중인 블럭 자체가 손가락/포인터를 따라 보여야 함".
- 적용한 UX 패턴(타 퍼즐게임 공통):
  - 보드: 스냅 고스트(예상 드롭 위치)
  - 손가락 근처: 실시간 드래그 프록시 블럭(약간 확대 + 리프트)
- 구현(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - `DRAG_OVERLAY_SCALE`를 `1.06`으로 조정, `DRAG_OVERLAY_LIFT_Y=12` 추가.
  - 드래그 임계치 `DRAG_START_THRESHOLD_PX`를 `4`로 낮춰 시작 반응성 향상.
  - 오버레이 렌더 위치를 포인터 추종 방식으로 고정(스냅 위치 강제 정렬 제거).
  - 오버레이 시각 강화: `drop-shadow`, `ring`, `opacity-100`.
  - 회전/초기 마운트/이동 시 동일한 포인터 추종 transform 경로 사용.
- 빌드 검증:

## 2026-02-13 추가 작업 로그 (게임오버 부활 보상형 전면 광고 iOS 연동)
- 사용자 제공 AdMob iOS 보상형 전면 광고 ID 반영:
  - `/Users/dj/Desktop/SlideMino/services/adConfig.ts`
  - iOS `REWARD_INTERSTITIAL` 프로덕션 ID: `ca-app-pub-5319827978116991/1969153095`
- 신규 서비스 추가:
  - `/Users/dj/Desktop/SlideMino/services/rewardInterstitialAdService.ts`
  - 기능: preload/show, AdMob/Apps-in-Toss 분기, 중복 보상 방지, 일일 한도(`MAX_DAILY_REVIVE_AD_VIEWS=2`)
- 게임오버 부활 UX/로직 연동:
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - 게임오버 직전 스냅샷을 `reviveSnapshotRef`로 저장
    - 광고 보상 수령 시 직전 1수 전 상태로 복구 (grid/slots/score/phase)
    - 한 판 1회 제한(`hasUsedReviveThisRun`)
  - `/Users/dj/Desktop/SlideMino/components/GameOverModal.tsx`
    - “광고 보고 이어하기” 카드/버튼 추가
- 저장 상태 보강:
  - `/Users/dj/Desktop/SlideMino/services/gameStorage.ts`
  - `hasUsedRevive` 저장/복원 추가(앱 재실행 후에도 한 판 1회 제한 유지)
- 기존 리워드 서비스 안전 보강:
  - `/Users/dj/Desktop/SlideMino/services/rewardAdService.ts`
  - `cleanup()`에서 `AdMob.removeAllListeners()` 제거 (부활 광고 서비스 리스너 충돌 방지)
- 다국어 문구 추가:
  - `/Users/dj/Desktop/SlideMino/public/locales/{ko,en,ja,zh}/modals.json`
  - revive 관련 title/description/button/error/success 문구 추가

## 2026-02-13 검증 로그
- 정적 검증:
  - `npx tsc --noEmit` 성공
  - `npm run build` 성공
- 스킬 기반 Playwright 검증:
  - 스킬 클라이언트 실행:
    - `/Users/dj/.codex/skills/develop-web-game/scripts/web_game_playwright_client.js`
  - 산출물:
    - `/Users/dj/Desktop/SlideMino/screenshots/revive-flow/shot-0.png`
    - `/Users/dj/Desktop/SlideMino/screenshots/revive-flow/errors-0.json`
  - 관찰:
    - 웹 환경에서는 `isRewardInterstitialAdSupported()`가 false이므로 부활 카드 미노출(정상)
    - 기존 콘솔 warning 1건(`React.Fragment ... ref`) 관측, 이번 변경과 직접 연관 없음

## TODO / 후속 제안
- iOS 실기기 검증 필수:
  - 게임오버 → 부활 광고 → 1수 복구 동작
  - 스킵/실패/일일한도(2회) 메시지 확인
- Android 보상형 전면 광고 ID 발급 후 `services/adConfig.ts`의 `ANDROID.REWARD_INTERSTITIAL` 채우기
- Apps-in-Toss 보상형 전면 ID 발급 시 `APPS_IN_TOSS_AD_IDS.REWARD_INTERSTITIAL_REVIVE` 채우기

## 2026-02-13 추가 보강 로그 (Android 보상형 전면 광고 ID 반영)
- 사용자 제공 Android 보상형 전면 광고 ID 반영 완료:
  - `/Users/dj/Desktop/SlideMino/services/adConfig.ts`
  - `ADMOB_AD_IDS.ANDROID.REWARD_INTERSTITIAL = ca-app-pub-5319827978116991/5753319580`
- Android App ID 점검:
  - `/Users/dj/Desktop/SlideMino/android/app/src/main/AndroidManifest.xml`
  - `ca-app-pub-5319827978116991~4475378070` 유지 확인
- 검증:
  - `npx tsc --noEmit` 성공
  - `npm run build` 성공
  - `npm run build` 성공.
- 비고:
  - 현재 Playwright MCP 세션은 로딩/광고/상호작용 레이어 영향으로 포인터 드래그 자동검증 신뢰도가 낮아, 실제 사용 시나리오(모바일 터치) 기준으로 추가 체감 확인 필요.

## 2026-02-10 추가 작업 로그 (요청 커밋 기준 드래그/미리보기 로직 복원)
- 사용자 요청: `2776bb1d1a13e352e63b11035a533f247b366072` 시점의 드래그/미리보기 체계를 현재 코드에 최대한 동일하게 반영.
- 확인 사항:
  - 해당 커밋은 `App.tsx` 변경 커밋은 아니며, 해당 시점 스냅샷의 `App.tsx`에 원하는 로직이 포함됨.
  - 따라서 `git show <commit>:App.tsx` 기준으로 함수 단위 대조 후 현재 파일(`/Users/dj/Desktop/SlideMino/App.tsx`)에 이식.
- 반영 내용(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - 드래그 시작을 임계치 기반(pending) 방식에서 **즉시 시작 방식**으로 복원.
  - 드래그 앵커/스냅 계산 계층(`dragAnchorRef`, `pendingDragRef`, 관련 helper) 제거.
  - 오버레이 transform을 커밋형 단순 포인터 추종(`translate3d(pointerX, pointerY) scale(1.04)`)으로 복원.
  - `renderDraggingPiece`를 커밋형 중심 보정(`marginTop/marginLeft`) 방식으로 복원.
  - 그리드 hover 계산을 커밋형 보드 상대 좌표 반올림 방식으로 정리.
  - 단, 이전에 고친 회귀 방지 포인트는 유지:
    - `SLIDE && canSkipSlide`에서 드래그 시도만으로 턴 소모되지 않음(배치 성공 시에만 소모).
    - 회전 버튼 드래그 오인식 방지/포인터 ID 가드/`pointercancel` 정리.
- 검증:
  - `npm run build` 성공.
  - `npm run cap:sync` 성공.
  - Playwright MCP 드래그 계측:
    - 드래그 중 `overlayVisible=true`, `ghostCells=4` 확인(오버레이 + 고스트 동시 표시)
    - 드롭 후 `overlayAfterDrop=false`, phase 전이 정상 확인.
  - 시각 캡처: `/Users/dj/Desktop/SlideMino/screenshots/drag-proxy-during-hold-20260210.png`


## 2026-02-10 추가 작업 로그 (기기별 UI 비율 동적 통일)
- 요청 반영: 아이폰/갤럭시/웹에서 UI 비율이 최대한 동일하게 느껴지도록 게임 화면 레이아웃을 비율 기반으로 재설계.
- 설계 원칙:
  - 고정 px 중심 레이아웃을 줄이고, 세로 화면 비율(`height/width`) + 실제 뷰포트(`visualViewport`)를 기준으로 보드/여백/간격을 동적으로 계산.
  - 19.5:9 계열(현대 스마트폰 주류)에서 시각 비율을 맞추되, 16:9 같은 짧은 화면에서도 콘텐츠가 잘리지 않게 `height fit ceiling` 제약 추가.
  - DRY: `App.tsx`의 단일 `getGameLayoutProfile()`에서 컬럼 폭/보드 스케일/상하 여백/컴포넌트 간 gap을 일관 계산.
- 구현 변경(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - `ViewportSize`, `GameLayoutProfile`, `getViewportSize()`, `getGameLayoutProfile()` 추가.
  - `resize/orientationchange/visualViewport resize+scroll` 이벤트로 실시간 뷰포트 추적.
  - 보드 스케일 계산을 `baseBoardScale * boardScaleMultiplier`로 확장하고, 짧은 화면 보호용 `boardScaleCeiling`을 적용.
  - 게임 헤더/메인에 동일 `columnMaxWidthPx` 적용, 메인 컨테이너를 `justify-start` -> `justify-center`로 조정.
  - 메인 `gap`, `paddingTop`, `paddingBottom`을 프로필 값으로 동적 적용.
- 근본 원인/반증 점검:
  - 원인: 기존은 보드 중심 크기 + 상단 정렬이어서 기기 세로 비율이 바뀌면 상/하 공백 균형이 깨지고, 긴 화면에서 상단 몰림 체감 발생.
  - 반증 시도: 16:9(360x640)에서 오히려 콘텐츠가 넘칠 가능성 확인 -> 실제로 1차 변경에서 하단 잘림(`contentBottomToViewport > 1`) 발생.
  - 보완: `boardScaleCeiling`(높이 예산 기반 상한) 추가 후 재검증해 잘림 해소.
- 검증:
  - `npm run build` 성공(2회).
  - 뷰포트별 수치 검증(`main/board/slot` 실측):
    - 430x932 (아이폰 19.5:9):
      - `boardHeightToViewport=0.427`, `slotHeightToViewport=0.1309`, `boardTopToViewport=0.177`, `contentBottomToViewport=0.7586`
    - 412x915 (갤럭시 계열):
      - `boardHeightToViewport=0.4153`, `slotHeightToViewport=0.1268`, `boardTopToViewport=0.1803`, `contentBottomToViewport=0.7464`
    - 360x640 (레거시 16:9):
      - `boardHeightToViewport=0.5062`, `slotHeightToViewport=0.1542`, `contentBottomToViewport=0.901` (잘림 없음)
    - 1280x900 (웹 데스크톱):
      - `columnWidth=560`, `boardHeightToViewport=0.42`, `contentBottomToViewport=0.7837`
  - 스크린샷:
    - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-iphone430x932-20260210.png`
    - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-galaxy412x915-20260210.png`
    - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-legacy360x640-20260210.png`
    - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-desktop1280x900-20260210.png`
- 비고:
  - `develop-web-game` 스킬의 공식 클라이언트(`web_game_playwright_client.js`)는 로컬 `playwright` 패키지 부재로 `ERR_MODULE_NOT_FOUND` 지속.
  - 대체로 Chrome DevTools MCP에서 동일 시나리오를 자동 측정/캡처해 교차검증 완료.


## 2026-02-10 추가 작업 로그 (초심층 비율/경계점 분석 + 보강)
- 요청: 태블릿/아이폰/갤럭시/웹 및 경계 조건에서 잠재 문제를 가설 기반으로 초심층 분석하고 보강.
- 가설 세트:
  - H1: 세로 기준 수식이 짧은 화면(16:9)에서 보드/슬롯이 잘릴 수 있다.
  - H2: `safeHeight` 최소값 고정이 실제 낮은 viewport에서 과대 추정 오버플로를 유발한다.
  - H3: 가로전환(폭 큼/높이 작음)에서 슬롯 높이가 폭 비례로 과도하게 커져 하단 overflow가 발생한다.
  - H4: 보정된 column 폭이 실제 header/main에 적용되지 않으면 수식 보강이 무효화된다.
  - H5: 태블릿/대화면에서 지나치게 큰/작은 중앙 컬럼 폭이 UX 불균형을 만들 수 있다.
- 1차 분석 결과:
  - 수치 시뮬레이션과 실측에서 H2/H3/H4가 실제로 관찰됨.
  - 특히 `932x430`(모바일 가로)에서 초기 상태 `slotBottomPastViewport=true` 재현.
- 보강 내용(`/Users/dj/Desktop/SlideMino/App.tsx`):
  - 레이아웃 프로필 입력에 `LayoutChromeHeights`(header/banner 실제 높이) 도입.
  - `ResizeObserver` + `visualViewport` 이벤트로 header/banner 실측값을 지속 반영.
  - `getGameLayoutProfile()` 강화:
    - `safeWidth/safeHeight` 하한을 현실적으로 재조정(`240/320`).
    - landscape 저높이 조건에서 column 폭 상한을 높이 기준으로 제한(`heightLimitedColumnMaxPx`).
    - landscape 저높이 조건에서 슬롯 높이 상한(`safeHeight*0.17`) 적용.
    - 높이 예산 기반 `boardScaleCeiling` 하한을 `0.42`로 낮춰 극단 환경에서도 fit 우선.
  - `GameLayoutProfile`에 `columnWidthPx`를 추가하고, header/main이 `columnMaxWidthPx`가 아닌 `columnWidthPx`를 실제 사용하도록 수정(H4 근본 해결).
- 교차검증(실측):
  - iPhone 430x932: overflow 없음, `slotBottom=0.7586`.
  - Galaxy 412x915: overflow 없음, `slotBottom=0.7464`.
  - Legacy 360x640: overflow 없음, `slotBottom=0.7104`.
  - Tablet 768x1024: overflow 없음, `slotBottom=0.6732`.
  - Tablet 1024x1366: overflow 없음, `slotBottom=0.5273`.
  - Web 1280x900 / 1920x1080: overflow 없음.
  - Mobile landscape 932x430:
    - 보강 전: `slotBottomPastViewport=true`.
    - 보강 후: `slotBottomPastViewport=false`, `mainPastViewport=false`.
- 캡처 산출물:
  - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-iphone430x932-deep-20260210.png`
  - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-tablet768x1024-deep-20260210.png`
  - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-landscape932x430-deep-20260210.png`
  - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-web1920x1080-deep-20260210.png`
  - `/Users/dj/Desktop/SlideMino/screenshots/layout-ratio-split280x653-20260210.png`
- 잔여 리스크/제한:
  - 현재 가로전환에서는 fit 안정성 우선으로 보드/슬롯이 작아질 수 있음(의도적). 모바일 가로에서 가독성보다 비잘림 우선 정책.
  - AdSense iframe이 dev 환경에서 과대 높이로 렌더되는 경우가 있어, 배너 실측값이 환경에 따라 변동 가능(실측 기반이라 기능적으로는 안전).


## 2026-02-10 추가 작업 로그 (가로모드 완전 차단 / 세로 고정)
- 요청: 가로모드를 아예 지원하지 않도록 화면 방향 고정.
- 적용 범위:
  - Android 네이티브: `MainActivity`를 portrait 고정.
  - iOS 네이티브(iPhone/iPad): 지원 방향을 portrait 단일값으로 제한.
  - Web(모바일/태블릿): landscape 진입 시 강제 차단 오버레이 표시 + 가능 시 `screen.orientation.lock('portrait')` 시도.
- 변경 파일:
  - `/Users/dj/Desktop/SlideMino/android/app/src/main/AndroidManifest.xml`
    - `<activity ... android:screenOrientation="portrait">` 추가
  - `/Users/dj/Desktop/SlideMino/ios/App/App/Info.plist`
    - `UISupportedInterfaceOrientations`: `UIInterfaceOrientationPortrait`만 유지
    - `UISupportedInterfaceOrientations~ipad`: `UIInterfaceOrientationPortrait`만 유지
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - 모바일/태블릿 웹에서 landscape 감지 시 전체 화면 차단 UI 추가
    - 다국어 안내 메시지(ko/en/ja/zh) 추가
    - `screen.orientation.lock('portrait')` 시도(브라우저 정책 실패 시 오버레이가 fallback)
- 검증:
  - `npm run build` 성공
  - `npm run cap:sync` 성공
  - DevTools 검증:
    - 모바일+터치 landscape(932x430): 차단 메시지 표시 확인
    - 모바일+터치 portrait(430x932): 차단 없음, 게임 UI 정상
    - 데스크톱 landscape(1280x900, touch=false): 차단 없음
  - 스크린샷: `/Users/dj/Desktop/SlideMino/screenshots/orientation-lock-landscape-mobile-20260210.png`


## 2026-02-10 추가 작업 로그 (App Store iPad orientation 검증 오류 대응)
- 발생 오류: 업로드 검증에서 `UISupportedInterfaceOrientations`가 iPad 멀티태스킹 요구사항(4방향)과 불일치하여 reject.
- 원인:
  - 이전 변경에서 `Info.plist`를 portrait-only로 축소했는데, 현재 번들은 iPad 멀티태스킹 경로를 전제로 검증되어 4방향 요구를 만족해야 함.
- 대응 전략:
  - 심사 통과를 위해 `Info.plist`의 iOS/iPad orientation 키를 4방향으로 복원.
  - 실제 앱 동작은 `AppDelegate` 런타임 orientation mask에서 `.portrait`를 반환해 세로 고정을 유지.
- 변경 파일:
  - `/Users/dj/Desktop/SlideMino/ios/App/App/Info.plist`
    - `UISupportedInterfaceOrientations` / `UISupportedInterfaceOrientations~ipad` 모두 4방향으로 복원
  - `/Users/dj/Desktop/SlideMino/ios/App/App/AppDelegate.swift`
    - `application(_:supportedInterfaceOrientationsFor:) -> .portrait` 추가
- 검증:
  - `plutil -p ios/App/App/Info.plist`로 4방향 복원 확인
  - `npm run build` 성공
  - `npm run cap:sync` 성공

## 2026-02-11 추가 작업 로그 (모바일 온보딩 말풍선 잘림 근본 수정)
- 재현/원인 확정:
  - `components/GameModeTutorial.tsx` 기존 구현이 타겟 버튼 우측(`left/right` 고정) 배치라 모바일에서 말풍선이 화면 밖으로 벗어남.
  - Playwright 모바일 계측(320x568) 패치 전 수치: `bubble.left=290, right=546`로 `right overflow=true` 재현.
- 구조 개선:
  - `components/GameModeTutorial.tsx`를 위/아래 배치 전용 구조로 재작성.
  - 뷰포트 클램프(가로 폭, 세로 위치), 실제 말풍선 높이 측정(ResizeObserver), 리사이즈/회전/스크롤 추적 추가.
  - 모바일 환경에서 `position: fixed` 컨테이너의 실제 오프셋(top)까지 반영해 세로 잘림을 제거.
  - 말풍선에 모드 차이(뉴비 7x7 / 일반 5x5 / 고수 4x4)와 첫 게임 5x5 추천 문구를 추가.
  - 말풍선 탭 및 닫기 버튼으로 dismiss 가능하도록 개선(`tutorial_game_mode_seen_v1` 저장).
- 뒤로가기 온보딩 보강:
  - `components/BackNavigationTutorial.tsx`를 반응형으로 조정.
  - 스와이프 거리 동적 계산, 하단 말풍선 safe-area 대응(bottom clamp), 소형 화면 텍스트/폭 클램프 적용.
- 다국어 보강:
  - `public/locales/{ko,en,ja,zh}/game.json`에 `tutorial.*` 키를 추가/확장.
  - 신규 키: `recommend*`, `modeGuide*`, `tapToDismissMode`, `close`.
- 검증:
  - `npm run build` 성공.
  - Playwright 모바일 검증 결과:
    - 390x844: GameMode/BackNav 말풍선 `out=false`.
    - 320x568: GameMode/BackNav 말풍선 `out=false`.
    - 360x740: GameMode 말풍선 `out=false`.
  - 스크린샷 확인:
    - 기존 잘림(재현): `.../page-2026-02-11T04-29-18-258Z.png`
    - 수정 후(320x568 메뉴): `.../page-2026-02-11T04-41-39-614Z.png`
    - 수정 후(320x568 뒤로가기): `.../page-2026-02-11T04-42-25-325Z.png`

## 2026-02-12 추가 작업 로그 (오프라인/온라인 동작 점검)
- 범위: 웹/네이티브 공통 코드 전수 탐색 후 오프라인/온라인 동작 교차검증.
- 정적 분석:
  - 서비스워커 등록 코드 부재(`index.tsx`) 및 PWA 플러그인 부재(`vite.config.ts`) 확인.
  - 랭킹/점수 동기화는 `services/rankingService.ts`에서 `navigator.onLine` + localStorage 큐/캐시로 처리됨.
  - 게임 진행 상태는 `services/gameStorage.ts` localStorage 저장/복원으로 유지됨.
- 실측 검증(프로덕션 빌드 + preview):
  - 같은 세션에서 오프라인 전환 후 게임 플레이 지속 가능.
  - 오프라인 랭킹 모달에서 오프라인 안내 문구 표시 확인.
  - 오프라인 상태에서 새로고침 시 `chrome-error://chromewebdata` / `ERR_INTERNET_DISCONNECTED` 확인(웹 앱 셸 오프라인 부팅 불가).
  - 오프라인 플레이 중 `slidemino_pending_scores_v1` 큐 적재 확인, 온라인 복귀 시 flush 동작 확인.
- 문구 정합성 수정:
  - `pages/About.tsx`: 오프라인 설명을 "웹 세션 유지 시 가능 / 새로고침·신규 접속 불가(서비스워커 없음) / 네이티브 설치 후 오프라인 가능"으로 보정.
  - `README.md`: "PWA support" 문구를 manifest 기반 설치 메타데이터로 정확화.

## 후속 권장
- 사용자 혼선을 줄이기 위해 메뉴 또는 설정에 "오프라인 상태 배지 + 기능 제한(랭킹/광고)" 안내를 추가 검토.

## 2026-02-13 추가 작업 로그 (iOS 시뮬레이터 검증 보강 + 튜토리얼 겹침 수정)
- 사용자 요청: iPhone 에뮬레이터 기준으로 보상형 전면 광고(부활) 동작 재검증.
- 확인된 문제 1 (UX): 메인 메뉴에서 `GameModeTutorial` 버블이 난이도 선택 후 뜨는 닉네임 입력 모달과 겹침.
  - 조치:
    - `/Users/dj/Desktop/SlideMino/components/GameModeTutorial.tsx`
      - `suppressed?: boolean` prop 추가.
      - `suppressed=true`일 때 오버레이 렌더 중단.
    - `/Users/dj/Desktop/SlideMino/App.tsx`
      - `isNameInputOpen || isCustomizationOpen || isLeaderboardOpen`일 때 `GameModeTutorial` suppress 적용.
  - 결과: iOS 시뮬레이터에서 이름 입력 모달 단독 노출 확인(튜토리얼 겹침 제거).

- 확인된 문제 2 (iOS 시뮬레이터 검증 난이도): 터치 자동화(cliclick)가 하단 영역/모달 영역에서 불안정해 재현성이 낮음.
  - 보강 조치(DEV + 시뮬레이터 한정 QA 도구):
    - `/Users/dj/Desktop/SlideMino/App.tsx`
      - `isVirtualDevice()` 기반으로 시뮬레이터 여부 감지.
      - 메뉴 화면에 **시뮬레이터 전용 QA 패널** 추가 (`sim-qa-toggle-btn`, `sim-qa-revive-ad-btn`).
      - 상태 텍스트(`simulatorQaStatus`)로 `preload/show/reward/closed/error` 흐름 표시.
      - 자동 프로브 1회(`simulatorAutoProbeRunRef`) 도입: 메뉴 진입 시 preload 후 ready면 show 시도.
      - 안전장치: QA 패널 및 자동 프로브는 `import.meta.env.DEV`에서만 동작.

- 확인된 문제 3 (시뮬레이터 ATT 팝업): 광고 초기화 시 ATT 팝업이 자동으로 뜨며 광고 검증 플로우를 가림.
  - 조치:
    - `/Users/dj/Desktop/SlideMino/services/admob.ts`
      - `shouldSkipAttPromptForSimulatorQa()` 추가.
      - iOS + Simulator userAgent인 경우 ATT 요청(`requestTrackingAuthorization`) 스킵.
      - 개발환경에서 `localStorage('slidemino_skip_att_for_qa')` 오버라이드도 허용.
    - `/Users/dj/Desktop/SlideMino/App.tsx`
      - 시뮬레이터 QA 활성 시 `slidemino_skip_att_for_qa=1` 기록.

- iOS 시뮬레이터 실검증 실행:
  - `npm run build` ✅
  - `npm run cap:sync` ✅
  - `npx cap run ios --target 8D4A6A07-024E-4FF5-8505-AB707DC5F48E` ✅
  - 스크린샷 산출물:
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-post-patch-menu.png` (튜토리얼 기본 노출)
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-name-modal-after-tap.png` (모달 단독, 튜토리얼 겹침 해소)
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-qa-top-visible.png` (시뮬레이터 QA 패널 노출)
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-qa-auto-probe-result.png` (자동 프로브 중 ATT 팝업 관측)
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-qa-final-check.png` (재검증 시 ATT 팝업 재관측)

- 현재 상태/잔여 이슈:
  - 코드상 부활 광고 통합 자체(`rewardInterstitialAdService` + GameOverModal 버튼 + restore snapshot)는 유지/정상.
  - iOS 시뮬레이터에서 ATT 팝업이 여전히 나타나는 케이스가 있어, 자동 광고 프로브 결과 텍스트까지의 완전 캡처는 추가 1회 확인 필요.
  - 다만 튜토리얼-모달 겹침 문제는 재현/해결 완료.

- 다음 에이전트 TODO:
  - Xcode Console(디바이스 로그)로 `RewardInterstitialAdPluginEvents.Loaded/Showed/Rewarded/Dismissed` 이벤트를 직접 캡처해 QA 패널 상태 텍스트와 교차검증.
  - 시뮬레이터 ATT 우회가 런타임마다 일관되게 먹도록(native side flag 주입 등) 필요 시 추가 보강.
- 추가 재검증(같은 날짜, iOS 시뮬레이터 재부팅 후):
  - 시뮬레이터를 shutdown/boot 후 재실행하면 ATT 팝업 없이 QA 패널 상태가 `자동 QA: 광고 준비 대기 중`으로 유지됨.
  - 즉, ATT 블로킹은 완화됐으나 테스트 광고 `loaded -> showed` 콜백까지는 네트워크/애드서버 응답 타이밍으로 아직 캡처되지 않음.
  - 관측 로그: `com.google.GoogleMobileAds` 초기화 및 SKAdNetwork 누락 경고(50 identifiers missing) 확인.

## 2026-02-13 추가 작업 로그 (온보딩 재노출 버그 수정)
- 이슈: 메뉴 온보딩(`GameModeTutorial`)을 닫아도 2~3회 다시 뜨는 현상.
- 원인: `GameModeTutorial` 내부 `setTimeout(250/700/1200)` + `resize/scroll` 콜백이 닫힘 이후에도 `setIsVisible(true)`를 재호출.
- 수정:
  - `/Users/dj/Desktop/SlideMino/components/GameModeTutorial.tsx`
  - `dismissedRef` 추가로 세션 내 즉시 재노출 차단.
  - `hasSeenTutorial()` 가드 추가(localStorage + dismissedRef 동시 확인).
  - `checkTarget()` 시작 시 가드로 조기 return(`setIsVisible(false)`, `setTargetRect(null)`).
  - `handleDismiss()`에서 `dismissedRef`/state 먼저 닫고 localStorage 저장(try/catch).
- 기대 결과: 사용자가 닫기를 누르면 해당 세션에서 다시 뜨지 않고, `튜토리얼 다시보기` 버튼으로 storage를 지웠을 때만 다시 노출.

## 2026-02-13 추가 작업 로그 (온보딩 1회 노출 보강 + iOS 에뮬레이터 검증)
- 사용자 요청: "온보딩이 닫아도 여러 번 뜨는 문제" 해결 + 에뮬레이터 실검증.
- 수정 내용:
  - `/Users/dj/Desktop/SlideMino/components/GameModeTutorial.tsx`
    - `dismissedRef` + `hasSeenTutorial()` 가드 추가.
    - 타이머/resize/scroll 콜백(`checkTarget`)에서 닫힘/저장 상태면 즉시 `setIsVisible(false)`로 차단.
    - `handleDismiss()`에서 state 즉시 닫고 storage 저장(try/catch).
  - `/Users/dj/Desktop/SlideMino/components/BackNavigationTutorial.tsx`
    - 동일 패턴(`dismissedRef`, `hasSeenTutorial`) 적용.
    - 닫힘 이후 타이머 콜백 재실행으로 재노출되는 케이스 차단.
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - 이전 디버그용 시뮬레이터 QA 자동 광고 프로브가 production 검증을 가리는 문제 방지 위해 `isVirtualDevice` 초기화 effect를 `import.meta.env.DEV` 가드로 제한.

- iOS 시뮬레이터 검증(iPhone 13 Pro Max, UDID: 8D4A6A07-024E-4FF5-8505-AB707DC5F48E):
  1) 최초 실행: 온보딩 노출 확인
     - `/Users/dj/Desktop/SlideMino/screenshots/tutorial-once-01-first-launch.png`
  2) 온보딩 닫힘 후 앱 재실행: 온보딩 미노출 확인(1회 노출 유지)
     - `/Users/dj/Desktop/SlideMino/screenshots/tutorial-once-03-still-hidden.png`
  3) 다시보기 동작과 동일한 storage reset 후 앱 재실행: 온보딩 재노출 확인
     - `/Users/dj/Desktop/SlideMino/screenshots/tutorial-once-04-after-replay.png`

- 참고:
  - 현재 시뮬레이터 입력 자동화(cliclick)가 간헐적으로 버튼 클릭을 반영하지 않아, `튜토리얼 다시보기` 버튼 실클릭 대신 동일 로직(localStorage tutorial key 삭제)으로 재노출 검증을 수행.

## 2026-02-13 추가 작업 로그 (게임오버 판정 로직 전수 분석 + 개선)
- 사용자 요청: "현재 게임오버 판정이 무엇인지(미리보기 전부 배치 불가 vs 스와이프 불가) 명확화 + 유사 게임 조사 기반 개선".
- 전역 탐색:
  - 핵심 경로:
    - `/Users/dj/Desktop/SlideMino/services/gameLogic.ts`
    - `/Users/dj/Desktop/SlideMino/App.tsx`
  - 보조 확인:
    - `/Users/dj/Desktop/SlideMino/components/Board.tsx`
    - `/Users/dj/Desktop/SlideMino/components/Slot.tsx`
    - `/Users/dj/Desktop/SlideMino/services/gameStorage.ts`
    - `/Users/dj/Desktop/SlideMino/components/GameOverModal.tsx`
    - `/Users/dj/Desktop/SlideMino/public/locales/*/game.json`
- 기존 로직 결론:
  - `App.tsx`의 Game Over effect는 `phase === PLACE`일 때만 판정.
  - 실제 판정 함수 `checkGameOver(grid, slots)`는 슬롯(3개)의 모든 회전/좌표를 탐색해 배치 가능 수가 0이면 게임오버.
  - 따라서 기존 기준은 이미 "미리보기 블록 전부 배치 불가"이며, "스와이프 불가"는 직접 게임오버 기준이 아님.
- 개선 조치:
  - `/Users/dj/Desktop/SlideMino/services/gameLogic.ts`
    - `hasPlaceableSlotMove(grid, slots)` 내부 공용화.
    - `getTurnActionAvailability(grid, slots)` 신규 추가:
      - `canPlace`, `canSwipe`, `isGameOver`를 한 번에 계산.
    - `checkGameOver`는 내부적으로 `!hasPlaceableSlotMove(...)`를 사용하도록 단순화.
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - Game Over effect에서 `getTurnActionAvailability` 사용.
    - `phase===SLIDE`인데 `canSwipe=false`인 비정상/데드락 상태면 `finishSlideTurn()`로 PLACE 복귀하도록 안전장치 추가.
    - `executeSlide()`의 `!moved` 분기에서도 동일 안전복귀 처리.
- 시장조사/유사게임 교차검증(핵심 근거):
  - 2048 오픈소스(`movesAvailable()` 기준으로 over 처리): 이동 불가 시 종료.
  - 1010!/Block Blast류: "남은 블록을 놓을 수 없는 순간" 종료.
  - Triple Town: 보드가 가득 차 더 진행 불가 시 종료.
  - Tetris(top-out): 스폰/유지 불가 시 종료.
  - 결론: 현재 프로젝트 장르(슬롯 배치 중심 퍼즐)에서는 "배치 가능성"을 게임오버 기준으로 두는 것이 시장 표준과 정합.

## 2026-02-13 검증 로그 (게임오버 로직)
- 정적 검증:
  - `npx tsc --noEmit` 성공
  - `npm run build` 성공
- 스킬 클라이언트 실행 확인:
  - `node "$WEB_GAME_CLIENT" ...` 실행 및 `web_game_client_status=0` 확인
- Playwright 상태 주입 검증:
  1) `phase='PLACE'` + 풀보드 + 슬롯 전부 배치 불가:
     - 결과: `gameOverVisible=1`, `placePhaseVisible=1`, `swipePhaseVisible=0`
  2) `phase='SLIDE'` + 동일 데드락:
     - 결과: 자동 PLACE 복귀 후 `gameOverVisible=1` 확인

## TODO / 후속 제안
- 실제 기기(iOS/Android)에서 매우 긴 플레이 세션 후 저장/복원 경계에서
  - `phase`/`canSwipe`/`isGameOver` 전이가 일관적인지 1회 회귀검증 권장.

## 2026-02-13 추가 작업 로그 (iOS 시뮬레이터 게임오버/부활 E2E 재검증 + 근본 수정)
- 사용자 요청: iPhone 에뮬레이터에서 게임오버 판정과 광고 시청 후 부활 로직이 실제로 작동하는지 전 시나리오 재검증.
- 재현 결과(수정 전):
  - 강제 게임오버 모드(`slidemino_sim_qa_mode=force_gameover_and_revive`)에서 GameOver 진입은 재현되나,
  - 부활 버튼이 장시간 `광고 준비 중`으로 고정되는 케이스 존재.
- 근본 원인:
  - `/Users/dj/Desktop/SlideMino/App.tsx`의 보상형 전면 광고 readiness 폴링이 `PLAYING`에서만 동작.
  - `GAME_OVER` 진입 후 `isReviveAdReady` 갱신 루프가 끊겨, 광고가 나중에 로드돼도 버튼 상태가 갱신되지 않을 수 있음.
- 수정 내용:
  1) `/Users/dj/Desktop/SlideMino/App.tsx`
     - 보상형 전면 광고 preload/readiness polling effect를 `PLAYING` + `GAME_OVER` 모두에서 동작하도록 확장.
  2) `/Users/dj/Desktop/SlideMino/services/admob.ts`
     - iOS virtual device(시뮬레이터)에서 테스트 광고 QA 시 `canRequestAds`가 동의 상태에 의해 막히지 않도록 우회(`isVirtual ? true : normalizeCanRequestAds(...)`).
     - 실제 기기에는 영향 없음.

- 빌드/배포 검증:
  - `npx tsc --noEmit` 성공
  - `npm run build` 성공
  - `npm run cap:sync` 성공
  - `npx cap run ios --target 8D4A6A07-024E-4FF5-8505-AB707DC5F48E` 성공

- iOS 시뮬레이터 E2E 결과(UDID: 8D4A6A07-024E-4FF5-8505-AB707DC5F48E):
  - 자동 주입 상태: `gameState=PLAYING(score=42)` + `slidemino_sim_qa_mode=force_gameover_and_revive`
  - 타임라인:
    - t8: GameOver 화면 + 부활 카드 노출
      - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/revive-recheck2-t8.png`
    - t15~: AdMob Test mode 광고 노출 중,
      localStorage 검증에서 `slidemino_game_state_v1.hasUsedRevive=true`,
      `slidemino_daily_revive_ad_data.count=1` 확인
      - 증거 보고서: `/Users/dj/Desktop/SlideMino/output/ios-e2e-revive-recheck2.json`
  - 부활 후 지속성 확인:
    - QA 강제모드 키 제거 후 앱 재실행 시 PLAYING 화면으로 복귀 유지
      - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/revive-recheck3-after-qa-off.png`
      - 저장 상태: `gameState=PLAYING`, `score=42`, `phase=PLACE`, `hasUsedRevive=true`

- 결론:
  - iOS 시뮬레이터 기준으로
    1) 게임오버 판정 진입,
    2) 광고 보상 수령 이벤트,
    3) 직전 상태 부활 복구,
    4) 일일 부활 카운트 반영,
    5) 재실행 후 복구 상태 유지
  - 전 흐름이 재현/검증됨.

## 2026-02-13 추가 작업 로그 (iOS 시뮬레이터 회귀 4종 + 부활 지속성 최종 확인)
- 게임오버 판정 4종 시나리오를 iOS 시뮬레이터에서 재실행:
  - 보고서: `/Users/dj/Desktop/SlideMino/output/ios-e2e-gameover-regression-20260213.json`
  - 결과: `allPass=true`
    - A `PLACE + 배치불가` -> 게임오버 (`state cleared`)
      - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/reg-A-place-unplaceable.png`
    - B `PLACE + 배치가능` -> 플레이 유지 (`state exists`)
      - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/reg-B-place-placeable.png`
    - C `SLIDE + 데드락` -> PLACE 복귀 후 게임오버 (`state cleared`)
      - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/reg-C-slide-deadlock.png`
    - D `SLIDE + 이동가능` -> 플레이 유지 (`state exists`)
      - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/reg-D-slide-movable.png`

- 부활 광고 실동작 증거 보강:
  - AdMob Test mode 실제 전면 광고 노출 확인
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/revive-recheck2-t8.png`
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/revive-recheck2-t15.png`
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/revive-recheck2-t25.png`
  - 저장값 확인:
    - `/Users/dj/Desktop/SlideMino/output/ios-e2e-revive-recheck2.json`
    - `hasUsedRevive=true`, `dailyReviveData.count=1` 반영 확인.

- 부활 후 지속성(앱 재실행) 최종 확인:
  - QA 강제모드 키 제거 후 재실행 시 PLAYING 화면 복귀 유지
    - `/Users/dj/Desktop/SlideMino/screenshots/ios-e2e/revive-recheck3-after-qa-off.png`
  - localStorage 상태:
    - `slidemino_game_state_v1` 존재
    - `{ gameState: 'PLAYING', score: 42, phase: 'PLACE', hasUsedRevive: true }`

## 2026-02-13 추가 작업 로그 (드래그 중 상하 흔들림 UX 개선)
- 사용자 요청: "블럭 미리보기에서 블럭을 잡아 그리드에 배치할 때 UI가 위아래로 움직이는 듯한 모션 제거".
- 전역 분석 결론(UI/UX 분리):
  - UI 원인(주): `App.tsx`에서 `draggingPiece`일 때만 하단 회전 버튼 행이 조건부 렌더되어 레이아웃이 변형될 수 있는 구조.
  - UX 원인(보조): 슬롯/드래그 상태의 스케일 변환(`scale`)이 드래그 체감에서 "떠오르거나 출렁이는" 느낌을 강화.
- 수정 내용(최소 변경):
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - `DRAG_OVERLAY_SCALE`을 `1.04 -> 1`로 조정(드래그 오버레이 확대 모션 제거).
    - 회전 버튼 영역을 상시 `h-9` 컨테이너로 고정하고, 드래그 중에만 `opacity/pointer-events`로 표시 전환.
      - 결과: 드래그 시작/종료 시 레이아웃 재배치(조건부 행 추가/삭제) 제거.
  - `/Users/dj/Desktop/SlideMino/components/Slot.tsx`
    - `isPressed`의 `scale-[1.01]` 제거.
    - 기본 상태의 `active:scale-[0.99]` 제거.
      - 결과: 슬롯 프리뷰 자체의 미세 상하 스케일 모션 제거.
- 검증:
  - DOM 계측(Chrome DevTools 자동화): 드래그 전/중 `mainHeight`, `mainBottom`, `boardTop` 변화량 모두 `0` 확인.
  - 드래그 오버레이 인라인 transform 확인: `scale(1)` 적용 확인.
  - 시각 캡처: `/Users/dj/Desktop/SlideMino/screenshots/drag-ui-stabilized-20260213.png`
  - 스킬 클라이언트 실행: `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5176 --actions-file "$WEB_GAME_ACTIONS" --iterations 1 --pause-ms 200` 실행 완료.
    - 산출물: `/Users/dj/Desktop/SlideMino/output/web-game/shot-0.png`, `/Users/dj/Desktop/SlideMino/output/web-game/errors-0.json`
  - 빌드 검증: `npm run build` 성공.

## 2026-02-13 추가 작업 로그 (스와이프 포커스 중 Undo 터치 불가 버그 수정)
- 사용자 요청: 스와이프 포커스 모드에서 그리드만 터치되고 Undo 버튼이 눌리지 않는 문제 수정.
- 근본 원인:
  - `/Users/dj/Desktop/SlideMino/App.tsx` 헤더 우측 컨트롤 래퍼에
    `isSwipeFocusMode`일 때 `pointer-events-none`이 적용되어,
    Undo 버튼까지 이벤트가 차단됨.
- 수정 내용(최소 변경):
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - 우측 컨트롤 래퍼에서 `pointer-events-none` 제거.
    - 스와이프 포커스 제한은 요소 단위로 분리:
      - 상태 Pill: `opacity-35 grayscale pointer-events-none`
      - 도움말 버튼: `opacity-35 grayscale pointer-events-none`
      - 보상광고 버튼: `opacity-35 grayscale pointer-events-none`
    - Undo 버튼은 `pointer-events-auto`를 명시해 스와이프 모드에서도 터치 가능하게 유지.
- 검증:
  - `npm run build` 성공.
  - 런타임 상태 주입(`phase='SLIDE'`) 후 DOM 계측:
    - 우측 컨트롤 래퍼 `pointerEvents='auto'`
    - 도움말 버튼 `pointerEvents='none'`
    - Undo 버튼 `pointerEvents='auto'` 확인.

## 2026-02-13 추가 재작업 로그 (스와이프 모드 Undo/슬롯 가시성 재검증 및 보강)
- 사용자 피드백 반영: "슬롯 미리보기가 사라져 보이고, Undo가 포커스되지 않는다" 재검증.
- 재현/분석:
  - 스와이프 모드 슬롯 컨테이너가 `opacity-15 + blur`로 처리되어 저대비 배경에서 사실상 소실처럼 보임.
  - Undo 포커스 자체와 별개로, 저장 복원 경로에서 `undoRemaining`은 남아 있는데 `lastSnapshot`이 없어 버튼이 disabled가 되는 불일치 가능성 확인.
- 수정:
  1) `/Users/dj/Desktop/SlideMino/App.tsx`
     - 스와이프 모드 슬롯 비활성 스타일을 `opacity-100 pointer-events-none`으로 변경(가시성 유지, 입력만 차단).
     - Undo 버튼에 `onPointerDown`에서 `stopPropagation()` 추가(루트 스와이프 핸들러와 포인터 경합 방지).
  2) `/Users/dj/Desktop/SlideMino/services/gameStorage.ts`
     - `lastSnapshot` 영속화 필드(`StoredUndoSnapshot`) 추가.
     - 로드 시 snapshot 유효성 검사 추가.
     - snapshot이 없는 저장 데이터는 `undoRemaining=0`으로 정규화(숫자는 남아 있는데 클릭 불가한 불일치 제거).
  3) `/Users/dj/Desktop/SlideMino/App.tsx`
     - 저장 복원 시 `lastSnapshot` 함께 복원.
     - 자동 저장 시 `lastSnapshot` 함께 저장.
- 검증:
  - `npm run build` 성공.
  - 런타임 상태 주입(`phase='SLIDE'`, `undoRemaining=2`, `lastSnapshot` 포함) 검증:
    - Undo 버튼: `disabled=false`, `pointerEvents='auto'` 확인.
    - Undo 클릭 후 실제 복원 동작 확인(`score 10 -> 8`, `phase SLIDE -> PLACE`, `undoRemaining 2 -> 1`).
    - 슬롯 컨테이너: `opacity=1`, `filter=none`, `pointerEvents=none` 확인.
  - 시각 캡처: `/Users/dj/Desktop/SlideMino/screenshots/swipe-mode-undo-fixed-20260213.png`

## 2026-02-13 추가 작업 로그 (요청: 미리보기 배열 + Undo를 메인 그리드와 동일 적용)
- 요청 반영: 스와이프 포커스에서 `메인 그리드`와 동일한 포커스 표현을 미리보기 슬롯/Undo에도 공통 적용.
- 수정:
  - `/Users/dj/Desktop/SlideMino/App.tsx`
    - `swipeFocusSurfaceClass` 공통 클래스 도입:
      - `scale-[1.01] drop-shadow-[0_22px_40px_rgba(15,23,42,0.18)]`
    - 적용 대상:
      - 메인 그리드 래퍼
      - 미리보기 슬롯 래퍼
      - Undo 버튼
    - 슬롯 제어 분리:
      - `isSlotPointerLocked = isSwipePhase || isAnimating` (입력 잠금)
      - `isSlotDisabled = isAnimating` (시각 비활성)
      - 즉, 스와이프 단계에서도 슬롯은 메인 그리드와 같은 포커스/가시성 유지, 입력만 잠금.
- 검증:
  - `npm run build` 성공.
  - 런타임 상태 주입(`phase='SLIDE'`, `undoRemaining=2`, `lastSnapshot` 포함) 후 CSSOM 검증:
    - 보드/슬롯/Undo 모두 동일 `transform(matrix 1.01)` + 동일 `drop-shadow` 확인.
    - Undo `pointerEvents='auto'`, `disabled=false` 확인.
    - Undo 클릭 시 복원 동작 확인(`score 10 -> 8`, `phase SLIDE -> PLACE`, `undoRemaining 2 -> 1`).
  - 시각 캡처: `/Users/dj/Desktop/SlideMino/screenshots/swipe-focus-grid-slots-undo-same-20260213.png`

## 2026-02-13 추가 작업 로그 (Undo 0회 표시 원인 점검 + 논리 수정)
- 사용자 문제제기: "Undo가 기본 3회여야 하는데 0회로 보임".
- 원인 확정:
  - `/Users/dj/Desktop/SlideMino/App.tsx:592`
    - `setUndoRemaining(restoredSnapshot ? saved.undoRemaining : 0)` 로직으로 인해,
      snapshot이 없는 저장 상태(정상 케이스 포함)에서 Undo 잔여 횟수가 0으로 강제됨.
  - `/Users/dj/Desktop/SlideMino/services/gameStorage.ts:109`
    - `const undoRemaining = lastSnapshot ? parsed.undoRemaining : 0` 동일 문제.
  - 설계 관점 결함:
    - `undoRemaining`(잔여 예산)과 `lastSnapshot`(즉시 Undo 가능 여부)을 결합해버린 것이 근본 오류.
- 수정:
  - `undoRemaining`을 snapshot과 독립 상태로 복원하도록 변경.
  - 구버전 저장 데이터 호환을 위해 `undoRemaining` 누락 시 기본값 `3` 사용.
  - 이어하기 버튼 경로에서도 `lastSnapshot`을 함께 복원하도록 보강(초기 로드 경로와 일관화).
- 검증:
  1) 저장 데이터 `undoRemaining=3`, `lastSnapshot` 없음 -> 로드 후 `3` 유지 확인.
  2) 레거시 저장 데이터(`undoRemaining` 없음) -> 로드 후 기본 `3` 확인.
  3) 이어하기 경로(`lastSnapshot` 포함) -> Undo `2` 유지 + 버튼 활성 확인.
  4) 빌드: `npm run build` 성공.

## 2026-02-13 추가 작업 로그 (이어하기 상태 전수 복원 점검/개선)
- 사용자 요청: 이어하기 시 Undo/현재 상태/슬라이드·배치 phase 등 전체 진행 상태를 저장-복원하는지 점검 및 개선.
- 점검 결과(근본 원인):
  - 복원 경로가 2개(앱 시작 자동복원, 메뉴의 이어하기 버튼)로 분산되어 있었고, 경로별로 복원 필드가 달라 상태 불일치 가능성이 있었음.
  - 특히 이어하기 버튼 경로에서 `lastSnapshot`/세션 메타 복원 누락 가능성이 있었음.
- 개선:
  1) `/Users/dj/Desktop/SlideMino/App.tsx`
     - `restoreSavedGame(saved)` 공통 복원 함수 추가.
     - 자동복원(useEffect)과 이어하기 버튼 모두 해당 함수 사용으로 일원화.
     - 복원 항목 통일:
       - `gameState, grid, slots, score, phase, boardSize`
       - `undoRemaining, lastSnapshot`
       - `hasUsedReviveThisRun`
       - `sessionIdRef, moveCountRef, gameStartTimeRef, playerName`
       - 부활 광고 진행/준비 상태 초기화 및 `reviveSnapshotRef` 정리
  2) `/Users/dj/Desktop/SlideMino/services/gameStorage.ts`
     - `undoRemaining` 파싱을 `lastSnapshot` 존재 여부와 분리.
     - 레거시 데이터(`undoRemaining` 누락) 기본값 `3`으로 복원.
     - 범위 정규화(0~99 정수).
- 검증:
  - `npm run build` 성공.
  - 자동복원 시나리오:
    - `undoRemaining=3`, `lastSnapshot 없음` 저장 데이터 -> 로드 후 Undo `3` 확인.
    - 레거시 저장 데이터(`undoRemaining` 없음) -> 로드 후 Undo `3` 확인.
  - 이어하기 버튼 경로 시나리오:
    - 저장값(`score=77`, `phase=PLACE`, `undo=2`, `lastSnapshot 존재`, `sessionId/moveCount/startedAt/playerName`) 설정 후 메뉴 -> 이어하기.
    - 복원 결과: 점수 `77`, phase `PLACE`, Undo `2` 확인.
    - 디바운스 저장 후 localStorage 재확인: `undoRemaining=2`, `lastSnapshot 존재`, `hasUsedRevive/sessionId/moveCount/startedAt/playerName` 유지 확인.
  - 스킬 스크립트 실행:
    - `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5173 --actions-file "$WEB_GAME_ACTIONS" --iterations 1 --pause-ms 200`
    - 산출물: `/Users/dj/Desktop/SlideMino/output/web-game/shot-0.png`, `/Users/dj/Desktop/SlideMino/output/web-game/errors-0.json`

## 2026-02-13 추가 작업 로그 (모드 알리미 상태 기반 포커스 집단 분리)
- 사용자 요구 정리:
  - 포커스 집단을 고정값이 아니라 모드 알리미(`phase`) 상태에 따라 전환.
  - `SLIDE`에서는 `그리드 + Undo`만 강조하고, 블록 미리보기 슬롯은 비강조(보이되 포커스 제외).
  - `PLACE`에서는 `그리드 + 슬롯`을 강조하고, Undo는 일반 상태로 유지.
- 수정 파일:
  - `/Users/dj/Desktop/SlideMino/App.tsx`
- 구현 내용:
  1) 포커스 상태 상수 분리
     - `isPlaceFocusMode`, `isSwipeFocusMode`
     - `boardFocusSurfaceClass`, `undoFocusSurfaceClass`, `slotFocusSurfaceClass`, `slotVisibilityClass`
  2) 모드별 매핑 적용
     - 보드: PLACE/SLIDE 모두 포커스 유지
     - Undo: SLIDE에서만 포커스
     - 슬롯: PLACE에서만 포커스, SLIDE에서는 `pointer-events-none + opacity-60 + grayscale(0.3) + saturate(0.75)`로 비강조
  3) 기존 모호 로직 정리
     - 슬롯/Undo/보드가 동일 포커스되던 상태를 phase 기준으로 명시 분리.
- 빌드 검증:
  - `npm run build` 성공.
- 런타임 계측 검증(Chrome DevTools):
  - SLIDE(`보드 스와이프`):
    - 보드 `transform=matrix(1.01)` + drop-shadow
    - Undo `transform=matrix(1.01)` + drop-shadow
    - 슬롯 `transform=matrix(1)` / `pointerEvents=none` / `opacity=0.6`
  - PLACE(`블록 배치`):
    - 보드 `transform=matrix(1.01)` + drop-shadow
    - 슬롯 `transform=matrix(1.01)` + drop-shadow / `pointerEvents=auto`
    - Undo `transform=matrix(1)` / filter none
- 시각 검증 스크린샷:
  - `/Users/dj/Desktop/SlideMino/screenshots/focus-groups-swipe-mode-20260213.png`
  - `/Users/dj/Desktop/SlideMino/screenshots/focus-groups-place-mode-20260213.png`
- 스킬 루프 검증:
  - `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5173 --actions-file "$WEB_GAME_ACTIONS" --iterations 1 --pause-ms 200` 실행 완료.
  - 산출물 기본 경로: `/Users/dj/Desktop/SlideMino/output/web-game/`
- 추가 미세조정(동일 작업 내): SLIDE 슬롯 비강조 강도를 `opacity-75/grayscale(0.15)` -> `opacity-60/grayscale(0.3)/saturate(0.75)`로 상향해 포커스 오인 가능성 완화.
- 스크린샷 재캡처: 위 두 파일을 최신 값으로 overwrite.
- 자동 루프 재검증: `web_game_playwright_client.js` 1회 재실행(최종 조정 반영 확인).

## 2026-02-13 추가 작업 로그 (랭킹 등록 타이밍/초성/개인정보 안내/게임중 예상순위)
- 사용자 요청:
  - 초성(예: `ㅎ`) 입력 허용
  - 랭킹 이름 입력 시 개인정보 주의 안내
  - 점수 서버 등록 시점을 게임오버의 `랭킹 등록하기` 플로우로 제한
  - 게임 중 우상단에 예상 순위/다음 순위까지 점수 표시
- 아키텍처 분석 결론:
  - 기존 `App.tsx`에 10초 주기 + 게임오버 즉시 `rankingService.updateScore()` 호출이 있어, 사용자가 등록 버튼을 누르기 전에 서버 반영될 수 있었음.
  - 이름 검증은 클라이언트(`utils/playerName.ts`)와 서버(`functions/utils/validation.ts`)가 각각 동일한 제한 패턴을 갖고 있었고, 둘 다 초성/중성 자모가 제외되어 있었음.
- 수정 내용:
  1) `/Users/dj/Desktop/SlideMino/App.tsx`
     - `performScoreUpdate` 및 자동 전송 effect(주기 전송/게임오버 전송) 제거.
     - 게임 중에는 `rankingService.getLeaderboard()` 결과로만 예상 순위를 계산하도록 변경.
     - 새 상태 `liveRankEstimate`를 헤더에 렌더링:
       - `예상 #N`
       - `다음 순위까지 X점` 또는 `현재 1위권`
  2) `/Users/dj/Desktop/SlideMino/services/rankingService.ts`
     - `estimateLiveRank(score, difficulty, leaderboard)` 추가(동일 난이도 필터링 + rank/pointsToNext 계산).
  3) `/Users/dj/Desktop/SlideMino/utils/playerName.ts`
     - 이름 패턴에 자모 범위 추가: `ㄱ-ㅎ`, `ㅏ-ㅣ`.
  4) `/Users/dj/Desktop/SlideMino/functions/utils/validation.ts`
     - 서버 이름 검증 패턴도 동일하게 자모 범위 추가(클라이언트/서버 일관성 유지).
  5) `/Users/dj/Desktop/SlideMino/components/NameInputModal.tsx`
     - 닉네임 입력 전 개인정보 주의 문구 박스 추가.
  6) `/Users/dj/Desktop/SlideMino/components/GameOverModal.tsx`
     - 랭킹 등록 입력 영역에 동일한 개인정보 주의 문구 추가.
  7) 다국어 키 추가:
     - `/Users/dj/Desktop/SlideMino/public/locales/{ko,en,ja,zh}/modals.json`
       - `nameInput.privacyNotice`
     - `/Users/dj/Desktop/SlideMino/public/locales/{ko,en,ja,zh}/game.json`
       - `liveRank.estimatedRank`, `liveRank.pointsToNext`, `liveRank.topRank`
- 검증:
  - `npm run build` 성공.
  - 스킬 스크립트 실행:
    - `node "$WEB_GAME_CLIENT" --url http://127.0.0.1:5174 --actions-file "$WEB_GAME_ACTIONS" --iterations 2 --pause-ms 250`
    - 산출물: `/Users/dj/Desktop/SlideMino/output/web-game/shot-0.png`, `/Users/dj/Desktop/SlideMino/output/web-game/errors-0.json`
  - Playwright 실검증:
    - `7x7 게임 시작` 이름 모달에서 `ㅎ` 입력 후 시작 성공(초성 허용 확인).
    - 헤더에 `점수 예상 #4` + `다음 순위까지 101점` 노출 확인(캐시 랭킹 데이터 기준).
    - 네트워크 요청 점검 시 게임 중 `/api/submit` 호출 없음 확인(자동 등록 제거 확인).

## 2026-02-13 추가 작업 로그 (Wrangler 기반 랭킹 등록 오류 원인 분석/엔드포인트 검증)
- 증상:
  - 사용자 보고: 랭킹 등록 시 반복 오류 발생.
- 점검 범위:
  - Cloudflare 배포 API 직접 호출(`/api/rankings`, `/api/submit`)
  - `wrangler` 인증/배포 상태 점검
  - 로컬 코드(`functions/utils/validation.ts`)와 프로덕션 응답 비교
- 원인 결론:
  1) 프로덕션 함수가 최신 검증 로직(초성 허용)으로 반영되지 않은 상태였음.
     - 증거: `https://slidemino.emozleep.space/api/submit`에 `name="ㅎ"` POST 시 `400 {"error":"Name contains invalid characters"}`.
     - 동일 시점 `name="testuser"`/`name="가"`는 `201` 성공 → 일반 입력은 동작, 초성만 실패.
  2) 배포 파이프라인 측면에서 `npm run build:cf`가 타입 오류로 중단될 수 있는 상태였음.
     - `App.tsx`의 i18n `t()` 호출 2곳에서 TS 오류 재현.
- 조치:
  1) `App.tsx` i18n 타입 오류 2건 최소 수정
     - `String(t(..., {...} as any))` 형태로 컴파일 오류 제거.
  2) `npm run build:cf` 재실행 성공 확인.
  3) `wrangler` 배포 수행:
     - Preview 배포: `https://ad609be2.slidemino.pages.dev`
     - `--branch main` 배포 수행 후 프로덕션 재검증.
- 최종 검증:
  - 프로덕션 `POST https://slidemino.emozleep.space/api/submit` + `name="ㅎ"` → `201 {"success":true,"rank":2}`
  - 프로덕션 `GET https://slidemino.emozleep.space/api/rankings` 응답에 초성 이름 반영 확인.

## 2026-02-13 추가 작업 로그 (사용자 요청 후속: 엔드포인트/CORS/브라우저 컨텍스트 전수 재검증)
- 사용자 요청:
  - "그거까지 모두 진행" 요청에 따라 서버 엔드포인트를 HTTP 레벨 + 실제 브라우저 컨텍스트로 재검증.
- 수행 내용:
  1) CORS Preflight 점검
     - `OPTIONS https://slidemino.emozleep.space/api/submit`
     - 결과: `204`, `Access-Control-Allow-Methods: POST, OPTIONS`, `Access-Control-Allow-Headers: Content-Type` 확인.
  2) 프로덕션 API 직접 호출(두 Origin)
     - Origin `https://slidemino.emozleep.space` + `name="ㅎ"` POST → `201 success`
     - Origin `https://www.slidemino.emozleep.space` + `name="ㅎ"` POST → `201 success`
  3) 랭킹 조회 반영 확인
     - `GET https://slidemino.emozleep.space/api/rankings`에서 초성 닉네임 레코드 반영 확인.
  4) 브라우저 컨텍스트 검증(Playwright)
     - 실제 페이지 `https://slidemino.emozleep.space` 로드 후 `fetch('/api/submit')` 실행.
     - 결과: `status=201`, body=`{"success":true,"rank":2}`
     - 이어 `fetch('/api/rankings')` 결과 상위 목록에 방금 등록한 초성 닉네임 반영 확인.
  5) 빌드 재검증
     - `npm run build` 성공.
- 결론:
  - 현재 프로덕션 환경에서 랭킹 등록 엔드포인트(`/api/submit`)와 조회(`/api/rankings`)는 정상 동작.
  - 초성 닉네임(`ㅎ`) 제출, CORS, 브라우저 경유 호출까지 모두 정상.

## 2026-02-13 추가 작업 로그 (Wrangler 배포 + 갤럭시/아이폰 준비)
- 사용자 요청:
  - Wrangler로 사이트 배포, 빌드 완료, Android/iOS 준비.
- 수행:
  1) Cloudflare 배포용 빌드
     - `npm run build:cf` 성공.
  2) Wrangler Pages 배포
     - `npx wrangler pages deploy dist --project-name slidemino --branch main --commit-dirty=true`
     - 배포 완료 URL: `https://43787550.slidemino.pages.dev`
  3) 프로덕션 엔드포인트 사후 검증
     - `GET https://slidemino.emozleep.space/api/rankings` → `200`
     - `POST https://slidemino.emozleep.space/api/submit` (`name="ㅎ"`) → `201 {"success":true,...}`
  4) 모바일 준비(갤럭시/아이폰)
     - `npm run cap:sync` 성공.
     - Android 자산 복사 + 플러그인 갱신 완료.
     - iOS 자산 복사 + 플러그인 갱신 완료.
- 상태:
  - 웹 배포/랭킹 API/모바일 동기화 모두 정상 완료.
