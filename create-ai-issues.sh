#!/bin/bash

# Script to create GitHub issues for AI features
# Prerequisites: Install and authenticate gh CLI first:
#   1. Install: sudo apt install gh (or brew install gh on macOS)
#   2. Authenticate: gh auth login

REPO="milkrunner/FoodPlanner"

echo "Creating AI feature issues for $REPO..."

# Issue 1: Smart Recipe Parser
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Smart Recipe Parser - Text/URL zu Rezept" \
  --label "enhancement,ai" \
  --body "## Beschreibung
Implementierung eines intelligenten Recipe Parsers, der Rezepte aus verschiedenen Quellen automatisch erkennt und strukturiert.

## Funktionen
- **Text-Input**: Nutzer kann Rezepttext einfügen (z.B. aus WhatsApp, E-Mail)
- **URL-Import**: Rezepte von Webseiten automatisch importieren
- **Struktur-Erkennung**: KI erkennt automatisch:
  - Rezeptname
  - Zutaten mit Mengen und Einheiten
  - Zubereitungsschritte
  - Portionsangaben
  - Kategorie

## Technische Umsetzung
- Gemini API für Text-Analyse
- Regex-Patterns für strukturierte Daten
- Web Scraping für URL-Import (optional)

## Akzeptanzkriterien
- [ ] Text kann eingefügt und geparst werden
- [ ] URLs werden korrekt importiert
- [ ] Zutaten werden mit Mengen/Einheiten erkannt
- [ ] Geparste Rezepte können gespeichert werden
- [ ] Fehlerbehandlung bei unvollständigen Daten

## Priorität
Medium - Nice-to-have Feature für bessere UX"

echo "✓ Issue 1: Smart Recipe Parser erstellt"

# Issue 2: Intelligente Mengenberechnung
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Intelligente Mengenberechnung & Portionsanpassung" \
  --label "enhancement,ai" \
  --body "## Beschreibung
Automatische Skalierung von Rezeptmengen basierend auf gewünschter Portionsanzahl mit intelligenter Rundung.

## Funktionen
- **Portionsänderung**: Nutzer gibt neue Portionsanzahl ein
- **Automatische Umrechnung**: KI berechnet alle Zutatmengen neu
- **Intelligente Rundung**:
  - 247g Mehl → 250g
  - 0.8 Eier → 1 Ei
  - 3.2 EL Öl → 3 EL
- **Einheiten-Optimierung**: 1200ml → 1.2L

## Technische Umsetzung
- Gemini für kontextbezogene Rundung
- Einheiten-Konvertierung
- Frontend: Slider oder Input für Portionen

## Akzeptanzkriterien
- [ ] Portionsanzahl kann angepasst werden
- [ ] Alle Mengen werden korrekt umgerechnet
- [ ] Rundungen sind praxistauglich
- [ ] Einheiten werden optimiert dargestellt
- [ ] Original-Portionen bleiben gespeichert

## Priorität
High - Sehr nützliches Alltagsfeature"

echo "✓ Issue 2: Intelligente Mengenberechnung erstellt"

# Issue 3: Rezept-Verbesserungsvorschläge
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Rezept-Verbesserungsvorschläge & Varianten" \
  --label "enhancement,ai" \
  --body "## Beschreibung
KI analysiert bestehende Rezepte und schlägt Verbesserungen, Varianten und Optimierungen vor.

## Funktionen
- **Analyse-Button** bei jedem Rezept
- **Verbesserungsvorschläge**:
  - Geschmacksverbesserungen
  - Gesündere Alternativen
  - Zeitersparnis-Tipps
  - Zubereitungs-Hacks
- **Varianten-Generierung**:
  - Vegetarische Version
  - Vegane Variante
  - Low-Carb Alternative
  - Regionale Anpassungen

## Technische Umsetzung
- Gemini Prompt mit Rezeptdetails
- Modal/Sidebar für Vorschläge
- Optional: Vorschläge direkt übernehmen

## Akzeptanzkriterien
- [ ] Analyse-Funktion in Rezeptansicht verfügbar
- [ ] Mindestens 3 konkrete Vorschläge
- [ ] Varianten sind umsetzbar
- [ ] Vorschläge können gespeichert werden
- [ ] Performance: < 5 Sekunden Response

## Priorität
Medium - Interessantes Feature für Kochbegeisterte"

echo "✓ Issue 3: Rezept-Verbesserungsvorschläge erstellt"

# Issue 4: Smart Meal Planning
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Smart Meal Planning - Automatischer Wochenplan" \
  --label "enhancement,ai" \
  --body "## Beschreibung
