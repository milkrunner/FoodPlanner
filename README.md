# Food Planner - Essenswochenplaner

Eine moderne Web-Anwendung zum Planen deiner Wochenmahlzeiten, Verwalten von Rezepten und automatischen Erstellen von Einkaufslisten.

## Features

- **Wochenplanung**: Plane deine Mahlzeiten für die gesamte Woche (Frühstück, Mittagessen, Abendessen)
- **Rezeptdatenbank**: Erstelle und verwalte deine eigenen Rezepte mit Zutaten und Zubereitungsanleitung
- **Einkaufsliste**: Automatische Generierung einer Einkaufsliste basierend auf deinem Wochenplan
- **Datenpersistenz**: SQLite-Datenbank mit Docker Volumes (persistent) oder Browser localStorage
- **Export-Funktionen**: Einkaufsliste als Textdatei exportieren oder in die Zwischenablage kopieren

## Technologie-Stack

### Frontend

- **Vanilla JavaScript** (ES6+)
- **Tailwind CSS** (via CDN) für das Styling
- **nginx** als Webserver

### Backend

- **Node.js** mit Express
- **SQLite** Datenbank
- **RESTful API**

### Deployment

- **Docker** & **Docker Compose**
- **Persistente Datenbank** mit Docker Volumes

## Installation und Start

### 🐳 Docker Deployment (Empfohlen für Produktion)

Die einfachste Methode mit vollständiger Datenpersistenz:

```bash
# App starten
docker-compose up -d

# App aufrufen
http://localhost
```

Die App läuft dann auf Port 80. Alle Daten werden persistent in einem Docker Volume gespeichert.

**Weitere Docker Commands:**

```bash
# Logs ansehen
docker-compose logs -f

# App stoppen
docker-compose down

# App neu bauen
docker-compose up -d --build

# Volumes löschen (⚠️ Löscht alle Daten!)
docker-compose down -v
```

### 💻 Lokale Entwicklung

#### Option 1: Mit Backend (empfohlen)

```bash
# Backend starten
cd backend
npm install
npm start

# In neuem Terminal: Frontend starten
python -m http.server 8080
```

Dann öffne [http://localhost:8080](http://localhost:8080)

#### Option 2: Nur Frontend (ohne Persistenz)

Öffne einfach die [index.html](index.html) Datei in deinem Browser (Doppelklick auf die Datei).

⚠️ **Achtung**: Ohne Backend werden Daten nur im Browser-LocalStorage gespeichert und gehen bei Cache-Löschung verloren.

## Verwendung

### Rezepte erstellen

1. Navigiere zum Tab "Rezepte"
2. Klicke auf "+ Neues Rezept"
3. Fülle die Rezeptinformationen aus:
   - Name (Pflichtfeld)
   - Kategorie (optional)
   - Portionen (optional)
   - Zutaten mit Menge und Einheit
   - Zubereitungsanleitung (optional)
4. Klicke auf "Erstellen"

### Wochenplan erstellen

1. Navigiere zum Tab "Wochenplan"
2. Für jeden Tag und jede Mahlzeit:
   - Klicke auf "+ Rezept hinzufügen"
   - Wähle ein Rezept aus deiner Datenbank
3. Rezepte können jederzeit wieder entfernt werden (✕ Button)

### Einkaufsliste nutzen

1. Navigiere zum Tab "Einkaufsliste"
2. Die Liste wird automatisch aus deinem Wochenplan generiert
3. Funktionen:
   - Artikel abhaken beim Einkaufen
   - Liste in die Zwischenablage kopieren
   - Liste als Textdatei exportieren
   - Abgehakte Artikel entfernen

## Projektstruktur

```file
FoodPlanner/
├── frontend/
│   ├── index.html           # Haupt-HTML-Datei
│   ├── app.js               # Frontend JavaScript
│   ├── nginx.conf           # Nginx Konfiguration
│   └── Dockerfile           # Frontend Docker Image
├── backend/
│   ├── server.js            # Express API Server
│   ├── package.json         # Backend Dependencies
│   ├── Dockerfile           # Backend Docker Image
│   └── data/                # SQLite Datenbank (Docker Volume)
│       └── foodplanner.db
├── docker-compose.yml       # Docker Orchestrierung
└── README.md
```

## Datenpersistenz

### Mit Docker (Produktion)

Alle Daten werden in einer **SQLite-Datenbank** gespeichert, die in einem **Docker Volume** (`foodplanner-data`) liegt:

- ✅ **Persistent**: Daten bleiben nach Container-Neustarts erhalten
- ✅ **Backup-fähig**: Volume kann einfach gesichert werden
- ✅ **Sicher**: Daten gehen nicht verloren

**Daten sichern:**

```bash
# Volume-Backup erstellen
docker run --rm -v foodplanner-data:/data -v $(pwd):/backup alpine tar czf /backup/foodplanner-backup.tar.gz /data

# Backup wiederherstellen
docker run --rm -v foodplanner-data:/data -v $(pwd):/backup alpine tar xzf /backup/foodplanner-backup.tar.gz -C /
```

### Ohne Docker (Entwicklung)

Daten werden im Browser-LocalStorage gespeichert:

- ⚠️ **Temporär**: Gehen bei Cache-Löschung verloren
- ⚠️ **Browser-gebunden**: Nicht zwischen Geräten synchronisiert

## API Endpoints

Das Backend stellt folgende REST-API bereit:

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

### System

- `GET /health` - Health Check

## Browser-Kompatibilität

Die App funktioniert in allen modernen Browsern:

- Chrome/Edge (Version 90+)
- Firefox (Version 88+)
- Safari (Version 14+)

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch erstellt.
