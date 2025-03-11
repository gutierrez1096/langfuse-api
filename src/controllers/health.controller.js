'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { db } = require('../services/database.service');
const { createContextLogger } = require('../utils/logger');
const packageInfo = require('../../package.json');

// Logger contextual para este controlador
const logger = createContextLogger('health-controller');

/**
 * @route GET /api/health
 * @description Verificar estado del servicio y conexión a la base de datos
 */
const checkHealth = asyncHandler(async (req, res) => {
  logger.debug('Verificando estado del servicio');
  
  // Estado general del servicio
  const healthCheck = {
    status: 'ok',
    timestamp: new Date(),
    uptime: Math.floor(process.uptime()),
    service: packageInfo.name,
    version: packageInfo.version,
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
  };
  
  // Verificar base de datos
  try {
    // Use the checkConnection method from the database service
    const dbStatus = await db.checkConnection();
    
    if (dbStatus.status === 'connected') {
      healthCheck.db = {
        status: 'connected',
        time: dbStatus.time,
      };
    } else {
      healthCheck.db = {
        status: 'error',
        error: process.env.NODE_ENV === 'production' 
          ? 'Error de conexión' 
          : dbStatus.error,
        code: dbStatus.code
      };
      healthCheck.status = 'error';
      
      logger.error('Error al verificar base de datos:', dbStatus);
      return res.status(503).json(healthCheck);
    }
  } catch (error) {
    logger.error('Error al verificar base de datos:', error);
    healthCheck.db = {
      status: 'error',
      error: process.env.NODE_ENV === 'production' 
        ? 'Error de conexión' 
        : error.message,
      code: error.code
    };
    healthCheck.status = 'error';
    
    // En caso de error en BD, respondemos con código 503
    return res.status(503).json(healthCheck);
  }
  
  // Agregar información de sistema (no exponer en producción)
  if (process.env.NODE_ENV !== 'production') {
    healthCheck.system = {
      nodeVersion: process.version,
      platform: process.platform,
      cpuUsage: process.cpuUsage(),
    };
  }
  
  // Responder con estado completo
  res.json(healthCheck);
});

/**
 * @route GET /api/health/db
 * @description Verificar solo el estado de la base de datos
 */
const checkDatabaseHealth = asyncHandler(async (req, res) => {
  logger.debug('Verificando estado de la base de datos');
  
  try {
    // Use the checkConnection method from the database service
    const dbStatus = await db.checkConnection();
    
    if (dbStatus.status === 'connected') {
      res.json({
        status: 'ok',
        time: dbStatus.time,
        responseTime: dbStatus.responseTime || 'N/A',
      });
    } else {
      logger.error('Error al verificar base de datos:', dbStatus);
      
      res.status(503).json({
        status: 'error',
        message: 'Error de conexión a la base de datos',
        error: process.env.NODE_ENV === 'production' ? undefined : dbStatus.error,
        code: dbStatus.code
      });
    }
  } catch (error) {
    logger.error('Error al verificar base de datos:', error);
    
    res.status(503).json({
      status: 'error',
      message: 'Error de conexión a la base de datos',
      error: process.env.NODE_ENV === 'production' ? undefined : error.message,
      code: error.code
    });
  }
});

module.exports = {
  checkHealth,
  checkDatabaseHealth
};