/**
 * @swagger
 * /recipes:
 *   get:
 *     summary: Alle Rezepte abrufen (paginiert)
 *     description: |
 *       Ruft Rezepte mit Pagination ab. Standardmäßig werden 20 Rezepte pro Seite geladen.
 *       Mit `all=true` können alle Rezepte auf einmal abgerufen werden (für Offline-Sync).
 *     tags: [Recipes]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Seitennummer (1-basiert)
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Anzahl Rezepte pro Seite (max. 100)
 *       - in: query
 *         name: all
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Wenn true, werden alle Rezepte ohne Pagination zurückgegeben
 *       - in: query
 *         name: favorites
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Wenn true, werden nur als Favorit markierte Rezepte zurückgegeben
 *     responses:
 *       200:
 *         description: Paginierte Liste der Rezepte
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recipe'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       description: Aktuelle Seite
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       description: Rezepte pro Seite
 *                       example: 20
 *                     totalItems:
 *                       type: integer
 *                       description: Gesamtanzahl Rezepte
 *                       example: 150
 *                     totalPages:
 *                       type: integer
 *                       description: Gesamtanzahl Seiten
 *                       example: 8
 *                     hasNextPage:
 *                       type: boolean
 *                       description: Gibt es eine nächste Seite?
 *                     hasPrevPage:
 *                       type: boolean
 *                       description: Gibt es eine vorherige Seite?
 *       500:
 *         description: Serverfehler
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *
 *   post:
 *     summary: Neues Rezept erstellen
 *     tags: [Recipes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recipe'
 *           example:
 *             id: "1704067200000"
 *             name: "Spaghetti Carbonara"
 *             category: "Hauptgericht"
 *             servings: 4
 *             is_favorite: true
 *             prep_time: 10
 *             cook_time: 20
 *             difficulty: "Einfach"
 *             is_meal_prep_suitable: true
 *             meal_prep_fridge_days: 3
 *             meal_prep_freezer_days: 30
 *             meal_prep_reheat_tips: "Im Topf bei mittlerer Hitze mit etwas Wasser erwärmen."
 *             meal_prep_batch_notes: "Sauce getrennt aufbewahren, Pasta vor Portionierung al dente kochen."
 *             ingredients:
 *               - name: "Spaghetti"
 *                 amount: "400"
 *                 unit: "g"
 *                 category: "Trockenwaren"
 *               - name: "Speck"
 *                 amount: "200"
 *                 unit: "g"
 *                 category: "Fleisch & Fisch"
 *             instructions: "1. Spaghetti kochen..."
 *             tags: ["italienisch", "schnell"]
 *     responses:
 *       201:
 *         description: Rezept erfolgreich erstellt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 message:
 *                   type: string
 *       500:
 *         description: Serverfehler
 */

/**
 * @swagger
 * /recipes/{id}:
 *   get:
 *     summary: Einzelnes Rezept abrufen
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rezept-ID
 *     responses:
 *       200:
 *         description: Rezept-Details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Recipe'
 *       404:
 *         description: Rezept nicht gefunden
 *
 *   put:
 *     summary: Rezept aktualisieren
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Recipe'
 *     responses:
 *       200:
 *         description: Rezept aktualisiert
 *       500:
 *         description: Serverfehler
 *
 *   delete:
 *     summary: Rezept löschen
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rezept gelöscht
 *       500:
 *         description: Serverfehler
 */

/**
 * @swagger
 * /recipes/{id}/favorite:
 *   put:
 *     summary: Favoritenstatus eines Rezepts aktualisieren
 *     description: Setzt den Favoritenstatus direkt oder toggelt ihn, wenn kein Wert übergeben wird.
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               is_favorite:
 *                 type: boolean
 *                 description: Expliziter Favoritenstatus
 *               isFavorite:
 *                 type: boolean
 *                 description: Alternativer camelCase Parameter für Clients
 *           example:
 *             is_favorite: true
 *     responses:
 *       200:
 *         description: Favoritenstatus aktualisiert
 *       404:
 *         description: Rezept nicht gefunden
 */

