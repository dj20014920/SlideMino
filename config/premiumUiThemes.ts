import type {
  PremiumUiObjectMap,
  PremiumUiThemeConfig,
  PremiumUiThemeId,
  PremiumUiMicroOverrides,
} from '../types';

/**
 * 프리미엄 UI 테마 카탈로그.
 *
 * 새 프리미엄 테마를 추가할 때 체크리스트:
 * 1) types.ts의 PremiumUiThemeFamily/PremiumUiThemeId union 확장
 * 2) SkinCatalogEntry.premiumUiThemeId에 새 id 연결
 * 3) PremiumUiThemeConfig 객체(라벨 + objects 전체 슬롯) 작성
 * 4) PREMIUM_UI_THEME_BY_ID에 등록
 * 5) usageGuide에 실제 연결 컴포넌트 레퍼런스 기록
 *
 * 주의:
 * - objects 슬롯은 컴포넌트가 참조하는 "UI 오브젝트 계약"이므로, 비워두지 않는다.
 * - 기본 UI는 DEFAULT_PREMIUM_UI_OBJECTS(빈 클래스 계약)로 동작하고,
 *   각 프리미엄 스킨이 필요한 슬롯만 오버라이드한다.
 */
export const DEFAULT_PREMIUM_UI_OBJECTS: PremiumUiObjectMap = {
  appShellClassName: '',
  modalOverlayClassName: '',
  windowClassName: '',
  windowBodyClassName: '',
  titleBarClassName: '',
  titleBarTextClassName: '',
  titleBarControlsClassName: '',
  blockClassName: '',
  buttons: {
    menuClassName: '',
    gameClassName: '',
    iconClassName: '',
    pillClassName: '',
    headerMainClassName: '',
    headerIconClassName: '',
    headerActionClassName: '',
    compartmentClassName: '',
  },
  tabs: {
    level: { containerClassName: '', buttonClassName: '' },
    skin: { containerClassName: '', buttonClassName: '' },
    mission: { containerClassName: '', buttonClassName: '' },
  },
  panels: {
    sunkenClassName: '',
    sunkenWhiteClassName: '',
    listItemClassName: '',
    listItemHighlightClassName: '',
    badgeClassName: '',
    fieldsetClassName: '',
  },
  progress: {
    trackClassName: '',
    fillClassName: '',
  },
  board: {
    gameHeaderClassName: '',
    gameWindowClassName: '',
    gameBodyClassName: '',
    slotShellClassName: '',
    slotMiniCellClassName: '',
    slotRotateButtonClassName: '',
  },
  extended: {
    windows: {
      topWindowClassName: '',
      menuWindowClassName: '',
      modalWindowClassName: '',
      radioGroupClassName: '',
    },
    text: {
      mutedClassName: '',
      tileFaceClassName: '',
      tileNumberClassName: '',
    },
    buttons: {
      exitHomeClassName: '',
      exitCancelClassName: '',
    },
    tabs: {
      leaderboardMode: { containerClassName: '', buttonClassName: '' },
      leaderboardFilter: { containerClassName: '', buttonClassName: '' },
      leaderboardEventPeriod: { containerClassName: '', buttonClassName: '' },
      weeklyEvent: { containerClassName: '', buttonClassName: '' },
    },
    navigation: {
      taskbarWrapperClassName: '',
      taskbarClassName: '',
      taskbarButtonClassName: '',
      taskbarBadgeClassName: '',
      lockToastClassName: '',
      navHeightPx: 0,
    },
    statusBar: {
      containerClassName: '',
      fieldClassName: '',
    },
    forms: {
      fieldRowClassName: '',
      fieldRowStackedClassName: '',
    },
    board: {
      boardCellClassName: '',
      boardShellClassName: '',
      ghostValidClassName: '',
      ghostInvalidClassName: '',
    },
  },
};

export const DEFAULT_PREMIUM_UI_LABELS: PremiumUiMicroOverrides = {
  topWindowTitle: '블록 슬라이드\n(Block Slide)',
  menuWindowTitle: '난이도 선택',
  difficultyLegend: '난이도 선택 메뉴',
  utilityLegend: '메뉴',
  languageLegend: '언어',
  gameWindowTitle: 'Game...',
  statusBarText: 'Block Slide',
  statusBarVersion: 'v1.0',
};

