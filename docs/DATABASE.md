# Datenbank-Schema

FoodPlanner verwendet PostgreSQL als Datenbank. Dieses Dokument beschreibt das vollständige Schema.

## Übersicht

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     recipes      │     │   week_plans     │     │ week_plan_       │
│                  │     │                  │     │ templates        │
├──────────────────┤     ├──────────────────┤     ├──────────────────┤
│ id (PK)          │     │ id (PK)          │     │ id (PK)          │
│ name             │     │ start_date       │     │ name             │
│ category         │     │ created_at       │     │ description      │
│ servings         │     │ updated_at       │     │ template_data    │
│ instructions     │     └────────┬─────────┘     │ created_at       │
│ created_at       │              │               │ updated_at       │
│ updated_at       │              │               └──────────────────┘
└────────┬─────────┘              │
         │                        │
         │                        ▼
         │               ┌──────────────────┐
         │               │      days        │
         │               ├──────────────────┤
         │               │ id (PK)          │
         │               │ week_plan_id (FK)│
         │               │ date             │
         │               │ day_name         │
         │               └────────┬─────────┘
         │                        │
         ▼                        ▼
┌──────────────────┐     ┌──────────────────┐
│   ingredients    │     │      meals       │
├──────────────────┤     ├──────────────────┤
│ id (PK)          │     │ id (PK)          │
│ recipe_id (FK)   │     │ day_id (FK)      │
│ name             │     │ recipe_id (FK)   │
│ amount           │     │ recipe_name      │
│ unit             │     │ meal_type        │
│ category         │     └──────────────────┘
└──────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   recipe_tags    │     │ cooking_history  │     │ manual_shopping_ │
├──────────────────┤     ├──────────────────┤     │ items            │
│ id (PK)          │     │ id (PK)          │     ├──────────────────┤
│ recipe_id (FK)   │     │ recipe_id (FK)   │     │ id (PK)          │
│ tag              │     │ cooked_at        │     │ name             │
└──────────────────┘     │ servings         │     │ amount           │
                         │ notes            │     │ unit             │
                         └──────────────────┘     │ category         │
                                                  │ created_at       │
┌──────────────────┐     ┌──────────────────┐     └──────────────────┘
│ shopping_budget  │     │ substitution_    │
├──────────────────┤     │ preferences      │
│ id (PK)          │     ├──────────────────┤
│ week_start       │     │ id (PK)          │
│ budget_amount    │     │ original_        │
│ currency         │     │ ingredient       │
│ created_at       │     │ substitute_      │
│ updated_at       │     │ ingredient       │
└──────────────────┘     │ reason           │
                         │ savings_percent  │
                         │ is_active        │
                         │ created_at       │
                         └──────────────────┘
