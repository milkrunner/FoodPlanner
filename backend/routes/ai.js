const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const cheerio = require('cheerio');
const db = require('../db');
const { logger } = require('../utils/logger');
const { genAI } = require('../utils/gemini');
const { aiLimiter } = require('../middleware/rate-limiters');
const { parseNullableInt, parseNullableText } = require('../utils/parsing');
const { categorizeIngredient } = require('../utils/categorization');
const { validateUrl, ALLOWED_RECIPE_DOMAINS, VIDEO_PLATFORMS, isVideoUrl } = require('../utils/validation');
const { downloadVideo, cleanupTempFiles } = require('../utils/video');
const { classicSearch } = require('../utils/search');
const { sanitizeForPrompt, sanitizeArrayForPrompt, extractJsonFromAiResponse } = require('../utils/ai-sanitize');
const { authenticateRequired } = require('../middleware/authenticate');

// ========== HELPER FUNCTIONS ==========

// Build a safe fetch URL by validating against allowlist and reconstructing from trusted components.
// This breaks CodeQL taint propagation by using the hostname from the static allowlist array.
function buildSafeFetchUrl(userUrl) {
    validateUrl(userUrl); // throws if not on allowlist
    const parsed = new URL(userUrl);
    const hostname = parsed.hostname.toLowerCase();
    // Look up hostname from the static allowlist — this is a non-tainted string literal
    const trustedHostname = ALLOWED_RECIPE_DOMAINS.find(d => d === hostname);
    if (!trustedHostname) throw new Error('Domain not allowed');
    // Reconstruct URL from trusted hostname + sanitized path components
    const safeUrl = new URL(`https://${trustedHostname}`);
    safeUrl.pathname = parsed.pathname;
    safeUrl.search = parsed.search;
    return safeUrl.href;
}

const FETCH_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

// Helper function to fetch and extract text from URL
async function fetchRecipeFromUrl(userProvidedUrl) {
    const fetchUrl = buildSafeFetchUrl(userProvidedUrl);

    try {
        const response = await fetch(fetchUrl, {
            headers: FETCH_HEADERS,
            redirect: 'manual'
        });

        // Handle redirects safely - only follow if redirect stays on allowed domains
        if (response.status >= 300 && response.status < 400) {
            const redirectLocation = response.headers.get('location');
            if (redirectLocation) {
                const redirectUrl = new URL(redirectLocation, fetchUrl);
                const safeRedirectUrl = buildSafeFetchUrl(redirectUrl.href);

                const redirectResponse = await fetch(safeRedirectUrl, {
                    headers: FETCH_HEADERS,
                    redirect: 'manual'
                });
                if (!redirectResponse.ok) {
                    throw new Error(`HTTP error! status: ${redirectResponse.status}`);
                }
                const html = await redirectResponse.text();
                return extractRecipeText(html);
            }
        }

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const html = await response.text();
        return extractRecipeText(html);
    } catch (error) {
        throw new Error(`Failed to fetch URL: ${error.message}`);
    }
}

// Helper function to extract recipe text from HTML
function extractRecipeText(html) {
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, nav, header, footer, iframe, noscript').remove();

    // Try to find recipe-specific content
    let recipeText = '';

    // Look for common recipe containers
    const recipeSelectors = [
        '[itemtype*="Recipe"]',
        '.recipe',
        '#recipe',
        '.recipe-content',
        '.recipe-instructions',
        'article',
        'main'
    ];

    for (const selector of recipeSelectors) {
        const element = $(selector);
        if (element.length > 0) {
            recipeText = element.text();
            break;
        }
    }

    // Fallback to body content if no recipe-specific content found
    if (!recipeText) {
        recipeText = $('body').text();
    }

    // Clean up whitespace
    recipeText = recipeText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    return recipeText;
}

// ========== ROUTES ==========

