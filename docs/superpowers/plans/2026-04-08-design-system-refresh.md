# Design-System + Layout-Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate FoodPlanner from generic Tailwind classes to a clean, minimal design system with Icon-Sidebar navigation, monochrome color scheme, and consistent component patterns.

**Architecture:** CSS-first migration — define design tokens and utility component classes in `tailwind.config.js` + `input.css`, then update HTML templates in `app.js` and all 9 view modules. No business logic changes. Dark mode excluded (follow-up).

**Tech Stack:** Tailwind CSS (custom config), vanilla JS ES modules, Inter font.

**Spec:** `docs/superpowers/specs/2026-04-08-design-system-refresh-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `tailwind.config.js` | Simplified color tokens, spacing |
| Modify | `css/input.css` | Component utility classes (.card, .btn-*, .badge-*, .label, .shop-item) |
| Modify | `index.html` | Meta theme-color update |
| Modify | `js/app.js` | New shell: Icon-Sidebar (desktop) + Bottom-Nav (mobile) |
| Modify | `js/views/week-planner.js` | Migrate HTML template to new design tokens |
| Modify | `js/views/recipe-database.js` | Migrate cards, badges, buttons, category tiles |
| Modify | `js/views/shopping-list.js` | Migrate list items, department headers, progress bar |
| Modify | `js/views/recipe-parser.js` | Migrate form + results layout |
| Modify | `js/views/ai-recipe-generator.js` | Migrate form + recipe cards |
| Modify | `js/views/pantry.js` | Migrate inventory list + forms |
| Modify | `js/views/cooking-history.js` | Migrate history list + stats |
| Modify | `js/views/meal-prep.js` | Migrate meal prep cards + planning |
| Modify | `js/views/admin-users.js` | Migrate user table + forms |

---

### Task 1: Design Tokens & Utility Classes

**Files:**
- Modify: `tailwind.config.js` (full rewrite of `theme.extend`)
- Modify: `css/input.css:1-34` (add component layer after Tailwind directives)
- Modify: `index.html:6-7` (meta theme-color)

- [ ] **Step 1: Update tailwind.config.js with new design tokens**

Replace the entire `theme.extend` section. Keep the `content` and `darkMode` fields unchanged.

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Design System tokens
        'ds': {
          'bg':          '#FFFFFF',
          'bg-muted':    '#FAFAFA',
          'bg-subtle':   '#F5F5F5',
          'border':      '#F0F0F0',
          'border-hover':'#E0E0E0',
          'border-faint':'#FAFAFA',
          'text':        '#111111',
          'text-body':   '#333333',
          'text-sec':    '#777777',
          'text-muted':  '#999999',
          'text-disabled':'#BBBBBB',
          'accent-bg':   '#F0F7F4',
          'accent':      '#3A8569',
          'danger-bg':   '#FDF5F3',
          'danger':      '#CC6B6B',
          'danger-border':'#F0E0E0',
          'heart':       '#E8A0A0',
          'heart-active':'#CC6B6B',
        },
        // Keep old palette for dark mode follow-up
        'ac-night': {
          50:  '#1E2024',
          100: '#18191D',
          200: '#131417',
          300: '#0E0F11',
          400: '#09090B',
          500: '#050506'
        }
      },
      borderRadius: {
        'ds':    '10px',
        'ds-lg': '16px',
        'ds-pill':'9999px'
      },
      fontFamily: {
        'ds': ['Inter', 'system-ui', 'sans-serif']
      },
      spacing: {
        'ds-page-x': '48px',
        'ds-page-y': '40px',
        'ds-page-x-mobile': '20px',
        'ds-page-y-mobile': '24px',
        'ds-section': '32px',
        'ds-card-gap': '24px',
        'ds-card-pad': '28px',
        'ds-card-pad-mobile': '20px',
      }
    }
  }
}
```

- [ ] **Step 2: Add component utility classes to input.css**

