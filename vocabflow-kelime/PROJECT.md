# Project: Kelime Defterim - Article Reading & Security Module

## Architecture
Single-page application (SPA) running in modern mobile web viewports (iPhone 17 mockup aesthetic, Tailwind CSS, vanilla JavaScript).
- **Core Container**: `index.html`
- **Global State**: `window.appState`
- **Security Layer**: Content Security Policy (CSP), DOMPurify (CDN + fallback safe DOMParser), safe DOM node construction (`document.createElement`, `textContent`, `addEventListener`), safe `TreeWalker` tokenization on `Node.TEXT_NODE`.
- **Navigation**: Bottom Tab Bar (5 tabs: Home, Words, Makaleler, Stats, Settings) managed via `switchTab(tabName)`.
- **Reading Engine**: Token-level interactive reading, glossary lookup modal, speech synthesis (TTS), dynamic typography and theme switching (Light, Dark, Sepia), and end-of-article comprehension quiz.

---

## Feature Inventory
Every feature from user request (R1, R2, R3, R4) mapped to milestones:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | CSP Compliance | Content Security Policy meta tag preventing unauthorized scripts and object execution | M1 | R3 |
| 2 | DOM Sanitization Infrastructure | DOMPurify loading and strict zero-dependency safe fallback parser | M1 | R3 |
| 3 | Codebase XSS Hardening | Refactor existing unsafe `innerHTML` sinks (word cards, detail modal, AI recs, quiz feedback) into safe DOM methods | M1 | R3 |
| 4 | Bottom Tab Navigation Extension | Add 5th tab "Makaleler" with `auto_stories` icon and register `#screenArticles` in `switchTab()` | M2 | R1 |
| 5 | Curated Article Dataset | 5 real, copyright-free articles across 5 categories (Popüler Bilim, Sinema & Kültür, İlginç Hikayeler, Teknoloji, Doğa & Gezi), CEFR A2-C1, WPM calculation | M2 | R1 |
| 6 | Article Category Filter & Feed UI | Filter chips, article cards with difficulty badge, reading time, and cover imagery in iPhone 17 styling | M2 | R1, R4 |
| 7 | Safe TreeWalker Article Tokenizer | Interactive word span tokenization strictly on text nodes without regex corruption or HTML injection | M3 | R2, R3 |
| 8 | Interactive Word Dictionary Modal | Click/tap word to display Turkish translation, phonetic IPA, speech pronunciation (TTS), and example sentence | M3 | R2 |
| 9 | Word Book Sync (`appState.words`) | "Kelime Defterime Ekle" button seamlessly adds word to `appState.words`, updates stats, prevents duplicates, shows toast | M3 | R2 |
| 10 | Reader Appearance Customization | Controls for font size (sm, base, lg, xl), font family (Playfair Display Serif vs Plus Jakarta Sans), and reading theme (Gündüz, Gece, Sepia) | M3 | R2, R4 |
| 11 | Comprehension Mini-Quiz | 2-3 multiple-choice questions at the end of each article with immediate feedback, explanations, sound chimes, and score card | M3 | R2 |
| 12 | UI/UX & Responsive Polish | iPhone 17 vertical mockup, glassmorphism (`.glass-card`), smooth scrolling, touch optimization, dark/light theme harmony | M3 | R4 |
| 13 | Comprehensive E2E Testing Suite | Multi-tier test harness covering Tiers 1-4 (Features, Boundaries, Cross-feature interactions, Real-world scenarios) | M4 | AC |
| 14 | Adversarial Security Verification (Tier 5) | Automated test execution against XSS payloads (`<script>`, `onerror`, `onload`, `javascript:`, DOM clobbering) and CSP audit | M4 | AC, R3 |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Security Foundation & Codebase Hardening | CSP `<meta>` tag, DOMPurify integration & fallback sanitizer, refactoring existing `innerHTML` sinks in `index.html` to safe DOM methods | None | DONE |
| M2 | Article Data & Navigation Integration | 5th tab in bottom nav, `#screenArticles` view, category filter, 5 curated copyright-free articles (A2-C1) with WPM calculation | M1 | DONE |
| M3 | Interactive Reader, Word Sync, Settings & Quiz | TreeWalker word tokenizer, word lookup modal with TTS & `appState.words` sync, reader customization (font/theme/sepia), comprehension quiz | M2 | DONE |
| M4 | E2E Testing Track & Adversarial Verification | Comprehensive automated test runner, Tiers 1-4 tests, Tier 5 adversarial XSS security attacks, `TEST_READY.md` generation | M3 | PLANNED |

---

## Code Layout & File Boundaries
- `index.html`: Main single-page application containing markup, styling, and JavaScript logic.
  - `<head>`: CSP meta tag, Google Fonts, DOMPurify script, Tailwind CDN, custom styling.
  - `#screenContainer`: Existing screens + `#screenArticles` (Article feed & Reader views).
  - `#bottomTabBar`: 5 tab navigation buttons.
  - Modals: `#modalAddWord`, `#modalWordDetail`, `#modalArticleWordLookup`.
  - Script section: App state, sanitized article database, reader settings state, DOMPurify configuration, sanitizer functions, rendering functions, event handlers.
- `tests/`: Automated test runners and verification scripts.

---

## Interface Contracts

### 1. `ARTICLE_PURIFY_CONFIG` & `safeFallbackSanitizer`
```javascript
const ARTICLE_PURIFY_CONFIG = Object.freeze({
    ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'b', 'em', 'i', 'u', 'span', 'blockquote', 'ul', 'ol', 'li', 'br', 'hr', 'figure', 'figcaption', 'cite', 'mark'],
    ALLOWED_ATTR: ['class', 'data-word', 'data-term'],
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'style', 'base', 'link', 'meta'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style', 'action', 'href', 'src', 'id', 'name'],
    SANITIZE_DOM: true,
    KEEP_CONTENT: false
});

function sanitizeHtml(dirtyHtml) -> string
```

### 2. Article Data Model
```javascript
{
    id: "article-populer-bilim-1",
    category: "Popüler Bilim", // "Popüler Bilim" | "Sinema & Kültür" | "İlginç Hikayeler" | "Teknoloji" | "Doğa & Gezi"
    title: string,
    subtitle: string,
    level: "A2" | "B1" | "B2" | "C1",
    readTimeMinutes: number, // Math.ceil(wordCount / 200)
    wordCount: number,
    coverGradient: string,
    contentHtml: string, // Sanitized markup
    glossary: {
        [wordLower: string]: {
            turkish: string,
            phonetic: string,
            type: string,
            example: string
        }
    },
    quiz: [
        {
            question: string,
            options: string[],
            correctIndex: number,
            explanation: string
        }
    ]
}
```

### 3. Word Notebook Sync Contract
```javascript
function addWordToNotebook({ english, turkish, phonetic, type, example }) -> boolean
// - Checks deduplication against appState.words (case-insensitive)
// - Prepends { id: Date.now(), english, turkish, phonetic, type, starred: false, marked: false, correctCount: 0, addedToday: true, examples: [example] }
// - Calls renderHome(), renderWordList(), renderStats()
// - Displays showToast(`"${english}" kelime defterinize eklendi! ✨`)
```

### 4. Reader Settings State Contract
```javascript
let readerSettings = {
    fontSize: 'base', // 'sm' | 'base' | 'lg' | 'xl'
    fontFamily: 'sans', // 'sans' (Plus Jakarta Sans) | 'serif' (Playfair Display)
    theme: 'light' // 'light' (Gündüz) | 'dark' (Gece) | 'sepia' (Sepia)
};
```
