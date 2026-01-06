# Food Planner

[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://github.com/milkrunner/FoodPlanner/pkgs/container/foodplanner%2Fbackend)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-336791.svg)](https://www.postgresql.org/)

Food Planner ist eine Web-App für Wochenpläne, Rezepte und Einkaufslisten mit optionaler KI-Unterstützung (Google Gemini).

## Kurzüberblick

- Wochen- und Tagesplanung für Frühstück, Mittag- und Abendessen
- Automatisch erzeugte, kategorisierte Einkaufslisten
- Rezeptverwaltung mit Import aus URLs sowie KI-Vorschlägen
- Docker-first Deployment, Dark Mode und Aktivitäts-Historie

## Schnellstart

1. Kopiere die unten aufgeführte `docker-compose.yml` auf deinen Zielserver.
2. Lege daneben eine `.env` an, basierend auf der unten aufgeführten `.env.example`.
3. Passe beide Dateien an deine Umgebung an (z. B. Secrets, Ports, Domains).
4. Starte die Services mit `docker compose up -d`.

Die App läuft anschließend unter http://localhost:5173.

### docker-compose.yml

```yaml
# Production Docker Compose - uses pre-built images from GitHub Releases
# Usage:
#   1. Copy this file and .env.example to your server
#   2. Rename .env.example to .env and configure your values
#   3. Run: docker-compose up -d

services:
  postgres:
    image: postgres:16-alpine
    container_name: foodplanner-db
    environment:
      POSTGRES_DB: foodplanner
      POSTGRES_USER: foodplanner
      POSTGRES_PASSWORD: ${DB_PASSWORD:-foodplanner_secret}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U foodplanner -d foodplanner"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  backend:
    image: ghcr.io/milkrunner/foodplanner/backend:${VERSION:-latest}
    container_name: foodplanner-backend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
      DATABASE_URL: postgresql://foodplanner:${DB_PASSWORD:-foodplanner_secret}@postgres:5432/foodplanner
    depends_on:
      postgres:
        condition: service_healthy
    restart: unless-stopped

  nginx:
    image: ghcr.io/milkrunner/foodplanner/frontend:${VERSION:-latest}
    container_name: foodplanner-nginx
    depends_on:
      - backend
    ports:
      - "5173:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./index.html:/usr/share/nginx/html/index.html:ro
      - ./app.js:/usr/share/nginx/html/app.js:ro
      - ./sw.js:/usr/share/nginx/html/sw.js:ro
      - ./manifest.json:/usr/share/nginx/html/manifest.json:ro
      - ./icons:/usr/share/nginx/html/icons:ro
    restart: unless-stopped

volumes:
  postgres-data:

```

### .env.example

```dotenv
# Gemini API Key
# Erhalte deinen kostenlosen API Key hier: https://aistudio.google.com/apikey
GEMINI_API_KEY=your_api_key_here

# PostgreSQL Konfiguration
DB_PASSWORD=foodplanner_secret
DATABASE_URL=postgresql://foodplanner:foodplanner_secret@localhost:5432/foodplanner

# CORS Konfiguration (Optional)
# Komma-getrennte Liste von erlaubten Origins für Cross-Origin Requests
# Standard: localhost-Varianten für Entwicklung sind immer erlaubt
# Beispiel für Produktion:
# CORS_ORIGINS=https://foodplanner.example.com,https://app.example.com
CORS_ORIGINS=

```

## Konfiguration

- Trage optionale Secrets (z. B. `GEMINI_API_KEY`, `DB_PASSWORD`) in `.env` ein.
- Passe nur Werte an, die du wirklich benötigst; Standardwerte decken lokale Nutzung ab.
- Weitere Optionen sind in der Beispieldatei dokumentiert.

## Entwickeln & Testen

```bash
# API inkl. Tests
cd backend
npm install
npm run dev
npm test
```

- Die API ist unter http://localhost:3000 erreichbar.
- Für ein statisches Frontend-Bundle kannst du im Projektroot `npm install && npm run build` nutzen.
- Alternativ liefert `docker-compose up -d` Backend und Frontend gleichzeitig aus.

## Deployment

- Lokale Entwicklung: `docker-compose up -d`
- Staging/Prod: Nutze die veröffentlichten Docker-Images aus der GitHub Container Registry.
- Individuelle Domains, Ports oder Secrets konfigurierst du über die Compose-Dateien.

## Technologie & Struktur

| Bereich | Technologie |
|---------|-------------|
| Frontend | Vanilla JS, Tailwind CSS |
| Backend | Node.js, Express |
| Datenbank | PostgreSQL |
| KI | Google Gemini API |
| Container | Docker |

- backend/ enthält API, Datenbankzugriff und Tests.
- db/ enthält Migrationen und Initialdaten.
- docs/ bündelt weiterführende Architektur-, API- und Betriebsinformationen.
- index.html und app.js bilden das ausgelieferte Frontend.

## Dokumentation & Links

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) – Systemüberblick und Betriebsleitfaden
- [docs/API.md](docs/API.md) – Endpunkte, Beispiele und Authentifizierung
- [docs/DATABASE.md](docs/DATABASE.md) – Schema, Migrationen und Datenflüsse
- [docs/postgresql-migration-plan.md](docs/postgresql-migration-plan.md) – Migration zu PostgreSQL
- [docs/RELEASES.md](docs/RELEASES.md) – Versionen, Roadmap und Changelog

Weitere How-tos (Troubleshooting, Deployment, Tests) findest du im docs-Verzeichnis.

## Typische Use Cases

- Wochenplanung und Einkaufslisten für Familien oder WGs
- Rezeptarchiv mit KI-basierter Inspiration für neue Gerichte
- Budget-Tracking durch Einkaufshistorie und kategorisierte Ausgaben
- Self-hosted Küchenassistent für Privacy-first Setups

## Mitwirken

1. Issue auswählen oder erstellen
2. Feature-Branch anlegen (`git checkout -b feat/dein-topic`)
3. Änderungen per Conventional Commits beschreiben
4. Pull Request eröffnen und Checks abwarten

Hilfreiche Links:

- [Issues](https://github.com/milkrunner/FoodPlanner/issues)
- [Releases](https://github.com/milkrunner/FoodPlanner/releases)
- [Docker Images](https://github.com/milkrunner/FoodPlanner/pkgs/container/foodplanner%2Fbackend)

## Support & Austausch

- Fehler, Fragen und Feature-Wünsche bitte über GitHub Issues einreichen.
- Diskussionen zu Roadmap oder Deployment-Fragen finden im docs-Verzeichnis dokumentierte Antworten.
