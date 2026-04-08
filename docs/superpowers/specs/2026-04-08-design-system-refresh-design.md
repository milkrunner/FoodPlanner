# FoodPlanner Design-System + Layout-Refresh

**Datum**: 2026-04-08
**Ansatz**: B — Design-System + Layout-Refresh
**Ziel**: Clean & minimal Look (Inspiration: Notion, Linear, Apple). Konsistentes Design-System statt generischer Tailwind-Klassen. Deutlich mehr Whitespace, reduzierte Farbgebung, eigener Charakter.

---

## 1. Layout-Shell & Navigation

### Desktop (ab 640px)
- Schmale **Icon-Sidebar** (64px) links, immer sichtbar
- Sidebar-Hintergrund: `#FAFAFA`, rechter Border: 1px `#EBEBEB`
- Logo: Sage-Green Kreis (36px, `#3A8569`) mit weissem "F" (700, 16px), oben in Sidebar mit 24px Abstand zu den Nav-Items
- Nav-Items: 40x40px Pill (border-radius 10px), Icon 20px, stroke-width 1.8
  - Default: `#999` Icon, transparent Background
  - Hover: `#F0F0F0` Background, `#555` Icon
  - Active: `#F0F0F0` Background, `#212529` Icon
- Content-Area: Weisser Hintergrund (`#FFF`), 48px horizontales Padding, 40px vertikales Padding

### Mobile (unter 640px)
- Sidebar wird zu **Bottom-Nav-Bar**: 56px Hoehe, fester Fuss, 5 Icons horizontal zentriert
- Hintergrund: `#FFF`, oberer Border: 1px `#F0F0F0`
- Content-Padding: 20px horizontal, 24px vertikal
- Kein Hamburger-Menu, kein Slide-out — nur Bottom-Nav

### Seitenstruktur
- Page-Title: 28px / 700 / -0.02em / `#111` (Mobile: 22px)
- Untertitel: 15px / 400 / `#999`, 8px unter Title, 40px zum ersten Inhalt

---

## 2. Farbsystem

### Neutrals (Hauptfarben der App)
| Token | Wert | Verwendung |
|---|---|---|
| `text-primary` | `#111` | Headlines, Primary Buttons |
| `text-body` | `#333` | Body-Text, Card-Inhalte |
| `text-secondary` | `#777` | Zutatenlisten, Beschreibungen |
| `text-muted` | `#999` | Labels, Untertitel, Sidebar-Icons |
| `text-disabled` | `#BBB` | Mengenangaben, Platzhalter |
| `border-default` | `#F0F0F0` | Card-Borders, Dividers |
| `border-subtle` | `#FAFAFA` | Listenelement-Trenner |
| `border-hover` | `#E0E0E0` | Card-Hover, Input-Border |
| `bg-surface` | `#FFF` | Content-Area, Cards |
| `bg-muted` | `#FAFAFA` | Sidebar, Section-Hintergruende |
| `bg-subtle` | `#F5F5F5` | Badges, Secondary Buttons |

### Akzent (sparsam eingesetzt)
| Token | Wert | Verwendung |
|---|---|---|
| `accent-bg` | `#F0F7F4` | Kategorie-Badge Hintergrund |
| `accent-text` | `#3A8569` | Kategorie-Badge Text |
| `accent-solid` | `#3A8569` | Logo, saisonale Highlights |

### Destructive
| Token | Wert | Verwendung |
|---|---|---|
| `destructive-bg` | `#FDF5F3` | Destructive Button Hover |
| `destructive-text` | `#CC6B6B` | Destructive Button/Text |
| `destructive-border` | `#F0E0E0` | Destructive Button Border |

### Favorit
| Token | Wert | Verwendung |
|---|---|---|
| `heart-default` | `#E8A0A0` | Herz-Icon Standard |
| `heart-hover` | `#CC6B6B` | Herz-Icon Hover/Active |

---

## 3. Typografie

Font-Family bleibt **Inter** (bereits geladen).

| Element | Size | Weight | Letter-Spacing | Farbe |
|---|---|---|---|---|
| Page-Title | 28px | 700 | -0.02em | `#111` |
| Section-Title | 18px | 600 | -0.01em | `#111` |
| Card-Title | 20px | 600 | -0.01em | `#111` |
| Body | 15px | 400 | normal | `#333` |
| Body-Secondary | 14px | 400 | normal | `#777` |
| Label (Uppercase) | 11px | 600 | 0.08em | `#999` |
| Badge | 12px | 500 | normal | variiert |
| Button | 14px | 500 | -0.01em | variiert |