const SHARED_PREMIUM_UI_USAGE_GUIDE: PremiumUiThemeConfig['usageGuide'] = {
  titles: [
    'App 상단 타이틀 윈도우',
    'App 게임 화면 상단 타이틀 바',
    'MissionModal 헤더 타이틀',
    'SkinModal 헤더 타이틀',
    'Leaderboard/WeeklyEvent/Calendar 헤더 타이틀',
    'GameOver/NameInput/SeasonReward/Streak/XpLevel/ActiveGameExit 헤더 타이틀',
  ],
  buttons: [
    'App 메뉴 버튼/헤더 버튼/게임 액션 버튼',
    'MissionModal 보상/재굴림 버튼',
    'SkinModal 구매/뽑기/닫기 버튼',
    '공통 모달 액션 버튼',
    'ActiveGameExit 홈 종료/취소/등록 버튼',
    'WeeklyEvent 시작/이어하기/광고해금 버튼',
  ],
  blocks: [
    'Board 배경/블록 컨테이너',
    'Slot 프리뷰 셀',
    'SkinPreviewTile 타일 프리뷰',
    'Calendar 카드/요약 블록',
    'Leaderboard/WeeklyEvent 리스트 블록',
  ],
  levelTabs: [
    'App 난이도(레벨) 선택 탭/섹션',
    'Leaderboard 모드 탭(확장 대상)',
    'WeeklyEvent 이번주/지난주 탭',
  ],
  skinTabs: [
    'SkinModal 섹션 탭(프리미엄/메쉬/일반)',
    'SkinModal 선택행 프리뷰 탭 확장 영역',
  ],
  missionTabs: [
    'MissionModal 일일/주간 탭',
    'WeeklyEvent 이번주/지난주 탭',
    'Leaderboard 이벤트 기간 탭',
  ],
  extraReferences: [
    'Board.tsx: board-shell/board-cell/tile-face/tile-number/ghost-valid/ghost-invalid',
    'Slot.tsx: slot-shell/slot-mini-cell/slot-rotate-button',
    'BottomNavBar.tsx: 프리미엄 하단 내비게이션 스타일 블록',
    'GameOverModal.tsx: modal-overlay/sunken/list panel',
    'ActiveGameExitModal.tsx: menu-btn/exit-home/exit-cancel',
    'StreakInfoModal.tsx: modal-overlay/sunken/list-item',
    'SeasonRewardModal.tsx: modal-overlay/list-item',
    'NameInputModal.tsx: modal-overlay/window-body',
    'XpLevelModal.tsx: modal-overlay/sunken/progress/badge',
    'HelpModal.tsx: modal-overlay/sunken/badge',
    'BlockCustomizationModal.tsx: tile-face/tile-number/window',
    'SkinAcquisitionOverlay.tsx: tile-face/tile-number',
    'SquareImageCropperModal.tsx: cropper window container',
    'CookieConsent.tsx: consent banner surface/window',
    'CalendarModal.tsx: modal-overlay/sunken/sunken-white/badge',
    'LeaderboardModal.tsx: modal-overlay/tabstrip/list/sunken',
    'WeeklyEventModal.tsx: modal-overlay/tabstrip/list/sunken/badge',
  ],
};

