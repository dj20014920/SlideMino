/**
 * 🎨 Skin Palette System
 * 
 * Per-value color progressions + animations for complex skins.
 * Each skin defines an HSL progression (start→end) that smoothly interpolates
 * across tile values (1→32768), creating visually distinct appearances per level.
 * 
 * Special skins (Neon, Pop Art, Stained Glass) use explicit 16-color palettes
 * for maximum visual variety.
 * 
 * Design Philosophy:
 * - Low values (1-4): Light, fresh, inviting colors
 * - Mid values (8-64): Rich, saturated, confident tones
 * - High values (128-2048): Deep, powerful, premium feel
 * - Max values (4096+): Ultra-dark/brilliant, legendary tier
 */

// ==============================================
// HSL Progression Type
// ==============================================
// Format: [startH, startS, startL, endH, endS, endL]
// Interpolated via: t = log2(value) / 15
export type HSLProgression = [number, number, number, number, number, number];

// ==============================================
// 🧱 Real Materials — HSL Progressions
// ==============================================
// Design: Materials deepen and age as value increases.
// Low values = fresh/new material, High values = aged/premium.

export const SKIN_PROGRESSIONS: Record<string, HSLProgression> = {
  // ── Metal ──
  // Brushed Metal: Polished aluminum (bright) → Dark steel (moody)
  'skin_material_metal_brushed': [210, 5, 92, 216, 12, 28],
  // Rusty Metal: Surface patina (warm orange) → Deep corrosion (dark brown)
  'skin_material_metal_rusty': [24, 56, 68, 10, 72, 18],
  // Gold: Champagne dust → Rich 24K gold bar
  'skin_material_metal_gold': [48, 82, 90, 43, 100, 36],
  // Silver: Mirror bright → Aged pewter
  'skin_material_metal_silver': [210, 6, 94, 216, 14, 30],
  // Bronze: Fresh copper penny → Dark antique patina
  'skin_material_metal_bronze': [30, 56, 76, 20, 68, 22],

  // ── Fabric ──
  // Denim: Bleached light wash → Raw selvedge indigo
  'skin_material_fabric_denim': [218, 48, 76, 232, 80, 18],
  // Knit: Pastel baby pink → Deep wool crimson
  'skin_material_fabric_knit': [355, 52, 88, 348, 78, 28],
  // Leather: Fresh tan hide → Aged mahogany
  'skin_material_fabric_leather': [26, 42, 68, 14, 62, 16],

  // ── Paper ──
  // Cardboard: Fresh kraft → Heavy corrugated brown
  'skin_material_paper_cardboard': [34, 36, 82, 24, 52, 28],
  // Origami: Pastel pink paper → Vivid hot pink fold
  'skin_material_paper_origami': [332, 82, 88, 318, 86, 32],
  // Crumpled Paper: White sheet → Aged parchment
  'skin_material_paper_crumpled': [54, 18, 95, 46, 32, 42],

  // ── Mineral ──
  // Marble: Pure white Carrara → Dark noir marble
  'skin_material_mineral_marble': [260, 4, 96, 238, 18, 20],
  // Basalt: Light gray stone → Deep volcanic black
  'skin_material_mineral_basalt': [216, 10, 62, 218, 18, 10],
  // Crystal: Clear quartz → Deep sapphire facets
  'skin_material_mineral_crystal': [186, 80, 93, 198, 88, 28],

  // ── Other ──
  // Cork: Light bulletin board → Dark weathered cork
  'skin_material_other_cork': [30, 36, 78, 22, 52, 24],
  // Chalkboard: Faded green → Deep dark board
  'skin_material_other_chalkboard': [180, 16, 48, 180, 22, 14],
  // Soap: White bar → Deep rose petal soap
  'skin_material_other_soap': [340, 52, 93, 328, 72, 38],
  // Sponge: Bright new yellow → Compressed dark olive
  'skin_material_other_sponge': [50, 86, 86, 44, 62, 28],

  // ==============================================
  // 💻 Digital & UI Trends — HSL Progressions
  // ==============================================
  // Design: Digital skins gain depth and intensity with value.

  // Frosted Glass: Nearly clear → Deeply frosted (milky)
  'skin_digital_glass_frosted': [210, 12, 96, 218, 20, 44],
  // Acrylic: Clear blue tint → Deep translucent blue
  'skin_digital_glass_acrylic': [206, 58, 93, 212, 54, 32],
  // Neumorphism: Barely raised → Deeply carved emboss
  'skin_digital_neumorphism': [220, 12, 91, 222, 22, 48],
  // 3D Clay: Light pastel lavender → Rich deep purple clay
  'skin_digital_clay_3d': [264, 64, 89, 270, 78, 28],
  // 8-bit Pixel: Light retro → Dark game-over tone
  'skin_digital_pixel_8bit': [2, 72, 78, 352, 86, 28],
  // Hologram: Cyan transparent → Deep purple translucent
  'skin_digital_hologram': [190, 70, 85, 270, 75, 35],
  // Wireframe: Dim lines → Bright neon lines
  'skin_digital_wireframe': [120, 90, 72, 120, 100, 50],

  // ==============================================
  // 🎨 Art Styles — HSL Progressions
  // ==============================================
  // Design: Artistic depth increases from sketch to masterpiece.

  // Watercolor: Light wash → Deep saturated pool
  'skin_art_watercolor': [156, 58, 91, 162, 76, 28],
  // Oil Painting: Thin glaze → Thick impasto
  'skin_art_oil': [46, 80, 86, 34, 82, 28],
  // Sketch: Faint pencil → Bold pen strokes
  'skin_art_sketch': [0, 0, 96, 0, 0, 22],
  // Mosaic: Light tile → Deep jewel tile
  'skin_art_mosaic': [156, 58, 76, 158, 70, 24],

  // ==============================================
  // 🍔 Food & Dessert — HSL Progressions
  // ==============================================
  // Design: From fresh/raw to perfectly prepared/rich.

  // Waffle: Light batter → Golden crispy perfection
  'skin_food_waffle': [46, 70, 89, 32, 78, 28],
  // Toast: White bread → Dark toasted crust
  'skin_food_toast': [44, 50, 91, 24, 70, 22],
  // Cookie: Raw dough → Dark chocolate chip
  'skin_food_cookie': [34, 60, 76, 18, 74, 22],
  // Gummy: Light translucent → Rich deep gummy
  'skin_food_gummy': [330, 80, 87, 336, 78, 36],
  // Candy: Light candy → Deep jewel candy
  'skin_food_candy': [220, 70, 83, 226, 82, 30],
  // Marshmallow: Pure white fluffy → Toasted golden brown
  'skin_food_marshmallow': [270, 40, 96, 28, 54, 34],
  // Orange: Light citrus → Deep orange flesh
  'skin_food_fruit_orange': [36, 86, 83, 22, 92, 30],
  // Chocolate: Milk chocolate → 99% dark cacao
  'skin_food_chocolate': [18, 48, 52, 12, 58, 14],

  // ==============================================
  // 🌍 Nature & Seasonal — HSL Progressions
  // ==============================================
  // Design: From gentle/light nature to deep/powerful forces.

  // Water: Shallow pool → Abyssal deep ocean
  'skin_nature_water': [198, 80, 83, 212, 86, 20],
  // Ice: Thin frost → Glacial deep blue
  'skin_nature_ice': [188, 70, 93, 196, 82, 30],
  // Foliage: Spring sprout → Dense old-growth forest
  'skin_nature_foliage': [140, 66, 79, 152, 74, 20],
  // Cloud: Wispy cirrus → Dark storm cumulonimbus
  'skin_nature_cloud': [210, 12, 97, 216, 24, 28],
};

