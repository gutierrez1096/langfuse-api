'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { NotFoundError } = require('../utils/errors');
const organizationsService = require('../services/organizations.service');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este controlador
const logger = createContextLogger('organizations-controller');

/**
 * @route GET /api/organizations
 * @description Listar todas las organizaciones
 */
const getAllOrganizations = asyncHandler(async (req, res) => {
  logger.info('Obteniendo lista de organizaciones');
  
  const organizations = await organizationsService.getAll();
  
  res.json(organizations);
});

/**
 * @route GET /api/organizations/:id
 * @description Obtener una organización por ID
 */
const getOrganizationById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Obteniendo organización con ID: ${id}`);
  
  const organization = await organizationsService.getById(id);
  
  if (!organization) {
    throw new NotFoundError('Organización');
  }
  
  res.json(organization);
});

/**
 * @route POST /api/organizations
 * @description Crear una nueva organización con un usuario propietario
 */
const createOrganization = asyncHandler(async (req, res) => {
  const { name, userId } = req.body;
  logger.info(`Creando nueva organización: ${name} con propietario: ${userId}`);
  
  const newOrganization = await organizationsService.create({ name, userId });
  
  res.status(201).json(newOrganization);
});

/**
 * @route PUT /api/organizations/:id
 * @description Actualizar una organización existente
 */
const updateOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  logger.info(`Actualizando organización con ID: ${id}`);
  
  const updatedOrganization = await organizationsService.update(id, { name });
  
  if (!updatedOrganization) {
    throw new NotFoundError('Organización');
  }
  
  res.json(updatedOrganization);
});

/**
 * @route GET /api/organizations/:id/members
 * @description Obtener miembros de una organización
 */
const getOrganizationMembers = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Obteniendo miembros de organización con ID: ${id}`);
  
  const members = await organizationsService.getMembers(id);
  
  res.json(members);
});

/**
 * @route POST /api/organizations/:id/members
 * @description Añadir un usuario a una organización
 */
const addOrganizationMember = asyncHandler(async (req, res) => {
  const { id: orgId } = req.params;
  const { userId, role = 'VIEWER' } = req.body;
  logger.info(`Añadiendo usuario ${userId} a organización ${orgId} con rol ${role}`);
  
  const member = await organizationsService.addMember(orgId, userId, role);
  
  res.status(201).json(member);
});

/**
 * @route PUT /api/organizations/:orgId/members/:userId
 * @description Actualizar rol de un miembro en la organización
 */
const updateOrganizationMember = asyncHandler(async (req, res) => {
  const { orgId, userId } = req.params;
  const { role } = req.body;
  logger.info(`Actualizando rol de usuario ${userId} en organización ${orgId} a ${role}`);
  
  const member = await organizationsService.updateMember(orgId, userId, role);
  
  res.json(member);
});

/**
 * @route DELETE /api/organizations/:orgId/members/:userId
 * @description Eliminar un miembro de la organización
 */
const removeOrganizationMember = asyncHandler(async (req, res) => {
  const { orgId, userId } = req.params;
  logger.info(`Eliminando usuario ${userId} de organización ${orgId}`);
  
  await organizationsService.removeMember(orgId, userId);
  
  res.json({ message: 'Miembro eliminado correctamente' });
});

module.exports = {
  getAllOrganizations,
  getOrganizationById,
  createOrganization,
  updateOrganization,
  getOrganizationMembers,
  addOrganizationMember,
  updateOrganizationMember,
  removeOrganizationMember
};