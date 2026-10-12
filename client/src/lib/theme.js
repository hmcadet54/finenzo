/**
 * Theme & Accent Engine:
 * Supports Light/Dark/System modes, custom background colors, curated theme presets,
 * and WCAG AA contrast calculation.
 */

export const DEFAULT_ACCENT = '#D97757';
export const DEFAULT_BG_LIGHT = '#FAF9F5';
export const DEFAULT_BG_DARK = '#161615';

const STORAGE_ACCENT_KEY = 'finenzo.accent';
const STORAGE_MODE_KEY = 'finenzo.themeMode';
const STORAGE_BG_KEY = 'finenzo.bg';
const STORAGE_PRESET_KEY = 'finenzo.preset';
const FONT_SIZE_KEY = 'finenzo.fontSize';

export const ACCENT_PALETTE = [
  { name: 'Terracotta', hex: '#D97757' },
  { name: 'Blue', hex: '#4F7DF0' },
  { name: 'Green', hex: '#3C9A6B' },
  { name: 'Purple', hex: '#8B6FD6' },
  { name: 'Pink', hex: '#D9609A' },
  { name: 'Teal', hex: '#2A9D9A' },
  { name: 'Amber', hex: '#E0A12B' },
  { name: 'Rose', hex: '#F43F5E' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Emerald', hex: '#10B981' },
];

export const THEME_PRESETS = [
  {
    id: 'warm-terracotta',
    name: 'Warm Clay',
    mode: 'light',
    bg: '#FAF9F5',
    accent: '#D97757',
    desc: 'Classic warm cream & terracotta',
  },
  {
    id: 'charcoal-clay',
    name: 'Charcoal Clay',
    mode: 'dark',
    bg: '#161615',
    accent: '#E07A5F',
    desc: 'Tactile dark clay & warm coral',
  },
  {
    id: 'midnight-ocean',
    name: 'Midnight Ocean',
    mode: 'dark',
    bg: '#0F172A',
    accent: '#38BDF8',
    desc: 'Deep slate navy with sky cyan',
  },
  {
    id: 'matcha-sage',
    name: 'Matcha Sage',
    mode: 'light',
    bg: '#F3F6F3',
    accent: '#2E8B57',
    desc: 'Fresh herbal paper with forest green',
  },
  {
    id: 'obsidian-mint',
    name: 'Obsidian Mint',
    mode: 'dark',
    bg: '#0D1412',
    accent: '#10B981',
    desc: 'Deep emerald noir with electric mint',
  },
  {
    id: 'lavender-mist',
    name: 'Lavender Mist',
    mode: 'light',
    bg: '#F6F4FA',
    accent: '#8B5CF6',
    desc: 'Soft lilac cream with royal violet',
  },
  {
    id: 'amethyst-night',
    name: 'Amethyst Night',
    mode: 'dark',
    bg: '#14101F',
    accent: '#A78BFA',
    desc: 'Deep purple twilight with amethyst',
  },
  {
    id: 'sunset-rose',
    name: 'Sunset Rose',
    mode: 'light',
    bg: '#FBF4F3',
    accent: '#F43F5E',
    desc: 'Warm blush peach with vibrant rose',
  },
  {
    id: 'nordic-slate',
    name: 'Nordic Slate',
    mode: 'dark',
    bg: '#181A20',
    accent: '#60A5FA',
    desc: 'Clean Scandinavian slate with ice blue',
  },
  {
    id: 'golden-sand',
    name: 'Golden Sand',
    mode: 'light',
    bg: '#F8F5EC',
    accent: '#D97706',
    desc: 'Sunny dune sand with rich amber',
  },
];

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));

