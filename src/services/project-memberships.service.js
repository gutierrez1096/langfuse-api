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
const logger = createContextLogger('project-memberships-service');

/**
 * Servicio para manejar operaciones relacionadas con membresías de proyectos
 */
class ProjectMembershipsService {
  /**
   * Obtiene todos los miembros de un proyecto
   * @param {string} projectId - ID del proyecto
   * @returns {Promise<Array>} Lista de miembros
   */
  async getByProject(projectId) {
    // Verificar si el proyecto existe
    const projectExists = await db.queryOne(
      'SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL',
      [projectId]
    );
    
    if (!projectExists) {
      throw new NotFoundError('Proyecto');
    }
    
    return db.query(
      `SELECT pm.project_id, pm.user_id, pm.role, pm.created_at, pm.updated_at,
              u.name, u.email, u.image
       FROM project_memberships pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY pm.created_at DESC`,
      [projectId]
    );
  }

  /**
   * Obtiene detalles de un miembro específico
   * @param {string} projectId - ID del proyecto
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object|null>} Detalles de la membresía
   */
  async getMember(projectId, userId) {
    return db.queryOne(
      `SELECT pm.project_id, pm.user_id, pm.role, pm.created_at, pm.updated_at,
              u.name, u.email, u.image
       FROM project_memberships pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1 AND pm.user_id = $2`,
      [projectId, userId]
    );
  }

  /**
   * Añade un usuario a un proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} userId - ID del usuario
   * @param {string} role - Rol del usuario (OWNER, ADMIN, MEMBER, VIEWER)
   * @returns {Promise<Object>} Membresía creada
   */
  async addMember(projectId, userId, role = 'VIEWER') {
    if (!userId) {
      throw new BusinessLogicError('El ID de usuario es requerido');
    }
    
    // Validar rol
    const validRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      throw new BusinessLogicError('Rol inválido. Debe ser OWNER, ADMIN, MEMBER o VIEWER');
    }
    
