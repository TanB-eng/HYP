# Implementation Plan: Zodiac Research Website (星座研究网站)

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Markup | HTML5 (semantic) | No framework, native browser support |
| Styling | CSS3 (Flexbox + Grid) | No preprocessor needed; custom properties for theming |
| Logic | Vanilla JavaScript (ES6+) | No build step, runs natively in browser |
| Data | Static JSON file | User-editable for future data updates |
| Storage | Browser `localStorage` | Persistent storage without server; works under `file://` |
| Graphics | Canvas 2D API | Star map rendering with animation; no external libraries |

## Libraries

None. The project uses zero external dependencies. All functionality is implemented with native browser APIs.

## Project Structure

```
D:\Github项目\HYP星座研究链接\
├── index.html                  # Single-page app shell with all views
├── css/
│   ├── variables.css           # CSS custom properties (colors, spacing, fonts)
│   ├── base.css                # Reset, typography, utility classes
│   ├── layout.css              # Grid/flex layouts, responsive breakpoints
│   ├── components.css          # Cards, buttons, nav, modals, tooltips
│   ├── starmap.css             # Star map canvas container styles
│   └── animations.css          # Twinkling stars, transitions, keyframes
├── js/
│   ├── data.js                 # Loads/parses zodiac.json, exports ZODIAC_DATA
│   ├── storage.js              # localStorage CRUD for favorites & notes
│   ├── router.js               # Simple hash-based router (#/, #/sign/:id, #/starmap, #/favorites, #/calculator)
│   ├── browse.js               # US1: Sign grid, search, filter, detail view
│   ├── starmap.js              # US2: Canvas zodiac wheel with animation
│   ├── favorites.js            # US3: Favorites list, notes editor, export
│   ├── calculator.js           # US4: Birthday → zodiac sign calculator
│   └── app.js                  # Main entry, init, event delegation
├── data/
│   └── zodiac.json             # 12 zodiac signs static data
└── specs/
    └── zodiac-website/
        ├── spec.md
        ├── plan.md
        └── tasks.md
```

## Architecture Decisions

### 1. Hash-Based Router (No Framework)

A simple router maps URL hash fragments to view functions:
- `#/` → Browse view (sign grid)
- `#/sign/:id` → Detail view for a specific sign
- `#/starmap` → Star map view
- `#/favorites` → Favorites & notes view
- `#/calculator` → Zodiac calculator view

**Rationale**: Hash routing works under `file://` protocol without a server. No history API issues.

### 2. View Rendering

Views are rendered by JavaScript functions that return HTML strings and inject them into a `<main>` container. No virtual DOM, no templating engine — just template literals.

### 3. Data Loading

`data.js` fetches `data/zodiac.json` via `fetch()`. Under `file://` protocol, `fetch()` works in Chrome/Firefox/Edge for local files. As a fallback, data can be embedded inline in `data.js` as a JS object.

**Decision**: Embed data directly in `data.js` as a JS object to ensure `file://` compatibility without fetch issues. The `data/zodiac.json` file is also provided for users who want to update data (they can copy new JSON into it and update the script tag).

### 4. Star Map Rendering

Canvas 2D API renders:
- A starry background (random stars with twinkling animation via alpha modulation)
- A circular zodiac wheel divided into 12 sectors (30° each)
- Each sector shows the sign symbol, name, and is color-coded by element
- Click detection via canvas coordinate mapping to sector angle

### 5. State Management

No centralized state store. Each module manages its own state:
- `storage.js` wraps localStorage with get/set/remove methods
- `browse.js` holds current search/filter state
- `favorites.js` reads from storage.js on each render
- `calculator.js` is stateless (computes on demand)

### 6. Deep-Space Visual Theme

Color palette (CSS custom properties):
- `--bg-deep`: #0a0e27 (deep space blue-black)
- `--bg-mid`: #1a1a3e (mid-space blue)
- `--bg-card`: rgba(30, 35, 70, 0.85) (translucent card)
- `--accent-gold`: #ffd700 (gold for symbols and highlights)
- `--accent-cyan`: #00e5ff (cyan for interactive elements)
- `--text-primary`: #e8e8ff (off-white)
- `--text-secondary`: #8888bb (muted blue)
- `--element-fire`: #ff6b35
- `--element-earth`: #8bc34a
- `--element-air`: #81d4fa
- `--element-water`: #4dd0e1

Background: Radial gradient simulating a galaxy core, with a CSS-generated star field (box-shadow dots) and a Canvas overlay for animated twinkling stars.

## Data Model

### Zodiac Sign Entity

12 signs, each with: id, name_cn, name_en, symbol, date_range, date_start, date_end, element, modality, ruling_planet, traits[], personality, mythology, lucky_numbers[], lucky_colors[], lucky_stones[], compatibility[], body_parts, keywords[].

### localStorage Schema

```javascript
// Key: "hyp_zodiac_favorites"
// Value: JSON string of string array, e.g. ["aries","leo","sagittarius"]

// Key: "hyp_zodiac_notes"
// Value: JSON string of object, e.g. {"aries": "Notes about Aries...", "leo": "Leo observations..."}
```

## Risk & Mitigation

| Risk | Mitigation |
|------|-----------|
| `fetch()` fails under `file://` in some browsers | Embed data inline in `data.js`; provide `zodiac.json` for user updates |
| localStorage quota exceeded (5MB) | Notes are text-only; 12 signs × ~1KB notes = ~12KB, well within limits |
| Canvas click detection precision | Use angle-based hit detection (360°/12 = 30° per sector) |
| Mobile performance with Canvas animation | Throttle frame rate on small screens; pause animation when tab not visible |
