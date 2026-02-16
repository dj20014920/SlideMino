import { SkinCatalogEntry } from '../types';

// ==========================================
// 🎨 스킨 스타일 정의 (Complex Skins)
// ==========================================

export const ADDITIONAL_SKIN_CATALOG: SkinCatalogEntry[] = [
  // 🧱 1. 리얼 머티리얼 (Real Materials)
  {
    id: 'skin_material_metal_brushed',
    hex: '#B0B0B0',
    category: 'material',
    nameKey: 'metalBrushed',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #e0e0e0 0%, #ffffff 50%, #e0e0e0 100%)',
      shadow: 'inset 0 0 10px rgba(0,0,0,0.1)',
      borderColor: '#999',
    },
  },
  {
    id: 'skin_material_metal_rusty',
    hex: '#8B4513',
    category: 'material',
    nameKey: 'metalRusty',
    style: {
      type: 'gradient',
      value: 'radial-gradient(circle, #8B4513 20%, #A0522D 80%)', // Simpler for now
      shadow: 'inset 0 0 20px rgba(0,0,0,0.6)',
      borderColor: '#5D4037',
    },
  },
  {
    id: 'skin_material_metal_gold',
    hex: '#FFD700',
    category: 'material',
    nameKey: 'metalGold',
    style: {
      type: 'gradient',
      value: 'linear-gradient(45deg, #FFD700, #FDB931, #FFD700)',
      shadow: '0 4px 6px rgba(218, 165, 32, 0.4)',
      borderColor: '#DAA520',
      textColor: '#8B4500',
    },
  },
  {
    id: 'skin_material_metal_silver',
    hex: '#C0C0C0',
    category: 'material',
    nameKey: 'metalSilver',
    style: {
      type: 'gradient',
      value: 'linear-gradient(45deg, #E0E0E0, #F5F5F5, #E0E0E0)',
      shadow: '0 4px 6px rgba(0,0,0,0.1)',
      borderColor: '#A9A9A9',
      textColor: '#555',
    },
  },
  {
    id: 'skin_material_metal_bronze',
    hex: '#CD7F32',
    category: 'material',
    nameKey: 'metalBronze',
    style: {
      type: 'gradient',
      value: 'linear-gradient(45deg, #CD7F32, #D2691E, #CD7F32)',
      shadow: '0 4px 6px rgba(139, 69, 19, 0.3)',
      borderColor: '#8B4513',
    },
  },
  {
    id: 'skin_material_fabric_denim',
    hex: '#1E3A8A',
    category: 'material',
    nameKey: 'fabricDenim',
    style: {
      type: 'css-pattern',
      value: 'repeating-linear-gradient(45deg, #1E3A8A, #1E3A8A 2px, #2563EB 2px, #2563EB 4px)',
      shadow: 'inset 0 0 5px rgba(0,0,0,0.3)',
      borderColor: '#DDD', // stitching style border?
      textColor: '#FFF',
    },
  },
  {
    id: 'skin_material_fabric_knit',
    hex: '#F87171',
    category: 'material',
    nameKey: 'fabricKnit',
    style: {
      type: 'css-pattern',
      value: 'repeating-radial-gradient(circle, #F87171, #F87171 2px, #EF4444 3px, #EF4444 4px)',
      borderColor: '#B91C1C',
    },
  },
  {
    id: 'skin_material_fabric_leather',
    hex: '#5D4037',
    category: 'material',
    nameKey: 'fabricLeather',
    style: {
      type: 'solid',
      value: '#5D4037',
      shadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
      borderColor: '#8D6E63', // Stitching color
    },
  },
  {
    id: 'skin_material_paper_cardboard',
    hex: '#D2B48C',
    category: 'material',
    nameKey: 'paperCardboard',
    style: {
      type: 'solid',
      value: '#D2B48C',
      shadow: '2px 2px 0px rgba(0,0,0,0.1)',
      borderColor: '#A1887F',
      textColor: '#5D4037',
    },
  },
  {
    id: 'skin_material_paper_origami',
    hex: '#FF69B4',
    category: 'material',
    nameKey: 'paperOrigami',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #FF69B4 50%, #FF1493 50%)', // Fold effect
      shadow: '1px 1px 2px rgba(0,0,0,0.2)',
      borderColor: 'transparent',
    },
  },
  {
    id: 'skin_material_paper_crumpled',
    hex: '#F5F5DC',
    category: 'material',
    nameKey: 'paperCrumpled',
    style: {
      type: 'gradient',
      value: 'repeating-linear-gradient(15deg, #F5F5DC, #F5F5DC 10px, #E8E8C8 10px, #E8E8C8 20px)',
      shadow: '1px 1px 3px rgba(0,0,0,0.1)',
      borderColor: '#D7D7AB',
      textColor: '#333',
    },
  },
  {
    id: 'skin_material_mineral_marble',
    hex: '#F0F0F0',
    category: 'material',
    nameKey: 'mineralMarble',
    style: {
      type: 'css-pattern',
      value: 'radial-gradient(circle at 30% 30%, #F0F0F0, #E0E0E0, #CCCCCC)', // Simplified marble
      shadow: '0 4px 6px rgba(0,0,0,0.1)',
      borderColor: '#D1D5DB',
      textColor: '#333',
    },
  },
  {
    id: 'skin_material_mineral_basalt',
    hex: '#374151',
    category: 'material',
    nameKey: 'mineralBasalt',
    style: {
      type: 'solid',
      value: '#374151',
      shadow: 'inset 2px 2px 5px rgba(0,0,0,0.5)', // Rough texture
      borderColor: '#1F2937',
    },
  },
  {
    id: 'skin_material_mineral_crystal',
    hex: '#E0F7FA',
    category: 'material',
    nameKey: 'mineralCrystal',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, rgba(255,255,255,0.8), rgba(224,247,250,0.6))',
      shadow: '0 0 10px rgba(0, 255, 255, 0.4)',
      borderColor: '#4DD0E1',
      textColor: '#006064',
    },
  },
  {
    id: 'skin_material_other_cork',
    hex: '#C19A6B',
    category: 'material',
    nameKey: 'otherCork',
    style: {
      type: 'css-pattern',
      value: 'radial-gradient(#C19A6B 15%, transparent 16%) 0 0, radial-gradient(#C19A6B 15%, transparent 16%) 8px 8px, radial-gradient(rgba(255,255,255,.1) 15%, transparent 20%) 0 1px, radial-gradient(rgba(255,255,255,.1) 15%, transparent 20%) 8px 9px', // Cork-like dots
      customCss: 'background-color: #D2B48C; background-size: 16px 16px;',
      borderColor: '#8D6E63',
      textColor: '#3E2723',
    },
  },
  {
    id: 'skin_material_other_chalkboard',
    hex: '#2F4F4F',
    category: 'material',
    nameKey: 'otherChalkboard',
    style: {
      type: 'solid',
      value: '#2F4F4F',
      borderColor: '#8B4513', // Wood frame color often associated
      textColor: '#FFF', // Chalk white
      customCss: 'font-family: monospace;', // distinct font if possible
    },
  },
  {
    id: 'skin_material_other_soap',
    hex: '#FFC0CB',
    category: 'material',
    nameKey: 'otherSoap',
    style: {
      type: 'gradient',
      value: 'radial-gradient(circle at 30% 30%, #FFC0CB, #FFB6C1)',
      shadow: 'inset -2px -2px 6px rgba(0,0,0,0.1), 2px 2px 6px rgba(255,255,255,0.8)', // Smooth, bubbly
      borderColor: '#FF69B4',
    },
  },
  {
    id: 'skin_material_other_sponge',
    hex: '#FFD700',
    category: 'material',
    nameKey: 'otherSponge',
    style: {
      type: 'css-pattern',
      value: 'radial-gradient(circle, #E6C200 20%, transparent 20%)',
      customCss: 'background-color: #FFD700; background-size: 10px 10px;', // Holes
      borderColor: '#DAA520',
      textColor: '#555',
    },
  },

  // 💻 2. 디지털 & UI 트렌드 (Digital & Tech)
  {
    id: 'skin_digital_glass_frosted',
    hex: '#FFFFFF',
    category: 'digital',
    nameKey: 'glassFrosted',
    style: {
      type: 'css-pattern',
      value: 'rgba(255, 255, 255, 0.2)',
      customCss: 'backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);',
      borderColor: 'rgba(255, 255, 255, 0.3)',
      shadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      textColor: '#333',
    },
  },
  {
    id: 'skin_digital_glass_acrylic',
    hex: '#E0F2FE',
    category: 'digital',
    nameKey: 'glassAcrylic',
    style: {
      type: 'css-pattern',
      value: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0.1))',
      customCss: 'backdrop-filter: blur(20px); box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);',
      borderColor: 'rgba(255, 255, 255, 0.5)',
      textColor: '#000',
    },
  },
  {
    id: 'skin_digital_neumorphism',
    hex: '#E0E5EC',
    category: 'digital',
    nameKey: 'neumorphism',
    style: {
      type: 'solid',
      value: '#E0E5EC',
      shadow: '9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)',
      borderColor: 'transparent', // Neumorphism usually has no border or slight border
      textColor: '#4D5B7C',
    },
  },
  {
    id: 'skin_digital_clay_3d',
    hex: '#A78BFA',
    category: 'digital',
    nameKey: 'clay3d',
    style: {
      type: 'solid',
      value: '#A78BFA',
      shadow: 'inset -8px -8px 16px rgba(0,0,0,0.1), inset 8px 8px 16px rgba(255,255,255,0.2), 8px 8px 16px rgba(0,0,0,0.1)',
      borderColor: 'transparent',
      customCss: 'border-radius: 16px;', // More rounded
    },
  },
  {
    id: 'skin_digital_pixel_8bit',
    hex: '#EF4444',
    category: 'digital',
    nameKey: 'pixel8bit',
    style: {
      type: 'solid',
      value: '#EF4444',
      borderColor: '#000',
      customCss: 'border-width: 2px; border-style: solid; box-shadow: inset -4px -4px 0px rgba(0,0,0,0.2); font-family: "Courier New", monospace;',
    },
  },
  {
    id: 'skin_digital_hologram',
    hex: '#00D9FF',
    category: 'digital',
    nameKey: 'hologram',
    style: {
        type: 'gradient',
        value: 'linear-gradient(135deg, rgba(0,217,255,0.3), rgba(138,43,226,0.3))',
        customCss: 'backdrop-filter: blur(1px);',
        borderColor: 'rgba(0,217,255,0.6)',
        textColor: '#FFF',
        shadow: '0 0 12px rgba(0,217,255,0.4), inset 0 0 8px rgba(138,43,226,0.2)',
    }
  },
  {
    id: 'skin_digital_wireframe',
    hex: '#000000',
    category: 'digital',
    nameKey: 'wireframe',
    style: {
      type: 'solid',
      value: 'transparent',
      borderColor: '#00FF00', // Green matrix style
      textColor: '#00FF00',
      shadow: 'none',
      customCss: 'border-width: 1px;',
    },
  },
  {
    id: 'skin_digital_neon',
    hex: '#000000',
    category: 'digital',
    nameKey: 'neon',
    style: {
      type: 'solid',
      value: '#000000',
      borderColor: '#FF00FF',
      shadow: '0 0 5px #FF00FF, 0 0 10px #FF00FF, 0 0 20px #FF00FF',
      textColor: '#FFF',
    },
  },

  // 🎨 3. 예술 & 아트 스타일 (Artistic)
  {
    id: 'skin_art_watercolor',
    hex: '#A7F3D0',
    category: 'art',
    nameKey: 'watercolor',
    style: {
      type: 'gradient',
      value: 'radial-gradient(circle at 70% 30%, #A7F3D0 0%, #34D399 100%)',
      customCss: 'filter: blur(0.5px);', // Soft edges
      borderColor: 'transparent',
      textColor: '#064E3B',
    },
  },
  {
    id: 'skin_art_oil',
    hex: '#FCD34D',
    category: 'art',
    nameKey: 'oilPainting',
    style: {
      type: 'css-pattern',
      value: 'linear-gradient(45deg, #FCD34D, #F59E0B)',
      shadow: 'inset 0 0 10px rgba(0,0,0,0.2)', // Texture depth
      borderColor: '#D97706',
    },
  },
  {
    id: 'skin_art_sketch',
    hex: '#FFFFFF',
    category: 'art',
    nameKey: 'sketch',
    style: {
      type: 'solid',
      value: '#FFFFFF',
      borderColor: '#000',
      customCss: 'border-style: dashed; border-width: 2px;',
      textColor: '#000',
    },
  },
  {
    id: 'skin_art_pop',
    hex: '#FFFF00',
    category: 'art',
    nameKey: 'popArt',
    style: {
      type: 'css-pattern',
      value: 'radial-gradient(#FF0000 20%, transparent 20%)', // Polka dots
      customCss: 'background-color: #FFFF00; background-size: 8px 8px;',
      borderColor: '#000',
      textColor: '#000',
    },
  },
  {
    id: 'skin_art_stained_glass',
    hex: '#3B82F6',
    category: 'art',
    nameKey: 'stainedGlass',
    style: {
      type: 'gradient',
      value: 'linear-gradient(45deg, rgba(255,0,0,0.5), rgba(0,0,255,0.5))',
      borderColor: '#000',
      customCss: 'border-width: 2px;',
      shadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'skin_art_mosaic',
    hex: '#10B981',
    category: 'art',
    nameKey: 'mosaic',
    style: {
      type: 'css-pattern',
      value: 'conic-gradient(#10B981 90deg, #34D399 90deg 180deg, #059669 180deg 270deg, #6EE7B7 270deg)',
      customCss: 'background-size: 10px 10px;',
      borderColor: '#047857',
    },
  },

  // 🍔 4. 푸드 & 디저트 (Food)
  {
    id: 'skin_food_waffle',
    hex: '#FDE68A',
    category: 'food',
    nameKey: 'waffle',
    style: {
      type: 'css-pattern',
      value: 'linear-gradient(90deg, transparent 90%, rgba(139,69,19,0.2) 90%), linear-gradient(0deg, transparent 90%, rgba(139,69,19,0.2) 90%)',
      customCss: 'background-color: #FDE68A; background-size: 10px 10px;',
      borderColor: '#D97706',
      textColor: '#78350F',
    },
  },
  {
    id: 'skin_food_toast',
    hex: '#FCD34D',
    category: 'food',
    nameKey: 'toast',
    style: {
      type: 'gradient',
      value: 'radial-gradient(circle, #FEF3C7 30%, #F59E0B 100%)', // Brown edges
      borderColor: '#B45309',
      textColor: '#78350F',
    },
  },
  {
    id: 'skin_food_cookie',
    hex: '#D97706',
    category: 'food',
    nameKey: 'cookie',
    style: {
      type: 'css-pattern',
      value: 'radial-gradient(#3E2723 15%, transparent 16%)', // chips
      customCss: 'background-color: #D97706; background-size: 12px 12px;',
      borderColor: '#92400E',
    },
  },
  {
    id: 'skin_food_gummy',
    hex: '#F472B6',
    category: 'food',
    nameKey: 'gummy',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, rgba(244,114,182,0.8), rgba(244,114,182,0.4))',
      shadow: 'inset 0 0 5px rgba(255,255,255,0.5)',
      borderColor: '#EC4899',
    },
  },
  {
    id: 'skin_food_candy',
    hex: '#3B82F6',
    category: 'food',
    nameKey: 'candy',
    style: {
      type: 'gradient',
      value: 'linear-gradient(45deg, #3B82F6, #93C5FD)',
      shadow: 'inset 2px 2px 4px rgba(255,255,255,0.7), 2px 2px 4px rgba(0,0,0,0.2)', // Glossy
      borderColor: '#2563EB',
    },
  },
  {
    id: 'skin_food_marshmallow',
    hex: '#F3E8FF',
    category: 'food',
    nameKey: 'marshmallow',
    style: {
      type: 'solid',
      value: '#F3E8FF',
      shadow: 'inset 0 0 10px rgba(0,0,0,0.05)',
      borderColor: '#E9D5FF',
      textColor: '#555',
    },
  },
  {
    id: 'skin_food_fruit_orange',
    hex: '#FFA500',
    category: 'food',
    nameKey: 'fruitOrange',
    style: {
      type: 'css-pattern',
      value: 'radial-gradient(circle, #FFA500 0%, #FF8C00 100%)',
      customCss: 'border-radius: 50%;', // Makes inner look like fruit slice? No, board is square pieces.
      borderColor: '#FFF',
      shadow: 'inset 0 0 0 2px #FFF', // Pith
      textColor: '#FFF',
    },
  },
  {
    id: 'skin_food_chocolate',
    hex: '#3E2723',
    category: 'food',
    nameKey: 'chocolate',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #4E342E, #3E2723)',
      shadow: 'inset 1px 1px 2px rgba(255,255,255,0.1)',
      borderColor: '#2D1B18',
    },
  },

  // 🌍 5. 자연 & 계절 (Nature)
  {
    id: 'skin_nature_water',
    hex: '#38BDF8',
    category: 'nature',
    nameKey: 'water',
    style: {
      type: 'gradient',
      value: 'linear-gradient(180deg, #38BDF8, #0EA5E9)',
      shadow: 'inset 0 -2px 5px rgba(0,0,0,0.1), 0 2px 5px rgba(255,255,255,0.3)', // Liquid surface
      borderColor: '#0284C7',
    },
  },
  {
    id: 'skin_nature_ice',
    hex: '#A5F3FC',
    category: 'nature',
    nameKey: 'ice',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #CFFAFE, #A5F3FC)',
      customCss: 'opacity: 0.8; backdrop-filter: blur(2px);',
      borderColor: '#22D3EE',
      textColor: '#0891B2',
    },
  },
  {
    id: 'skin_nature_foliage',
    hex: '#4ADE80',
    category: 'nature',
    nameKey: 'foliage',
    style: {
      type: 'gradient',
      value: 'linear-gradient(135deg, #4ADE80 25%, #22C55E 75%)',
      borderColor: '#16A34A',
    },
  },
  {
    id: 'skin_nature_cloud',
    hex: '#F8FAFC',
    category: 'nature',
    nameKey: 'cloud',
    style: {
      type: 'gradient',
      value: 'linear-gradient(180deg, #FFFFFF, #F1F5F9)',
      shadow: '0 4px 6px rgba(0,0,0,0.05)',
      borderColor: '#CBD5E1',
      textColor: '#64748B',
    },
  },
];
