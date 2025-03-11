'use strict';

const express = require('express');
const router = express.Router();
const { validate, Joi, commonSchemas } = require('../middleware/validation.middleware');
const usersController = require('../controllers/users.controller');

// Esquemas de validación
const schemas = {
  listUsers: Joi.object({
    search: Joi.string().trim().max(50).optional(),
    limit: Joi.number().integer().min(1).max(100).default(10).optional()
  })
};

// Endpoint para listar usuarios
router.get('/', validate({ query: schemas.listUsers }), usersController.getUsers);

module.exports = router;