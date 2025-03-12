'use strict';

const express = require('express');
const router = express.Router();
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const usersController = require('../controllers/users.controller');

// Esquemas de validación
const schemas = {
  listUsers: Joi.object({
    search: Joi.string().trim().max(50).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional(),
    page: Joi.number().integer().min(1).default(1).optional()
  }),
  
  idParam: Joi.object({
    id: commonSchemas.id.required()
      .messages({
        'any.required': 'El ID de usuario es requerido'
      }),
  }),
  
  createUser: Joi.object({
    name: Joi.string().trim().min(2).max(100).required()
      .messages({
        'string.empty': 'El nombre no puede estar vacío',
        'string.min': 'El nombre debe tener al menos {#limit} caracteres',
        'string.max': 'El nombre no puede exceder {#limit} caracteres',
        'any.required': 'El nombre es requerido'
      }),
    email: commonSchemas.email.required()
      .messages({
        'string.email': 'El email debe tener un formato válido',
        'any.required': 'El email es requerido'
      }),
    password: Joi.string().min(8).max(100).optional()
      .messages({
        'string.min': 'La contraseña debe tener al menos {#limit} caracteres',
        'string.max': 'La contraseña no puede exceder {#limit} caracteres'
      }),
    admin: Joi.boolean().optional()
  }),
  
  updateUser: Joi.object({
    name: Joi.string().trim().min(2).max(100).optional()
      .messages({
        'string.empty': 'El nombre no puede estar vacío',
        'string.min': 'El nombre debe tener al menos {#limit} caracteres',
        'string.max': 'El nombre no puede exceder {#limit} caracteres'
      }),
    email: commonSchemas.email.optional()
      .messages({
        'string.email': 'El email debe tener un formato válido'
      }),
    image: Joi.string().uri().optional()
      .messages({
        'string.uri': 'La URL de la imagen debe ser válida'
      }),
    feature_flags: Joi.array().items(Joi.string()).optional(),
    admin: Joi.boolean().optional()
  })
};

// Endpoint para listar usuarios con paginación y búsqueda
router.get('/', validate({ query: schemas.listUsers }), usersController.getUsers);

// Endpoint para obtener un usuario específico
router.get('/:id', validate({ params: schemas.idParam }), usersController.getUserById);

// Endpoint para crear un nuevo usuario
router.post('/', validate({ body: schemas.createUser }), usersController.createUser);

// Endpoint para actualizar un usuario
router.put('/:id', 
  validate({ params: schemas.idParam, body: schemas.updateUser }), 
  usersController.updateUser
);

// Endpoint para eliminar un usuario
router.delete('/:id', validate({ params: schemas.idParam }), usersController.deleteUser);

module.exports = router;