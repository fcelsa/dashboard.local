# Refactoring Notes

## Code Organization Completed
- ✅ Moved all JavaScript files to `js/` folder
- ✅ Moved all CSS files to `css/` folder
- ✅ Updated HTML references
- ✅ Renamed `example-file` to `reference-images` for clarity

## Known Code Duplication (Future Refactoring)

### Math/Number Formatting
The following numeric utility functions exist in multiple files with slight variations:
- `formatNumber()` - exists in js/calc-sheet.js and implicitly in js/calculator.js
- `round3()` / `roundToDecimals()` - js/calc-sheet.js and js/calculator-engine.js
- `normalizeDecimal()` - js/calc-sheet.js (could benefit calculator-engine.js)
- `isNumericString()` - js/calc-sheet.js only

**Recommendation**: Consider creating a shared `js/utils/number-utils.js` in future iterations.

### Storage Operations
Cookie management functions are duplicated:
- `getCookie()`, `setCookie()`, `deleteCookie()` - js/script.js
- Similar cookie functions may exist in js/calculator.js

**Recommendation**: Consider creating `js/utils/storage.js` for centralized storage operations.

### Date/Time Functions
Date formatting appears in multiple places:
- `formatShortDateTime()` - js/moon.js
- Various date formatting in js/script.js for calendar
- `toJulianDay()` / `fromJulianDay()` - js/moon.js (specialized astronomical functions)

**Recommendation**: Calendar-specific date utilities could be extracted to `js/utils/calendar-utils.js`.

### Angle/Trigonometry
Math functions in js/moon.js:
- `normalizeDegrees()`
- `toRad()`

These are specific to astronomical calculations and probably best left in moon.js.

## Naming Conventions

### Current Standards
- Functions: camelCase (e.g., `renderMoonPhase`, `getCookie`)
- Constants: UPPER_SNAKE_CASE (e.g., `SYNODIC_MONTH`, `MOON_PHASES`)
- DOM elements: camelCase with descriptive suffixes (e.g., `fxPriceEl`, `vfdDisplay`)
- CSS classes: kebab-case (e.g., `moon-icon`, `vfd-display`)

### Areas for Improvement
- Boolean functions could be more consistently prefixed with `is` or `has`
- Some event handler functions could follow a consistent `handle` or `on` prefix pattern

## No Breaking Changes
All refactoring maintains 100% backward compatibility. The application works exactly as before.

## Code Review Findings

The automated code review identified some minor improvements that don't affect functionality:

### Comment Consistency
- Some comments are in Italian while others are in English
- Error messages could be more actionable
- Consider standardizing comment language in future iterations

### Specific Notes
- `js/calculator.js` line 27-29: Error message could be more helpful
- `js/moon.js` lines 159-166: Mixed language comments
- `js/calculator.js` line 743: Italian comment could be translated
- `js/script.js` lines 227-228: "Feb skip bug" comment could be expanded

These are documentation/comment improvements that don't affect code execution and can be addressed in future PRs if desired.
