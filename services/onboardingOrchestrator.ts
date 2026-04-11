export const ONBOARDING_STORAGE_KEYS = {
  backNavigationSeen: 'tutorial_back_nav_seen_v1',
  gameModeTutorialSeen: 'tutorial_game_mode_seen_v1',
  skinFeatureTutorialSeen: 'tutorial_skin_feature_seen_v1',
  gameFeaturesTutorialSeen: 'tutorial_game_features_seen_v1',
  tutorialCompleted: 'tutorial_completed',
} as const;

export const SKIN_TARGET_POLICY = {
  targetId: 'menu-skin-btn',
  primarySelector: 'button#menu-skin-btn',
  fallbackSelector: '[data-tutorial-anchor="menu-skin-btn"]',
  retryIntervalMs: 250,
  deferredRetryIntervalMs: 1000,
  maxCheckAttempts: 24,
} as const;

export type MenuOnboardingStep = 'none' | 'menu-game-mode' | 'menu-skin-feature';

export interface OnboardingStorageSnapshot {
  backNavigationSeen: boolean;
  gameModeTutorialSeen: boolean;
  skinFeatureTutorialSeen: boolean;
  gameFeaturesTutorialSeen: boolean;
  tutorialCompleted: boolean;
}

export interface MenuTutorialSuppressionInput {
  isNameInputOpen: boolean;
  isCustomizationOpen: boolean;
  isSkinOpen: boolean;
  isLeaderboardOpen: boolean;
  isStreakInfoOpen: boolean;
  isSeasonRewardOpen: boolean;
  isMissionModalOpen: boolean;
  isXpModalOpen: boolean;
  isCalendarOpen: boolean;
  isWeeklyEventModalOpen: boolean;
  isActiveGameExitModalOpen: boolean;
  showFirstSkinRewardModal: boolean;
}

export interface GameplayTutorialBlockInput {
  isPlayingState: boolean;
  showHelpModal: boolean;
  showFirstSkinRewardModal: boolean;
}

export interface MenuOnboardingDecisionInput extends MenuTutorialSuppressionInput {
  isMenuState: boolean;
  hasSeenFirstSkinRewardFlow: boolean;
  storageSnapshot?: OnboardingStorageSnapshot;
}

export interface OnboardingViewModelInput extends MenuOnboardingDecisionInput, GameplayTutorialBlockInput {}

export interface OnboardingViewModel {
  storageSnapshot: OnboardingStorageSnapshot;
  menuTutorialSuppressed: boolean;
  menuStep: MenuOnboardingStep;
  gameplayTutorialBlocked: boolean;
}

const readStorageFlag = (key: string): boolean => {
  try {
    return Boolean(localStorage.getItem(key));
  } catch {
    return false;
  }
};

export const readOnboardingStorageSnapshot = (): OnboardingStorageSnapshot => ({
  backNavigationSeen: readStorageFlag(ONBOARDING_STORAGE_KEYS.backNavigationSeen),
  gameModeTutorialSeen: readStorageFlag(ONBOARDING_STORAGE_KEYS.gameModeTutorialSeen),
  skinFeatureTutorialSeen: readStorageFlag(ONBOARDING_STORAGE_KEYS.skinFeatureTutorialSeen),
  gameFeaturesTutorialSeen: readStorageFlag(ONBOARDING_STORAGE_KEYS.gameFeaturesTutorialSeen),
  tutorialCompleted: readStorageFlag(ONBOARDING_STORAGE_KEYS.tutorialCompleted),
});

export const isEarlyOnboardingCompleted = (
  storageSnapshot?: OnboardingStorageSnapshot
): boolean => {
  if (storageSnapshot) return storageSnapshot.tutorialCompleted;
  return readOnboardingStorageSnapshot().tutorialCompleted;
};

export const isMenuTutorialSuppressed = (input: MenuTutorialSuppressionInput): boolean =>
  input.isNameInputOpen ||
  input.isCustomizationOpen ||
  input.isSkinOpen ||
  input.isLeaderboardOpen ||
  input.isStreakInfoOpen ||
  input.isSeasonRewardOpen ||
  input.isMissionModalOpen ||
  input.isXpModalOpen ||
  input.isCalendarOpen ||
  input.isWeeklyEventModalOpen ||
  input.isActiveGameExitModalOpen ||
  input.showFirstSkinRewardModal;

export const decideMenuOnboardingStep = (
  input: MenuOnboardingDecisionInput
): MenuOnboardingStep => {
  if (!input.isMenuState) return 'none';

  const menuTutorialSuppressed = isMenuTutorialSuppressed(input);
  if (menuTutorialSuppressed) return 'none';

  const snapshot = input.storageSnapshot ?? readOnboardingStorageSnapshot();

  if (!snapshot.gameModeTutorialSeen) {
    return 'menu-game-mode';
  }

  if (input.hasSeenFirstSkinRewardFlow && !snapshot.skinFeatureTutorialSeen) {
    return 'menu-skin-feature';
  }

  return 'none';
};

export const isGameplayTutorialBlocked = (input: GameplayTutorialBlockInput): boolean =>
  !input.isPlayingState ||
  input.showHelpModal ||
  input.showFirstSkinRewardModal;

export const buildOnboardingViewModel = (
  input: OnboardingViewModelInput
): OnboardingViewModel => {
  const storageSnapshot = input.storageSnapshot ?? readOnboardingStorageSnapshot();
  const menuTutorialSuppressed = isMenuTutorialSuppressed(input);
  const gameplayTutorialBlocked = isGameplayTutorialBlocked(input);
  const menuStep = decideMenuOnboardingStep({
    ...input,
    storageSnapshot,
  });

  return {
    storageSnapshot,
    menuTutorialSuppressed,
    menuStep,
    gameplayTutorialBlocked,
  };
};

export const clearOnboardingProgress = (): void => {
  try {
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.backNavigationSeen);
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.gameModeTutorialSeen);
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.skinFeatureTutorialSeen);
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.gameFeaturesTutorialSeen);
    localStorage.removeItem(ONBOARDING_STORAGE_KEYS.tutorialCompleted);
  } catch {
    // noop
  }
};
