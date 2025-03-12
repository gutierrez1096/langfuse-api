'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { NotFoundError } = require('../utils/errors');
const projectMembershipsService = require('../services/project-memberships.service');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este controlador
const logger = createContextLogger('project-memberships-controller');

/**
 * @route GET /api/projects/:projectId/members
 * @description Listar todos los miembros de un proyecto
 */
const getProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  logger.info(`Obteniendo miembros del proyecto: ${projectId}`);
  
  const members = await projectMembershipsService.getByProject(projectId);
  
  res.json(members);
});

/**
 * @route POST /api/projects/:projectId/members
 * @description Añadir un miembro a un proyecto
 */
const addProjectMember = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { userId, role = 'VIEWER' } = req.body;
  logger.info(`Añadiendo usuario ${userId} al proyecto ${projectId} con rol ${role}`);
  
  const membership = await projectMembershipsService.addMember(projectId, userId, role);
  
  res.status(201).json(membership);
});

/**
 * @route GET /api/projects/:projectId/members/:userId
 * @description Obtener detalles de un miembro específico del proyecto
 */
const getProjectMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  logger.info(`Obteniendo detalles de membresía: ${userId} en proyecto ${projectId}`);
  
  const membership = await projectMembershipsService.getMember(projectId, userId);
  
  if (!membership) {
    throw new NotFoundError('Membresía de proyecto');
  }
  
  res.json(membership);
});

/**
 * @route PUT /api/projects/:projectId/members/:userId
 * @description Actualizar rol de un miembro en el proyecto
 */
const updateProjectMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  const { role } = req.body;
  logger.info(`Actualizando rol de usuario ${userId} en proyecto ${projectId} a ${role}`);
  
  const membership = await projectMembershipsService.updateMember(projectId, userId, role);
  
  res.json(membership);
});

/**
 * @route DELETE /api/projects/:projectId/members/:userId
 * @description Eliminar un miembro del proyecto
 */
const removeProjectMember = asyncHandler(async (req, res) => {
  const { projectId, userId } = req.params;
  logger.info(`Eliminando usuario ${userId} del proyecto ${projectId}`);
  
  await projectMembershipsService.removeMember(projectId, userId);
  
  res.json({ message: 'Miembro eliminado correctamente del proyecto' });
});

/**
 * @route POST /api/projects/:projectId/members/batch
 * @description Añadir múltiples miembros a un proyecto
 */
const addBatchProjectMembers = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { members } = req.body;
  logger.info(`Añadiendo ${members.length} miembros al proyecto ${projectId}`);
  
  const result = await projectMembershipsService.addBatchMembers(projectId, members);
  
  res.status(201).json(result);
});

module.exports = {
  getProjectMembers,
  addProjectMember,
  getProjectMember,
  updateProjectMember,
  removeProjectMember,
  addBatchProjectMembers
};