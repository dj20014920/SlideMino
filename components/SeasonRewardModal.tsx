/**
 * 시즌 보상 수령 모달
 * - 앱 시작 시 미수령 보상이 있으면 표시
 * - 난이도별 보상 목록 + 일괄 수령 버튼
 * - 웹 유저는 앱 설치 유도 메시지
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Gift } from 'lucide-react';
import { isNativeApp } from '../utils/platform';
import { useBlockCustomization } from '../context/BlockCustomizationContext';
import type { SeasonReward } from '../services/seasonService';

interface SeasonRewardModalProps {
  open: boolean;
  rewards: SeasonReward[];
  onClaimAll: () => Promise<number>;
  onClose: () => void;
}

const REWARD_LABEL_MAP: Record<string, string> = {
  top1: 'common:season.top1',
  top2: 'common:season.top2',
  top3: 'common:season.top3',
  participant: 'common:season.participant',
};

export const SeasonRewardModal: React.FC<SeasonRewardModalProps> = ({
  open,
  rewards,
  onClaimAll,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [totalClaimed, setTotalClaimed] = useState(0);
  const { isPremiumUiThemeActive, premiumUiObjects } = useBlockCustomization();
  const premiumUiModalOverlayClassName = premiumUiObjects.modalOverlayClassName;
  const premiumUiWindowClassName = premiumUiObjects.windowClassName;
  const premiumUiWindowBodyClassName = premiumUiObjects.windowBodyClassName;
  const premiumUiTitleBarClassName = premiumUiObjects.titleBarClassName;
  const premiumUiTitleBarTextClassName = premiumUiObjects.titleBarTextClassName;
  const premiumUiTitleBarControlsClassName = premiumUiObjects.titleBarControlsClassName;
  const premiumUiListItemClassName = premiumUiObjects.panels.listItemClassName;
  const premiumUiMenuButtonClassName = premiumUiObjects.buttons.menuClassName;
  const premiumUiModalWindowClassName = premiumUiObjects.extended.windows.modalWindowClassName;
  const isPremiumUi = Boolean(isPremiumUiThemeActive);

  if (!open || rewards.length === 0) return null;

  const handleClaim = async () => {
    if (claiming || claimed) return;
    setClaiming(true);
    const total = await onClaimAll();
    setTotalClaimed(total);
    setClaimed(true);
    setClaiming(false);
  };

  const isWeb = !isNativeApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className={isPremiumUi ? `absolute inset-0 ${premiumUiModalOverlayClassName}` : 'absolute inset-0 bg-black/40 backdrop-blur-sm'} onClick={onClose} />
      <div className={isPremiumUi
        ? `${premiumUiWindowClassName} ${premiumUiModalWindowClassName} relative w-full max-w-sm overflow-hidden`
        : 'relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden'}>
        {/* Win98 타이틀 바 / 일반 헤더 */}
        {isPremiumUi ? (
          <div className={premiumUiTitleBarClassName}>
            <div className={premiumUiTitleBarTextClassName}><span className="font-bold">◇</span>{' '}{t('common:season.rewardTitle')}</div>
            <div className={premiumUiTitleBarControlsClassName}>
              <button aria-label="Close" onClick={onClose} />
            </div>
          </div>
        ) : (
          <div className="p-5 pb-3 flex justify-between items-center bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-100">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Gift className="text-amber-500" size={22} />
              {t('common:season.rewardTitle')}
            </h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200/50 text-gray-500">
              <X size={18} />
            </button>
          </div>
        )}

        {/* 보상 목록 */}
        <div className={isPremiumUi ? `${premiumUiWindowBodyClassName} p-3 space-y-3` : 'p-5 space-y-3'}>
          <p className="text-sm text-gray-500">{t('common:season.rewardDesc')}</p>

          {rewards.map((reward, i) => (
            <div
              key={`${reward.season_id}-${reward.difficulty}-${i}`}
              className={isPremiumUi ? `${premiumUiListItemClassName} flex items-center justify-between px-3 py-2` : 'flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3'}
            >
              <div>
                <span className="text-sm font-semibold text-gray-700">
                  {String(t('common:season.difficulty', { size: reward.difficulty } as any))}
                </span>
                <span className="ml-2 text-xs text-gray-500">
                  {t((REWARD_LABEL_MAP[reward.reward_type] ?? 'common:season.participant') as any)}
                </span>
              </div>
              <span className="text-sm font-bold text-amber-600">
                {String(t('common:season.rewardFragments', { count: reward.fragment_amount } as any))}
              </span>
            </div>
          ))}

          {/* 웹 유저: 앱 설치 유도 */}
          {isWeb && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-center">
              <p className="text-sm text-blue-700 font-medium">{t('common:season.rewardWebOnly')}</p>
            </div>
          )}

          {/* 수령 버튼 (네이티브만) */}
          {!isWeb && !claimed && (
            <button
              onClick={handleClaim}
              disabled={claiming}
              className={isPremiumUi
                ? `w-full py-2 px-3 ${premiumUiMenuButtonClassName} text-sm font-semibold disabled:opacity-70`
                : 'w-full py-3 bg-gradient-to-r from-amber-400 to-yellow-400 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50'}
            >
              {claiming ? '...' : t('common:season.rewardClaimAll')}
            </button>
          )}

          {/* 수령 완료 */}
          {claimed && (
            <div className="text-center py-3">
              <p className="text-lg font-bold text-emerald-600">{t('common:season.rewardClaimed')}</p>
              <p className="text-sm text-gray-500">
                {String(t('common:season.rewardFragments', { count: totalClaimed } as any))}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
