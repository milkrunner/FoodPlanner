# API-Dokumentation

Die FoodPlanner REST API ermöglicht die Verwaltung von Rezepten, Wochenplänen, Einkaufslisten und KI-gestützten Features.

## Basis-URL

```
http://localhost:3000
```

## Authentifizierung

Aktuell keine Authentifizierung erforderlich (nur für lokalen Gebrauch).

## Rate Limiting

| Endpoint-Typ | Limit | Zeitfenster |
|--------------|-------|-------------|
| Allgemein | 100 Anfragen | 15 Minuten |
| KI-Endpoints | 20 Anfragen | 15 Minuten |

Rate-Limit-Header in Responses:
- `RateLimit-Limit`: Maximale Anzahl Anfragen
- `RateLimit-Remaining`: Verbleibende Anfragen
- `RateLimit-Reset`: Reset-Zeitpunkt (Unix Timestamp)

**Hinweis:** Rate Limiting wird für lokale Anfragen (127.0.0.1) übersprungen.

---

## Rezepte

### Alle Rezepte abrufen

```http
GET /recipes
```

**Response:**
```json
[
  {
    "id": "1234567890",
    "name": "Spaghetti Carbonara",
    "category": "Hauptgericht",
    "servings": 4,
    "instructions": "1. Spaghetti kochen...",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "ingredients": [
      {
        "name": "Spaghetti",
        "amount": "400",
        "unit": "g",
        "category": "Trockenwaren"
      }
    ],
    "tags": ["italienisch", "schnell"]
  }
]
```

### Einzelnes Rezept abrufen

```http
GET /recipes/:id
```

**Parameter:**
| Name | Typ | Beschreibung |
|------|-----|--------------|
| `id` | string | Rezept-ID |

**Response:** Einzelnes Rezept-Objekt (wie oben)

**Fehler:**
- `404`: Rezept nicht gefunden

### Rezept erstellen

```http
POST /recipes
```

**Request Body:**
```json
{
  "id": "1234567890",
  "name": "Spaghetti Carbonara",
  "category": "Hauptgericht",
  "servings": 4,
  "instructions": "1. Spaghetti kochen...",
  "ingredients": [
    {
      "name": "Spaghetti",
      "amount": "400",
      "unit": "g",
      "category": "Trockenwaren"
    },
    {
      "name": "Speck",
      "amount": "200",
      "unit": "g",
      "category": "Fleisch & Fisch"
    }
  ],
  "tags": ["italienisch", "schnell"]
}
```

**Zutatenkategorien:**
- `Obst & Gemüse`
- `Milchprodukte`
- `Fleisch & Fisch`
- `Trockenwaren`
- `Tiefkühl`
- `Sonstiges`

**Response:**
```json
{
  "id": "1234567890",
  "message": "Recipe created successfully"
}
```

### Rezept aktualisieren

```http
PUT /recipes/:id
```

**Request Body:** Wie bei POST (ohne `id`)

**Response:**
```json
{
  "message": "Recipe updated successfully"
}
```

### Rezept löschen

```http
DELETE /recipes/:id
```

**Response:**
```json
{
  "message": "Recipe deleted successfully"
}
```

---

## Wochenplan

### Aktuellen Wochenplan abrufen

```http
GET /weekplan
```

**Response:**
```json
{
  "id": "week-2024-01-15",
  "startDate": "2024-01-15",
  "days": [
    {
      "date": "2024-01-15",
      "dayName": "Montag",
      "meals": {
        "breakfast": {
          "id": "meal-123",
          "recipeId": "recipe-456",
          "recipeName": "Müsli mit Obst",
          "mealType": "breakfast"
        },
        "lunch": null,
        "dinner": {
          "id": "meal-124",
          "recipeId": "recipe-789",
          "recipeName": "Spaghetti Carbonara",
          "mealType": "dinner"
        }
      }
    }
  ]
}
```

### Wochenplan nach Datum abrufen

```http
GET /weekplan/by-date/:date
```

**Parameter:**
| Name | Typ | Beschreibung |
|------|-----|--------------|
| `date` | string | Datum im Format YYYY-MM-DD |

Findet den Wochenplan, der das angegebene Datum enthält.

### Wochenplan speichern

```http
POST /weekplan
```

**Request Body:**
```json
{
  "id": "week-2024-01-15",
  "startDate": "2024-01-15",
  "days": [
    {
      "date": "2024-01-15",
      "dayName": "Montag",
      "meals": {
        "breakfast": {
          "id": "meal-123",
          "recipeId": "recipe-456",
          "recipeName": "Müsli mit Obst"
        }
      }
    }
  ]
}
```

### Wochenplan löschen

```http
DELETE /weekplan
```

