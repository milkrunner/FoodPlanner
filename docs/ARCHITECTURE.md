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
  frontend:     # nginx mit statischen Dateien
  backend:      # Node.js Express Server
  postgres:     # PostgreSQL Datenbank
```

### Volumes

| Volume | Beschreibung |
|--------|--------------|
| `postgres-data` | PostgreSQL Daten (persistent) |

### Netzwerk

Alle Services teilen ein Docker Bridge Network:
- Frontend → Backend: `http://backend:3000`
- Backend → PostgreSQL: `postgresql://postgres:5432`

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
docker-compose up -d
```

### Produktion

1. `.env` mit echten Werten konfigurieren
2. HTTPS via Reverse Proxy (nginx, Traefik)
3. Backup-Strategie für PostgreSQL
4. Log-Aggregation einrichten

### CI/CD

GitHub Actions Workflow für:
- Automatische Releases (release-please)
- Docker Image Build und Push
- Release-Assets erstellen
