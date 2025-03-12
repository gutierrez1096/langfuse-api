'use strict';

const { db, transaction } = require('./database.service');
const { generateId } = require('../utils/id-generator');
const { NotFoundError, ConflictError, BusinessLogicError } = require('../utils/errors');
const { createContextLogger } = require('../utils/logger');
const crypto = require('crypto');

// Logger contextual para este servicio
const logger = createContextLogger('users-service');

/**
 * Servicio para manejar operaciones relacionadas con usuarios
 */
class UsersService {
  /**
   * Obtiene todos los usuarios con paginación y búsqueda
   * @param {Object} options - Opciones de filtrado
   * @param {string} options.search - Término de búsqueda para nombre o email
   * @param {number} options.limit - Límite de resultados por página
   * @param {number} options.page - Número de página
   * @returns {Promise<Array>} Lista de usuarios
   */
  async getAll({ search, limit = 10, page = 1 }) {
    const offset = (page - 1) * limit;
    let queryText = `
      SELECT id, name, email, image, created_at, admin, 
             feature_flags, email_verified
      FROM users
    `;
    const params = [];
    
    if (search) {
      queryText += ` WHERE name ILIKE $1 OR email ILIKE $1`;
      params.push(`%${search}%`);
    }
    
    queryText += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit, 10), offset);
    
    const users = await db.query(queryText, params);
    
    // Obtener conteo total para paginación
    let countQuery = 'SELECT COUNT(*) FROM users';
    if (search) {
      countQuery += ` WHERE name ILIKE $1 OR email ILIKE $1`;
    }
    
    const totalCount = await db.queryOne(countQuery, search ? [`%${search}%`] : []);
    
    return {
      users,
      pagination: {
        total: parseInt(totalCount.count, 10),
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        pages: Math.ceil(parseInt(totalCount.count, 10) / limit)
      }
    };
  }

  /**
   * Obtiene un usuario por su ID
   * @param {string} id - ID del usuario
   * @returns {Promise<Object|null>} Usuario o null si no existe
   */
  async getById(id) {
    const user = await db.queryOne(
      `SELECT id, name, email, image, created_at, updated_at, 
              admin, feature_flags, email_verified
       FROM users 
       WHERE id = $1`,
      [id]
    );
    
    return user;
  }

  /**
   * Crea un nuevo usuario
   * @param {Object} data - Datos del usuario
   * @param {string} data.name - Nombre
   * @param {string} data.email - Email
   * @param {string} data.password - Contraseña (opcional)
   * @returns {Promise<Object>} Usuario creado
   */
  async create({ name, email, password = null }) {
    if (!email) {
      throw new BusinessLogicError('El email es requerido');
    }
    
    return transaction(async (client) => {
      // Verificar si el email ya está en uso
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      
      if (existingUser.rows.length > 0) {
        throw new ConflictError('El email ya está en uso');
      }
      
      // Hashear contraseña si se proporciona
      let hashedPassword = null;
      if (password) {
        // En producción, usar bcrypt o similar
        hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
      }
      
      // Generar ID único
      const id = generateId('usr');
      
      // Insertar usuario
      const result = await client.query(
        `INSERT INTO users (
          id, name, email, password, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id, name, email, created_at, updated_at`,
        [id, name, email, hashedPassword]
      );
      
      logger.info(`Usuario creado con ID: ${id}`);
      return result.rows[0];
    });
  }

  /**
   * Actualiza un usuario existente
   * @param {string} id - ID del usuario
   * @param {Object} data - Datos a actualizar
   * @returns {Promise<Object|null>} Usuario actualizado o null
   */
  async update(id, { name, email, image, feature_flags, admin = false }) {
    const updateFields = [];
    const params = [id];
    let paramIndex = 2;
    
    // Construir query dinámicamente según los campos proporcionados
    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      params.push(name);
    }
    
    if (email !== undefined) {
      updateFields.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    
    if (image !== undefined) {
      updateFields.push(`image = $${paramIndex++}`);
      params.push(image);
    }
    
    if (feature_flags !== undefined) {
      updateFields.push(`feature_flags = $${paramIndex++}`);
      params.push(Array.isArray(feature_flags) ? feature_flags : []);
    }
    
    if (admin !== undefined) {
      updateFields.push(`admin = $${paramIndex++}`);
      params.push(Boolean(admin));
    }
    
    // Siempre actualizar el timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    if (updateFields.length === 1) {
      // Solo se actualizó el timestamp
      throw new BusinessLogicError('No hay campos para actualizar');
    }
    
    const query = `
      UPDATE users 
      SET ${updateFields.join(', ')} 
      WHERE id = $1 
      RETURNING id, name, email, image, created_at, updated_at, admin, feature_flags
    `;
    
    const result = await db.query(query, params);
    
    if (result.length === 0) {
      return null;
    }
    
    logger.info(`Usuario actualizado: ${id}`);
    return result[0];
  }

  /**
   * Elimina un usuario verificando dependencias
   * @param {string} id - ID del usuario
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async delete(id) {
    return transaction(async (client) => {
      // Verificar si tiene membresías de organización
      const memberships = await client.query(
        'SELECT COUNT(*) FROM organization_memberships WHERE user_id = $1',
        [id]
      );
      
      const membershipCount = parseInt(memberships.rows[0].count, 10);
      
      if (membershipCount > 0) {
        throw new BusinessLogicError(
          `No se puede eliminar el usuario porque pertenece a ${membershipCount} organización(es). ` +
          'Elimine primero las membresías del usuario.'
        );
      }
      
      // Eliminar cuentas vinculadas y sesiones
      await client.query('DELETE FROM "Account" WHERE user_id = $1', [id]);
      await client.query('DELETE FROM "Session" WHERE user_id = $1', [id]);
      
      // Finalmente eliminar el usuario
      const result = await client.query(
        'DELETE FROM users WHERE id = $1 RETURNING id',
        [id]
      );
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Usuario');
      }
      
      logger.info(`Usuario eliminado: ${id}`);
      return true;
    });
  }
}

module.exports = new UsersService();