KI erstellt automatisch einen ausgewogenen Wochenplan basierend auf Präferenzen und vorhandenen Rezepten.

## Funktionen
- **Auto-Generierung**: \"Erstelle mir einen Wochenplan\"
- **Berücksichtigt**:
  - Ernährungspräferenzen (vegetarisch, vegan, etc.)
  - Kalorien-Ziele
  - Verfügbare Zeit pro Tag
  - Abwechslung in Kategorien
  - Saisonale Zutaten
- **Optimierung**:
  - Zutatenwiederverwertung (Reste nutzen)
  - Batch-Cooking-Vorschläge
  - Budget-Optimierung

## Technische Umsetzung
- Gemini mit Rezept-Datenbank-Kontext
- Constraint-basierte Planung
- Frontend: Präferenz-Dialog + Auto-Fill

## Akzeptanzkriterien
- [ ] Wochenplan kann automatisch generiert werden
- [ ] Präferenzen werden berücksichtigt
- [ ] Plan ist ausgewogen und abwechslungsreich
- [ ] Nutzer kann Vorschläge anpassen
- [ ] Generierung dauert < 10 Sekunden

## Priorität
High - Kernfunktionalität für Meal Prep"

echo "✓ Issue 4: Smart Meal Planning erstellt"

# Issue 5: Zutatenkategorie-Auto-Erkennung
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Automatische Zutatenkategorie-Erkennung" \
  --label "enhancement,ai" \
  --body "## Beschreibung
Automatische Kategorisierung von Zutaten für Einkaufsliste und bessere Organisation.

## Funktionen
- **Auto-Kategorisierung** beim Hinzufügen von Zutaten
- **Kategorien**:
  - Obst & Gemüse
  - Milchprodukte
  - Fleisch & Fisch
  - Trockenwaren
  - Tiefkühl
  - Sonstiges
- **Lernfähigkeit**: Nutzer-Korrekturen werden berücksichtigt
- **Bulk-Import**: Mehrere Zutaten gleichzeitig kategorisieren

## Technische Umsetzung
- Gemini für Kategorisierung
- Lokaler Cache für häufige Zutaten
- Fallback auf Regel-basierte Kategorisierung

## Akzeptanzkriterien
- [ ] Neue Zutaten werden automatisch kategorisiert
- [ ] Genauigkeit > 90%
- [ ] Manuelle Korrektur möglich
- [ ] Performance: < 1 Sekunde pro Zutat
- [ ] Offline-Fallback funktioniert

## Priorität
Medium - Verbessert UX bei Einkaufsliste"

echo "✓ Issue 5: Zutatenkategorie-Auto-Erkennung erstellt"

# Issue 6: Rezept-Suche mit Natural Language
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Natural Language Rezept-Suche" \
  --label "enhancement,ai" \
  --body "## Beschreibung
Intelligente Suche, die natürliche Sprache versteht statt nur Keywords zu matchen.

## Funktionen
- **Natürliche Anfragen**:
  - \"Etwas Schnelles für heute Abend\"
  - \"Gesundes Mittagessen ohne Fleisch\"
  - \"Sommerliches Grillgericht\"
  - \"Was kann ich mit Tomaten und Mozzarella machen?\"
- **Kontext-Verständnis**:
  - Tageszeit
  - Jahreszeit
  - Ernährungspräferenzen
  - Verfügbare Zeit
- **Semantische Suche**: Findet ähnliche Rezepte auch ohne exakte Keywords

## Technische Umsetzung
- Gemini für Query-Understanding
- Vector-Embeddings für semantische Suche (optional)
- Ranking-Algorithmus für Relevanz

## Akzeptanzkriterien
- [ ] Natürlichsprachige Anfragen funktionieren
- [ ] Ergebnisse sind relevant
- [ ] Schnelle Response (< 3 Sekunden)
- [ ] Fallback auf klassische Suche
- [ ] Mindestens 5 relevante Ergebnisse

## Priorität
Low - Nice-to-have für bessere Discoverability"

echo "✓ Issue 6: Rezept-Suche mit Natural Language erstellt"

# Issue 7: Bild-Erkennung für Rezepte
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Bild-Erkennung für Rezepte & Zutaten" \
  --label "enhancement,ai" \
  --body "## Beschreibung
Nutzer kann Fotos von Rezepten oder Zutaten hochladen und die KI erkennt automatisch den Inhalt.

## Funktionen
- **Rezept-Foto → Text**:
  - Foto von Kochbuch-Seite
  - KI extrahiert Rezept-Text
  - Auto-Parse zu strukturiertem Rezept
