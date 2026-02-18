# Dashboard Local

Dashboard with calendar, Eur<>USD exchange, calculator, sheet and eventually some other utility.

## GitHub Pages

This repository it's automatically published on GitHub Pages.

## Disclaimer ⚠️

This is a personal project for my work environment, currently under development. There is no guarantee that the page will work as expected; you have been warned!

## Notes about calculator

The calculator is a highly customized imitation of the Olivetti business desktop calculators from the 1970s and 1980s, but don't expect it to work exactly like those!

## Project Structure

```
dashboard.local/
├── index.html              # Main page
├── package.json            # Project metadata (ES modules)
│
├── css/                    # Stylesheets
│   ├── styles.css          # General styles
│   ├── calculator.css      # Calculator styles
│   └── calc-sheet.css      # Calc-sheet styles
│
└── js/                     # JavaScript modules (ES6)
    ├── main.js             # Application entry point
    ├── script.js           # Dashboard (calendar, FX, clock)
    ├── calculator.js       # Calculator UI & interactions
    ├── calculator-engine.js # Calculator core engine
    ├── calc-sheet.js       # Spreadsheet functionality
    ├── moon.js             # Moon phase calculations
    │
    ├── engine/             # Business logic
    │   └── business-math.js
    │
    ├── ui/                 # UI components
    │   ├── calendar-views.js
    │   ├── tabs.js
    │   └── theme.js
    │
    └── utils/              # Utilities
        ├── calc-history-db.js
        ├── cookies.js
        ├── dashboard-sync.js
        ├── gist-sync.js
        └── number-utils.js
```

## Development

- Built with vanilla JavaScript (ES6 modules)
- No build step required
- Serve locally: `npm start` (runs on http://localhost:5000/)