    return transaction(async (client) => {
      // Verificar si el proyecto existe
      const projectCheck = await client.query(
        'SELECT id, org_id FROM projects WHERE id = $1 AND deleted_at IS NULL',
        [projectId]
      );
      
      if (projectCheck.rows.length === 0) {
        throw new NotFoundError('Proyecto');
      }
      
      const orgId = projectCheck.rows[0].org_id;
      
      // Verificar si el usuario existe
      const userCheck = await client.query(
        'SELECT id FROM users WHERE id = $1',
        [userId]
      );
      
      if (userCheck.rows.length === 0) {
        throw new NotFoundError('Usuario');
      }
      
      // Verificar si existe membresía de organización
      const orgMembershipCheck = await client.query(
        'SELECT id FROM organization_memberships WHERE org_id = $1 AND user_id = $2',
        [orgId, userId]
      );
      
      let orgMembershipId;
      
      if (orgMembershipCheck.rows.length === 0) {
        // Crear membresía de organización primero con rol VIEWER por defecto
        orgMembershipId = generateId('om');
        await client.query(
          `INSERT INTO organization_memberships (id, org_id, user_id, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [orgMembershipId, orgId, userId, 'VIEWER']
        );
        
        logger.info(`Usuario ${userId} añadido a organización ${orgId} automáticamente`);
      } else {
        orgMembershipId = orgMembershipCheck.rows[0].id;
      }
      
      // Verificar si ya es miembro del proyecto
      const memberCheck = await client.query(
        'SELECT project_id, user_id FROM project_memberships WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );
      
      if (memberCheck.rows.length > 0) {
        throw new ConflictError('El usuario ya es miembro de este proyecto');
      }
      
      // Crear membresía de proyecto
      const memberResult = await client.query(
        `INSERT INTO project_memberships (project_id, user_id, org_membership_id, role, created_at, updated_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING project_id, user_id, role, created_at, updated_at`,
        [projectId, userId, orgMembershipId, role]
      );
      
      // Obtener datos del usuario para devolver información completa
      const userResult = await client.query(
        'SELECT name, email, image FROM users WHERE id = $1',
        [userId]
      );
      
      logger.info(`Usuario ${userId} añadido a proyecto ${projectId} con rol ${role}`);
      
      return {
        ...memberResult.rows[0],
        ...userResult.rows[0]
      };
    });
  }

  /**
   * Actualiza el rol de un miembro en el proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} userId - ID del usuario
   * @param {string} role - Nuevo rol
   * @returns {Promise<Object>} Membresía actualizada
   */
  async updateMember(projectId, userId, role) {
    if (!role) {
      throw new BusinessLogicError('El rol es requerido');
    }
    
    // Validar rol
    const validRoles = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
    if (!validRoles.includes(role)) {
      throw new BusinessLogicError('Rol inválido. Debe ser OWNER, ADMIN, MEMBER o VIEWER');
    }
    
    // Si el nuevo rol no es OWNER, verificar que no sea el último propietario
    let result;
    if (role !== 'OWNER') {
      result = await transaction(async (client) => {
        // Comprobar si el usuario actual es OWNER
        const currentRole = await client.query(
          'SELECT role FROM project_memberships WHERE project_id = $1 AND user_id = $2',
          [projectId, userId]
        );
        
        if (currentRole.rows.length === 0) {
          throw new NotFoundError('Membresía de proyecto');
        }
        
        if (currentRole.rows[0].role === 'OWNER') {
          // Contar propietarios
          const ownersCount = await client.query(
            'SELECT COUNT(*) FROM project_memberships WHERE project_id = $1 AND role = $2',
            [projectId, 'OWNER']
          );
          
          if (parseInt(ownersCount.rows[0].count) <= 1) {
            throw new BusinessLogicError('No se puede cambiar el rol del último propietario');
          }
        }
        
        // Actualizar rol
        const updateResult = await client.query(
          `UPDATE project_memberships 
           SET role = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE project_id = $2 AND user_id = $3 
           RETURNING project_id, user_id, role, created_at, updated_at`,
          [role, projectId, userId]
        );
        
        if (updateResult.rows.length === 0) {
          throw new NotFoundError('Membresía de proyecto');
        }
        
        // Obtener datos del usuario para devolver información completa
        const userResult = await client.query(
          'SELECT name, email, image FROM users WHERE id = $1',
          [userId]
        );
        
        logger.info(`Rol de usuario ${userId} en proyecto ${projectId} actualizado a ${role}`);
        
        return {
          ...updateResult.rows[0],
          ...userResult.rows[0]
        };
      });
    } else {
      // Si el nuevo rol es OWNER, simplemente actualizar
      result = await transaction(async (client) => {
        const updateResult = await client.query(
          `UPDATE project_memberships 
           SET role = $1, updated_at = CURRENT_TIMESTAMP 
           WHERE project_id = $2 AND user_id = $3 
           RETURNING project_id, user_id, role, created_at, updated_at`,
          [role, projectId, userId]
        );
        
        if (updateResult.rows.length === 0) {
          throw new NotFoundError('Membresía de proyecto');
        }
        
        // Obtener datos del usuario para devolver información completa
        const userResult = await client.query(
          'SELECT name, email, image FROM users WHERE id = $1',
          [userId]
        );
        
        logger.info(`Usuario ${userId} promovido a propietario en proyecto ${projectId}`);
        
        return {
          ...updateResult.rows[0],
          ...userResult.rows[0]
        };
      });
    }
    
    return result;
  }

  /**
   * Elimina un miembro del proyecto
   * @param {string} projectId - ID del proyecto
   * @param {string} userId - ID del usuario
   * @returns {Promise<boolean>} true si se eliminó correctamente
   */
  async removeMember(projectId, userId) {
    return transaction(async (client) => {
      // Verificar si es el último propietario
      const currentRole = await client.query(
        'SELECT role FROM project_memberships WHERE project_id = $1 AND user_id = $2',
        [projectId, userId]
      );
      
      if (currentRole.rows.length === 0) {
        throw new NotFoundError('Membresía de proyecto');
      }
      
      if (currentRole.rows[0].role === 'OWNER') {
        // Contar propietarios
        const ownersCount = await client.query(
          'SELECT COUNT(*) FROM project_memberships WHERE project_id = $1 AND role = $2',
          [projectId, 'OWNER']
        );
        
        if (parseInt(ownersCount.rows[0].count) <= 1) {
          throw new BusinessLogicError('No se puede eliminar al último propietario');
        }
      }
      
      // Eliminar la membresía
      const deleteResult = await client.query(
        'DELETE FROM project_memberships WHERE project_id = $1 AND user_id = $2 RETURNING project_id',
        [projectId, userId]
      );
      
      if (deleteResult.rows.length === 0) {
        throw new NotFoundError('Membresía de proyecto');
      }
      
      logger.info(`Usuario ${userId} eliminado del proyecto ${projectId}`);
      return true;
    });
  }

  /**
   * Añade múltiples miembros a un proyecto
   * @param {string} projectId - ID del proyecto
   * @param {Array} members - Array de {userId, role}
   * @returns {Promise<Object>} Resultado con éxitos y errores
   */
  async addBatchMembers(projectId, members) {
    if (!Array.isArray(members) || members.length === 0) {
      throw new BusinessLogicError('Se requiere un array de miembros válido');
    }
    
    const result = {
      success: [],
      errors: []
    };
    
    // Verificar que el proyecto exista
    const projectExists = await db.queryOne(
      'SELECT id FROM projects WHERE id = $1 AND deleted_at IS NULL',
      [projectId]
    );
    
    if (!projectExists) {
      throw new NotFoundError('Proyecto');
    }
    
    // Procesar cada miembro secuencialmente para mejor manejo de errores
    for (const member of members) {
      try {
        const { userId, role = 'VIEWER' } = member;
        
        if (!userId) {
          result.errors.push({
            userId: member.userId || 'unknown',
            error: 'ID de usuario requerido'
          });
          continue;
        }
        
        const membership = await this.addMember(projectId, userId, role);
        result.success.push(membership);
      } catch (error) {
        logger.warn(`Error al añadir miembro ${member.userId} al proyecto ${projectId}:`, error);
        
        result.errors.push({
          userId: member.userId || 'unknown',
          error: error.message
        });
      }
    }
    
    return result;
  }
}

module.exports = new ProjectMembershipsService();