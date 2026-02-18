import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TutorialTooltip } from './TutorialTooltip';

const STORAGE_KEY = 'tutorial_skin_feature_seen_v1';

interface SkinFeatureTutorialProps {
  isMenuVisible: boolean;
}

export const SkinFeatureTutorial: React.FC<SkinFeatureTutorialProps> = ({ isMenuVisible }) => {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!isMenuVisible) {
        setIsVisible(false);
        return;
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (!hasSeen) {
      const checkBtn = () => {
        const btn = document.getElementById('menu-skin-btn');
        if (btn) {
           setIsVisible(true);
        }
      };
      // Check a few times in case of render delay
      checkBtn();
      const t1 = setTimeout(checkBtn, 200);
      const t2 = setTimeout(checkBtn, 600);
      
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [isMenuVisible]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!isVisible) return null;

  return (
    <TutorialTooltip
      isVisible={isVisible}
      targetId="menu-skin-btn"
      onDismiss={handleDismiss}
      title={t('game:tutorial.skinTitle', '스킨 기능')}
      description={t('game:tutorial.skinDesc', '나만의 블럭 스타일을 꾸며보세요!')}
      forcePlacement="above"
    />
  );
};
