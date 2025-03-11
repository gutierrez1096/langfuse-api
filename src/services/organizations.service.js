'use strict';

const { db, transaction } = require('./database.service');
const { generateId } = require('../utils/id-generator');
const { 
  NotFoundError, 
  ConflictError, 
  BusinessLogicError 
} = require('../utils/errors');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este servicio
const logger = createContextLogger('organizations-service');

/**
 * Servicio para manejar operaciones relacionadas con organizaciones
 */
class OrganizationsService {
  /**
   * Obtiene todas las organizaciones
   * @returns {Promise<Array>} Lista de organizaciones
   */
  async getAll() {
    return db.query(
      'SELECT * FROM organizations ORDER BY created_at DESC'
    );
  }

  /**
   * Obtiene una organización por su ID
   * @param {string} id - ID de la organización
   * @returns {Promise<Object|null>} Organización o null si no existe
   */
  async getById(id) {
    return db.queryOne(
      'SELECT * FROM organizations WHERE id = $1',
      [id]
    );
  }

  /**
   * Crea una nueva organización
   * @param {Object} data - Datos de la organización
   * @param {string} data.name - Nombre de la organización
   * @param {string} data.userId - ID del usuario que será propietario (obligatorio)
   * @returns {Promise<Object>} Nueva organización creada
   */
  async create({ name, userId }) {
    if (!name || !name.trim()) {
      throw new BusinessLogicError('El nombre es requerido');
    }
    
    if (!userId) {
      throw new BusinessLogicError('El ID de usuario es obligatorio para crear una organización');
    }
    
    return transaction(async (client) => {
      // Verificar si el usuario proporcionado existe
      const userExists = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userExists.rows.length === 0) {
        throw new NotFoundError('Usuario no encontrado');
      }
      
      // Generar ID único para la organización usando cuid
      const id = generateId('org');
      
      // Insertar organización
      const result = await client.query(
        `INSERT INTO organizations (id, name, created_at, updated_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [id, name.trim()]
      );
      
      const organization = result.rows[0];
      
      // Crear membresía para el usuario (propietario de la organización)
      const membershipId = generateId('om');
      await client.query(
        `INSERT INTO organization_memberships (id, org_id, user_id, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [membershipId, id, userId, 'OWNER']
      );
      
      logger.info(`Organización creada con ID: ${id}, propietario: ${userId}`);
      return organization;
    });
  }

  /**
   * Actualiza una organización existente
   * @param {string} id - ID de la organización
   * @param {Object} data - Datos a actualizar
   * @param {string} data.name - Nuevo nombre
   * @returns {Promise<Object|null>} Organización actualizada o null
   */
  async update(id, { name }) {
    if (!name || !name.trim()) {
      throw new BusinessLogicError('El nombre es requerido');
    }
    
    const result = await db.query(
      `UPDATE organizations 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 
       RETURNING *`,
      [name.trim(), id]
    );
    
    if (result.length === 0) {
      return null;
    }
    
    logger.info(`Organización actualizada: ${id}`);
    return result[0];
  }

  /**
   * Obtiene los miembros de una organización
   * @param {string} orgId - ID de la organización
   * @returns {Promise<Array>} Lista de miembros
   */
  async getMembers(orgId) {
    // Verificar si la organización existe
    const org = await this.getById(orgId);
    if (!org) {
      throw new NotFoundError('Organización');
    }
    
    return db.query(
      `SELECT om.id, om.user_id, om.role, om.created_at, om.updated_at,
              u.name, u.email, u.image
       FROM organization_memberships om
       JOIN users u ON om.user_id = u.id
       WHERE om.org_id = $1
       ORDER BY om.created_at DESC`,
      [orgId]
    );
  }

