'use strict';

const { db, transaction } = require('./database.service');
const { generateId, generateApiKey, hashSecretKey } = require('../utils/id-generator');
const { NotFoundError } = require('../utils/errors');
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
      `SELECT id, created_at, public_key, display_secret_key, last_used_at, note
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
              ak.last_used_at, ak.note, p.id as project_id, p.name as project_name
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
   * @returns {Promise<Object>} Nueva API key creada
   */
  async create(projectId, { note = null } = {}) {
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
          note
        ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5, $6)
        RETURNING id, created_at, public_key, display_secret_key, note`,
        [
          apiKeyId, 
          projectId, 
          publicKey, 
          hashedSecretKey, 
          secretKey.substring(0, 8) + '...', 
          note
        ]
      );
      
      logger.info(`Nueva API key creada con ID: ${apiKeyId} para proyecto ${projectId}`);
      
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
   * @returns {Promise<Object>} Nueva API key regenerada
   */
  async regenerate(id) {
    return transaction(async (client) => {
      // Verificar si la API key existe
      const apiKeyCheck = await client.query(
        'SELECT id, project_id, note FROM api_keys WHERE id = $1',
        [id]
      );
      
      if (apiKeyCheck.rows.length === 0) {
        throw new NotFoundError('API key');
      }
      
      const existingKey = apiKeyCheck.rows[0];
      
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
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, created_at, public_key, display_secret_key, note, last_used_at`,
        [
          publicKey,
          hashedSecretKey,
          secretKey.substring(0, 8) + '...',
          id
        ]
      );
      
      logger.info(`API key regenerada con ID: ${id}`);
      
      // Devolver con secretKey completa (solo se muestra una vez)
      return {
        ...apiKeyResult.rows[0],
        secretKey
      };
    });
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
      'SELECT project_id, hashed_secret_key FROM api_keys WHERE public_key = $1',
      [publicKey]
    );
    
    if (!apiKey) {
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