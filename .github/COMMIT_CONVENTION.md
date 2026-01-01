# Commit-Konvention

Dieses Projekt verwendet [Conventional Commits](https://www.conventionalcommits.org/) für automatische Releases und Changelog-Generierung.

## Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

## Typen

| Typ | Beschreibung | Release |
|-----|-------------|---------|
| `feat` | Neues Feature | Minor (0.x.0) |
| `fix` | Bugfix | Patch (0.0.x) |
| `docs` | Nur Dokumentation | - |
| `style` | Code-Formatierung (kein Code-Change) | - |
| `refactor` | Code-Refactoring (kein neues Feature, kein Bugfix) | - |
| `perf` | Performance-Verbesserungen | Patch (0.0.x) |
| `test` | Tests hinzufügen oder korrigieren | - |
| `chore` | Build-Prozess oder Hilfsmittel | - |
| `ci` | CI/CD Änderungen | - |
| `build` | Build-System Änderungen | - |

## Beispiele

### Feature hinzufügen
```
feat(recipes): add tag filtering functionality

Users can now filter recipes by multiple tags simultaneously.
```

### Bugfix
```
fix(shopping): correct quantity calculation for scaled portions

The shopping list was doubling quantities when portions were scaled.
Closes #42
```

### Breaking Change
```
feat(api): change recipe endpoint structure

BREAKING CHANGE: Recipe ingredients are now returned as objects instead of strings.
```

## Scopes (optional)

- `recipes` - Rezept-Funktionalität
- `weekplan` - Wochenplanung
- `shopping` - Einkaufsliste
- `ai` - AI-Features (Gemini)
- `api` - Backend API
- `ui` - User Interface
- `docker` - Docker/Deployment
- `db` - Datenbank

## Breaking Changes

Um ein Breaking Change zu markieren:
1. Füge `!` nach dem Type/Scope hinzu: `feat!: ...` oder `feat(api)!: ...`
2. Oder füge einen `BREAKING CHANGE:` Footer hinzu

Breaking Changes erhöhen die Major-Version (x.0.0) ab Version 1.0.0.

## Automatische Releases

Nach jedem Merge in `main`:
1. Release-Please analysiert die Commits
2. Erstellt/aktualisiert einen Release-PR
3. Nach Merge des Release-PR wird ein GitHub Release erstellt
4. Docker Images werden gebaut und gepusht
5. Release-Assets werden erstellt
