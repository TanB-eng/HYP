# Project Constitution

## Project Name
HYP Zodiac Research Website (HYP星座研究网站)

## Vision
A pure frontend zodiac research website focused on the 12 astrological signs of the zodiac. The site provides an immersive deep-space visual experience for browsing zodiac details, exploring an interactive star map, saving personal notes, and calculating one's zodiac sign from a birthday.

## Principles

1. **Pure Frontend**: No backend server, no deployment pipeline. The entire app runs by opening `index.html` in a browser. All data persistence uses browser `localStorage`.

2. **Static Data First**: Zodiac sign data is bundled as a static JSON file in the project. The data structure is designed so the user can update it later by replacing the JSON file.

3. **Single-File-Friendly**: While the project uses multiple files for maintainability (HTML, CSS, JS, JSON), everything works via the `file://` protocol — no server required.

4. **Immersive Deep-Space Aesthetic**: Dark blue/black background, animated twinkling stars, milky-way gradients. The visual design should feel like exploring the night sky.

5. **Chinese-First UI**: All user-facing text is in Simplified Chinese. Constellation names include both Chinese and English.

6. **No External Dependencies**: The project uses no CDN, no npm packages, no build tools. Only vanilla HTML/CSS/JS. Canvas API is used for the star map.

7. **Progressive Enhancement**: Each user story (browsing, star map, favorites, calculator) works independently and is independently testable.

## Constraints

- Target browsers: Chrome, Firefox, Edge (latest versions)
- `localStorage` works under `file://` in modern browsers; if issues arise, a simple `python -m http.server` fallback is documented
- No frameworks (React, Vue, etc.) — vanilla JS only
- No external API calls — all data is local
