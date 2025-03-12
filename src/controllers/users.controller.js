'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { NotFoundError } = require('../utils/errors');
const { db } = require('../services/database.service');
const { createContextLogger } = require('../utils/logger');
const usersService = require('../services/users.service');

// Logger contextual para este controlador
const logger = createContextLogger('users-controller');

/**
 * @route GET /api/users
 * @description Listar usuarios disponibles (para asignar a organizaciones)
 */
const getUsers = asyncHandler(async (req, res) => {
  const { search, limit = 10, page = 1 } = req.query;
  logger.info('Obteniendo lista de usuarios');
  
  const users = await usersService.getAll({ search, limit, page });
  
  res.json(users);
});

/**
 * @route GET /api/users/:id
 * @description Obtener detalles de un usuario específico
 */
const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Obteniendo usuario con ID: ${id}`);
  
  const user = await usersService.getById(id);
  
  if (!user) {
    throw new NotFoundError('Usuario');
  }
  
  res.json(user);
});

/**
 * @route POST /api/users
 * @description Crear un nuevo usuario
 */
const createUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  logger.info(`Creando nuevo usuario: ${email}`);
  
  const newUser = await usersService.create({ 
    name, 
    email, 
    password
  });
  
  res.status(201).json(newUser);
});

/**
 * @route PUT /api/users/:id
 * @description Actualizar un usuario existente
 */
const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, email, image, feature_flags, admin } = req.body;
  logger.info(`Actualizando usuario con ID: ${id}`);
  
  const updatedUser = await usersService.update(id, { 
    name, 
    email, 
    image, 
    feature_flags, 
    admin 
  });
  
  if (!updatedUser) {
    throw new NotFoundError('Usuario');
  }
  
  res.json(updatedUser);
});

/**
 * @route DELETE /api/users/:id
 * @description Eliminar un usuario (verificando dependencias)
 */
const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Eliminando usuario con ID: ${id}`);
  
  await usersService.delete(id);
  
  res.json({ message: 'Usuario eliminado correctamente' });
});

module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};