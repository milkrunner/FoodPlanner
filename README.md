# Food Planner - Essenswochenplaner

[![License](https://img.shields.io/badge/license-Private-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://github.com/milkrunner/FoodPlanner/pkgs/container/foodplanner%2Fbackend)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-336791.svg)](https://www.postgresql.org/)

Eine moderne Web-Anwendung zum Planen deiner Wochenmahlzeiten, Verwalten von Rezepten und automatischen Erstellen von Einkaufslisten. Mit KI-gestützter Rezeptgenerierung und intelligenter Portionsanpassung.

<!--
Screenshots hier einfügen:
![Wochenplan](docs/screenshots/weekplan.png)
![Rezepte](docs/screenshots/recipes.png)
![Einkaufsliste](docs/screenshots/shopping.png)
-->

## Inhaltsverzeichnis

- [Features](#features)
- [Schnellstart](#schnellstart)
- [Installation](#installation)
- [Konfiguration](#konfiguration)
- [Nutzung](#nutzung)
- [API-Dokumentation](#api-dokumentation)
- [Architektur](#architektur)
- [Beitragen](#beitragen)
- [Troubleshooting](#troubleshooting)
- [Releases](#releases)

## Features

### Kernfunktionen
- **Wochenplanung**: Plane Mahlzeiten für die gesamte Woche (Frühstück, Mittagessen, Abendessen)
- **Wochenplan-Vorlagen**: Speichere häufig genutzte Wochenpläne als Vorlagen
- **Rezeptdatenbank**: Erstelle und verwalte Rezepte mit Zutaten und Anleitung
- **Rezept-Tags**: Organisiere Rezepte mit Tags (vegetarisch, vegan, glutenfrei, schnell, etc.)
- **Einkaufsliste**: Automatische Generierung mit Kategorisierung nach Warengruppen
- **Kochverlauf**: Verfolge wann du welches Rezept zuletzt gekocht hast

### KI-Features (Gemini API)
- **Rezeptgenerierung**: Erstelle Rezepte aus vorhandenen Zutaten
- **Rezept-Parser**: Importiere Rezepte aus Text oder URLs (Chefkoch, EatSmarter, etc.)
- **Video-Rezept-Parser**: Extrahiere Rezepte aus TikTok, Instagram Reels, YouTube Shorts
- **Intelligente Portionsanpassung**: Automatische Skalierung von Rezeptmengen
- **Einkaufsoptimierung**: KI-gestützte Vorschläge für günstigere Alternativen

### Weitere Features
- **Budget-Verwaltung**: Setze Wochenbudgets für Einkäufe
- **Dark Mode**: Helles und dunkles Design
- **Undo-Funktion**: Aktionen rückgängig machen (Strg+Z)
- **Export-Funktionen**: Einkaufsliste als Text exportieren oder kopieren
- **Offline-Modus**: Funktioniert auch ohne Backend (localStorage)

## Schnellstart

```bash
# Repository klonen
git clone https://github.com/milkrunner/FoodPlanner.git
cd FoodPlanner

# Mit Docker starten
docker-compose up -d

# App öffnen
open http://localhost:5173
```

Das war's! Die App läuft jetzt unter http://localhost:5173

## Installation

### Docker (Empfohlen)

**Voraussetzungen:**
- Docker & Docker Compose

```bash
# App starten
docker-compose up -d

# Logs ansehen
docker-compose logs -f

# App stoppen
docker-compose down

# Neu bauen (nach Updates)
docker-compose up -d --build

# Alle Daten löschen
docker-compose down -v
```

### Lokale Entwicklung

**Voraussetzungen:**
- Node.js 18+
- PostgreSQL 14+

```bash
# Backend
cd backend
npm install
npm start

# Frontend (neues Terminal)
# Option 1: Python HTTP Server
python -m http.server 8080

# Option 2: Beliebiger HTTP Server
npx serve .
```

Öffne http://localhost:8080

### Ohne Backend

Die App funktioniert auch ohne Backend:

1. Öffne `index.html` direkt im Browser
2. Daten werden im localStorage gespeichert
3. KI-Features sind nicht verfügbar

## Konfiguration

### Umgebungsvariablen

Erstelle eine `.env` Datei im Root-Verzeichnis:

```bash
# Kopiere das Template
cp .env.example .env
```

| Variable | Beschreibung | Standard | Erforderlich |
|----------|--------------|----------|--------------|
| `GEMINI_API_KEY` | Google Gemini API Key für KI-Features | - | Nein* |
| `PORT` | Backend-Port | `3000` | Nein |
| `DATABASE_URL` | PostgreSQL Connection String | `postgresql://...` | Ja (Docker) |

*Ohne API-Key funktionieren die KI-Features nicht.

**Gemini API Key beantragen:** https://ai.google.dev/

### Docker Compose Konfiguration

Die `docker-compose.yml` kann angepasst werden:

```yaml
services:
  frontend:
    ports:
      - "5173:80"  # Ändere den Port hier

  backend:
    environment:
      - GEMINI_API_KEY=${GEMINI_API_KEY}
```

## Nutzung

### Rezepte erstellen

1. Klicke auf "Rezepte" im Menü
2. Klicke auf "Neues Rezept"
3. Fülle Name, Kategorie, Portionen aus
4. Füge Zutaten mit Mengen hinzu
5. Schreibe die Zubereitungsanleitung
6. Speichern

**Rezept importieren:**
- Füge eine URL von Chefkoch, EatSmarter etc. ein
- Oder kopiere Rezepttext und lasse ihn parsen

### Wochenplan erstellen

1. Klicke auf "Wochenplan" im Menü
2. Klicke auf eine Mahlzeit (Frühstück/Mittagessen/Abendessen)
3. Wähle ein Rezept aus der Liste
4. Der Plan wird automatisch gespeichert

### Einkaufsliste generieren

1. Erstelle einen Wochenplan mit Rezepten
2. Klicke auf "Einkaufsliste"
3. Die Zutaten werden automatisch zusammengefasst
4. Füge manuelle Artikel hinzu falls nötig
5. Exportiere die Liste

## API-Dokumentation

Vollständige API-Dokumentation: [docs/API.md](docs/API.md)

### Übersicht der Endpoints

| Bereich | Endpoints | Beschreibung |
|---------|-----------|--------------|
| Rezepte | `GET/POST/PUT/DELETE /recipes` | CRUD für Rezepte |
| Wochenplan | `GET/POST/DELETE /weekplan` | Wochenplanung |
| Vorlagen | `GET/POST/PUT/DELETE /weekplan/templates` | Wochenplan-Vorlagen |
| Einkaufsliste | `GET/POST/DELETE /shopping/manual` | Manuelle Einträge |
| Budget | `GET/POST /shopping/budget` | Budget-Verwaltung |
| Kochverlauf | `GET/POST/DELETE /cooking-history` | Kochverlauf |
| KI | `POST /ai/*` | KI-gestützte Features |
| System | `GET /health` | Health Check |

### Beispiel: Rezept erstellen

```bash
curl -X POST http://localhost:3000/recipes \
  -H "Content-Type: application/json" \
  -d '{
    "id": "1234",
    "name": "Spaghetti Carbonara",
    "category": "Hauptgericht",
    "servings": 4,
    "ingredients": [
      {"name": "Spaghetti", "amount": "400", "unit": "g", "category": "Trockenwaren"},
      {"name": "Speck", "amount": "200", "unit": "g", "category": "Fleisch & Fisch"}
    ],
    "instructions": "1. Spaghetti kochen..."
  }'
```

## Architektur

Detaillierte Architektur-Dokumentation: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

### Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend | Vanilla JavaScript (ES6+), Tailwind CSS |
| Backend | Node.js, Express.js |
| Datenbank | PostgreSQL mit JSONB |
| KI | Google Gemini API |
| Container | Docker, Docker Compose |
| Webserver | nginx |

### Projektstruktur

```
FoodPlanner/
├── index.html              # Frontend HTML
├── app.js                  # Frontend JavaScript
├── nginx.conf              # nginx Konfiguration
├── docker-compose.yml      # Container-Orchestrierung
├── .env.example            # Umgebungsvariablen Template
├── backend/
│   ├── server.js           # Express API Server
│   ├── package.json        # Dependencies
│   ├── Dockerfile          # Backend Container
│   └── db/
│       ├── index.js        # Datenbank-Abstraktionsschicht
│       └── migrations/     # SQL Migrations
└── docs/
    ├── API.md              # API-Dokumentation
    ├── ARCHITECTURE.md     # Architektur-Übersicht
    ├── DATABASE.md         # Datenbank-Schema
    └── RELEASES.md         # Release-Dokumentation
```

## Beitragen

Wir freuen uns über Beiträge! Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

### Kurzanleitung

1. Fork das Repository
2. Erstelle einen Feature-Branch (`git checkout -b feature/neue-funktion`)
3. Committe mit [Conventional Commits](https://www.conventionalcommits.org/)
4. Push und erstelle einen Pull Request

### Commit-Konvention

Dieses Projekt verwendet Conventional Commits für automatische Releases:

```bash
feat: neues Feature hinzugefügt
fix: Bug behoben
docs: Dokumentation aktualisiert
```

Siehe [.github/COMMIT_CONVENTION.md](.github/COMMIT_CONVENTION.md) für Details.

## Troubleshooting

### Häufige Probleme

#### Container startet nicht

```bash
# Logs prüfen
docker-compose logs backend

# Container neu starten
docker-compose restart

# Komplett neu bauen
docker-compose down && docker-compose up -d --build
```

#### Datenbank-Verbindungsfehler

```bash
# PostgreSQL Container prüfen
docker-compose logs postgres

# Datenbank zurücksetzen
docker-compose down -v
docker-compose up -d
```

#### KI-Features funktionieren nicht

1. Prüfe ob `GEMINI_API_KEY` in `.env` gesetzt ist
2. Prüfe ob der API-Key gültig ist: https://ai.google.dev/
3. Prüfe die Backend-Logs: `docker-compose logs backend`

#### Port bereits belegt

```bash
# Anderen Port verwenden
# In docker-compose.yml ändern:
ports:
  - "8080:80"  # statt 5173:80
```

### Logs und Debugging

```bash
# Alle Logs
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend

# In Container einloggen
docker-compose exec backend sh
```

### Backup & Restore

**Backup erstellen:**
```bash
docker run --rm -v foodplanner_postgres-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/foodplanner-backup.tar.gz /data
```

**Backup wiederherstellen:**
```bash
docker run --rm -v foodplanner_postgres-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/foodplanner-backup.tar.gz -C /
```

## Releases

Releases werden automatisch nach jedem Merge in `main` erstellt.

- [Alle Releases](https://github.com/milkrunner/FoodPlanner/releases)
- [Docker Images](https://github.com/milkrunner/FoodPlanner/pkgs/container/foodplanner%2Fbackend)
- [Download & Installation](docs/RELEASES.md)

## Browser-Kompatibilität

| Browser | Version |
|---------|---------|
| Chrome/Edge | 90+ |
| Firefox | 88+ |
| Safari | 14+ |

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch erstellt.
