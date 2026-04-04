export interface Tile {
  id: string;
  value: number;
}

// Tile that is being absorbed during merge (for animation purposes)
export interface MergingTile {
  id: string;
  value: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export type Grid = (Tile | null)[][];

export enum ShapeType {
  I = 'I',
  O = 'O',
  T = 'T',
  S = 'S',
  Z = 'Z',
  J = 'J',
  L = 'L',
  PLUS = 'PLUS', // + 모양 (십자형, 5칸) — 주간 이벤트 전용
}

export interface Coordinate {
  x: number;
  y: number;
}

export interface Piece {
  id: string; // Unique ID for keying
  type: ShapeType;
  rotation: number; // 0, 1, 2, 3
  initialRotation: number; // 생성 시 최초 회전값 (회전 추적용)
  cells: Coordinate[]; // Relative coordinates
  value: number; // Default 1
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}

/** 게임 모드: 일반 / 데일리 챌린지 / 주간 이벤트 */
export type GameMode = 'normal' | 'daily_challenge' | 'weekly_event';

/** 주간 이벤트 종류 (8종 순환) */
export type WeeklyEventType =
  | 'NO_ROTATION'     // 뭐야 내 블럭 돌려줘요
  | 'BURNING'         // 버닝이벤트!
  | 'PLUS_RUSH'       // +블록 러시
  | 'EXPERT_4X4'      // 고수체험하기
  | 'SPEED_RUN'       // 스피드런!
  | 'TRIPLE_KILL'     // 트리플킬!
  | 'I_BLOCK_RUSH'    // I블록 러쉬
  | 'PLAINS_10X10';   // 평야달리기

export enum Phase {
  PLACE = 'PLACE',
  SLIDE = 'SLIDE',
}

export type BoardSize = 4 | 5 | 7 | 8 | 10;

export interface GameSettings {
  boardSize: BoardSize;
}

// --- Block customization (tile skins) ---

export type TileSkinKind = 'default' | 'color' | 'image';

export type TileSkinOverride =
  | { kind: 'default' }
  | { kind: 'color'; color: string } // hex: #RRGGBB
  | { kind: 'image'; imageDataUrl: string }; // data URL (square, optimized)

export interface GlobalTilePaletteSettings {
  enabled: boolean;
  baseColor: string; // hex: #RRGGBB (hue source)
  saturation: number; // 0..100
  brightness: number; // 0..100 (HSL lightness baseline)
  depth: number; // 0..80 (how much darker high values get)
}

export interface BlockCustomizationSettingsV1 {
  version: 1;
  globalPalette: GlobalTilePaletteSettings;
  perValue: Record<string, TileSkinOverride>; // key = tile value as string (e.g. "1", "2", "4"...)
}

// --- Skin system ---

export type SkinCategory = 'basic' | 'material' | 'digital' | 'art' | 'food' | 'nature' | 'neon';

export interface SkinStyle {
  type: 'solid' | 'gradient' | 'image' | 'css-pattern';
  // Base background (hex, gradient string, or url)
  value: string;
  // Optional specific overrides
  textColor?: string;
  borderColor?: string;
  shadow?: string;
  // For complex CSS patterns
  customCss?: string; // Serialized CSS properties
}

export interface PremiumUiMicroOverrides {
  topWindowTitle?: string;
  menuWindowTitle?: string;
  difficultyLegend?: string;
  utilityLegend?: string;
  languageLegend?: string;
  gameWindowTitle?: string;
  /** 스킨 모달 하단 상태바 텍스트 (왼쪽) */
  statusBarText?: string;
  /** 스킨 모달 하단 상태바 버전 텍스트 (오른쪽) */
  statusBarVersion?: string;
}

/**
 * 프리미엄 UI 패밀리 식별자.
 * - family는 "어떤 스타일 계열인지"를 나타내고,
 * - id는 "실제 적용 가능한 구체 테마"를 나타낸다.
 *
 * 현재는 Win98 계열 1종을 운영한다.
 */
export type PremiumUiThemeFamily = 'win98';
export type PremiumUiThemeId = 'retro_windows_98';

export interface PremiumUiTabObject {
  containerClassName: string;
  buttonClassName: string;
}

/**
 * 프리미엄 UI 클래스 매핑 계약.
 *
 * 설계 원칙:
 * 1) UI 오브젝트별로 "클래스 이름만" 매핑한다. (스타일 로직은 CSS에 위임)
 * 2) 공통/핵심 슬롯은 top-level에, 화면별 확장 슬롯은 extended에 둔다.
 * 3) 신규 프리미엄 테마 추가 시 이 인터페이스를 모두 채우면,
 *    컴포넌트 코드를 재작성하지 않고 객체 교체만으로 오버라이드 가능해야 한다.
 *
 * 유지보수 팁:
 * - 동일한 역할의 클래스는 반드시 같은 슬롯을 통해 참조한다(DRY).
 * - 컴포넌트에서 하드코딩 클래스 문자열을 직접 쓰지 말고 objects 슬롯을 사용한다.
 */
export interface PremiumUiObjectMap {
  appShellClassName: string;
  modalOverlayClassName: string;
  windowClassName: string;
  windowBodyClassName: string;
  titleBarClassName: string;
  titleBarTextClassName: string;
  /** 타이틀바 컨트롤 버튼 컨테이너 (닫기/최소화 등) */
  titleBarControlsClassName: string;
  blockClassName: string;
  buttons: {
    menuClassName: string;
    gameClassName: string;
    iconClassName: string;
    pillClassName: string;
    headerMainClassName: string;
    headerIconClassName: string;
    headerActionClassName: string;
    compartmentClassName: string;
  };
  tabs: {
    level: PremiumUiTabObject;
    skin: PremiumUiTabObject;
    mission: PremiumUiTabObject;
  };
  panels: {
    sunkenClassName: string;
    sunkenWhiteClassName: string;
    listItemClassName: string;
    listItemHighlightClassName: string;
    badgeClassName: string;
    fieldsetClassName: string;
  };
  progress: {
    trackClassName: string;
    fillClassName: string;
  };
  board: {
    gameHeaderClassName: string;
    gameWindowClassName: string;
    gameBodyClassName: string;
    slotShellClassName: string;
    slotMiniCellClassName: string;
    slotRotateButtonClassName: string;
  };
  extended: {
    windows: {
      topWindowClassName: string;
      menuWindowClassName: string;
      modalWindowClassName: string;
      radioGroupClassName: string;
    };
    text: {
      mutedClassName: string;
      tileFaceClassName: string;
      tileNumberClassName: string;
    };
    buttons: {
      exitHomeClassName: string;
      exitCancelClassName: string;
    };
    tabs: {
      leaderboardMode: PremiumUiTabObject;
      leaderboardFilter: PremiumUiTabObject;
      leaderboardEventPeriod: PremiumUiTabObject;
      weeklyEvent: PremiumUiTabObject;
    };
    navigation: {
      taskbarClassName: string;
      taskbarButtonClassName: string;
      taskbarBadgeClassName: string;
      lockToastClassName: string;
      /** 프리미엄 UI 하단 네비 추정 높이 (px). 0이면 기본 테마 높이 사용 */
      navHeightPx: number;
    };
    /** 상태바 (하단 정보 표시 영역) */
    statusBar: {
      containerClassName: string;
      fieldClassName: string;
    };
    /** 폼 레이아웃 (field-row 계열) */
    forms: {
      fieldRowClassName: string;
      fieldRowStackedClassName: string;
    };
    board: {
      boardCellClassName: string;
      boardShellClassName: string;
      ghostValidClassName: string;
      ghostInvalidClassName: string;
    };
  };
}

export interface PremiumUiObjectUsageGuide {
  titles: readonly string[];
  buttons: readonly string[];
  blocks: readonly string[];
  levelTabs: readonly string[];
  skinTabs: readonly string[];
  missionTabs: readonly string[];
  extraReferences?: readonly string[];
}

/**
 * 프리미엄 UI 테마 정의 단위.
 *
 * 런타임 적용 플로우:
 * - SkinCatalogEntry.premiumUiThemeId -> PremiumUiThemeConfig 조회
 * - labels: 텍스트/라벨 미세 오버라이드
 * - objects: UI 오브젝트 클래스 오버라이드
 * - rootClassName/externalStylesheet: 전역 테마 브릿지 적용
 *
 * 중요:
 * - objects.extended는 필수 계약이다.
 *   (누락 시 특정 화면만 스타일이 빠지는 문제를 타입 단계에서 막기 위함)
 */
export interface PremiumUiThemeConfig {
  id: PremiumUiThemeId;
  family: PremiumUiThemeFamily;
  rootClassName: string;
  externalStylesheet?: {
    id: string;
    href: string;
  };
  labels: PremiumUiMicroOverrides;
  objects: PremiumUiObjectMap;
  usageGuide: PremiumUiObjectUsageGuide;
}

// 스킨 카탈로그 항목 (뽑기 가능한 스킨 정의, constants.ts에서 배열로 관리)
export interface SkinCatalogEntry {
  id: string;   // "skin_0", "skin_1" ...
  hex: string;  // 큐레이션 색상 (UI 표시용, 대표 색상)
  category?: SkinCategory;
  nameKey?: string; // i18n key suffix
  style?: SkinStyle; // Advanced styling
  premium?: boolean; // 프리미엄 스킨 (뽑기 확률 절반, 교환 비용 증가)
  premiumUiThemeId?: PremiumUiThemeId; // 프리미엄 UI 스킨 테마 식별자 (버튼/타이틀/탭 등 전체 UI 오버라이드)
  premiumUiOverrides?: PremiumUiMicroOverrides; // 프리미엄 공통 UI의 스킨별 미세 오버라이드
}

// 사용자가 획득한 스킨
export interface SkinItem {
  id: string;          // SkinCatalogEntry.id와 동일
  hex: string;         // 획득 시점의 색상 (Legacy support)
  style?: SkinStyle;   // 획득 시점의 스타일 (For advanced skins)
  acquiredAt: number;  // Date.now() 타임스탬프
}

export interface SkinSettings {
  version: 2;
  ownedSkins: SkinItem[];
  activeSkinId: string | null;
  fragments: number;              // 스킨 조각 (중복 뽑기 시 획득, 교환에 사용)
  scoreMilestoneCredits: number;  // 점수 마일스톤으로 지급된 누적 조각 수 (복구 정합성용)
  daily1024Date: string;          // KST YYYY-MM-DD: 1024타일 보상 당일 날짜
  daily1024Earned: number;        // 당일 1024타일로 얻은 조각 수 (일일 CAP 확인용)
}

// 스킨 뽑기 결과
export type SkinDrawResult =
  | { type: 'new'; skin: SkinItem }
  | { type: 'duplicate'; skin: SkinCatalogEntry; fragmentsEarned: number };
