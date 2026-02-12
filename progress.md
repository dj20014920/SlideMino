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
