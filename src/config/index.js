'use strict';

/**
 * Configuración centralizada de la aplicación
 * Facilita la gestión de variables de entorno y valores por defecto
 */

// Importar configuración específica de componentes
const database = require('./database');

// Normalización de variables de entorno
const env = (key, defaultValue = undefined) => {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue === undefined) {
      throw new Error(`Variable de entorno ${key} no definida`);
    }
    return defaultValue;
  }
  return value;
};

// Normalización de variables booleanas
const boolEnv = (key, defaultValue = undefined) => {
  const value = env(key, defaultValue);
  return value === 'true' || value === '1' || value === 'yes';
};

// Normalización de variables numéricas
const numEnv = (key, defaultValue = undefined) => {
  const value = env(key, defaultValue);
  return Number(value);
};

// Configuración general de la aplicación
const config = {
  // Entorno
  nodeEnv: env('NODE_ENV', 'development'),
  isProduction: env('NODE_ENV', 'development') === 'production',
  isDevelopment: env('NODE_ENV', 'development') === 'development',
  isTest: env('NODE_ENV', 'development') === 'test',

  // Servidor HTTP
  port: numEnv('PORT', 3100),
  host: env('HOST', '0.0.0.0'),
  
  // Seguridad
  apiKey: env('API_KEY', 'admin-secret-key'),
  enableApiKeyAuth: boolEnv('ENABLE_API_KEY_AUTH', true),
  
  // Logging
  logLevel: env('LOG_LEVEL', 'info'),
  enableRequestLogging: boolEnv('ENABLE_REQUEST_LOGGING', true),

  // CORS
  corsOrigin: env('CORS_ORIGIN', '*'),
  
  // Rate limiting
  rateLimit: {
    windowMs: numEnv('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15 minutos
    max: numEnv('RATE_LIMIT_MAX', 100), // Máximo de solicitudes por IP
  },
  
  // Documentación
  enableDocs: boolEnv('ENABLE_DOCS', true),

  // Base de datos
  db: database,
};

module.exports = config;