/**
 * @swagger
 * /weekplan:
 *   get:
 *     summary: Aktuellen Wochenplan abrufen
 *     tags: [Week Plan]
 *     responses:
 *       200:
 *         description: Aktueller Wochenplan
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WeekPlan'
 *       500:
 *         description: Serverfehler
 *
 *   post:
 *     summary: Wochenplan speichern
 *     tags: [Week Plan]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WeekPlan'
 *     responses:
 *       201:
 *         description: Wochenplan gespeichert
 *       500:
 *         description: Serverfehler
 *
 *   delete:
 *     summary: Wochenplan löschen
 *     tags: [Week Plan]
 *     responses:
 *       200:
 *         description: Wochenplan gelöscht
 */

/**
 * @swagger
 * /weekplan/by-date/{date}:
 *   get:
 *     summary: Wochenplan nach Datum abrufen
 *     tags: [Week Plan]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Datum im Format YYYY-MM-DD
 *         example: "2024-01-15"
 *     responses:
 *       200:
 *         description: Wochenplan der enthaltenden Woche
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WeekPlan'
 *       404:
 *         description: Kein Wochenplan für diese Woche gefunden
 */

/**
 * @swagger
 * /weekplan/templates:
 *   get:
 *     summary: Alle Wochenplan-Vorlagen abrufen
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: Liste aller Vorlagen
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Template'
 *
 *   post:
 *     summary: Neue Vorlage erstellen
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name, templateData]
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               templateData:
 *                 type: object
 *     responses:
 *       201:
 *         description: Vorlage erstellt
 *       400:
 *         description: Fehlende Pflichtfelder
 */

/**
 * @swagger
 * /weekplan/templates/{id}:
 *   get:
 *     summary: Einzelne Vorlage abrufen
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vorlage-Details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Template'
 *       404:
 *         description: Vorlage nicht gefunden
 *
 *   put:
 *     summary: Vorlage aktualisieren
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Template'
 *     responses:
 *       200:
 *         description: Vorlage aktualisiert
 *       404:
 *         description: Vorlage nicht gefunden
 *
 *   delete:
 *     summary: Vorlage löschen
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vorlage gelöscht
 *       404:
 *         description: Vorlage nicht gefunden
 */

/**
 * @swagger
 * /shopping/manual:
 *   get:
 *     summary: Alle manuellen Einkaufseinträge abrufen
 *     tags: [Shopping]
 *     responses:
 *       200:
 *         description: Liste manueller Einträge
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ManualShoppingItem'
 *
 *   post:
 *     summary: Manuellen Eintrag hinzufügen
 *     tags: [Shopping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name, amount, unit]
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               amount:
 *                 type: string
 *               unit:
 *                 type: string
 *               category:
 *                 type: string
 *           example:
 *             id: "item-123"
 *             name: "Brot"
 *             amount: "1"
 *             unit: "Stück"
 *             category: "Sonstiges"
 *     responses:
 *       201:
 *         description: Eintrag hinzugefügt
 *       400:
 *         description: Fehlende Pflichtfelder
 *
 *   delete:
 *     summary: Alle manuellen Einträge löschen
 *     tags: [Shopping]
 *     responses:
 *       200:
 *         description: Alle Einträge gelöscht
 */

/**
 * @swagger
 * /shopping/manual/{id}:
 *   delete:
 *     summary: Einzelnen manuellen Eintrag löschen
 *     tags: [Shopping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Eintrag gelöscht
 *       404:
 *         description: Eintrag nicht gefunden
 */

/**
 * @swagger
 * /shopping/budget/{weekStart}:
 *   get:
 *     summary: Budget für eine Woche abrufen
 *     tags: [Shopping]
 *     parameters:
 *       - in: path
 *         name: weekStart
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Montag der Woche (YYYY-MM-DD)
 *         example: "2024-01-15"
 *     responses:
 *       200:
 *         description: Budget-Details oder null
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingBudget'
 */

/**
 * @swagger
 * /shopping/budget:
 *   post:
 *     summary: Budget für eine Woche setzen
 *     tags: [Shopping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [weekStart, budgetAmount]
 *             properties:
 *               weekStart:
 *                 type: string
 *                 format: date
 *               budgetAmount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: EUR
 *           example:
 *             weekStart: "2024-01-15"
 *             budgetAmount: 150.00
 *             currency: "EUR"
 *     responses:
 *       200:
 *         description: Budget gespeichert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingBudget'
 *       400:
 *         description: Fehlende Pflichtfelder
 */

