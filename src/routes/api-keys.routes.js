'use strict';

const express = require('express');
const router = express.Router();
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const apiKeysController = require('../controllers/api-keys.controller');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../services/database.service'); // Fix: Import db directly

// Esquemas de validación
const schemas = {
  idParam: Joi.object({
    id: commonSchemas.id.required(),
  }),
  
  createApiKey: Joi.object({
    note: Joi.string().trim().allow('').max(255).optional()
      .messages({
        'string.max': 'La nota no puede exceder {#limit} caracteres'
      }),
  }),
};

// Ruta para obtener detalles de una API key
router.get('/:id', 
  validate({ params: schemas.idParam }),
  apiKeysController.getApiKeyById
);

// Ruta para regenerar una API key
router.post('/:id/regenerate', 
  validate({ params: schemas.idParam }),
  // Verificar que la API key existe
  async (req, res, next) => {
    try {
      const { id } = req.params;
      // Fix: Use db.queryOne instead of dbService.queryOne
      const apiKeyInfo = await db.queryOne(
        `SELECT ak.id 
         FROM api_keys ak
         JOIN projects p ON ak.project_id = p.id 
         WHERE ak.id = $1 AND p.deleted_at IS NULL`,
        [id]
      );
      
      if (!apiKeyInfo) {
        throw new NotFoundError('API key');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  },
  apiKeysController.regenerateApiKey
);

// Ruta para eliminar una API key
router.delete('/:id', 
  validate({ params: schemas.idParam }),
  // Verificar que la API key existe
  async (req, res, next) => {
    try {
      const { id } = req.params;
      // Fix: Use db.queryOne instead of dbService.queryOne
      const apiKeyInfo = await db.queryOne(
        `SELECT ak.id 
         FROM api_keys ak
         JOIN projects p ON ak.project_id = p.id 
         WHERE ak.id = $1 AND p.deleted_at IS NULL`,
        [id]
      );
      
      if (!apiKeyInfo) {
        throw new NotFoundError('API key');
      }
      
      next();
    } catch (error) {
      next(error);
    }
  },
  apiKeysController.deleteApiKey
);

module.exports = router;