export function hexToRgb(hex) {
  if (!hex) return null;
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!h) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map((x) => clamp(x).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const lum = ([r, g, b]) => {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const mix = (a, b, t) => a.map((v, i) => clamp(v * (1 - t) + b[i] * t));
const triple = (c) => c.join(' ');

const INK_LIGHT = [31, 30, 29];
const INK_DARK = [245, 244, 240];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];

export function deriveAccent(hex, bgRgb, isDark) {
  const accent = hexToRgb(hex) ?? hexToRgb(DEFAULT_ACCENT);
  const useWhite = contrast(accent, WHITE) >= contrast(accent, BLACK);
  let onAccent = useWhite ? WHITE : (isDark ? WHITE : [15, 15, 14]);

  const target = useWhite ? WHITE : [0, 0, 0];
  for (let i = 0; i < 10 && contrast(accent, onAccent) < 4.5; i++) {
    onAccent = mix(onAccent, target, 0.25);
  }

  let text = accent;
  const targetText = isDark ? INK_DARK : INK_LIGHT;
  for (let i = 0; i < 20 && contrast(text, bgRgb) < 4.5; i++) {
    text = mix(text, targetText, 0.08);
  }

  return {
    accent,
    hover: mix(accent, useWhite ? (isDark ? WHITE : INK_LIGHT) : (isDark ? BLACK : WHITE), 0.12),
    soft: isDark ? mix(accent, bgRgb, 0.78) : mix(accent, WHITE, 0.86),
    text,
    onAccent,
  };
}

export function deriveTheme(hex, bgRgb = [250, 249, 245], isDark = false) {
  return deriveAccent(hex, bgRgb, isDark);
}

export function computeThemeTokens({ mode = 'system', customBg = '', accent = DEFAULT_ACCENT }) {
  const systemPrefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)')?.matches;
  const isDarkEffective = mode === 'dark' || (mode === 'system' && systemPrefersDark);

  let bgRgb = null;
  if (customBg && /^#[0-9a-fA-F]{6}$/i.test(customBg)) {
    bgRgb = hexToRgb(customBg);
  } else {
    bgRgb = isDarkEffective ? hexToRgb(DEFAULT_BG_DARK) : hexToRgb(DEFAULT_BG_LIGHT);
  }

  const isActuallyDark = contrast(bgRgb, WHITE) > contrast(bgRgb, BLACK);

  let surface, surface2, line, ink, muted, dangerSoft, successSoft, warnSoft, danger, success, warn;

  if (isActuallyDark) {
    surface = mix(bgRgb, WHITE, 0.06);
    surface2 = mix(bgRgb, WHITE, 0.12);
    line = mix(bgRgb, WHITE, 0.17);
    ink = [245, 244, 240];
    muted = mix(bgRgb, WHITE, 0.55);
    danger = [248, 113, 113];
    dangerSoft = mix(bgRgb, [239, 68, 68], 0.22);
    success = [52, 211, 153];
    successSoft = mix(bgRgb, [16, 185, 129], 0.22);
    warn = [251, 191, 36];
    warnSoft = mix(bgRgb, [245, 158, 11], 0.22);
  } else {
    surface = mix(bgRgb, WHITE, 0.88);
    surface2 = mix(bgRgb, INK_LIGHT, 0.04);
    line = mix(bgRgb, INK_LIGHT, 0.08);
    ink = [31, 30, 29];
    muted = [112, 108, 100];
    danger = [185, 50, 40];
    dangerSoft = [251, 236, 233];
    success = [40, 125, 84];
    successSoft = [232, 245, 237];
    warn = [160, 100, 10];
    warnSoft = [252, 243, 224];
  }

  const derivedAccent = deriveAccent(accent, bgRgb, isActuallyDark);

  return {
    isDark: isActuallyDark,
    bg: bgRgb,
    surface,
    surface2,
    line,
    ink,
    muted,
    danger,
    dangerSoft,
    success,
    successSoft,
    warn,
    warnSoft,
    ...derivedAccent,
  };
}