/**
 * @swagger
 * /shopping/substitutions:
 *   get:
 *     summary: Gespeicherte Substitutions-Präferenzen abrufen
 *     tags: [Shopping]
 *     responses:
 *       200:
 *         description: Liste aktiver Substitutionen
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SubstitutionPreference'
 *
 *   post:
 *     summary: Substitutions-Präferenz speichern
 *     tags: [Shopping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [originalIngredient, substituteIngredient]
 *             properties:
 *               originalIngredient:
 *                 type: string
 *               substituteIngredient:
 *                 type: string
 *               reason:
 *                 type: string
 *               savingsPercent:
 *                 type: integer
 *           example:
 *             originalIngredient: "Parmesan"
 *             substituteIngredient: "Grana Padano"
 *             reason: "Günstiger und ähnlicher Geschmack"
 *             savingsPercent: 30
 *     responses:
 *       201:
 *         description: Substitution gespeichert
 *       400:
 *         description: Fehlende Pflichtfelder
 */

/**
 * @swagger
 * /shopping/substitutions/{id}:
 *   delete:
 *     summary: Substitutions-Präferenz deaktivieren
 *     tags: [Shopping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Substitution deaktiviert
 */

/**
 * @swagger
 * /shopping/optimize:
 *   post:
 *     summary: Einkaufsliste mit KI optimieren
 *     tags: [Shopping]
 *     description: |
 *       Analysiert die Einkaufsliste und schlägt Optimierungen vor:
 *       - Günstigere Alternativen
 *       - Saisonale Tipps
 *       - Mengenoptimierung
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shoppingList]
 *             properties:
 *               shoppingList:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Ingredient'
 *               budget:
 *                 type: number
 *                 description: Optional - Budget in EUR
 *               preferences:
 *                 type: object
 *                 properties:
 *                   prioritizeSeasonal:
 *                     type: boolean
 *                   prioritizeOrganic:
 *                     type: boolean
 *                   avoidBrands:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Optimierungsvorschläge
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ShoppingOptimization'
 *       400:
 *         description: Leere Einkaufsliste
 *       429:
 *         description: Rate Limit überschritten
 *       503:
 *         description: KI-Service nicht konfiguriert
 */

/**
 * @swagger
 * /cooking-history:
 *   get:
 *     summary: Kochverlauf abrufen (paginiert)
 *     tags: [Cooking History]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Anzahl Einträge pro Seite
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Startposition
 *     responses:
 *       200:
 *         description: Paginierte Kochverlauf-Liste
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 entries:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CookingHistoryEntry'
 *                 total:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 offset:
 *                   type: integer
 *
 *   post:
 *     summary: Rezept als gekocht markieren
 *     tags: [Cooking History]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipeId]
 *             properties:
 *               recipeId:
 *                 type: string
 *               servings:
 *                 type: integer
 *               notes:
 *                 type: string
 *           example:
 *             recipeId: "recipe-123"
 *             servings: 4
 *             notes: "Sehr lecker!"
 *     responses:
 *       201:
 *         description: Eintrag erstellt
 *       400:
 *         description: Recipe ID fehlt
 *       404:
 *         description: Rezept nicht gefunden
 */

/**
 * @swagger
 * /cooking-history/stats:
 *   get:
 *     summary: Kochstatistiken für alle Rezepte
 *     tags: [Cooking History]
 *     responses:
 *       200:
 *         description: Statistiken pro Rezept
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   recipe_id:
 *                     type: string
 *                   recipe_name:
 *                     type: string
 *                   times_cooked:
 *                     type: integer
 *                   last_cooked_at:
 *                     type: string
 *                     format: date-time
 */

/**
 * @swagger
 * /cooking-history/recipe/{recipeId}:
 *   get:
 *     summary: Kochverlauf für ein bestimmtes Rezept
 *     tags: [Cooking History]
 *     parameters:
 *       - in: path
 *         name: recipeId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Kochverlauf des Rezepts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/CookingHistoryEntry'
 */

/**
 * @swagger
 * /cooking-history/not-cooked-recently:
 *   get:
 *     summary: Rezepte die lange nicht gekocht wurden
 *     tags: [Cooking History]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Anzahl Tage
 *     responses:
 *       200:
 *         description: Liste von Rezepten
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   category:
 *                     type: string
 *                   last_cooked_at:
 *                     type: string
 *                     format: date-time
 *                   times_cooked:
 *                     type: integer
 */

