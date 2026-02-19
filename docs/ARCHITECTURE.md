# Architektur-Übersicht

Dieses Dokument beschreibt die technische Architektur des FoodPlanner-Projekts.

## Systemübersicht

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Frontend (SPA)                           ││
│  │              index.html + app.js                            ││
│  │              Tailwind CSS (CDN)                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Docker Compose                                │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐   │
│  │   nginx       │    │   Backend     │    │  PostgreSQL   │   │
│  │   (Frontend)  │───▶│   (Express)   │───▶│   Database    │   │
│  │   Port 5173   │    │   Port 3000   │    │   Port 5432   │   │
│  └───────────────┘    └───────────────┘    └───────────────┘   │
│                              │                                   │
│                              ▼                                   │
│                    ┌───────────────┐                            │
│                    │  Google       │                            │
│                    │  Gemini API   │                            │
│                    └───────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## Komponenten

### Frontend

**Technologie:** Vanilla JavaScript (ES6+), Tailwind CSS

Das Frontend ist eine Single-Page-Application (SPA) ohne Build-Prozess:

- **index.html**: Hauptseite mit allen UI-Komponenten
- **app.js**: Gesamte Anwendungslogik (~2000 Zeilen)
- **Tailwind CSS**: Über CDN eingebunden

**Besonderheiten:**
- Kein Framework (React, Vue, etc.)
- Kein Bundler (Webpack, Vite, etc.)
- Direkt im Browser ausführbar
- Fallback auf localStorage wenn Backend nicht verfügbar

**State Management:**
```javascript
// Zentraler State in app.js
let recipes = [];
let weekPlan = null;
let currentView = 'weekplan';
```

### Backend

**Technologie:** Node.js, Express.js

Der Backend-Server stellt eine REST API bereit:

```
backend/
├── server.js           # Express Server + alle Routes
├── package.json        # Dependencies
├── Dockerfile          # Container-Definition
└── db/
    ├── index.js        # Datenbank-Abstraktionsschicht
    └── migrations/     # SQL Migrations
```

**Middleware:**
1. CORS - Cross-Origin Resource Sharing
2. Body Parser - JSON (max 10MB)
3. Rate Limiting - Allgemein + KI-spezifisch

**Rate Limiting:**
```javascript
// Allgemein: 100 Anfragen / 15 Min
// KI-Endpoints: 20 Anfragen / 15 Min
// Localhost: Kein Limit
```

### Datenbank

**Technologie:** PostgreSQL 14+

Siehe [DATABASE.md](DATABASE.md) für das vollständige Schema.

**Features:**
- JSONB für flexible Datenstrukturen (Templates)
- Foreign Keys mit CASCADE DELETE
- Automatische Timestamps (created_at, updated_at)
- Optimierte Indizes

**Connection Pooling:**
```javascript
// pg Pool mit Standard-Konfiguration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

### KI-Integration

**Technologie:** Google Gemini API (gemini-2.5-flash)

**Features:**
- Rezeptgenerierung aus Zutaten
- Rezept-Parsing (Text + URL)
- Video-Rezept-Parsing (TikTok, Instagram, etc.)
- Intelligente Portionsskalierung
- Zutatenkategorisierung
- Einkaufslistenoptimierung

**Architektur:**
```javascript
// Fallback-System für Kategorisierung
1. Versuche KI-Kategorisierung
2. Bei Fehler: Regel-basierte Kategorisierung
```

**Sicherheit:**
- URL-Allowlist für Rezept-URLs (SSRF-Schutz)
- Strikte URL-Validierung für Videos
- execFile statt exec (Command Injection-Schutz)

## Datenfluss

### Rezept erstellen

```
User Input
    │
    ▼
Frontend (app.js)
    │
    ├─▶ Validierung
    │
    ▼
POST /recipes
    │
    ▼
Backend (server.js)
    │
    ├─▶ Transaktion starten
    ├─▶ INSERT recipes
    ├─▶ INSERT ingredients (foreach)
    ├─▶ INSERT recipe_tags (foreach)
    ├─▶ Transaktion commit
    │
    ▼
Response 201
    │
    ▼
Frontend Update
```

### Einkaufsliste generieren

```
Wochenplan im Frontend
    │
    ▼
Alle Rezept-IDs sammeln
    │
    ▼
Zutaten aus allen Rezepten
    │
    ├─▶ Gruppieren nach Name
    ├─▶ Mengen addieren
    ├─▶ Nach Kategorie sortieren
    │
    ▼
+ Manuelle Einträge (GET /shopping/manual)
    │
    ▼
Einkaufsliste anzeigen
```

### KI-Rezept-Parsing

```
URL/Text Input
    │
    ▼
POST /ai/parse-recipe
    │
    ├─▶ URL? → Fetch + HTML-Extraktion
    │
    ▼
Gemini API Prompt
    │
    ▼
JSON-Extraktion aus Response
    │
    ▼
Validierung + Defaults
    │
    ▼
Strukturiertes Rezept
```

## Container-Architektur

### Docker Compose Services

```yaml
services:
  frontend:     # nginx mit statischen Dateien (alles im Image enthalten)
  backend:      # Node.js Express Server
  postgres:     # PostgreSQL Datenbank
