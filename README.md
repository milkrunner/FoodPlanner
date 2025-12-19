# Food Planner - Essenswochenplaner

Eine moderne Web-Anwendung zum Planen deiner Wochenmahlzeiten, Verwalten von Rezepten und automatischen Erstellen von Einkaufslisten.

## Features

- **Wochenplanung**: Plane deine Mahlzeiten für die gesamte Woche (Frühstück, Mittagessen, Abendessen)
- **Rezeptdatenbank**: Erstelle und verwalte deine eigenen Rezepte mit Zutaten und Zubereitungsanleitung
- **Einkaufsliste**: Automatische Generierung einer Einkaufsliste basierend auf deinem Wochenplan
- **Datenpersistenz**: Alle Daten werden lokal im Browser gespeichert (localStorage)
- **Export-Funktionen**: Einkaufsliste als Textdatei exportieren oder in die Zwischenablage kopieren

## Technologie-Stack

- **Vanilla JavaScript** (ES6+)
- **Tailwind CSS** (via CDN) für das Styling
- **LocalStorage API** für die Datenpersistenz
- **Kein Build-Prozess erforderlich** - läuft direkt im Browser

## Installation und Start

### Einfacher Start (ohne Installation)

Die App benötigt **keine Installation** von Node.js oder npm!

#### Option 1: Direktes Öffnen im Browser

Öffne einfach die [index.html](index.html) Datei in deinem Browser (Doppelklick auf die Datei).

#### Option 2: Mit lokalem Webserver (empfohlen)

Für beste Ergebnisse verwende einen lokalen Webserver:

Mit Python (falls installiert):

```bash
python -m http.server 5173
```

Dann öffne [http://localhost:5173](http://localhost:5173) im Browser.

Alternativ mit Node.js (falls vorhanden):

```bash
npx serve
```

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
├── index.html           # Haupt-HTML-Datei
├── app.js               # Komplette App-Logik
└── README.md            # Diese Datei
```

Die komplette Anwendung besteht aus nur 2 Dateien - extrem einfach!

## Datenmodell

Die App verwendet folgende Hauptdatentypen:

- **Recipe**: Rezeptinformationen mit Zutaten
- **WeekPlan**: Wochenplan mit 7 Tagen
- **DayPlan**: Tagesplan mit Mahlzeiten
- **ShoppingListItem**: Einkaufslistenartikel

Alle Daten werden im LocalStorage des Browsers gespeichert unter:

- `foodPlanner_recipes` - Rezepte
- `foodPlanner_weekPlan` - Aktueller Wochenplan

## Browser-Kompatibilität

Die App funktioniert in allen modernen Browsern:

- Chrome/Edge (Version 90+)
- Firefox (Version 88+)
- Safari (Version 14+)

## Lizenz

Dieses Projekt ist für den persönlichen Gebrauch erstellt.