/**
 * @swagger
 * /cooking-history/{id}:
 *   delete:
 *     summary: Kochverlauf-Eintrag löschen
 *     tags: [Cooking History]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Eintrag gelöscht
 *       404:
 *         description: Eintrag nicht gefunden
 */

/**
 * @swagger
 * /ai/generate-recipes:
 *   post:
 *     summary: Rezepte aus Zutaten generieren
 *     tags: [AI]
 *     description: |
 *       Generiert 3 Rezeptvorschläge basierend auf den angegebenen Zutaten.
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ingredients]
 *             properties:
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Hähnchen", "Reis", "Paprika"]
 *               preferences:
 *                 type: object
 *                 properties:
 *                   dietary:
 *                     type: string
 *                     description: z.B. "vegetarisch", "glutenfrei"
 *                   cookingTime:
 *                     type: integer
 *                     description: Maximale Kochzeit in Minuten
 *                   difficulty:
 *                     type: string
 *                     enum: [einfach, mittel, schwer]
 *     responses:
 *       200:
 *         description: Generierte Rezepte
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipes:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Recipe'
 *       400:
 *         description: Keine Zutaten angegeben
 *       429:
 *         description: Rate Limit überschritten
 *       503:
 *         description: KI-Service nicht konfiguriert
 */

/**
 * @swagger
 * /ai/parse-recipe:
 *   post:
 *     summary: Rezept aus Text oder URL parsen
 *     tags: [AI]
 *     description: |
 *       Extrahiert ein strukturiertes Rezept aus Freitext oder einer URL.
 *
 *       **Unterstützte Domains:** chefkoch.de, eatsmarter.de, lecker.de, allrecipes.com, u.v.m.
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [input]
 *             properties:
 *               input:
 *                 type: string
 *                 description: Rezepttext oder URL
 *               type:
 *                 type: string
 *                 enum: [text, url]
 *                 description: Wird automatisch erkannt wenn nicht angegeben
 *           examples:
 *             text:
 *               summary: Rezepttext
 *               value:
 *                 input: "Für 4 Portionen: 400g Spaghetti, 200g Speck..."
 *                 type: "text"
 *             url:
 *               summary: Rezept-URL
 *               value:
 *                 input: "https://www.chefkoch.de/rezepte/123"
 *                 type: "url"
 *     responses:
 *       200:
 *         description: Geparstes Rezept
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipe:
 *                   $ref: '#/components/schemas/Recipe'
 *                 source:
 *                   type: string
 *                   example: "ai-parsed"
 *       400:
 *         description: Ungültige Eingabe oder URL nicht erreichbar
 *       429:
 *         description: Rate Limit überschritten
 *       503:
 *         description: KI-Service nicht konfiguriert
 */

/**
 * @swagger
 * /ai/parse-video-recipe:
 *   post:
 *     summary: Rezept aus Video extrahieren
 *     tags: [AI]
 *     description: |
 *       Extrahiert ein Rezept aus einem Kurzvideo.
 *
 *       **Unterstützte Plattformen:** TikTok, Instagram Reels, Pinterest, YouTube Shorts
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *
 *       **Hinweis:** Video wird temporär heruntergeladen und nach der Analyse gelöscht.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url, acceptDisclaimer]
 *             properties:
 *               url:
 *                 type: string
 *                 description: Video-URL
 *                 example: "https://www.tiktok.com/@user/video/123"
 *               acceptDisclaimer:
 *                 type: boolean
 *                 description: Muss true sein um fortzufahren
 *     responses:
 *       200:
 *         description: Extrahiertes Rezept
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipe:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Recipe'
 *                     - type: object
 *                       properties:
 *                         prepTime:
 *                           type: string
 *                         cookTime:
 *                           type: string
 *                         difficulty:
 *                           type: string
 *                         tips:
 *                           type: string
 *                         sourceUrl:
 *                           type: string
 *                         sourceNote:
 *                           type: string
 *                 source:
 *                   type: string
 *                   example: "video-parsed"
 *                 platform:
 *                   type: string
 *                   example: "tiktok"
 *       400:
 *         description: Ungültige URL, Disclaimer nicht akzeptiert, oder Video zu groß
 *       429:
 *         description: Rate Limit überschritten
 *       503:
 *         description: KI-Service nicht konfiguriert
 */