Löscht alle Wochenpläne.

---

## Wochenplan-Vorlagen

### Alle Vorlagen abrufen

```http
GET /weekplan/templates
```

**Response:**
```json
[
  {
    "id": "template-123",
    "name": "Arbeitswoche Standard",
    "description": "Meine typische Arbeitswoche",
    "templateData": { ... },
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
]
```

### Vorlage abrufen

```http
GET /weekplan/templates/:id
```

### Vorlage erstellen

```http
POST /weekplan/templates
```

**Request Body:**
```json
{
  "id": "template-123",
  "name": "Arbeitswoche Standard",
  "description": "Meine typische Arbeitswoche",
  "templateData": {
    "days": [...]
  }
}
```

### Vorlage aktualisieren

```http
PUT /weekplan/templates/:id
```

### Vorlage löschen

```http
DELETE /weekplan/templates/:id
```

---

## Einkaufsliste

### Manuelle Einträge abrufen

```http
GET /shopping/manual
```

**Response:**
```json
[
  {
    "id": "item-123",
    "name": "Brot",
    "amount": "1",
    "unit": "Stück",
    "category": "Sonstiges",
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

### Manuellen Eintrag hinzufügen

```http
POST /shopping/manual
```

**Request Body:**
```json
{
  "id": "item-123",
  "name": "Brot",
  "amount": "1",
  "unit": "Stück",
  "category": "Sonstiges"
}
```

### Eintrag löschen

```http
DELETE /shopping/manual/:id
```

### Alle Einträge löschen

```http
DELETE /shopping/manual
```

---

## Budget-Verwaltung

### Budget für Woche abrufen

```http
GET /shopping/budget/:weekStart
```

**Parameter:**
| Name | Typ | Beschreibung |
|------|-----|--------------|
| `weekStart` | string | Montag der Woche (YYYY-MM-DD) |

**Response:**
```json
{
  "id": 1,
  "week_start": "2024-01-15",
  "budget_amount": 150.00,
  "currency": "EUR",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

### Budget setzen

```http
POST /shopping/budget
```

**Request Body:**
```json
{
  "weekStart": "2024-01-15",
  "budgetAmount": 150.00,
  "currency": "EUR"
}
```

---

## Substitutionen

### Gespeicherte Substitutionen abrufen

```http
GET /shopping/substitutions
```

**Response:**
```json
[
  {
    "id": 1,
    "original_ingredient": "Parmesan",
    "substitute_ingredient": "Grana Padano",
    "reason": "Günstiger und ähnlicher Geschmack",
    "savings_percent": 30,
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
]
```

### Substitution speichern

```http
POST /shopping/substitutions
```

**Request Body:**
```json
{
  "originalIngredient": "Parmesan",
  "substituteIngredient": "Grana Padano",
  "reason": "Günstiger und ähnlicher Geschmack",
  "savingsPercent": 30
}
```

### Substitution deaktivieren

```http
DELETE /shopping/substitutions/:id
```

---

## Kochverlauf

### Kochverlauf abrufen (paginiert)

```http
GET /cooking-history?limit=50&offset=0
```

**Query Parameter:**
| Name | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `limit` | number | 50 | Anzahl Einträge |
| `offset` | number | 0 | Startposition |

**Response:**
```json
{
  "entries": [
    {
      "id": 1,
      "recipe_id": "recipe-123",
      "cooked_at": "2024-01-15T18:30:00Z",
      "servings": 4,
      "notes": "Sehr lecker!",
      "recipe_name": "Spaghetti Carbonara",
      "recipe_category": "Hauptgericht"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Kochstatistiken

```http
GET /cooking-history/stats
```

**Response:**
```json
[
  {
    "recipe_id": "recipe-123",
    "recipe_name": "Spaghetti Carbonara",
    "times_cooked": 5,
    "last_cooked_at": "2024-01-15T18:30:00Z"
  }
]
```

### Kochverlauf für Rezept

```http
GET /cooking-history/recipe/:recipeId
```

### Rezepte, die lange nicht gekocht wurden

```http
GET /cooking-history/not-cooked-recently?days=30
```

**Query Parameter:**
| Name | Typ | Standard | Beschreibung |
|------|-----|----------|--------------|
| `days` | number | 30 | Anzahl Tage |

### Rezept als gekocht markieren

```http
POST /cooking-history
```

**Request Body:**
```json
{
  "recipeId": "recipe-123",
  "servings": 4,
  "notes": "Sehr lecker!"
}
```

### Kochverlauf-Eintrag löschen

```http
DELETE /cooking-history/:id
```

---

## KI-Features

### Rezepte generieren

```http
POST /ai/generate-recipes
```

**Request Body:**
```json
{
  "ingredients": ["Hähnchen", "Reis", "Paprika"],
  "preferences": {
    "dietary": "glutenfrei",
    "cookingTime": 30,
    "difficulty": "einfach"
  }
}
```

**Response:**
```json
{
  "recipes": [
    {
      "name": "Hähnchen-Gemüse-Pfanne",
      "category": "Hauptgericht",
      "servings": 4,
      "ingredients": [...],
      "instructions": "..."
    }
  ]
}
```

### Rezept parsen (Text/URL)

```http
POST /ai/parse-recipe
```

**Request Body (Text):**
```json
{
  "input": "Für 4 Portionen: 400g Spaghetti, 200g Speck...",
  "type": "text"
}
```

**Request Body (URL):**
```json
{
  "input": "https://www.chefkoch.de/rezepte/123",
  "type": "url"
}
```

**Unterstützte Domains:**
- chefkoch.de
- eatsmarter.de
- lecker.de
- allrecipes.com
- bbcgoodfood.com
- und weitere

**Response:**
```json
{
  "recipe": {
    "id": "1234567890",
    "name": "Spaghetti Carbonara",
    "category": "Hauptgericht",
    "servings": 4,
    "ingredients": [...],
    "instructions": "..."
  },
  "source": "ai-parsed"
}
```

### Video-Rezept parsen

```http
POST /ai/parse-video-recipe
```

**Request Body:**
```json
{
  "url": "https://www.tiktok.com/@user/video/123",
  "acceptDisclaimer": true
}
```

**Unterstützte Plattformen:**
- TikTok
- Instagram Reels
- Pinterest
- YouTube Shorts

**Response:**
```json
{
  "recipe": {
    "id": "1234567890",
    "name": "Viral TikTok Pasta",
    "prepTime": "15 Min",
    "cookTime": "20 Min",
    "difficulty": "Einfach",
    "ingredients": [...],
    "instructions": "...",
    "tips": "...",
    "sourceUrl": "https://www.tiktok.com/...",
    "sourceNote": "TikTok Rezept von @username"
  },
  "source": "video-parsed",
  "platform": "tiktok"
}
```

### Unterstützte Video-Plattformen abrufen

```http
GET /ai/video-platforms
```

### Portionen skalieren

```http
POST /ai/scale-portions
```

**Request Body:**
```json
{
  "ingredients": [
    {"name": "Spaghetti", "amount": "400", "unit": "g", "category": "Trockenwaren"}
  ],
  "originalServings": 4,
  "newServings": 6
}
```

**Response:**
```json
{
  "ingredients": [
    {"name": "Spaghetti", "amount": "600", "unit": "g", "category": "Trockenwaren"}
  ]
}
```

### Zutat kategorisieren

```http
POST /ai/categorize-ingredient
```

**Request Body:**
```json
{
  "ingredientName": "Parmesan"
}
```

**Response:**
```json
{
  "category": "Milchprodukte",
  "source": "ai"
}
```

### Einkaufsliste optimieren

```http
POST /shopping/optimize
```

**Request Body:**
```json
{
  "shoppingList": [
    {"name": "Parmesan", "amount": "100", "unit": "g", "category": "Milchprodukte"}
  ],
  "budget": 50,
  "preferences": {
    "prioritizeSeasonal": true,
    "prioritizeOrganic": false,
    "avoidBrands": true
  }
}
```

**Response:**
```json
{
  "originalEstimate": 45.50,
  "optimizedEstimate": 38.20,
  "savingsPercent": 16,
  "substitutions": [
    {
      "original": "Parmesan",
      "substitute": "Grana Padano",
      "reason": "Ähnlicher Geschmack, 30% günstiger",
      "savingsPercent": 30,
      "category": "cost"
    }
  ],
  "seasonalTips": [...],
  "quantityTips": [...],
  "generalTips": [...]
}
```

---

## System

### Health Check

```http
GET /health
```

**Response (Healthy):**
```json
{
  "status": "OK",
  "database": "connected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Response (Unhealthy):**
```json
{
  "status": "ERROR",
  "database": "disconnected",
  "timestamp": "2024-01-15T10:30:00Z"
}
```
Status Code: `503`

---

## Fehlerbehandlung

Alle Fehler werden im folgenden Format zurückgegeben:

```json
{
  "error": "Fehlerbeschreibung",
  "details": "Weitere Details (optional)"
}
```

### HTTP Status Codes

| Code | Bedeutung |
|------|-----------|
| 200 | Erfolg |
| 201 | Erstellt |
| 400 | Ungültige Anfrage |
| 404 | Nicht gefunden |
| 429 | Rate Limit überschritten |
| 500 | Serverfehler |
| 503 | Service nicht verfügbar (z.B. KI nicht konfiguriert) |
