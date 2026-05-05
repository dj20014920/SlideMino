# PR: 순차 인터랙티브 온보딩 시스템 도입

## Summary
기존 점수 기반 전체화면 모달 온보딩(GameOnboardingOverlay)을 경량화된 순차 인터랙티브 온보딩 시스템으로 대체. 50점 첫 스킨 보상 수령 후 무료 스킨 뽑기를 완료하면, 3개 기능을 "스포트라이트 + 한줄요약 + 지금열기버튼 + 터치 시 다음으로" 방식으로 소개한다.

## Changes

### 신규 파일
- **components/SequentialOnboardingOverlay.tsx**: createPortal 기반 오버레이 컴포넌트. 스포트라이트 하이라이트, 카드 UI (한줄요약 + CTA 버튼 + 단계표시 + 터치힌트), 타겟 미발견 시 1.5초 자동 진행
- **services/sequentialOnboardingService.ts**: 3단계 온보딩 진행 관리 (localStorage 기반). leaderboard → daily_activities → game_resume 순서

### 주요 변경 파일
- **App.tsx**: SkinModal onClose에서 온보딩 트리거. CTA 핸들러(handleSeqOpenFeature) 추가 — 온보딩 advance + 모달 열기 + pendingSeqStep 관리. 모달 닫힘 후 온보딩 재개 useEffect 추가
- **components/BottomNavBar.tsx**: `data-tutorial-anchor` 속성 추가 (menu-skin-btn, mission-nav-btn, leaderboard-btn)
- **components/GameOnboardingOverlay.tsx**: 삭제 (순차 온보딩으로 대체)
- **services/onboardingService.ts**: 점수 기반 온보딩만 유지 (skin 단계), 나머지 제거

### 기타 수정
- **locales/*/game.json**: `onboarding.sequential` 6개 키 → 3개 키 (leaderboard, dailyActivities, gameResume). `openFeature`/`tapToContinue` 키 추가
- **services/notificationService.ts**: 주간이벤트 알림 추가 (시작/종료 리마인더), 들여쓰기 수정

## Breaking Changes
없음. 기존 GameOnboardingOverlay는 삭제되었지만 점수 기반 스킨 온보딩(skin)은 onboardingService에 유지됨.

## Test Plan
- [ ] 50점 달성 → 첫 스킨 보상 모달 → 무료 뽑기 → SkinModal 닫힘 → 순차 온보딩 시작
- [ ] Step 1: leaderboard-btn 스포트라이트 + "지금 열기" → 리더보드 모달 열림 → 모달 닫힘 → Step 2 재개
- [ ] Step 2: mission-nav-btn 스포트라이트 + "지금 열기" → 미션 모달 열림 → 모달 닫힘 → Step 3 재개
- [ ] Step 3: continue-btn 스포트라이트 (또는 자동 진행) → 완료
- [ ] 배경 탭으로만 advance 정상 동작
- [ ] 프리미엄/일반 UI 모두에서 타겟 요소 가시성 확인
- [ ] "터치 시 다음으로" 힌트 4개 언어 표시 확인
- [ ] 온보딩 완료 후 재시작되지 않음
- [ ] 타겟 미발견 시 1.5초 자동 진행 (continue-btn 없는 경우)

## Related
설계의도: `.review-artifacts/main/design-intent.md`
평가기준: `.review-artifacts/main/code-quality-guide.md`