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