// ==============================================
// 🌈 Multi-Hue Explicit Palettes
// ==============================================
// For skins where linear HSL interpolation isn't enough.
// 16 hex colors for value indices 0-15 (log2 of tile value).

export const SKIN_EXPLICIT_PALETTES: Record<string, string[]> = {
  // Neon Sign: Each value glows a different neon tube color.
  // Black background + colored glow/text — maximum cyberpunk vibes.
  // Story: Low values = cool spectrum, high values = warm → blazing white
  'skin_digital_neon': [
    '#E040FB', // 1:  Neon magenta
    '#7C4DFF', // 2:  Neon indigo
    '#448AFF', // 4:  Neon blue
    '#18FFFF', // 8:  Neon cyan
    '#00E676', // 16: Neon green
    '#76FF03', // 32: Neon lime
    '#FFEA00', // 64: Neon yellow
    '#FF9100', // 128: Neon orange
    '#FF3D00', // 256: Neon red-orange
    '#FF1744', // 512: Neon red
    '#F50057', // 1024: Neon hot pink
    '#D500F9', // 2048: Neon purple (full circle)
    '#651FFF', // 4096: Electric violet
    '#00B0FF', // 8192: Electric azure
    '#1DE9B6', // 16384: Electric teal
    '#FFFFFF', // 32768: Blazing white (max power)
  ],

  // Pop Art: Bold, punchy primary/secondary — Warhol vibes.
  // Every value is a completely different, confident color.
  'skin_art_pop': [
    '#FFEB3B', // 1:  Bright yellow
    '#F44336', // 2:  Bold red
    '#2196F3', // 4:  Primary blue
    '#4CAF50', // 8:  Kelly green
    '#FF9800', // 16: Bright orange
    '#E91E63', // 32: Hot pink
    '#00BCD4', // 64: Cyan
    '#9C27B0', // 128: Purple
    '#CDDC39', // 256: Lime
    '#FF5722', // 512: Deep orange
    '#3F51B5', // 1024: Indigo
    '#009688', // 2048: Teal
    '#FFC107', // 4096: Amber
    '#673AB7', // 8192: Deep purple
    '#FF6F00', // 16384: Vivid amber
    '#C62828', // 32768: Deep red (power)
  ],

  // Stained Glass: Rich jewel tones — cathedral window colors.
  // Each value is a different precious stone hue.
  'skin_art_stained_glass': [
    '#C62828', // 1:  Ruby
    '#1565C0', // 2:  Sapphire
    '#2E7D32', // 4:  Emerald
    '#F9A825', // 8:  Topaz
    '#6A1B9A', // 16: Amethyst
    '#00838F', // 32: Aquamarine
    '#E65100', // 64: Amber
    '#AD1457', // 128: Garnet
    '#1B5E20', // 256: Malachite
    '#283593', // 512: Lapis Lazuli
    '#BF360C', // 1024: Carnelian
    '#4A148C', // 2048: Royal Amethyst
    '#004D40', // 4096: Deep Emerald
    '#880E4F', // 8192: Deep Rose
    '#0D47A1', // 16384: Deep Sapphire
    '#FF8F00', // 32768: Golden (legendary)
  ],
};

