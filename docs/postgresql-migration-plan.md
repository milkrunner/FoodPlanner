# PostgreSQL Migrationsplan für FoodPlanner

## Übersicht

Dieses Dokument beschreibt den Plan zur Migration von SQLite zu PostgreSQL.

**Aktueller Stand:**
- Datenbank: SQLite3 (v5.1.7)
- Konfiguration: [backend/server.js](../backend/server.js)
- Keine ORM-Schicht (rohe SQL-Queries)
- 8 Tabellen, einfache CRUD-Operationen

---

## Phase 1: Vorbereitung

### 1.1 Abhängigkeiten aktualisieren

**Neue npm Pakete installieren:**
```bash
npm install pg                 # PostgreSQL Client
npm install dotenv            # Umgebungsvariablen (falls noch nicht vorhanden)
```

**Pakete entfernen (nach erfolgreicher Migration):**
```bash
npm uninstall sqlite3
```

### 1.2 Umgebungsvariablen definieren

Neue Variablen in `.env` und `.env.example`:
```env
# PostgreSQL Konfiguration
DATABASE_URL=postgresql://user:password@localhost:5432/foodplanner
# Oder einzelne Variablen:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=foodplanner
DB_USER=foodplanner
DB_PASSWORD=secure_password
```

### 1.3 Docker-Compose erweitern

PostgreSQL Container hinzufügen:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: foodplanner-db
    environment:
      POSTGRES_DB: foodplanner
      POSTGRES_USER: foodplanner
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./backend/migrations/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U foodplanner"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

---

## Phase 2: Datenbankschicht abstrahieren

### 2.1 Neue Dateistruktur erstellen

```
backend/
├── db/
│   ├── index.js          # Datenbank-Verbindung und Pool
│   ├── migrations/
│   │   └── 001_initial_schema.sql
│   └── queries/
│       ├── recipes.js
│       ├── weekPlans.js
│       ├── templates.js
│       └── shopping.js
├── server.js             # Bereinigt von DB-Logik
└── ...
```

### 2.2 Datenbankverbindung mit Connection Pool

Neue Datei `backend/db/index.js`:
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Oder einzelne Parameter:
  // host: process.env.DB_HOST,
  // port: process.env.DB_PORT,
  // database: process.env.DB_NAME,
  // user: process.env.DB_USER,
  // password: process.env.DB_PASSWORD,
  max: 20,                    // Max Verbindungen im Pool
  idleTimeoutMillis: 30000,   // Idle-Timeout
  connectionTimeoutMillis: 2000,
});

// Query-Helper mit automatischer Fehlerbehandlung
const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executed', { text: text.substring(0, 50), duration, rows: result.rowCount });
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
};

// Transaktions-Helper
const transaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, transaction };
```

---

## Phase 3: Schema-Migration

### 3.1 PostgreSQL Schema erstellen

Neue Datei `backend/db/migrations/001_initial_schema.sql`:

```sql
-- UUID Extension aktivieren
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabelle: recipes
CREATE TABLE IF NOT EXISTS recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100),
    servings INTEGER,
    instructions TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: ingredients
CREATE TABLE IF NOT EXISTS ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) DEFAULT 'Sonstiges'
);

-- Tabelle: recipe_tags
CREATE TABLE IF NOT EXISTS recipe_tags (
    id SERIAL PRIMARY KEY,
    recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    tag VARCHAR(100) NOT NULL
);

-- Tabelle: week_plans
CREATE TABLE IF NOT EXISTS week_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    start_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: days
CREATE TABLE IF NOT EXISTS days (
    id SERIAL PRIMARY KEY,
    week_plan_id UUID NOT NULL REFERENCES week_plans(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    day_name VARCHAR(20) NOT NULL
);

-- Tabelle: meals
CREATE TABLE IF NOT EXISTS meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    day_id INTEGER NOT NULL REFERENCES days(id) ON DELETE CASCADE,
    recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
    recipe_name VARCHAR(255) NOT NULL,
    meal_type VARCHAR(50) NOT NULL
);

