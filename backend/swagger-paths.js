/**
 * @swagger
 * /recipes:
 *   get:
 *     summary: Alle Rezepte abrufen
 *     tags: [Recipes]
 *     responses:
 *       200:
 *         description: Liste aller Rezepte
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Recipe'
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
 *     summary: Health Check
 *     tags: [System]
 *     description: Prüft ob der Server und die Datenbank erreichbar sind
 *     responses:
 *       200:
 *         description: Server ist gesund
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               status: "OK"
 *               database: "connected"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *       503:
 *         description: Server oder Datenbank nicht erreichbar
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               status: "ERROR"
 *               database: "disconnected"
 *               timestamp: "2024-01-15T10:30:00.000Z"
 */

// Diese Datei enthält nur JSDoc-Kommentare für swagger-jsdoc
// Sie wird von swagger.js referenziert
module.exports = {};
