import React from 'react';
import type { PremiumUiThemeId } from '../types';

interface PetDecorProps {
  themeId: PremiumUiThemeId;
}

function getThemeColors(themeId: PremiumUiThemeId) {
  const isDog   = themeId === 'cute_dog';
  const isWhite = themeId === 'cute_white_cat';
  const isBlack = themeId === 'cute_black_cat';
  return {
    isDog, isWhite, isBlack,
    border:   isDog ? '#5c3d24' : isWhite ? '#222222' : '#E7C6A0',
    innerEar: isDog ? '#c08080' : '#FF8B8B',
    petBody:  isBlack ? '#2E2E32' : isWhite ? '#F0F0F0' : '#c8a898',
    eye:      isBlack ? '#F0F0F0' : '#18181A',
    blush:    '#FF8A8A',
    mint:     isBlack ? '#5BE2A7' : isDog ? '#D81B60' : '#FF6D00',
    red:      isBlack ? '#FF6B6B' : isDog ? '#FF5722' : '#E53935',
  };
}

// ── 1. 홈/기능 버튼 프레임 ────────────────────────────────────────────────────
export const PetButtonFrame: React.FC<PetDecorProps & { children: React.ReactNode }> = ({ themeId, children }) => {
  const c = getThemeColors(themeId);
  return (
    <div className="relative inline-block select-none" style={{ imageRendering: 'pixelated', paddingTop: '10px' }}>
      {/* 상단 귀 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 10px', pointerEvents: 'none', zIndex: 10 }}>
        {c.isDog ? (
          <>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M0 0H9V3H11V7H9V8H3V7H0Z" fill={c.border}/><path d="M2 8H5V7H2Z" fill={c.innerEar}/></svg>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M3 0H12V7H9V8H3V7H1V3H3Z" fill={c.border}/><path d="M7 8H10V7H7Z" fill={c.innerEar}/></svg>
          </>
        ) : (
          <>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M0 10H12V8H10V6H7V3H4V0H0Z" fill={c.border}/><path d="M1 10H5V8H3V5H1Z" fill={c.innerEar} opacity="0.85"/></svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M14 10H2V8H4V6H7V3H10V0H14Z" fill={c.border}/><path d="M13 10H9V8H11V5H13Z" fill={c.innerEar} opacity="0.85"/></svg>
          </>
        )}
      </div>
      <div style={{ border: `2px solid ${c.border}`, background: 'var(--pet-bg)', borderRadius: '12px', boxShadow: `0 3px 0 rgba(0,0,0,0.35)`, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

// ── 2. 헤더 타이틀 ("블록 배치" 수염 박스) ─────────────────────────────────
export const PetHeaderTitleDecor: React.FC<PetDecorProps & { titleText: string }> = ({ themeId, titleText }) => {
  const c = getThemeColors(themeId);
  return (
    <div style={{ position: 'relative', display: 'inline-block', paddingTop: '10px', imageRendering: 'pixelated' }}>
      {/* 상단 귀 */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: '0 12px', pointerEvents: 'none' }}>
        {c.isDog ? (
          <>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M0 0H9V3H11V7H9V8H3V7H0Z" fill={c.border}/></svg>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M3 0H12V7H9V8H3V7H1V3H3Z" fill={c.border}/></svg>
          </>
        ) : (
          <>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M0 10H12V8H10V6H7V3H4V0H0Z" fill={c.border}/><path d="M1 10H5V8H3V5H1Z" fill={c.innerEar} opacity="0.85"/></svg>
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M14 10H2V8H4V6H7V3H10V0H14Z" fill={c.border}/><path d="M13 10H9V8H11V5H13Z" fill={c.innerEar} opacity="0.85"/></svg>
          </>
        )}
      </div>
      {/* 타이틀 박스 */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '8px 22px', border: `2px solid ${c.border}`, background: 'var(--pet-bg)', borderRadius: '12px', boxShadow: `0 3px 0 rgba(0,0,0,0.3)` }}>
        {/* 좌 수염 */}
        <div style={{ position: 'absolute', left: '-20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', pointerEvents: 'none' }}>
          <div style={{ width: '14px', height: '2px', background: c.border }}/>
          <div style={{ width: '18px', height: '2px', background: c.border }}/>
          <div style={{ width: '11px', height: '2px', background: c.border }}/>
        </div>
        <span style={{ color: c.mint, fontFamily: 'DungGeunMo, monospace', fontSize: '13px', fontWeight: 800, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{titleText}</span>
        {/* 우 수염 */}
        <div style={{ position: 'absolute', right: '-20px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '5px', pointerEvents: 'none' }}>
          <div style={{ width: '14px', height: '2px', background: c.border }}/>
          <div style={{ width: '18px', height: '2px', background: c.border }}/>
          <div style={{ width: '11px', height: '2px', background: c.border }}/>
        </div>
      </div>
    </div>
  );
};

// ── 3. 보드 귀+표정+수염 오버레이 ───────────────────────────────────────────
/**
 * Board div(#game-board)에 position:relative가 있으므로
 * 이 컴포넌트를 Board 바로 다음에 absolute로 배치합니다.
 * 
 * 핵심: wrapper div가 Board와 동일한 크기(100% x 100%)를 갖고
 *      overflow:visible로 귀가 위로 솟아오릅니다.
 */
export const PetBoardOverlay: React.FC<PetDecorProps> = ({ themeId }) => {
  const c = getThemeColors(themeId);
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        // Board의 padding(12px)을 고려해 inset을 -12px로 맞춰 귀가 테두리 위에 딱 붙도록
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
        overflow: 'visible',
      }}
    >
      {/* ── 상단 귀 + 표정 행 ── */}
      {/* 귀를 보드 테두리 상단 모서리에 올리기 위해 top 음수값 사용 */}
      <div style={{
        position: 'absolute',
        top: '-28px',
        left: '10px',
        right: '10px',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        imageRendering: 'pixelated',
      }}>
        {/* 귀와 귀 사이를 메워주는 이마(정수리) 라인 */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: c.isDog ? '42px' : '38px',
          right: c.isDog ? '42px' : '38px',
          height: '2.5px',
          background: c.border,
          zIndex: 5,
        }} />
        {/* 왼쪽 귀 */}
        {c.isDog ? (
          <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
            <path d="M0 28H34V18H24V8H12V18H0Z" fill={c.border}/>
            <path d="M8 28H20V20H8Z" fill={c.innerEar} opacity="0.75"/>
          </svg>
        ) : (
          <svg width="44" height="30" viewBox="0 0 44 30" fill="none">
            <path d="M0 30H38V26H30V20H22V12H14V0H0Z" fill={c.border}/>
            <path d="M2 30H14V26H8V14H2Z" fill={c.innerEar} opacity="0.85"/>
          </svg>
        )}

        {/* 중앙 고양이 표정 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '4px' }}>
          {c.isDog ? (
            <svg width="88" height="14" viewBox="0 0 88 14" fill="none">
              <rect x="0"  y="4" width="10" height="2" fill={c.border}/>
              <rect x="0"  y="8" width="10" height="2" fill={c.border}/>
              <rect x="18" y="3" width="5" height="5" fill={c.border}/>
              <path d="M34 6H37V10H51V6H54V10H51V12H37V10Z" fill={c.border}/>
              <rect x="63" y="3" width="5" height="5" fill={c.border}/>
              <rect x="78" y="4" width="10" height="2" fill={c.border}/>
              <rect x="78" y="8" width="10" height="2" fill={c.border}/>
            </svg>
          ) : (
            <svg width="88" height="14" viewBox="0 0 88 14" fill="none">
              {/* 좌 수염 */}
              <rect x="0"  y="4" width="10" height="2" fill={c.border}/>
              <rect x="0"  y="8" width="10" height="2" fill={c.border}/>
              {/* 좌 눈 + */}
              <rect x="17" y="1" width="2" height="10" fill={c.border}/>
              <rect x="13" y="5" width="10" height="2" fill={c.border}/>
              {/* 코 . */}
              <rect x="40" y="5" width="4" height="4" fill={c.border}/>
              {/* 우 눈 + */}
              <rect x="69" y="1" width="2" height="10" fill={c.border}/>
              <rect x="65" y="5" width="10" height="2" fill={c.border}/>
              {/* 우 수염 */}
              <rect x="78" y="4" width="10" height="2" fill={c.border}/>
              <rect x="78" y="8" width="10" height="2" fill={c.border}/>
            </svg>
          )}
        </div>

        {/* 오른쪽 귀 */}
        {c.isDog ? (
          <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
            <path d="M48 28H14V18H24V8H36V18H48Z" fill={c.border}/>
            <path d="M28 28H40V20H28Z" fill={c.innerEar} opacity="0.75"/>
          </svg>
        ) : (
          <svg width="44" height="30" viewBox="0 0 44 30" fill="none">
            <path d="M44 30H6V26H14V20H22V12H30V0H44Z" fill={c.border}/>
            <path d="M42 30H30V26H36V14H42Z" fill={c.innerEar} opacity="0.85"/>
          </svg>
        )}
      </div>

      {/* ── 왼쪽 수염 (보드 좌 중앙) ── */}
      <div style={{
        position: 'absolute',
        left: '-20px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '6px',
        imageRendering: 'pixelated',
      }}>
        <div style={{ width: '14px', height: '2.5px', background: c.border }}/>
        <div style={{ width: '18px', height: '2.5px', background: c.border }}/>
        <div style={{ width: '12px', height: '2.5px', background: c.border }}/>
      </div>

      {/* ── 오른쪽 수염 (보드 우 중앙) ── */}
      <div style={{
        position: 'absolute',
        right: '-20px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: '6px',
        imageRendering: 'pixelated',
      }}>
        <div style={{ width: '14px', height: '2.5px', background: c.border }}/>
        <div style={{ width: '18px', height: '2.5px', background: c.border }}/>
        <div style={{ width: '12px', height: '2.5px', background: c.border }}/>
      </div>
    </div>
  );
};