-- Tabelle: week_plan_templates
CREATE TABLE IF NOT EXISTS week_plan_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabelle: manual_shopping_items
CREATE TABLE IF NOT EXISTS manual_shopping_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    amount VARCHAR(50) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) DEFAULT 'Sonstiges',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indizes für bessere Performance
CREATE INDEX IF NOT EXISTS idx_ingredients_recipe_id ON ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id ON recipe_tags(recipe_id);
CREATE INDEX IF NOT EXISTS idx_days_week_plan_id ON days(week_plan_id);
CREATE INDEX IF NOT EXISTS idx_meals_day_id ON meals(day_id);
CREATE INDEX IF NOT EXISTS idx_meals_recipe_id ON meals(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_week_plans_start_date ON week_plans(start_date);

-- Trigger für automatische updated_at Aktualisierung
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_recipes_updated_at
    BEFORE UPDATE ON recipes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_week_plans_updated_at
    BEFORE UPDATE ON week_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_week_plan_templates_updated_at
    BEFORE UPDATE ON week_plan_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 Wichtige Schema-Änderungen

| SQLite | PostgreSQL | Anmerkung |
|--------|------------|-----------|
| `TEXT` für IDs | `UUID` | Native UUID-Unterstützung |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL` | Auto-Increment |
| `TEXT` für Datum | `DATE` / `TIMESTAMP` | Echte Datumstypen |
| `DATETIME` | `TIMESTAMP WITH TIME ZONE` | Zeitzonenunterstützung |
| `TEXT` für JSON | `JSONB` | Native JSON-Unterstützung mit Indexierung |

---

## Phase 4: Query-Migration

### 4.1 Callback-API zu Promises/Async-Await

**Vorher (SQLite mit Callbacks):**
```javascript
db.all('SELECT * FROM recipes', [], (err, rows) => {
    if (err) {
        res.status(500).json({ error: err.message });
        return;
    }
    res.json(rows);
});
```

**Nachher (PostgreSQL mit async/await):**
```javascript
try {
    const { rows } = await db.query('SELECT * FROM recipes');
    res.json(rows);
} catch (error) {
    res.status(500).json({ error: error.message });
}
```

### 4.2 Parameterplatzhalter ändern

**SQLite:** Verwendet `?` als Platzhalter
```javascript
db.run('INSERT INTO recipes (name) VALUES (?)', [name]);
```

**PostgreSQL:** Verwendet `$1, $2, ...` als Platzhalter
```javascript
await db.query('INSERT INTO recipes (name) VALUES ($1)', [name]);
```

### 4.3 RETURNING-Klausel nutzen

PostgreSQL unterstützt `RETURNING`, um eingefügte Daten zurückzubekommen:

**Vorher:**
```javascript
db.run('INSERT INTO recipes ...', function() {
    const id = this.lastID;
});
```

**Nachher:**
```javascript
const { rows } = await db.query(
    'INSERT INTO recipes (name) VALUES ($1) RETURNING *',
    [name]
);
const newRecipe = rows[0];
```

---

## Phase 5: Datenmigration

### 5.1 Migrationsskript erstellen

Neue Datei `backend/scripts/migrate-data.js`:

```javascript
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');

async function migrateData() {
    const sqliteDb = new sqlite3.Database('./data/foodplanner.db');
    const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });

    // 1. Rezepte migrieren
    const recipes = await getAll(sqliteDb, 'SELECT * FROM recipes');
    for (const recipe of recipes) {
        await pgPool.query(
            `INSERT INTO recipes (id, name, category, servings, instructions, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [recipe.id, recipe.name, recipe.category, recipe.servings,
             recipe.instructions, recipe.created_at, recipe.updated_at]
        );
    }

    // 2. Zutaten migrieren
    // ... (analog für alle anderen Tabellen)

    console.log('Migration erfolgreich abgeschlossen!');
}

// Helper-Funktion
function getAll(db, sql) {
    return new Promise((resolve, reject) => {
        db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

migrateData().catch(console.error);
```

### 5.2 Migrations-Reihenfolge (wegen Foreign Keys)

1. `recipes` (keine Abhängigkeiten)
2. `ingredients` (abhängig von recipes)
3. `recipe_tags` (abhängig von recipes)
4. `week_plans` (keine Abhängigkeiten)
5. `days` (abhängig von week_plans)
6. `meals` (abhängig von days und recipes)
7. `week_plan_templates` (keine Abhängigkeiten)
8. `manual_shopping_items` (keine Abhängigkeiten)

---

## Phase 6: Server.js refaktorieren

### 6.1 Änderungen in server.js

Die wichtigsten Änderungen:

1. **Import ändern:**
   ```javascript
   // Vorher:
   const sqlite3 = require('sqlite3').verbose();

   // Nachher:
   const db = require('./db');
   ```

2. **Alle Endpoints auf async/await umstellen**

3. **Datenbank-Initialisierung entfernen** (wird vom Migrations-SQL übernommen)

4. **Beispiel eines refaktorierten Endpoints:**
   ```javascript
   // GET /api/recipes
   app.get('/api/recipes', async (req, res) => {
       try {
           const { rows: recipes } = await db.query(`
               SELECT r.*,
                      json_agg(DISTINCT i.*) FILTER (WHERE i.id IS NOT NULL) as ingredients,
                      array_agg(DISTINCT rt.tag) FILTER (WHERE rt.tag IS NOT NULL) as tags
               FROM recipes r
               LEFT JOIN ingredients i ON r.id = i.recipe_id
               LEFT JOIN recipe_tags rt ON r.id = rt.recipe_id
               GROUP BY r.id
               ORDER BY r.name
           `);
           res.json(recipes);
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
   });
   ```

---

## Phase 7: Testing

### 7.1 Test-Datenbank einrichten

```yaml
# docker-compose.test.yml
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: foodplanner_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
```

### 7.2 Testfälle

- [ ] Alle CRUD-Operationen für jede Tabelle testen
- [ ] Foreign Key Constraints prüfen (CASCADE DELETE)
- [ ] Transaktionen testen
- [ ] Concurrent Requests testen
- [ ] Datenmigration validieren (Datenintegrität)

---

## Phase 8: Deployment

### 8.1 Rollout-Strategie

1. **Entwicklung:** PostgreSQL lokal/Docker testen
2. **Staging:** Vollständige Migration durchführen
3. **Produktion:**
   - Backup der SQLite-Datenbank erstellen
   - Wartungsfenster planen
   - PostgreSQL deployen
   - Daten migrieren
   - Anwendung mit PostgreSQL starten
   - Verifizieren

### 8.2 Rollback-Plan

Falls Probleme auftreten:
1. SQLite-Backup ist noch vorhanden
2. Git-Branch mit alter SQLite-Version verfügbar
3. Schneller Switch zurück möglich durch Umgebungsvariable

---

## Checkliste

### Vorbereitung
- [ ] PostgreSQL lokal/Docker installieren
- [ ] `pg` npm Paket installieren
- [ ] Umgebungsvariablen konfigurieren
- [ ] Docker-Compose aktualisieren

### Implementierung
- [ ] Datenbank-Verbindungsmodul erstellen (`db/index.js`)
- [ ] PostgreSQL Schema erstellen
- [ ] Alle Endpoints auf async/await umstellen
- [ ] Parameterplatzhalter von `?` auf `$1, $2, ...` ändern
- [ ] SQLite-spezifische Funktionen ersetzen

### Migration
- [ ] Migrationsskript erstellen
- [ ] Testmigration durchführen
- [ ] Datenintegrität prüfen

### Testing
- [ ] Unit Tests anpassen
- [ ] Integration Tests durchführen
- [ ] Performance-Tests

### Deployment
- [ ] Backup erstellen
- [ ] Produktionsmigration planen
- [ ] Monitoring einrichten

---

## Geschätzter Aufwand

| Phase | Beschreibung |
|-------|--------------|
| Phase 1 | Vorbereitung und Setup |
| Phase 2 | Datenbankschicht abstrahieren |
| Phase 3 | Schema erstellen |
| Phase 4 | Query-Migration (~30 Queries in server.js) |
| Phase 5 | Datenmigration |
| Phase 6 | Testing |
| Phase 7 | Deployment |

---

## Vorteile nach der Migration

1. **Bessere Performance** bei konkurrenten Zugriffen
2. **JSONB-Unterstützung** für komplexe Datenstrukturen
3. **Echte Datumstypen** mit Zeitzonenunterstützung
4. **Connection Pooling** für skalierbare Anwendungen
5. **Transaktionen** für Datenintegrität
6. **Erweiterbarkeit** (Full-Text-Suche, GIS, etc.)
7. **Produktionsreif** für größere Deployments
