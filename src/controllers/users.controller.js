'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { db } = require('../services/database.service');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este controlador
const logger = createContextLogger('users-controller');

/**
 * @route GET /api/users
 * @description Listar usuarios disponibles (para asignar a organizaciones)
 */
const getUsers = asyncHandler(async (req, res) => {
  const { search, limit = 10 } = req.query;
  logger.info('Obteniendo lista de usuarios');
  
  let query = 'SELECT id, name, email FROM users';
  const params = [];
  
  if (search) {
    query += ' WHERE name ILIKE $1 OR email ILIKE $1';
    params.push(`%${search}%`);
  }
  
  query += ' ORDER BY name LIMIT $' + (params.length + 1);
  params.push(parseInt(limit, 10));
  
  const users = await db.query(query, params);
  
  res.json(users);
});

module.exports = {
  getUsers
};