export const RETRO_WINDOWS_98_PREMIUM_UI_THEME: PremiumUiThemeConfig = {
  id: 'retro_windows_98',
  family: 'win98',
  rootClassName: 'theme-win98',
  externalStylesheet: {
    id: 'slidemino-win98-theme-link',
    href: '/vendor/98css/style.css',
  },
  labels: {
    ...DEFAULT_PREMIUM_UI_LABELS,
    statusBarText: 'SlideMino 98',
    statusBarVersion: 'v1.1',
  },
  objects: {
    appShellClassName: 'win98-app-shell',
    modalOverlayClassName: 'win98-modal-overlay',
    windowClassName: 'window',
    windowBodyClassName: 'window-body',
    titleBarClassName: 'title-bar',
    titleBarTextClassName: 'title-bar-text',
    titleBarControlsClassName: 'title-bar-controls',
    blockClassName: 'win98-board-shell',
    buttons: {
      menuClassName: 'win98-menu-btn',
      gameClassName: 'win98-game-btn',
      iconClassName: 'win98-icon-btn',
      pillClassName: 'win98-pill-btn',
      headerMainClassName: 'win98-header-main-btn',
      headerIconClassName: 'win98-header-icon-btn',
      headerActionClassName: 'win98-header-action-btn',
      compartmentClassName: 'win98-compartment',
    },
    tabs: {
      level: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
      skin: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
      mission: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
    },
    panels: {
      sunkenClassName: 'win98-sunken',
      sunkenWhiteClassName: 'win98-sunken-white',
      listItemClassName: 'win98-list-item',
      listItemHighlightClassName: 'win98-list-item-highlight',
      badgeClassName: 'win98-badge',
      fieldsetClassName: 'win98-fieldset',
    },
    progress: {
      trackClassName: 'win98-progress-track',
      fillClassName: 'win98-progress-fill',
    },
    board: {
      gameHeaderClassName: 'win98-game-header',
      gameWindowClassName: 'win98-game-board-window',
      gameBodyClassName: 'win98-board-body',
      slotShellClassName: 'win98-slot-shell',
      slotMiniCellClassName: 'win98-tile-face',
      slotRotateButtonClassName: 'win98-slot-rotate-btn',
    },
    extended: {
      windows: {
        topWindowClassName: 'win98-top-window',
        menuWindowClassName: 'win98-menu-window',
        modalWindowClassName: 'win98-window',
        radioGroupClassName: 'win98-radio-group',
      },
      text: {
        mutedClassName: 'win98-muted',
        tileFaceClassName: 'win98-tile-face',
        tileNumberClassName: 'win98-tile-number',
      },
      buttons: {
        exitHomeClassName: 'win98-exit-home-btn',
        exitCancelClassName: 'win98-exit-cancel-btn',
      },
      tabs: {
        leaderboardMode: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
        leaderboardFilter: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
        leaderboardEventPeriod: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
        weeklyEvent: { containerClassName: 'win98-tabstrip', buttonClassName: 'win98-tabstrip-tab' },
      },
      navigation: {
        taskbarWrapperClassName: 'win98-nav-wrapper',
        taskbarClassName: 'win98-bottom-nav',
        taskbarButtonClassName: 'win98-bottom-nav-button',
        taskbarBadgeClassName: 'win98-bottom-nav-badge',
        lockToastClassName: 'win98-lock-toast',
        navHeightPx: 32,
      },
      statusBar: {
        containerClassName: 'status-bar',
        fieldClassName: 'status-bar-field',
      },
      forms: {
        fieldRowClassName: 'field-row',
        fieldRowStackedClassName: 'field-row-stacked',
      },
      board: {
        boardCellClassName: 'win98-board-cell',
        boardShellClassName: 'win98-board-shell',
        ghostValidClassName: 'win98-ghost-valid',
        ghostInvalidClassName: 'win98-ghost-invalid',
      },
    },
  },
  usageGuide: SHARED_PREMIUM_UI_USAGE_GUIDE,
};

export const EXPLORE_GALAXY_PREMIUM_UI_THEME: PremiumUiThemeConfig = {
  id: 'explore_galaxy',
  family: 'explore_galaxy',
  rootClassName: 'theme-explore-galaxy',
  labels: {
    ...DEFAULT_PREMIUM_UI_LABELS,
    topWindowTitle: '은하 탐험\n(Explore Galaxy)',
    menuWindowTitle: '난이도 선택',
    difficultyLegend: '난이도 선택 메뉴',
    utilityLegend: '메뉴',
    languageLegend: '언어',
    gameWindowTitle: '탐험 중...',
    statusBarText: 'Galaxy Explorer',
    statusBarVersion: 'v∞',
  },
  objects: {
    appShellClassName: 'galaxy-app-shell',
    modalOverlayClassName: 'galaxy-modal-overlay',
    windowClassName: 'galaxy-window',
    windowBodyClassName: 'galaxy-window-body',
    titleBarClassName: 'galaxy-title-bar',
    titleBarTextClassName: 'galaxy-title-bar-text',
    titleBarControlsClassName: 'galaxy-title-bar-controls',
    blockClassName: 'galaxy-board-shell',
    buttons: {
      menuClassName: 'galaxy-menu-btn',
      gameClassName: 'galaxy-game-btn',
      iconClassName: 'galaxy-icon-btn',
      pillClassName: 'galaxy-pill-btn',
      headerMainClassName: 'galaxy-header-main-btn',
      headerIconClassName: 'galaxy-header-icon-btn',
      headerActionClassName: 'galaxy-header-action-btn',
      compartmentClassName: 'galaxy-compartment',
    },
    tabs: {
      level: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
      skin: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
      mission: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
    },
    panels: {
      sunkenClassName: 'galaxy-sunken',
      sunkenWhiteClassName: 'galaxy-sunken-white',
      listItemClassName: 'galaxy-list-item',
      listItemHighlightClassName: 'galaxy-list-item-highlight',
      badgeClassName: 'galaxy-badge',
      fieldsetClassName: 'galaxy-fieldset',
    },
    progress: {
      trackClassName: 'galaxy-progress-track',
      fillClassName: 'galaxy-progress-fill',
    },
    board: {
      gameHeaderClassName: 'galaxy-game-header',
      gameWindowClassName: 'galaxy-game-board-window',
      gameBodyClassName: 'galaxy-board-body',
      slotShellClassName: 'galaxy-slot-shell',
      slotMiniCellClassName: 'galaxy-slot-mini-cell',
      slotRotateButtonClassName: 'galaxy-slot-rotate-btn',
    },
    extended: {
      windows: {
        topWindowClassName: 'galaxy-top-window',
        menuWindowClassName: 'galaxy-menu-window',
        modalWindowClassName: 'galaxy-window',
        radioGroupClassName: 'galaxy-radio-group',
      },
      text: {
        mutedClassName: 'galaxy-muted',
        tileFaceClassName: 'galaxy-tile-face',
        tileNumberClassName: 'galaxy-tile-number',
      },
      buttons: {
        exitHomeClassName: 'galaxy-exit-home-btn',
        exitCancelClassName: 'galaxy-exit-cancel-btn',
      },
      tabs: {
        leaderboardMode: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
        leaderboardFilter: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
        leaderboardEventPeriod: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
        weeklyEvent: { containerClassName: 'galaxy-tabstrip', buttonClassName: 'galaxy-tabstrip-tab' },
      },
      navigation: {
        taskbarWrapperClassName: 'galaxy-nav-wrapper',
        taskbarClassName: 'galaxy-bottom-nav',
        taskbarButtonClassName: 'galaxy-bottom-nav-button',
        taskbarBadgeClassName: 'galaxy-bottom-nav-badge',
        lockToastClassName: 'galaxy-lock-toast',
        navHeightPx: 52,
      },
      statusBar: {
        containerClassName: 'galaxy-status-bar',
        fieldClassName: 'galaxy-status-bar-field',
      },
      forms: {
        fieldRowClassName: 'galaxy-field-row',
        fieldRowStackedClassName: 'galaxy-field-row-stacked',
      },
      board: {
        boardCellClassName: 'galaxy-board-cell',
        boardShellClassName: 'galaxy-board-shell',
        ghostValidClassName: 'galaxy-ghost-valid',
        ghostInvalidClassName: 'galaxy-ghost-invalid',
      },
    },
  },
  usageGuide: SHARED_PREMIUM_UI_USAGE_GUIDE,
};

