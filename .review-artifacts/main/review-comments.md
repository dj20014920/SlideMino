# Code Review

## Summary
순차 온보딩 시스템은 설계의도에 충실히 구현되었습니다. createPortal + 스포트라이트 + localStorage 기반 진행 관리가 깔끔하게 구성되어 있으며, 프리미엄/일반 UI 모두에서 data-tutorial-anchor가 올바르게 설정되어 있고, 4개 언어 키도 전부 존재합니다. 다만 MutationObserver의 과도한 관찰 범위, i18n 타입 단언, 버전 마이그레이션 미비 등 몇 가지 개선 포인트가 있습니다.

## Comments

### [p1] SequentialOnboardingOverlay.tsx:149-155
- 근거: 평가기준 - React `useEffect는 최소화하고, 가능하면 이벤트 핸들러로 대체` (공통 기준 > React) 및 ADR-003의 z-index와 직접 무관하지만, 불필요한 리렌더링은 `createPortal`로 분리한 이점을 상쇄합니다.
- 내용: MutationObserver가 `document.body`를 `subtree: true`, `attributes: true`, `childList: true`로 관찰하고 있습니다. 앱 전체의 모든 DOM 변경마다 spotlight 재계산이 트리거됩니다(requestAnimationFrame으로 스로틀링 되지만 observer 콜백 자체는 매번 실행됨). 특히 게임 중 블록 이동, 점수 갱신 등 빈번한 DOM 업데이트가 발생할 때 불필요한 연산이 누적됩니다.
- 제안: selector에 해당하는 특정 요소만 `observe`하거나, `attributeFilter`를 `['data-tutorial-anchor']`로 좁혀서 최소한의 변경만 감지하도록 제한하세요.

### [p2] sequentialOnboardingService.ts:66-83
- 근거: ADR-002 - `저장 데이터 구조는 version 필드를 포함하여 향후 마이그레이션 가능해야 함`
- 내용: `loadData()`가 버전 불일치 시 `{ ...DEFAULT_DATA }`로 초기화합니다. 이는 향후 스키마 변경 시 모든 사용자 데이터가 무손실로 소멸됨을 의미합니다. "마이그레이션 가능"한 구조가 아니라 "초기화"만 구현된 상태입니다.
- 제안: 버전별 마이그레이션 함수를 준비하거나, 최소한 주석에 "현재는 v1만 존재하므로 초기화로 충분"이라고 명시하여 의도를 드러내세요.

### [p2] SequentialOnboardingOverlay.tsx:102
- 근거: 평가기준 - TypeScript `any 사용 금지, unknown 우선` (공통 기준 > TypeScript)
- 내용: `t(config.textKey as any, config.fallbackText)`에서 `as any`로 i18n 키 타입 체크를 우회하고 있습니다. `textKey`가 `string` 타입이므로 실제 i18n 키가 존재하지 않아도 컴파일 타임에 감지되지 않습니다.
- 제안: `textKey`의 타입을 템플릿 리터럴 타입이나 i18n 키 유니온 타입으로 좁히거나, `as any`가 아닌 `@ts-expect-error`와 사유 주석을 추가하여 의도적인 우회임을 명시하세요.

### [p2] SequentialOnboardingOverlay.tsx:75-78
- 근거: 평가기준 - Common convention 위반은 아니나, `game_resume` 단계의 타겟(`#continue-btn`)이 조건부 렌더링되는 상황에서 자동 진행 의존성이 높습니다.
- 내용: `findDisplayableTarget`이 `querySelectorAll`로 모든 후보를 찾은 뒤 `find(isElementDisplayable)`로 첫 번째 표시 가능한 요소를 반환합니다. `#leaderboard-btn`처럼 `id`와 `data-tutorial-anchor`가 모두 셀렉터에 포함된 경우(`'#leaderboard-btn, [data-tutorial-anchor="leaderboard-btn"]'`), id가 우선 매칭되므로 data-tutorial-anchor가 실질적으로 폴백 역할을 합니다. 설계의도 결정3과는 반대로 id가 우선시되고 있습니다.
- 제안: 우선순위를 명확히 하려면 `data-tutorial-anchor`를 먼저 시도하고 `id`로 폴백하도록 순서를 바꾸거나, 설계의도에 맞게 현재 동작을 주석으로 설명하세요.

### [p3] App.tsx:2990-3007
- 근거: `useCallback`/`useMemo`에 의존성 배열 완전히 명시 (공통 기준 > TypeScript)
- 내용: `handleSeqOpenFeature` useCallback의 의존성 배열에 `openLeaderboardModal`과 `openMissionModal`은 포함되어 있지만, `advanceSequentialStep`과 `SEQUENTIAL_STEPS`가 누락되었습니다. 현재는 두 값 모두 모듈 스코프의 불변 값이라 실질적 문제는 없으나, 의존성 배열 불완전성은 린터 경고를 유발할 수 있습니다.
- 제안: 의존성 배열에 `advanceSequentialStep`과 `SEQUENTIAL_STEPS`를 추가하거나, 두 값이 불변임을 `eslint-disable-next-line` 주석으로 명시하세요.

### [p3] SequentialOnboardingOverlay.tsx:186-199
- 근거: 설계의도 결정4 - "타겟 미발견 시 1.5초 자동 진행"
- 내용: 자동 진행 타이머는 spotlight가 `null`일 때만 동작합니다. 이는 타겟 요소가 DOM에 존재하지 않거나 표시 불가능한 경우를 올바르게 처리합니다. 그러나 `visible && step`이 true이고 spotlight가 null인 상태에서 1.5초 후 `onAdvance()`가 호출되면, 다음 단계에서도 동일하게 spotlight를 찾지 못할 경우 연쇄적으로 auto-advance가 발생하여 3단계 모두 약 4.5초 만에 통과할 수 있습니다. 설계의도에는 이 연쇄 동작에 대한 명시가 없습니다.
- 제안: 연쇄 auto-advance가 의도된 동작인지 설계의도에 명시하거나, auto-advance 발생 시 다음 단계에서 최소 대기 시간을 늘리는 등의 완충 장치를 고려하세요.

### [p3] sequentialOnboardingService.ts:102
- 근거: 설계의도 결정5 - localStorage 기반 진행 상태 관리
- 내용: `startSequentialOnboarding()`에서 `if (data.stepIndex > 0) return;` 가드가 있습니다. `stepIndex === 0`일 때는 항상 `saveData({ version: 1, completed: false, stepIndex: 0 })`를 호출하여 불필요한 localStorage 쓰기가 발생합니다. 이미 step 0 상태라면 쓰기를 건너뛰어도 됩니다.
- 제안: `if (data.completed || data.stepIndex > 0) return;` 또는 데이터 변경이 있을 때만 저장하도록 조건을 추가하세요.