# Refactoring Notes

## Code Organization Completed
- ✅ Moved all JavaScript files to `js/` folder
- ✅ Moved all CSS files to `css/` folder
- ✅ Updated HTML references
- ✅ Renamed `example-file` to `reference-images` for clarity

## ES Modules Migration — Completed @2026-02-07
- ✅ Converted all JS files to ES modules (`export` / `import`)
- ✅ Created `js/main.js` entry point (single `<script type="module">` in `index.html`)
- ✅ Removed all `window.*` global exports (`window.CalculatorEngine`, `window.updateMoonPhase`)
- ✅ Removed CJS/browser bridge in `calculator-engine.js`
- ✅ Removed IIFE wrapper in `calc-sheet.js` (replaced with `initCalcSheet()`)
- ✅ Added `package.json` (`"type": "module"`)

## Cookie/Storage Extraction — Completed @2026-02-07
- ✅ Created `js/utils/cookies.js` with `getCookie`, `setCookie`, `deleteCookie`
- ✅ Removed duplicate cookie functions from `js/script.js` and `js/calculator.js`
- ✅ Updated callers to pass explicit `maxAgeSeconds` where needed

## Known Code Duplication (Future Refactoring)

### Math/Number Formatting
`formatNumber()` exists in two files but serves **different purposes** — do NOT unify blindly:
- `js/calculator.js` → VFD display formatter (thousands separator `'`, locale comma, respects DEC switch)
- `js/calc-sheet.js` → spreadsheet cell formatter (3-decimal, comma, no thousands separator)

Shared pure helpers that **could** be extracted to `js/utils/number-utils.js`:
- `roundToDecimals(value, decimals)` — `js/calculator-engine.js`
- `round3(value)` — `js/calc-sheet.js` (special case of `roundToDecimals`)
- `normalizeDecimal(value)` — `js/calc-sheet.js` (could benefit `calculator-engine.js`)
- `isNumericString(value)` — `js/calc-sheet.js` only

### Date/Time Functions
Date formatting appears in multiple places:
- `formatShortDateTime()` — `js/moon.js`
- Various date formatting in `js/script.js` for calendar
- `toJulianDay()` / `fromJulianDay()` — `js/moon.js` (specialized astronomical functions)

Calendar-specific date utilities could be extracted to `js/utils/calendar-utils.js`.

### Angle/Trigonometry
Math functions in `js/moon.js`:
- `normalizeDegrees()`
- `toRad()`

These are specific to astronomical calculations and best left in `moon.js`.

## Remaining Refactoring Targets

### R3 — Split `calculator-engine.js` (HIGH priority) — IN PROGRESS
- ~~File is ~1 738 lines~~ → now ~1 648 lines after extraction
- **Completed steps** @2026-02-07:
  1. ✅ Extracted business-math helpers → `js/engine/business-math.js` (8 pure functions, JSDoc)
  2. ✅ Extracted rounding helpers → `js/utils/number-utils.js` (`roundToDecimals`, `applyRounding`)
  3. ✅ `calculator-engine.js` now imports from both modules
- **Remaining steps**:
  3. Extract undo/redo + memory state → `js/engine/state.js`
  4. Keep `CalculatorEngine` class as orchestrator with a clean public API
- Risk: **high** — engine is the core; requires manual testing of all calculator operations

### R4 — Decouple calculator UI from engine (MEDIUM priority)
- `js/calculator.js` (~850 lines) directly instantiates engine and wires many DOM callbacks
- **Suggested steps**:
  1. Define clear engine public API (methods + callback properties) with JSDoc
  2. Move DOM selectors into an `initCalculator(refs)` pattern (receive refs, don't query document)
  3. Consider removing the `DOMContentLoaded` wrapper (modules are deferred)
- Risk: **medium** — mostly wiring changes

### R6 — Split large DOM-building functions (MEDIUM priority)
- `buildMonthCard()` in `js/script.js` (~100 lines of DOM creation)
- Chart draw/resize functions (~60 lines each)
- **Suggested steps**: extract `createDayCell()`, `renderWeekHeader()`, move chart drawing to `js/ui/chart.js`
- Risk: **medium**

### R7 — Split `calc-sheet.js` responsibilities (MEDIUM priority)
- File is ~780 lines: UI grid, selection logic, IndexedDB persistence, formula evaluation
- **Suggested steps**:
  1. Move IndexedDB persistence → `js/utils/storage-db.js`
  2. Move formula parser/evaluator → `js/utils/formula-engine.js`
  3. Keep UI glue in `calc-sheet.js`
- Risk: **medium**

### R8 — Consolidate DOM selectors (LOW priority)
- `js/script.js` and `js/calculator.js` declare many top-level `const` for DOM elements
- Move selectors into `init()` functions that accept or return a refs object
- Risk: **low** — cosmetic, improves testability

### Cosmetic — De-indent `calc-sheet.js`
- After IIFE removal the body of `initCalcSheet()` retains the original 2-space indent; code is correct but could be re-formatted for consistency.
- Risk: **low** — purely cosmetic, large diff

## Coding Convention Checklist
- [ ] Add JSDoc to all exported / public functions
- [ ] Remove remaining inline styles in `calc-sheet.js` (`cell.style.*`) — move to CSS utility classes
- [ ] Remove the single inline `style` attribute on a calculator key in `index.html`
- [x] Eliminate `window.*` global exports (done @2026-02-07)
- [x] Eliminate duplicate cookie utilities (done @2026-02-07)

## Naming Conventions

### Current Standards
- Functions: camelCase (e.g., `renderMoonPhase`, `getCookie`)
- Constants: UPPER_SNAKE_CASE (e.g., `SYNODIC_MONTH`, `MOON_PHASES`)
- DOM elements: camelCase with descriptive suffixes (e.g., `fxPriceEl`, `vfdDisplay`)
- CSS classes: kebab-case (e.g., `moon-icon`, `vfd-display`)

## Known Bug
- `DEFAULT_FREECURRENCY_KEY` is referenced in `js/script.js` (line ~498) but never defined — would throw `ReferenceError` when `location.protocol === "file:"` and no other key source is available.
