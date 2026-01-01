# Releases & Installation

Diese Dokumentation erklärt, wie du FoodPlanner-Releases herunterlädst und installierst.

## Releases herunterladen

### GitHub Releases

Alle Releases findest du auf der [Releases-Seite](https://github.com/milkrunner/FoodPlanner/releases).

Jedes Release enthält:
- **Source Code** (zip/tar.gz) - Automatisch von GitHub generiert
- **foodplanner-x.x.x.tar.gz** - Deployment-Paket (tar.gz)
- **foodplanner-x.x.x.zip** - Deployment-Paket (zip)

### Docker Images

Docker Images werden automatisch in der GitHub Container Registry veröffentlicht:

```bash
# Neueste Version
docker pull ghcr.io/milkrunner/foodplanner/backend:latest

# Spezifische Version
docker pull ghcr.io/milkrunner/foodplanner/backend:1.0.0
```

## Installation

### Option 1: Docker Compose (Empfohlen)

1. **Release herunterladen und entpacken:**
   ```bash
   # Mit wget
   wget https://github.com/milkrunner/FoodPlanner/releases/latest/download/foodplanner-x.x.x.tar.gz
   tar -xzf foodplanner-x.x.x.tar.gz
   cd foodplanner-x.x.x

   # Oder mit curl
   curl -LO https://github.com/milkrunner/FoodPlanner/releases/latest/download/foodplanner-x.x.x.zip
   unzip foodplanner-x.x.x.zip
   ```

2. **Umgebungsvariablen konfigurieren:**
   ```bash
   cp .env.example .env
   # Bearbeite .env und füge deinen GEMINI_API_KEY hinzu (optional für AI-Features)
   ```

3. **App starten:**
   ```bash
   docker-compose up -d
   ```

4. **App aufrufen:**
   Öffne http://localhost:5173 im Browser

### Option 2: Direkt mit Docker Image

```bash
# Backend starten
docker run -d \
  --name foodplanner-backend \
  -p 3000:3000 \
  -v foodplanner-data:/app/data \
  -e GEMINI_API_KEY=dein-key \
  ghcr.io/milkrunner/foodplanner/backend:latest

# Frontend mit nginx (oder anderem Webserver)
# Lade die statischen Dateien (index.html, app.js, nginx.conf) vom Release
```

### Option 3: Manuelle Installation

1. **Voraussetzungen:**
   - Node.js 18+
   - npm

2. **Backend installieren:**
   ```bash
   cd backend
   npm install
   npm start
   ```

3. **Frontend bereitstellen:**
   - Statische Dateien (`index.html`, `app.js`) mit einem Webserver deiner Wahl ausliefern
   - Oder direkt `index.html` im Browser öffnen (localStorage-Modus)

## Release Assets

| Asset | Beschreibung |
|-------|-------------|
| `foodplanner-x.x.x.tar.gz` | Komplettes Deployment-Paket (Linux/Mac) |
| `foodplanner-x.x.x.zip` | Komplettes Deployment-Paket (Windows) |
| `Source code (zip)` | Vollständiger Quellcode |
| `Source code (tar.gz)` | Vollständiger Quellcode |

### Inhalt der Deployment-Pakete

```
foodplanner-x.x.x/
├── docker-compose.yml   # Container-Orchestrierung
├── .env.example         # Umgebungsvariablen-Template
├── nginx.conf           # Nginx-Konfiguration
├── index.html           # Frontend HTML
├── app.js               # Frontend JavaScript
└── backend/
    ├── server.js        # Express API Server
    ├── package.json     # Backend Dependencies
    └── Dockerfile       # Backend Container
```

## Updates

### Mit Docker Compose

```bash
# Neues Release herunterladen
# Dann:
docker-compose pull
docker-compose up -d
```

### Mit Docker Image

```bash
docker pull ghcr.io/milkrunner/foodplanner/backend:latest
docker stop foodplanner-backend
docker rm foodplanner-backend
# Container neu starten (siehe Option 2)
```

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