- **Zutaten-Foto → Einkaufsliste**:
  - Foto vom Kühlschrank/Vorratsschrank
  - KI erkennt vorhandene Zutaten
  - Generiert Rezeptvorschläge
- **Gericht-Foto → Rezeptsuche**:
  - \"Was ist das für ein Gericht?\"
  - Ähnliche Rezepte finden

## Technische Umsetzung
- Gemini Vision API
- Image Upload im Frontend
- OCR für Text-Extraktion
- Object Detection für Zutaten

## Akzeptanzkriterien
- [ ] Bilder können hochgeladen werden
- [ ] Text wird korrekt erkannt (> 80% Genauigkeit)
- [ ] Zutaten werden identifiziert
- [ ] Rezeptsuche nach Bild funktioniert
- [ ] Mobile-optimiert (Kamera-Zugriff)

## Priorität
Low - Innovative Feature, aber komplex"

echo "✓ Issue 7: Bild-Erkennung für Rezepte erstellt"

# Issue 8: Personalisierte Ernährungsberatung
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Personalisierte Ernährungsberatung & Nährwerte" \
  --label "enhancement,ai" \
  --body "## Beschreibung
KI analysiert Essgewohnheiten und gibt personalisierte Ernährungsempfehlungen.

## Funktionen
- **Nährwert-Analyse**:
  - Automatische Berechnung von Kalorien, Makros, Vitaminen
  - Wochenübersicht der Ernährung
  - Visualisierung (Diagramme)
- **Personalisierte Tipps**:
  - \"Du isst zu wenig Protein\"
  - \"Mehr Gemüse einplanen\"
  - \"Ausgewogener Wochenplan\"
- **Ziel-Tracking**:
  - Kalorienziel
  - Makro-Verhältnis (z.B. Low-Carb)
  - Gewichts-Management
- **Warnungen**:
  - Allergene
  - Unverträglichkeiten
  - Zu einseitige Ernährung

## Technische Umsetzung
- Gemini für Analyse und Empfehlungen
- Nährwert-Datenbank Integration (z.B. USDA, Open Food Facts)
- Dashboard mit Charts (Chart.js)

## Akzeptanzkriterien
- [ ] Nährwerte werden berechnet
- [ ] Persönliche Ziele können gesetzt werden
- [ ] Wöchentliche Analyse verfügbar
- [ ] Empfehlungen sind umsetzbar
- [ ] Datenschutz-konform (lokal gespeichert)

## Priorität
Medium - Wertvoll für gesundheitsbewusste Nutzer"

echo "✓ Issue 8: Personalisierte Ernährungsberatung erstellt"

# Issue 9: Intelligente Einkaufsoptimierung
gh issue create \
  --repo "$REPO" \
  --title "🤖 KI: Intelligente Einkaufsoptimierung & Budgetplanung" \
  --label "enhancement,ai" \
  --body "## Beschreibung
KI optimiert Einkaufsliste basierend auf Budget, Verfügbarkeit und Ersatzmöglichkeiten.

## Funktionen
- **Preis-Optimierung**:
  - Günstigere Alternativen vorschlagen
  - Saisonale Produkte bevorzugen
  - Angebote berücksichtigen (optional: API-Integration)
- **Smart Substitutions**:
  - \"Statt Parmesan: Grana Padano (günstiger)\"
  - \"Statt frische Kräuter: TK-Kräuter\"
  - \"Statt Bio-Tomaten: Konventionell (60% günstiger)\"
- **Mengen-Optimierung**:
  - Großpackungen bei häufiger Nutzung
  - Vermeidung von Verschwendung
  - Batch-Cooking-Vorschläge
- **Budget-Tracking**:
  - Wöchentliches Budget setzen
  - Einkaufsliste nach Budget sortieren
  - \"Dieser Wochenplan kostet ca. 45€\"

## Technische Umsetzung
- Gemini für Substitutions-Logik
- Preis-Datenbank (Community-Daten oder API)
- Frontend: Budget-Slider, Substitutions-Dialog

## Akzeptanzkriterien
- [ ] Budget kann gesetzt werden
- [ ] Alternative Produkte werden vorgeschlagen
- [ ] Kostenersparnis wird angezeigt
- [ ] Einkaufsliste nach Preis filterbar
- [ ] Substitutionen sind sinnvoll (Qualität beachten)

## Priorität
High - Praktischer Mehrwert für alle Nutzer"

echo "✓ Issue 9: Intelligente Einkaufsoptimierung erstellt"

echo ""
echo "=========================================="
echo "✅ Alle 9 AI Feature Issues wurden erstellt!"
echo "=========================================="
echo ""
echo "Repository: https://github.com/$REPO/issues"
