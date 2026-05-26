import React from 'react';
import type { PremiumUiThemeId } from '../types';

interface PetDecorProps {
  themeId: PremiumUiThemeId;
}

/**
 * 1. 홈 버튼 및 기능 버튼들의 뾰족 고양이 귀 테두리 데코레이터
 */
export const PetButtonFrame: React.FC<PetDecorProps & { children: React.ReactNode }> = ({ themeId, children }) => {
  const isDog = themeId === 'cute_dog';
  const isWhite = themeId === 'cute_white_cat';
  
  // 테마별 색상 결정
  const borderColor = isDog ? '#5c3d24' : isWhite ? '#121212' : '#E7C6A0';
  
  return (
    <div className="relative inline-block" style={{ imageRendering: 'pixelated' }}>
      {/* 뾰족 귀 (강아지는 살짝 처진 귀) SVG */}
      <svg className="absolute -top-[8px] left-0 right-0 h-[10px] w-full" viewBox="0 0 40 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        {isDog ? (
          <>
            {/* 처진 강아지 귀 */}
            <path d="M 2 2 h 6 v 2 h -6 z M 32 2 h 6 v 2 h -6 z" fill={borderColor} />
            <path d="M 1 4 h 8 v 3 h -8 z M 31 4 h 8 v 3 h -8 z" fill={borderColor} />
          </>
        ) : (
          <>
            {/* 고양이 뾰족 귀 */}
            <path d="M 4 8 L 8 2 L 12 8 Z M 28 8 L 32 2 L 36 8 Z" fill={borderColor} />
          </>
        )}
      </svg>
      {/* 버튼 본체 */}
      <div style={{ border: `4px solid ${borderColor}`, background: 'var(--pet-bg)' }}>
        {children}
      </div>
    </div>
  );
};

/**
 * 2. '블록 배치' 타이틀바 양옆 수염 + 귀 장식 데코레이션
 */
export const PetHeaderTitleDecor: React.FC<PetDecorProps & { titleText: string }> = ({ themeId, titleText }) => {
  const isDog = themeId === 'cute_dog';
  const isWhite = themeId === 'cute_white_cat';
  const color = isDog ? '#5c3d24' : isWhite ? '#121212' : '#E7C6A0';
  const accentColor = 'var(--pet-accent-mint)';

  return (
    <div className="flex flex-col items-center select-none" style={{ imageRendering: 'pixelated', fontFamily: 'DungGeunMo, monospace' }}>
      {/* 고양이 귀 */}
      <svg className="w-20 h-4" viewBox="0 0 80 16" fill="none">
        {isDog ? (
          <>
            <rect x="10" y="4" width="12" height="8" fill={color} />
            <rect x="58" y="4" width="12" height="8" fill={color} />
          </>
        ) : (
          <>
            <path d="M 12 16 L 20 4 L 28 16 Z" fill={color} />
            <path d="M 52 16 L 60 4 L 68 16 Z" fill={color} />
          </>
        )}
      </svg>
      {/* 타이틀 박스 (수염 장식 포함) */}
      <div className="flex items-center gap-2 px-6 py-2 relative" style={{ border: `4px solid ${color}`, background: 'var(--pet-bg)' }}>
        {/* 좌측 수염 (3줄 도트) */}
        <div className="absolute -left-5 flex flex-col gap-1">
          <div className="w-4 h-1" style={{ background: color }} />
          <div className="w-5 h-1" style={{ background: color }} />
          <div className="w-3 h-1" style={{ background: color }} />
        </div>

        <span className="text-base font-extrabold tracking-wider" style={{ color: accentColor }}>
          {titleText}
        </span>

        {/* 우측 수염 (3줄 도트) */}
        <div className="absolute -right-5 flex flex-col gap-1 items-end">
          <div className="w-4 h-1" style={{ background: color }} />
          <div className="w-5 h-1" style={{ background: color }} />
          <div className="w-3 h-1" style={{ background: color }} />
        </div>
      </div>
    </div>
  );
};

/**
 * 3. 퍼즐 보드를 덮는 거대 얼굴 프레임 (이마 표정 + 귀 + 수염)
 */
