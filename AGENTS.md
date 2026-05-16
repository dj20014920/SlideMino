# Project Rules

## Default operating mode
The chief agent is the orchestrator and final reviewer.

For non-trivial tasks, use this default loop:
researcher -> root-cause -> planner -> implementer -> verifier -> reviewer

Specialist agents are conditional, not default:
- security-auditor
- performance-analyst
- data-schema
- api-contract
- frontend-architect
- release-risk
- docs-writer
- test-designer
- screen-analyzer — 📸 사진/스크린샷/UI/OCR/영상 분석 에이전트 (Nemotron 3 Nano Omni)

## screen-analyzer 사용법
스크린샷, UI 화면, OCR 문서, 영상 프레임 분석이 필요할 때 chief가 호출:
- `screen-analyzer에게 이 스크린샷 분석해줘`
- `screen-analyzer에게 이 UI 화면의 모든 텍스트를 읽어줘`

screen-analyzer는 Nemotron 3 Nano Omni 모델을 사용하며 시각 정보를 하나도 빠짐없이
텍스트로 상세히 기술하여 다른 에이전트들이 활용할 수 있도록 합니다.

주의: 이미지 파일 경로를 전달해야 합니다 (직접 화면을 보는 기능은 없음)

## Engineering principles
- Prefer minimal diffs.
- Avoid broad refactors unless explicitly requested.
- Preserve local conventions and patterns.
- Do not claim success without evidence.
- Keep changes localized and explain scope.
- Short, concrete outputs are preferred over long essays.

## Repository guidance
Fill these in after /init or manual review:
- package manager:
- app entry points:
- test commands:
- build commands:
- environment setup:
- risky modules/directories:
- migration/schema paths: