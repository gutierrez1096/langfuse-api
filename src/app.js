'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');
const { errorHandler } = require('./middleware/error.middleware');
const { requestLogger } = require('./middleware/request.middleware');
const routes = require('./routes');
const config = require('./config');
const { logger } = require('./utils/logger');
const ConfigChecker = require('./utils/config-checker');
const { db } = require('./services/database.service');

// Crear instancia de Express
const app = express();

// Validate configuration
ConfigChecker.validateAppConfig(config);

// Middlewares de seguridad y optimización
app.use(helmet()); // Seguridad mediante cabeceras HTTP
app.use(compression()); // Compresión gzip
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Rate limiting para prevenir abusos
if (process.env.NODE_ENV === 'production') {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Límite de 100 solicitudes
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, por favor intente más tarde' }
  }));
}

// Middlewares para parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging de solicitudes
app.use(requestLogger);

// Documentación API con Swagger
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_DOCS === 'true') {
  const swaggerDocument = YAML.load(path.join(__dirname, '../docs/openapi.yaml'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
}

// Test endpoint for basic connectivity check (without DB)
app.get('/api/ping', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date(),
    message: 'API server is running'
  });
});

// Rutas API
app.use('/api', routes);

// Página de documentación básica
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Error 404 para rutas no definidas
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Manejador de errores global
app.use(errorHandler);

// Initialize the application
const initApp = async () => {
  try {
    // Check database connection at startup
    const dbStatus = await db.checkConnection();
    if (dbStatus.status === 'connected') {
      logger.info('Database connection successful on startup');
    } else {
      logger.warn('Database connection check failed on startup', {
        error: dbStatus.error,
        code: dbStatus.code
      });
      
      // We don't fail startup if DB connection fails - the app can still serve API documentation
      // and other endpoints that don't require DB access, like /api/ping
    }
  } catch (error) {
    logger.error('Error during application initialization', {
      error: error.message,
      stack: error.stack
    });
  }
};

// Execute initialization
initApp().catch(err => {
  logger.error('Unexpected error during initialization', err);
});

module.exports = app;