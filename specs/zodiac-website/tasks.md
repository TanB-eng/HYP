# Tasks: Zodiac Research Website (星座研究网站)

## Implementation Strategy

**MVP-first, incremental delivery.** The project is built in phases: setup the project skeleton and deep-space theme, establish the data layer and storage utilities, then implement each user story in priority order (US1 → US2 → US3 → US4). Each user story is independently testable. The final phase polishes animations, responsiveness, and cross-feature integration.

**Suggested MVP scope**: Phase 1 + Phase 2 + US1 (browse & detail) — this gives a functional zodiac reference website. Remaining stories (star map, favorites, calculator) add richness incrementally.

---

## Phase 1: Setup

- [ ] T001 Create project directory structure and empty files per plan: `index.html`, `css/variables.css`, `css/base.css`, `css/layout.css`, `css/components.css`, `css/starmap.css`, `css/animations.css`, `js/data.js`, `js/storage.js`, `js/router.js`, `js/browse.js`, `js/starmap.js`, `js/favorites.js`, `js/calculator.js`, `js/app.js`, `data/zodiac.json`
- [ ] T002 [P] Create `index.html` with app shell: `<nav>` (4 nav links + logo), `<main id="app-view">` container, `<script>` tags for all JS modules in dependency order, `<link>` tags for all CSS files
- [ ] T003 [P] Create `css/variables.css` with deep-space color palette: `--bg-deep:#0a0e27`, `--bg-mid:#1a1a3e`, `--bg-card:rgba(30,35,70,0.85)`, `--accent-gold:#ffd700`, `--accent-cyan:#00e5ff`, `--text-primary:#e8e8ff`, `--text-secondary:#8888bb`, element colors (fire/earth/air/water), spacing, font, border-radius custom properties
- [ ] T004 [P] Create `css/base.css` with CSS reset, body background (radial gradient galaxy), typography (Chinese font stack), scrollbar styling, utility classes (.container, .hidden, .text-center)
- [ ] T005 [P] Create `css/animations.css` with keyframes: `twinkle` (opacity pulse for stars), `fade-in` (view transitions), `float` (subtle card hover lift), `rotate-slow` (background galaxy drift), `pulse-glow` (gold accent glow)

---

## Phase 2: Foundational

