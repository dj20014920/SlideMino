# Game Board Layout Contract

이 문서는 새 스킨, 보드 이펙트, 드래그 상호작용을 추가할 때 지켜야 하는 인게임 UI 좌표계 계약이다.

## 핵심 원칙

인게임 보드는 두 겹으로 나뉜다.

1. **Board shell**: `#game-board`
   - 스킨 장식 영역이다.
   - padding, border, rounded corner, shadow, glow, 배경, 프레임 질감 같은 시각 요소를 담당한다.
   - 스킨마다 달라져도 된다.

2. **Grid viewport**: `[data-board-grid-viewport="true"]`
   - 실제 게임 좌표계다.
   - 셀, 타일, ghost overlay, revive destroy FX, merge ripple, drag/drop hit-test가 모두 이 박스를 기준으로 동작한다.
   - 이 viewport 안에서는 `layout.cellPx`, `layout.pitchPx`, `layout.posPx`, `layout.offsetX/Y`가 단일 소스다.

이 분리는 중요하다. 과거에는 보드 shell을 측정한 뒤 CSS padding/border를 빼서 grid 크기를 계산했다. 그 방식은 스킨이 padding을 바꾸거나 광고 SDK가 비동기로 하단 높이를 바꾸는 순간 보드가 작아 보이거나 hit-test가 어긋날 수 있다.

## 파일별 책임

- `components/Board.tsx`
  - grid viewport를 직접 소유한다.
  - `ResizeObserver`는 grid viewport만 관찰한다.
  - 셀/타일/보드 내부 이펙트의 픽셀 좌표를 계산한다.

- `App.tsx`
  - 드래그 시작 시 `BOARD_GRID_VIEWPORT_SELECTOR`로 같은 viewport를 읽어 `BoardMetrics`를 만든다.
  - pointer 좌표를 grid 좌표로 변환한다.
  - 인게임 footer/ad lane을 안정적인 reserve height로 취급한다.

- `components/AdBanner.tsx`
  - 일반 화면은 responsive 광고를 쓸 수 있다.
  - 인게임은 `webLayout="compact-banner"`로 320x50 광고를 60px lane 안에 둔다.

- `constants.ts`
  - `BOARD_CELL_GAP_PX`와 `BOARD_GRID_VIEWPORT_SELECTOR`를 공유한다.

## 새 스킨 추가 규칙

스킨이 보드 프레임을 바꾸고 싶다면 `#game-board` shell의 class/style을 바꾼다.

허용:
- shell padding 변경
- shell border/background/shadow/glow 변경
- shell rounded corner 변경
- shell 주변 장식 pseudo-element 추가
- grid viewport 안의 셀/타일 class 변경

주의:
- grid viewport 자체에 padding, border, transform을 넣지 않는다.
- grid viewport의 `position: relative`, `width: 100%`, `height: 100%` 전제를 깨지 않는다.
- 셀 위치를 CSS transform으로 별도 보정하지 않는다. 위치는 `layout`이 담당한다.

## 새 보드 이펙트 추가 규칙

보드 내부 셀 위치를 따라가는 이펙트는 다음 중 하나를 사용한다.

- Board 내부 레이어로 추가하고 `layout.posPx`, `layout.cellPx`, `layout.pitchPx`를 props로 받는다.
- 전역 canvas/portal 이펙트라면 `gridViewportRef.current.getBoundingClientRect()`에서 client 좌표를 만든다.

셀 중심 client 좌표 공식:

```ts
const rect = gridViewport.getBoundingClientRect();
const clientX = rect.left + layout.offsetX + x * layout.pitchPx + layout.cellPx * 0.5;
const clientY = rect.top + layout.offsetY + y * layout.pitchPx + layout.cellPx * 0.5;
```

금지:
- `#game-board.getBoundingClientRect()`를 읽고 padding/border를 빼는 방식
- 스킨별 hardcoded offset
- 기기명 기반 분기
- 광고/하단 UI의 실측 높이를 보드 scale 계산에 연결

## 광고와 보드 크기

인게임 보드 scale은 “현재 viewport + stable chrome reserve”에서 계산한다. 광고 DOM의 실제 높이는 사용하지 않는다.

이유:
- AdSense responsive display unit은 컨테이너 폭과 방향 전환에 따라 다른 크기를 고를 수 있다.
- native AdMob/App-in-Toss 배너도 로드 후 size event가 늦게 도착할 수 있다.
- 보드는 드래그 hit-test와 시각 grid가 일치해야 하므로, 광고 SDK의 비동기 크기 변화가 보드 좌표계를 흔들면 안 된다.

## 기기 대응 원칙

플립, 폴더블, iPhone, Galaxy, 태블릿, split-screen을 기기명으로 나누지 않는다. 실제 앱이 받은 `window.innerWidth/innerHeight`, `visualViewport`, safe area, orientation 상태를 기준으로 layout profile을 계산한다.

기기나 스킨을 새로 추가했을 때 확인할 viewport 예시:
- `360x640`: 작은 Android 계열
- `375x667`: 작은 iPhone 계열
- `393x852`: 일반 iPhone/Galaxy 계열
- `430x932`: 큰 iPhone 계열
- `674x842`: 폴더블/분할 화면에 가까운 중간 폭
- `884x1104`: 펼친 폴더블/태블릿 계열

## 디버깅 체크리스트

보드가 작아 보이거나 좌표가 어긋나면 먼저 아래를 확인한다.

1. `[data-board-grid-viewport="true"]`의 rect가 기대 크기인지 확인한다.
2. `#game-board` shell padding/border가 grid viewport를 의도치 않게 과도하게 줄이지 않는지 본다.
3. grid viewport에 transform/padding/border가 들어갔는지 확인한다.
4. 인게임 광고가 `compact-banner`인지 확인한다.
5. `--bottom-chrome-height`가 stable reserve 값에서 광고 responsive square 크기로 튀지 않는지 확인한다.
6. 새 이펙트가 shell rect를 측정하지 않는지 검색한다.

관련 코드:
- `components/Board.tsx`
- `App.tsx`
- `components/AdBanner.tsx`
- `constants.ts`