```

### Docker Images

Die Images werden bei jedem Release in der GitHub Container Registry veröffentlicht:

| Image | Inhalt |
|-------|--------|
| `ghcr.io/milkrunner/foodplanner/frontend` | nginx + statische Dateien (index.html, app.js, sw.js, manifest.json, icons/, nginx.conf) |
| `ghcr.io/milkrunner/foodplanner/backend` | Node.js + Express API + yt-dlp |

### Volumes

| Volume | Beschreibung |
|--------|--------------|
| `postgres-data` | PostgreSQL Daten (persistent) |

### Netzwerk

Alle Services teilen ein Docker Bridge Network:
- Frontend → Backend: `http://backend:3000`
- Backend → PostgreSQL: `postgresql://postgres:5432`

### Deployment

Für Production brauchst du nur:
1. `docker-compose.yml` - Container-Orchestrierung
2. `.env` - Konfiguration (GEMINI_API_KEY, etc.)

Alle anderen Dateien (Frontend, nginx.conf, etc.) sind bereits in den Docker Images enthalten.

## Sicherheit

### SSRF-Schutz

Rezept-URLs werden gegen eine Allowlist geprüft:

```javascript
const ALLOWED_RECIPE_DOMAINS = [
  'chefkoch.de',
  'eatsmarter.de',
  'lecker.de',
  // ...
];
```

### Command Injection-Schutz

Video-Downloads verwenden `execFile` statt `exec`:

```javascript
// Sicher: Argumente als Array
execFile('yt-dlp', ['-f', 'best', url], ...)

// Unsicher (nicht verwendet):
exec(`yt-dlp -f best ${url}`)
```

### Rate Limiting

- Schützt vor DoS-Angriffen
- Limitiert teure KI-Anfragen
- Header informieren über Limits

## Performance

### Datenbank-Optimierung

- Indizes auf häufig gefilterte Spalten
- Connection Pooling
- Prepared Statements

### Frontend-Optimierung

- Kein Build-Prozess = schnelles Laden
- Tailwind CSS via CDN (gecached)
- Minimale JavaScript-Dependencies

### Caching

- Aktuell: Kein serverseitiges Caching
- Browser-Cache für statische Assets
- Potenzial: Redis für KI-Responses

## Frontend Design System

Das Frontend verwendet ein Animal Crossing-inspiriertes Design System, konfiguriert über Tailwind CSS in `index.html`.

### Farbpalette

| Token | Verwendung |
|-------|-----------|
| `ac-mint` | Primärfarbe, Buttons, Akzente |
| `ac-peach` | Sekundärfarbe, Warnungen, Call-to-Actions |
| `ac-cream` | Hintergrundflächen (Light Mode) |
| `ac-brown` | Text, Borders, Akzente |
| `ac-leaf` | Erfolg, Tags, Kategorien |
| `ac-blue` | Info, Links |
| `ac-yellow` | Highlights, Sterne |
| `ac-night` | Hintergrundflächen (Dark Mode) |

Jede Farbe bietet abgestufte Varianten (50–900), definiert in der `tailwind.config` Sektion von `index.html`.

### Typografie

- **Font:** Nunito (Google Fonts), Fallback auf `system-ui, sans-serif`
- **Konfiguration:** `fontFamily.ac` in Tailwind

### Border Radius & Shadows

Abgerundete Ecken und weiche Schatten erzeugen den charakteristischen Animal Crossing-Look:

- `rounded-ac-sm` / `rounded-ac` / `rounded-ac-lg` / `rounded-ac-xl` / `rounded-ac-pill`
- `shadow-ac-sm` / `shadow-ac` / `shadow-ac-lg` / `shadow-ac-glow`
- Dark Mode-Varianten: `shadow-ac-dark-sm` / `shadow-ac-dark` / `shadow-ac-dark-lg`

### Dark Mode

- Aktiviert über `darkMode: 'class'` in Tailwind
- Verwendet `ac-night`-Farbpalette für Hintergründe
- Schatten wechseln zu `ac-dark-*` Varianten

## Erweiterbarkeit

### Neue API-Endpoints

1. Route in `server.js` hinzufügen
2. Falls nötig: Migration in `db/migrations/`
3. API-Dokumentation aktualisieren

### Neue KI-Features

1. Neuen Endpoint mit `aiLimiter` erstellen
2. Gemini Prompt definieren
3. JSON-Response parsen und validieren

### Neue Video-Plattformen

1. Regex-Pattern zu `VIDEO_PLATFORMS` hinzufügen
2. Testen ob yt-dlp die Plattform unterstützt

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Prüft:
- Server-Erreichbarkeit
- Datenbank-Verbindung

### Logs

```bash
# Alle Container
docker-compose logs -f

# Nur Backend
docker-compose logs -f backend
```

## Deployment

### Entwicklung

```bash
# Mit lokalen Dateien und Hot-Reload
docker compose -f docker-compose.dev.yml up -d --build
```

### Produktion

Nur 2 Dateien nötig:

```bash
# 1. docker-compose.yml herunterladen
curl -O https://raw.githubusercontent.com/milkrunner/FoodPlanner/main/docker-compose.yml

# 2. .env erstellen
echo "GEMINI_API_KEY=dein_key" > .env

# 3. Starten
docker compose up -d
```

Weitere Empfehlungen:
- HTTPS via Reverse Proxy (nginx, Traefik, Caddy)
- Backup-Strategie für PostgreSQL (`postgres-data` Volume)
- Log-Aggregation einrichten

### CI/CD

GitHub Actions Workflow für:
- Automatische Releases (release-please)
- Docker Image Build und Push zu ghcr.io
- Release-Assets erstellen (docker-compose.yml + .env.example)