- [ ] T006 [P] Create `data/zodiac.json` with complete data for all 12 zodiac signs (Aries through Pisces), each containing: id, name_cn, name_en, symbol, date_range, date_start, date_end, element, modality, ruling_planet, traits[], personality, mythology, lucky_numbers[], lucky_colors[], lucky_stones[], compatibility[], body_parts, keywords[]
- [ ] T007 [P] Create `js/data.js` with inline ZODIAC_DATA array (same content as zodiac.json, embedded for file:// compatibility) and exports: `ZodiacData.getAll()`, `ZodiacData.getById(id)`, `ZodiacData.getByElement(element)`, `ZodiacData.search(query)`, `ZodiacData.getByDate(month, day)`
- [ ] T008 [P] Create `js/storage.js` with localStorage wrapper: `Favorites.getAll()`, `Favorites.toggle(id)`, `Favorites.has(id)`, `Favorites.count()`, `Notes.get(id)`, `Notes.set(id, text)`, `Notes.getAll()`, `Notes.exportJSON()`, using keys `hyp_zodiac_favorites` and `hyp_zodiac_notes`
- [ ] T009 Create `js/router.js` with hash-based router: routes map for `#/`→browse, `#/sign/:id`→detail, `#/starmap`→starmap, `#/favorites`→favorites, `#/calculator`→calculator; `Router.init()` listens to `hashchange`, `Router.navigate(path)` sets location.hash, `Router.current()` returns current route

---

## Phase 3: User Story 1 — Zodiac Browsing & Details (P1)

**Goal**: Users can browse all 12 zodiac signs in a grid, search/filter, and view detailed information for each sign.
**Independent Test**: Open `index.html` in browser → see 12 sign cards → type in search → filter by element → click a card → see full details → click back → return to grid.

- [ ] T010 [P] [US1] Create `css/layout.css` with responsive grid layout for sign cards (auto-fill, minmax 200px), detail view layout (two-column: info + sidebar), media queries for 320px/768px/1024px breakpoints
- [ ] T011 [P] [US1] Create `css/components.css` with styles for: sign card (translucent bg, symbol, name, date, element badge), search input, filter buttons, detail view sections, back button, favorite toggle button, notes textarea
- [ ] T012 [US1] Implement `js/browse.js` `renderBrowseView()`: generates grid of 12 sign cards from `ZodiacData.getAll()`, each card shows symbol glyph, name_cn, name_en, date_range, element badge (color-coded); cards link to `#/sign/{id}`
- [ ] T013 [US1] Implement search bar in `js/browse.js`: input field filters signs by name_cn, name_en, or keywords in real-time; re-renders grid on input
- [ ] T014 [US1] Implement element filter in `js/browse.js`: 5 buttons (全部/火/土/风/水) that filter the grid by element; active button highlighted; works combined with search
- [ ] T015 [US1] Implement `renderDetailView(id)` in `js/browse.js`: full sign detail page with all fields from data (dates, element, modality, ruling planet, traits, personality, mythology, lucky numbers/colors/stones, compatibility, body parts); includes back button and favorite toggle button (UI only, wired in US3)

---

## Phase 4: User Story 2 — Interactive Star Map (P2)

**Goal**: Users can view a circular zodiac wheel on a Canvas with twinkling star background, and click signs to navigate to details.
**Independent Test**: Navigate to `#/starmap` → see circular wheel with 12 sectors → hover shows tooltip → click a sector → navigate to that sign's detail page.

- [ ] T016 [P] [US2] Create `css/starmap.css` with full-viewport canvas container styling, tooltip styles (translucent dark bg, gold border, positioned absolute), responsive canvas sizing
- [ ] T017 [US2] Implement `js/starmap.js` `initStarMap()`: Canvas setup with devicePixelRatio scaling, draws starry background (200+ random stars with twinkling animation via requestAnimationFrame alpha modulation)
- [ ] T018 [US2] Implement zodiac wheel rendering in `js/starmap.js`: draws 12 sectors (30° each) in a circle, each sector filled with element color (low opacity), sign symbol glyph rendered at sector center, sign name_cn label below symbol
- [ ] T019 [US2] Implement hover interaction in `js/starmap.js`: mousemove event maps canvas coordinates to angle → sector index; shows tooltip with sign name and date range; highlights hovered sector (increased opacity, gold border)
- [ ] T020 [US2] Implement click navigation in `js/starmap.js`: click event maps coordinates to sector → `Router.navigate('#/sign/' + signId)`; add cursor:pointer on hover

---

## Phase 5: User Story 3 — Favorites & Notes (P3)

**Goal**: Users can favorite signs, write notes, view all favorites in one place, and export notes as JSON.
**Independent Test**: Open a sign detail → click favorite → go to favorites page → see the sign listed → type a note → save → reload page → note persists → export notes → download JSON file.

- [ ] T021 [P] [US3] Wire favorite toggle button in `js/browse.js` detail view: clicking calls `Favorites.toggle(id)`, updates button state (filled star vs outline), updates nav badge count
- [ ] T022 [P] [US3] Add notes textarea to detail view in `js/browse.js`: below favorite button, auto-saves to `Notes.set(id, text)` on input with debounce (500ms); loads existing note on render via `Notes.get(id)`
- [ ] T023 [US3] Implement `js/favorites.js` `renderFavoritesView()`: lists all favorited signs (from `Favorites.getAll()`), each with name, symbol, date range, note indicator (if note exists), and link to detail view; shows empty state message if no favorites
- [ ] T024 [US3] Implement notes editor in `js/favorites.js`: each favorited sign has an expandable notes section with textarea, save button, and character count; saved via `Notes.set()`
- [ ] T025 [US3] Implement export notes button in `js/favorites.js`: "导出笔记" button creates a Blob from `Notes.exportJSON()`, triggers download as `zodiac-notes.json`; also implement "清空全部" button with confirmation dialog

---

## Phase 6: User Story 4 — Zodiac Calculator (P4)

**Goal**: Users can enter their birthday and find out their zodiac sign, with a link to the full detail page.
**Independent Test**: Navigate to `#/calculator` → select month and day → click calculate → see result with sign name, symbol, brief description → click "查看详情" → go to detail page.

- [ ] T026 [P] [US4] Implement `js/calculator.js` `renderCalculatorView()`: month dropdown (1-12), day dropdown (1-31, dynamically adjusted by month), "查询" button, "今天" quick-select button; styled with deep-space theme
- [ ] T027 [US4] Implement date-to-sign calculation in `js/calculator.js`: uses `ZodiacData.getByDate(month, day)` which checks date_start/date_end ranges; handles year-wrapping (Capricorn: Dec 22 - Jan 19); identifies cusp dates (boundary ±1 day) to show both signs
- [ ] T028 [US4] Implement result display in `js/calculator.js`: shows sign symbol (large, gold), name_cn, name_en, date_range, brief personality (first 100 chars of personality field), "查看详情" button linking to `#/sign/{id}`; if cusp, shows both signs with "边界星座" label
- [ ] T029 [US4] Implement input validation in `js/calculator.js`: invalid dates (e.g., Feb 30, Apr 31) show error message; day dropdown dynamically updates valid days based on selected month (28/29/30/31)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T030 [P] Create `js/app.js` entry point: initializes router, loads data, renders initial view, sets up global event delegation, handles view transition animations (fade-in)
- [ ] T031 [P] Add CSS-generated animated star field background in `css/animations.css`: use box-shadow technique to create 100+ static stars on body::before with varying sizes and twinkle animation delays
- [ ] T032 [P] Add responsive navigation bar: collapses to icon-only on mobile (320px), full labels on tablet (768px+); active nav item highlighted with gold underline
- [ ] T033 [P] Add favorites count badge to nav "我的收藏" link: updates via event when favorites change; hidden when count is 0
- [ ] T034 Add keyboard navigation: tab through sign cards, enter to open detail; escape to go back; tab through nav links
- [ ] T035 Add loading states: "加载中..." spinner while data initializes; empty state messages for search with no results and favorites with no items
- [ ] T036 Final visual polish: consistent spacing, hover transitions on all interactive elements, element color coding throughout (badges, borders, star map sectors), typography hierarchy
- [ ] T037 Verify all features work end-to-end by opening index.html in Chrome: test browse → search → filter → detail → favorite → notes → favorites page → star map → calculator → export notes → reload persistence

---

## Dependencies

```
Phase 1 (Setup) ── no dependencies, all [P] tasks can run in parallel
    │
    ▼
Phase 2 (Foundational)
    T006 (data) ── no dependency on Phase 1
    T007 (data.js) depends on T006 (data structure)
    T008 (storage.js) ── no dependency
    T009 (router.js) depends on T002 (index.html structure)
    │
    ▼
Phase 3 (US1: Browse & Details) ── depends on T007 (data), T009 (router)
    T010, T011 [P] can run in parallel (CSS)
    T012 depends on T010 (layout), T011 (components), T007 (data)
    T013, T014 depend on T012 (browse view exists)
    T015 depends on T012, T011 (detail styling)
    │
    ▼
Phase 4 (US2: Star Map) ── depends on T007 (data), T009 (router)
    T016 [P] can run in parallel with US1
    T017 depends on T016 (starmap CSS)
    T018 depends on T017 (canvas setup)
    T019, T020 depend on T018 (wheel rendered)
    │ (US2 is independent of US1 — can be developed in parallel)
    ▼
Phase 5 (US3: Favorites) ── depends on T008 (storage), T015 (detail view)
    T021, T022 [P] can run in parallel
    T023 depends on T021 (favorites toggle works)
    T024 depends on T023 (favorites view exists)
    T025 depends on T024 (notes editor exists)
    │
    ▼
Phase 6 (US4: Calculator) ── depends on T007 (data with getByDate)
    T026 [P] can start in parallel with US3
    T027 depends on T026 (calculator view), T007 (getByDate)
    T028, T029 depend on T027 (calculation logic)
    │
    ▼
Phase 7 (Polish) ── depends on all prior phases
    T030 (app.js) depends on all modules existing
    T031-T036 [P] can run in parallel
    T037 (verification) depends on everything
```

## Parallel Execution Examples

**Phase 1 (all parallel):**
- Agent A: T002 (index.html)
- Agent B: T003 (variables.css) + T004 (base.css)
- Agent C: T005 (animations.css)
- Agent D: T006 (zodiac.json)

**Phase 2 (mostly parallel):**
- Agent A: T007 (data.js) — after T006
- Agent B: T008 (storage.js) — independent
- Agent C: T009 (router.js) — after T002

**Cross-story parallel (US1 + US2 + US4 start):**
- Agent A: US1 tasks (T012-T015)
- Agent B: US2 tasks (T016-T020) — independent of US1
- Agent C: US4 task T026 (calculator UI) — independent of US1/US2

**Phase 7 (all parallel except T037):**
- Agent A: T030 (app.js) + T031 (star field)
- Agent B: T032 (responsive nav) + T033 (badge)
- Agent C: T034 (keyboard) + T035 (loading states)
- Agent D: T036 (visual polish)
- Final: T037 (verification) — single agent, after all above
