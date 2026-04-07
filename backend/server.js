require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');
const db = require('./db');
const { logger, requestLogger } = require('./utils/logger');
const { generalLimiter, adminLimiter } = require('./middleware/rate-limiters');
const { authenticateRequired } = require('./middleware/authenticate');

// Route modules
const authRoutes = require('./routes/auth');
const recipesRoutes = require('./routes/recipes');
const weekplanRoutes = require('./routes/weekplan');
const shoppingRoutes = require('./routes/shopping');
const pantryRoutes = require('./routes/pantry');
const healthRoutes = require('./routes/health');
const cookingHistoryRoutes = require('./routes/cooking-history');
const aiRoutes = require('./routes/ai');
const seasonsRoutes = require('./routes/seasons');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust first proxy (nginx) for correct IP detection in rate limiters
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false
}));
// Validate CORS origin against strict URL pattern
const CORS_ORIGIN = (() => {
    const env = process.env.CORS_ORIGIN;
    if (!env) return 'http://localhost:5173';
    try {
        const url = new URL(env);
        if (url.protocol === 'http:' || url.protocol === 'https:') return url.origin;
    } catch { /* invalid URL */ }
    return 'http://localhost:5173';
})();
app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// CSRF protection: state-changing requests must have JSON content-type
// (HTML forms cannot set Content-Type to application/json)
app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/auth/logout') {
        const ct = req.headers['content-type'] || '';
        if (!ct.includes('application/json')) {
            return res.status(415).json({ error: 'Content-Type must be application/json' });
        }
    }
    next();
});

app.use(requestLogger);

// Swagger API Documentation (protected in production)
if (process.env.NODE_ENV === 'production') {
    app.use('/api-docs', generalLimiter, authenticateRequired, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'FoodPlanner API Dokumentation'
    }));
    app.get('/api-docs.json', generalLimiter, authenticateRequired, (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
} else {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'FoodPlanner API Dokumentation'
    }));
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });
}

// Apply general rate limiter to all API routes
app.use(generalLimiter);

// Database connection check on startup
(async () => {
    const connected = await db.checkConnection();
    if (!connected) {
        logger.error('Failed to connect to database. Exiting...', { component: 'database' });
        process.exit(1);
    }
    logger.info('Database connection established', { component: 'database' });
})();

// Mount route modules
app.use('/auth', authRoutes);
app.use('/recipes', recipesRoutes);
app.use('/weekplan', weekplanRoutes);
app.use('/shopping', shoppingRoutes);
app.use('/pantry', pantryRoutes);
app.use('/health', healthRoutes);
app.use('/cooking-history', cookingHistoryRoutes);
app.use('/ai', aiRoutes);
app.use('/seasons', seasonsRoutes);
app.use('/admin', adminRoutes);

// Start server with migrations
const startServer = async () => {
    try {
        // Run migrations before starting the server
        await db.runMigrations();

        app.listen(PORT, '0.0.0.0', () => {
            logger.info('Food Planner Backend started', { port: PORT, component: 'server' });
        });
    } catch (error) {
        logger.error('Failed to start server', { error: error.message, component: 'server' });
        process.exit(1);
    }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing database...', { component: 'server' });
    await db.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing database...', { component: 'server' });
    await db.close();
    process.exit(0);
});
