'use strict';

const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const config = require('../config');

/**
 * Middleware para logging estructurado de solicitudes HTTP
 * Asigna un ID único a cada solicitud para seguimiento
 */
const requestLogger = (req, res, next) => {
  // Omitir logging en test o si está desactivado
  if (config.isTest || !config.enableRequestLogging) {
    return next();
  }
  
  // Generar un ID único para la solicitud
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  
  // Capturar tiempo de inicio
  const start = Date.now();
  
  // Registrar datos de la solicitud
  const logData = {
    id: req.id,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent') || 'unknown',
  };
  
  // Log de la solicitud de entrada
  logger.info(`Solicitud recibida: ${req.method} ${req.originalUrl}`, logData);
  
  // Capturar cuando finalice la respuesta
  res.on('finish', () => {
    // Calcular duración
    const duration = Date.now() - start;
    
    // Añadir datos de respuesta
    logData.statusCode = res.statusCode;
    logData.duration = duration;
    
    // Nivel de log según el código de estado
    const message = `Respuesta: ${res.statusCode} ${req.method} ${req.originalUrl} (${duration}ms)`;
    
    if (res.statusCode >= 500) {
      logger.error(message, logData);
    } else if (res.statusCode >= 400) {
      logger.warn(message, logData);
    } else {
      logger.info(message, logData);
    }
  });
  
  next();
};

module.exports = {
  requestLogger
};