// ==============================================
// ✨ Skin Animations
// ==============================================
// CSS animation shorthand for skins with special effects.
// These use `filter` (brightness, drop-shadow, hue-rotate, saturate)
// which doesn't conflict with the tile's `transform: translate3d()` positioning.

export const SKIN_ANIMATIONS: Record<string, string> = {
  // Neon: Pulsing glow — tubes brightening/dimming
  'skin_digital_neon': 'skinNeonPulse 2s ease-in-out infinite',
  // Crystal: Subtle facet shimmer — light catching edges
  'skin_material_mineral_crystal': 'skinCrystalShimmer 3s ease-in-out infinite',
  // Water: Gentle wave — surface light ripple
  'skin_nature_water': 'skinWaterRipple 3s ease-in-out infinite',
  // Hologram: Floating projection — color shift shimmer
  'skin_digital_hologram': 'skinHologramShift 4s ease-in-out infinite',
  // Wireframe: Border glow pulse — holographic scan
  'skin_digital_wireframe': 'skinWireGlow 2s ease-in-out infinite',
  // Gummy: Subtle shine sweep — candy wrapper gleam
  'skin_food_gummy': 'skinGummyShine 2.5s ease-in-out infinite',
  // Marshmallow: Breathing swell — soft squish feel
  'skin_food_marshmallow': 'skinMarshmallowBreath 3s ease-in-out infinite',
  // 3D Clay: Gentle highlight shift — rotating studio light
  'skin_digital_clay_3d': 'skinClayShift 3s ease-in-out infinite',
  // Ice: Cold sparkle — frost catching sunlight
  'skin_nature_ice': 'skinIceSparkle 4s ease-in-out infinite',
  // Frosted Glass: Opacity breath — condensation pulse
  'skin_digital_glass_frosted': 'skinFrostPulse 3s ease-in-out infinite',
  // Origami: Subtle fold highlight shift
  'skin_material_paper_origami': 'skinOrigamiFold 4s ease-in-out infinite',
  // Soap: Iridescent shimmer — soap bubble rainbow
  'skin_material_other_soap': 'skinSoapShimmer 3s ease-in-out infinite',
};

// ==============================================
// 🎨 Special Render Mode Skins
// ==============================================
// Skins that need fundamentally different rendering logic.

export type SkinRenderMode = 'standard' | 'neon' | 'wireframe' | 'sketch';

export const SKIN_RENDER_MODES: Record<string, SkinRenderMode> = {
  'skin_digital_neon': 'neon',
  'skin_digital_wireframe': 'wireframe',
  'skin_art_sketch': 'sketch',
};

// ==============================================
// 🔧 Per-Value Shadow Presets
// ==============================================
// Shadows scale with tile value for depth perception.

export function getValueShadow(t: number): string {
  // t: 0..1 (value 1 → value 32768)
  const depth = Math.round(2 + t * 12);
  const spread = Math.round(1 + t * 6);
  const opacity = (0.06 + t * 0.22).toFixed(2);
  return `0 ${depth}px ${depth + spread}px rgba(0,0,0,${opacity})`;
}

// ==============================================
// 🔧 Border Color Generator
// ==============================================
// Auto-generates border color that's slightly darker than the base.

export function getAutoBorderColor(h: number, s: number, l: number): string {
  // Darker, slightly more saturated border
  const borderL = Math.max(4, l - 12);
  const borderS = Math.min(100, s + 8);
  return `hsl(${Math.round(h)}, ${Math.round(borderS)}%, ${Math.round(borderL)}%)`;
}
