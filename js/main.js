/**
 * Application entry point.
 * Imports all modules and kicks off initialization.
 * Loaded as <script type="module"> — runs after DOM is parsed.
 * @module main
 */

import { renderMoonPhase } from './moon.js';
import { initDashboard } from './script.js';
// Side-effect imports: each module self-initialises on import
import './calculator.js';
import './calc-sheet.js';

renderMoonPhase();
initDashboard();
