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

Du brauchst nur **2 Dateien** für das Deployment:

```bash
# 1. docker-compose.yml herunterladen
curl -O https://raw.githubusercontent.com/milkrunner/FoodPlanner/main/docker-compose.yml

# 2. .env erstellen mit deinem Gemini API Key
echo "GEMINI_API_KEY=dein_api_key_hier" > .env

# 3. Starten
docker compose up -d
```

Die App läuft anschließend unter http://localhost:5173.

### Konfiguration (.env)

| Variable | Erforderlich | Standard | Beschreibung |
|----------|--------------|----------|--------------|
| `GEMINI_API_KEY` | Ja | - | [Google AI Studio API Key](https://aistudio.google.com/apikey) |
| `DB_PASSWORD` | Nein | `foodplanner_secret` | PostgreSQL Passwort |
| `VERSION` | Nein | `latest` | Docker Image Version (z.B. `1.6.0`) |
| `PORT` | Nein | `5173` | Port für die Web-Oberfläche |

Beispiel `.env`:
```dotenv
GEMINI_API_KEY=your_api_key_here
DB_PASSWORD=ein_sicheres_passwort
#VERSION=1.6.0
#PORT=8080
```

## Entwickeln & Testen

```bash
# Lokale Entwicklung mit Hot-Reload
docker compose -f docker-compose.dev.yml up -d --build

# Backend Tests
cd backend
npm install
npm test
```

- Die API ist unter http://localhost:3000 erreichbar
- Swagger-Dokumentation unter http://localhost:3000/api-docs

## Technologie & Struktur

| Bereich | Technologie |
|---------|-------------|
| Frontend | Vanilla JS, Tailwind CSS |
| Backend | Node.js, Express |
| Datenbank | PostgreSQL |
| KI | Google Gemini API |
| Container | Docker |

```
FoodPlanner/
├── backend/          # API, Datenbank, Tests
│   ├── db/           # Migrationen
│   └── Dockerfile
├── icons/            # PWA Icons
├── index.html        # Frontend
├── app.js            # Frontend Logic
├── nginx.conf        # Webserver Config
├── Dockerfile.frontend
├── docker-compose.yml      # Production
└── docker-compose.dev.yml  # Development
```

## Dokumentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - Systemübersicht und Betriebsleitfaden
- [docs/API.md](docs/API.md) - Endpunkte, Beispiele und Authentifizierung
- [docs/DATABASE.md](docs/DATABASE.md) - Schema, Migrationen und Datenflüsse
- [docs/RELEASES.md](docs/RELEASES.md) - Versionen und Installation

## Docker Images

Die Images werden automatisch bei jedem Release in der GitHub Container Registry veröffentlicht:

```bash
# Backend
docker pull ghcr.io/milkrunner/foodplanner/backend:latest

# Frontend (inkl. nginx, statische Dateien)
docker pull ghcr.io/milkrunner/foodplanner/frontend:latest
```

## Mitwirken

1. Issue auswählen oder erstellen
2. Feature-Branch anlegen (`git checkout -b feat/dein-topic`)
3. Änderungen per Conventional Commits beschreiben
4. Pull Request eröffnen und Checks abwarten

Hilfreiche Links:

- [Issues](https://github.com/milkrunner/FoodPlanner/issues)
- [Releases](https://github.com/milkrunner/FoodPlanner/releases)
- [Docker Images](https://github.com/milkrunner/FoodPlanner/pkgs/container/foodplanner%2Fbackend)
