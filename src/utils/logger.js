'use strict';

const winston = require('winston');
const config = require('../config');

/**
 * Configuración del formato de log según el entorno
 */
const formats = {
  // Formato para desarrollo: colorizado y más legible
  development: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      let metaStr = '';
      if (Object.keys(meta).length > 0) {
        // Mostrar metadatos en formato más simple sin profundidad excesiva
        metaStr = JSON.stringify(meta, null, 0).replace(/[{}"']/g, '').replace(/,/g, ', ');
        metaStr = metaStr ? ` - ${metaStr}` : '';
      }
      return `[${timestamp}] ${level}: ${message}${metaStr}`;
    })
  ),
  
  // Formato para producción: JSON estructurado para mejor análisis
  production: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  
  // Formato para tests: minimal
  test: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  )
};

/**
 * Crear el logger con la configuración adecuada según entorno
 */
const logger = winston.createLogger({
  level: config.logLevel || 'info',
  format: formats[config.nodeEnv] || formats.development,
  defaultMeta: { service: 'langfuse-admin-api' },
  transports: [
    // En test no hacemos log a consola a menos que sea error
    ...(config.isTest
      ? [
          new winston.transports.Console({
            level: 'error'
          })
        ]
      : [
          new winston.transports.Console()
        ]),
    
    // En producción agregamos log a archivo de errores
    ...(config.isProduction
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
          })
        ]
      : [])
  ],
  
  // No detener la aplicación si hay error de log
  exitOnError: false
});

/**
 * Utilidades para logging contextual
 */
const createContextLogger = (context) => {
  return {
    debug: (message, meta = {}) => logger.debug(message, { ...meta, context }),
    info: (message, meta = {}) => logger.info(message, { ...meta, context }),
    warn: (message, meta = {}) => logger.warn(message, { ...meta, context }),
    error: (message, meta = {}) => logger.error(message, { ...meta, context }),
  };
};

module.exports = {
  logger,
  createContextLogger
};