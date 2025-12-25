# Food Planner - Essenswochenplaner

Eine moderne Web-Anwendung zum Planen deiner Wochenmahlzeiten, Verwalten von Rezepten und automatischen Erstellen von Einkaufslisten.

## Features

- **Wochenplanung**: Plane deine Mahlzeiten für die gesamte Woche (Frühstück, Mittagessen, Abendessen)
- **Wochenplan-Vorlagen**: Speichere häufig genutzte Wochenpläne als Vorlagen
- **Rezeptdatenbank**: Erstelle und verwalte Rezepte mit Zutaten und Anleitung
- **Rezept-Tags**: Organisiere Rezepte mit Tags (vegetarisch, vegan, glutenfrei, schnell, etc.)
- **AI-Rezeptgenerierung**: Generiere Rezepte aus vorhandenen Zutaten via Gemini AI
- **Intelligente Portionsanpassung**: Automatische Skalierung von Rezeptmengen
- **Einkaufsliste**: Automatische Generierung mit Kategorisierung nach Warengruppen
- **Manuelle Einträge**: Füge zusätzliche Artikel zur Einkaufsliste hinzu
- **Dark Mode**: Helles und dunkles Design
- **Undo-Funktion**: Aktionen rückgängig machen (Strg+Z)
- **Export-Funktionen**: Liste als Textdatei oder in die Zwischenablage kopieren
- **Datenpersistenz**: SQLite-Datenbank mit Docker Volumes oder Browser localStorage

## Technologie-Stack

**Frontend**: Vanilla JavaScript (ES6+), Tailwind CSS (CDN), nginx
**Backend**: Node.js, Express, SQLite
**AI**: Google Gemini API
**Deployment**: Docker & Docker Compose

## Installation und Start

### 🐳 Docker (Empfohlen)

```bash
# App starten
docker-compose up -d

# App aufrufen
http://localhost:5173
```

**Weitere Commands:**

```bash
# Logs ansehen
docker-compose logs -f

# App stoppen
docker-compose down

# Neu bauen
docker-compose up -d --build

# Alle Daten löschen
docker-compose down -v
```

### 💻 Lokale Entwicklung

```bash
# Backend starten
cd backend
npm install
npm start

# Frontend starten (neues Terminal)
python -m http.server 8080
# Öffne http://localhost:8080
```

**Ohne Backend**: Öffne `index.html` direkt im Browser (Daten nur in localStorage).

## Projektstruktur

```
FoodPlanner/
├── index.html           # Frontend HTML
├── app.js               # Frontend JavaScript (2170 Zeilen)
├── nginx.conf           # Nginx Konfiguration
├── docker-compose.yml   # Container Orchestrierung
├── backend/
│   ├── server.js        # Express API Server
│   ├── package.json     # Dependencies
│   ├── Dockerfile       # Backend Container
│   └── data/            # SQLite DB (Docker Volume)
└── .env.example         # Umgebungsvariablen Template
```

## API Endpoints

### Rezepte
- `GET /recipes` - Alle Rezepte abrufen
- `GET /recipes/:id` - Einzelnes Rezept abrufen
- `POST /recipes` - Neues Rezept erstellen
- `PUT /recipes/:id` - Rezept aktualisieren
- `DELETE /recipes/:id` - Rezept löschen

### Wochenplan
- `GET /weekplan` - Aktuellen Wochenplan abrufen
- `POST /weekplan` - Wochenplan speichern
- `DELETE /weekplan` - Wochenplan löschen

### Wochenplan-Vorlagen
- `GET /weekplan/templates` - Alle Vorlagen
- `GET /weekplan/templates/:id` - Einzelne Vorlage
- `POST /weekplan/templates` - Vorlage erstellen
- `PUT /weekplan/templates/:id` - Vorlage aktualisieren
- `DELETE /weekplan/templates/:id` - Vorlage löschen

### Einkaufsliste
- `GET /shopping/manual` - Manuelle Einträge abrufen
- `POST /shopping/manual` - Manuellen Eintrag hinzufügen
- `DELETE /shopping/manual/:id` - Eintrag löschen
- `DELETE /shopping/manual` - Alle manuellen Einträge löschen

### AI-Features
- `POST /ai/generate-recipes` - Rezepte aus Zutaten generieren
- `POST /ai/scale-portions` - Portionen intelligent skalieren

### System
- `GET /health` - Health Check

## Datenpersistenz

**Mit Docker**: SQLite in Docker Volume `backend-data` (persistent)
**Ohne Docker**: Browser localStorage (geht bei Cache-Löschung verloren)

**Backup erstellen:**

```bash
docker run --rm -v backend-data:/data -v $(pwd):/backup alpine tar czf /backup/foodplanner-backup.tar.gz /data
```

**Backup wiederherstellen:**

```bash
docker run --rm -v backend-data:/data -v $(pwd):/backup alpine tar xzf /backup/foodplanner-backup.tar.gz -C /
```

## Umgebungsvariablen

Erstelle eine `.env` Datei im Root:

```bash
GEMINI_API_KEY=dein-api-key-hier
```

API-Key beantragen: https://ai.google.dev/

## Browser-Kompatibilität

- Chrome/Edge (90+)
- Firefox (88+)
- Safari (14+)

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch erstellt.
