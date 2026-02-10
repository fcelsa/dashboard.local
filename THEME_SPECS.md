# Theme Specifications

## Overview
This document outlines the color and styling specifications for the two new custom themes: **Mac1990** and **NeXTSTEP**. Both themes are fully integrated into the dashboard and calculator while maintaining all functionality.

---

## Implementation Architecture

### Theme System
- **Switching mechanism**: `data-theme` attribute on `<html>` element(s)
- **Persistence**: Cookie-based (`dashboard-theme`)
- **CSS variables**: Centralized in `:root` and theme-specific overrides in `[data-theme="..."]` selectors
- **JavaScript handler**: `js/ui/theme.js` manages theme state, cycling, and restoration

### CSS Variables
Calculator and UI components use semantic CSS variables instead of hard-coded colors:
```css
--calc-bg, --calc-panel, --calc-border
--vfd-bg, --vfd-bg-off, --vfd-text, --vfd-text-dim, --vfd-accent
--key-bg-default, --key-bg-numeric, --key-bg-cyan, --key-bg-green, --key-bg-light-green
--key-bg-gray, --key-bg-gray-thumb
--key-text-light, --key-text-dark, --key-text-cyan, --key-minus-color
--led-off, --led-on, --led-glow
--switch-track, --switch-thumb, --switch-label, --switch-ticks
--paper-bg, --paper-tape-bg, --paper-ink
```

All variables have fallback defaults for backward compatibility.

---

## Theme 1: Mac1990 — Minimalist Pixelated Aesthetic

### Design Philosophy
A minimalist, light-themed design inspired by Apple Macintosh (1990s era) with modern refinements. Think silver-gray interface with subtle depth, small rounded corners (pixel-like grid), and muted blue/green accents. The aesthetic favors simplicity, readability, and a gentle tactile appearance.

### Palette

| Component | Color | Hex | Purpose |
|-----------|-------|-----|---------|
| **Background** | Silver Gray | `#e0e0e0` | Main app background |
| **Panels** | Light Gray | `#e8e8e8` | Card backgrounds |
| **Text** | Dark Gray | `#222222` | Primary text |
| **Muted text** | Medium Gray | `#666666` | Secondary text |
| **Primary accent** | Mac Blue | `#0066cc` | Links, highlights |
| **Secondary accent** | Mint Green | `#00aa00` | Active/success states |
| **Shadow** | Black 15% | `rgba(0, 0, 0, 0.15)` | Subtle drop shadows |
| **Border radius** | Minimal | `4px` | Pixelated/grid-like corners |

### Calculator-Specific Styling

| Element | Color | Hex | Notes |
|---------|-------|-----|-------|
| **Chassis (calc-body)** | System Gray | `#c0c0c0` | Classic Macintosh gray |
| **Display background** | System Gray | `#c0c0c0` | Uniform with chassis |
| **Display text** | Mac Blue | `#004488` | High contrast on gray |
| **Key background** | Silver | `#dfdfdf` | Slightly lighter than chassis |
| **Key foreground (numeric)** | System Gray | `#c0c0c0` | Subtly recessed buttons |
| **Paper background** | System Gray | `#c0c0c0` | Matches calculator |
| **Paper tape** | Off-white | `#f5f5f0` | Classic typewriter paper |
| **Paper ink** | Black | `#222` | Dark text on paper |
| **LED (off)** | Light Gray | `#cccccc` | Disabled state |
| **LED (on)** | Orange | `#ff6600` | Activity indicator |

### Typography
- **UI font**: `Inter` (default), fallback to system sans-serif
- **Monospace (optional)**: `Press Start 2P` imported but not enforced; fallback to standard monospace
- **Approach**: Maintains readability with subtle pixel-aligned grid aesthetic

### Interaction & Effects
- Minimal shadows (15% opacity max)
- Smooth transitions (0.2–0.3s)
- No gradients; flat colors with carefully chosen gray tones
- Subtle inset/outset effects on buttons to suggest physical 3D buttons
- Focus states use Mac Blue accent

### Contrast & Accessibility
- All text on background: WCAG AA compliant
- Display text on VFD: High contrast (blue on gray)
- Buttons: Sufficient visual relief via shadows and color shifts

---

