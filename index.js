#!/usr/bin/env node
'use strict';

// Carga de variables de entorno antes de cualquier importación
require('dotenv').config();

// Importar módulos
const app = require('./src/app');
const config = require('./src/config');
const { logger } = require('./src/utils/logger');
const { db } = require('./src/services/database.service');

// Logging de variables de entorno (excluyendo datos sensibles)
logger.info('Starting application with configuration', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3100,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME || 'postgres',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_SSL: process.env.DB_SSL || false,
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  ENABLE_API_KEY_AUTH: process.env.ENABLE_API_KEY_AUTH || true,
  ENABLE_DOCS: process.env.ENABLE_DOCS || true,
});

// Gestión de errores no capturados
process.on('uncaughtException', (error) => {
  logger.error('Error no capturado:', error);
  // En producción, podríamos querer reiniciar el proceso con PM2 o similar
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Promesa rechazada no manejada:', reason);
  // No cerramos el proceso aquí, solo registramos
});

// Función para iniciar el servidor
async function startServer() {
  try {
    // Iniciar el servidor
    const server = app.listen(config.port, () => {
      logger.info(`
🚀 Langfuse Admin API ejecutándose en puerto ${config.port}

📝 Documentación: http://localhost:${config.port}/api-docs
🔍 Estado: http://localhost:${config.port}/api/health
🔍 Ping (sin BD): http://localhost:${config.port}/api/ping

Esta API está diseñada para uso administrativo y ofrece autenticación mediante API keys.
      `);
    });

    // Gestión de señales del sistema operativo
    const shutdown = async (signal) => {
      logger.info(`${signal} recibido. Cerrando servidor HTTP y conexiones a base de datos...`);
      
      // Intentar cerrar la conexión de BD primero
      try {
        await db.close();
        logger.info('Conexiones de base de datos cerradas correctamente.');
      } catch (err) {
        logger.warn('Error al cerrar conexiones de base de datos:', err);
      }
      
      // Luego cerrar el servidor HTTP
      server.close(() => {
        logger.info('Servidor HTTP cerrado.');
        process.exit(0);
      });

      // Timeout forzado por si no cierra correctamente
      setTimeout(() => {
        logger.error('No se pudo cerrar correctamente, forzando salida.');
        process.exit(1);
      }, 10000);
    };

    // Registro de manejadores de señal
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();