```

## Tabellen

### recipes

Speichert alle Rezepte.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | TEXT | PRIMARY KEY | Vom Frontend generierte ID |
| `name` | VARCHAR(255) | NOT NULL | Rezeptname |
| `category` | VARCHAR(100) | | Kategorie (z.B. Hauptgericht) |
| `servings` | INTEGER | | Anzahl Portionen |
| `instructions` | TEXT | | Zubereitungsanleitung |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Letzte Änderung |

**Indizes:**
- `idx_recipes_category` - Schnelle Filterung nach Kategorie
- `idx_recipes_name` - Schnelle Suche nach Namen

### ingredients

Speichert Zutaten für Rezepte.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `recipe_id` | TEXT | REFERENCES recipes(id) ON DELETE CASCADE | Zugehöriges Rezept |
| `name` | VARCHAR(255) | NOT NULL | Zutatenname |
| `amount` | VARCHAR(50) | NOT NULL | Menge (z.B. "200") |
| `unit` | VARCHAR(50) | NOT NULL | Einheit (z.B. "g") |
| `category` | VARCHAR(100) | DEFAULT 'Sonstiges' | Warengruppe |

**Kategorien:**
- Obst & Gemüse
- Milchprodukte
- Fleisch & Fisch
- Trockenwaren
- Tiefkühl
- Sonstiges

**Indizes:**
- `idx_ingredients_recipe_id` - Schnelles Laden aller Zutaten eines Rezepts

### recipe_tags

Speichert Tags für Rezepte (n:m Beziehung).

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `recipe_id` | TEXT | REFERENCES recipes(id) ON DELETE CASCADE | Zugehöriges Rezept |
| `tag` | VARCHAR(100) | NOT NULL | Tag-Name |

**Beispiel-Tags:**
- vegetarisch
- vegan
- glutenfrei
- schnell
- low-carb

**Indizes:**
- `idx_recipe_tags_recipe_id` - Schnelles Laden aller Tags eines Rezepts
- `idx_recipe_tags_tag` - Schnelle Filterung nach Tag

### week_plans

Speichert Wochenpläne.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | TEXT | PRIMARY KEY | Format: "week-YYYY-MM-DD" |
| `start_date` | DATE | NOT NULL | Montag der Woche |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Letzte Änderung |

**Indizes:**
- `idx_week_plans_start_date` - Schnelle Suche nach Woche

### days

Speichert Tage eines Wochenplans.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `week_plan_id` | TEXT | REFERENCES week_plans(id) ON DELETE CASCADE | Zugehöriger Wochenplan |
| `date` | DATE | NOT NULL | Datum des Tages |
| `day_name` | VARCHAR(20) | NOT NULL | Wochentagsname |

**Indizes:**
- `idx_days_week_plan_id` - Schnelles Laden aller Tage eines Plans

### meals

Speichert Mahlzeiten eines Tages.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | TEXT | PRIMARY KEY | Vom Frontend generierte ID |
| `day_id` | INTEGER | REFERENCES days(id) ON DELETE CASCADE | Zugehöriger Tag |
| `recipe_id` | TEXT | REFERENCES recipes(id) ON DELETE SET NULL | Zugehöriges Rezept (optional) |
| `recipe_name` | VARCHAR(255) | NOT NULL | Rezeptname (denormalisiert) |
| `meal_type` | VARCHAR(50) | NOT NULL | breakfast/lunch/dinner |

**Indizes:**
- `idx_meals_day_id` - Schnelles Laden aller Mahlzeiten eines Tages
- `idx_meals_recipe_id` - Schnelle Suche nach Rezept-Verwendung

### week_plan_templates

Speichert Wochenplan-Vorlagen.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | TEXT | PRIMARY KEY | Vom Frontend generierte ID |
| `name` | VARCHAR(255) | NOT NULL | Vorlagenname |
| `description` | TEXT | | Beschreibung |
| `template_data` | JSONB | NOT NULL | Vorlage als JSON |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Letzte Änderung |

**template_data Format:**
```json
{
  "days": [
    {
      "dayName": "Montag",
      "meals": {
        "breakfast": {"recipeId": "...", "recipeName": "..."},
        "lunch": null,
        "dinner": {"recipeId": "...", "recipeName": "..."}
      }
    }
  ]
}
```

### manual_shopping_items

Speichert manuell hinzugefügte Einkaufseinträge.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | TEXT | PRIMARY KEY | Vom Frontend generierte ID |
| `name` | VARCHAR(255) | NOT NULL | Artikelname |
| `amount` | VARCHAR(50) | NOT NULL | Menge |
| `unit` | VARCHAR(50) | NOT NULL | Einheit |
| `category` | VARCHAR(100) | DEFAULT 'Sonstiges' | Warengruppe |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

### cooking_history

Speichert wann welches Rezept gekocht wurde.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `recipe_id` | TEXT | REFERENCES recipes(id) ON DELETE CASCADE | Gekochtes Rezept |
| `cooked_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Kochzeitpunkt |
| `servings` | INTEGER | | Gekochte Portionen |
| `notes` | TEXT | | Notizen |

**Indizes:**
- `idx_cooking_history_recipe_id` - Schnelles Laden der Historie eines Rezepts
- `idx_cooking_history_cooked_at` - Sortierung nach Datum

