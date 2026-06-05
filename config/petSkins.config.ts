/**
 * 🐾 SlideMino Cute Pet Skins Configuration Schema
 * 파일 경로: /Users/dj/Desktop/SlideMino/config/petSkins.config.ts
 */

export type PetEarType =
  | 'cat-pointed'            // 깜고, 흰고
  | 'cat-calico'             // 삼색이 (비대칭)
  | 'cat-cheese'             // 치즈 (줄무늬 데코)
  | 'cat-siamese'            // 샴 (초코 얼굴 포인트 + 푸른 눈동자)
  | 'cat-folded'             // 스코티시 폴드 (동글 접힌 귀)
  | 'cat-sphynx'             // 스핑크스 (거대한 사막여우 귀 + 핑크 가죽 주름)
  | 'dog-floppy'             // 댕댕이, 골든 리트리버
  | 'dog-pointed'            // 시바 (둥근 볼살 솜털 실루엣)
  | 'dog-corgi'              // 웰시코기 (왕대빵 큰 사막여우 귀)
  | 'dog-poodle'             // 푸들 (복슬 귀)
  | 'dog-chihuahua'          // 치와와 (얼굴 옆으로 뻗은 메가 쫑긋 귀 + 왕눈이)
  | 'dog-bichon'             // 비숑 프리제 (머리를 풍성하게 감싸는 동그란 솜사탕 하이바)
  | 'dog-maltese';           // 말티즈 (순백 쳐진 털 귀 + 빨간 리본 핀 데코)

export interface PetColorPalette {
  // 타일용 스타일 색상
  tileBg: string;
  tileBorder: string;
  tileTextColor: string;
  tileTextShadow?: string;
  tileBoxShadow?: string;

  // 픽셀 귀 SVG 내부 주입 색상
  earOuter: string;      // 왼쪽 귀 바깥/수염 색상 (기본)
  earOuterRight?: string; // 오른쪽 귀 비대칭 바깥 색상 (선택, 삼색이 전용)
  earInner: string;      // 귀 안쪽 색상 (분홍색 등)
  blush?: string;        // 볼터치 색상 (선택)

  // UI 테마 CSS 변수 매핑용 색상
  uiBg: string;
  uiPatternColor: string;
  uiBorder: string;
  uiCellBg: string;
  uiCellBorder: string;
  uiAccentPrimary: string;   // 민트/오렌지 등
  uiAccentSecondary: string; // -
  uiText: string;
  uiTextMuted: string;
  uiBtnHoverBg: string;
}

export interface PetSkinDefinition {
  id: string;
  nameKey: string;          // 다국어 i18n 대응 키
  displayNameKo: string;     // 한국어 표시명
  category: 'cat' | 'dog';
  earType: PetEarType;
  colors: PetColorPalette;
}