## Theme 2: NeXTSTEP — Charcoal Professional Aesthetic

### Design Philosophy
A dark-themed aesthetic inspired by NeXTSTEP operating system (1989–1996). Emphasizes sharp contrast, bold typography, clean lines with no rounded corners, and warm accent colors (orange/amber). The visual language is modern, professional, and evokes a sense of technical precision with high-contrast foreground/background relationships.

### Palette

| Component | Color | Hex | Purpose |
|-----------|-------|-----|---------|
| **Background** | Charcoal | `#2a2a2a` | Main app background |
| **Panels** | Dark Charcoal | `#3a3a3a` | Card backgrounds |
| **Panel soft** | Mid Charcoal | `#4a4a4a` | Slightly lighter panels |
| **Text** | White | `#ffffff` | Primary text, high contrast |
| **Muted text** | Light Gray | `#aaaaaa` | Secondary text |
| **Primary accent** | Warm Amber | `#ffaa00` | Primary highlights, active states |
| **Secondary accent** | Teal/Cyan | `#00cc99` | Complementary accent |
| **Shadow** | Black 50% | `rgba(0, 0, 0, 0.5)` | Deep, pronounced shadows |
| **Border radius** | None | `0px` | Sharp, clean edges (NeXTSTEP signature) |

### Calculator-Specific Styling

| Element | Color | Hex | Notes |
|---------|-------|-----|-------|
| **Chassis (calc-body)** | Mid Charcoal | `#4a4a4a` | Prominent, frame-like |
| **Display background** | Very Dark | `#1a1a1a` | Deep, LED-like appearance |
| **Display text** | Warm Amber | `#ffaa00` | Glowing effect on dark background |
| **Key background** | Dark Gray | `#555555` | Supports amber text |
| **Key foreground (numeric)** | Charcoal | `#2a2a2a` | Deeply recessed |
| **Paper background** | Mid Charcoal | `#4a4a4a` | Matches calculator frame |
| **Paper tape** | Dark Charcoal | `#2a2a2a` | Darker than background |
| **Paper ink** | Warm Amber | `#ffaa00` | Bold, warm text |
| **LED (off)** | Dark Gray | `#333` | Subtle off-state |
| **LED (on)** | Warm Amber | `#ffaa00` | Matches display accent |
| **Switch track** | Very Dark | `#1a1a1a` | Deep, recessed slots |
| **Switch thumb** | Medium Gray | `#666` | Visible against dark track |

### Typography
- **UI font**: `Inter` (default), clean sans-serif
- **Monospace**: `Droid Sans Mono` for display/data
- **Accent styling**: Bold weights + all-caps labels to emulate NeXTSTEP typeface conventions

### Interaction & Effects
- Sharp, zero-radius corners throughout (no `border-radius` except for circles)
- Deep shadows (50% opacity) to emphasize dimensional hierarchy
- Smooth transitions but purposeful (animated state changes)
- High contrast: white/amber on charcoal creates visual pop
- NeXTSTEP-signature look: bold lines, strong borders, professional monospace displays

### Contrast & Accessibility
- Display text (amber) on dark background: WCAG AAA compliant (high contrast)
- All other text: Strong contrast maintained
- Focus states: Amber borders or backgrounds

---

## CSS Files Updated

### `css/styles.css`
- **Lines 1–4**: Added `@import` for `Press Start 2P` font (Mac1990)
- **Blocks added**:
  - `[data-theme="mac1990"]` with 50+ CSS variables
  - `[data-theme="nextstep"]` with 50+ CSS variables
- **Existing themes enhanced**: All three existing themes (`dark`, `light`, `amoled`) now include calculator-specific variable definitions

### `css/calculator.css`
- **Refactored**: ~30 rules now use CSS variables instead of hard-coded colors
- **Maintained fallbacks**: Each rule like `background: var(--calc-bg, #556887)` ensures backward compatibility
- **No layout changes**: All grid, flex, sizing, and positioning remain identical

### `js/ui/theme.js`
- **Updated `THEMES` map**:
  ```javascript
  export const THEMES = {
    dark: 'Dark',
    light: 'Light',
    amoled: 'AMOLED',
    mac1990: 'Mac1990',
    nextstep: 'NeXTSTEP',
  };
  ```