### shopping_budget

Speichert Wochenbudgets für Einkäufe.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `week_start` | DATE | NOT NULL UNIQUE | Montag der Woche |
| `budget_amount` | DECIMAL(10,2) | NOT NULL | Budget in Währung |
| `currency` | VARCHAR(3) | DEFAULT 'EUR' | Währungscode |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |
| `updated_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Letzte Änderung |

**Indizes:**
- `idx_shopping_budget_week` - Schnelle Suche nach Woche

### substitution_preferences

Speichert bevorzugte Zutatenaustausche.

| Spalte | Typ | Constraints | Beschreibung |
|--------|-----|-------------|--------------|
| `id` | SERIAL | PRIMARY KEY | Auto-increment ID |
| `original_ingredient` | TEXT | NOT NULL | Originalzutat |
| `substitute_ingredient` | TEXT | NOT NULL | Ersatzzutat |
| `reason` | TEXT | | Begründung |
| `savings_percent` | INTEGER | | Geschätzte Ersparnis in % |
| `is_active` | BOOLEAN | DEFAULT true | Aktiv/Deaktiviert |
| `created_at` | TIMESTAMP WITH TIME ZONE | DEFAULT CURRENT_TIMESTAMP | Erstellungszeitpunkt |

**Constraints:**
- Unique Index auf `LOWER(original_ingredient), LOWER(substitute_ingredient)`

## Views

### recipe_cooking_stats

Aggregierte Kochstatistiken pro Rezept.

```sql
CREATE VIEW recipe_cooking_stats AS
SELECT
    r.id as recipe_id,
    r.name as recipe_name,
    COUNT(ch.id) as times_cooked,
    MAX(ch.cooked_at) as last_cooked_at,
    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - MAX(ch.cooked_at))) as days_since_last_cooked
FROM recipes r
LEFT JOIN cooking_history ch ON r.id = ch.recipe_id
GROUP BY r.id, r.name;
```

## Trigger

### updated_at Auto-Update

Automatische Aktualisierung der `updated_at` Spalte bei Updates.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
```

Angewendet auf:
- `recipes`
- `week_plans`
- `week_plan_templates`

## Migrations

Migrations befinden sich in `backend/db/migrations/`:

| Datei | Beschreibung |
|-------|-------------|
| `001_initial_schema.sql` | Basis-Schema (Rezepte, Wochenplan, etc.) |
| `002_cooking_history.sql` | Kochverlauf |
| `003_shopping_budget.sql` | Budget und Substitutionen |

### Migration ausführen

Migrations werden automatisch beim Start des Backends ausgeführt:

```javascript
// backend/db/index.js
async function runMigrations() {
  const files = fs.readdirSync(migrationsDir).sort();
  for (const file of files) {
    await pool.query(sql);
  }
}
```

## Backup & Restore

### Backup erstellen

```bash
# Via Docker
docker-compose exec postgres pg_dump -U postgres foodplanner > backup.sql

# Oder als komprimiertes Archiv
docker run --rm -v foodplanner_postgres-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/foodplanner-backup.tar.gz /data
```

### Backup wiederherstellen

```bash
# Via Docker
docker-compose exec -T postgres psql -U postgres foodplanner < backup.sql

# Oder aus Archiv
docker run --rm -v foodplanner_postgres-data:/data -v $(pwd):/backup alpine \
  tar xzf /backup/foodplanner-backup.tar.gz -C /
```

## Wartung

### Datenbankgröße prüfen

```sql
SELECT pg_size_pretty(pg_database_size('foodplanner'));
```

### Tabellengröße prüfen

```sql
SELECT
    relname as table,
    pg_size_pretty(pg_total_relation_size(relid)) as size
FROM pg_catalog.pg_statio_user_tables
ORDER BY pg_total_relation_size(relid) DESC;
```

### Vacuum

```sql
VACUUM ANALYZE;
```
