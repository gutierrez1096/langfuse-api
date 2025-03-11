'use strict';

const express = require('express');
const router = express.Router();
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const { requireOrgRole } = require('../middleware/auth.middleware');
const organizationsController = require('../controllers/organizations.controller');

// Esquemas de validación
const schemas = {
  idParam: Joi.object({
    id: commonSchemas.id.required(),
  }),
  
  orgIdUserIdParams: Joi.object({
    orgId: commonSchemas.id.required(),
    userId: commonSchemas.id.required(),
  }),
  
  createOrg: Joi.object({
    name: Joi.string().trim().min(1).max(100).required()
      .messages({
        'string.empty': 'El nombre de la organización no puede estar vacío',
        'string.min': 'El nombre debe tener al menos {#limit} caracteres',
        'string.max': 'El nombre no puede exceder {#limit} caracteres',
        'any.required': 'El nombre es requerido'
      }),
    userId: Joi.string().required()
      .messages({
        'string.base': 'El ID de usuario debe ser una cadena de texto',
        'any.required': 'El ID de usuario es obligatorio'
      }),
  }),
  
  updateOrg: Joi.object({
    name: Joi.string().trim().min(1).max(100).required()
      .messages({
        'string.empty': 'El nombre de la organización no puede estar vacío',
        'string.min': 'El nombre debe tener al menos {#limit} caracteres',
        'string.max': 'El nombre no puede exceder {#limit} caracteres',
        'any.required': 'El nombre es requerido'
      }),
  }),
  
  addMember: Joi.object({
    userId: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de usuario es requerido'
      }),
    role: commonSchemas.orgRole.default('VIEWER')
      .messages({
        'any.only': 'Rol inválido. Debe ser OWNER, ADMIN, VIEWER o NONE'
      }),
  }),
  
  updateMember: Joi.object({
    role: commonSchemas.orgRole.required()
      .messages({
        'any.required': 'El rol es requerido',
        'any.only': 'Rol inválido. Debe ser OWNER, ADMIN, VIEWER o NONE'
      }),
  })
};

// Endpoints (ya protegidos por la API key administrativa en routes/index.js)
router.get('/', organizationsController.getAllOrganizations);
router.get('/:id', validate({ params: schemas.idParam }), organizationsController.getOrganizationById);
router.post('/', validate({ body: schemas.createOrg }), organizationsController.createOrganization);

// Endpoints que requieren permisos específicos
router.put('/:id', 
  validate({ params: schemas.idParam, body: schemas.updateOrg }), 
  organizationsController.updateOrganization
);

// Endpoints para gestión de miembros
router.get('/:id/members', 
  validate({ params: schemas.idParam }), 
  organizationsController.getOrganizationMembers
);

router.post('/:id/members', 
  validate({ params: schemas.idParam, body: schemas.addMember }), 
  organizationsController.addOrganizationMember
);

router.put('/:orgId/members/:userId', 
  validate({ params: schemas.orgIdUserIdParams, body: schemas.updateMember }), 
  organizationsController.updateOrganizationMember
);

router.delete('/:orgId/members/:userId', 
  validate({ params: schemas.orgIdUserIdParams }), 
  organizationsController.removeOrganizationMember
);

module.exports = router;