export const PIXELBLAST_VOID_PREMIUM_UI_THEME: PremiumUiThemeConfig = {
  ...EXPLORE_GALAXY_PREMIUM_UI_THEME,
  id: 'pixelblast_void',
  family: 'pixelblast',
  rootClassName: 'theme-pixelblast',
  labels: {
    ...DEFAULT_PREMIUM_UI_LABELS,
    topWindowTitle: '픽셀 블라스트\n(Pixel Blast)',
    menuWindowTitle: '난이도 선택',
    difficultyLegend: '난이도 선택 메뉴',
    utilityLegend: '메뉴',
    languageLegend: '언어',
    gameWindowTitle: 'Pixel Blast',
    statusBarText: 'Pixel Blast',
    statusBarVersion: 'v1.0',
  },
  objects: {
    ...EXPLORE_GALAXY_PREMIUM_UI_THEME.objects,
    appShellClassName: 'pixelblast-app-shell',
    extended: {
      ...EXPLORE_GALAXY_PREMIUM_UI_THEME.objects.extended,
      navigation: {
        ...EXPLORE_GALAXY_PREMIUM_UI_THEME.objects.extended.navigation,
        taskbarWrapperClassName: 'pixelblast-nav-wrapper',
        taskbarClassName: 'pixelblast-bottom-nav',
        taskbarButtonClassName: 'pixelblast-bottom-nav-button',
        taskbarBadgeClassName: 'pixelblast-bottom-nav-badge',
        lockToastClassName: 'pixelblast-lock-toast',
      },
    },
  },
};

/**
 * 런타임 조회용 인덱스.
 * - 실제 적용은 context/BlockCustomizationContext.tsx에서 수행한다.
 * - 여기서 id가 누락되면 premiumUiThemeId를 설정해도 활성화되지 않는다.
 */
