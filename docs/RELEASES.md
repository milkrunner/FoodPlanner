# Releases & Installation

Diese Dokumentation erklärt, wie du FoodPlanner installierst und aktualisierst.

## Schnellstart

Du brauchst nur **2 Dateien** - `docker-compose.yml` und `.env`:

```bash
# 1. docker-compose.yml herunterladen
curl -O https://raw.githubusercontent.com/milkrunner/FoodPlanner/main/docker-compose.yml

# 2. .env erstellen
echo "GEMINI_API_KEY=dein_api_key_hier" > .env

# 3. Starten
docker compose up -d
```

Fertig! Die App läuft unter http://localhost:5173.

## Docker Images

Docker Images werden automatisch bei jedem Release in der GitHub Container Registry veröffentlicht:

```bash
# Neueste Version
docker pull ghcr.io/milkrunner/foodplanner/backend:latest
docker pull ghcr.io/milkrunner/foodplanner/frontend:latest

# Spezifische Version
docker pull ghcr.io/milkrunner/foodplanner/backend:1.6.0
docker pull ghcr.io/milkrunner/foodplanner/frontend:1.6.0
```

## Konfiguration

Alle Konfiguration erfolgt über Umgebungsvariablen in der `.env` Datei:

| Variable | Erforderlich | Standard | Beschreibung |
|----------|--------------|----------|--------------|
| `GEMINI_API_KEY` | Ja | - | [Google AI Studio API Key](https://aistudio.google.com/apikey) |
| `DB_PASSWORD` | Nein | `foodplanner_secret` | PostgreSQL Passwort |
| `VERSION` | Nein | `latest` | Docker Image Version |
| `PORT` | Nein | `5173` | Port für die Web-Oberfläche |

Beispiel `.env`:
```dotenv
GEMINI_API_KEY=your_api_key_here
DB_PASSWORD=ein_sicheres_passwort
VERSION=1.6.0
PORT=8080
```

## Updates

```bash
# Neueste Images herunterladen und Container neu starten
docker compose pull
docker compose up -d
```

Für eine spezifische Version:
```bash
# In .env setzen
VERSION=1.6.0

# Dann
docker compose up -d
```

## GitHub Releases

Alle Releases findest du auf der [Releases-Seite](https://github.com/milkrunner/FoodPlanner/releases).

Jedes Release enthält:
- **Source Code** (zip/tar.gz) - Automatisch von GitHub generiert
- **foodplanner-x.x.x.tar.gz** - Deployment-Paket mit `docker-compose.yml` und `.env.example`
- **foodplanner-x.x.x.zip** - Gleiches Paket als ZIP

## Alternative: Manuelle Installation

Falls du kein Docker verwenden möchtest:

1. **Voraussetzungen:**
   - Node.js 18+
   - PostgreSQL 16+

2. **Backend installieren:**
   ```bash
   cd backend
   npm install
   DATABASE_URL=postgresql://user:pass@localhost:5432/foodplanner npm start
   ```

3. **Frontend bereitstellen:**
   - Statische Dateien (`index.html`, `app.js`, `sw.js`, `manifest.json`, `icons/`) mit einem Webserver ausliefern
   - `nginx.conf` als Referenz für die Konfiguration nutzen

## Versionsschema

FoodPlanner verwendet [Semantische Versionierung](https://semver.org/lang/de/):

- **Major** (x.0.0): Breaking Changes
- **Minor** (0.x.0): Neue Features (abwärtskompatibel)
- **Patch** (0.0.x): Bugfixes

## Release Notes

Die Release Notes werden automatisch aus den Commit-Messages generiert. Siehe auch:
- [CHANGELOG.md](../CHANGELOG.md) - Vollständige Änderungshistorie
- [Commit-Konvention](../.github/COMMIT_CONVENTION.md) - Wie Commits formatiert werden

## Probleme melden

Bei Problemen mit einem Release:
1. Prüfe die [bekannten Issues](https://github.com/milkrunner/FoodPlanner/issues)
2. Erstelle ein neues Issue mit der Release-Version