---

## 4. Komponenten

### Cards
- Background: `#FFF`
- Border: 1px `#F0F0F0`, Hover: 1px `#E0E0E0`
- Border-Radius: 16px
- Padding: 28px (Mobile: 20px)
- Kein Box-Shadow
- Transition: border-color 0.2s

### Buttons
| Variante | Background | Text | Border | Hover-BG |
|---|---|---|---|---|
| Primary | `#111` | `#FFF` | none | `#333` |
| Secondary | `#F5F5F5` | `#333` | none | `#EBEBEB` |
| Destructive | `#FFF` | `#CC6B6B` | 1px `#F0E0E0` | `#FDF5F3` |

Alle Buttons: 11px/24px Padding, 10px Radius, 14px/500 Font, -0.01em Letter-Spacing.

### Badges/Tags
- Standard: `#F5F5F5` Background, `#666` Text, 20px Radius (Pill), 5px/12px Padding
- Akzent (Kategorien): `#F0F7F4` Background, `#3A8569` Text
- Kein Border

### Einkaufsliste
- Abteilungs-Header: Label-Stil (11px/600/uppercase/0.08em/`#999`), 20px Margin-Top (erster: 0)
- Items: 15px `#333`, 12px vertikales Padding
- Mengenangabe: rechtsbuendig, 14px `#BBB`
- Checkbox: 20x20px, accent-color `#111`
- Trenner zwischen Items: 1px `#FAFAFA`

### Modals
- Backdrop: Blur bleibt (backdrop-filter: blur(4px))
- Content: `#FFF`, 20px Radius, 32px Padding
- Titel: 22px/600
- Mobile: Bottom-Sheet Verhalten bleibt

### Formulare
- Inputs: 1px Border `#E0E0E0`, 10px Radius, 12px/16px Padding
- Focus: 2px Border `#111`
- Labels: Uppercase-Micro-Text (11px/600/`#999`) ueber dem Input

---

## 5. Spacing-System

| Kontext | Wert |
|---|---|
| Zwischen Sektionen | 32px |
| Card zu Card | 24px |
| Card Inner Padding | 28px (Mobile: 20px) |
| Page-Title zu Inhalt | 40px |
| Button-Gruppen Gap | 12px |
| Sidebar-Icons Gap | 4px |
| Divider Margin | 32px oben/unten |
| Content-Padding Desktop | 48px horizontal, 40px vertikal |
| Content-Padding Mobile | 20px horizontal, 24px vertikal |

---

## 6. Scope

### Aendert sich
- `js/app.js` — Shell-Rendering: horizontale Tab-Bar durch Icon-Sidebar ersetzen, Mobile Bottom-Nav
- `js/views/*.js` (alle 9 Views) — HTML-Templates: Tailwind-Klassen austauschen, Spacing anpassen
- `css/input.css` — Neue Utility-Klassen (.card, .btn-primary, .btn-secondary, .btn-destructive, .badge, .label, .shop-item), Modal-Styles aktualisieren
- `tailwind.config.js` — Farbpalette auf neue Tokens umstellen, alte ac-* Tokens entfernen/ersetzen
- `index.html` — Meta-Theme-Color ggf. anpassen

### Aendert sich NICHT
- Backend (keine API-Aenderungen)
- Geschaeftslogik in den Views (nur HTML/CSS, nicht die JS-Funktionen)
- Datenmodell, Routing, Auth-System
- PWA / Service Worker
- Dark Mode (wird als separates Follow-up umgesetzt, sobald das Light-Design steht)

---

## 7. Implementierungsreihenfolge

1. **Design-Tokens & Utility-Klassen** — `tailwind.config.js` + `input.css` mit neuen Klassen
2. **App-Shell** — `js/app.js`: Sidebar (Desktop) + Bottom-Nav (Mobile)
3. **Views einzeln migrieren** — jeweils HTML-Template auf neue Klassen umstellen:
   - Wochenplaner (Hauptansicht, sichtbarster Impact)
   - Rezept-Datenbank (komplexeste View)
   - Einkaufsliste
   - Rezept-Parser
   - AI-Rezeptgenerator
   - Vorratskammer
   - Kochhistorie
   - Meal-Prep
   - Admin
4. **Modals & Formulare** — einheitliche Styles ueber alle Views
5. **Feinschliff** — Animationen, Transitions, Edge Cases
