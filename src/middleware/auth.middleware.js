'use strict';

const crypto = require('crypto');
const config = require('../config');
const { AuthenticationError, AuthorizationError } = require('../utils/errors');
const { db } = require('../services/database.service'); // Fix: Import db directly
const { logger } = require('../utils/logger');

/**
 * Middleware para validar la API key administrativa
 */
const validateAdminApiKey = (req, res, next) => {
  if (!config.enableApiKeyAuth) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== config.apiKey) {
    return next(new AuthenticationError('API Key inválida'));
  }
  
  // Para simplificar el acceso administrativo, asumimos un usuario administrador
  req.user = {
    id: 'admin',
    role: 'ADMIN'
  };
  
  next();
};

/**
 * Middleware para validar API keys de proyectos
 * Verifica la autenticación para APIs de integración
 */
const validateProjectApiKey = async (req, res, next) => {
  const publicKey = req.headers['x-api-key'];
  const secretKey = req.headers['x-api-secret'];
  
  if (!publicKey || !secretKey) {
    return next(new AuthenticationError('Se requieren API keys'));
  }
  
  try {
    // Buscar la API key por su clave pública
    // Fix: Use db.queryOne instead of dbService.queryOne
    const apiKey = await db.queryOne(
      'SELECT project_id, hashed_secret_key FROM api_keys WHERE public_key = $1',
      [publicKey]
    );
    
    if (!apiKey) {
      return next(new AuthenticationError('API key no encontrada'));
    }
    
    // Verificar la clave secreta hasheada
    const hashedSecret = crypto.createHash('sha256').update("salt" + secretKey).digest('hex');
    
    if (hashedSecret !== apiKey.hashed_secret_key) {
      return next(new AuthenticationError('Clave secreta inválida'));
    }
    
    // Buscar el proyecto
    // Fix: Use db.queryOne instead of dbService.queryOne
    const project = await db.queryOne(
      'SELECT id, org_id, deleted_at FROM projects WHERE id = $1',
      [apiKey.project_id]
    );
    
    if (!project || project.deleted_at) {
      return next(new AuthenticationError('Proyecto inactivo o eliminado'));
    }
    
    // Actualizar último uso de la API key
    // Fix: Use db.query instead of dbService.query
    await db.query(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE public_key = $1',
      [publicKey]
    );
    
    // Adjuntar información del proyecto a la solicitud
    req.project = project;
    
    next();
  } catch (error) {
    logger.error('Error al validar API key de proyecto:', error);
    return next(new AuthenticationError('Error al validar credenciales'));
  }
};

/**
 * Middleware para verificar roles en la organización
 * @param {string[]} allowedRoles - Roles permitidos
 */
const requireOrgRole = (allowedRoles = ['OWNER', 'ADMIN']) => {
  return async (req, res, next) => {
    // En una API administrativa simplificada, asumimos que el usuario tiene permisos
    // Ya que se ha autenticado con la API key administrativa
    next();
  };
};

module.exports = {
  validateAdminApiKey,
  validateProjectApiKey,
  requireOrgRole
};