// ── 동적 SVG Generation Helper ──────────────────────────────────────────
export function generatePetEarSvg(earType: PetEarType, colors: PetColorPalette): string {
  const outerL = colors.earOuter;
  const outerR = colors.earOuterRight || colors.earOuter;
  const inner = colors.earInner;
  const blush = colors.blush || '#FF8B8B';

  let svgContent = '';

  switch (earType) {
    case 'cat-pointed': // 깜고, 흰고
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 12H10V9H8V5H5V9H1Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 12H5V9H3V6H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M31 12H22V9H24V5H27V9H31Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 12H27V9H29V6H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='9' y='17' width='2' height='5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='7' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='21' y='17' width='2' height='5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='19' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='15' y='20' width='2' height='2' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'cat-calico': // 삼색이 비대칭 쫑긋 귀 + 뺨 포인트
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 12H10V9H8V5H5V9H1Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 12H5V9H3V6H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M31 12H22V9H24V5H27V9H31Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 12H27V9H29V6H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='9' y='17' width='2' height='5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='7' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='21' y='17' width='2' height='5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='19' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='15' y='20' width='2' height='2' fill='${encodeURIComponent(outerR)}'/>
          <rect x='4' y='19' width='3' height='3' fill='${encodeURIComponent(outerL)}'/>
          <rect x='25' y='19' width='3' height='3' fill='${encodeURIComponent(outerR)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'cat-cheese': // 치즈 오렌지 줄무늬 데코
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 12H10V9H8V5H5V9H1Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 12H5V9H3V6H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M31 12H22V9H24V5H27V9H31Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 12H27V9H29V6H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='7' y='6' width='1' height='3' fill='#E67E22'/>
          <rect x='24' y='6' width='1' height='3' fill='#E67E22'/>
          <rect x='9' y='17' width='2' height='5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='7' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='21' y='17' width='2' height='5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='19' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='15' y='20' width='2' height='2' fill='#E67E22'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'cat-siamese': // 샴 (얼굴에 진한 초코 포인트 마스크 + 맑은 사파이어 눈동자)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 12H10V9H8V5H5V9H1Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 12H5V9H3V6H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M31 12H22V9H24V5H27V9H31Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 12H27V9H29V6H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='11' y='15' width='10' height='9' fill='${encodeURIComponent(outerL)}' opacity='0.85'/>
          <rect x='9' y='17' width='2' height='2' fill='#00D2FF'/>
          <rect x='21' y='17' width='2' height='2' fill='#00D2FF'/>
          <rect x='15' y='19' width='2' height='2' fill='#1A0F0A'/>
          <path d='M14 22Q16 23.5 18 22' stroke='#1A0F0A' stroke-width='1' fill='none'/>
        </svg>
      `.trim();
      break;

    case 'cat-folded': // 스코티시 폴드 (귀가 앞으로 완전히 착 접혀서 머리가 동그래진 실루엣)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 8H7V11H6V12H1V8Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 9H5V11H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M31 8H25V11H26V12H31V8Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 9H27V11H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='9' y='17' width='2' height='5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='7' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerL)}'/>
          <rect x='21' y='17' width='2' height='5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='19' y='19' width='6' height='1.5' fill='${encodeURIComponent(outerR)}'/>
          <rect x='15' y='20' width='2' height='2' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'cat-sphynx': // 스핑크스 (털 없이 쭈글분홍하고 사막여우처럼 왕 대빵 큰 엘프 귀)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M0 12H12V9H9V2H4V9H0Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 12H8V8H5V4H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M32 12H20V9H23V2H28V9H32Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 12H24V8H27V4H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='13' y='12' width='6' height='1.5' fill='${encodeURIComponent(outerL)}' opacity='0.5'/>
          <rect x='12' y='14' width='8' height='1' fill='${encodeURIComponent(outerL)}' opacity='0.5'/>
          <rect x='9' y='17' width='2' height='4' fill='${encodeURIComponent(outerL)}'/>
          <rect x='21' y='17' width='2' height='4' fill='${encodeURIComponent(outerR)}'/>
          <rect x='15' y='20' width='2' height='2' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-floppy': // 댕댕이, 골든 리트리버
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M0 12H8V7H4V12Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M32 12H24V7H28V12Z' fill='${encodeURIComponent(outerR)}'/>
          <rect x='9' y='17' width='3' height='3' fill='${encodeURIComponent(outerL)}'/>
          <rect x='20' y='17' width='3' height='3' fill='${encodeURIComponent(outerR)}'/>
          <rect x='14' y='20' width='4' height='3' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-pointed': // 시바견 (쫑긋 솟은 갈색 귀와 하얗고 넙적한 볼살 포인트)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 12H11V8H8V4H4V8H1Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M3 12H7V8H5V5H3Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M31 12H21V8H24V4H28V8H31Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M29 12H25V8H27V5H29Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='3' y='17' width='7' height='6' fill='#FFFFFF' opacity='0.95'/>
          <rect x='22' y='17' width='7' height='6' fill='#FFFFFF' opacity='0.95'/>
          <rect x='9' y='17' width='3' height='3' fill='${encodeURIComponent(outerL)}'/>
          <rect x='20' y='17' width='3' height='3' fill='${encodeURIComponent(outerR)}'/>
          <rect x='14' y='20' width='4' height='3' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.6'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.6'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-corgi': // 웰시코기 (사막여우처럼 둥글넙적하며 거대하고 쫑긋한 웰시코기 귀)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M0 12H12V8H9V3H4V8H0Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 12H8V8H5V5H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M32 12H20V8H23V3H28V8H32Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 12H24V8H27V5H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='9' y='17' width='3' height='3' fill='${encodeURIComponent(outerL)}'/>
          <rect x='20' y='17' width='3' height='3' fill='${encodeURIComponent(outerR)}'/>
          <rect x='14' y='20' width='4' height='3' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-poodle': // 푸들 (복슬복슬하게 곱슬거리는 모서리 귀)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M0 12H8V9H9V7H7V5H4V7H3V9H0Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M32 12H24V9H23V7H25V5H28V7H29V9H32Z' fill='${encodeURIComponent(outerR)}'/>
          <rect x='9' y='17' width='3' height='3' fill='${encodeURIComponent(outerL)}'/>
          <rect x='20' y='17' width='3' height='3' fill='${encodeURIComponent(outerR)}'/>
          <rect x='14' y='20' width='4' height='3' fill='${encodeURIComponent(outerL)}'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-chihuahua': // 치와와 (비스듬히 옆으로 뻗은 커다란 사슴 귀 + 초롱초롱 반짝이는 왕눈이!)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M0 12H11V9H10V5H6V3H2V7H0Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M2 11H8V8H6V5H4V7H2Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <path d='M32 12H21V9H22V5H26V3H30V7H32Z' fill='${encodeURIComponent(outerR)}'/>
          <path d='M30 11H24V8H26V5H28V7H30Z' fill='${encodeURIComponent(inner)}' opacity='0.85'/>
          <rect x='6' y='16' width='4' height='4' fill='#121212'/>
          <rect x='7' y='17' width='1.5' height='1.5' fill='#FFFFFF'/>
          <rect x='22' y='16' width='4' height='4' fill='#121212'/>
          <rect x='23' y='17' width='1.5' height='1.5' fill='#FFFFFF'/>
          <rect x='15' y='20' width='2' height='2' fill='#121212'/>
          ${colors.blush ? `<rect x='5' y='21' width='3' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>
          <rect x='24' y='21' width='3' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.5'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-bichon': // 비숑 프리제 (타일 위와 양 볼을 구름처럼 풍성하게 감싸는 거대한 솜사탕 하이바 털)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M2 12H30V8H28V5H24V3H8V5H4V8H2Z' fill='${encodeURIComponent(outerL)}'/>
          <rect x='1' y='11' width='6' height='8' fill='${encodeURIComponent(outerL)}'/>
          <rect x='25' y='11' width='6' height='8' fill='${encodeURIComponent(outerL)}'/>
          <rect x='9' y='17' width='3' height='3' fill='#121212'/>
          <rect x='20' y='17' width='3' height='3' fill='#121212'/>
          <rect x='14' y='19' width='4' height='3' fill='#121212'/>
          ${colors.blush ? `<rect x='6' y='21' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.55'/>
          <rect x='22' y='21' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.55'/>` : ''}
        </svg>
      `.trim();
      break;

    case 'dog-maltese': // 말티즈 (차분히 쳐진 긴 귀 + 이마 정중앙의 귀여운 빨간 리본 핀 데코!)
      svgContent = `
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>
          <path d='M1 12H7V6H4V12Z' fill='${encodeURIComponent(outerL)}'/>
          <path d='M31 12H25V6H28V12Z' fill='${encodeURIComponent(outerR)}'/>
          <rect x='14' y='7' width='4' height='2' fill='#E74C3C'/>
          <rect x='15' y='6' width='2' height='4' fill='#E74C3C'/>
          <rect x='15.5' y='7.5' width='1' height='1' fill='#F1C40F'/>
          <rect x='9' y='17' width='3' height='3' fill='#121212'/>
          <rect x='20' y='17' width='3' height='3' fill='#121212'/>
          <rect x='14' y='20' width='4' height='3' fill='#121212'/>
          ${colors.blush ? `<rect x='5' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.55'/>
          <rect x='23' y='22' width='4' height='1.5' fill='${encodeURIComponent(blush)}' opacity='0.55'/>` : ''}
        </svg>
      `.trim();
      break;
  }

  return `url("data:image/svg+xml;utf8,${svgContent}")`;
}

// ── 스킨 데이터 배열 명세 (15종) ──────────────────────────────────────────
export const PET_SKINS: readonly PetSkinDefinition[] = [
  // 1. 깜고 (기존) — 칠흑 바디, 황금 보더, 핫핑크 네온 포인트
  {
    id: 'skin_cute_black_cat',
    nameKey: 'cuteBlackCat',
    displayNameKo: '깜고',
    category: 'cat',
    earType: 'cat-pointed',
    colors: {
      tileBg: '#111115',
      tileBorder: '#FFD700',
      tileTextColor: '#FFFFFF',
      tileTextShadow: '2px 2px 0px rgba(0,0,0,0.9)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.6), inset 2px 2px 0 rgba(255,255,255,0.08), 0 4px 8px rgba(0,0,0,0.3)',
      earOuter: '#FFC69F',
      earInner: '#FF2E93',
      blush: '#FF2E93',
      uiBg: '#111115',
      uiPatternColor: '#1E1E22',
      uiBorder: '#FFD700',
      uiCellBg: '#1D1D22',
      uiCellBorder: '#3A3A42',
      uiAccentPrimary: '#FF2E93',
      uiAccentSecondary: '#FFD700',
      uiText: '#FFFFFF',
      uiTextMuted: '#8A8A93',
      uiBtnHoverBg: '#2E2E36',
    }
  },
  // 2. 흰고 (기존) — 시원한 스노우 화이트, 다크 차콜 보더, 아쿠아 네온 포인트
  {
    id: 'skin_cute_white_cat',
    nameKey: 'cuteWhiteCat',
    displayNameKo: '흰고',
    category: 'cat',
    earType: 'cat-pointed',
    colors: {
      tileBg: '#F5FAFD',
      tileBorder: '#2F3640',
      tileTextColor: '#2F3640',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.9)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#2F3640',
      earInner: '#FF7F9F',
      blush: '#FF7F9F',
      uiBg: '#F5FAFD',
      uiPatternColor: '#E1EDF7',
      uiBorder: '#2F3640',
      uiCellBg: '#EAF3FA',
      uiCellBorder: '#B2D0E6',
      uiAccentPrimary: '#00D2FF',
      uiAccentSecondary: '#FF4D79',
      uiText: '#2F3640',
      uiTextMuted: '#5F748D',
      uiBtnHoverBg: '#CFE2EF',
    }
  },
  // 3. 댕댕 (기존) — 코코아 모카색 바디, 우아한 연베이지 보더, 러블리 체리 핑크
  {
    id: 'skin_cute_dog',
    nameKey: 'cuteDog',
    displayNameKo: '댕댕이',
    category: 'dog',
    earType: 'dog-floppy',
    colors: {
      tileBg: '#FFF0F5',
      tileBorder: '#5C3D24',
      tileTextColor: '#4E3629',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.9)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(92,61,36,0.2), inset 2px 2px 0 rgba(255,255,255,0.6), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#5C3D24',
      earInner: '#FF7F9F',
      blush: '#FF7F9F',
      uiBg: '#FFF0F5',
      uiPatternColor: '#F5D6E3',
      uiBorder: '#5C3D24',
      uiCellBg: '#FFFDFD',
      uiCellBorder: '#EBD0C6',
      uiAccentPrimary: '#D81B60',
      uiAccentSecondary: '#FF5722',
      uiText: '#4E3629',
      uiTextMuted: '#8D6E63',
      uiBtnHoverBg: '#F2D2DF',
    }
  },
  // 4. 삼색이 (신규 고양이) — 뽀얀 백색 바디, 주황/검정 비대칭 고대비 포인트
  {
    id: 'skin_cute_calico_cat',
    nameKey: 'cuteCalicoCat',
    displayNameKo: '삼색이',
    category: 'cat',
    earType: 'cat-calico',
    colors: {
      tileBg: '#FCFDFD',
      tileBorder: '#D35400',
      tileTextColor: '#2E2E32',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.9)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(211,84,0,0.2), inset 2px 2px 0 rgba(255,255,255,0.8), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#E67E22',       // 비대칭: 왼쪽 귀 주황색
      earOuterRight: '#2E2E32',  // 비대칭: 오른쪽 귀 검은색
      earInner: '#FF7F9F',
      blush: '#FF9B9B',
      uiBg: '#FFF9F5',
      uiPatternColor: '#FCECE3',
      uiBorder: '#D35400',
      uiCellBg: '#FFFDFB',
      uiCellBorder: '#F5D2C1',
      uiAccentPrimary: '#E67E22',
      uiAccentSecondary: '#2E2E32',
      uiText: '#2E2E32',
      uiTextMuted: '#7F8C8D',
      uiBtnHoverBg: '#FCECE3',
    }
  },
  // 5. 치즈냥이 (신규 고양이) — 크림 옐로우, 선명한 체더 오렌지 줄무늬와 보더 테마
  {
    id: 'skin_cute_cheese_cat',
    nameKey: 'cuteCheeseCat',
    displayNameKo: '치즈냥이',
    category: 'cat',
    earType: 'cat-cheese',
    colors: {
      tileBg: '#FFFDF0',
      tileBorder: '#FF9F43',
      tileTextColor: '#7E5109',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(255,159,67,0.18), inset 2px 2px 0 rgba(255,255,255,0.8), 0 4px 8px rgba(0,0,0,0.1)',
      earOuter: '#FF9F43',
      earInner: '#FF8B8B',
      blush: '#FFA0A0',
      uiBg: '#FFFDF0',
      uiPatternColor: '#FCF3CF',
      uiBorder: '#FF9F43',
      uiCellBg: '#FEFDF9',
      uiCellBorder: '#FAD7A0',
      uiAccentPrimary: '#FF9F43',
      uiAccentSecondary: '#E74C3C',
      uiText: '#7E5109',
      uiTextMuted: '#A04000',
      uiBtnHoverBg: '#FCE4D6',
    }
  },
  // 6. 샴 (신규 고양이) — 실키 베이지 바디, 짙은 초코 마스크 포인트와 매혹적인 사파이어 눈동자
  {
    id: 'skin_cute_siamese_cat',
    nameKey: 'cuteSiameseCat',
    displayNameKo: '샴',
    category: 'cat',
    earType: 'cat-siamese',
    colors: {
      tileBg: '#F5EBE6',
      tileBorder: '#3D251E',
      tileTextColor: '#3D251E',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(61,37,30,0.22), inset 2px 2px 0 rgba(255,255,255,0.6), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#3D251E',
      earInner: '#FF9999',
      blush: '#FFA0A0',
      uiBg: '#FAF0E6',
      uiPatternColor: '#EEDC82',
      uiBorder: '#3D251E',
      uiCellBg: '#FFFDF9',
      uiCellBorder: '#D2B48C',
      uiAccentPrimary: '#00D2FF', // 네온 블루
      uiAccentSecondary: '#3D251E',
      uiText: '#3D251E',
      uiTextMuted: '#8B7355',
      uiBtnHoverBg: '#E8DCC4',
    }
  },
  // 7. 스핑크스 (신규 고양이 - NEW!) — 솜털 없는 핑크 스킨, 거대한 엘프 귀와 가죽 주름 디테일
  {
    id: 'skin_cute_sphynx_cat',
    nameKey: 'cuteSphynx',
    displayNameKo: '스핑크스',
    category: 'cat',
    earType: 'cat-sphynx',
    colors: {
      tileBg: '#FFD3D3',
      tileBorder: '#8D6E63',
      tileTextColor: '#5D4037',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.7)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(141,110,99,0.2), inset 2px 2px 0 rgba(255,255,255,0.6), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#8D6E63',
      earInner: '#FFAAAA',
      blush: '#FFB5B5',
      uiBg: '#FFE4E4',
      uiPatternColor: '#F5CBA7',
      uiBorder: '#8D6E63',
      uiCellBg: '#FFF0F0',
      uiCellBorder: '#D7CCC8',
      uiAccentPrimary: '#FFAAAA',
      uiAccentSecondary: '#8D6E63',
      uiText: '#5D4037',
      uiTextMuted: '#8D6E63',
      uiBtnHoverBg: '#FADBD8',
    }
  },
  // 8. 스코티시 폴드 (신규 고양이) — 촥 접힌 동글 귀 실루엣, 부드러운 코코아 베이지 톤
  {
    id: 'skin_cute_scottish_fold',
    nameKey: 'cuteScottishFold',
    displayNameKo: '스코티시 폴드',
    category: 'cat',
    earType: 'cat-folded',
    colors: {
      tileBg: '#F5F0EB',
      tileBorder: '#8D6E63',
      tileTextColor: '#4E342E',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(141,110,99,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.1)',
      earOuter: '#A1887F',
      earInner: '#FFAAAA',
      blush: '#FFB5B5',
      uiBg: '#F5F0EB',
      uiPatternColor: '#EDE0D4',
      uiBorder: '#8D6E63',
      uiCellBg: '#FCF9F7',
      uiCellBorder: '#D7CCC8',
      uiAccentPrimary: '#6D4C41',
      uiAccentSecondary: '#D84315',
      uiText: '#4E342E',
      uiTextMuted: '#8D6E63',
      uiBtnHoverBg: '#E8D5C4',
    }
  },
  // 9. 시바견 (신규 강아지) — 시바 옐로우 황갈색, 쫑긋한 귀와 흰 뺨살 도트 포인트
  {
    id: 'skin_cute_shiba',
    nameKey: 'cuteShiba',
    displayNameKo: '시바견',
    category: 'dog',
    earType: 'dog-pointed',
    colors: {
      tileBg: '#FEF5E7',
      tileBorder: '#A04000',
      tileTextColor: '#5C4033',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(160,64,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.1)',
      earOuter: '#D35400',
      earInner: '#FADBD8',
      blush: '#FFB5B5',
      uiBg: '#FEF5E7',
      uiPatternColor: '#FDEBD0',
      uiBorder: '#A04000',
      uiCellBg: '#FEFDFB',
      uiCellBorder: '#F5CBA7',
      uiAccentPrimary: '#E67E22',
      uiAccentSecondary: '#C0392B',
      uiText: '#5C4033',
      uiTextMuted: '#B2BABB',
      uiBtnHoverBg: '#FADBD8',
    }
  },
  // 10. 웰시코기 (신규 강아지) — 밝은 오렌지 웰시 브라운, 사막여우 같은 메가 쫑긋 귀
  {
    id: 'skin_cute_corgi',
    nameKey: 'cuteCorgi',
    displayNameKo: '웰시코기',
    category: 'dog',
    earType: 'dog-corgi',
    colors: {
      tileBg: '#FFFBF0',
      tileBorder: '#873600',
      tileTextColor: '#5C2D00',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(135,54,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#CA6F1E',
      earInner: '#F5B7B1',
      blush: '#F5B7B1',
      uiBg: '#FFF9EB',
      uiPatternColor: '#FCEFD2',
      uiBorder: '#873600',
      uiCellBg: '#FFFDF8',
      uiCellBorder: '#F5DCA3',
      uiAccentPrimary: '#D35400',
      uiAccentSecondary: '#E74C3C',
      uiText: '#5C2D00',
      uiTextMuted: '#9A7D0A',
      uiBtnHoverBg: '#FAD7A0',
    }
  },
  // 11. 골든 리트리버 (신규 강아지) — 순하고 아름다운 골든 캐러멜 옐로우 바디와 긴 처진 귀
  {
    id: 'skin_cute_retriever',
    nameKey: 'cuteRetriever',
    displayNameKo: '골든 리트리버',
    category: 'dog',
    earType: 'dog-floppy',
    colors: {
      tileBg: '#FEF9E7',
      tileBorder: '#BA4A00',
      tileTextColor: '#7E5109',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(186,74,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.1)',
      earOuter: '#F5B041',
      earInner: '#FADBD8',
      blush: '#FFAAAA',
      uiBg: '#FEF9E7',
      uiPatternColor: '#FCF3CF',
      uiBorder: '#BA4A00',
      uiCellBg: '#FEFDF9',
      uiCellBorder: '#FAD7A0',
      uiAccentPrimary: '#D35400',
      uiAccentSecondary: '#E74C3C',
      uiText: '#7E5109',
      uiTextMuted: '#9A7D0A',
      uiBtnHoverBg: '#FCE4D6',
    }
  },
  // 12. 치와와 (신규 강아지 - NEW!) — 거대하고 쫑긋한 핑크 사슴 귀와 까맣고 초롱초롱한 왕눈이
  {
    id: 'skin_cute_chihuahua',
    nameKey: 'cuteChihuahua',
    displayNameKo: '치와와',
    category: 'dog',
    earType: 'dog-chihuahua',
    colors: {
      tileBg: '#FFF8F0',
      tileBorder: '#873600',
      tileTextColor: '#5C2D00',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(135,54,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.12)',
      earOuter: '#CA6F1E',
      earInner: '#FADBD8',
      blush: '#FFB5B5',
      uiBg: '#FFF9EB',
      uiPatternColor: '#FCEFD2',
      uiBorder: '#873600',
      uiCellBg: '#FFFDF8',
      uiCellBorder: '#F5DCA3',
      uiAccentPrimary: '#CA6F1E',
      uiAccentSecondary: '#FADBD8',
      uiText: '#5C2D00',
      uiTextMuted: '#9A7D0A',
      uiBtnHoverBg: '#FAD7A0',
    }
  },
  // 13. 비숑 프리제 (신규 강아지 - NEW!) — 동그랗고 풍성한 화이트 솜사탕 하이바 털 실루엣
  {
    id: 'skin_cute_bichon',
    nameKey: 'cuteBichon',
    displayNameKo: '비숑 프리제',
    category: 'dog',
    earType: 'dog-bichon',
    colors: {
      tileBg: '#FFFFFF',
      tileBorder: '#121212',
      tileTextColor: '#121212',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.9)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.15), inset 2px 2px 0 rgba(255,255,255,0.8), 0 4px 8px rgba(0,0,0,0.1)',
      earOuter: '#FFFFFF',
      earInner: '#FFF0F5',
      blush: '#FF8B8B',
      uiBg: '#FFFFFF',
      uiPatternColor: '#F0F0F0',
      uiBorder: '#121212',
      uiCellBg: '#FFFFFF',
      uiCellBorder: '#E0E0E0',
      uiAccentPrimary: '#FF8B8B',
      uiAccentSecondary: '#121212',
      uiText: '#121212',
      uiTextMuted: '#9E9E9E',
      uiBtnHoverBg: '#F5F5F5',
    }
  },
  // 14. 푸들 (신규 강아지) — 곱슬곱슬 양옆에 처진 뽀글이 귀
  {
    id: 'skin_cute_poodle',
    nameKey: 'cutePoodle',
    displayNameKo: '푸들',
    category: 'dog',
    earType: 'dog-poodle',
    colors: {
      tileBg: '#FDF2E9',
      tileBorder: '#7E5109',
      tileTextColor: '#5C4033',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.8)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(126,81,9,0.15), inset 2px 2px 0 rgba(255,255,255,0.7), 0 4px 8px rgba(0,0,0,0.1)',
      earOuter: '#B9770E',
      earInner: '#F5B7B1',
      blush: '#FFB5B5',
      uiBg: '#FDF2E9',
      uiPatternColor: '#F5CBA7',
      uiBorder: '#7E5109',
      uiCellBg: '#FDFBF7',
      uiCellBorder: '#E59866',
      uiAccentPrimary: '#AF601A',
      uiAccentSecondary: '#CD6155',
      uiText: '#5C4033',
      uiTextMuted: '#935116',
      uiBtnHoverBg: '#EDBB99',
    }
  },
  // 15. 말티즈 (신규 강아지) — 순백 처진 털 귀와 이마 중앙의 깜찍한 빨간 리본 핀 장식
  {
    id: 'skin_cute_maltese',
    nameKey: 'cuteMaltese',
    displayNameKo: '말티즈',
    category: 'dog',
    earType: 'dog-maltese',
    colors: {
      tileBg: '#FEFEFE',
      tileBorder: '#BDBDBD',
      tileTextColor: '#424242',
      tileTextShadow: '1px 1px 0px rgba(255,255,255,0.9)',
      tileBoxShadow: 'inset -2px -2px 0 rgba(189,189,189,0.2), inset 2px 2px 0 rgba(255,255,255,0.8), 0 4px 8px rgba(0,0,0,0.08)',
      earOuter: '#FFFFFF',
      earInner: '#FFEFEF',
      blush: '#FFB5B5',
      uiBg: '#FEFEFE',
      uiPatternColor: '#F0F0F0',
      uiBorder: '#BDBDBD',
      uiCellBg: '#FFFFFF',
      uiCellBorder: '#E0E0E0',
      uiAccentPrimary: '#E74C3C',
      uiAccentSecondary: '#F1C40F',
      uiText: '#424242',
      uiTextMuted: '#9E9E9E',
      uiBtnHoverBg: '#F5F5F5',
    }
  },
];
