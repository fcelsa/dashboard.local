/**
 * Application entry point.
 * Imports all modules and kicks off initialization.
 * Loaded as <script type="module"> — runs after DOM is parsed.
 * @module main
 */

import { renderMoonPhase } from './moon.js';
import { initDashboard } from './script.js';
import { restoreTheme, bindThemeToggle } from './ui/theme.js';
import { initTabs } from './ui/tabs.js';
// Side-effect imports: each module self-initialises on import
import './calculator.js';
import './calc-sheet.js';

// --- Theme ---
restoreTheme();
bindThemeToggle(document.getElementById('theme-toggle'));

// --- Tabs ---
const calculatorPanel = document.getElementById('calculator-panel');
if (calculatorPanel) {
  initTabs(calculatorPanel);
}

// --- Dashboard (calendar, clock, FX) ---
renderMoonPhase();
initDashboard();
