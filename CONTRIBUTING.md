# Contributing Guide

Vielen Dank für dein Interesse, zum FoodPlanner beizutragen! Dieses Dokument erklärt, wie du Beiträge leisten kannst.

## Inhaltsverzeichnis

- [Code of Conduct](#code-of-conduct)
- [Erste Schritte](#erste-schritte)
- [Entwicklungsumgebung](#entwicklungsumgebung)
- [Workflow](#workflow)
- [Commit-Konvention](#commit-konvention)
- [Pull Requests](#pull-requests)
- [Code-Style](#code-style)
- [Testen](#testen)

## Code of Conduct

- Sei respektvoll und konstruktiv
- Fokussiere auf das Problem, nicht die Person
- Hilf anderen bei ihren Beiträgen

## Erste Schritte

### Repository forken

1. Klicke auf "Fork" auf GitHub
2. Clone deinen Fork:
   ```bash
   git clone https://github.com/DEIN-USERNAME/FoodPlanner.git
   cd FoodPlanner
   ```
3. Füge das Original-Repository als Upstream hinzu:
   ```bash
   git remote add upstream https://github.com/milkrunner/FoodPlanner.git
   ```

### Upstream synchronisieren

```bash
git fetch upstream
git checkout main
git merge upstream/main
```

## Entwicklungsumgebung

### Voraussetzungen

- Docker & Docker Compose
- Node.js 18+ (für lokale Entwicklung)
- Git

### Setup

```bash
# Dependencies installieren
cd backend
npm install

# App starten
cd ..
docker-compose up -d

# Logs verfolgen
docker-compose logs -f
```

### Umgebungsvariablen

```bash
cp .env.example .env
# Bearbeite .env und füge deinen GEMINI_API_KEY hinzu
```

## Workflow

### 1. Issue erstellen oder finden

- Prüfe ob ein Issue bereits existiert
- Erstelle ein neues Issue für Bugs oder Features
- Warte auf Feedback bevor du große Änderungen startest

### 2. Branch erstellen

```bash
# Aktualisiere main
git checkout main
git pull upstream main

# Erstelle Feature-Branch
git checkout -b feature/meine-neue-funktion

# Oder für Bugfixes
git checkout -b fix/bug-beschreibung
```

### Branch-Naming

| Prefix | Verwendung |
|--------|-----------|
| `feature/` | Neue Funktionen |
| `fix/` | Bugfixes |
| `docs/` | Dokumentation |
| `refactor/` | Code-Refactoring |
| `test/` | Tests hinzufügen |

### 3. Änderungen machen

- Schreibe sauberen, lesbaren Code
- Halte Commits klein und fokussiert
- Teste deine Änderungen lokal

### 4. Committen

Siehe [Commit-Konvention](#commit-konvention) unten.

### 5. Push und Pull Request

```bash
git push origin feature/meine-neue-funktion
```

Erstelle dann einen Pull Request auf GitHub.

## Commit-Konvention

Wir verwenden [Conventional Commits](https://www.conventionalcommits.org/) für automatische Releases und Changelogs.

### Format

```
<type>(<scope>): <beschreibung>

[optionaler body]

[optionaler footer]
```

### Types

| Type | Beschreibung | Release |
|------|-------------|---------|
| `feat` | Neues Feature | Minor |
| `fix` | Bugfix | Patch |
| `docs` | Dokumentation | - |
| `style` | Formatierung (kein Code-Change) | - |
| `refactor` | Code-Refactoring | - |
| `perf` | Performance-Verbesserung | Patch |
| `test` | Tests | - |
| `chore` | Build/Tooling | - |
| `ci` | CI/CD | - |

### Scopes (optional)

- `recipes` - Rezepte
- `weekplan` - Wochenplan
- `shopping` - Einkaufsliste
- `ai` - KI-Features
- `api` - Backend API
- `ui` - User Interface
- `db` - Datenbank
- `docker` - Docker/Container

### Beispiele

```bash
# Feature
feat(recipes): add tag filtering

# Bugfix
fix(shopping): correct quantity calculation

# Dokumentation
docs: update API documentation

# Breaking Change
feat(api)!: change recipe response format

BREAKING CHANGE: ingredients are now objects instead of strings
```

## Pull Requests

### Checkliste

- [ ] Branch ist aktuell mit `main`
- [ ] Code folgt dem Style Guide
- [ ] Alle Tests bestehen
- [ ] Dokumentation ist aktualisiert (falls nötig)
- [ ] Commit-Messages folgen der Konvention

### PR-Beschreibung

```markdown
## Beschreibung
Kurze Beschreibung der Änderungen

## Art der Änderung
- [ ] Bug fix
- [ ] Neues Feature
- [ ] Breaking Change
- [ ] Dokumentation

## Wie wurde getestet?
Beschreibe wie du getestet hast

## Screenshots (falls UI-Änderungen)
```

### Review-Prozess

1. Automatische Checks laufen (CI)
2. Code-Review durch Maintainer
3. Feedback einarbeiten (falls nötig)
4. Merge nach Approval

## Code-Style

### JavaScript

- ES6+ Features verwenden
- Konsistente Einrückung (2 Spaces)
- Semikolons am Ende
- Single Quotes für Strings
- Aussagekräftige Variablennamen

```javascript
// Gut
const recipes = await fetchRecipes();
const filteredRecipes = recipes.filter(r => r.category === 'Hauptgericht');

// Schlecht
const r = await fetchRecipes();
const f = r.filter(x => x.category === 'Hauptgericht');
```

### SQL

- Keywords in UPPERCASE
- Tabellennamen in snake_case
- Einrückung für Lesbarkeit

```sql
SELECT r.name, COUNT(ch.id) AS times_cooked
FROM recipes r
LEFT JOIN cooking_history ch ON r.id = ch.recipe_id
GROUP BY r.id
ORDER BY times_cooked DESC;
```

### HTML/CSS

- Tailwind CSS Klassen verwenden
- Semantische HTML-Elemente
- Konsistente Klassennamen-Reihenfolge

## Testen

### Manuelles Testen

1. Starte die App mit Docker
2. Teste alle betroffenen Features
3. Prüfe Browser-Konsole auf Fehler
4. Teste mit und ohne Backend

### API-Tests

```bash
# Health Check
curl http://localhost:3000/health

# Rezept erstellen
curl -X POST http://localhost:3000/recipes \
  -H "Content-Type: application/json" \
  -d '{"id":"test","name":"Test","category":"Test","servings":1,"ingredients":[]}'
```

### Datenbank prüfen

```bash
# In Container einloggen
docker-compose exec postgres psql -U postgres -d foodplanner

# Tabellen anzeigen
\dt

# Daten prüfen
SELECT * FROM recipes LIMIT 5;
```

## Fragen?

- Erstelle ein Issue für Fragen
- Schreibe in die PR-Diskussion
- Schau in die bestehende Dokumentation

Vielen Dank für deinen Beitrag!