export function applyTheme({ mode, bg, accent, presetId, persist = true } = {}) {
  const currentMode = mode ?? getStoredThemeMode();
  const currentBg = bg !== undefined ? bg : getStoredBg();
  const currentAccent = accent ?? getStoredAccent();

  const tokens = computeThemeTokens({ mode: currentMode, customBg: currentBg, accent: currentAccent });
  const s = document.documentElement.style;

  s.setProperty('--bg', triple(tokens.bg));
  s.setProperty('--surface', triple(tokens.surface));
  s.setProperty('--surface-2', triple(tokens.surface2));
  s.setProperty('--line', triple(tokens.line));
  s.setProperty('--ink', triple(tokens.ink));
  s.setProperty('--muted', triple(tokens.muted));

  s.setProperty('--danger', triple(tokens.danger));
  s.setProperty('--danger-soft', triple(tokens.dangerSoft));
  s.setProperty('--success', triple(tokens.success));
  s.setProperty('--success-soft', triple(tokens.successSoft));
  s.setProperty('--warn', triple(tokens.warn));
  s.setProperty('--warn-soft', triple(tokens.warnSoft));

  s.setProperty('--accent', triple(tokens.accent));
  s.setProperty('--accent-hover', triple(tokens.hover));
  s.setProperty('--accent-soft', triple(tokens.soft));
  s.setProperty('--accent-text', triple(tokens.text));
  s.setProperty('--on-accent', triple(tokens.onAccent));

  if (tokens.isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  if (persist) {
    if (mode !== undefined) localStorage.setItem(STORAGE_MODE_KEY, mode);
    if (bg !== undefined) localStorage.setItem(STORAGE_BG_KEY, bg);
    if (accent !== undefined) localStorage.setItem(STORAGE_ACCENT_KEY, accent);
    if (presetId !== undefined) localStorage.setItem(STORAGE_PRESET_KEY, presetId);
  }

  return tokens;
}

export function applyAccent(hex, { persist = true } = {}) {
  return applyTheme({ accent: hex, persist });
}

export function applyPreset(presetId, { persist = true } = {}) {
  const preset = THEME_PRESETS.find((p) => p.id === presetId);
  if (!preset) return;
  return applyTheme({
    mode: preset.mode,
    bg: preset.bg,
    accent: preset.accent,
    presetId: preset.id,
    persist,
  });
}

export function getStoredThemeMode() {
  if (typeof localStorage === 'undefined') return 'system';
  return localStorage.getItem(STORAGE_MODE_KEY) || 'system';
}

export function getStoredBg() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_BG_KEY) || '';
}

export function getStoredAccent() {
  if (typeof localStorage === 'undefined') return DEFAULT_ACCENT;
  return localStorage.getItem(STORAGE_ACCENT_KEY) || DEFAULT_ACCENT;
}

export function getStoredPreset() {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(STORAGE_PRESET_KEY) || '';
}

export function applyStoredAccent() {
  applyTheme({ persist: false });
}

export function applyStoredTheme() {
  applyTheme({ persist: false });
}

// Watch system theme change if in 'system' mode
if (typeof window !== 'undefined' && window.matchMedia) {
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getStoredThemeMode() === 'system') {
        applyStoredTheme();
      }
    });
  } catch {}
}

export const FONT_SIZES = [
  { value: 'compact', label: 'Compact', size: '14px' },
  { value: 'normal', label: 'Normal', size: '16px' },
  { value: 'large', label: 'Large', size: '18px' },
];

export function applyFontSize(sizeKey, { persist = true } = {}) {
  const found = FONT_SIZES.find((f) => f.value === sizeKey) ?? FONT_SIZES[1];
  document.documentElement.style.setProperty('--app-font-size', found.size);
  if (persist) localStorage.setItem(FONT_SIZE_KEY, found.value);
}

export function getStoredFontSize() {
  if (typeof localStorage === 'undefined') return 'normal';
  return localStorage.getItem(FONT_SIZE_KEY) || 'normal';
}

export function applyStoredFontSize() {
  applyFontSize(getStoredFontSize(), { persist: false });
}
