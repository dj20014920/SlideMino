# 평가기준

## 공통 기준 (Code Convention)

### TypeScript
- Type 명시적 선언 (타입 추론에 의존하지 않음)
- `any` 사용 금지, `unknown` 우선
- 함수 시그니처에 명시적 return type
- `useCallback`/`useMemo`에 의존성 배열 완전히 명시

### React
- 상태는 최소 단위로 유지 (파생 상태는 useMemo로 계산)
- `useEffect`는 최소화하고, 가능하면 이벤트 핸들러로 대체
- 모달/다이얼로그는 `createPortal`로 body에 렌더링
- i18n 키는 `t()`로 참조, fallback 문자열 제공

### CSS/스타일링
- Tailwind CSS 클래스 우선
- 동적 스타일은 `style` 객체로, 변하지 않는 스타일은 className
- z-index는 명시적 계층 구조 유지 (overlay 9998, modal 9999)

## 이 작업에 적용되는 ADR

### ADR-001: 이중 UI 시스템 (프리미엄/일반)
- **적용 방법**: 온보딩 타겟 요소가 프리미엄/일반 UI 모두에서 렌더링되는지 확인.
  `data-tutorial-anchor` 속성이 두 테마의 동일 기능에 모두 설정되어야 함.
  BottomNavBar.tsx의 premium/non-premium 분기에서 누락된 속성 없는지 검증.

### ADR-002: 로컬 우선 저장 (localStorage)
- **적용 방법**: 온보딩 진행 상태는 localStorage에 저장. 서버 의존성 없음.
  저장 데이터 구조는 version 필드를 포함하여 향후 마이그레이션 가능해야 함.
  저장 실패 시 조용히 무시하고 기본값 사용.

### ADR-003: z-index 계층 관리
- **적용 방법**: overlay는 z-[9998], 모달은 z-[9999]. CTA 버튼으로 모달을 열 때는
  overlay를 먼저 숨긴 후 모달을 열어 z-index 충돌 방지.
  `pendingSeqStep` 메커니즘으로 모달 닫힘 후 온보딩 재개.

### ADR-004: 4개 언어 지원 (KO/EN/JA/ZH)
- **적용 방법**: 모든 UI 문자열이 4개 locale 파일에 존재해야 함.
  순차 온보딩 텍스트는 `game.json` > `onboarding > sequential`에 위치.
  `openFeature`와 `tapToContinue` 키가 모든 언어에 추가되어야 함.

### ADR-005: 접근성 지연 (캐주얼 게임 특성)
- **적용 방법**: aria 속성과 키보드 핸들링은 현재 버전에서 의도적으로 지연.
  단, `role="dialog"`와 같은 기본적인 시맨틱 마크업은 향후 추가 고려.

## 평가 항목

### 필수 (Pass/Fail)
1. TypeScript 컴파일 에러 없음 (npx tsc --noEmit)
2. 빌드 성공 (npm run build)
3. 모든 4개 언어에 텍스트 키 존재
4. 프리미엄/일반 UI 모두에서 data-tutorial-anchor 정상 동작
5. CTA 버튼 탭 시 모달 정상 열림 + 온보딩 advance
6. 모달 닫힘 후 다음 온보딩 단계 정상 재개
7. 3단계 모두 정상 진행 (자동 진행 포함)

### 권장 (Should)
8. z-index 충돌 없음 (overlay 9998 < modal 9999)
9. 배경 탭으로 advance 정상 동작
10. 스포트라이트가 정확한 타겟 요소 가리킴
11. 카드 배치가 화면 밖으로 나가지 않음 (clamp 적용)