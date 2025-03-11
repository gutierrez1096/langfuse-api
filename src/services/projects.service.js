'use strict';

const { db, transaction } = require('./database.service');
const { generateId, generateApiKey, hashSecretKey } = require('../utils/id-generator');
const { NotFoundError, BusinessLogicError } = require('../utils/errors');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este servicio
const logger = createContextLogger('projects-service');

/**
 * Servicio para manejar operaciones relacionadas con proyectos
 */
class ProjectsService {
  /**
   * Obtiene todos los proyectos
   * @param {string} orgId - ID de organización para filtrar (opcional)
   * @returns {Promise<Array>} Lista de proyectos
   */
  async getAll(orgId = null) {
    let queryText = 'SELECT * FROM projects WHERE deleted_at IS NULL';
    const params = [];
    
    if (orgId) {
      queryText += ' AND org_id = $1';
      params.push(orgId);
    }
    
    queryText += ' ORDER BY created_at DESC';
    
    return db.query(queryText, params);
  }

  /**
   * Obtiene un proyecto por su ID
   * @param {string} id - ID del proyecto
   * @returns {Promise<Object|null>} Proyecto o null si no existe
   */
  async getById(id) {
    return db.queryOne(
      'SELECT * FROM projects WHERE id = $1 AND deleted_at IS NULL',
      [id]
    );
  }

  /**
   * Crea un nuevo proyecto
   * @param {Object} data - Datos del proyecto
   * @param {string} data.name - Nombre del proyecto
   * @param {string} data.orgId - ID de la organización
   * @returns {Promise<Object>} Nuevo proyecto creado con API keys
   */
  async create({ name, orgId }) {
    if (!name || !name.trim()) {
      throw new BusinessLogicError('El nombre es requerido');
    }
    
    if (!orgId) {
      throw new BusinessLogicError('El ID de organización es requerido');
    }
    
    return transaction(async (client) => {
      // Verificar si la organización existe
      const orgCheck = await client.query(
        'SELECT id FROM organizations WHERE id = $1',
        [orgId]
      );
      
      if (orgCheck.rows.length === 0) {
        throw new NotFoundError('Organización');
      }
      
      // Generar ID único para el proyecto
      const projectId = generateId('prj');
      
      // Insertar proyecto
      const projectResult = await client.query(
        `INSERT INTO projects (id, name, org_id, created_at, updated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [projectId, name.trim(), orgId]
      );
      
      const project = projectResult.rows[0];
      
      // Generar par de API keys
      const publicKey = generateApiKey('pk');
      const secretKey = generateApiKey('sk');
      const hashedSecretKey = hashSecretKey(secretKey);
      
      // Crear API key en la base de datos
      const apiKeyId = generateId('key');
      await client.query(
        `INSERT INTO api_keys (
          id, 
          project_id, 
          created_at, 
          public_key, 
          hashed_secret_key, 
          display_secret_key
        ) VALUES ($1, $2, CURRENT_TIMESTAMP, $3, $4, $5)`,
        [
          apiKeyId, 
          projectId, 
          publicKey, 
          hashedSecretKey, 
          secretKey.substring(0, 8) + '...'
        ]
      );
      
      logger.info(`Proyecto creado con ID: ${projectId} en organización ${orgId}`);
      
      // Devolver proyecto con API keys (secretKey solo se muestra una vez)
      return {
        ...project,
        apiKeys: {
          publicKey,
          secretKey // Completa, solo se muestra ahora
        }
      };
    });
  }

  /**
   * Actualiza un proyecto existente
   * @param {string} id - ID del proyecto
   * @param {Object} data - Datos a actualizar
   * @param {string} data.name - Nuevo nombre
   * @returns {Promise<Object|null>} Proyecto actualizado o null
   */
  async update(id, { name }) {
    if (!name || !name.trim()) {
      throw new BusinessLogicError('El nombre es requerido');
    }
    
    const result = await db.query(
      `UPDATE projects 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [name.trim(), id]
    );
    
    if (result.length === 0) {
      return null;
    }
    
    logger.info(`Proyecto actualizado: ${id}`);
    return result[0];
  }

  /**
   * Marca un proyecto como eliminado (soft delete)
   * @param {string} id - ID del proyecto
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async delete(id) {
    const result = await db.query(
      `UPDATE projects 
       SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [id]
    );
    
    if (result.length === 0) {
      throw new NotFoundError('Proyecto');
    }
    
    logger.info(`Proyecto marcado como eliminado: ${id}`);
    return true;
  }
}

module.exports = new ProjectsService();