export const PetGridFrameDecor: React.FC<PetDecorProps & { children: React.ReactNode }> = ({ themeId, children }) => {
  const isDog = themeId === 'cute_dog';
  const isWhite = themeId === 'cute_white_cat';
  const color = isDog ? '#5c3d24' : isWhite ? '#121212' : '#E7C6A0';
  const cellBg = 'var(--pet-cell-bg)';
  const borderVar = 'var(--pet-border)';

  return (
    <div className="relative w-full h-full flex flex-col items-center" style={{ imageRendering: 'pixelated' }}>
      {/* 1. 상단 뾰족 귀 & 이마 표정 SVGs */}
      <div className="w-full flex justify-between px-8 -mb-[2px] z-10">
        {/* 왼쪽 귀 */}
        <svg className="w-16 h-8" viewBox="0 0 64 32" fill="none">
          {isDog ? (
            <path d="M 0 32 H 48 V 8 H 24 L 0 32 Z" fill={color} />
          ) : (
            <path d="M 0 32 L 32 0 L 64 32 Z" fill={color} />
          )}
        </svg>

        {/* 이마 표정 (= + . + =) */}
        <div className="flex items-center gap-1.5 px-4 h-8 select-none" style={{ fontFamily: 'DungGeunMo, monospace', fontSize: '15px', color: color, fontWeight: 'bold' }}>
          <span>=</span>
          <span>{isDog ? '•' : '+'}</span>
          <span>{isDog ? '◡' : '.'}</span>
          <span>{isDog ? '•' : '+'}</span>
          <span>=</span>
        </div>

        {/* 오른쪽 귀 */}
        <svg className="w-16 h-8" viewBox="0 0 64 32" fill="none">
          {isDog ? (
            <path d="M 64 32 H 16 V 8 H 40 L 64 32 Z" fill={color} />
          ) : (
            <path d="M 0 32 L 32 0 L 64 32 Z" fill={color} />
          )}
        </svg>
      </div>

      {/* 2. 퍼즐 보드 프레임 (좌우 3줄 수염 데코 포함) */}
      <div className="relative w-full p-2" style={{ border: `4px solid ${color}`, background: cellBg, boxShadow: '0 8px 0 rgba(0,0,0,0.25)' }}>
        {/* 좌측 수염 */}
        <div className="absolute top-1/4 -left-5 flex flex-col gap-1.5 z-20">
          <div className="w-4 h-1.5" style={{ background: color }} />
          <div className="w-6 h-1.5" style={{ background: color }} />
          <div className="w-3 h-1.5" style={{ background: color }} />
        </div>

        {/* 우측 수염 */}
        <div className="absolute top-1/4 -right-5 flex flex-col gap-1.5 items-end z-20">
          <div className="w-4 h-1.5" style={{ background: color }} />
          <div className="w-6 h-1.5" style={{ background: color }} />
          <div className="w-3 h-1.5" style={{ background: color }} />
        </div>

        {/* 그리드 내용물 */}
        <div className="w-full h-full">
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * 4. 최하단 배너 위에 머리를 얹고 앞발(솜방망이)을 올린 빼꼼 고양이/강아지 데코레이터
 */
export const PetBottomBannerDecor: React.FC<PetDecorProps> = ({ themeId }) => {
  const isDog = themeId === 'cute_dog';
  const isWhite = themeId === 'cute_white_cat';
  const isBlack = themeId === 'cute_black_cat';
  
  // 톤 매치 컬러 바인딩
  const petColor = isBlack ? '#18181A' : isWhite ? '#FFFFFF' : '#d7ccc8';
  const borderColor = isDog ? '#5c3d24' : isWhite ? '#121212' : '#E7C6A0';
  const eyeColor = isBlack ? '#FFFFFF' : '#121212';
  const blushColor = '#FF8A8A';
  const mintColor = 'var(--pet-accent-mint)';
  const redColor = 'var(--pet-accent-red)';

  return (
    <div className="relative w-full h-24 mt-6 border-t-4" style={{ borderColor: borderColor, background: '#1d1d20', imageRendering: 'pixelated' }}>
      
      {/* ── 배너 위 빼꼼 펫 2마리 ── */}
      
      {/* 1) 좌측 빼꼼 고양이/강아지 */}
      <div className="absolute -top-[36px] left-6 w-20 h-10 overflow-visible flex flex-col justify-end z-20">
        {/* 귀와 얼굴 실루엣 */}
        <svg className="w-16 h-10" viewBox="0 0 64 40" fill="none">
          {isDog ? (
            /* 강아지 얼굴 및 쳐진 귀 */
            <>
              <path d="M 8 16 H 56 V 40 H 8 Z" fill={petColor} />
              {/* 왼쪽 귀 */}
              <path d="M 4 16 h 8 v 12 h -8 z" fill="#8d6e63" />
              {/* 오른쪽 귀 */}
              <path d="M 52 16 h 8 v 12 h -8 z" fill="#8d6e63" />
              {/* 눈동자 */}
              <rect x="22" y="24" width="4" height="4" fill={eyeColor} />
              <rect x="38" y="24" width="4" height="4" fill={eyeColor} />
              {/* 코 */}
              <rect x="30" y="28" width="4" height="3" fill="#000000" />
            </>
          ) : (
            /* 고양이 얼굴 및 뾰족 귀 */
            <>
              <path d="M 12 20 H 52 V 40 H 12 Z" fill={petColor} />
              {/* 귀 */}
              <path d="M 12 20 L 20 8 L 28 20 Z" fill={petColor} />
              <path d="M 36 20 L 44 8 L 52 20 Z" fill={petColor} />
              {/* 눈 (+) */}
              <path d="M 18 24 h 6 M 21 21 v 6" stroke={eyeColor} strokeWidth="1.5" />
              <path d="M 40 24 h 6 M 43 21 v 6" stroke={eyeColor} strokeWidth="1.5" />
              {/* 코 (.) */}
              <rect x="31" y="26" width="2" height="2" fill={borderColor} />
              {/* 볼터치 (..) */}
              <rect x="16" y="28" width="3" height="2" fill={blushColor} />
              <rect x="45" y="28" width="3" height="2" fill={blushColor} />
            </>
          )}
        </svg>

        {/* 솜방망이 앞발 */}
        <div className="absolute -bottom-1 left-2 flex gap-6 z-30">
          <div className="w-4 h-3 rounded-t" style={{ background: borderColor, border: `2px solid ${borderColor}`, borderBottom: 'none' }} />
          <div className="w-4 h-3 rounded-t" style={{ background: borderColor, border: `2px solid ${borderColor}`, borderBottom: 'none' }} />
        </div>
      </div>

      {/* 2) 우측 빼꼼 고양이 (눈을 질끈 감은 엑스/주황 불꽃 포인트) */}
      <div className="absolute -top-[36px] right-8 w-20 h-10 overflow-visible flex flex-col justify-end z-20">
        {/* 귀와 얼굴 실루엣 */}
        <svg className="w-16 h-10" viewBox="0 0 64 40" fill="none">
          {isDog ? (
            /* 오른쪽 멍멍이 */
            <>
              <path d="M 8 16 H 56 V 40 H 8 Z" fill={petColor} />
              <path d="M 4 16 h 8 v 12 h -8 z" fill="#8d6e63" />
              <path d="M 52 16 h 8 v 12 h -8 z" fill="#8d6e63" />
              {/* 질끈 감은 눈 */}
              <path d="M 18 22 l 4 4 M 22 22 l -4 4" stroke={eyeColor} strokeWidth="1.5" />
              <path d="M 42 22 l 4 4 M 46 22 l -4 4" stroke={eyeColor} strokeWidth="1.5" />
              <rect x="30" y="26" width="4" height="3" fill="#000000" />
            </>
          ) : (
            /* 오른쪽 냐옹이 */
            <>
              <path d="M 12 20 H 52 V 40 H 12 Z" fill={petColor} />
              <path d="M 12 20 L 20 8 L 28 20 Z" fill={petColor} />
              <path d="M 36 20 L 44 8 L 52 20 Z" fill={petColor} />
              {/* 질끈 눈 (X X) */}
              <path d="M 18 21 l 4 4 M 22 21 l -4 4" stroke={eyeColor} strokeWidth="1.5" />
              <path d="M 40 21 l 4 4 M 44 21 l -4 4" stroke={eyeColor} strokeWidth="1.5" />
              <rect x="31" y="25" width="2" height="2" fill={borderColor} />
            </>
          )}
        </svg>
        
        {/* 불꽃/땀방울 장식 3개 (FF6B6B) */}
        <div className="absolute -top-3 -right-4 flex gap-1 z-30">
          <span style={{ color: redColor, fontSize: '10px', fontWeight: 'bold' }}>☄</span>
          <span style={{ color: redColor, fontSize: '12px', fontWeight: 'bold' }}>☄</span>
          <span style={{ color: redColor, fontSize: '8px', fontWeight: 'bold' }}>☄</span>
        </div>

        {/* 솜방망이 앞발 */}
        <div className="absolute -bottom-1 left-2 flex gap-6 z-30">
          <div className="w-4 h-3 rounded-t" style={{ background: borderColor, border: `2px solid ${borderColor}`, borderBottom: 'none' }} />
          <div className="w-4 h-3 rounded-t" style={{ background: borderColor, border: `2px solid ${borderColor}`, borderBottom: 'none' }} />
        </div>
      </div>

      {/* ── 배너 내부 정보 렌더링 ── */}
      <div className="w-full h-full flex items-center justify-between px-6 py-4" style={{ fontFamily: 'DungGeunMo, monospace' }}>
        {/* 1. Nice job! */}
        <div className="flex items-center gap-1">
          <span className="text-base font-extrabold tracking-wider" style={{ color: mintColor }}>
            NICE JOB!
          </span>
          <span className="text-xs" style={{ color: borderColor }}>🐾</span>
        </div>

        {/* 2. Test mode 버튼 (오렌지/레드 밑줄) */}
        <div className="flex flex-col items-center">
          <div className="px-3 py-1 bg-black/40 border text-xs" style={{ borderColor: borderColor, color: borderColor }}>
            TEST MODE
          </div>
          <div className="w-full h-1 mt-1" style={{ background: redColor }} />
        </div>

        {/* 3. 구글 애드몹 스타일 ad. 로고 */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50">test ad.</span>
          {/* 애드몹 로고 픽셀 형태 */}
          <div className="w-6 h-6 border flex items-center justify-center bg-white/5" style={{ borderColor: borderColor }}>
            <span style={{ color: mintColor, fontSize: '10px' }}>▲</span>
          </div>
        </div>
      </div>
    </div>
  );
};