  /**
   * Añade un usuario a una organización
   * @param {string} orgId - ID de la organización
   * @param {string} userId - ID del usuario
   * @param {string} role - Rol del usuario (OWNER, ADMIN, VIEWER, NONE)
   * @returns {Promise<Object>} Membresía creada
   */
  async addMember(orgId, userId, role = 'VIEWER') {
    if (!userId) {
      throw new BusinessLogicError('El ID de usuario es requerido');
    }
    
    // Validar rol
    const validRoles = ['OWNER', 'ADMIN', 'VIEWER', 'NONE'];
    if (!validRoles.includes(role)) {
      throw new BusinessLogicError('Rol inválido. Debe ser OWNER, ADMIN, VIEWER o NONE');
    }
    
    return transaction(async (client) => {
      // Verificar si el usuario existe
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        throw new NotFoundError('Usuario');
      }
      
      // Verificar si la organización existe
      const orgCheck = await client.query(
        'SELECT id FROM organizations WHERE id = $1',
        [orgId]
      );
      
      if (orgCheck.rows.length === 0) {
        throw new NotFoundError('Organización');
      }
      
      // Verificar si ya es miembro
      const memberCheck = await client.query(
        'SELECT id FROM organization_memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, userId]
      );
      
      if (memberCheck.rows.length > 0) {
        throw new ConflictError('El usuario ya es miembro de esta organización');
      }
      
      // Crear membresía
      const membershipId = generateId('om');
      const memberResult = await client.query(
        `INSERT INTO organization_memberships (id, org_id, user_id, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [membershipId, orgId, userId, role]
      );
      
      logger.info(`Usuario ${userId} añadido a organización ${orgId} con rol ${role}`);
      return memberResult.rows[0];
    });
  }

  /**
   * Actualiza el rol de un miembro en la organización
   * @param {string} orgId - ID de la organización
   * @param {string} userId - ID del usuario
   * @param {string} role - Nuevo rol
   * @returns {Promise<Object>} Membresía actualizada
   */
  async updateMember(orgId, userId, role) {
    if (!role) {
      throw new BusinessLogicError('El rol es requerido');
    }
    
    // Validar rol
    const validRoles = ['OWNER', 'ADMIN', 'VIEWER', 'NONE'];
    if (!validRoles.includes(role)) {
      throw new BusinessLogicError('Rol inválido. Debe ser OWNER, ADMIN, VIEWER o NONE');
    }
    
    // Si el nuevo rol no es OWNER, verificar que no sea el último propietario
    let result;
    if (role !== 'OWNER') {
      result = await transaction(async (client) => {
        // Comprobar si el usuario actual es OWNER
        const currentRole = await client.query(
          'SELECT role FROM organization_memberships WHERE org_id = $1 AND user_id = $2',
          [orgId, userId]
        );
        
        if (currentRole.rows.length === 0) {
          throw new NotFoundError('Membresía');
        }
        
        if (currentRole.rows[0].role === 'OWNER') {
          // Contar propietarios
          const ownersCount = await client.query(
            'SELECT COUNT(*) FROM organization_memberships WHERE org_id = $1 AND role = $2',
            [orgId, 'OWNER']
          );
          
          if (parseInt(ownersCount.rows[0].count) <= 1) {
            throw new BusinessLogicError('No se puede cambiar el rol del último propietario');
          }
        }
        
        // Actualizar rol
        const updateResult = await client.query(
          `UPDATE organization_memberships 
           SET role = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE org_id = $2 AND user_id = $3 
           RETURNING *`,
          [role, orgId, userId]
        );
        
        if (updateResult.rows.length === 0) {
          throw new NotFoundError('Membresía');
        }
        
        logger.info(`Rol de usuario ${userId} en organización ${orgId} actualizado a ${role}`);
        return updateResult.rows[0];
      });
    } else {
      // Si el nuevo rol es OWNER, simplemente actualizar
      const rows = await db.query(
        `UPDATE organization_memberships 
         SET role = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE org_id = $2 AND user_id = $3 
         RETURNING *`,
        [role, orgId, userId]
      );
      
      if (rows.length === 0) {
        throw new NotFoundError('Membresía');
      }
      
      logger.info(`Usuario ${userId} promovido a propietario en organización ${orgId}`);
      result = rows[0];
    }
    
    return result;
  }

  /**
   * Elimina un miembro de la organización
   * @param {string} orgId - ID de la organización
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async removeMember(orgId, userId) {
    return transaction(async (client) => {
      // Verificar si es el último propietario
      const currentRole = await client.query(
        'SELECT role FROM organization_memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, userId]
      );
      
      if (currentRole.rows.length === 0) {
        throw new NotFoundError('Membresía');
      }
      
      if (currentRole.rows[0].role === 'OWNER') {
        // Contar propietarios
        const ownersCount = await client.query(
          'SELECT COUNT(*) FROM organization_memberships WHERE org_id = $1 AND role = $2',
          [orgId, 'OWNER']
        );
        
        if (parseInt(ownersCount.rows[0].count) <= 1) {
          throw new BusinessLogicError('No se puede eliminar al último propietario');
        }
      }
      
      // Primero eliminar membresías de proyecto relacionadas
      await client.query(
        'DELETE FROM project_memberships WHERE org_membership_id IN (SELECT id FROM organization_memberships WHERE org_id = $1 AND user_id = $2)',
        [orgId, userId]
      );
      
      // Luego eliminar la membresía de organización
      const deleteResult = await client.query(
        'DELETE FROM organization_memberships WHERE org_id = $1 AND user_id = $2 RETURNING *',
        [orgId, userId]
      );
      
      if (deleteResult.rows.length === 0) {
        throw new NotFoundError('Membresía');
      }
      
      logger.info(`Usuario ${userId} eliminado de organización ${orgId}`);
      return true;
    });
  }
}

module.exports = new OrganizationsService();