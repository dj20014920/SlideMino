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