---

## Testing Checklist

### Functional Tests
- [ ] Theme toggle cycles through all 5 themes (Dark → Light → AMOLED → Mac1990 → NeXTSTEP → Dark)
- [ ] Cookie persistence: theme choice saved and restored on page reload
- [ ] No broken styles; all panels, buttons, and UI elements visible and interactive

### Visual Tests (Manual browser inspection)
- **Mac1990 theme**:
  - [ ] Background is light silver-gray
  - [ ] Text is dark and readable
  - [ ] Buttons have subtle 3D effect (slight shadow)
  - [ ] Blue accents visible on interactive elements
  - [ ] Pixelated aesthetic (small radius, grid-like)
  - [ ] VFD display is blue text on gray background
  
- **NeXTSTEP theme**:
  - [ ] Background is dark charcoal
  - [ ] Text is white with high contrast
  - [ ] All corners are sharp (radius = 0)
  - [ ] Amber/orange accents on hover and focus states
  - [ ] Deep shadows create layered appearance
  - [ ] Display shows amber/orange glow effect
  - [ ] Professional, technical aesthetic achieved

### Contrast & Accessibility
- [ ] WCAG AA contrast ratio met for all text/background pairs
- [ ] Focus indicators visible and clear in all themes
- [ ] Keyboard navigation unaffected

### Calculator Specific
- [ ] All buttons functional: numbers, operators, memory, clear
- [ ] Tape/paper display scrolls and records transactions correctly
- [ ] Switches (AC/PRT, RO/DEC/etc.) respond to input
- [ ] VFD LED animation (on/off pulse) visible and themed correctly

### Cross-Browser (Optional)
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari (if available)

---

## Future Enhancements

1. **Font variations**: Optionally assign `Press Start 2P` to headings in Mac1990 for more retro effect
2. **Mac1990 texture**: Add subtle, barely-visible grain overlay via `--grain-opacity` variable
3. **NeXTSTEP borders**: Thicker borders on panels to emulate NeXTSTEP's aesthetic further
4. **Keyboard navigation indicators**: Enhance focus rings to match theme character
5. **Additional themes**: Extend with themes inspired by Classic Amiga, Windows 3.1, etc.

---

## Technical Notes

### Variable Fallbacks
All variables are defined with safe fallbacks:
```css
color: var(--vfd-text, #00ffaa);
```
If `--vfd-text` is not set, defaults to the original dark theme color. This ensures:
- Graceful degradation in older browsers
- Ease of testing (can selectively override variables)
- Quick rollback if a theme definition is incomplete

### No Inline Styles
No inline `style` attributes are used for theming. All changes are CSS variable-driven, allowing single-point updates.

### Layout Invariance
Themes affect only:
- Colors
- Fonts (optionally)
- Shadows
- Gradients

No layout, grid, flex, sizing, or positioning is theme-dependent. The dashboard structure remains identical across all themes.

---

## Developer Notes

### Adding a New Theme
1. Add a new entry to `THEMES` in `js/ui/theme.js`
2. Define a new `[data-theme="mytheme"]` selector block in `css/styles.css` with all required CSS variables
3. Test by toggling theme and verifying colors/styling
4. Document the new theme's philosophy and palette in this file

### Modifying Existing Themes
1. Update the relevant variable assignments in the theme's block in `css/styles.css`
2. Test in browser to verify changes cascade correctly
3. Check contrast ratios and accessibility

### Debugging Themes
Use browser DevTools:
1. Inspect `<html data-theme="...">` to confirm active theme
2. Compute Style panel shows final variable values (right-click element → Inspect)
3. Filter CSS rules to see which variables are active

---

## References & Inspiration

- **Mac1990**: Early Macintosh UI design, System 7 era (1991–1997)
  - Characteristic: Light gray palette, rounded buttons, minimal shadows
  - Reference: Classic Mac OS interfaces

- **NeXTSTEP**: NeXTSTEP operating system (1989–1996)
  - Characteristic: Dark background, warm accents, no-radius design, high contrast
  - Reference: NeXTSTEP desktop and application aesthetics

Both themes are modern interpretations of historical OS designs, blended with contemporary web design principles for readability and accessibility.