/**
 * @swagger
 * /ai/video-platforms:
 *   get:
 *     summary: Unterstützte Video-Plattformen abrufen
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Liste unterstützter Plattformen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 platforms:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["tiktok", "instagram", "pinterest", "youtube"]
 *                 disclaimer:
 *                   type: string
 */

/**
 * @swagger
 * /ai/generate-weekplan:
 *   post:
 *     summary: KI-gestützten Wochenplan generieren
 *     tags: [AI]
 *     description: |
 *       Generiert einen kompletten Wochenplan mit Mahlzeitenvorschlägen.
 *       Die KI berücksichtigt vorhandene Rezepte des Nutzers und erstellt
 *       einen abwechslungsreichen, ausgewogenen Plan.
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mealTypes]
 *             properties:
 *               mealTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Frühstück, Mittagessen, Abendessen]
 *                 minItems: 1
 *                 description: Mahlzeiten für die Vorschläge generiert werden sollen
 *                 example: ["Abendessen"]
 *               days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *                 default: 7
 *                 description: Anzahl der Tage (1-7)
 *               preferences:
 *                 type: object
 *                 properties:
 *                   dietary:
 *                     type: string
 *                     description: Ernährungspräferenzen (z.B. vegetarisch, vegan, glutenfrei)
 *                     example: "vegetarisch"
 *                   cuisines:
 *                     type: string
 *                     description: Bevorzugte Küchen
 *                     example: "italienisch, asiatisch"
 *                   avoidIngredients:
 *                     type: string
 *                     description: Zutaten die vermieden werden sollen
 *                   budget:
 *                     type: string
 *                     description: Budget-Präferenz
 *                     example: "günstig"
 *                   cookingSkill:
 *                     type: string
 *                     enum: [Anfänger, Fortgeschritten, Profi]
 *           examples:
 *             nurAbendessen:
 *               summary: Nur Abendessen
 *               value:
 *                 mealTypes: ["Abendessen"]
 *                 days: 7
 *             vollstaendigerPlan:
 *               summary: Kompletter Plan mit Präferenzen
 *               value:
 *                 mealTypes: ["Frühstück", "Mittagessen", "Abendessen"]
 *                 days: 7
 *                 preferences:
 *                   dietary: "vegetarisch"
 *                   cookingSkill: "Fortgeschritten"
 *     responses:
 *       200:
 *         description: Generierter Wochenplan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 weekPlan:
 *                   type: object
 *                   description: Wochenplan mit Tagen als Schlüssel
 *                   additionalProperties:
 *                     type: object
 *                     properties:
 *                       Frühstück:
 *                         $ref: '#/components/schemas/AIGeneratedMeal'
 *                       Mittagessen:
 *                         $ref: '#/components/schemas/AIGeneratedMeal'
 *                       Abendessen:
 *                         $ref: '#/components/schemas/AIGeneratedMeal'
 *                   example:
 *                     Montag:
 *                       Abendessen:
 *                         name: "Gemüse-Curry mit Basmatireis"
 *                         description: "Cremiges Thai-Curry mit saisonalem Gemüse"
 *                         category: "Hauptgericht"
 *                     Dienstag:
 *                       Abendessen:
 *                         name: "Pasta Primavera"
 *                         description: "Leichte Pasta mit frischem Gemüse"
 *                         category: "Hauptgericht"
 *                 shoppingTips:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Einkaufstipps für den Wochenplan
 *                   example: ["Kaufe saisonales Gemüse auf dem Wochenmarkt", "Basilikum lässt sich auch einfrieren"]
 *                 mealPrepSuggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: Meal-Prep Vorschläge
 *                   example: ["Reis kann für mehrere Tage vorgekocht werden"]
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     mealTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                     days:
 *                       type: integer
 *       400:
 *         description: Ungültige Anfrage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               keineMahlzeiten:
 *                 summary: Keine Mahlzeiten ausgewählt
 *                 value:
 *                   error: "Bitte wähle mindestens eine Mahlzeit aus (Frühstück, Mittagessen, Abendessen)"
 *               ungueltigeMahlzeit:
 *                 summary: Ungültige Mahlzeit
 *                 value:
 *                   error: "Ungültige Mahlzeiten: Brunch. Erlaubt sind: Frühstück, Mittagessen, Abendessen"
 *       429:
 *         description: Rate Limit überschritten
 *       500:
 *         description: Fehler bei der Generierung
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut."
 *               details: "JSON parsing failed"
 *       503:
 *         description: KI-Service nicht konfiguriert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'

/**
 * @swagger
 * /ai/meal-prep-suggestions:
 *   post:
 *     summary: KI-gestützte Meal-Prep Sessions und Einkaufsvorschläge
 *     tags: [AI]
 *     description: |
 *       Erstellt strukturierte Meal-Prep Sessions inklusive Zeitplan, Parallelisierungs-Tipps
 *       und gruppierten Einkaufsblöcken für vorhandene Meal-Prep geeignete Rezepte.
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipes]
 *             properties:
 *               prepDay:
 *                 type: string
 *                 description: Beschreibung oder Datum des geplanten Meal-Prep Tags
 *                 example: "Sonntag Vormittag"
 *               recipes:
 *                 type: array
 *                 description: Liste der Meal-Prep geeigneten Rezepte mit Metadaten
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [id, name]
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Rezept-ID
 *                       example: "recipe-123"
 *                     name:
 *                       type: string
 *                       example: "Gemüse Curry"
 *                     category:
 *                       type: string
 *                       example: "Hauptgericht"
 *                     servings:
 *                       type: integer
 *                       example: 4
 *                     prep_time:
 *                       type: integer
 *                       description: Vorbereitung in Minuten
 *                       example: 15
 *                     cook_time:
 *                       type: integer
 *                       description: Kochzeit in Minuten
 *                       example: 25
 *                     difficulty:
 *                       type: string
 *                       example: "Einfach"
 *                     is_meal_prep_suitable:
 *                       type: boolean
 *                       example: true
 *                     meal_prep_fridge_days:
 *                       type: integer
 *                       example: 3
 *                     meal_prep_freezer_days:
 *                       type: integer
 *                       example: 30
 *                     meal_prep_reheat_tips:
 *                       type: string
 *                       example: "Im Topf mit etwas Kokosmilch erwärmen."
 *                     meal_prep_batch_notes:
 *                       type: string
 *                       example: "Gemüse separat blanchieren, dann zusammenführen."
 *                     targetPortions:
 *                       type: integer
 *                       description: Gewünschte Portionen für die Meal-Prep Session
 *                       example: 6
 *                     targetDates:
 *                       type: array
 *                       items:
 *                         type: string
 *                         format: date
 *                       example: ["2024-01-15", "2024-01-17"]
 *                     mealTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Mittagessen"]
 *           examples:
 *             mealPrepPlanung:
 *               summary: Meal-Prep für zwei Rezepte
 *               value:
 *                 prepDay: "Sonntag"
 *                 recipes:
 *                   - id: "recipe-123"
 *                     name: "Gemüse Curry"
 *                     servings: 4
 *                     prep_time: 15
 *                     cook_time: 25
 *                     difficulty: "Einfach"
 *                     is_meal_prep_suitable: true
 *                     meal_prep_fridge_days: 3
 *                     meal_prep_reheat_tips: "Im Topf mit etwas Kokosmilch erwärmen."
 *                     targetPortions: 6
 *                     targetDates: ["2024-01-15", "2024-01-17"]
 *                     mealTypes: ["Mittagessen"]
 *                   - id: "recipe-456"
 *                     name: "Ofen Lachs"
 *                     servings: 2
 *                     prep_time: 10
 *                     cook_time: 20
 *                     is_meal_prep_suitable: true
 *                     meal_prep_fridge_days: 2
 *                     meal_prep_freezer_days: 14
 *                     meal_prep_reheat_tips: "Im Ofen bei 160°C aufwärmen."
 *                     targetPortions: 4
 *                     targetDates: ["2024-01-16"]
 *                     mealTypes: ["Abendessen"]
 *     responses:
 *       200:
 *         description: Meal-Prep Sessions und Einkaufstipps
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sessions:
 *                   type: array
 *                   description: Geplante Meal-Prep Sessions
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         example: "Meal-Prep Sonntag"
 *                       recommendedStartTime:
 *                         type: string
 *                         example: "10:00"
 *                       estimatedTotalMinutes:
 *                         type: integer
 *                         example: 160
 *                       recipes:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             recipeId:
 *                               type: string
 *                             name:
 *                               type: string
 *                             batchPortions:
 *                               type: integer
 *                             prepOrder:
 *                               type: integer
 *                             parallelizationTips:
 *                               type: string
 *                             storage:
 *                               type: object
 *                               properties:
 *                                 fridgeDays:
 *                                   type: integer
 *                                   nullable: true
 *                                 freezerDays:
 *                                   type: integer
 *                                   nullable: true
 *                                 notes:
 *                                   type: string
 *                             reheatTips:
 *                               type: string
 *                             targetDates:
 *                               type: array
 *                               items:
 *                                 type: string
 *                                 format: date
 *                       timeline:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             start:
 *                               type: string
 *                               example: "10:00"
 *                             end:
 *                               type: string
 *                               example: "10:30"
 *                             task:
 *                               type: string
 *                               example: "Gemüse schnippeln"
 *                             relatedRecipeIds:
 *                               type: array
 *                               items:
 *                                 type: string
 *                 shoppingGroups:
 *                   type: array
 *                   description: Zutaten-Gruppierungen für effizientes Einkaufen und Vorbereiten
 *                   items:
 *                     type: object
 *                     properties:
 *                       label:
 *                         type: string
 *                         example: "Gemüse schälen & schneiden"
 *                       ingredients:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             unit:
 *                               type: string
 *                             totalAmount:
 *                               oneOf:
 *                                 - type: number
 *                                 - type: string
 *                             recipes:
 *                               type: array
 *                               items:
 *                                 type: string
 *                 generalAdvice:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["Bereite zuerst die Gerichte mit längerer Garzeit vor."]
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                     recipeCount:
 *                       type: integer
 *                     prepDay:
 *                       type: string
 *             examples:
 *               antwortBeispiel:
 *                 summary: Beispielantwort der KI
 *                 value:
 *                   sessions:
 *                     - label: "Meal-Prep Sonntag"
 *                       recommendedStartTime: "10:00"
 *                       estimatedTotalMinutes: 160
 *                       recipes:
 *                         - recipeId: "recipe-123"
 *                           name: "Gemüse Curry"
 *                           batchPortions: 6
 *                           prepOrder: 1
 *                           parallelizationTips: "Koche den Reis, während das Curry simmert."
 *                           storage:
 *                             fridgeDays: 3
 *                             freezerDays: 30
 *                             notes: "Portionen luftdicht verpacken."
 *                           reheatTips: "Im Topf mit etwas Kokosmilch erwärmen."
 *                           targetDates: ["2024-01-15", "2024-01-17"]
 *                       timeline:
 *                         - start: "10:00"
 *                           end: "10:20"
 *                           task: "Gemüse schneiden"
 *                           relatedRecipeIds: ["recipe-123"]
 *                   shoppingGroups:
 *                     - label: "Gemüse vorbereiten"
 *                       ingredients:
 *                         - name: "Paprika"
 *                           unit: "Stück"
 *                           totalAmount: 4
 *                           recipes: ["recipe-123"]
 *                   generalAdvice:
 *                     - "Bereite zuerst die Gerichte mit längerer Garzeit vor."
 *                   metadata:
 *                     generatedAt: "2024-01-10T08:00:00.000Z"
 *                     recipeCount: 2
 *                     prepDay: "Sonntag"
 *       400:
 *         description: Ungültige Anfrage
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Bitte übermittle mindestens ein Meal-Prep geeignetes Rezept."
 *       429:
 *         description: Rate Limit überschritten
 *       500:
 *         description: Fehler bei der KI-Antwort
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       503:
 *         description: KI-Service nicht konfiguriert
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "AI service not configured. Please set GEMINI_API_KEY environment variable."
 */