export const NEON_CORTEX_PREMIUM_UI_THEME: PremiumUiThemeConfig = {
  id: 'neon_cortex',
  family: 'neon_cortex',
  rootClassName: 'theme-neon-cortex',
  labels: {
    ...DEFAULT_PREMIUM_UI_LABELS,
    topWindowTitle: '네온 코텍스\n(Neon Cortex)',
    menuWindowTitle: '인터페이스 접속',
    difficultyLegend: '신경망 난이도',
    utilityLegend: '유틸리티',
    languageLegend: '언어',
    gameWindowTitle: '시스템 활성화',
    statusBarText: 'Neon Cortex v2.0',
    statusBarVersion: 'rev. cyber',
  },
  objects: {
    appShellClassName: 'cortex-app-shell',
    modalOverlayClassName: 'cortex-modal-overlay',
    windowClassName: 'cortex-window',
    windowBodyClassName: 'cortex-window-body',
    titleBarClassName: 'cortex-title-bar',
    titleBarTextClassName: 'cortex-title-bar-text',
    titleBarControlsClassName: 'cortex-title-bar-controls',
    blockClassName: 'cortex-board-shell',
    buttons: {
      menuClassName: 'cortex-menu-btn',
      gameClassName: 'cortex-game-btn',
      iconClassName: 'cortex-icon-btn',
      pillClassName: 'cortex-pill-btn',
      headerMainClassName: 'cortex-header-main-btn',
      headerIconClassName: 'cortex-header-icon-btn',
      headerActionClassName: 'cortex-header-action-btn',
      compartmentClassName: 'cortex-compartment',
    },
    tabs: {
      level: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
      skin: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
      mission: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
    },
    panels: {
      sunkenClassName: 'cortex-sunken',
      sunkenWhiteClassName: 'cortex-sunken-white',
      listItemClassName: 'cortex-list-item',
      listItemHighlightClassName: 'cortex-list-item-highlight',
      badgeClassName: 'cortex-badge',
      fieldsetClassName: 'cortex-fieldset',
    },
    progress: {
      trackClassName: 'cortex-progress-track',
      fillClassName: 'cortex-progress-fill',
    },
    board: {
      gameHeaderClassName: 'cortex-game-header',
      gameWindowClassName: 'cortex-game-board-window',
      gameBodyClassName: 'cortex-board-body',
      slotShellClassName: 'cortex-slot-shell',
      slotMiniCellClassName: 'cortex-slot-mini-cell',
      slotRotateButtonClassName: 'cortex-slot-rotate-btn',
    },
    extended: {
      windows: {
        topWindowClassName: 'cortex-top-window',
        menuWindowClassName: 'cortex-menu-window',
        modalWindowClassName: 'cortex-window',
        radioGroupClassName: 'cortex-radio-group',
      },
      text: {
        mutedClassName: 'cortex-muted',
        tileFaceClassName: 'cortex-tile-face',
        tileNumberClassName: 'cortex-tile-number',
      },
      buttons: {
        exitHomeClassName: 'cortex-exit-home-btn',
        exitCancelClassName: 'cortex-exit-cancel-btn',
      },
      tabs: {
        leaderboardMode: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
        leaderboardFilter: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
        leaderboardEventPeriod: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
        weeklyEvent: { containerClassName: 'cortex-tabstrip', buttonClassName: 'cortex-tabstrip-tab' },
      },
      navigation: {
        taskbarWrapperClassName: 'cortex-nav-wrapper',
        taskbarClassName: 'cortex-bottom-nav',
        taskbarButtonClassName: 'cortex-bottom-nav-button',
        taskbarBadgeClassName: 'cortex-bottom-nav-badge',
        lockToastClassName: 'cortex-lock-toast',
        navHeightPx: 48,
      },
      statusBar: {
        containerClassName: 'cortex-status-bar',
        fieldClassName: 'cortex-status-bar-field',
      },
      forms: {
        fieldRowClassName: 'cortex-field-row',
        fieldRowStackedClassName: 'cortex-field-row-stacked',
      },
      board: {
        boardCellClassName: 'cortex-board-cell',
        boardShellClassName: 'cortex-board-shell',
        ghostValidClassName: 'cortex-ghost-valid',
        ghostInvalidClassName: 'cortex-ghost-invalid',
      },
    },
  },
  usageGuide: SHARED_PREMIUM_UI_USAGE_GUIDE,
};

const PREMIUM_UI_THEME_BY_ID: Record<PremiumUiThemeId, PremiumUiThemeConfig> = {
  retro_windows_98: RETRO_WINDOWS_98_PREMIUM_UI_THEME,
  explore_galaxy: EXPLORE_GALAXY_PREMIUM_UI_THEME,
  pixelblast_void: PIXELBLAST_VOID_PREMIUM_UI_THEME,
  neon_cortex: NEON_CORTEX_PREMIUM_UI_THEME,
};

export const PREMIUM_UI_THEMES: readonly PremiumUiThemeConfig[] = Object.freeze(
  Object.values(PREMIUM_UI_THEME_BY_ID)
);

export const getPremiumUiThemeById = (
  themeId: PremiumUiThemeId | null | undefined
): PremiumUiThemeConfig | null => {
  if (!themeId) return null;
  return PREMIUM_UI_THEME_BY_ID[themeId] ?? null;
};