// 하위 호환성 alias
export const PetGridFrameDecor = PetBoardOverlay;

// ── 4. 하단 배너 위 빼꼼 고양이 ─────────────────────────────────────────────
export const PetBottomBannerDecor: React.FC<PetDecorProps & { children: React.ReactNode }> = ({ themeId, children }) => {
  const c = getThemeColors(themeId);

  const PetSvgNormal = () => (
    <svg width="68" height="42" viewBox="0 0 68 42" fill="none">
      {c.isDog ? (<>
        <path d="M4 14H12V26H4Z" fill="#8d6e63"/>
        <path d="M56 14H64V26H56Z" fill="#8d6e63"/>
        <path d="M8 12H60V42H8Z" fill={c.petBody}/>
        <rect x="20" y="22" width="5" height="5" fill={c.eye}/>
        <rect x="43" y="22" width="5" height="5" fill={c.eye}/>
        <rect x="30" y="28" width="8" height="5" fill="#000"/>
      </>) : (<>
        {/* 귀 */}
        <path d="M10 18L18 4L26 18Z" fill={c.petBody}/>
        <path d="M42 18L50 4L58 18Z" fill={c.petBody}/>
        <path d="M13 18L18 8L23 18Z" fill={c.innerEar} opacity="0.85"/>
        <path d="M45 18L50 8L55 18Z" fill={c.innerEar} opacity="0.85"/>
        <path d="M8 18H60V42H8Z" fill={c.petBody}/>
        {/* 왼 눈 + */}
        <rect x="20" y="23" width="2" height="8" fill={c.eye}/>
        <rect x="16" y="26" width="10" height="2" fill={c.eye}/>
        {/* 우 눈 + */}
        <rect x="46" y="23" width="2" height="8" fill={c.eye}/>
        <rect x="42" y="26" width="10" height="2" fill={c.eye}/>
        {/* 코 */}
        <rect x="32" y="30" width="4" height="4" fill={c.border}/>
        {/* 볼 */}
        <rect x="9" y="31" width="7" height="3" fill={c.blush} opacity="0.6"/>
        <rect x="52" y="31" width="7" height="3" fill={c.blush} opacity="0.6"/>
      </>)}
    </svg>
  );

  const PetSvgCross = () => (
    <svg width="68" height="42" viewBox="0 0 68 42" fill="none">
      {c.isDog ? (<>
        <path d="M4 14H12V26H4Z" fill="#8d6e63"/>
        <path d="M56 14H64V26H56Z" fill="#8d6e63"/>
        <path d="M8 12H60V42H8Z" fill={c.petBody}/>
        <line x1="19" y1="21" x2="26" y2="28" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="26" y1="21" x2="19" y2="28" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="42" y1="21" x2="49" y2="28" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="49" y1="21" x2="42" y2="28" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="30" y="28" width="8" height="5" fill="#000"/>
      </>) : (<>
        <path d="M10 18L18 4L26 18Z" fill={c.petBody}/>
        <path d="M42 18L50 4L58 18Z" fill={c.petBody}/>
        <path d="M13 18L18 8L23 18Z" fill={c.innerEar} opacity="0.85"/>
        <path d="M45 18L50 8L55 18Z" fill={c.innerEar} opacity="0.85"/>
        <path d="M8 18H60V42H8Z" fill={c.petBody}/>
        <line x1="19" y1="23" x2="27" y2="31" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="27" y1="23" x2="19" y2="31" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="43" y1="23" x2="51" y2="31" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <line x1="51" y1="23" x2="43" y2="31" stroke={c.eye} strokeWidth="2.5" strokeLinecap="round"/>
        <rect x="32" y="30" width="4" height="4" fill={c.border}/>
      </>)}
    </svg>
  );

  const Paws = () => (
    <div style={{ position: 'absolute', bottom: '-9px', left: '6px', display: 'flex', gap: '20px' }}>
      <div style={{ width: '15px', height: '10px', background: c.border, borderRadius: '5px 5px 0 0' }}/>
      <div style={{ width: '15px', height: '10px', background: c.border, borderRadius: '5px 5px 0 0' }}/>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', marginTop: '24px', imageRendering: 'pixelated', overflow: 'visible' }}>
      {/* 왼쪽 빼꼼 고양이 */}
      <div style={{ position: 'absolute', top: '-40px', left: '8px', pointerEvents: 'none', zIndex: 10 }}>
        <PetSvgNormal/>
        <Paws/>
      </div>

      {/* 오른쪽 빼꼼 고양이 (찡그린) */}
      <div style={{ position: 'absolute', top: '-40px', right: '10px', pointerEvents: 'none', zIndex: 10 }}>
        <PetSvgCross/>
        {/* 불꽃 */}
        <div style={{ position: 'absolute', top: '-10px', right: '-4px', display: 'flex', gap: '1px' }}>
          <span style={{ color: c.red, fontSize: '9px', lineHeight: 1 }}>☄</span>
          <span style={{ color: c.red, fontSize: '12px', lineHeight: 1 }}>☄</span>
        </div>
        <Paws/>
      </div>

      {/* 배너 테두리 (자식 래핑) */}
      <div style={{
        position: 'relative',
        border: `2.5px solid ${c.border}`,
        background: 'var(--pet-bg)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 3px 0 rgba(0,0,0,0.3)',
        zIndex: 5
      }}>
        {children}
      </div>
    </div>
  );
};