/**
 * @swagger
 * /ai/scale-portions:
 *   post:
 *     summary: Portionen intelligent skalieren
 *     tags: [AI]
 *     description: |
 *       Skaliert Zutatenmengen mit intelligenter Rundung auf praktische Werte.
 *
 *       **Rate Limit:** 20 Anfragen / 15 Minuten
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ingredients, originalServings, newServings]
 *             properties:
 *               ingredients:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/Ingredient'
 *               originalServings:
 *                 type: integer
 *                 example: 4
 *               newServings:
 *                 type: integer
 *                 example: 6
 *     responses:
 *       200:
 *         description: Skalierte Zutaten
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ingredients:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Ingredient'
 *       400:
 *         description: Fehlende Pflichtfelder
 *       429:
 *         description: Rate Limit überschritten
 *       503:
 *         description: KI-Service nicht konfiguriert
 */

/**
 * @swagger
 * /ai/categorize-ingredient:
 *   post:
 *     summary: Zutat kategorisieren
 *     tags: [AI]
 *     description: |
 *       Kategorisiert eine Zutat in eine Warengruppe.
 *       Verwendet KI wenn verfügbar, sonst regelbasierte Kategorisierung.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ingredientName]
 *             properties:
 *               ingredientName:
 *                 type: string
 *                 example: "Parmesan"
 *     responses:
 *       200:
 *         description: Kategorie der Zutat
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 category:
 *                   type: string
 *                   enum: ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges']
 *                   example: "Milchprodukte"
 *                 source:
 *                   type: string
 *                   enum: [ai, rule-based, rule-based-fallback]
 *       400:
 *         description: Zutatenname fehlt
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic Health Check (Liveness Probe)
 *     tags: [System]
 *     description: |
 *       Schneller Health Check für Load Balancer und Liveness Probes.
 *       Antwortet in < 100ms ohne Datenbank-Check.
 *     responses:
 *       200:
 *         description: Server ist erreichbar
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [UP]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *             example:
 *               status: "UP"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 */

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness Probe
 *     tags: [System]
 *     description: |
 *       Prüft ob die Anwendung bereit ist, Traffic zu verarbeiten.
 *       Inkludiert Datenbank-Verbindungscheck.
 *       Geeignet für Kubernetes Readiness Probes.
 *     responses:
 *       200:
 *         description: Anwendung ist bereit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [UP, DOWN]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [UP, DOWN]
 *                         latency:
 *                           type: integer
 *                           description: Latenz in Millisekunden
 *             example:
 *               status: "UP"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               checks:
 *                 database:
 *                   status: "UP"
 *                   latency: 5
 *       503:
 *         description: Anwendung nicht bereit
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               status: "DOWN"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               checks:
 *                 database:
 *                   status: "DOWN"
 *                   error: "Connection refused"
 */

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed Health Check
 *     tags: [System]
 *     description: |
 *       Umfassender Health Check mit detaillierten Informationen zu allen Komponenten.
 *       Geeignet für Monitoring-Dashboards und Debugging.
 *     responses:
 *       200:
 *         description: Detaillierter Systemstatus
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [UP, DOWN]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   description: Version aus package.json
 *                 uptime:
 *                   type: integer
 *                   description: Uptime in Sekunden
 *                 uptimeHuman:
 *                   type: string
 *                   description: Uptime in lesbarem Format
 *                 checks:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         latency:
 *                           type: integer
 *                     geminiApi:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [UP, UNCONFIGURED]
 *                         configured:
 *                           type: boolean
 *                     memory:
 *                       type: object
 *                       properties:
 *                         heapUsed:
 *                           type: integer
 *                         heapTotal:
 *                           type: integer
 *                         rss:
 *                           type: integer
 *                         external:
 *                           type: integer
 *                         unit:
 *                           type: string
 *             example:
 *               status: "UP"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               version: "1.0.0"
 *               uptime: 86400
 *               uptimeHuman: "1d 0h 0m 0s"
 *               checks:
 *                 database:
 *                   status: "UP"
 *                   latency: 5
 *                 geminiApi:
 *                   status: "UP"
 *                   configured: true
 *                 memory:
 *                   heapUsed: 45
 *                   heapTotal: 65
 *                   rss: 95
 *                   external: 2
 *                   unit: "MB"
 *       503:
 *         description: Eine oder mehrere Komponenten sind nicht verfügbar
 */

// Diese Datei enthält nur JSDoc-Kommentare für swagger-jsdoc
// Sie wird von swagger.js referenziert
module.exports = {};
