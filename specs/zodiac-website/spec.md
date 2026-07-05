# Feature Spec: Zodiac Research Website (星座研究网站)

## Overview

A pure frontend website for researching the 12 signs of the zodiac (黄道十二宫). The site features an immersive deep-space visual theme, with zodiac sign browsing, an interactive star map, personal favorites/notes (persisted in localStorage), and a birthday-to-sign calculator. No backend, no deployment — runs by opening `index.html` in a browser.

## Target Users

- Astrology enthusiasts who want a visually immersive reference for the 12 zodiac signs
- Users who want to quickly find their zodiac sign from their birthday
- Users who want to save personal notes about signs they're interested in

## User Stories

### US1: Zodiac Browsing & Details (P1)

**As a** zodiac enthusiast,
**I want** to browse all 12 zodiac signs and view detailed information for each,
**so that** I can learn about each sign's dates, element, ruling planet, personality traits, and mythology.

**Acceptance Criteria:**
- A grid or list view showing all 12 zodiac signs with name (Chinese + English), symbol, and date range
- Clicking a sign opens a detail view with: dates, element (火/土/风/水), modality (基本/固定/变动), ruling planet, symbol glyph, personality traits, mythology/story, lucky numbers, lucky colors, lucky stones, and compatibility info
- A search bar to filter signs by name
- Filter by element type (火/土/风/水)
- The detail view includes a "back to list" navigation
- Each sign card shows its element color coding

### US2: Interactive Star Map (P2)

**As a** visual learner,
**I want** to see an interactive star map of the zodiac wheel,
**so that** I can visually explore the 12 signs arranged in their astrological order.

**Acceptance Criteria:**
- A circular zodiac wheel (Canvas-based) showing all 12 signs arranged in a circle
- Each sign sector is clickable, navigating to that sign's detail view
- Hovering over a sector shows a tooltip with the sign name and date range
- The currently selected/highlighted sign is visually distinguished
- The wheel has a starry background with twinkling animation
- Sign symbols (♈♉♊♋♌♍♎♏♐♑♒♓) are rendered at each sector position
- Responsive: works on both desktop and mobile screen sizes

### US3: Favorites & Notes (P3)

**As a** researcher,
**I want** to bookmark zodiac signs and write personal notes,
**so that** I can keep track of signs I'm studying and record my observations.

**Acceptance Criteria:**
- A "收藏" (favorite) button on each sign's detail view
- Favorited signs are marked with a visual indicator (e.g., star icon) in the browse list
- A "我的收藏" (my favorites) view showing all favorited signs
- Each favorited sign has a notes textarea where users can type and save personal notes
- Notes are saved to localStorage and persist across page reloads
- A "导出笔记" (export notes) button to download all notes as a JSON file
- Un-favoriting a sign removes it from the favorites view (notes are retained in storage for re-favoriting)
- An indicator showing the total number of favorited signs in the navigation

### US4: Zodiac Calculator (P4)

**As a** curious user,
**I want** to enter my birthday and find out my zodiac sign,
**so that** I can quickly discover which sign I am.

**Acceptance Criteria:**
- A date picker input for selecting a birthday
- A "查询" (calculate) button that determines the zodiac sign from the date
- The result shows the sign name (Chinese + English), symbol, date range, and a brief description
- The result includes a "查看详情" (view details) button linking to the full detail view
- Edge dates (sign boundaries) are handled correctly per standard zodiac date ranges
- If the date falls on a cusp (boundary date), both signs are mentioned
- Input validation: invalid dates show an error message
- A "今天" (today) quick-select button for convenience

## Data Model

### ZodiacSign (static JSON)

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier (e.g., "aries") |
| name_cn | string | Chinese name (e.g., "白羊座") |
| name_en | string | English name (e.g., "Aries") |
| symbol | string | Unicode glyph (e.g., "♈") |
| date_range | string | Human-readable date range (e.g., "3月21日 - 4月19日") |
| date_start | string | ISO date prefix "MM-DD" (e.g., "03-21") |
| date_end | string | ISO date prefix "MM-DD" (e.g., "04-19") |
| element | string | Element: 火/土/风/水 |
| modality | string | 基本型/固定型/变动型 |
| ruling_planet | string | Ruling planet (e.g., "火星") |
| traits | string[] | Personality trait keywords |
| personality | string | Detailed personality description |
| mythology | string | Mythological story |
| lucky_numbers | number[] | Lucky numbers |
| lucky_colors | string[] | Lucky colors |
| lucky_stones | string[] | Lucky stones |
| compatibility | string[] | Compatible sign IDs |
| body_parts | string | Associated body parts |
| keywords | string[] | Search keywords |

### UserFavorites (localStorage)

| Key | Type | Description |
|-----|------|-------------|
| hyp_zodiac_favorites | string[] | Array of sign IDs |
| hyp_zodiac_notes | Object | Map of signId → note text |

## Non-Functional Requirements

- **Performance**: Initial load under 2 seconds on a modern browser
- **Browser Support**: Chrome 90+, Firefox 88+, Edge 90+
- **Accessibility**: Keyboard navigation, ARIA labels on interactive elements
- **Responsive**: Works on screens from 320px (mobile) to 1920px (desktop)
- **Offline**: Works completely offline once loaded (no external resources)
- **Data Portability**: Notes can be exported/imported as JSON
