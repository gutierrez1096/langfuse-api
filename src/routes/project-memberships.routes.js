'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true }); // Para acceder a projectId de la ruta padre
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const projectMembershipsController = require('../controllers/project-memberships.controller');

// Esquemas de validación
const schemas = {
  projectIdParam: Joi.object({
    projectId: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de proyecto es requerido'
      }),
  }),
  
  userIdParam: Joi.object({
    userId: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de usuario es requerido'
      }),
  }),
  
  addMember: Joi.object({
    userId: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de usuario es requerido'
      }),
    role: Joi.string().valid('OWNER', 'ADMIN', 'MEMBER', 'VIEWER').default('VIEWER')
      .messages({
        'any.only': 'Rol inválido. Debe ser OWNER, ADMIN, MEMBER o VIEWER'
      }),
  }),
  
  updateMember: Joi.object({
    role: Joi.string().valid('OWNER', 'ADMIN', 'MEMBER', 'VIEWER').required()
      .messages({
        'any.required': 'El rol es requerido',
        'any.only': 'Rol inválido. Debe ser OWNER, ADMIN, MEMBER o VIEWER'
      }),
  }),
  
  batchAddMembers: Joi.object({
    members: Joi.array().items(
      Joi.object({
        userId: commonSchemas.id.required()
          .messages({
            'any.required': 'El ID de usuario es requerido para cada miembro'
          }),
        role: Joi.string().valid('OWNER', 'ADMIN', 'MEMBER', 'VIEWER').default('VIEWER')
          .messages({
            'any.only': 'Rol inválido. Debe ser OWNER, ADMIN, MEMBER o VIEWER'
          }),
      })
    ).min(1).required()
      .messages({
        'array.min': 'Se requiere al menos un miembro',
        'any.required': 'El array de miembros es requerido'
      }),
  }),
};

// Obtener todos los miembros de un proyecto
router.get('/', 
  validate({ params: schemas.projectIdParam }), 
  projectMembershipsController.getProjectMembers
);

// Añadir un miembro a un proyecto
router.post('/', 
  validate({ params: schemas.projectIdParam, body: schemas.addMember }), 
  projectMembershipsController.addProjectMember
);

// Añadir múltiples miembros a un proyecto
router.post('/batch', 
  validate({ params: schemas.projectIdParam, body: schemas.batchAddMembers }), 
  projectMembershipsController.addBatchProjectMembers
);

// Obtener un miembro específico
router.get('/:userId', 
  validate({ params: Joi.object().keys({
    ...schemas.projectIdParam.keys,
    ...schemas.userIdParam.keys
  })}), 
  projectMembershipsController.getProjectMember
);

// Actualizar rol de un miembro
router.put('/:userId', 
  validate({ 
    params: Joi.object().keys({
      ...schemas.projectIdParam.keys,
      ...schemas.userIdParam.keys
    }),
    body: schemas.updateMember 
  }), 
  projectMembershipsController.updateProjectMember
);

// Eliminar un miembro
router.delete('/:userId', 
  validate({ params: Joi.object().keys({
    ...schemas.projectIdParam.keys,
    ...schemas.userIdParam.keys
  })}), 
  projectMembershipsController.removeProjectMember
);

module.exports = router;