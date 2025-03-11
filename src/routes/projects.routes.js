'use strict';

const express = require('express');
const router = express.Router();
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const projectsController = require('../controllers/projects.controller');
const apiKeysController = require('../controllers/api-keys.controller');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../services/database.service'); // Fix: Import db directly

// Esquemas de validación
const schemas = {
  idParam: Joi.object({
    id: commonSchemas.id.required(),
  }),
  
  queryOrgId: Joi.object({
    orgId: Joi.string().optional()
      .messages({
        'string.base': 'El ID de organización debe ser una cadena de texto'
      }),
  }),
  
  createProject: Joi.object({
    name: Joi.string().trim().min(1).max(100).required()
      .messages({
        'string.empty': 'El nombre del proyecto no puede estar vacío',
        'string.min': 'El nombre debe tener al menos {#limit} caracteres',
        'string.max': 'El nombre no puede exceder {#limit} caracteres',
        'any.required': 'El nombre es requerido'
      }),
    orgId: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de organización es requerido'
      }),
  }),
  
  updateProject: Joi.object({
    name: Joi.string().trim().min(1).max(100).required()
      .messages({
        'string.empty': 'El nombre del proyecto no puede estar vacío',
        'string.min': 'El nombre debe tener al menos {#limit} caracteres',
        'string.max': 'El nombre no puede exceder {#limit} caracteres',
        'any.required': 'El nombre es requerido'
      }),
  }),
  
  createApiKey: Joi.object({
    note: Joi.string().trim().allow('').max(255).optional()
      .messages({
        'string.max': 'La nota no puede exceder {#limit} caracteres'
      }),
  }),
};

// Middleware para verificar que un proyecto existe
const checkProjectExists = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Fix: Use db.queryOne instead of dbService.queryOne
    const project = await db.queryOne(
      'SELECT org_id FROM projects WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
    
    if (!project) {
      throw new NotFoundError('Proyecto');
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

// Endpoints para proyectos
router.get('/', 
  validate({ query: schemas.queryOrgId }), 
  projectsController.getAllProjects
);

router.get('/:id', 
  validate({ params: schemas.idParam }), 
  projectsController.getProjectById
);

router.post('/', 
  validate({ body: schemas.createProject }), 
  projectsController.createProject
);

router.put('/:id', 
  validate({ params: schemas.idParam, body: schemas.updateProject }), 
  checkProjectExists,
  projectsController.updateProject
);

router.delete('/:id', 
  validate({ params: schemas.idParam }), 
  checkProjectExists,
  projectsController.deleteProject
);

// Rutas para API keys de proyectos
router.get('/:id/api-keys',
  validate({ params: schemas.idParam }),
  checkProjectExists,
  apiKeysController.getProjectApiKeys
);

router.post('/:id/api-keys',
  validate({ params: schemas.idParam, body: schemas.createApiKey }),
  checkProjectExists,
  apiKeysController.createApiKey
);

module.exports = router;