// Generate recipes from ingredients
router.post('/generate-recipes', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { ingredients, preferences } = req.body;

        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ error: 'Please provide at least one ingredient' });
        }

        const safeIngredients = sanitizeArrayForPrompt(ingredients, 100, 30);
        if (safeIngredients.length === 0) {
            return res.status(400).json({ error: 'No valid ingredients provided' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein kreativer Koch-Assistent. Generiere 3 leckere Rezept-Vorschläge basierend auf folgenden Zutaten:

Verfügbare Zutaten: ${safeIngredients.join(', ')}

${preferences?.dietary ? `Ernährungspräferenzen: ${sanitizeForPrompt(preferences.dietary, 200)}` : ''}
${preferences?.cookingTime ? `Maximale Kochzeit: ${sanitizeForPrompt(String(preferences.cookingTime), 20)} Minuten` : ''}
${preferences?.difficulty ? `Schwierigkeitsgrad: ${sanitizeForPrompt(preferences.difficulty, 50)}` : ''}

Erstelle für jedes Rezept:
- Einen kreativen Namen
- Kategorie (z.B. Hauptgericht, Suppe, Salat, etc.)
- Anzahl Portionen
- Liste der Zutaten mit Mengen und Einheiten und Kategorien (Obst & Gemüse, Milchprodukte, Fleisch & Fisch, Trockenwaren, Tiefkühl, Sonstiges)
- Schritt-für-Schritt Anleitung

WICHTIG: Antworte NUR mit einem validen JSON-Array im folgenden Format, ohne zusätzlichen Text:

[
  {
    "name": "Rezeptname",
    "category": "Kategorie",
    "servings": 4,
    "ingredients": [
      {
        "name": "Zutat",
        "amount": "200",
        "unit": "g",
        "category": "Obst & Gemüse"
      }
    ],
    "instructions": "Schritt 1: ... Schritt 2: ..."
  }
]`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const recipes = extractJsonFromAiResponse(text);

        res.json({ recipes });
    } catch (error) {
        logger.error('AI generation error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to generate recipes',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// AI-based ingredient categorization
router.post('/categorize-ingredient', authenticateRequired, aiLimiter, async (req, res) => {
    try {
        const { ingredientName } = req.body;

        if (!ingredientName) {
            return res.status(400).json({ error: 'Missing required field: ingredientName' });
        }

        const categories = ['Obst & Gemüse', 'Milchprodukte', 'Fleisch & Fisch', 'Trockenwaren', 'Tiefkühl', 'Sonstiges'];

        // Rule-based fallback categorization (fast, works offline)
        const ruleBased = categorizeIngredient(ingredientName.toLowerCase());

        // If Gemini is not available, use rule-based only
        if (!genAI) {
            return res.json({ category: ruleBased, source: 'rule-based' });
        }

        // Try AI categorization
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

            const prompt = `Kategorisiere die folgende Zutat in genau eine der folgenden Kategorien:

Kategorien:
- Obst & Gemüse
- Milchprodukte
- Fleisch & Fisch
- Trockenwaren
- Tiefkühl
- Sonstiges

Zutat: "${ingredientName}"

WICHTIG: Antworte NUR mit dem Namen der Kategorie, ohne zusätzlichen Text oder Erklärungen.`;

            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text().trim();

            // Validate that response is one of the valid categories
            if (categories.includes(text)) {
                return res.json({ category: text, source: 'ai' });
            } else {
                // AI returned invalid category, use rule-based
                return res.json({ category: ruleBased, source: 'rule-based-fallback' });
            }
        } catch (aiError) {
            logger.error('AI categorization error', { error: aiError.message, ingredient: ingredientName, requestId: req.requestId, component: 'ai' });
            // AI failed, use rule-based
            return res.json({ category: ruleBased, source: 'rule-based-fallback' });
        }
    } catch (error) {
        logger.error('Categorization error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to categorize ingredient',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// AI-based portion scaling
router.post('/scale-portions', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { ingredients, originalServings, newServings } = req.body;

        if (!ingredients || !originalServings || !newServings) {
            return res.status(400).json({ error: 'Missing required fields: ingredients, originalServings, newServings' });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein Küchen-Assistent, der bei der Skalierung von Rezepten hilft.

Aufgabe: Skaliere die folgenden Zutaten von ${originalServings} Portionen auf ${newServings} Portionen. Verwende dabei intelligente Rundung für praktische Mengen.

Regeln für intelligente Rundung:
- Runde auf handelsübliche Mengen (z.B. 247g → 250g, 123g → 125g)
- Bei Eiern: Runde auf ganze Zahlen (z.B. 0.8 Eier → 1 Ei, 2.3 Eier → 2 Eier)
- Bei Esslöffeln/Teelöffeln: Runde auf halbe oder ganze Werte (z.B. 3.2 EL → 3 EL, 1.7 TL → 1.5 TL)
- Optimiere Einheiten wo sinnvoll (z.B. 1200ml → 1.2L, 1500g → 1.5kg)
- Behalte die Kategorie der Zutat bei

Originale Zutaten:
${JSON.stringify(ingredients, null, 2)}

WICHTIG: Antworte NUR mit einem validen JSON-Array im folgenden Format, ohne zusätzlichen Text:

[
  {
    "name": "Zutatname",
    "amount": "250",
    "unit": "g",
    "category": "Kategorie"
  }
]`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const scaledIngredients = extractJsonFromAiResponse(text);

        res.json({ ingredients: scaledIngredients });
    } catch (error) {
        logger.error('AI portion scaling error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to scale portions',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// AI-based recipe analysis and improvement suggestions
router.post('/analyze-recipe', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { recipe } = req.body;

        if (!recipe || !recipe.name) {
            return res.status(400).json({ error: 'Recipe with name is required' });
        }

        const safeName = sanitizeForPrompt(recipe.name, 200);
        const safeCategory = sanitizeForPrompt(recipe.category, 100);
        const safeInstructions = sanitizeForPrompt(recipe.instructions, 5000);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const ingredientsList = recipe.ingredients && recipe.ingredients.length > 0
            ? recipe.ingredients.slice(0, 50).map(i => `- ${sanitizeForPrompt(i.amount, 20)} ${sanitizeForPrompt(i.unit, 20)} ${sanitizeForPrompt(i.name, 100)}`.trim()).join('\n')
            : 'Keine Zutaten angegeben';

        const prompt = `Du bist ein erfahrener Koch und Ernährungsexperte. Analysiere das folgende Rezept und gib konkrete Verbesserungsvorschläge.

REZEPT:
Name: ${safeName}
Kategorie: ${safeCategory || 'Nicht angegeben'}
Portionen: ${recipe.servings || 'Nicht angegeben'}

Zutaten:
${ingredientsList}

Zubereitung:
${safeInstructions || 'Keine Zubereitungsanleitung angegeben'}

Gib mir genau 4 Verbesserungsvorschläge in den folgenden Kategorien:
1. GESCHMACK: Wie kann der Geschmack verbessert oder intensiviert werden?
2. GESUNDHEIT: Welche gesünderen Alternativen oder Ergänzungen gibt es?
3. ZEITERSPARNIS: Tipps zur schnelleren oder effizienteren Zubereitung
4. PROFI-TIPP: Ein Küchen-Hack oder Geheimtipp von Profiköchen

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format, ohne zusätzlichen Text:

{
  "recipeName": "${safeName}",
  "suggestions": [
    {
      "category": "Geschmack",
      "icon": "taste",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung des Vorschlags (2-3 Sätze)",
      "impact": "high|medium|low"
    },
    {
      "category": "Gesundheit",
      "icon": "health",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung",
      "impact": "high|medium|low"
    },
    {
      "category": "Zeitersparnis",
      "icon": "time",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung",
      "impact": "high|medium|low"
    },
    {
      "category": "Profi-Tipp",
      "icon": "chef",
      "title": "Kurzer Titel",
      "description": "Detaillierte Beschreibung",
      "impact": "high|medium|low"
    }
  ],
  "overallRating": {
    "taste": 1-5,
    "health": 1-5,
    "difficulty": 1-5,
    "comment": "Kurze Gesamtbewertung des Rezepts"
  }
}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const analysis = extractJsonFromAiResponse(text);

        logger.info('Recipe analysis completed', { recipeName: recipe.name, requestId: req.requestId, component: 'ai' });
        res.json(analysis);
    } catch (error) {
        logger.error('AI recipe analysis error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to analyze recipe',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// AI-based recipe variant generation
router.post('/generate-variant', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { recipe, variantType } = req.body;

        if (!recipe || !recipe.name) {
            return res.status(400).json({ error: 'Recipe with name is required' });
        }

        const validVariantTypes = ['vegetarisch', 'vegan', 'low-carb', 'glutenfrei', 'laktosefrei', 'schnell', 'kalorienarm'];
        if (!variantType || !validVariantTypes.includes(variantType)) {
            return res.status(400).json({
                error: `Invalid variant type. Valid types: ${validVariantTypes.join(', ')}`
            });
        }

        const safeName = sanitizeForPrompt(recipe.name, 200);
        const safeCategory = sanitizeForPrompt(recipe.category, 100);
        const safeInstructions = sanitizeForPrompt(recipe.instructions, 5000);

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const ingredientsList = recipe.ingredients && recipe.ingredients.length > 0
            ? recipe.ingredients.slice(0, 50).map(i => `- ${sanitizeForPrompt(i.amount, 20)} ${sanitizeForPrompt(i.unit, 20)} ${sanitizeForPrompt(i.name, 100)} (${sanitizeForPrompt(i.category, 50) || 'Sonstiges'})`.trim()).join('\n')
            : 'Keine Zutaten angegeben';

        const variantDescriptions = {
            'vegetarisch': 'eine vegetarische Version (ohne Fleisch und Fisch, aber mit Milchprodukten und Eiern)',
            'vegan': 'eine vegane Version (komplett ohne tierische Produkte)',
            'low-carb': 'eine Low-Carb Version (wenig Kohlenhydrate, max 20g pro Portion)',
            'glutenfrei': 'eine glutenfreie Version (ohne Weizen, Roggen, Gerste, Dinkel)',
            'laktosefrei': 'eine laktosefreie Version (ohne Milchprodukte oder mit laktosefreien Alternativen)',
            'schnell': 'eine schnelle Version (Zubereitungszeit unter 30 Minuten)',
            'kalorienarm': 'eine kalorienarme Version (reduzierte Kalorien durch leichtere Zutaten)'
        };

        const prompt = `Du bist ein erfahrener Koch und Ernährungsexperte. Erstelle ${variantDescriptions[variantType]} des folgenden Rezepts.

ORIGINAL-REZEPT:
Name: ${safeName}
Kategorie: ${safeCategory || 'Nicht angegeben'}
Portionen: ${recipe.servings || 4}

Zutaten:
${ingredientsList}

Zubereitung:
${safeInstructions || 'Keine Zubereitungsanleitung angegeben'}

Erstelle eine vollständige ${variantType} Variante dieses Rezepts. Die Variante soll:
- Den Charakter und Geschmack des Originals möglichst beibehalten
- Alle notwendigen Substitutionen enthalten
- Angepasste Zubereitungsanweisungen haben
- Realistisch und lecker sein

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format, ohne zusätzlichen Text:

{
  "originalName": "${safeName}",
  "variantType": "${variantType}",
  "variantName": "Neuer Name für die Variante",
  "category": "${recipe.category || 'Hauptgericht'}",
  "servings": ${recipe.servings || 4},
  "changes": [
    "Beschreibung der wichtigsten Änderung 1",
    "Beschreibung der wichtigsten Änderung 2"
  ],
  "ingredients": [
    {
      "name": "Zutatname",
      "amount": "Menge als String",
      "unit": "Einheit",
      "category": "Obst & Gemüse|Milchprodukte|Fleisch & Fisch|Trockenwaren|Tiefkühl|Sonstiges",
      "isNew": true,
      "replaces": "Name der ersetzten Zutat oder null"
    }
  ],
  "instructions": "Vollständige Zubereitungsanleitung im Markdown-Format mit Schritt 1:, Schritt 2:, etc.",
  "nutritionNote": "Kurzer Hinweis zu den ernährungsphysiologischen Vorteilen dieser Variante",
  "difficulty": "einfach|mittel|anspruchsvoll",
  "prepTime": "Geschätzte Zubereitungszeit"
}`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        const variant = extractJsonFromAiResponse(text);

        logger.info('Recipe variant generated', { recipeName: recipe.name, variantType, requestId: req.requestId, component: 'ai' });
        res.json(variant);
    } catch (error) {
        logger.error('AI variant generation error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to generate recipe variant',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// Get available variant types
router.get('/variant-types', authenticateRequired, (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({
        variantTypes: [
            { id: 'vegetarisch', name: 'Vegetarisch', icon: '🥬', description: 'Ohne Fleisch und Fisch' },
            { id: 'vegan', name: 'Vegan', icon: '🌱', description: 'Ohne tierische Produkte' },
            { id: 'low-carb', name: 'Low-Carb', icon: '🥩', description: 'Wenig Kohlenhydrate' },
            { id: 'glutenfrei', name: 'Glutenfrei', icon: '🌾', description: 'Ohne Gluten' },
            { id: 'laktosefrei', name: 'Laktosefrei', icon: '🥛', description: 'Ohne Laktose' },
            { id: 'schnell', name: 'Schnelle Version', icon: '⚡', description: 'Unter 30 Minuten' },
            { id: 'kalorienarm', name: 'Kalorienarm', icon: '🪶', description: 'Reduzierte Kalorien' }
        ]
    });
});

// AI-powered natural language recipe search
router.post('/search', authenticateRequired, aiLimiter, async (req, res) => {
    const startTime = Date.now();
    const { query, recipes } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Search query is required' });
    }

    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
        return res.json({ results: [], searchInfo: { query, matchCount: 0, aiPowered: false } });
    }

    // If AI is not available, fall back to classic search
    if (!genAI) {
        logger.info('AI search fallback to classic search - Gemini not configured', {
            requestId: req.requestId,
            query: query.substring(0, 100)
        });
        const classicResults = classicSearch(query, recipes);
        return res.json({
            results: classicResults,
            searchInfo: {
                query,
                matchCount: classicResults.length,
                aiPowered: false,
                fallbackReason: 'AI service not configured'
            }
        });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        // Get current context for better understanding
        const now = new Date();
        const hour = now.getHours();
        const month = now.getMonth();

        let timeOfDay = 'tagsüber';
        if (hour >= 5 && hour < 11) timeOfDay = 'morgens (Frühstück)';
        else if (hour >= 11 && hour < 14) timeOfDay = 'mittags (Mittagessen)';
        else if (hour >= 14 && hour < 18) timeOfDay = 'nachmittags';
        else if (hour >= 18 && hour < 22) timeOfDay = 'abends (Abendessen)';
        else timeOfDay = 'nachts';

        const seasons = ['Winter', 'Winter', 'Frühling', 'Frühling', 'Frühling', 'Sommer', 'Sommer', 'Sommer', 'Herbst', 'Herbst', 'Herbst', 'Winter'];
        const season = seasons[month];

        // Build recipe summary for AI
        const recipeSummary = recipes.map((r, idx) => {
            const ingredients = r.ingredients?.map(i => i.name).join(', ') || '';
            const tags = r.tags?.join(', ') || '';
            return `[${idx}] "${r.name}" | Kategorie: ${r.category || 'keine'} | Zutaten: ${ingredients} | Tags: ${tags}`;
        }).join('\n');

        const prompt = `Du bist ein intelligenter Rezept-Such-Assistent. Analysiere die Suchanfrage und finde die passendsten Rezepte.

SUCHANFRAGE: "${query}"

KONTEXT:
- Aktuelle Tageszeit: ${timeOfDay}
- Aktuelle Jahreszeit: ${season}

VERFÜGBARE REZEPTE:
${recipeSummary}

AUFGABE:
Analysiere die Suchanfrage semantisch und finde die relevantesten Rezepte. Berücksichtige:
1. Explizite Anforderungen (Zutaten, Kategorie, Ernährungsweise)
2. Implizite Hinweise (z.B. "schnell" = wenig Zutaten/einfach, "leicht" = Salate/Gemüse, "deftig" = Fleisch/Eintöpfe)
3. Tageszeit-Kontext (falls relevant für die Anfrage)
4. Jahreszeit-Kontext (falls relevant für die Anfrage)
5. Ähnlichkeiten auch ohne exakte Keyword-Treffer

Antworte NUR mit einem JSON-Objekt in diesem Format:
{
  "matches": [
    {"index": 0, "score": 95, "reason": "Kurze Begründung"},
    {"index": 3, "score": 80, "reason": "Kurze Begründung"}
  ],
  "interpretation": "Kurze Zusammenfassung wie du die Anfrage verstanden hast"
}

REGELN:
- Gib maximal 10 Matches zurück
- Score von 0-100 (100 = perfekte Übereinstimmung)
- Nur Rezepte mit Score >= 50 zurückgeben
- Sortiere nach Score absteigend
- Begründungen auf Deutsch, max 50 Zeichen
- Falls keine passenden Rezepte: leeres matches-Array`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Parse JSON from response
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Invalid AI response format');
        }

        const aiResult = JSON.parse(jsonMatch[0]);

        // Map AI results back to actual recipes
        const results = (aiResult.matches || [])
            .filter(m => m.index >= 0 && m.index < recipes.length && m.score >= 50)
            .map(m => ({
                ...recipes[m.index],
                _searchScore: m.score,
                _searchReason: m.reason
            }));

        const duration = Date.now() - startTime;
        logger.info('AI search completed', {
            requestId: req.requestId,
            query: query.substring(0, 100),
            recipeCount: recipes.length,
            matchCount: results.length,
            duration,
            interpretation: aiResult.interpretation
        });

        res.json({
            results,
            searchInfo: {
                query,
                matchCount: results.length,
                aiPowered: true,
                interpretation: aiResult.interpretation,
                duration
            }
        });

    } catch (error) {
        logger.error('AI search error, falling back to classic search', {
            requestId: req.requestId,
            error: error.message,
            query: query.substring(0, 100)
        });

        // Fallback to classic search on error
        const classicResults = classicSearch(query, recipes);
        res.json({
            results: classicResults,
            searchInfo: {
                query,
                matchCount: classicResults.length,
                aiPowered: false,
                fallbackReason: process.env.NODE_ENV === 'production'
                    ? 'AI service temporarily unavailable'
                    : error.message
            }
        });
    }
});

// Recipe Parser - Parse free text into structured recipe
router.post('/parse-recipe', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        let { input, type } = req.body;

        if (!input || !input.trim()) {
            return res.status(400).json({
                error: 'Input text is required'
            });
        }

        // Auto-detect if input is a URL
        if (!type && (input.trim().startsWith('http://') || input.trim().startsWith('https://'))) {
            type = 'url';
        }

        // Fetch content from URL if needed
        if (type === 'url') {
            const url = input.trim();
            logger.debug('Fetching recipe from URL', { url, requestId: req.requestId, component: 'ai' });

            try {
                input = await fetchRecipeFromUrl(url);
                logger.debug('Fetched content from URL', { contentLength: input.length, requestId: req.requestId, component: 'ai' });
            } catch (fetchError) {
                return res.status(400).json({
                    error: 'Failed to fetch recipe from URL',
                    details: fetchError.message,
                    hint: 'Make sure the URL is accessible and contains a recipe.'
                });
            }
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein intelligenter Rezept-Parser. Analysiere den folgenden Text und extrahiere ein strukturiertes Rezept daraus.

Text:
${input}

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format (ohne Markdown-Formatierung):

{
  "name": "Rezeptname",
  "category": "Kategorie (z.B. Hauptgericht, Suppe, Salat, Dessert, Vorspeise, Beilage, etc.)",
  "servings": 4,
  "ingredients": [
    {
      "name": "Zutat",
      "amount": "200",
      "unit": "g",
      "category": "Obst & Gemüse"
    }
  ],
  "instructions": "Schritt 1: ... Schritt 2: ..."
}

Regeln:
- Extrahiere den Rezeptnamen so genau wie möglich
- Identifiziere alle Zutaten mit Mengen und Einheiten
- Kategorisiere jede Zutat in eine der Kategorien: "Obst & Gemüse", "Milchprodukte", "Fleisch & Fisch", "Trockenwaren", "Tiefkühl", "Sonstiges"
- Fasse die Zubereitungsschritte in einer klaren Anleitung zusammen
- Erkenne die Portionsanzahl (Standard: 4)
- Bestimme eine passende Kategorie für das Rezept
- Wenn Mengenangaben fehlen, verwende sinnvolle Standardwerte
- Antworte AUSSCHLIESSLICH mit dem JSON-Objekt, keine zusätzlichen Erklärungen`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        logger.debug('AI Response received', { responseLength: responseText.length, requestId: req.requestId, component: 'ai' });

        let recipe;
        try {
            recipe = extractJsonFromAiResponse(responseText);
        } catch (parseError) {
            logger.error('JSON parse error', { error: parseError.message, requestId: req.requestId, component: 'ai' });
            return res.status(500).json({
                error: 'Failed to parse AI response as JSON'
            });
        }

        // Validate required fields
        if (!recipe.name || !recipe.ingredients || recipe.ingredients.length === 0) {
            return res.status(400).json({
                error: 'Parsed recipe is incomplete. Missing name or ingredients.',
                parsedData: recipe
            });
        }

        // Ensure all required fields have defaults
        recipe.id = Date.now().toString();
        recipe.category = recipe.category || 'Hauptgericht';
        recipe.servings = recipe.servings || 4;
        recipe.instructions = recipe.instructions || '';

        // Validate ingredients
        recipe.ingredients = recipe.ingredients.map(ing => ({
            name: ing.name || '',
            amount: ing.amount || '1',
            unit: ing.unit || 'x',
            category: ing.category || 'Sonstiges'
        }));

        res.json({
            recipe,
            source: 'ai-parsed'
        });
    } catch (error) {
        logger.error('Recipe parsing error', { error: error.message, requestId: req.requestId, component: 'ai' });
        res.status(500).json({
            error: 'Failed to parse recipe',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// Parse video recipe using Gemini
router.post('/parse-video-recipe', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    const { url, acceptDisclaimer } = req.body;

    if (!url || !url.trim()) {
        return res.status(400).json({
            error: 'Video URL is required'
        });
    }

    if (!acceptDisclaimer) {
        return res.status(400).json({
            error: 'You must accept the disclaimer to use this feature',
            requiresDisclaimer: true
        });
    }

    const videoUrl = url.trim();

    // Validate URL is from supported platform
    if (!isVideoUrl(videoUrl)) {
        return res.status(400).json({
            error: 'Unsupported video platform',
            hint: 'Supported platforms: TikTok, Instagram Reels, Pinterest, YouTube Shorts',
            supportedPlatforms: Object.keys(VIDEO_PLATFORMS)
        });
    }

    const tempDir = os.tmpdir();
    const videoId = Date.now().toString();
    const videoPath = path.join(tempDir, `recipe_video_${videoId}.mp4`);

    try {
        logger.debug('Downloading video', { url: videoUrl, requestId: req.requestId, component: 'video' });

        // Download the video
        await downloadVideo(videoUrl, videoPath);

        if (!fs.existsSync(videoPath)) {
            throw new Error('Video download failed - file not found');
        }

        const videoStats = fs.statSync(videoPath);
        logger.debug('Video downloaded', { sizeInMB: (videoStats.size / 1024 / 1024).toFixed(2), requestId: req.requestId, component: 'video' });

        // Check file size (Gemini limit is ~20MB for inline, we use File API for larger)
        if (videoStats.size > 20 * 1024 * 1024) {
            cleanupTempFiles(videoPath);
            return res.status(400).json({
                error: 'Video file too large. Maximum size is 20MB.',
                hint: 'Try a shorter video or lower quality.'
            });
        }

        // Read video file as base64
        const videoBuffer = fs.readFileSync(videoPath);
        const videoBase64 = videoBuffer.toString('base64');

        // Use Gemini with video
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const prompt = `Du bist ein intelligenter Rezept-Extraktor für Kochvideos. Analysiere dieses Video und extrahiere das gezeigte Rezept.

Achte besonders auf:
- Gesprochene Anweisungen und Zutatenlisten
- Sichtbare Zutaten und Mengenangaben
- Zubereitungsschritte die gezeigt oder erklärt werden
- Text-Overlays mit Rezeptinformationen

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format:

{
    "name": "Rezeptname (aus dem Video oder passend zum Gericht)",
    "category": "Kategorie (Hauptgericht, Suppe, Salat, Dessert, Vorspeise, Beilage, Snack, Getränk)",
    "servings": 4,
    "prepTime": "15 Min",
    "cookTime": "30 Min",
    "difficulty": "Einfach|Mittel|Schwer",
    "ingredients": [
        {
            "name": "Zutatname",
            "amount": "200",
            "unit": "g",
            "category": "Obst & Gemüse|Milchprodukte|Fleisch & Fisch|Trockenwaren|Tiefkühl|Sonstiges"
        }
    ],
    "instructions": "Schritt 1: ... \\n\\nSchritt 2: ...",
    "tips": "Optionale Tipps aus dem Video",
    "sourceNote": "Kurze Beschreibung des Videos (z.B. 'TikTok Rezept von @username')"
}

Regeln:
- Extrahiere so viele Details wie möglich aus Audio UND Bild
- Wenn Mengen nicht genannt werden, schätze sinnvolle Standardwerte
- Strukturiere die Anleitung in klare, nummerierte Schritte
- Erkenne die Sprache des Videos und übersetze bei Bedarf ins Deutsche
- Bei unklaren Informationen, nutze dein Kochwissen für plausible Werte`;

        const result = await model.generateContent([
            { text: prompt },
            {
                inlineData: {
                    mimeType: 'video/mp4',
                    data: videoBase64
                }
            }
        ]);

        // Clean up video file
        cleanupTempFiles(videoPath);

        const videoResponseText = result.response.text();

        logger.debug('Video AI Response received', { responseLength: videoResponseText.length, requestId: req.requestId, component: 'video' });

        let recipe;
        try {
            recipe = extractJsonFromAiResponse(videoResponseText);
        } catch (parseError) {
            logger.error('JSON parse error', { error: parseError.message, requestId: req.requestId, component: 'video' });
            return res.status(500).json({
                error: 'Failed to parse AI response as JSON',
                hint: 'The video might not contain a clear recipe.'
            });
        }

        // Validate required fields
        if (!recipe.name || !recipe.ingredients || recipe.ingredients.length === 0) {
            return res.status(400).json({
                error: 'Could not extract a complete recipe from this video',
                hint: 'Make sure the video clearly shows or explains a recipe.',
                parsedData: recipe
            });
        }

        // Ensure all required fields have defaults
        recipe.id = Date.now().toString();
        recipe.category = recipe.category || 'Hauptgericht';
        recipe.servings = recipe.servings || 4;
        recipe.instructions = recipe.instructions || '';
        recipe.sourceUrl = videoUrl;

        // Validate ingredients
        recipe.ingredients = recipe.ingredients.map(ing => ({
            name: ing.name || '',
            amount: ing.amount || '1',
            unit: ing.unit || 'x',
            category: ing.category || 'Sonstiges'
        }));

        res.json({
            recipe,
            source: 'video-parsed',
            platform: Object.keys(VIDEO_PLATFORMS).find(p => VIDEO_PLATFORMS[p].test(videoUrl)) || 'unknown'
        });

    } catch (error) {
        // Clean up on error
        cleanupTempFiles(videoPath);

        logger.error('Video recipe parsing error', { error: error.message, requestId: req.requestId, component: 'video' });
        res.status(500).json({
            error: 'Failed to parse video recipe',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// Get supported video platforms
router.get('/video-platforms', authenticateRequired, (req, res) => {
    res.set('Cache-Control', 'public, max-age=86400');
    res.json({
        platforms: Object.keys(VIDEO_PLATFORMS),
        disclaimer: 'Dieses Feature ist nur für Videos gedacht, zu deren Nutzung du berechtigt bist. Die Originalvideos werden nicht gespeichert. Bitte respektiere die Urheberrechte der Content-Creator.'
    });
});

// AI-powered weekly meal plan generation
router.post('/generate-weekplan', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    try {
        const { mealTypes, days, preferences } = req.body;

        // Validate mealTypes
        const validMealTypes = ['Frühstück', 'Mittagessen', 'Abendessen'];
        if (!mealTypes || !Array.isArray(mealTypes) || mealTypes.length === 0) {
            return res.status(400).json({
                error: 'Bitte wähle mindestens eine Mahlzeit aus (Frühstück, Mittagessen, Abendessen)'
            });
        }

        const invalidMeals = mealTypes.filter(m => !validMealTypes.includes(m));
        if (invalidMeals.length > 0) {
            return res.status(400).json({
                error: `Ungültige Mahlzeiten: ${invalidMeals.join(', ')}. Erlaubt sind: ${validMealTypes.join(', ')}`
            });
        }

        // Default to 7 days if not specified
        const numDays = days && Number.isInteger(days) && days >= 1 && days <= 7 ? days : 7;

        // Fetch existing recipes for context
        let existingRecipes = [];
        try {
            const recipesResult = await db.query('SELECT name, category FROM recipes LIMIT 50');
            existingRecipes = recipesResult.rows.map(r => `${r.name} (${r.category || 'Ohne Kategorie'})`);
        } catch (dbError) {
            logger.warn('Could not fetch existing recipes for AI context', {
                error: dbError.message,
                requestId: req.requestId,
                component: 'ai'
            });
        }

        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const dayNames = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
        const selectedDays = dayNames.slice(0, numDays);

        const prompt = `Du bist ein erfahrener Ernährungsberater und Meal-Prep-Experte. Erstelle einen abwechslungsreichen Wochenplan für ${numDays} Tage.

Erstelle Vorschläge für folgende Mahlzeiten: ${mealTypes.join(', ')}
Tage: ${selectedDays.join(', ')}

${preferences?.dietary ? `Ernährungspräferenzen: ${preferences.dietary}` : ''}
${preferences?.cuisines ? `Bevorzugte Küchen: ${preferences.cuisines}` : ''}
${preferences?.avoidIngredients ? `Diese Zutaten vermeiden: ${preferences.avoidIngredients}` : ''}
${preferences?.budget ? `Budget: ${preferences.budget}` : ''}
${preferences?.cookingTime ? `Maximale Kochzeit: ${preferences.cookingTime === 'schnell' ? 'unter 30 Minuten' : preferences.cookingTime === 'mittel' ? '30-60 Minuten' : 'über 60 Minuten erlaubt'}` : ''}
${preferences?.cookingSkill ? `Kochkenntnisse: ${preferences.cookingSkill}` : ''}

${existingRecipes.length > 0 ? `
Der Nutzer hat bereits diese Rezepte in seiner Datenbank (nutze gerne ähnliche oder passende Vorschläge):
${existingRecipes.slice(0, 20).join(', ')}
` : ''}

Beachte folgende Regeln:
1. Sorge für Abwechslung - keine Wiederholungen innerhalb der Woche
2. Achte auf eine ausgewogene Ernährung
3. Frühstück sollte schnell und einfach sein
4. Mittagessen kann als Meal-Prep vorbereitet werden
5. Abendessen darf aufwändiger sein (besonders am Wochenende)
6. Nutze saisonale Zutaten

WICHTIG: Antworte NUR mit einem validen JSON-Objekt im folgenden Format, ohne zusätzlichen Text:

{
  "weekPlan": {
    "Montag": {
      "Frühstück": {
        "name": "Rezeptname",
        "description": "Kurzbeschreibung (1 Satz)",
        "category": "Kategorie",
        "servings": 2,
        "ingredients": [
          { "name": "Zutat 1", "amount": "200", "unit": "g", "category": "Obst & Gemüse" },
          { "name": "Zutat 2", "amount": "1", "unit": "Stück", "category": "Milchprodukte" }
        ],
        "instructions": "Schritt 1: ... Schritt 2: ... Schritt 3: ..."
      },
      "Mittagessen": { ... },
      "Abendessen": { ... }
    }
  },
  "shoppingTips": ["Tipp 1", "Tipp 2"],
  "mealPrepSuggestions": ["Vorschlag 1", "Vorschlag 2"]
}

Gib nur die ausgewählten Mahlzeiten (${mealTypes.join(', ')}) im JSON zurück.
Kategorien für Rezepte: Frühstück, Hauptgericht, Suppe, Salat, Snack, Dessert, Beilage, Getränk
Kategorien für Zutaten: Obst & Gemüse, Milchprodukte, Fleisch & Fisch, Trockenwaren, Tiefkühl, Sonstiges
Einheiten für Zutaten: g, kg, ml, l, Stück, EL, TL, Prise, Bund, Dose, Packung`;

        const result = await model.generateContent(prompt);
        const generatedPlan = extractJsonFromAiResponse(result.response.text());

        // Validate response structure
        if (!generatedPlan.weekPlan || typeof generatedPlan.weekPlan !== 'object') {
            throw new Error('Invalid response structure: missing weekPlan');
        }

        // Save generated recipes to database and collect recipe IDs
        const savedRecipes = {};

        for (const [dayName, meals] of Object.entries(generatedPlan.weekPlan)) {
            savedRecipes[dayName] = {};

            for (const [mealType, meal] of Object.entries(meals)) {
                if (!meal || !meal.name) continue;

                try {
                    // Generate unique ID for the recipe
                    const recipeId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

                    // Insert recipe into database
                    await db.query(
                        `INSERT INTO recipes (id, name, category, servings, instructions)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [
                            recipeId,
                            meal.name,
                            meal.category || 'Hauptgericht',
                            meal.servings || 2,
                            meal.instructions || meal.description || ''
                        ]
                    );

                    // Insert ingredients if provided
                    if (meal.ingredients && Array.isArray(meal.ingredients)) {
                        for (const ingredient of meal.ingredients) {
                            if (!ingredient.name) continue;

                            await db.query(
                                `INSERT INTO ingredients (recipe_id, name, amount, unit, category)
                                 VALUES ($1, $2, $3, $4, $5)`,
                                [
                                    recipeId,
                                    ingredient.name,
                                    ingredient.amount || '',
                                    ingredient.unit || '',
                                    ingredient.category || 'Sonstiges'
                                ]
                            );
                        }
                    }

                    // Store the recipe ID for the response
                    savedRecipes[dayName][mealType] = {
                        ...meal,
                        recipeId: recipeId
                    };

                    logger.info('AI recipe saved to database', {
                        recipeId,
                        recipeName: meal.name,
                        dayName,
                        mealType,
                        requestId: req.requestId,
                        component: 'ai'
                    });

                } catch (dbError) {
                    logger.error('Failed to save AI recipe to database', {
                        error: dbError.message,
                        recipeName: meal.name,
                        requestId: req.requestId,
                        component: 'ai'
                    });
                    // Continue with other recipes even if one fails
                    savedRecipes[dayName][mealType] = {
                        ...meal,
                        recipeId: null
                    };
                }
            }
        }

        logger.info('AI week plan generated successfully', {
            days: numDays,
            mealTypes,
            requestId: req.requestId,
            component: 'ai'
        });

        res.json({
            success: true,
            weekPlan: savedRecipes,
            shoppingTips: generatedPlan.shoppingTips || [],
            mealPrepSuggestions: generatedPlan.mealPrepSuggestions || [],
            metadata: {
                generatedAt: new Date().toISOString(),
                mealTypes,
                days: numDays
            }
        });

    } catch (error) {
        logger.error('AI week plan generation error', {
            error: error.message,
            requestId: req.requestId,
            component: 'ai'
        });

        // Check for JSON parse errors
        if (error instanceof SyntaxError) {
            return res.status(500).json({
                error: 'Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.',
                details: 'JSON parsing failed'
            });
        }

        res.status(500).json({
            error: 'Fehler bei der Wochenplan-Generierung',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// AI-powered meal prep suggestions
router.post('/meal-prep-suggestions', authenticateRequired, aiLimiter, async (req, res) => {
    if (!genAI) {
        return res.status(503).json({
            error: 'AI service not configured. Please set GEMINI_API_KEY environment variable.'
        });
    }

    const recipeCandidates = Array.isArray(req.body?.recipes) ? req.body.recipes : [];
    const prepDayLabel = parseNullableText(req.body?.prepDay) || 'Meal-Prep Tag';
    const eligibleRecipes = recipeCandidates
        .filter((recipe) => recipe && (recipe.is_meal_prep_suitable === true || recipe.isMealPrepSuitable === true))
        .map((recipe) => {
            const prepTime = parseNullableInt(recipe.prep_time ?? recipe.prepTime) || 0;
            const cookTime = parseNullableInt(recipe.cook_time ?? recipe.cookTime) || 0;
            const fridgeDays = parseNullableInt(recipe.meal_prep_fridge_days ?? recipe.mealPrepFridgeDays);
            const freezerDays = parseNullableInt(recipe.meal_prep_freezer_days ?? recipe.mealPrepFreezerDays);
            const targetPortions = parseNullableInt(recipe.targetPortions ?? recipe.totalPortions) || recipe.servings || null;
            const targetDates = Array.isArray(recipe.targetDates) ? recipe.targetDates : [];

            return {
                id: recipe.id,
                name: recipe.name,
                servings: recipe.servings || null,
                category: recipe.category || null,
                totalTime: prepTime + cookTime,
                prepTime,
                cookTime,
                difficulty: recipe.difficulty || null,
                fridgeDays,
                freezerDays,
                reheatTips: parseNullableText(recipe.meal_prep_reheat_tips ?? recipe.mealPrepReheatTips),
                batchNotes: parseNullableText(recipe.meal_prep_batch_notes ?? recipe.mealPrepBatchNotes),
                targetPortions,
                targetDates,
                mealTypes: Array.isArray(recipe.mealTypes) ? recipe.mealTypes : []
            };
        });

    if (eligibleRecipes.length === 0) {
        return res.status(400).json({
            error: 'Bitte übermittle mindestens ein Meal-Prep geeignetes Rezept.'
        });
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        const recipeSummaries = eligibleRecipes.map((recipe, index) => {
            const parts = [
                `${index + 1}. ${recipe.name} (ID: ${recipe.id})`,
                recipe.category ? `Kategorie: ${recipe.category}` : null,
                recipe.servings ? `Standard-Portionen: ${recipe.servings}` : null,
                `Geschätzte Gesamtzeit: ${recipe.totalTime || 'unbekannt'} Minuten`,
                recipe.mealTypes.length ? `Geplante Mahlzeiten: ${recipe.mealTypes.join(', ')}` : null,
                recipe.targetPortions ? `Gewünschte Portionen: ${recipe.targetPortions}` : null,
                recipe.targetDates.length ? `Verbrauchstage: ${recipe.targetDates.join(', ')}` : null,
                recipe.fridgeDays ? `Kühlschrank: ${recipe.fridgeDays} Tage` : null,
                recipe.freezerDays ? `Gefrierschrank: ${recipe.freezerDays} Tage` : null,
                recipe.reheatTips ? `Aufwärm-Tipps: ${recipe.reheatTips}` : null,
                recipe.batchNotes ? `Batch-Notizen: ${recipe.batchNotes}` : null
            ].filter(Boolean);
            return parts.join(' • ');
        }).join('\n');

        const prompt = `Du bist ein erfahrener Meal-Prep Coach. Plane effiziente Meal-Prep Sessions für den ${prepDayLabel}.\n\n` +
            `Vorhandene Rezepte:\n${recipeSummaries}\n\n` +
            `Ziele:\n` +
            `- Ordne die Rezepte in produktive Sessions, die parallelisierbar sind.\n` +
            `- Gib Hinweise zur optimalen Reihenfolge und wann Aufgaben parallel laufen können.\n` +
            `- Berücksichtige vorhandene Haltbarkeitsdaten und Aufwärmhinweise.\n` +
            `- Gruppiere Zutaten für gemeinsames Vorbereiten.\n\n` +
            `Liefere ausschließlich ein valides JSON ohne zusätzlichen Text im Format:\n` +
            `{\n` +
            `  "sessions": [{\n` +
            `    "label": "string",\n` +
            `    "recommendedStartTime": "string",\n` +
            `    "estimatedTotalMinutes": number,\n` +
            `    "recipes": [{\n` +
            `      "recipeId": "ID von oben",\n` +
            `      "name": "string",\n` +
            `      "batchPortions": number,\n` +
            `      "prepOrder": number,\n` +
            `      "parallelizationTips": "string",\n` +
            `      "storage": {\n` +
            `        "fridgeDays": number|null,\n` +
            `        "freezerDays": number|null,\n` +
            `        "notes": "string"\n` +
            `      },\n` +
            `      "reheatTips": "string",\n` +
            `      "targetDates": ["YYYY-MM-DD", ...]\n` +
            `    }],\n` +
            `    "timeline": [{\n` +
            `      "start": "HH:MM",\n` +
            `      "end": "HH:MM",\n` +
            `      "task": "string",\n` +
            `      "relatedRecipeIds": ["ID", ...]\n` +
            `    }],\n` +
            `    "cleanupTips": ["string", ...]\n` +
            `  }],\n` +
            `  "shoppingGroups": [{\n` +
            `    "label": "string",\n` +
            `    "ingredients": [{\n` +
            `      "name": "string",\n` +
            `      "unit": "string",\n` +
            `      "totalAmount": number|string,\n` +
            `      "recipes": ["ID", ...]\n` +
            `    }]\n` +
            `  }],\n` +
            `  "generalAdvice": ["string", ...]\n` +
            `}\n\n` +
            `Nutze ausschließlich die vorhandenen Rezept-IDs. Verwende keine Markdown-Codeblöcke.`;

        const result = await model.generateContent(prompt);
        const suggestions = extractJsonFromAiResponse(result.response.text());

        if (!suggestions.sessions || !Array.isArray(suggestions.sessions)) {
            throw new Error('Invalid AI response: sessions missing');
        }

        logger.info('Meal-prep suggestions generated', {
            recipeCount: eligibleRecipes.length,
            requestId: req.requestId,
            component: 'ai'
        });

        res.json({
            sessions: suggestions.sessions,
            shoppingGroups: Array.isArray(suggestions.shoppingGroups) ? suggestions.shoppingGroups : [],
            generalAdvice: Array.isArray(suggestions.generalAdvice) ? suggestions.generalAdvice : [],
            metadata: {
                generatedAt: new Date().toISOString(),
                recipeCount: eligibleRecipes.length,
                prepDay: prepDayLabel
            }
        });
    } catch (error) {
        logger.error('Meal-prep suggestion error', {
            error: error.message,
            requestId: req.requestId,
            component: 'ai'
        });

        if (error instanceof SyntaxError) {
            return res.status(500).json({
                error: 'Die KI-Antwort konnte nicht verarbeitet werden. Bitte versuche es erneut.',
                details: 'JSON parsing failed'
            });
        }

        res.status(500).json({
            error: 'Fehler bei der Meal-Prep Empfehlung',
            details: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

module.exports = router;
