'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { NotFoundError } = require('../utils/errors');
const apiKeysService = require('../services/api-keys.service');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este controlador
const logger = createContextLogger('api-keys-controller');

/**
 * @route GET /api/projects/:id/api-keys
 * @description Listar todas las API keys de un proyecto
 */
const getProjectApiKeys = asyncHandler(async (req, res) => {
  const { id: projectId } = req.params;
  logger.info(`Obteniendo API keys para proyecto: ${projectId}`);
  
  const apiKeys = await apiKeysService.getByProject(projectId);
  
  res.json(apiKeys);
});

/**
 * @route GET /api/api-keys/:id
 * @description Obtener detalles de una API key
 */
const getApiKeyById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Obteniendo detalles de API key: ${id}`);
  
  const apiKey = await apiKeysService.getById(id);
  
  res.json(apiKey);
});

/**
 * @route POST /api/projects/:id/api-keys
 * @description Crear una nueva API key para un proyecto
 */
const createApiKey = asyncHandler(async (req, res) => {
  const { id: projectId } = req.params;
  const { note, expiresAt } = req.body;
  logger.info(`Creando nueva API key para proyecto: ${projectId}`);
  
  const newApiKey = await apiKeysService.create(projectId, { note, expiresAt });
  
  res.status(201).json(newApiKey);
});

/**
 * @route POST /api/api-keys/:id/regenerate
 * @description Regenerar una API key existente
 */
const regenerateApiKey = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expiresAt } = req.body;
  logger.info(`Regenerando API key: ${id}`);
  
  const regeneratedApiKey = await apiKeysService.regenerate(id, { expiresAt });
  
  res.json(regeneratedApiKey);
});

/**
 * @route PUT /api/api-keys/:id/expiration
 * @description Actualizar la fecha de expiración de una API key
 */
const updateApiKeyExpiration = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expiresAt } = req.body;
  logger.info(`Actualizando expiración de API key: ${id}`);
  
  const apiKey = await apiKeysService.updateExpiration(id, expiresAt);
  
  res.json(apiKey);
});

/**
 * @route PUT /api/api-keys/:id/note
 * @description Actualizar la nota de una API key
 */
const updateApiKeyNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  logger.info(`Actualizando nota de API key: ${id}`);
  
  const apiKey = await apiKeysService.updateNote(id, note);
  
  res.json(apiKey);
});

/**
 * @route DELETE /api/api-keys/:id
 * @description Eliminar una API key
 */
const deleteApiKey = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Eliminando API key: ${id}`);
  
  await apiKeysService.delete(id);
  
  res.json({ message: 'API key eliminada correctamente' });
});

/**
 * @route GET /api/api-keys/expired
 * @description Listar todas las API keys expiradas
 */
const getExpiredApiKeys = asyncHandler(async (req, res) => {
  logger.info('Obteniendo API keys expiradas');
  
  const expiredKeys = await apiKeysService.getExpired();
  
  res.json(expiredKeys);
});

/**
 * @route DELETE /api/api-keys/expired
 * @description Eliminar todas las API keys expiradas
 */
const cleanupExpiredApiKeys = asyncHandler(async (req, res) => {
  logger.info('Eliminando API keys expiradas');
  
  const count = await apiKeysService.cleanupExpired();
  
  res.json({ 
    message: `${count} API keys expiradas eliminadas correctamente`,
    count
  });
});

module.exports = {
  getProjectApiKeys,
  getApiKeyById,
  createApiKey,
  deleteApiKey,
  regenerateApiKey,
  updateApiKeyExpiration,
  updateApiKeyNote,
  getExpiredApiKeys,
  cleanupExpiredApiKeys
};