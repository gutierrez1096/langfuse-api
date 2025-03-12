'use strict';

const express = require('express');
const router = express.Router();
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const apiKeysController = require('../controllers/api-keys.controller');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../services/database.service');

// Esquemas de validación
const schemas = {
  idParam: Joi.object({
    id: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de API key es requerido'
      }),
  }),
  
  createApiKey: Joi.object({
    note: Joi.string().trim().allow('').max(255).optional()
      .messages({
        'string.max': 'La nota no puede exceder {#limit} caracteres'
      }),
    expiresAt: Joi.date().iso().min('now').optional()
      .messages({
        'date.base': 'Fecha de expiración inválida',
        'date.min': 'La fecha de expiración debe ser futura'
      })
  }),
  
  regenerateApiKey: Joi.object({
    expiresAt: Joi.date().iso().min('now').allow(null).optional()
      .messages({
        'date.base': 'Fecha de expiración inválida',
        'date.min': 'La fecha de expiración debe ser futura'
      })
  }),
  
  updateExpiration: Joi.object({
    expiresAt: Joi.date().iso().min('now').allow(null).required()
      .messages({
        'date.base': 'Fecha de expiración inválida',
        'date.min': 'La fecha de expiración debe ser futura',
        'any.required': 'La fecha de expiración es requerida'
      })
  }),
  
  updateNote: Joi.object({
    note: Joi.string().trim().allow('').max(255).required()
      .messages({
        'string.max': 'La nota no puede exceder {#limit} caracteres',
        'any.required': 'La nota es requerida'
      })
  })
};

// Middleware para verificar que una API key existe
const checkApiKeyExists = async (req, res, next) => {
  try {
    const { id } = req.params;
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
};

// Rutas específicas para API keys
router.get('/expired', apiKeysController.getExpiredApiKeys);
router.delete('/expired', apiKeysController.cleanupExpiredApiKeys);

// Rutas para obtener/eliminar/actualizar API keys específicas
router.get('/:id', 
  validate({ params: schemas.idParam }),
  apiKeysController.getApiKeyById
);

router.post('/:id/regenerate', 
  validate({ params: schemas.idParam, body: schemas.regenerateApiKey }),
  checkApiKeyExists,
  apiKeysController.regenerateApiKey
);

router.put('/:id/expiration', 
  validate({ params: schemas.idParam, body: schemas.updateExpiration }),
  checkApiKeyExists,
  apiKeysController.updateApiKeyExpiration
);

router.put('/:id/note', 
  validate({ params: schemas.idParam, body: schemas.updateNote }),
  checkApiKeyExists,
  apiKeysController.updateApiKeyNote
);

router.delete('/:id', 
  validate({ params: schemas.idParam }),
  checkApiKeyExists,
  apiKeysController.deleteApiKey
);

module.exports = router;