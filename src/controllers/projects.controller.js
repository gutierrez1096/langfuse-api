'use strict';

const { asyncHandler } = require('../middleware/error.middleware');
const { NotFoundError } = require('../utils/errors');
const projectsService = require('../services/projects.service');
const { createContextLogger } = require('../utils/logger');

// Logger contextual para este controlador
const logger = createContextLogger('projects-controller');

/**
 * @route GET /api/projects
 * @description Listar todos los proyectos (filtrable por organización)
 */
const getAllProjects = asyncHandler(async (req, res) => {
  const { orgId } = req.query;
  logger.info(`Obteniendo lista de proyectos${orgId ? ` para organización ${orgId}` : ''}`);
  
  const projects = await projectsService.getAll(orgId);
  
  res.json(projects);
});

/**
 * @route GET /api/projects/:id
 * @description Obtener un proyecto por ID
 */
const getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Obteniendo proyecto con ID: ${id}`);
  
  const project = await projectsService.getById(id);
  
  if (!project) {
    throw new NotFoundError('Proyecto');
  }
  
  res.json(project);
});

/**
 * @route POST /api/projects
 * @description Crear un nuevo proyecto y generar API keys
 */
const createProject = asyncHandler(async (req, res) => {
  const { name, orgId } = req.body;
  logger.info(`Creando nuevo proyecto en organización ${orgId}`);
  
  const newProject = await projectsService.create({ name, orgId });
  
  res.status(201).json(newProject);
});

/**
 * @route PUT /api/projects/:id
 * @description Actualizar un proyecto existente
 */
const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  logger.info(`Actualizando proyecto con ID: ${id}`);
  
  const updatedProject = await projectsService.update(id, { name });
  
  if (!updatedProject) {
    throw new NotFoundError('Proyecto');
  }
  
  res.json(updatedProject);
});

/**
 * @route DELETE /api/projects/:id
 * @description Marcar un proyecto como eliminado (soft delete)
 */
const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;
  logger.info(`Eliminando proyecto con ID: ${id}`);
  
  await projectsService.delete(id);
  
  res.json({ message: 'Proyecto eliminado correctamente' });
});

module.exports = {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject
};