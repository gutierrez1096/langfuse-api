'use strict';

const { db, transaction } = require('./database.service');
const { generateId, generateApiKey, hashSecretKey } = require('../utils/id-generator');
const { NotFoundError, BusinessLogicError } = require('../utils/errors');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este servicio
const logger = createContextLogger('api-keys-service');

/**
 * Servicio para manejar operaciones relacionadas con API keys
 */
class ApiKeysService {
  /**
   * Obtiene todas las API keys de un proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de API keys
   */
  async getByProject(projectId) {
    return db.query(
      `SELECT id, created_at, public_key, display_secret_key, last_used_at, note, expires_at
       FROM api_keys
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );
  }

  /**
   * Obtiene detalles de una API key específica
   * @param {string} id - ID de la API key
   * @returns {Promise<Object|null>} Detalles de la API key o null si no existe
   */
  async getById(id) {
    const apiKey = await db.queryOne(
      `SELECT ak.id, ak.created_at, ak.public_key, ak.display_secret_key, 
              ak.last_used_at, ak.note, ak.expires_at, p.id as project_id, p.name as project_name
       FROM api_keys ak
       JOIN projects p ON ak.project_id = p.id
       WHERE ak.id = $1 AND p.deleted_at IS NULL`,
      [id]
    );
    
    if (!apiKey) {
      throw new NotFoundError('API key');
    }
    
    return apiKey;
  }

  /**
   * Crea una nueva API key para un proyecto
   * @param {string} projectId - ID del proyecto
   * @param {Object} data - Datos adicionales
   * @param {string} data.note - Nota descriptiva (opcional)
   * @param {Date|string|null} data.expiresAt - Fecha de expiración (opcional)
   * @returns {Promise<Object>} Nueva API key creada
   */
  async create(projectId, { note = null, expiresAt = null } = {}) {
    // Validar fecha de expiración si se proporciona
    let parsedExpiresAt = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      
      if (isNaN(parsedExpiresAt.getTime())) {
        throw new BusinessLogicError('Formato de fecha de expiración inválido');
      }
      
      // Verificar que la fecha sea futura
      if (parsedExpiresAt <= new Date()) {
        throw new BusinessLogicError('La fecha de expiración debe ser futura');
      }
    }
    
    return transaction(async (client) => {
      // Verificar si el proyecto existe
      const projectCheck = await client.query(
        'SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL',
        [projectId]
      );
      
      if (projectCheck.rows.length === 0) {
        throw new NotFoundError('Proyecto');
      }
      
      // Generar API keys
      const publicKey = generateApiKey('pk');
      const secretKey = generateApiKey('sk');
      const hashedSecretKey = hashSecretKey(secretKey);
      
      // Crear API key
      const apiKeyId = generateId('key');
      const apiKeyResult = await client.query(
        `INSERT INTO api_keys (
          id, 
          project_id, 
          created_at, 
          public_key, 
          hashed_secret_key, 
          display_secret_key,
          note,
          expires_at
        ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7)
        RETURNING id, created_at, public_key, display_secret_key, note, expires_at`,
        [
          apiKeyId, 
          projectId, 
          publicKey, 
          hashedSecretKey, 
          secretKey.substring(0, 8) + '...', 
          note,
          parsedExpiresAt
        ]
      );
      
      logger.info(`Nueva API key creada con ID: ${apiKeyId} para proyecto ${projectId}${parsedExpiresAt ? ` (expira: ${parsedExpiresAt.toISOString()})` : ''}`);
      
      // Devolver con secretKey completa (solo se muestra una vez)
      return {
        ...apiKeyResult.rows[0],
        secretKey
      };
    });
  }

  /**
   * Regenera una API key existente
   * @param {string} id - ID de la API key
   * @param {Object} options - Opciones de regeneración
   * @param {Date|string|null} options.expiresAt - Nueva fecha de expiración (opcional)
   * @returns {Promise<Object>} Nueva API key regenerada
   */
  async regenerate(id, { expiresAt = null } = {}) {
    // Validar fecha de expiración si se proporciona
    let parsedExpiresAt = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      
      if (isNaN(parsedExpiresAt.getTime())) {
        throw new BusinessLogicError('Formato de fecha de expiración inválido');
      }
      
      // Verificar que la fecha sea futura
      if (parsedExpiresAt <= new Date()) {
        throw new BusinessLogicError('La fecha de expiración debe ser futura');
      }
    }
    
    return transaction(async (client) => {
      // Verificar si la API key existe
      const apiKeyCheck = await client.query(
        'SELECT id, project_id, note, expires_at FROM api_keys WHERE id = $1',
        [id]
      );
      
      if (apiKeyCheck.rows.length === 0) {
        throw new NotFoundError('API key');
      }
      
      const existingKey = apiKeyCheck.rows[0];
      
      // Si no se proporciona nueva fecha de expiración, mantener la actual
      if (expiresAt === null && existingKey.expires_at) {
        parsedExpiresAt = existingKey.expires_at;
      }
      
      // Generar nuevas claves
      const publicKey = generateApiKey('pk');
      const secretKey = generateApiKey('sk');
      const hashedSecretKey = hashSecretKey(secretKey);
      
      // Actualizar la API key existente
      const apiKeyResult = await client.query(
        `UPDATE api_keys
         SET public_key = $1, 
             hashed_secret_key = $2, 
             display_secret_key = $3,
             updated_at = CURRENT_TIMESTAMP,
             expires_at = $4
         WHERE id = $5
         RETURNING id, created_at, public_key, display_secret_key, note, last_used_at, expires_at`,
        [
          publicKey,
          hashedSecretKey,
          secretKey.substring(0, 8) + '...',
          parsedExpiresAt,
          id
        ]
      );
      
      logger.info(`API key regenerada con ID: ${id}${parsedExpiresAt ? ` (expira: ${parsedExpiresAt.toISOString()})` : ''}`);
      
      // Devolver con secretKey completa (solo se muestra una vez)
      return {
        ...apiKeyResult.rows[0],
        secretKey
      };
    });
  }

  /**
   * Actualiza la fecha de expiración de una API key
   * @param {string} id - ID de la API key
   * @param {Date|string|null} expiresAt - Nueva fecha de expiración (null para eliminar expiración)
   * @returns {Promise<Object>} API key actualizada
   */
  async updateExpiration(id, expiresAt) {
    // Validar fecha de expiración si no es null
    let parsedExpiresAt = null;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      
      if (isNaN(parsedExpiresAt.getTime())) {
        throw new BusinessLogicError('Formato de fecha de expiración inválido');
      }
      
      // Verificar que la fecha sea futura
      if (parsedExpiresAt <= new Date()) {
        throw new BusinessLogicError('La fecha de expiración debe ser futura');
      }
    }
    
    const result = await db.query(
      `UPDATE api_keys
       SET expires_at = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, created_at, public_key, display_secret_key, note, last_used_at, expires_at`,
      [parsedExpiresAt, id]
    );
    
    if (result.length === 0) {
      throw new NotFoundError('API key');
    }
    
    logger.info(`Expiración de API key ${id} actualizada: ${parsedExpiresAt ? parsedExpiresAt.toISOString() : 'sin expiración'}`);
    return result[0];
  }

  /**
   * Actualiza la nota de una API key
   * @param {string} id - ID de la API key
   * @param {string} note - Nueva nota descriptiva
   * @returns {Promise<Object>} API key actualizada
   */
  async updateNote(id, note) {
    const result = await db.query(
      `UPDATE api_keys
       SET note = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, created_at, public_key, display_secret_key, note, last_used_at, expires_at`,
      [note, id]
    );
    
    if (result.length === 0) {
      throw new NotFoundError('API key');
    }
    
    logger.info(`Nota de API key ${id} actualizada`);
    return result[0];
  }

  /**
   * Elimina una API key
   * @param {string} id - ID de la API key
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async delete(id) {
    const result = await db.query(
      'DELETE FROM api_keys WHERE id = $1 RETURNING id',
      [id]
    );
    
    if (result.length === 0) {
      throw new NotFoundError('API key');
    }
    
    logger.info(`API key eliminada: ${id}`);
    return true;
  }

  /**
   * Obtiene todas las API keys expiradas
   * @returns {Promise<Array>} Lista de API keys expiradas
   */
  async getExpired() {
    return db.query(
      `SELECT id, created_at, public_key, display_secret_key, last_used_at, note, expires_at, project_id
       FROM api_keys
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
       ORDER BY expires_at ASC`
    );
  }

  /**
   * Elimina todas las API keys expiradas
   * @returns {Promise<number>} Número de API keys eliminadas
   */
  async cleanupExpired() {
    const result = await db.query(
      `DELETE FROM api_keys 
       WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
       RETURNING id`
    );
    
    const count = result.length;
    if (count > 0) {
      logger.info(`Eliminadas ${count} API keys expiradas`);
    }
    
    return count;
  }

  /**
   * Verifica una API key para autenticación
   * @param {string} publicKey - Clave pública
   * @param {string} secretKey - Clave secreta
   * @returns {Promise<Object|null>} Proyecto asociado o null si las credenciales son inválidas
   */
  async verify(publicKey, secretKey) {
    if (!publicKey || !secretKey) {
      return null;
    }
    
    // Buscar la API key por su clave pública
    const apiKey = await db.queryOne(
      `SELECT project_id, hashed_secret_key, expires_at 
       FROM api_keys 
       WHERE public_key = $1`,
      [publicKey]
    );
    
    if (!apiKey) {
      return null;
    }
    
    // Verificar si la clave ha expirado
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      logger.warn(`Intento de uso de API key expirada: ${publicKey}`);
      return null;
    }
    
    // Verificar la clave secreta hasheada
    const hashedSecret = hashSecretKey(secretKey);
    
    if (hashedSecret !== apiKey.hashed_secret_key) {
      return null;
    }
    
    // Buscar el proyecto
    const project = await db.queryOne(
      'SELECT id, org_id, name, deleted_at FROM projects WHERE id = $1',
      [apiKey.project_id]
    );
    
    if (!project || project.deleted_at) {
      return null;
    }
    
    // Actualizar último uso de la API key
    await db.query(
      'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE public_key = $1',
      [publicKey]
    );
    
    // Retornar proyecto (sin deleted_at)
    const { deleted_at, ...projectData } = project;
    return projectData;
  }
}

module.exports = new ApiKeysService();