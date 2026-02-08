/**
 * Theme manager — handles color scheme switching and persistence.
 * Themes are defined as data-theme attributes on <html>.
 * CSS variables in :root / [data-theme] selectors do the rest.
 * @module ui/theme
 */

import { getCookie, setCookie } from '../utils/cookies.js';

const THEME_COOKIE = 'dashboard-theme';
const ONE_YEAR = 365 * 24 * 60 * 60;

/** Available themes (id → human label). */
export const THEMES = {
  dark: 'Dark',
  light: 'Light',
  amoled: 'AMOLED',
};

const themeIds = Object.keys(THEMES);

/**
 * Apply a theme to the document and persist choice.
 * @param {string} themeId
 */
export function setTheme(themeId) {
  if (!THEMES[themeId]) return;
  document.documentElement.setAttribute('data-theme', themeId);
  setCookie(THEME_COOKIE, themeId, ONE_YEAR);
}

/**
 * Get the currently active theme id.
 * @returns {string}
 */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

/**
 * Cycle to the next theme in the list.
 */
export function cycleTheme() {
  const current = getTheme();
  const idx = themeIds.indexOf(current);
  const next = themeIds[(idx + 1) % themeIds.length];
  setTheme(next);
}

/**
 * Restore theme from cookie or default to 'dark'.
 */
export function restoreTheme() {
  const saved = getCookie(THEME_COOKIE);
  setTheme(saved && THEMES[saved] ? saved : 'dark');
}

/**
 * Bind a button to cycle themes on click.
 * Updates the button label to show the current theme name.
 * @param {HTMLElement} btn
 */
export function bindThemeToggle(btn) {
  if (!btn) return;
  const updateLabel = () => {
    const id = getTheme();
    btn.textContent = THEMES[id] || id;
    btn.title = `Tema: ${THEMES[id] || id} — click per cambiare`;
  };
  updateLabel();
  btn.addEventListener('click', () => {
    cycleTheme();
    updateLabel();
  });
}