Insert after the Tailwind directives (line 3) and before the base resets (line 5). Add a `@layer components` block:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  /* ===== Cards ===== */
  .ds-card {
    background: #FFFFFF;
    border: 1px solid #F0F0F0;
    border-radius: 16px;
    padding: 28px;
    transition: border-color 0.2s ease;
  }
  .ds-card:hover { border-color: #E0E0E0; }
  @media (max-width: 640px) {
    .ds-card { padding: 20px; }
  }

  /* ===== Buttons ===== */
  .ds-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 24px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    letter-spacing: -0.01em;
    font-family: 'Inter', system-ui, sans-serif;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    min-height: 44px;
  }
  .ds-btn-primary { background: #111; color: #fff; }
  .ds-btn-primary:hover { background: #333; }
  .ds-btn-secondary { background: #F5F5F5; color: #333; }
  .ds-btn-secondary:hover { background: #EBEBEB; }
  .ds-btn-destructive { background: #fff; color: #CC6B6B; border: 1px solid #F0E0E0; }
  .ds-btn-destructive:hover { background: #FDF5F3; }
  .ds-btn-sm { padding: 8px 16px; font-size: 13px; }

  /* ===== Badges ===== */
  .ds-badge {
    display: inline-flex;
    align-items: center;
    padding: 5px 12px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
    background: #F5F5F5;
    color: #666;
  }
  .ds-badge-accent { background: #F0F7F4; color: #3A8569; }

  /* ===== Labels ===== */
  .ds-label {
    font-size: 11px;
    font-weight: 600;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* ===== Page layout ===== */
  .ds-page-title {
    font-size: 28px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.02em;
  }
  @media (max-width: 640px) {
    .ds-page-title { font-size: 22px; }
  }
  .ds-page-sub {
    font-size: 15px;
    color: #999;
    margin-top: 8px;
  }
  .ds-section-title {
    font-size: 18px;
    font-weight: 600;
    color: #111;
    letter-spacing: -0.01em;
  }
  .ds-card-title {
    font-size: 20px;
    font-weight: 600;
    color: #111;
    letter-spacing: -0.01em;
  }
  @media (max-width: 640px) {
    .ds-card-title { font-size: 17px; }
  }

  /* ===== Divider ===== */
  .ds-divider {
    height: 1px;
    background: #F0F0F0;
    margin: 32px 0;
    border: none;
  }

  /* ===== Inputs ===== */
  .ds-input {
    width: 100%;
    padding: 12px 16px;
    border: 1px solid #E0E0E0;
    border-radius: 10px;
    font-size: 15px;
    font-family: 'Inter', system-ui, sans-serif;
    color: #111;
    background: #fff;
    transition: border-color 0.15s ease;
    min-height: 44px;
  }
  .ds-input:focus {
    outline: none;
    border-color: #111;
    box-shadow: 0 0 0 1px #111;
  }
  .ds-input::placeholder { color: #BBB; }

  /* ===== Shopping list items ===== */
  .ds-shop-dept {
    font-size: 11px;
    font-weight: 600;
    color: #999;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
    margin-top: 24px;
  }
  .ds-shop-dept:first-child { margin-top: 0; }
  .ds-shop-item {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 0;
    font-size: 15px;
    color: #333;
  }
  .ds-shop-item + .ds-shop-item {
    border-top: 1px solid #FAFAFA;
  }
  .ds-shop-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    accent-color: #111;
    cursor: pointer;
    flex-shrink: 0;
  }
  .ds-shop-amount {
    color: #BBB;
    margin-left: auto;
    font-size: 14px;
  }

  /* ===== Sidebar (Desktop) ===== */
  .ds-sidebar {
    width: 64px;
    background: #FAFAFA;
    border-right: 1px solid #EBEBEB;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 0;
    gap: 4px;
    flex-shrink: 0;
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 40;
  }
  .ds-sidebar-logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: #3A8569;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 16px;
    margin-bottom: 24px;
    flex-shrink: 0;
  }
  .ds-sidebar-item {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #999;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    background: none;
    padding: 0;
  }
  .ds-sidebar-item:hover { background: #F0F0F0; color: #555; }
  .ds-sidebar-item.active { background: #F0F0F0; color: #212529; }
  .ds-sidebar-item svg { width: 20px; height: 20px; stroke-width: 1.8; }

  /* ===== Bottom Nav (Mobile) ===== */
  .ds-bottomnav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 56px;
    background: #fff;
    border-top: 1px solid #F0F0F0;
    z-index: 40;
    align-items: center;
    justify-content: space-around;
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
  @media (max-width: 640px) {
    .ds-sidebar { display: none; }
    .ds-bottomnav { display: flex; }
  }
  .ds-bottomnav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    color: #999;
    cursor: pointer;
    border: none;
    background: none;
    padding: 4px 12px;
    min-width: 48px;
    min-height: 44px;
    transition: color 0.15s ease;
    font-family: 'Inter', system-ui, sans-serif;
  }
  .ds-bottomnav-item svg { width: 22px; height: 22px; stroke-width: 1.8; }
  .ds-bottomnav-item span { font-size: 10px; font-weight: 500; }
  .ds-bottomnav-item.active { color: #111; }
  .ds-bottomnav-item:hover { color: #555; }

  /* ===== Heart/Favorite ===== */
  .ds-heart {
    font-size: 22px;
    cursor: pointer;
    color: #E8A0A0;
    transition: color 0.15s ease, transform 0.2s ease;
    background: none;
    border: none;
    padding: 4px;
    line-height: 1;
  }
  .ds-heart:hover { color: #CC6B6B; }
  .ds-heart.is-favorite { color: #CC6B6B; }
}
```

- [ ] **Step 3: Update focus styles in input.css**

Replace the existing focus styles (lines 265-270) to use black instead of sage green:

```css
/* ===== Focus ===== */
:focus-visible {
    outline: 2px solid #111; outline-offset: 2px; border-radius: 3px;
}
.dark :focus-visible { outline-color: #4EA083; }
:focus:not(:focus-visible) { outline: none; }
```

- [ ] **Step 4: Update checkbox accent color in input.css**

Replace line 173:

```css
.touch-checkbox { width: 20px !important; height: 20px !important; cursor: pointer; accent-color: #111; }
```

- [ ] **Step 5: Update meta theme-color in index.html**

In `index.html`, change lines 6-7:

```html
<meta name="theme-color" content="#FAFAFA" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#09090B" media="(prefers-color-scheme: dark)">
```

Also update line 14:

```html
<meta name="msapplication-TileColor" content="#FAFAFA">
```

- [ ] **Step 6: Update body background in index.html**

Change line 30:

```html
<body class="bg-white dark:bg-ac-night-400 transition-colors duration-200">
```

- [ ] **Step 7: Rebuild CSS and verify**

Run the Tailwind CSS build (if applicable) or verify the styles load correctly in the browser.

Run: Open `http://localhost:5173` and confirm no visual breakage. The new utility classes should be available but not yet used.

- [ ] **Step 8: Commit**

```bash
git add tailwind.config.js css/input.css index.html
git commit -m "feat(design): add design system tokens and component utility classes"
```

---

### Task 2: App Shell — Sidebar & Bottom Nav

**Files:**
- Modify: `js/app.js:471-603` (replace header + navigation rendering)
- Modify: `js/app.js:187-195` (update shell HTML structure)
- Modify: `css/input.css:119-134` (remove old mobile-nav styles)

- [ ] **Step 1: Define sidebar navigation icons**

In `js/app.js`, find the `renderNavigation` function area (around line 558). We will replace both desktop and mobile navigation. First, define an SVG icon map at module level (add near the top of the file, after imports):

```js
const NAV_ICONS = {
    planner: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="4" x2="9" y2="10"/><line x1="15" y1="4" x2="15" y2="10"/></svg>',
    recipes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>',
    shopping: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    pantry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>',
    history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    'meal-prep': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>',
    'ai-recipes': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    parser: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
};

const NAV_LABELS = {
    planner: 'Planer',
    recipes: 'Rezepte',
    shopping: 'Einkauf',
    pantry: 'Vorrat',
    history: 'Historie',
    'meal-prep': 'Meal Prep',
    'ai-recipes': 'AI Rezepte',
    parser: 'Import',
    admin: 'Admin',
};

// Main 5 tabs for bottom nav (most-used views)
const BOTTOM_NAV_VIEWS = ['planner', 'recipes', 'shopping', 'pantry', 'history'];
```

- [ ] **Step 2: Replace the render() shell HTML**

Find the `render()` method in `js/app.js` (around line 170). Replace the shell template (the return value that builds the `#app` innerHTML). The new structure:

```js
// Inside render() — replace the entire HTML template
document.getElementById('app').innerHTML = `
    <!-- Desktop Sidebar -->
    <nav class="ds-sidebar" aria-label="Hauptnavigation">
        <div class="ds-sidebar-logo" aria-hidden="true">F</div>
        ${this._renderSidebarItems()}
    </nav>

    <!-- Mobile Bottom Nav -->
    <nav class="ds-bottomnav" aria-label="Hauptnavigation">
        ${this._renderBottomNavItems()}
    </nav>

    <!-- Main Content -->
    <main id="main-content" class="sm:ml-[64px] pb-[72px] sm:pb-0">
        <div class="px-ds-page-x-mobile sm:px-ds-page-x py-ds-page-y-mobile sm:py-ds-page-y">
            <div id="view-container" aria-live="polite"></div>
        </div>
    </main>

    <div id="toast-notification" class="fixed bottom-20 sm:bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 pointer-events-none" aria-live="assertive"></div>
`;
```

- [ ] **Step 3: Add _renderSidebarItems() and _renderBottomNavItems() methods**

Add these methods to the App object:

```js
_renderSidebarItems() {
    const tabs = this._getVisibleTabs();
    return tabs.map(viewId => `
        <button class="ds-sidebar-item ${AppState.currentView === viewId ? 'active' : ''}"
                data-view="${viewId}" title="${NAV_LABELS[viewId]}" aria-label="${NAV_LABELS[viewId]}">
            ${NAV_ICONS[viewId]}
        </button>
    `).join('');
},

_renderBottomNavItems() {
    return BOTTOM_NAV_VIEWS.map(viewId => `
        <button class="ds-bottomnav-item ${AppState.currentView === viewId ? 'active' : ''}"
                data-view="${viewId}" aria-label="${NAV_LABELS[viewId]}">
            ${NAV_ICONS[viewId]}
            <span>${NAV_LABELS[viewId]}</span>
        </button>
    `).join('');
},

_getVisibleTabs() {
    const tabs = ['planner', 'recipes', 'shopping', 'pantry', 'history', 'meal-prep', 'ai-recipes', 'parser'];
    if (Auth.getUser()?.role === 'admin') tabs.push('admin');
    return tabs;
},
```

- [ ] **Step 4: Update navigation event listeners**

Replace the existing desktop/mobile nav event listeners with:

```js
// Sidebar navigation (desktop)
document.querySelectorAll('.ds-sidebar-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => this.navigateTo(btn.dataset.view));
});

// Bottom nav (mobile)
document.querySelectorAll('.ds-bottomnav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => this.navigateTo(btn.dataset.view));
});
```

- [ ] **Step 5: Remove old mobile-nav CSS from input.css**

Delete lines 119-134 (the `.mobile-nav-overlay` and `.mobile-nav-menu` styles). Also remove the pull-to-refresh styles (136-144) and swipe-indicator styles (146-155) if they are tied to the old navigation. Keep them if they serve other purposes.

- [ ] **Step 6: Remove old header rendering code**

Remove the `renderHeader()`, `renderNavigation()` (desktop tabs), and `renderMobileNav()` methods from `app.js`. Also remove the hamburger menu button event listeners and overlay toggle logic.

- [ ] **Step 7: Verify in browser**

Open the app. Confirm:
- Desktop: 64px icon sidebar on the left, content shifted right
- Mobile (<640px): Bottom nav with 5 icons, sidebar hidden
- Clicking nav items switches views
- No old header/tab-bar visible

- [ ] **Step 8: Commit**

```bash
git add js/app.js css/input.css
git commit -m "feat(design): replace header+tabs with icon sidebar and bottom nav"
```

---

### Task 3: Week Planner View Migration

**Files:**
- Modify: `js/views/week-planner.js` (HTML template in render())

- [ ] **Step 1: Update page header**

Replace the heading and button section in the `render()` method. Change:

```
text-xl sm:text-2xl font-bold text-gray-800 dark:text-white
```

to:

```
ds-page-title
```

Replace all colored buttons (`bg-purple-500`, `bg-blue-500`, `bg-green-500`, `bg-red-500`) with design system classes:

- AI Generate button: `ds-btn ds-btn-primary`
- Save template: `ds-btn ds-btn-secondary`
- Load template: `ds-btn ds-btn-secondary`
- Reset week: `ds-btn ds-btn-destructive`

- [ ] **Step 2: Update day cards**

Replace card patterns:
- `bg-white dark:bg-gray-800 rounded-lg shadow` → `ds-card`
- Section headings inside cards: `ds-section-title`
- Meal slot labels: `ds-label`

- [ ] **Step 3: Update meal assignment buttons and meal cards**

Replace any `bg-green-*`, `bg-blue-*` button styles with `ds-btn ds-btn-secondary` or `ds-btn ds-btn-primary` as appropriate.

- [ ] **Step 4: Verify week planner view**

Open the planner view. Confirm:
- Page title is 28px bold with tight letter-spacing
- Cards have border instead of shadow
- Buttons are monochrome (black primary, gray secondary)
- More whitespace between elements

- [ ] **Step 5: Commit**

```bash
git add js/views/week-planner.js
git commit -m "feat(design): migrate week planner to design system"
```

---

### Task 4: Recipe Database View Migration

**Files:**
- Modify: `js/views/recipe-database.js` (HTML templates for cards, badges, buttons, category tiles)

- [ ] **Step 1: Update page header and search**

- Page title: `ds-page-title`
- Search input: `ds-input` (replace `rounded-lg border border-gray-300 bg-transparent focus:ring-2 focus:ring-blue-500`)
- Subtitle (recipe count): `ds-page-sub`

- [ ] **Step 2: Update category tiles**

Replace `bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-5 shadow hover:shadow-lg` with `ds-card` and adjust padding.

- [ ] **Step 3: Update recipe cards**

Replace the recipe card class pattern:
```
bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900 p-4 hover:shadow-lg
```
with:
```
ds-card
```

Card title: `ds-card-title`

- [ ] **Step 4: Update badges**

Replace all badge variants:
- Category: `bg-blue-100 dark:bg-blue-900/40 text-blue-800` → `ds-badge ds-badge-accent`
- Tags: `bg-green-100 dark:bg-green-900/40 text-green-800 rounded-full` → `ds-badge`
- Meal-prep: `bg-green-100 ... text-green-800` → `ds-badge`
- Stats (cooking count, last cooked): `bg-purple-100 ... text-purple-800` → `ds-badge`
- Time/difficulty metadata: keep as inline text, use `text-ds-text-sec text-sm`

- [ ] **Step 5: Update action buttons on cards**

Replace:
- Edit: `bg-gray-100 dark:bg-gray-700 text-gray-700 rounded-lg` → `ds-btn ds-btn-secondary ds-btn-sm`
- Delete: `bg-red-100 dark:bg-red-900/30 text-red-700 rounded-lg` → `ds-btn ds-btn-destructive ds-btn-sm`
- Scale portions: `bg-green-100 dark:bg-green-900/30 text-green-700 rounded-lg` → `ds-btn ds-btn-secondary ds-btn-sm`

- [ ] **Step 6: Update filter buttons and tag selectors**

Replace colored filter toggles with `ds-btn ds-btn-secondary ds-btn-sm` for inactive and `ds-btn ds-btn-primary ds-btn-sm` for active.

- [ ] **Step 7: Verify recipe database view**

Open the recipes view. Confirm:
- Cards have subtle borders, no shadows
- Badges are pill-shaped and monochrome (except category which is sage-green)
- Buttons are clean and consistent
- More breathing room between cards

- [ ] **Step 8: Commit**

```bash
git add js/views/recipe-database.js
git commit -m "feat(design): migrate recipe database to design system"
```

---

### Task 5: Shopping List View Migration

**Files:**
- Modify: `js/views/shopping-list.js` (render method, item rendering, department headers)

- [ ] **Step 1: Update page header**

- Title: `ds-page-title`
- Subtitle (checked count): `ds-page-sub`
- Buttons: Replace colored buttons (`bg-emerald-500`, `bg-indigo-500`, `bg-green-500`, `bg-blue-500`, `bg-red-500`) with:
  - Sort toggle: `ds-btn ds-btn-secondary`
  - Add item: `ds-btn ds-btn-primary`
  - Export: `ds-btn ds-btn-secondary`
  - Clear checked: `ds-btn ds-btn-destructive`

- [ ] **Step 2: Update progress bar**

Replace: `bg-white dark:bg-gray-800 rounded-lg shadow p-4` with `ds-card`
Replace: `bg-green-500 dark:bg-green-600 h-3 rounded-full` with `bg-ds-text h-2 rounded-full` (thinner, black)
Background bar: `bg-ds-bg-subtle rounded-full h-2`

- [ ] **Step 3: Update department group headers**

Replace the card-per-group pattern:
```
bg-white dark:bg-gray-800 rounded-lg shadow dark:shadow-gray-900
```
with `ds-card`.

Replace department title `text-lg font-semibold text-gray-800` with `ds-section-title`.

- [ ] **Step 4: Update shopping list items**

Replace individual item markup with `ds-shop-item` class. Update checkboxes to use `accent-color: #111` (already set via `ds-shop-item input[type="checkbox"]`). Amount text: `ds-shop-amount`.

- [ ] **Step 5: Update manual item form**

Replace input fields with `ds-input`. Replace category select with `ds-input` styling. Buttons: `ds-btn ds-btn-primary` (save) and `ds-btn ds-btn-secondary` (cancel).

- [ ] **Step 6: Verify shopping list view**

Open the shopping list. Confirm:
- Department headers are uppercase micro-labels
- Items are clean rows with minimal separator
- Progress bar is thin and black
- Buttons are consistent monochrome

- [ ] **Step 7: Commit**

```bash
git add js/views/shopping-list.js
git commit -m "feat(design): migrate shopping list to design system"
```

---

### Task 6: Remaining Views Migration (Parser, AI Generator, Pantry, History, Meal Prep, Admin)

**Files:**
- Modify: `js/views/recipe-parser.js`
- Modify: `js/views/ai-recipe-generator.js`
- Modify: `js/views/pantry.js`
- Modify: `js/views/cooking-history.js`
- Modify: `js/views/meal-prep.js`
- Modify: `js/views/admin-users.js`

Apply the same pattern to all remaining views. For each view:

- [ ] **Step 1: Migrate recipe-parser.js**

- Page title: `ds-page-title`
- URL/text input: `ds-input`
- Parse button: `ds-btn ds-btn-primary`
- Result cards: `ds-card`
- Status messages: `ds-badge` for status pills

- [ ] **Step 2: Migrate ai-recipe-generator.js**

- Page title: `ds-page-title`
- Ingredient input: `ds-input`
- Preference selects: `ds-input` (style select same as input)
- Generate button: `ds-btn ds-btn-primary`
- Generated recipe cards: `ds-card` with `ds-card-title`
- Save/dismiss buttons: `ds-btn ds-btn-primary` / `ds-btn ds-btn-secondary`

- [ ] **Step 3: Migrate pantry.js**

- Page title: `ds-page-title`
- Category labels: `ds-label`
- Pantry item cards: `ds-card`
- Expiry warnings: `ds-badge` with danger color (`bg-ds-danger-bg text-ds-danger`)
- Add/edit buttons: `ds-btn ds-btn-primary`
- Delete: `ds-btn ds-btn-destructive`
- Filter buttons: `ds-btn ds-btn-secondary ds-btn-sm`
- Form inputs: `ds-input`

- [ ] **Step 4: Migrate cooking-history.js**

- Page title: `ds-page-title`
- Stats cards: `ds-card`
- History list items: `ds-card` (or border-bottom rows like shopping items)
- Pagination buttons: `ds-btn ds-btn-secondary ds-btn-sm`

- [ ] **Step 5: Migrate meal-prep.js**

- Page title: `ds-page-title`
- Prep cards: `ds-card`
- Action buttons: `ds-btn ds-btn-primary` / `ds-btn ds-btn-secondary`
- Badge for prep-suitability: `ds-badge ds-badge-accent`

- [ ] **Step 6: Migrate admin-users.js**

- Page title: `ds-page-title`
- User rows: `ds-card` or table with `ds-divider` separators
- Role badges: `ds-badge` (admin = `ds-badge-accent`)
- Action buttons: `ds-btn ds-btn-secondary ds-btn-sm` (edit role), `ds-btn ds-btn-destructive ds-btn-sm` (deactivate)
- Create user form: `ds-input` + `ds-label` + `ds-btn ds-btn-primary`

- [ ] **Step 7: Verify all views**

Open each view and confirm:
- Consistent page titles (28px bold)
- Consistent button styles (black primary, gray secondary, outlined destructive)
- Consistent cards (border, no shadow, 16px radius)
- Consistent inputs (10px radius, black focus ring)
- Consistent badges (pill-shaped, monochrome or sage-green accent)

- [ ] **Step 8: Commit**

```bash
git add js/views/recipe-parser.js js/views/ai-recipe-generator.js js/views/pantry.js js/views/cooking-history.js js/views/meal-prep.js js/views/admin-users.js
git commit -m "feat(design): migrate remaining views to design system"
```

---

### Task 7: Modals & Auth Modal Migration

**Files:**
- Modify: `css/input.css:36-71` (modal styles)
- Modify: `js/core/auth-modal.js` (login/register modal HTML)
- Modify: any view that renders modals (recipe-database.js modals, shopping-list.js manual item modal)

- [ ] **Step 1: Update modal base styles in input.css**

Update the `.modal.active > div` style:

```css
.modal.active > div {
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 20px;
    padding: 32px;
    background: #fff;
}
@media (max-width: 640px) {
    .modal.active > div {
        border-radius: 20px 20px 0 0;
        padding: 24px;
    }
}
```

- [ ] **Step 2: Update auth-modal.js**

- Modal title: `ds-page-title` (or 22px/600 inline)
- Email/password inputs: `ds-input`
- Labels: `ds-label` above each input
- Login button: `ds-btn ds-btn-primary w-full`
- Register link: `text-ds-accent hover:underline`

- [ ] **Step 3: Update modal buttons across views**

In recipe-database.js modals (edit recipe, recipe detail, scaling, analysis, variant):
- Save: `ds-btn ds-btn-primary`
- Cancel: `ds-btn ds-btn-secondary`
- Close (X): styled as 40x40 button with hover background

- [ ] **Step 4: Verify modals**

Open modals in different views. Confirm:
- 20px radius, 32px padding
- Consistent button placement
- Input fields use `ds-input` style
- Labels are uppercase micro-text

- [ ] **Step 5: Commit**

```bash
git add css/input.css js/core/auth-modal.js js/views/recipe-database.js js/views/shopping-list.js
git commit -m "feat(design): migrate modals and auth to design system"
```

---

### Task 8: Polish & Cleanup

**Files:**
- Modify: `tailwind.config.js` (remove unused old tokens)
- Modify: `css/input.css` (clean up obsolete styles)
- Modify: `js/app.js` (remove dead code from old nav)

- [ ] **Step 1: Remove unused Tailwind color tokens**

In `tailwind.config.js`, remove old color palettes that are no longer referenced: `ac-mint`, `ac-peach`, `ac-cream`, `ac-brown`, `ac-leaf`, `ac-blue`, `ac-yellow`. Keep `ac-night` for future dark mode. Remove old `borderRadius` and `boxShadow` tokens (`ac-sm`, `ac`, `ac-lg`, etc.).

- [ ] **Step 2: Remove old CSS that is no longer needed**

In `input.css`, review and remove:
- Old `.favorite-heart` styles (replaced by `.ds-heart`)
- Old `.favorite-quick-scroll` styles
- Old `.mobile-nav-*` styles (if not already removed)
- Old `.pull-to-refresh` and `.swipe-indicator` if unused

Keep: `.modal`, `.skeleton`, `.recipe-instructions`, `.skip-link`, focus styles, reduced motion, scrollbar styles.

- [ ] **Step 3: Search for remaining old Tailwind classes**

Search across all `js/` files for any remaining standard Tailwind color classes that should have been migrated:

```bash
grep -rn "bg-blue-\|bg-green-\|bg-red-\|bg-purple-\|bg-gray-\|text-gray-" js/ --include="*.js" | head -30
```

Fix any remaining instances.

- [ ] **Step 4: Remove dead navigation code from app.js**

Remove:
- Old `renderHeader()` method
- Old `renderNavigation()` method  
- Old `renderMobileNav()` method
- Old hamburger toggle logic
- Old keyboard shortcut for mobile menu

- [ ] **Step 5: Run unit tests**

```bash
cd backend && node --test --test-reporter spec __tests__/middleware/*.test.js __tests__/routes/*.test.js __tests__/utils/*.test.js
```

Expected: 290 tests pass (no backend changes were made, but confirm nothing is broken).

- [ ] **Step 6: Full visual review**

Open every view in desktop and mobile viewport:
1. Wochenplan
2. Rezepte (list + category tiles + detail modal)
3. Einkaufsliste (supermarket + alphabetical mode)
4. Rezept-Parser
5. AI Rezeptgenerator
6. Vorratskammer
7. Kochhistorie
8. Meal Prep
9. Admin (if admin user)

Check for:
- Consistent typography hierarchy
- No old colored buttons remaining
- Cards all have border (no shadow)
- Spacing feels generous and even
- Mobile bottom nav works
- Modals look clean

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(design): polish and cleanup old design tokens"
```

---

## Summary

| Task | Scope | Estimated Steps |
|------|-------|----------------|
| 1. Design Tokens & Utility Classes | tailwind.config.js, input.css, index.html | 8 |
| 2. App Shell (Sidebar + Bottom Nav) | js/app.js, input.css | 8 |
| 3. Week Planner Migration | week-planner.js | 5 |
| 4. Recipe Database Migration | recipe-database.js | 8 |
| 5. Shopping List Migration | shopping-list.js | 7 |
| 6. Remaining Views (6 views) | 6 view files | 8 |
| 7. Modals & Auth | input.css, auth-modal.js, views | 5 |
| 8. Polish & Cleanup | all files | 7 |
| **Total** | | **56 steps** |
