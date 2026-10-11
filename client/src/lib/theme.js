/** Accent theming: derive hover / soft / text / on-accent from one hex. WCAG AA aware. */
export const DEFAULT_ACCENT = '#D97757';
const STORAGE_KEY = 'finenzo.accent';

export const ACCENT_PALETTE = [
  { name: 'Terracotta', hex: '#D97757' },
  { name: 'Blue', hex: '#4F7DF0' },
  { name: 'Green', hex: '#3C9A6B' },
  { name: 'Purple', hex: '#8B6FD6' },
  { name: 'Pink', hex: '#D9609A' },
  { name: 'Teal', hex: '#2A9D9A' },
  { name: 'Amber', hex: '#E0A12B' },
];

const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
export function hexToRgb(hex) {
  const h = /^#?([0-9a-f]{6})$/i.exec(hex)?.[1];
  if (!h) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
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

const INK = [31, 30, 29];
const WHITE = [255, 255, 255];
const BG = [250, 249, 245];

export function deriveTheme(hex) {
  const accent = hexToRgb(hex) ?? hexToRgb(DEFAULT_ACCENT);
  // Text on accent buttons: pick whichever of white / deep-dark gives higher contrast.
  const useWhite = contrast(accent, WHITE) >= contrast(accent, [0, 0, 0]);
  let onAccent = useWhite ? WHITE : [15, 15, 14];
  const target = useWhite ? WHITE : [0, 0, 0];
  for (let i = 0; i < 10 && contrast(accent, onAccent) < 4.5; i++) {
    onAccent = mix(onAccent, target, 0.25);
  }
  // Accent used as text colour on cream must reach 4.5:1.
  let text = accent;
  for (let i = 0; i < 20 && contrast(text, BG) < 4.5; i++) text = mix(text, INK, 0.08);
  return {
    accent,
    hover: mix(accent, useWhite ? INK : WHITE, useWhite ? 0.14 : 0.1),
    soft: mix(accent, WHITE, 0.86),
    text,
    onAccent,
  };
}

export function applyAccent(hex, { persist = true } = {}) {
  const t = deriveTheme(hex);
  const s = document.documentElement.style;
  s.setProperty('--accent', triple(t.accent));
  s.setProperty('--accent-hover', triple(t.hover));
  s.setProperty('--accent-soft', triple(t.soft));
  s.setProperty('--accent-text', triple(t.text));
  s.setProperty('--on-accent', triple(t.onAccent));
  if (persist) localStorage.setItem(STORAGE_KEY, hex);
}

/** Called synchronously before first render so there is no colour flash. */
export function applyStoredAccent() {
  applyAccent(localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT, { persist: false });
}

const FONT_SIZE_KEY = 'finenzo.fontSize';
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
  return localStorage.getItem(FONT_SIZE_KEY) || 'normal';
}

export function applyStoredFontSize() {
  applyFontSize(getStoredFontSize(), { persist: false });
}

